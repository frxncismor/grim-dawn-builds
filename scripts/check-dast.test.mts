/**
 * Pruebas de check-dast (T-077). Solo fixtures sintéticas en `mkdtempSync`:
 * ningún valor con pinta de credencial real ni informes ZAP rastreados.
 *
 * Cubre el umbral decidido por el usuario (bloquear desde MEDIO), la ausencia de
 * allowlist o configuración de severidad, el fallo cerrado ante informes vacíos o
 * mal formados y la redacción de la salida (nunca vuelca valores del objetivo).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockingAlerts,
  formatDastAlert,
  parseZapReport,
  redactUrl,
  summarizeAlerts,
} from './check-dast.mts';

const CLI = fileURLToPath(new URL('./check-dast.mts', import.meta.url));

/** Centinelas: no deben aparecer nunca en la salida del checker. */
const SENTINEL = 'SENTINEL_PRIVATE_9f2c';
const SENTINEL_QUERY = 'SENTINEL_QUERY_8a1d';
const SENTINEL_HEADER = 'SENTINEL_HEADER_77b3';
const SENTINEL_BODY = 'SENTINEL_BODY_41ee';
const SENTINEL_COOKIE = 'SENTINEL_COOKIE_5d0a';

interface AlertOptions {
  readonly name?: string;
  readonly pluginId?: string;
  readonly uri?: string;
  readonly count?: string | number;
  readonly instances?: number;
}

/** Alerta sintética de ZAP con la forma real (`site[].alerts[]`). */
function alert(riskcode: number | string, options: AlertOptions = {}): Record<string, unknown> {
  const instances = Array.from({ length: options.instances ?? 1 }, (_, index) => ({
    uri: options.uri ?? `http://127.0.0.1:8081/?token=${SENTINEL_QUERY}-${index}`,
    method: 'GET',
    param: SENTINEL_BODY,
    attack: SENTINEL_HEADER,
    evidence: SENTINEL,
  }));
  return {
    pluginid: options.pluginId ?? '10021',
    alert: options.name ?? 'X-Content-Type-Options Header Missing',
    riskcode,
    confidence: '2',
    riskdesc: 'Low (Medium)',
    desc: `${SENTINEL} response header detail`,
    solution: `${SENTINEL} configure the header`,
    reference: `https://example.invalid/${SENTINEL}`,
    otherinfo: `${SENTINEL_COOKIE} set-cookie value`,
    instances,
    count: options.count ?? String(instances.length),
  };
}

/** Informe ZAP con la forma real: `site[]` con `alerts[]`. */
function report(alerts: readonly unknown[], siteName = 'http://127.0.0.1:8081'): string {
  return JSON.stringify({
    '@version': '2.16.1',
    '@generated': '2026-11-11T00:00:00Z',
    site: [{ '@name': siteName, '@host': '127.0.0.1', '@port': '8081', alerts }],
  });
}

