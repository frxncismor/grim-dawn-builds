import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Static checks for the PR verification workflow (T-064, plan §12.8 / §13.4).
 * Text-based on purpose: no YAML dependency. The workflow is written with one
 * step per check, so line-level rules are precise enough and fail loudly.
 */

const WORKFLOW_URL = new URL('../.github/workflows/ci.yml', import.meta.url);

const EXPECTED_BRANCHES = ['develop', 'main', 'mvp/1'];

const REQUIRED_ACTIONS = ['actions/checkout', 'pnpm/action-setup', 'actions/setup-node'];

/** Exact `run:` commands that the PR workflow must execute (T-064 list). */
export const REQUIRED_RUN_COMMANDS = [
  'pnpm install --frozen-lockfile',
  'pnpm run check:scope',
  'pnpm run check:boundaries',
  'pnpm --filter @gd/domain typecheck',
  'pnpm --filter @gd/domain lint',
  'pnpm --filter @gd/domain test',
  'pnpm run lint',
  'pnpm run lint:md',
  'pnpm run format:check',
  'pnpm run test',
  'pnpm run test:scripts',
  'pnpm run content:validate -- --dir scripts/fixtures/content-valid',
  'pnpm run assets:check',
  'pnpm run build',
];

const indentOf = (line: string): number => line.length - line.trimStart().length;

/** Lines nested under `lines[headerIndex]` (deeper indentation, blanks allowed). */
function blockAfter(lines: readonly string[], headerIndex: number): string[] {
  const indent = indentOf(lines[headerIndex]);
  const out: string[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() !== '' && indentOf(line) <= indent) break;
    out.push(line);
  }
  return out;
}

