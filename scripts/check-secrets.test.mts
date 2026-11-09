import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFiles, scanRepository, type Finding } from './check-secrets.mts';

/**
 * Tests for check-secrets (T-066a). All secret-shaped values are synthetic and
 * assembled at runtime, so the literal secret never appears in this source file
 * and the repository scan stays clean. Fixtures live in temp dirs, never in the repo.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join('scripts', 'check-secrets.mts');

const SYN_PW = 'zq7Synth3ticPw9x0';
const SYN_GH = ['gh', 'p_'].join('') + 'x1'.repeat(18);
const SYN_AWS = ['AK', 'IA'].join('') + 'SYNTH0000EXAMPLE';
const SYN_PEM = ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join('');
const SYN_URL = (password: string) => ['postgres://api_ro:', password, '@db:5432/gd'].join('');
const SYN_VALUES = [SYN_PW, SYN_GH, SYN_AWS, SYN_PEM];

const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const noContent = (): string => '';
const scanText = (files: Record<string, string>): Finding[] => scanFiles(Object.keys(files), (p) => files[p]);
const rules = (findings: Finding[]): string[] => findings.map((f) => f.rule);
const CLEAN = 'export const ok = 1;\n';

function write(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function git(root: string, args: string[]): void {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

/** Temp git repo: only `tracked` is added to the index; `untracked` stays on disk. */
function makeRepo(tracked: Record<string, string>, untracked: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'check-secrets-'));
  tempDirs.push(root);
  for (const [rel, content] of Object.entries({ ...tracked, ...untracked })) write(root, rel, content);
  git(root, ['init', '-q']);
  git(root, ['add', '--', ...Object.keys(tracked)]);
  return root;
}

describe('tracked .env files', () => {
  it('fails tracked .env files at any depth', () => {
    for (const path of ['.env', '.env.local', '.env.production', 'infra/docker/.env', 'apps/api/.env.test']) {
      assert.deepEqual(rules(scanFiles([path], noContent)), ['tracked-env-file'], path);
    }
  });

  it('does not flag .env.example or unrelated names', () => {
    assert.deepEqual(scanText({ '.env.example': '', 'src/app/environment.ts': CLEAN }), []);
  });
});

describe('.env.example', () => {
  const CLEAN_ENV = [
    'CONTENT_SOURCE=fixture',
    'POSTGRES_DB=gd_dev',
    'API_PORT=3000',
    'CORS_ORIGINS=http://localhost:4200',
    'DB_PASSWORD_API_RO=',
    'DB_PASSWORD_MIGRATOR=""',
    'POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password',
    '',
  ].join('\n');

  it('passes when secret fields are empty and values are safe', () => {
    assert.deepEqual(scanText({ '.env.example': CLEAN_ENV }), []);
  });

  it('passes an empty secret field followed by an inline comment', () => {
    assert.deepEqual(scanText({ '.env.example': 'DB_PASSWORD_MIGRATOR= # set by pnpm setup:env\n' }), []);
  });

  it('fails a secret field with a non-empty value without echoing it', () => {
    const findings = scanText({ '.env.example': `DB_PASSWORD_API_RO=${SYN_PW}\n` });
    assert.deepEqual(rules(findings), ['env-example-secret-value']);
    assert.equal(findings[0].line, 1);
    assert.ok(!JSON.stringify(findings).includes(SYN_PW));
  });

  it('fails a non-empty secret field even with an inline comment', () => {
    const findings = scanText({ '.env.example': `API_TOKEN=${SYN_PW} # real token\n` });
    assert.ok(rules(findings).includes('env-example-secret-value'));
  });

  it('fails weak placeholder markers in any value', () => {
    for (const value of ['changeme', 'CHANGE_ME', 'password', 'db_password', 'passwd', 'xxx', '<your-key>', 'your-token-here', 'replace-me']) {
      assert.deepEqual(rules(scanText({ '.env.example': `POSTGRES_USER=${value}\n` })), ['env-example-placeholder'], value);
    }
  });
});

describe('tracked secrets directories', () => {
  it('fails tracked files inside any secrets/ directory', () => {
    for (const path of ['infra/docker/secrets/db_password.txt', 'secrets/readme.txt', 'apps/api/Secrets/key']) {
      assert.deepEqual(rules(scanFiles([path], noContent)), ['tracked-secrets-dir'], path);
    }
  });

  it('does not flag files merely named after secrets', () => {
    assert.deepEqual(scanText({ 'docs/security/secrets.md': '', 'src/app/secrets-panel.ts': CLEAN }), []);
  });
});

