import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASSWORD_BYTES, secretFileName, setupEnv, type SetupReport } from './setup-env.mts';

/**
 * Tests for setup-env (T-079). Every fixture lives in a temp git repo built from the
 * real `.gitignore` and `.env.example`; nothing is written into this repository.
 * Synthetic values are assembled at runtime so no secret-shaped literal sits in source.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join('scripts', 'setup-env.mts');
const SECRET_KEYS = [
  'POSTGRES_PASSWORD',
  'DB_PASSWORD_MIGRATOR',
  'DB_PASSWORD_IMPORTER',
  'DB_PASSWORD_EDITOR',
  'DB_PASSWORD_API_RO',
];
const BASE64URL = /^[A-Za-z0-9_-]+$/;

const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function git(root: string, args: string[]): void {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

/** Temp repo with the real `.gitignore` (T-080) and template. `ignore: false` omits the .gitignore. */
function makeRoot({ ignore = true }: { ignore?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'setup-env-'));
  tempDirs.push(root);
  if (ignore) copyFileSync(join(REPO_ROOT, '.gitignore'), join(root, '.gitignore'));
  mkdirSync(join(root, 'infra', 'docker'), { recursive: true });
  copyFileSync(join(REPO_ROOT, 'infra', 'docker', '.env.example'), join(root, 'infra', 'docker', '.env.example'));
  git(root, ['init', '-q']);
  return root;
}

const envPath = (root: string) => join(root, 'infra', 'docker', '.env');
const secretPath = (root: string, key: string) => join(root, 'infra', 'docker', 'secrets', secretFileName(key));

/** Valores de `.env` por clave (solo para pruebas). */
function envValues(root: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readFileSync(envPath(root), 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) map.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return map;
}

/** Estado completo observable: `.env` y cada archivo de secretos. */
function snapshot(root: string): Record<string, string> {
  const state: Record<string, string> = { env: readFileSync(envPath(root), 'utf8') };
  for (const key of SECRET_KEYS) state[key] = readFileSync(secretPath(root, key), 'utf8');
  return state;
}

function allGeneratedValues(root: string): string[] {
  const values = SECRET_KEYS.map((key) => readFileSync(secretPath(root, key), 'utf8'));
  return values.filter((value) => value.length > 0);
}

