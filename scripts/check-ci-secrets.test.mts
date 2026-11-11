/**
 * Pruebas de check-ci-secrets (T-086 ST-1). Solo fixtures sintéticas: ningún valor
 * con pinta de credencial real. Cada regla tiene un positivo y, cuando aplica, un negativo.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanWorkflowDir, validateWorkflows } from './check-ci-secrets.mts';

const REAL_WORKFLOWS = fileURLToPath(new URL('../.github/workflows', import.meta.url));
const CLI = fileURLToPath(new URL('./check-ci-secrets.mts', import.meta.url));

/** Workflow limpio: PR, DAST loopback, credencial efímera enmascarada, compose con --quiet. */
const CLEAN = `name: Fixture CI
on:
  pull_request:
    branches:
      - main
permissions:
  contents: read
jobs:
  verify:
    name: Verify
    runs-on: ubuntu-24.04
    steps:
      - name: Check out repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Generate ephemeral credential
        run: |
          set -euo pipefail
          db_password="$(openssl rand -hex 16)"
          echo "::add-mask::\${db_password}"
          echo "DB_PASSWORD=\${db_password}" >> "$GITHUB_ENV"
      - name: Compose configuration check
        run: docker compose --env-file .env.example -f compose.yaml config --quiet
  dast:
    name: DAST baseline
    runs-on: ubuntu-24.04
    env:
      ZAP_TARGET_URL: http://127.0.0.1:8080
    steps:
      - name: Run ZAP baseline
        run: docker run --rm ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "$ZAP_TARGET_URL"
`;

const UPLOAD_STEP = `      - name: Upload logs
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          path: .env
`;

/** Reglas disparadas (ordenadas) para un texto de workflow. */
function rulesOf(text: string): string[] {
  return validateWorkflows([{ path: 'fixture.yml', text }])
    .map((f) => f.rule)
    .sort();
}

/** Aplica una mutación textual al workflow limpio y comprueba que sí cambió. */
function mutate(from: string, to: string): string {
  const mutated = CLEAN.replace(from, to);
  assert.notEqual(mutated, CLEAN, `la mutación no se aplicó: ${from}`);
  return mutated;
}