describe('Dockerfile ARG/ENV/COPY secret injection', () => {
  it('checks every Dockerfile naming form', () => {
    for (const path of ['apps/api/Dockerfile', 'Dockerfile.dev', 'api.Dockerfile']) {
      assert.deepEqual(rules(scanText({ [path]: 'ARG DB_PASSWORD\n' })), ['docker-secret-injection'], path);
    }
  });

  it('fails ARG and ENV with secret names, with or without defaults', () => {
    assert.deepEqual(rules(scanText({ Dockerfile: 'ARG API_TOKEN=abc\n' })), ['docker-secret-injection']);
    assert.deepEqual(rules(scanText({ Dockerfile: 'ENV API_TOKEN=abc\n' })), ['docker-secret-injection']);
    assert.deepEqual(rules(scanText({ Dockerfile: 'ENV DB_PASSWORD hunter\n' })), ['docker-secret-injection']);
  });

  it('fails a secret ENV hidden in a continued instruction and reports its first line', () => {
    const findings = scanText({ Dockerfile: 'ENV NODE_ENV=production \\\n    DB_PASSWORD=value\n' });
    assert.deepEqual(rules(findings), ['docker-secret-injection']);
    assert.equal(findings[0].line, 1);
  });

  it('passes safe ARG/ENV and the _FILE indirection used for secrets', () => {
    const body = [
      'FROM node:22.12.0-slim',
      'ARG NODE_VERSION=22.12.0',
      'ENV CONTENT_SOURCE=api',
      'ENV DB_PASSWORD_FILE=/run/secrets/db_password',
      '# ARG DB_PASSWORD (commented out)',
      'COPY --from=build /app/dist ./dist',
      'COPY . .',
      'COPY .env.example ./',
      '',
    ].join('\n');
    assert.deepEqual(scanText({ 'apps/api/Dockerfile': body }), []);
  });

  it('fails COPY or ADD of .env files and secrets directories', () => {
    assert.deepEqual(rules(scanText({ Dockerfile: 'COPY .env ./\n' })), ['docker-secret-copy']);
    assert.deepEqual(rules(scanText({ Dockerfile: 'ADD infra/docker/secrets/db /run/db\n' })), ['docker-secret-copy']);
  });
});

describe('high-confidence secret patterns', () => {
  it('fails synthetic provider tokens and private key headers in code and config', () => {
    assert.deepEqual(rules(scanText({ 'src/app/config.ts': `export const t = '${SYN_GH}';\n` })), ['secret-pattern']);
    assert.deepEqual(rules(scanText({ 'scripts/setup.mts': `const id = '${SYN_AWS}';\n` })), ['secret-pattern']);
    assert.deepEqual(rules(scanText({ 'infra/key.conf': `${SYN_PEM}\n` })), ['secret-pattern']);
  });

  it('passes GitHub Actions secret references', () => {
    const workflow = 'env:\n  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n';
    assert.deepEqual(scanText({ '.github/workflows/ci.yml': workflow }), []);
  });

  it('fails literal secret assignments to secret-named variables', () => {
    assert.deepEqual(
      rules(scanText({ 'infra/docker/compose.yaml': `environment:\n  DB_PASSWORD: ${SYN_PW}\n` })),
      ['generic-secret-assignment'],
    );
    assert.deepEqual(
      rules(scanText({ 'scripts/x.mts': `process.env.API_TOKEN = "${SYN_PW}";\n` })),
      ['generic-secret-assignment'],
    );
  });

  it('passes references, short values and lowercase or non-secret names', () => {
    const code = [
      'DB_PASSWORD: process.env.DB_PASSWORD',
      'API_TOKEN: ${API_TOKEN}',
      'DB_PASSWORD=short1',
      "DESIGN_TOKEN = 'design-token-name'",
      "password: 'lowercase-form-value-1'",
      '',
    ].join('\n');
    assert.deepEqual(scanText({ 'src/app/x.ts': code }), []);
  });

  it('fails URLs with a literal password in content and package scripts', () => {
    assert.deepEqual(rules(scanText({ 'content/builds/x.json': `{"url":"${SYN_URL(SYN_PW)}"}\n` })), ['credential-url']);
    const manifest = JSON.stringify({ scripts: { db: `psql ${SYN_URL(SYN_PW)}` } });
    assert.deepEqual(rules(scanText({ 'package.json': manifest })), ['credential-url']);
  });

  it('passes URLs without a literal password', () => {
    const urls = [
      '${DATABASE_URL}',
      'postgres://api_ro:${DB_PASSWORD}@db:5432/gd',
      'postgres://api_ro:<runtime>@db:5432/gd',
      'postgres://api_ro@db:5432/gd',
      'https://example.org/a?b=c',
      'http://localhost:4200',
    ];
    assert.deepEqual(scanText({ 'src/app/x.ts': urls.join('\n') }), []);
  });
});