/** Returns a list of rule violations; an empty list means the workflow passes. */
export function validateCiWorkflow(source: string): string[] {
  const problems: string[] = [];
  // Full-line comments are documentation, not configuration: ignore them so
  // a comment that names a forbidden token does not fail the rules.
  const lines = source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l));
  const text = lines.join('\n');

  if (/pull_request_target/.test(text)) problems.push('uses pull_request_target (forbidden)');
  if (/\bsecrets\./.test(text)) problems.push('references secrets (workflow must need none)');
  if (/\bset -x\b/.test(text)) problems.push('uses set -x (may leak values)');
  if (/\bpermissions:\s*(read-all|write-all)\b/.test(text)) {
    problems.push('uses read-all/write-all permissions');
  }
  if (/:\s*write\b/.test(text)) problems.push('requests write permission');
  if (/id-token/.test(text)) problems.push('requests id-token (no OIDC in PR verification)');

  // Triggers: only pull_request, targeting exactly the three integration branches.
  const onIdx = lines.findIndex((l) => /^on:\s*$/.test(l));
  if (onIdx < 0) {
    problems.push('missing on: trigger');
  } else {
    const onLines = blockAfter(lines, onIdx);
    const events = onLines
      .filter((l) => indentOf(l) === 2 && l.trim().endsWith(':'))
      .map((l) => l.trim().slice(0, -1));
    if (JSON.stringify(events) !== '["pull_request"]') {
      problems.push(`trigger events must be only pull_request (found: ${events.join(', ')})`);
    }
    const prIdx = onLines.findIndex((l) => /^ {2}pull_request:\s*$/.test(l));
    const prLines = prIdx < 0 ? [] : blockAfter(onLines, prIdx);
    const branchIdx = prLines.findIndex((l) => /^\s*branches:\s*$/.test(l));
    const branches =
      branchIdx < 0
        ? []
        : blockAfter(prLines, branchIdx)
            .map((l) => l.trim().match(/^-\s+(\S+)$/)?.[1])
            .filter((b): b is string => b !== undefined);
    if (JSON.stringify([...branches].sort()) !== JSON.stringify(EXPECTED_BRANCHES)) {
      problems.push(
        `pull_request branches must be exactly ${EXPECTED_BRANCHES.join(', ')} (found: ${branches.join(', ') || 'none'})`,
      );
    }
  }

  // Permissions: top-level and every job-level block must be exactly `contents: read`.
  const permIdx = lines
    .map((l, i) => (/^\s*permissions:/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  if (!permIdx.some((i) => indentOf(lines[i]) === 0)) {
    problems.push('missing top-level permissions block');
  }
  for (const i of permIdx) {
    if (lines[i].trim() !== 'permissions:') {
      problems.push(`permissions must be a block (line ${i + 1})`);
      continue;
    }
    const entries = blockAfter(lines, i)
      .filter((l) => l.trim() !== '')
      .map((l) => l.trim());
    if (JSON.stringify(entries) !== '["contents: read"]') {
      problems.push(`permissions must be only contents: read (line ${i + 1})`);
    }
  }

  // Third-party actions: pinned by full commit SHA, with the version in a comment.
  const uses = lines
    .map((l) => l.match(/^\s*(?:-\s+)?uses:\s*(\S+)\s*(?:#\s*(.*))?$/))
    .filter((m): m is RegExpMatchArray => m !== null);
  for (const m of uses) {
    const [, ref, comment] = m;
    if (!/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(ref)) {
      problems.push(`action not pinned by full commit SHA: ${ref}`);
    }
    if (!comment || !/^v\d+\.\d+\.\d+\b/.test(comment)) {
      problems.push(`action missing version comment (# vX.Y.Z): ${ref}`);
    }
  }
  for (const action of REQUIRED_ACTIONS) {
    if (!uses.some((m) => m[1].startsWith(`${action}@`))) {
      problems.push(`missing required action ${action}`);
    }
  }

  // Runners are pinned (no floating `latest` images).
  for (const line of lines) {
    const runsOn = line.match(/^\s*runs-on:\s*(\S+)/);
    if (runsOn && /latest/.test(runsOn[1])) problems.push(`floating runner: ${runsOn[1]}`);
  }

  if (!lines.some((l) => /^\s*persist-credentials:\s*false\s*$/.test(l))) {
    problems.push('checkout must set persist-credentials: false');
  }
  if (!lines.some((l) => /^\s*cache:\s*pnpm\s*$/.test(l))) {
    problems.push('pnpm cache must be configured (cache: pnpm)');
  }

  // Commands: exact required checks, and nothing that mutates the tree or ships.
  const runs = lines
    .map((l) => l.match(/^\s*(?:-\s+)?run:\s*(.+?)\s*$/)?.[1])
    .filter((r): r is string => r !== undefined);
  for (const command of REQUIRED_RUN_COMMANDS) {
    if (!runs.includes(command)) problems.push(`missing required check: ${command}`);
  }
  for (const run of runs) {
    if (/--fix\b|--write\b|:fix\b/.test(run) || /^pnpm (run )?format$/.test(run)) {
      problems.push(`check must not modify the tree: ${run}`);
    }
    if (/\bdeploy\b|\bpublish\b|docker push/i.test(run)) {
      problems.push(`deployment step is out of scope: ${run}`);
    }
    if (/^(printenv|env)$/.test(run)) problems.push('dumps environment (may leak values)');
    if (/^pnpm (install|i)\b/.test(run) && !run.includes('--frozen-lockfile')) {
      problems.push(`pnpm install must use --frozen-lockfile: ${run}`);
    }
  }

  return problems;
}

describe('PR verification workflow (T-064)', () => {
  // Normalise CRLF so the line-based mutations match on Windows checkouts too.
  const real = readFileSync(WORKFLOW_URL, 'utf8').replace(/\r\n/g, '\n');

  it('the repository workflow passes every static rule', () => {
    assert.deepEqual(validateCiWorkflow(real), []);
  });

  /** Applies one textual mutation and asserts it changed the workflow. */
  function mutate(from: string | RegExp, to: string): string {
    const mutated = real.replace(from, to);
    assert.notEqual(mutated, real, `mutation did not apply: ${String(from)}`);
    return mutated;
  }

  const regressions: [string, () => string][] = [
    ['pull_request_target', () => mutate('pull_request:', 'pull_request_target:')],
    ['missing target branch main', () => mutate(/ {6}- main\n/, '')],
    ['extra trigger (push)', () => mutate(/^on:\n/m, 'on:\n  push:\n    branches: [main]\n')],
    ['contents: write', () => mutate(/contents: read/, 'contents: write')],
    ['write-all permissions', () => mutate(/^permissions:\n {2}contents: read/m, 'permissions: write-all')],
    ['tag instead of SHA', () => mutate(/actions\/checkout@[0-9a-f]{40}/, 'actions/checkout@v7')],
    ['SHA without version comment', () => mutate(/ # v7\.0\.1/, '')],
    ['floating runner', () => mutate('ubuntu-24.04', 'ubuntu-latest')],
    ['unfrozen install', () => mutate('pnpm install --frozen-lockfile', 'pnpm install')],
    ['lint:md removed', () => mutate(/\n {6}- name: [^\n]*\n {8}run: pnpm run lint:md\n/, '\n')],
    ['markdown fix in CI', () => mutate('pnpm run lint:md\n', 'pnpm run lint:md:fix\n')],
    ['content validate not fixture-scoped', () => mutate('pnpm run content:validate -- --dir scripts/fixtures/content-valid', 'pnpm run content:validate')],
    ['secret reference', () => mutate('pnpm run build', 'pnpm run build\n        env:\n          X: ${{ secrets.X }}')],
    ['deploy step', () => mutate('pnpm run build', 'pnpm run build\n      - run: deploy-now')],
    ['checkout keeps credentials', () => mutate('persist-credentials: false', 'persist-credentials: true')],
  ];

  for (const [name, build] of regressions) {
    it(`fails on regression: ${name}`, () => {
      assert.notDeepEqual(validateCiWorkflow(build()), []);
    });
  }
});
