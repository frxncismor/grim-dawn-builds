/**
 * Pruebas de check-container (T-066b). Solo fixtures sintéticas en `mkdtempSync`:
 * ningún valor con pinta de credencial real ni informes Trivy rastreados.
 *
 * Cubre las reglas estáticas de Dockerfile/Compose y el umbral del informe Trivy:
 * bloqueo desde severidad MEDIA (MEDIA/ALTA/CRÍTICA), sin allowlist implícita y
 * fallo cerrado ante un informe vacío o mal formado.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockingFindings,
  checkCompose,
  checkDockerfile,
  formatTrivyFinding,
  parseTrivyReport,
  summarizeUnfixed,
  unfixedFindings,
} from './check-container.mts';

const CLI = fileURLToPath(new URL('./check-container.mts', import.meta.url));

const CLEAN_DOCKERFILE = `# syntax=docker/dockerfile:1
FROM node:22.12.0-slim AS build
WORKDIR /repo
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter @gd/api build

FROM node:22.12.0-slim AS runtime
ENV NODE_ENV=production API_PORT=3000
COPY --from=build /repo/apps/api/dist ./dist
USER 10001:10001
CMD ["node", "dist/server.js"]
`;

const CLEAN_COMPOSE = `name: fixture
services:
  db:
    image: postgres:17.11-trixie@sha256:${'a'.repeat(64)}
    environment:
      POSTGRES_DB: fixture
    volumes:
      - pgdata:/var/lib/postgresql/data
  api:
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
    ports:
      - "127.0.0.1:3000:3000"
volumes:
  pgdata:
`;

const CLEAN_REPORT = {
  SchemaVersion: 2,
  ArtifactName: 'gd-api:ci-scan',
  ArtifactType: 'container_image',
  Results: [
    {
      Target: 'gd-api:ci-scan (debian 12.11)',
      Class: 'os-pkgs',
      Type: 'debian',
      Vulnerabilities: [
        {
          VulnerabilityID: 'CVE-2024-0001',
          PkgName: 'zlib',
          InstalledVersion: '1:1.2.11',
          FixedVersion: '1:1.2.13',
          Severity: 'LOW',
          Title: 'low finding',
          Description: 'low detail',
        },
      ],
    },
  ],
};

/** Informe Trivy sintético con un único hallazgo de la severidad indicada. */
function reportWithSeverity(severity: string): string {
  return JSON.stringify({
    SchemaVersion: 2,
    ArtifactName: 'gd-api:ci-scan',
    Results: [
      {
        Target: 'gd-api:ci-scan (debian 12.11)',
        Class: 'os-pkgs',
        Type: 'debian',
        Vulnerabilities: [
          {
            VulnerabilityID: 'CVE-2026-1111',
            PkgName: 'openssl',
            InstalledVersion: '3.0.1',
            FixedVersion: '3.0.2',
            Severity: severity,
            Title: 'SENTINEL_TITLE_PRIVATE_9f2c',
            Description: 'SENTINEL_DESCRIPTION_PRIVATE_9f2c',
          },
        ],
      },
    ],
  });
}