describe('intentional exclusions (pattern rules only)', () => {
  it('skips markdown, lockfiles, generated folders and fixture folders for pattern rules', () => {
    const files = {
      'docs/security/secrets.md': SYN_GH,
      'pnpm-lock.yaml': `integrity: ${SYN_GH}\n`,
      'dist/browser/main.js': `const t='${SYN_GH}';\n`,
      'node_modules/x/index.js': `const t='${SYN_GH}';\n`,
      'scripts/fixtures/content-valid/x.json': `{"t":"${SYN_GH}"}\n`,
    };
    assert.deepEqual(scanText(files), []);
  });

  it('still fails structural rules inside fixture folders', () => {
    assert.deepEqual(rules(scanFiles(['scripts/fixtures/.env'], noContent)), ['tracked-env-file']);
    assert.deepEqual(rules(scanText({ 'scripts/fixtures/Dockerfile': 'ARG DB_PASSWORD\n' })), ['docker-secret-injection']);
  });

  it('skips binary content but still applies path rules', () => {
    const findings = scanFiles(['assets/logo.png', '.env'], (p) => (p.endsWith('.png') ? undefined : `${SYN_PW}`));
    assert.deepEqual(rules(findings), ['tracked-env-file']);
  });
});

describe('redaction', () => {
  it('never echoes matched values in any finding', () => {
    const findings = scanText({
      'src/a.ts': `const t = '${SYN_GH}';\nconst id = '${SYN_AWS}';\n`,
      'infra/key.conf': `${SYN_PEM}\n`,
      'content/x.json': `{"url":"${SYN_URL(SYN_PW)}"}\n`,
      'infra/docker/compose.yaml': `DB_PASSWORD: ${SYN_PW}\n`,
      '.env.example': `DB_PASSWORD_API_RO=${SYN_PW}\n`,
    });
    assert.ok(findings.length >= 5);
    const serialized = JSON.stringify(findings);
    for (const value of SYN_VALUES) assert.ok(!serialized.includes(value));
  });
});

describe('git-tracked scan', () => {
  it('ignores local untracked files: they are neither read nor reported', () => {
    const root = makeRepo(
      { 'src/app/a.ts': CLEAN },
      { '.env': `DB_PASSWORD_API_RO=${SYN_PW}\n`, 'infra/docker/secrets/db.txt': SYN_PW },
    );
    const result = scanRepository(root);
    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 1);
  });

  it('reports committed .env files and secrets directories', () => {
    const root = makeRepo({ '.env': 'X=1\n', 'infra/docker/secrets/db.txt': 'x' });
    assert.deepEqual(rules(scanRepository(root).findings).sort(), ['tracked-env-file', 'tracked-secrets-dir']);
  });

  it('reports the line of a tracked secret pattern', () => {
    const root = makeRepo({ 'src/app/a.ts': `const a = 1;\nconst t = '${SYN_GH}';\n` });
    const findings = scanRepository(root).findings;
    assert.deepEqual(
      findings.map((f) => [f.file, f.line, f.rule]),
      [['src/app/a.ts', 2, 'secret-pattern']],
    );
  });
});

describe('repository and CLI', () => {
  it('passes the current repository (tracked files only)', () => {
    const result = scanRepository(REPO_ROOT);
    assert.deepEqual(result.findings, []);
    assert.ok(result.scannedFiles > 0);
  });

  const run = (args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

  it('exits 0 for the current repository', () => {
    const result = run([]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /check:secrets OK/);
  });

  it('exits 1 with file, line and rule, and without the value, for a tracked .env', () => {
    const root = makeRepo({ '.env': `DB_PASSWORD_API_RO=${SYN_PW}\n` });
    const result = run(['--root', root]);
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /\.env:1 \[tracked-env-file\]/);
    assert.ok(!output.includes(SYN_PW));
  });

  it('exits 2 when the root is not a git repository (fails closed)', () => {
    const root = mkdtempSync(join(tmpdir(), 'check-secrets-nogit-'));
    tempDirs.push(root);
    const result = run(['--root', root]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
  });
});
