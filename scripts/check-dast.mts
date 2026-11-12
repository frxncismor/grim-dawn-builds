/**
 * check-dast (T-077): puerta de DAST sobre informes JSON de OWASP ZAP baseline.
 *
 * El umbral lo decidió el usuario el 2026-11-11: **bloquear desde severidad MEDIA**
 * (MEDIO, ALTO y CRÍTICO si la herramienta lo expone). Este script es la única
 * decisión del job de CI; no hay flag de severidad, allowlist ni archivo de reglas
 * que pueda rebajarlo.
 *
 * Reglas:
 * - Un informe es `site[]` (no vacío) con `alerts[]`; cada alerta trae `riscode`
 *   0–4 (0 informativo, 1 bajo, 2 medio, 3 alto, 4 crítico) y un nombre de regla.
 * - Bloquea (exit 1) con cualquier alerta de riesgo MEDIO o superior. Informa de
 *   cada alerta bloqueante con regla, riesgo, URL afectada y recuento.
 * - Cuenta y resume las de riesgo BAJO/INFORMATIVO (no bloquean), con totales.
 * - Falla cerrado (exit 2) con un informe vacío, sin `site`, con un `riskcode`
 *   desconocido, una alerta sin nombre/identificador o JSON inválido.
 * - Nunca vuelca cabeceras, cuerpos, cookies, parámetros ni valores del objetivo:
 *   de la URL solo se publica origen y ruta (sin consulta, fragmento ni usuario).
 *
 * Uso: `pnpm exec tsx scripts/check-dast.mts --report <ruta> [--report <ruta>…]`.
 * `--report` se puede repetir (web y API del mismo job, cada una con su informe).
 * Códigos: 0 = sin bloqueantes, 1 = alertas MEDIO+, 2 = uso o informe inválido.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type DastRisk = 'informativo' | 'bajo' | 'medio' | 'alto' | 'crítico';

/** Códigos de riesgo de ZAP frente a la etiqueta en español. */
const RISK_BY_CODE: Record<number, DastRisk> = {
  0: 'informativo',
  1: 'bajo',
  2: 'medio',
  3: 'alto',
  4: 'crítico',
};

/** Etiquetas de salida, en mayúsculas y en español. */
const RISK_LABEL: Record<DastRisk, string> = {
  informativo: 'INFORMATIVO',
  bajo: 'BAJO',
  medio: 'MEDIO',
  alto: 'ALTO',
  crítico: 'CRÍTICO',
};

/** Riesgos que bloquean: cualquier cosa desde MEDIO. No es configurable. */
const BLOCKING_RISKS = new Set<DastRisk>(['medio', 'alto', 'crítico']);

export interface DastAlert {
  /** Nombre de la regla de ZAP (nunca cabeceras, cuerpos ni valores). */
  readonly rule: string;
  readonly pluginId: string;
  readonly risk: DastRisk;
  /** Origen y ruta del primer destino afectado, ya redactados. */
  readonly url: string;
  /** Instancias afectadas según `count` de ZAP. */
  readonly count: number;
}

/** Informe inválido, vacío o con datos que no se pueden verificar: exit 2. */
export class DastReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DastReportError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function textField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Origen y ruta de una URL. Descarta consulta, fragmento y credenciales para no
 * publicar valores del objetivo en la salida del job.
 */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    return withoutScheme.split(/[?#]/)[0] ?? '';
  }
}

function riskFromCode(value: unknown): DastRisk {
  const code =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  const risk = Number.isInteger(code) ? RISK_BY_CODE[code] : undefined;
  if (risk === undefined) {
    throw new DastReportError(
      'el informe ZAP trae un riskcode desconocido; no se puede decidir el umbral',
    );
  }
  return risk;
}

function countFromAlert(alert: Record<string, unknown>, instances: number): number {
  const raw = alert['count'];
  if (raw === undefined) return Math.max(instances, 1);
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : Number.NaN;
  if (!Number.isInteger(value) || value < 1) {
    throw new DastReportError('una alerta ZAP tiene un count inválido; se falla cerrado');
  }
  return value;
}

/**
 * Lee y valida un informe JSON de ZAP baseline. Lanza `DastReportError` si el
 * sobre no es un informe, si no hay `site`, o si una alerta no se puede verificar.
 */