describe('check-container: reglas estáticas de Dockerfile', () => {
  it('acepta una imagen final no-root sin secretos', () => {
    assert.deepEqual(checkDockerfile('apps/api/Dockerfile', CLEAN_DOCKERFILE), []);
  });

  it('falla si la imagen final no declara USER', () => {
    const dockerfile = CLEAN_DOCKERFILE.replace('USER 10001:10001\n', '');
    const rules = checkDockerfile('Dockerfile', dockerfile).map((f) => f.rule);
    assert.deepEqual(rules, ['docker-root-user']);
  });

  it('falla si la imagen final corre como root', () => {
    for (const user of ['root', '0', '0:0', 'root:root']) {
      const dockerfile = CLEAN_DOCKERFILE.replace('USER 10001:10001', `USER ${user}`);
      assert.deepEqual(
        checkDockerfile('Dockerfile', dockerfile).map((f) => f.rule),
        ['docker-root-user'],
        `USER ${user}`,
      );
    }
  });

  it('falla cerrado si el USER no se puede verificar', () => {
    const dockerfile = CLEAN_DOCKERFILE.replace('USER 10001:10001', 'USER ${APP_UID}');
    assert.deepEqual(
      checkDockerfile('Dockerfile', dockerfile).map((f) => f.rule),
      ['docker-root-user'],
    );
  });

  it('ignora el USER de una etapa intermedia: cuenta el de la etapa final', () => {
    const dockerfile = CLEAN_DOCKERFILE.replace('USER 10001:10001\n', '');
    const withBuildUser = dockerfile.replace(
      'RUN pnpm --filter @gd/api build',
      'USER root\nRUN pnpm --filter @gd/api build',
    );
    assert.deepEqual(
      checkDockerfile('Dockerfile', withBuildUser).map((f) => f.rule),
      ['docker-root-user'],
    );
  });

  it('acepta un USER no-root por nombre', () => {
    const dockerfile = CLEAN_DOCKERFILE.replace('USER 10001:10001', 'USER api');
    assert.deepEqual(checkDockerfile('Dockerfile', dockerfile), []);
  });

  it('hereda el USER cuando la etapa final parte de otra etapa', () => {
    const dockerfile = `${CLEAN_DOCKERFILE}FROM runtime AS final
CMD ["node", "dist/server.js"]
`;
    assert.deepEqual(checkDockerfile('Dockerfile', dockerfile), []);
  });

  it('falla si se copia un .env a la imagen', () => {
    const dockerfile = CLEAN_DOCKERFILE.replace(
      'USER 10001:10001',
      'COPY .env ./env\nUSER 10001:10001',
    );
    assert.deepEqual(
      checkDockerfile('Dockerfile', dockerfile).map((f) => f.rule),
      ['docker-secret'],
    );
  });

  it('falla si se copia un directorio secrets/ a la imagen', () => {
    const dockerfile = CLEAN_DOCKERFILE.replace(
      'USER 10001:10001',
      'COPY secrets/db_password.txt ./db_password.txt\nUSER 10001:10001',
    );
    assert.deepEqual(
      checkDockerfile('Dockerfile', dockerfile).map((f) => f.rule),
      ['docker-secret'],
    );
  });

  it('falla con un secreto literal en ENV o ARG', () => {
    for (const instruction of ['ENV DB_PASSWORD=hunter2', 'ARG GITHUB_TOKEN=abc123']) {
      const dockerfile = CLEAN_DOCKERFILE.replace(
        'USER 10001:10001',
        `${instruction}\nUSER 10001:10001`,
      );
      assert.deepEqual(
        checkDockerfile('Dockerfile', dockerfile).map((f) => f.rule),
        ['docker-secret'],
        instruction,
      );
    }
  });

  it('acepta la indirección *_FILE y variables no secretas', () => {
    const dockerfile = CLEAN_DOCKERFILE.replace(
      'USER 10001:10001',
      'ENV DB_PASSWORD_FILE=/run/secrets/db_password\nARG NODE_VERSION=22.12.0\nUSER 10001:10001',
    );
    assert.deepEqual(checkDockerfile('Dockerfile', dockerfile), []);
  });
});