describe('check-dast: umbral MEDIO/ALTO/CRÍTICO', () => {
  it('acepta un informe limpio sin alertas', () => {
    const alerts = parseZapReport(report([]));
    assert.deepEqual(alerts, []);
    assert.deepEqual(blockingAlerts(alerts), []);
  });

  it('no bloquea INFORMATIVO (0) ni BAJO (1) y los resume', () => {
    const alerts = parseZapReport(
      report([alert(0, { name: 'Information disclosure' }), alert(1, { name: 'Missing header' })]),
    );
    assert.equal(alerts.length, 2);
    assert.deepEqual(blockingAlerts(alerts), []);
    const summary = summarizeAlerts(alerts, 1);
    assert.match(summary, /INFORMATIVO 1/);
    assert.match(summary, /BAJO 1/);
    assert.match(summary, /bloqueantes MEDIO\+ = 0/);
  });

  it('bloquea MEDIO, ALTO y CRÍTICO (4) sin allowlist ni lista de reglas', () => {
    for (const [riskcode, label] of [
      [2, 'MEDIO'],
      [3, 'ALTO'],
      [4, 'CRÍTICO'],
    ] as const) {
      const alerts = parseZapReport(report([alert(riskcode, { pluginId: '10021' })]));
      assert.equal(alerts.length, 1, label);
      assert.equal(blockingAlerts(alerts).length, 1, `${label} bloquea aunque la regla sea 10021`);
      assert.match(summarizeAlerts(alerts, 1), new RegExp(`${label} 1`));
    }
  });

  it('acepta riskcode numérico y en cadena (ZAP lo serializa como cadena)', () => {
    for (const riskcode of [2, '2']) {
      const alerts = parseZapReport(report([alert(riskcode)]));
      assert.equal(alerts[0]?.risk, 'medio');
      assert.equal(blockingAlerts(alerts).length, 1);
    }
  });

  it('las instancias se cuentan con count o con el número de instancias', () => {
    const withCount = parseZapReport(report([alert(2, { count: '7', instances: 2 })]));
    assert.equal(withCount[0]?.count, 7);
    const withoutCount = parseZapReport(report([alert(2, { instances: 3 })]));
    assert.equal(withoutCount[0]?.count, 3);
  });

  it('una alerta sin instancias usa la URL del site y cuenta 1', () => {
    const entry = alert(2);
    delete entry['instances'];
    delete entry['count'];
    const alerts = parseZapReport(report([entry]));
    assert.equal(alerts[0]?.url, 'http://127.0.0.1:8081/');
    assert.equal(alerts[0]?.count, 1);
  });
});

describe('check-dast: fallo cerrado', () => {
  const malformed: [string, string][] = [
    ['vacío', ''],
    ['JSON inválido', 'no es json'],
    ['objeto sin site', '{}'],
    ['site no es lista', JSON.stringify({ site: 'nope' })],
    ['site vacío', JSON.stringify({ site: [] })],
    ['site con entrada inválida', JSON.stringify({ site: ['nope'] })],
    ['riskcode desconocido', report([alert(5)])],
    ['riskcode no numérico', report([alert('high')])],
    ['riskcode ausente', report([{ pluginid: '1', alert: 'x' }])],
    ['alerta sin nombre', report([{ pluginid: '1', riskcode: 2 }])],
    ['alerta sin pluginid', report([{ alert: 'x', riskcode: 2 }])],
    ['alerts no es lista', JSON.stringify({ site: [{ '@name': 'http://x', alerts: {} }] })],
    ['instances no es lista', report([{ ...alert(2), instances: {} }])],
  ];

  for (const [name, text] of malformed) {
    it(`falla cerrado con un informe ${name}`, () => {
      assert.throws(() => parseZapReport(text), undefined, name);
    });
  }
});

describe('check-dast: redacción de la salida', () => {
  it('nunca vuelca valores del objetivo (centinelas en descripción, solución, evidencia y consulta)', () => {
    const alerts = blockingAlerts(parseZapReport(report([alert(2)])));
    const line = formatDastAlert(alerts[0]);
    assert.match(line, /10021/);
    assert.match(line, /X-Content-Type-Options Header Missing/);
    assert.match(line, /MEDIO/);
    assert.match(line, /http:\/\/127\.0\.0\.1:8081/);
    for (const sentinel of [
      SENTINEL,
      SENTINEL_QUERY,
      SENTINEL_HEADER,
      SENTINEL_BODY,
      SENTINEL_COOKIE,
    ]) {
      assert.doesNotMatch(line, new RegExp(sentinel), sentinel);
    }
    assert.doesNotMatch(line, /\?token=/, 'la consulta se descarta');
    assert.ok(line.length < 300);
  });

  it('redacta la consulta, el fragmento y las credenciales de la URL', () => {
    assert.equal(
      redactUrl(['http://user', 'pass@127.0.0.1:8081/es/builds/?token=abc#frag'].join(':')),
      'http://127.0.0.1:8081/es/builds/',
    );
    assert.equal(redactUrl('http://127.0.0.1:8081/?q=1&secret=2'), 'http://127.0.0.1:8081/');
  });
});

