import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests for the secret scanning setup (T-083, plan §13.4).
 *
 * Two layers:
 * - Static (always run): config, pre-commit hook, package.json script and both
 *   workflows (PR diff in ci.yml, scheduled history in secret-scan.yml).
 * - Detection (run when the gitleaks CLI is on PATH; skipped locally otherwise,
 *   and a hard failure when CI=true so CI can never silently skip them).
 *
 * Synthetic secrets are assembled at runtime and written only to temp repositories,
 * so no secret-shaped literal exists in this file, in the working tree or in history.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(REPO_ROOT, '.gitleaks.toml');
const HOOK_REL = join('.githooks', 'pre-commit');
const HOOK = join(REPO_ROOT, HOOK_REL);
const CI_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'ci.yml');
const HISTORY_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'secret-scan.yml');
const PACKAGE_JSON = join(REPO_ROOT, 'package.json');

const GITLEAKS_VERSION = '8.30.1';
/** SHA-256 of gitleaks_8.30.1_linux_x64.tar.gz, from the release asset metadata. */
const GITLEAKS_SHA256 = '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb';
const CHECKOUT_PIN = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';

const SYN_GH_PAT = ['gh', 'p_'].join('') + 'x1'.repeat(18);
const SYN_PEM = ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join('');
const SYN_VALUES = [SYN_GH_PAT, SYN_PEM];

const read = (path: string): string => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

/** Workflow text without full-line comments, so explanations never trip negative rules. */
const codeOnly = (path: string): string =>
  read(path)
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function gitleaksOnPath(): boolean {
  const result = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  return result.status === 0;
}

const AVAILABLE = gitleaksOnPath();
const IN_CI = process.env.CI === 'true';
const SKIP_REASON = 'gitleaks CLI not on PATH (install 8.30.1; CI always runs these)';