describe('check-container: reglas estáticas de Compose', () => {
  it('acepta un compose por defecto sin db publicado', () => {
    assert.deepEqual(checkCompose('infra/docker/compose.yaml', CLEAN_COMPOSE), []);
  });

  it('falla si el servicio db publica ports en el compose por defecto', () => {
    const compose = CLEAN_COMPOSE.replace(
      '    volumes:\n      - pgdata:/var/lib/postgresql/data',
      '    ports:\n      - "127.0.0.1:5432:5432"\n    volumes:\n      - pgdata:/var/lib/postgresql/data',
    );
    const findings = checkCompose('compose.yaml', compose);
    assert.deepEqual(
      findings.map((f) => f.rule),
      ['compose-db-published'],
    );
    assert.equal(findings[0].line, 7);
  });

  it('no confunde el db de depends_on con el servicio db', () => {
    const compose = `services:
  api:
    image: fixture
    depends_on:
      db:
        condition: service_healthy
  db:
    image: fixture
`;
    assert.deepEqual(checkCompose('compose.yaml', compose), []);
  });

  it('falla si db declara ports en línea (estilo flujo)', () => {
    const compose = `services:
  db: { image: fixture, ports: ["127.0.0.1:5432:5432"] }
`;
    assert.deepEqual(
      checkCompose('compose.yaml', compose).map((f) => f.rule),
      ['compose-db-published'],
    );
  });
});

describe('check-container: informe Trivy y umbral', () => {
  it('acepta un informe solo con LOW', () => {
    const findings = parseTrivyReport(JSON.stringify(CLEAN_REPORT));
    assert.equal(findings.length, 1);
    assert.deepEqual(blockingFindings(findings), []);
  });

  it('bloquea MEDIUM, HIGH y CRITICAL (decisión 2026-11-09)', () => {
    for (const severity of ['MEDIUM', 'HIGH', 'CRITICAL']) {
      const findings = parseTrivyReport(reportWithSeverity(severity));
      assert.equal(blockingFindings(findings).length, 1, severity);
    }
  });

  it('bloquea también las misconfigurations desde MEDIUM', () => {
    const report = JSON.stringify({
      SchemaVersion: 2,
      ArtifactName: 'apps/api/Dockerfile',
      Results: [
        {
          Target: 'Dockerfile',
          Class: 'config',
          Type: 'dockerfile',
          Misconfigurations: [
            {
              ID: 'DS002',
              Title: 'SENTINEL_TITLE_PRIVATE_9f2c',
              Description: 'SENTINEL_DESCRIPTION_PRIVATE_9f2c',
              Severity: 'MEDIUM',
              Message: 'SENTINEL_MESSAGE_PRIVATE_9f2c',
            },
          ],
        },
      ],
    });
    const findings = parseTrivyReport(report);
    assert.deepEqual(
      blockingFindings(findings).map((f) => f.kind),
      ['misconfiguration'],
    );
  });

  it('no bloquea un CVE sin corrección publicada y lo resume por severidad y paquete', () => {
    const report = reportWithSeverity('MEDIUM').replace('"FixedVersion":"3.0.2",', '');
    const findings = parseTrivyReport(report);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.fixed, undefined);
    assert.deepEqual(blockingFindings(findings), []);
    const summary = summarizeUnfixed(unfixedFindings(findings));
    assert.equal(summary.length, 1);
    assert.match(summary[0] ?? '', /SIN corrección publicada/);
    assert.match(summary[0] ?? '', /MEDIA 1/);
    assert.match(summary[0] ?? '', /openssl 1/);
  });

  it('sigue bloqueando un MEDIUM corregible y toda misconfiguration', () => {
    const fixable = parseTrivyReport(reportWithSeverity('MEDIUM'));
    assert.equal(blockingFindings(fixable).length, 1);
    assert.deepEqual(unfixedFindings(fixable), []);
  });

  it('falla cerrado con informes vacíos o mal formados', () => {
    const malformed = [
      '',
      'no es json',
      '{}',
      '{"Results":[]}',
      '{"SchemaVersion":2,"ArtifactName":"x"}',
      '{"SchemaVersion":2,"ArtifactName":"","Results":[]}',
      '{"SchemaVersion":2,"ArtifactName":"x","Results":"nope"}',
      '{"SchemaVersion":2,"ArtifactName":"x","Results":[{"Vulnerabilities":{}}]}',
      JSON.stringify({
        SchemaVersion: 2,
        ArtifactName: 'x',
        Results: [{ Target: 'x', Vulnerabilities: [{ VulnerabilityID: 'CVE-1', Severity: '?' }] }],
      }),
      JSON.stringify({
        SchemaVersion: 2,
        ArtifactName: 'x',
        Results: [{ Target: 'x', Vulnerabilities: [{ PkgName: 'x', Severity: 'HIGH' }] }],
      }),
    ];
    for (const text of malformed) {
      assert.throws(() => parseTrivyReport(text), undefined, text.slice(0, 60));
    }
  });

  it('el mensaje nombra archivo, paquete, severidad y CVE sin volcar el informe', () => {
    const findings = blockingFindings(parseTrivyReport(reportWithSeverity('HIGH')));
    const line = formatTrivyFinding(findings[0]);
    assert.match(line, /HIGH|ALTA/);
    assert.match(line, /CVE-2026-1111/);
    assert.match(line, /openssl/);
    assert.match(line, /3\.0\.1/);
    assert.doesNotMatch(line, /SENTINEL_/);
    assert.ok(line.length < 200);
  });
});