describe('check-dast: umbral no configurable', () => {
  function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, ['--import', 'tsx', CLI, ...args], {
      encoding: 'utf8',
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it('rechaza una severidad configurable (--severity) con exit 2', () => {
    const result = run(['--severity', 'LOW']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /severity/);
  });

  it('rechaza una allowlist (--allowlist) con exit 2', () => {
    const result = run(['--allowlist', '10021']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /allowlist/);
  });

  it('rechaza un umbral por variable de entorno (sin flags de configuración)', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', CLI, '--threshold', 'HIGH'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 2);
  });

  it('muestra el uso con --help y declara el umbral MEDIO', () => {
    const result = run(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Uso: pnpm exec tsx scripts\/check-dast\.mts/);
    assert.match(result.stdout, /MEDIO/);
    assert.match(result.stdout, /--report/);
    assert.doesNotMatch(result.stdout, /--severity|--allowlist/);
  });
});

describe('check-dast: CLI', () => {
  function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, ['--import', 'tsx', CLI, ...args], {
      encoding: 'utf8',
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it('exit 0 con informe limpio, exit 0 con solo bajo/informativo y exit 1 con MEDIO', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-dast-'));
    try {
      const clean = join(dir, 'clean.json');
      const low = join(dir, 'low.json');
      const medium = join(dir, 'medium.json');
      writeFileSync(clean, report([]));
      writeFileSync(low, report([alert(0), alert(1)]));
      writeFileSync(medium, report([alert(2)]));

      const cleanRun = run(['--report', clean]);
      assert.equal(cleanRun.status, 0, cleanRun.stderr);
      assert.match(cleanRun.stdout, /bloqueantes MEDIO\+ = 0/);

      const lowRun = run(['--report', low]);
      assert.equal(lowRun.status, 0, lowRun.stderr);
      assert.match(lowRun.stdout, /BAJO 1/);
      assert.match(lowRun.stdout, /INFORMATIVO 1/);

      const blocked = run(['--report', medium]);
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, /X-Content-Type-Options Header Missing/);
      assert.match(blocked.stderr, /MEDIO/);
      assert.match(blocked.stderr, /127\.0\.0\.1:8081/);
      for (const sentinel of [SENTINEL, SENTINEL_QUERY, SENTINEL_HEADER, SENTINEL_BODY]) {
        assert.doesNotMatch(`${blocked.stdout}${blocked.stderr}`, new RegExp(sentinel), sentinel);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exit 2 con JSON inválido, sin site, con riskcode desconocido o sin --report', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-dast-'));
    try {
      const broken = join(dir, 'broken.json');
      const noSite = join(dir, 'no-site.json');
      const unknown = join(dir, 'unknown.json');
      writeFileSync(broken, 'no es json');
      writeFileSync(noSite, '{}');
      writeFileSync(unknown, report([alert(9)]));

      for (const args of [['--report', broken], ['--report', noSite], ['--report', unknown], []]) {
        const result = run(args);
        assert.equal(result.status, 2, args.join(' '));
        assert.match(result.stderr, /ERROR/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exit 2 si la ruta del informe no existe', () => {
    const result = run(['--report', join(tmpdir(), 'gd-dast-missing-9f2c.json')]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /ERROR/);
  });

  it('combina varios informes y decide con el peor', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-dast-'));
    try {
      const web = join(dir, 'web.json');
      const api = join(dir, 'api.json');
      writeFileSync(web, report([alert(1)]));
      writeFileSync(api, report([alert(2)]));
      const result = run(['--report', web, '--report', api]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /2 alerta\(s\)/);
      assert.match(result.stdout, /bloqueantes MEDIO\+ = 1/);
      assert.match(result.stderr, /check-dast FALLÓ/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