const run = (args: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

describe('first run (T-079)', () => {
  it('creates .env from the template and one secret file per secret field', () => {
    const root = makeRoot();
    const report = setupEnv(root);

    const env = envValues(root);
    assert.equal(env.get('CONTENT_SOURCE'), 'fixture', 'non-secret defaults are kept');
    assert.equal(env.get('DB_USER_API_RO'), 'api_ro', 'role names are kept');
    for (const key of SECRET_KEYS) {
      assert.ok(existsSync(secretPath(root, key)), `${key} file exists`);
      assert.equal(readFileSync(secretPath(root, key), 'utf8'), env.get(key), `${key} file matches .env`);
    }
    assert.equal(report.generated, SECRET_KEYS.length);
    assert.deepEqual(
      report.actions.map((a) => a.action).sort(),
      Array(SECRET_KEYS.length + 1).fill('creado'),
    );
  });

  it('gives every role a distinct random password of at least 24 bytes', () => {
    const root = makeRoot();
    setupEnv(root);
    const values = allGeneratedValues(root);
    assert.equal(values.length, SECRET_KEYS.length);
    assert.equal(new Set(values).size, SECRET_KEYS.length, 'no two roles share a password');
    for (const value of values) {
      assert.match(value, BASE64URL);
      assert.ok(Buffer.from(value, 'base64url').length >= PASSWORD_BYTES, 'at least 24 bytes of entropy');
    }
  });

  it('writes secret files without a trailing newline so Docker reads the exact value', () => {
    const root = makeRoot();
    setupEnv(root);
    for (const key of SECRET_KEYS) {
      assert.ok(!readFileSync(secretPath(root, key), 'utf8').endsWith('\n'), key);
    }
  });

  it('restricts new secret files to the owner on POSIX systems', { skip: process.platform === 'win32' }, () => {
    const root = makeRoot();
    setupEnv(root);
    assert.equal(statSync(envPath(root)).mode & 0o777, 0o600);
    assert.equal(statSync(secretPath(root, 'DB_PASSWORD_API_RO')).mode & 0o777, 0o600);
  });
});

describe('idempotence (T-079)', () => {
  it('two runs preserve every value and the second run creates or changes nothing', () => {
    const root = makeRoot();
    setupEnv(root);
    const first = snapshot(root);

    const second: SetupReport = setupEnv(root);
    assert.deepEqual(snapshot(root), first, 'values and files are byte-identical');
    assert.equal(second.generated, 0);
    assert.ok(second.actions.every((a) => a.action === 'conservado'), JSON.stringify(second.actions));
  });

  it('keeps a value the developer set and fills only the empty secret fields', () => {
    const root = makeRoot();
    const custom = ['developer', 'owned', 'value', '7'].join('-');
    const template = readFileSync(join(root, 'infra', 'docker', '.env.example'), 'utf8');
    writeFileSync(envPath(root), template.replace('DB_PASSWORD_API_RO=', `DB_PASSWORD_API_RO=${custom}`));

    setupEnv(root);

    assert.equal(envValues(root).get('DB_PASSWORD_API_RO'), custom, 'existing value untouched');
    assert.equal(readFileSync(secretPath(root, 'DB_PASSWORD_API_RO'), 'utf8'), custom, 'file follows .env value');
    const migrator = envValues(root).get('DB_PASSWORD_MIGRATOR') ?? '';
    assert.ok(migrator.length > 0, 'empty field is filled');
    assert.equal(readFileSync(secretPath(root, 'DB_PASSWORD_MIGRATOR'), 'utf8'), migrator);
  });

  it('reuses the secret file value when .env has the field empty, instead of generating another', () => {
    const root = makeRoot();
    setupEnv(root);
    const kept = readFileSync(secretPath(root, 'DB_PASSWORD_IMPORTER'), 'utf8');
    // Simulate a .env whose importer field was cleared: the existing secret file must win.
    const cleared = readFileSync(envPath(root), 'utf8').replace(/^DB_PASSWORD_IMPORTER=.*$/m, 'DB_PASSWORD_IMPORTER=');
    writeFileSync(envPath(root), cleared);
    assert.ok(/^DB_PASSWORD_IMPORTER=\r?$/m.test(readFileSync(envPath(root), 'utf8')));

    const report = setupEnv(root);

    assert.equal(envValues(root).get('DB_PASSWORD_IMPORTER'), kept);
    assert.equal(readFileSync(secretPath(root, 'DB_PASSWORD_IMPORTER'), 'utf8'), kept);
    assert.equal(report.generated, 0);
  });

  it('reports a warning without values when a secret file differs from .env', () => {
    const root = makeRoot();
    setupEnv(root);
    writeFileSync(secretPath(root, 'DB_PASSWORD_EDITOR'), ['other', 'value', '99'].join('-'));
    const report = setupEnv(root);
    assert.equal(report.warnings.length, 1);
    assert.ok(report.warnings[0].includes('db_password_editor.txt'));
    assert.ok(!JSON.stringify(report).includes(envValues(root).get('DB_PASSWORD_EDITOR') ?? '#'));
  });
});

describe('secret output (T-079)', () => {
  it('the programmatic report contains no generated value', () => {
    const root = makeRoot();
    const report = setupEnv(root);
    const serialized = JSON.stringify(report);
    for (const value of allGeneratedValues(root)) assert.ok(!serialized.includes(value));
  });

  it('the CLI prints no generated value on first run or on repeated runs', () => {
    const root = makeRoot();
    const first = run(['--root', root]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /setup:env OK \(5 secreto\(s\) generado\(s\)/);
    const second = run(['--root', root]);
    assert.equal(second.status, 0, second.stdout + second.stderr);

    const output = first.stdout + first.stderr + second.stdout + second.stderr;
    for (const value of allGeneratedValues(root)) assert.ok(!output.includes(value));
    assert.match(output, /creado: infra\/docker\/\.env/);
    assert.match(second.stdout, /conservado: infra\/docker\/\.env/);
  });

  it('the CLI error output contains no template value when the template holds a secret', () => {
    const root = makeRoot();
    const leaked = ['leaked', 'template', '4242'].join('-');
    writeFileSync(
      join(root, 'infra', 'docker', '.env.example'),
      readFileSync(join(root, 'infra', 'docker', '.env.example'), 'utf8').replace(
        'DB_PASSWORD_API_RO=',
        `DB_PASSWORD_API_RO=${leaked}`,
      ),
    );
    const result = run(['--root', root]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(!(result.stdout + result.stderr).includes(leaked));
    assert.ok(!existsSync(envPath(root)), 'nothing is written');
  });
});

describe('fail-closed guards (T-080 patterns)', () => {
  it('refuses to write when .env or the secret files are not ignored by git', () => {
    const root = makeRoot({ ignore: false });
    assert.throws(() => setupEnv(root), /no está ignorado por git/);
    assert.ok(!existsSync(envPath(root)));
    assert.ok(!existsSync(join(root, 'infra', 'docker', 'secrets')));
  });

  it('refuses a root that is not the top level of a git repository', () => {
    const root = makeRoot();
    const nested = join(root, 'infra', 'docker');
    assert.throws(() => setupEnv(nested), /no es la raíz de un repositorio git/);
    assert.ok(!existsSync(envPath(root)));
  });

  it('refuses a template that already holds a value in a secret field', () => {
    const root = makeRoot();
    const leaked = ['leaked', 'template', '4242'].join('-');
    writeFileSync(
      join(root, 'infra', 'docker', '.env.example'),
      readFileSync(join(root, 'infra', 'docker', '.env.example'), 'utf8').replace(
        'DB_PASSWORD_API_RO=',
        `DB_PASSWORD_API_RO=${leaked}`,
      ),
    );
    assert.throws(
      () => setupEnv(root),
      (error: Error) => error.message.includes('DB_PASSWORD_API_RO') && !error.message.includes(leaked),
    );
    assert.ok(!existsSync(envPath(root)));
  });

  it('CLI exits 2 for a root that is not a git repository', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-env-nogit-'));
    tempDirs.push(root);
    const result = run(['--root', root]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
  });
});