describe('check-container: CLI', () => {
  function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, ['--import', 'tsx', CLI, ...args], {
      encoding: 'utf8',
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it('muestra el uso con --help', () => {
    const result = run(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Uso: pnpm check-container/);
    assert.match(result.stdout, /--report/);
  });

  it('el repositorio real pasa la verificación estática', () => {
    const result = run([]);
    assert.equal(result.status, 0, result.stderr);
  });

  it('exit 0 con un informe limpio y exit 1 con MEDIUM, sin volcar detalles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-container-'));
    try {
      const clean = join(dir, 'clean.json');
      const medium = join(dir, 'medium.json');
      const broken = join(dir, 'broken.json');
      writeFileSync(clean, JSON.stringify(CLEAN_REPORT));
      writeFileSync(medium, reportWithSeverity('MEDIUM'));
      writeFileSync(broken, '{}');

      const ok = run(['--report', clean]);
      assert.equal(ok.status, 0, ok.stderr);

      const blocked = run(['--report', medium]);
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, /CVE-2026-1111/);
      assert.doesNotMatch(blocked.stderr, /SENTINEL_/);
      assert.doesNotMatch(blocked.stderr, /SchemaVersion/);

      const malformed = run(['--report', broken]);
      assert.equal(malformed.status, 2);
      assert.match(malformed.stderr, /ERROR/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('limita las líneas impresas sin ocultar el total de hallazgos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-container-'));
    try {
      const many = {
        SchemaVersion: 2,
        ArtifactName: 'gd-api:ci-scan',
        Results: [
          {
            Target: 'gd-api:ci-scan',
            Vulnerabilities: Array.from({ length: 60 }, (_, index) => ({
              VulnerabilityID: `CVE-2026-${1000 + index}`,
              PkgName: 'fixture-package',
              InstalledVersion: '1.0.0',
              FixedVersion: '9.9.9',
              Severity: 'MEDIUM',
            })),
          },
        ],
      };
      const file = join(dir, 'many.json');
      writeFileSync(file, JSON.stringify(many));
      const result = run(['--report', file]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /60 hallazgo\(s\) corregible\(s\) desde severidad MEDIA/);
      assert.match(result.stderr, /10 hallazgo\(s\) más/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exit 1 con un Dockerfile root y exit 2 con una ruta inexistente', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-container-'));
    try {
      const dockerfile = join(dir, 'Dockerfile');
      writeFileSync(dockerfile, CLEAN_DOCKERFILE.replace('USER 10001:10001\n', ''));
      const compose = join(dir, 'compose.yaml');
      writeFileSync(compose, CLEAN_COMPOSE);

      const blocked = run(['--dockerfile', dockerfile, '--compose', compose]);
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, /root/);

      const missing = run(['--dockerfile', join(dir, 'missing.Dockerfile'), '--compose', compose]);
      assert.equal(missing.status, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