describe('gitleaks config (.gitleaks.toml)', () => {
  const text = read(CONFIG);

  it('extends the default ruleset and declares no custom or disabled rules', () => {
    assert.match(text, /^\[extend\]\nuseDefault = true$/m);
    assert.doesNotMatch(text, /^\[\[rules\]\]/m);
    assert.doesNotMatch(text, /^\s*disabled\s*=/m);
  });

  it('keeps a single, minimal allowlist with no regexes or catch-all paths', () => {
    assert.equal((text.match(/^\[allowlist\]$/gm) ?? []).length, 1);
    assert.doesNotMatch(text, /^\[\[allowlists?\]\]/m);
    assert.doesNotMatch(text, /^regexes\s*=/m);
    const paths = /^paths\s*=\s*\[(.*)\]\s*$/m.exec(text);
    assert.ok(paths, 'allowlist paths must be declared');
    const entries = paths[1].split(',').map((e) => e.trim()).filter(Boolean);
    assert.ok(entries.length <= 2, 'allowlist must stay minimal');
    for (const entry of entries) assert.doesNotMatch(entry, /^['"]?(\.\*|\.|\*)['"]?$/);
  });
});

describe('pre-commit hook (.githooks/pre-commit)', () => {
  const text = read(HOOK);

  it('is a POSIX sh script that scans staged changes with the repo config', () => {
    assert.equal(text.split('\n')[0], '#!/bin/sh');
    assert.match(text, /^set -eu$/m);
    assert.match(text, /gitleaks git --pre-commit --staged --redact --exit-code 1 --config "\$repo_root\/\.gitleaks\.toml"/);
  });

  it('fails closed when gitleaks is missing', () => {
    assert.match(text, /if ! command -v gitleaks >\/dev\/null 2>&1; then/);
    assert.match(text, /exit 1\n\s*fi/);
  });

  it('cannot be silently bypassed by the script itself', () => {
    assert.doesNotMatch(text, /\|\|\s*true/);
    assert.doesNotMatch(text, /^\s*exit 0\s*$/m);
    assert.doesNotMatch(text, /\bset -x\b/);
    assert.doesNotMatch(text, /--no-verify|secrets\./);
  });
});

describe('package.json wiring', () => {
  const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts: Record<string, string> };

  it('exposes the hook setup command and keeps check:secrets unchanged', () => {
    assert.equal(pkg.scripts['setup:hooks'], 'git config core.hooksPath .githooks');
    assert.equal(pkg.scripts['check:secrets'], 'tsx scripts/check-secrets.mts');
  });

  it('runs this test file in test:scripts', () => {
    assert.match(pkg.scripts['test:scripts'], /scripts\/secret-scan\.test\.mts/);
  });
});

describe('PR diff scan in ci.yml', () => {
  const text = read(CI_WORKFLOW);
  const at = (needle: string) => text.indexOf(needle);

  it('checks out full history and keeps credentials out of the checkout', () => {
    assert.match(text, /uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n\s+# [^\n]*\n\s+fetch-depth: 0\n\s+persist-credentials: false/);
  });

  it('installs the pinned gitleaks version with SHA-256 verification', () => {
    assert.match(text, new RegExp(`GITLEAKS_VERSION: ${GITLEAKS_VERSION.replace(/\./g, '\\.')}\\n`));
    assert.match(text, new RegExp(`GITLEAKS_SHA256: ${GITLEAKS_SHA256}\\n`));
    assert.match(text, /sha256sum --check --strict/);
    assert.match(text, /https:\/\/github\.com\/gitleaks\/gitleaks\/releases\/download\/v\$\{GITLEAKS_VERSION\}\//);
  });

  it('scans only the PR commit range, redacted, failing on findings', () => {
    assert.match(text, /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
    assert.match(text, /HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    assert.match(
      text,
      /gitleaks git --redact --exit-code 1 --config \.gitleaks\.toml --log-opts="\$\{BASE_SHA\}\.\.\$\{HEAD_SHA\}" \./,
    );
  });

  it('runs the install and the scan before the script tests, and never on a schedule', () => {
    assert.ok(at('Install gitleaks') > 0 && at('Install gitleaks') < at('Secret scan (PR commit range)'));
    assert.ok(at('Secret scan (PR commit range)') < at('pnpm run test:scripts'));
    const code = codeOnly(CI_WORKFLOW);
    assert.doesNotMatch(code, /^\s*schedule:/m);
    assert.doesNotMatch(code, /\bsecrets\./);
  });
});

describe('scheduled history scan (secret-scan.yml)', () => {
  const text = read(HISTORY_WORKFLOW);
  const code = codeOnly(HISTORY_WORKFLOW);
  const onBlock = code.split(/^on:\s*$/m)[1]?.split(/^permissions:/m)[0] ?? '';

  it('triggers only on schedule and manual dispatch', () => {
    const events = [...onBlock.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]);
    assert.deepEqual(events, ['schedule', 'workflow_dispatch']);
    assert.match(onBlock, /cron: '\d+ \d+ \* \* \d'/);
    assert.doesNotMatch(code, /pull_request/);
  });

  it('is read-only with no secrets and no write permissions', () => {
    assert.match(code, /^permissions:\n {2}contents: read\n/m);
    assert.match(code, /^ {4}permissions:\n {6}contents: read$/m);
    assert.doesNotMatch(code, /:\s*write\b/);
    assert.doesNotMatch(code, /\bsecrets\./);
    assert.doesNotMatch(code, /id-token/);
  });

  it('uses the same pinned checkout as ci.yml, with full history and no kept credentials', () => {
    assert.ok(text.includes(CHECKOUT_PIN));
    assert.ok(read(CI_WORKFLOW).includes(CHECKOUT_PIN));
    assert.match(text, /fetch-depth: 0\n\s+persist-credentials: false/);
  });

  it('installs the same pinned gitleaks and scans the whole history with the repo config', () => {
    assert.match(text, new RegExp(`GITLEAKS_SHA256: ${GITLEAKS_SHA256}\\n`));
    assert.match(text, new RegExp(`GITLEAKS_VERSION: ${GITLEAKS_VERSION.replace(/\./g, '\\.')}\\n`));
    assert.match(text, /gitleaks git --redact --exit-code 1 --config \.gitleaks\.toml \./);
  });
});

describe('gitleaks CLI availability', () => {
  it('is installed when running in CI (detection tests must not be skipped there)', { skip: !IN_CI }, () => {
    assert.ok(AVAILABLE, 'gitleaks must be on PATH in CI; the install step failed or was removed');
  });
});

function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['-C', root, '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function newTempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'secret-scan-'));
  tempDirs.push(root);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'synthetic']);
  git(root, ['config', 'user.email', 'synthetic@example.invalid']);
  copyFileSync(CONFIG, join(root, '.gitleaks.toml'));
  return root;
}

function writeFile(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function commitAll(root: string, message: string): string {
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '--no-verify', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

const SECRET_FILE = `export const token = '${SYN_GH_PAT}';\n`;
const CLEAN_FILE = 'export const ok = 1;\n';

/** Runs gitleaks git over `root` with an optional log range; returns exit code, output and the JSON report. */
function scanHistory(root: string, logOpts?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'secret-scan-report-'));
  tempDirs.push(dir);
  const reportPath = join(dir, 'report.json');
  const args = [
    'git',
    '--redact',
    '--exit-code',
    '1',
    '--config',
    join(root, '.gitleaks.toml'),
    '--report-format',
    'json',
    '--report-path',
    reportPath,
  ];
  if (logOpts !== undefined) args.push(`--log-opts=${logOpts}`);
  args.push(root);
  const result = spawnSync('gitleaks', args, { encoding: 'utf8' });
  const report = (() => {
    try {
      return readFileSync(reportPath, 'utf8');
    } catch {
      return '';
    }
  })();
  return { status: result.status, output: `${result.stdout}${result.stderr}${report}`, report };
}

/** Detection tests: real gitleaks, synthetic secrets in temp repositories only. */
describe('detection with gitleaks (synthetic fixtures)', { skip: AVAILABLE ? false : SKIP_REASON }, () => {
  it('passes on the current repository history', () => {
    const scan = scanHistory(REPO_ROOT);
    assert.equal(scan.status, 0, `history scan found a finding in the repository:\n${scan.output}`);
  });

  it('fails a commit that adds a synthetic secret, without printing its value', () => {
    const root = newTempRepo();
    writeFile(root, 'src/config.ts', SECRET_FILE);
    writeFile(root, 'infra/key.conf', `${SYN_PEM}\n`);
    commitAll(root, 'add synthetic fixture');
    const scan = scanHistory(root);
    assert.equal(scan.status, 1, scan.output);
    const ids = (JSON.parse(scan.report || '[]') as { RuleID: string; File: string }[]).map((f) => `${f.RuleID}:${f.File}`);
    assert.ok(ids.some((id) => id.startsWith('github-pat:') && id.includes('src/config.ts')), ids.join(', '));
    for (const value of SYN_VALUES) assert.ok(!scan.output.includes(value), 'secret value leaked into output');
  });

  it('passes a clean repository', () => {
    const root = newTempRepo();
    writeFile(root, 'src/app.ts', CLEAN_FILE);
    commitAll(root, 'clean');
    assert.equal(scanHistory(root).status, 0);
  });

  it('scans only the PR commit range (base..head)', () => {
    const root = newTempRepo();
    writeFile(root, 'src/app.ts', CLEAN_FILE);
    const base = commitAll(root, 'base');
    writeFile(root, 'src/more.ts', CLEAN_FILE);
    const middle = commitAll(root, 'clean change');
    writeFile(root, 'src/config.ts', SECRET_FILE);
    const head = commitAll(root, 'pr adds secret');
    assert.equal(scanHistory(root, `${base}..${middle}`).status, 0, 'clean range must pass');
    const pr = scanHistory(root, `${middle}..${head}`);
    assert.equal(pr.status, 1, pr.output);
    assert.ok(!pr.output.includes(SYN_GH_PAT));
  });

  it('pre-commit hook blocks a staged synthetic secret and allows a clean one', () => {
    const root = newTempRepo();
    mkdirSync(join(root, '.githooks'), { recursive: true });
    copyFileSync(HOOK, join(root, HOOK_REL));
    writeFile(root, 'src/app.ts', CLEAN_FILE);
    git(root, ['add', '-A']);
    const clean = spawnSync('sh', [HOOK_REL], { cwd: root, encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);

    writeFile(root, 'src/config.ts', SECRET_FILE);
    git(root, ['add', '-A']);
    const blocked = spawnSync('sh', [HOOK_REL], { cwd: root, encoding: 'utf8' });
    assert.notEqual(blocked.status, 0, 'hook must block the staged secret');
    assert.ok(!(blocked.stdout + blocked.stderr).includes(SYN_GH_PAT));
  });
});