describe('check-ci-secrets (T-086 ST-1)', () => {
  it('el repositorio pasa sin hallazgos ni excepciones', () => {
    const result = scanWorkflowDir(REAL_WORKFLOWS);
    assert.equal(result.scanned, 2);
    assert.deepEqual(result.findings, []);
  });

  it('un workflow limpio no tiene hallazgos', () => {
    assert.deepEqual(rulesOf(CLEAN), []);
  });

  describe('pull-request-target', () => {
    it('falla si el trigger es pull_request_target', () => {
      assert.deepEqual(rulesOf(mutate('  pull_request:', '  pull_request_target:')), [
        'pull-request-target',
      ]);
    });

    it('ignora una mención en comentario', () => {
      assert.deepEqual(
        rulesOf(CLEAN.replace('permissions:', '# never use pull_request_target\npermissions:')),
        [],
      );
    });
  });

  describe('secret-in-job', () => {
    const withToken = (text: string): string =>
      text.replace(
        'persist-credentials: false',
        'persist-credentials: false\n          token: ${{ secrets.DEPLOY_TOKEN }}',
      );

    it('falla con referencia a secreto en un workflow pull_request', () => {
      assert.deepEqual(rulesOf(withToken(CLEAN)), ['secret-in-job']);
    });

    it('no falla si el workflow no se dispara por pull_request', () => {
      assert.deepEqual(rulesOf(withToken(CLEAN.replace('  pull_request:', '  push:'))), []);
    });
  });

  describe('secret-echo', () => {
    it('falla si un run imprime una variable de nombre secreto', () => {
      assert.deepEqual(
        rulesOf(
          mutate(
            '          set -euo pipefail\n',
            '          set -euo pipefail\n          echo "$DB_PASSWORD"\n',
          ),
        ),
        ['secret-echo'],
      );
    });

    it('falla si un run imprime un secreto de Actions', () => {
      assert.deepEqual(
        rulesOf(
          mutate(
            '          set -euo pipefail\n',
            '          set -euo pipefail\n          echo "${{ secrets.DEPLOY_TOKEN }}"\n',
          ),
        ),
        ['secret-echo', 'secret-in-job'],
      );
    });

    it('no falla al imprimir variables sin nombre secreto', () => {
      assert.deepEqual(
        rulesOf(
          mutate(
            '          set -euo pipefail\n',
            '          set -euo pipefail\n          echo "$RUNNER_TEMP"\n',
          ),
        ),
        [],
      );
    });

    it('no falla al imprimir un enmascarado con add-mask', () => {
      assert.deepEqual(rulesOf(CLEAN), []);
    });
  });

  describe('literal-credential', () => {
    it('falla con clave secreta de env con valor literal', () => {
      const text = mutate(
        'ZAP_TARGET_URL: http://127.0.0.1:8080',
        'ZAP_TARGET_URL: http://127.0.0.1:8080\n      DB_PASSWORD: fixture-not-a-secret',
      );
      assert.deepEqual(rulesOf(text), ['literal-credential']);
      const message = validateWorkflows([{ path: 'fixture.yml', text }])[0].message;
      assert.ok(!message.includes('fixture-not-a-secret'));
    });

    it('no falla si el valor es una referencia', () => {
      const text = mutate(
        'ZAP_TARGET_URL: http://127.0.0.1:8080',
        'ZAP_TARGET_URL: http://127.0.0.1:8080\n      DB_PASSWORD: ${{ vars.FIXTURE_NAME }}',
      );
      assert.deepEqual(rulesOf(text), []);
    });
  });

  describe('unmasked-credential', () => {
    it('falla si el job genera una credencial sin add-mask', () => {
      assert.deepEqual(rulesOf(mutate('          echo "::add-mask::${db_password}"\n', '')), [
        'unmasked-credential',
      ]);
    });

    it('no falla si el valor generado no tiene nombre secreto', () => {
      const text = `on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - run: build_id="$(openssl rand -hex 8)"
`;
      assert.deepEqual(rulesOf(text), []);
    });
  });

  describe('set-x', () => {
    it('falla con set -x en un run', () => {
      assert.deepEqual(rulesOf(mutate('set -euo pipefail', 'set -euxo pipefail')), ['set-x']);
    });

    it('no falla con set -euo pipefail', () => {
      assert.deepEqual(rulesOf(CLEAN), []);
    });
  });

  describe('compose-config-values', () => {
    it('falla con docker compose config sin --quiet', () => {
      assert.deepEqual(rulesOf(mutate(' config --quiet', ' config')), ['compose-config-values']);
    });

    it('no falla con -q', () => {
      assert.deepEqual(rulesOf(mutate(' config --quiet', ' config -q')), []);
    });
  });

  describe('artifact-env', () => {
    const withUpload = (path: string): string =>
      mutate('  dast:\n', UPLOAD_STEP.replace('path: .env', `path: ${path}`) + '  dast:\n');

    it('falla si un artefacto incluye .env', () => {
      assert.deepEqual(rulesOf(withUpload('.env')), ['artifact-env']);
    });

    it('falla si un artefacto incluye .env.* o secrets/', () => {
      assert.deepEqual(rulesOf(withUpload('.env.*')), ['artifact-env']);
      assert.deepEqual(rulesOf(withUpload('secrets/')), ['artifact-env']);
    });

    it('no falla con .env.example ni con rutas normales', () => {
      assert.deepEqual(rulesOf(withUpload('.env.example')), []);
      assert.deepEqual(rulesOf(withUpload('dist/**')), []);
    });
  });

  describe('env-dump', () => {
    const withLine = (line: string): string =>
      mutate('          set -euo pipefail\n', `          set -euo pipefail\n          ${line}\n`);

    it('falla con printenv', () => {
      assert.deepEqual(rulesOf(withLine('printenv')), ['env-dump']);
    });

    it('falla con env a secas', () => {
      assert.deepEqual(rulesOf(withLine('env')), ['env-dump']);
    });

    it('falla con cat .env', () => {
      assert.deepEqual(rulesOf(withLine('cat .env')), ['env-dump']);
    });

    it('no falla con cat .env.example', () => {
      assert.deepEqual(rulesOf(withLine('cat .env.example')), []);
    });
  });

  describe('remote-dast-target', () => {
    const loopbackOrRemote: [string, string[]][] = [
      ['http://127.0.0.1:8080', []],
      ['http://localhost:4200/', []],
      ['http://[::1]:8080', []],
      ['http://localhost.dast.example.invalid', ['remote-dast-target']],
      ['http://localhost@dast.example.invalid', ['remote-dast-target']],
      ['https://dast.example.invalid', ['remote-dast-target']],
    ];

    for (const [target, expected] of loopbackOrRemote) {
      it(`objetivo ${target} → ${expected.length ? 'falla' : 'pasa'}`, () => {
        assert.deepEqual(
          rulesOf(
            CLEAN.replace('ZAP_TARGET_URL: http://127.0.0.1:8080', `ZAP_TARGET_URL: ${target}`),
          ),
          expected,
        );
      });
    }

    it('falla con objetivo remoto literal en -t', () => {
      assert.deepEqual(
        rulesOf(
          mutate(
            'zap-baseline.py -t "$ZAP_TARGET_URL"',
            'zap-baseline.py -t https://dast.example.invalid',
          ),
        ),
        ['remote-dast-target'],
      );
    });

    it('falla si la referencia del objetivo no se puede resolver', () => {
      assert.deepEqual(
        rulesOf(
          mutate('zap-baseline.py -t "$ZAP_TARGET_URL"', 'zap-baseline.py -t "$UNKNOWN_TARGET"'),
        ),
        ['remote-dast-target'],
      );
    });

    it('detecta un paso DAST por su run aunque el job no se llame DAST', () => {
      const remote = `on:
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-24.04
    steps:
      - name: Baseline scan
        run: zap-baseline.py --target https://dast.example.invalid
`;
      assert.deepEqual(rulesOf(remote), ['remote-dast-target']);
      assert.deepEqual(
        rulesOf(remote.replace('https://dast.example.invalid', 'http://localhost:8080')),
        [],
      );
    });
  });

  describe('scanWorkflowDir y CLI', () => {
    it('escanea solo *.yml y *.yaml en orden y reporta el archivo', () => {
      const dir = mkdtempSync(join(tmpdir(), 'ci-secrets-'));
      try {
        writeFileSync(join(dir, 'a.yml'), CLEAN);
        writeFileSync(
          join(dir, 'b.yaml'),
          CLEAN.replace('  pull_request:', '  pull_request_target:'),
        );
        writeFileSync(join(dir, 'notes.txt'), 'pull_request_target');
        const result = scanWorkflowDir(dir);
        assert.equal(result.scanned, 2);
        assert.deepEqual(
          result.findings.map((f) => [f.file, f.rule]),
          [['b.yaml', 'pull-request-target']],
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('CLI: 0 sin hallazgos, 1 con hallazgos, 2 con error', () => {
      const dir = mkdtempSync(join(tmpdir(), 'ci-secrets-cli-'));
      const runCli = (args: string[]) =>
        spawnSync(process.execPath, ['--import', 'tsx', CLI, ...args], { encoding: 'utf8' });
      try {
        const clean = join(dir, 'clean');
        const bad = join(dir, 'bad');
        const empty = join(dir, 'empty');
        mkdirSync(clean);
        mkdirSync(bad);
        mkdirSync(empty);
        writeFileSync(join(clean, 'ci.yml'), CLEAN);
        writeFileSync(
          join(bad, 'ci.yml'),
          CLEAN.replace('  pull_request:', '  pull_request_target:'),
        );

        const ok = runCli(['--dir', clean]);
        assert.equal(ok.status, 0, ok.stderr + ok.stdout);

        const fail = runCli(['--dir', bad]);
        assert.equal(fail.status, 1, fail.stderr + fail.stdout);
        assert.match(fail.stdout + fail.stderr, /ci\.yml:\d+ \[pull-request-target\]/);

        assert.equal(runCli(['--dir', join(dir, 'missing')]).status, 2);
        assert.equal(runCli(['--dir', empty]).status, 2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