export function parseZapReport(text: string): DastAlert[] {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new DastReportError('el informe ZAP no es JSON válido');
  }

  const report = asRecord(root);
  if (report === undefined) throw new DastReportError('el informe ZAP no es un objeto JSON');
  const sites = report['site'];
  if (!Array.isArray(sites) || sites.length === 0) {
    throw new DastReportError('el informe ZAP no tiene site o está vacío; se falla cerrado');
  }

  const alerts: DastAlert[] = [];
  for (const rawSite of sites) {
    const site = asRecord(rawSite);
    if (site === undefined) throw new DastReportError('site contiene una entrada inválida');
    const siteUrl = textField(site['@name']) ?? textField(site['name']);
    if (siteUrl === undefined) {
      throw new DastReportError('site sin URL (@name); no se puede informar el destino afectado');
    }

    const siteAlerts = site['alerts'];
    if (siteAlerts === undefined || siteAlerts === null) continue;
    if (!Array.isArray(siteAlerts)) {
      throw new DastReportError(`alerts de "${redactUrl(siteUrl)}" no es una lista`);
    }

    for (const rawAlert of siteAlerts) {
      const entry = asRecord(rawAlert);
      if (entry === undefined) throw new DastReportError('alerta ZAP inválida');

      const rule = textField(entry['alert']) ?? textField(entry['name']);
      if (rule === undefined) {
        throw new DastReportError('alerta ZAP sin nombre de regla; no se puede informar');
      }
      const pluginId =
        typeof entry['pluginid'] === 'number'
          ? String(entry['pluginid'])
          : textField(entry['pluginid']);
      if (pluginId === undefined) {
        throw new DastReportError(`la alerta "${rule}" no trae pluginid`);
      }

      const rawInstances = entry['instances'];
      if (rawInstances !== undefined && rawInstances !== null && !Array.isArray(rawInstances)) {
        throw new DastReportError(`instances de "${rule}" no es una lista`);
      }
      const instances = Array.isArray(rawInstances) ? rawInstances : [];
      let firstUri: string | undefined;
      for (const rawInstance of instances) {
        const instance = asRecord(rawInstance);
        if (instance === undefined) throw new DastReportError(`instancia inválida en "${rule}"`);
        const uri = textField(instance['uri']);
        if (firstUri === undefined && uri !== undefined) firstUri = uri;
      }

      alerts.push({
        rule,
        pluginId,
        risk: riskFromCode(entry['riskcode']),
        url: redactUrl(firstUri ?? siteUrl),
        count: countFromAlert(entry, instances.length),
      });
    }
  }

  return alerts;
}

/** Alertas que bloquean: MEDIO, ALTO o CRÍTICO. Sin excepciones. */
export function blockingAlerts(alerts: readonly DastAlert[]): DastAlert[] {
  return alerts.filter((alert) => BLOCKING_RISKS.has(alert.risk));
}

/** Línea de una alerta bloqueante: regla, riesgo, URL redactada y recuento. */
export function formatDastAlert(alert: DastAlert): string {
  return `${alert.url}: [${RISK_LABEL[alert.risk]}] ${alert.rule} (regla ${alert.pluginId}, ${alert.count} instancia(s))`;
}

/** Resumen agregado con totales por riesgo y bloqueantes. Nunca incluye valores. */
export function summarizeAlerts(alerts: readonly DastAlert[], reports: number): string {
  const count = (risk: DastRisk): number => alerts.filter((alert) => alert.risk === risk).length;
  const instances = alerts.reduce((total, alert) => total + alert.count, 0);
  const blocking = blockingAlerts(alerts).length;
  return (
    `check-dast: ${alerts.length} alerta(s), ${instances} instancia(s) en ${reports} informe(s); ` +
    `bloqueantes MEDIO+ = ${blocking} (MEDIO ${count('medio')}, ALTO ${count('alto')}, ` +
    `CRÍTICO ${count('crítico')}); bajo el umbral: BAJO ${count('bajo')}, ` +
    `INFORMATIVO ${count('informativo')}.`
  );
}

const HELP = `Uso: pnpm exec tsx scripts/check-dast.mts --report <ruta> [--report <ruta>…]

Evalúa informes JSON de OWASP ZAP baseline (T-077). Umbral fijado por el usuario:
bloquea desde severidad MEDIO (MEDIO, ALTO y CRÍTICO), sin allowlist ni ajuste de
severidad. Informa de las alertas bloqueantes con regla, riesgo, URL afectada
(sin consulta ni credenciales) y recuento; resume BAJO/INFORMATIVO.

Opciones:
  --report <ruta>  Informe JSON de ZAP. Se puede repetir (p. ej. web y API).
  -h, --help       Muestra este uso.

Códigos: 0 = sin alertas MEDIO+, 1 = alertas MEDIO+, 2 = uso o informe inválido.`;

/** Tope de líneas impresas: el total de bloqueantes se informa siempre. */
const MAX_REPORT_LINES = 50;

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`no se pudo leer ${path}: ${reason}`);
  }
}

function parseArgs(argv: readonly string[]): { reports: string[]; help: boolean } {
  const reports: string[] = [];
  let help = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }
    if (arg === '--report') {
      const value = argv[index + 1];
      if (value === undefined || value === '') throw new Error('--report requiere una ruta');
      index++;
      reports.push(resolve(value));
      continue;
    }
    throw new Error(`argumento no reconocido: ${arg}`);
  }
  return { reports, help };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(HELP);
      process.exit(0);
    }
    if (options.reports.length === 0) throw new Error('falta --report <ruta>');

    const unique = [...new Set(options.reports)];
    const alerts = unique.flatMap((path) => parseZapReport(readText(path)));
    console.log(summarizeAlerts(alerts, unique.length));

    const blocking = blockingAlerts(alerts);
    if (blocking.length > 0) {
      for (const alert of blocking.slice(0, MAX_REPORT_LINES))
        console.error(formatDastAlert(alert));
      if (blocking.length > MAX_REPORT_LINES) {
        console.error(
          `… y ${blocking.length - MAX_REPORT_LINES} alerta(s) más (no se vuelca el informe completo)`,
        );
      }
      console.error(
        `\ncheck-dast FALLÓ: ${blocking.length} alerta(s) desde severidad MEDIO; el umbral no se puede rebajar`,
      );
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`check-dast ERROR: ${reason}`);
    process.exit(2);
  }
}
