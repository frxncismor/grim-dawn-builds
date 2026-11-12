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

/** Trivy image pinned by tag and multi-arch index digest (T-066b). */
export const TRIVY_IMAGE =
  'aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb';

/** ZAP image pinned by tag and multi-arch index digest (T-077). */
export const ZAP_IMAGE =
  'ghcr.io/zaproxy/zaproxy:2.16.1@sha256:7840969c7c9fead565bf9734b12f49f6886db90b1d35b1f74d79710bbd081dab';

/** Exact `run:` commands that the PR workflow must execute (T-064 list). */
export const REQUIRED_RUN_COMMANDS = [
  'pnpm install --frozen-lockfile',
  'pnpm run check:scope',
  'pnpm run check:boundaries',
  'pnpm run check:secrets',
  'pnpm --filter @gd/domain build',
  'pnpm --filter @gd/domain typecheck',
  'pnpm --filter @gd/domain lint',
  'pnpm --filter @gd/domain test',
  'pnpm --filter @gd/api typecheck',
  'pnpm --filter @gd/api lint',
  'pnpm --filter @gd/api test',
  'pnpm run lint',
  'pnpm run lint:md',
  'pnpm run format:check',
  'pnpm run test',
  'pnpm run test:scripts',
  'pnpm run content:validate -- --dir scripts/fixtures/content-valid',
  'pnpm run assets:check',
  'pnpm run build',
  // T-126: real fixture content, catalog freshness and the quality gates.
  'pnpm run content:validate -- --dir content',
  'pnpm run catalog:check',
  // T-150: the en/es catalogs must match in PR verification too.
  'pnpm run check:locale-parity',
  'pnpm exec ng build --output-path dist/e2e-drafts',
  'pnpm exec playwright install --with-deps chromium',
  'pnpm run e2e:journeys',
  'pnpm run e2e:a11y',
  'pnpm run check:performance',
  // T-128: backend budgets consume the report produced by the API integration tests.
  'pnpm exec tsx scripts/check-performance.mts --backend',
  // T-066b: static container rules and the Trivy image-scan gate.
  'pnpm run check-container',
  'docker build --file apps/api/Dockerfile --tag gd-api:ci-scan .',
  'docker save --output "$RUNNER_TEMP/gd-api-ci-scan.tar" gd-api:ci-scan',
  `docker run --rm -v "$RUNNER_TEMP:/scan" ${TRIVY_IMAGE} image --input /scan/gd-api-ci-scan.tar --format json --output /scan/trivy-image.json --scanners vuln --severity MEDIUM,HIGH,CRITICAL`,
  'pnpm exec tsx scripts/check-container.mts --report "$RUNNER_TEMP/trivy-image.json"',
  // T-077: DAST job builds the API, serves loopback targets and decides with check-dast.
  'pnpm --filter @gd/api build',
  'pnpm exec tsx scripts/check-dast.mts --report "$RUNNER_TEMP/zap/dast-web.json" --report "$RUNNER_TEMP/zap/dast-api-builds.json" --report "$RUNNER_TEMP/zap/dast-api-health.json"',
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
  // Solo una expresión de secreto ${{ secrets.X }}, no un nombre de archivo que contenga «secrets.».
  if (/\$\{\{[^}]*\bsecrets\./.test(text))
    problems.push('references secrets (workflow must need none)');
  if (/\bset -x\b/.test(text)) problems.push('uses set -x (may leak values)');
  if (/\bpermissions:\s*(read-all|write-all)\b/.test(text)) {
    problems.push('uses read-all/write-all permissions');
  }
  if (/:\s*write\b/.test(text)) problems.push('requests write permission');
  if (/id-token/.test(text)) problems.push('requests id-token (no OIDC in PR verification)');
  // T-126: YAML indentation must be spaces; a tab breaks parsing invisibly.
  if (/\t/.test(source)) problems.push('uses tab characters (YAML indentation must be spaces)');

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
  const permIdx = lines.map((l, i) => (/^\s*permissions:/.test(l) ? i : -1)).filter((i) => i >= 0);
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
    if (
      /--fix\b|--write\b|:fix\b|--update-snapshots\b/.test(run) ||
      /^pnpm (run )?format$/.test(run)
    ) {
      problems.push(`check must not modify the tree: ${run}`);
    }
    if (/\bdeploy\b|\bpublish\b|docker push/i.test(run)) {
      problems.push(`deployment step is out of scope: ${run}`);
    }
    if (/^(printenv|env)$/.test(run)) problems.push('dumps environment (may leak values)');
    if (/^pnpm (install|i)\b/.test(run) && !run.includes('--frozen-lockfile')) {
      problems.push(`pnpm install must use --frozen-lockfile: ${run}`);
    }
    // T-126: the drafts artifact needs its own directory, never the public one.
    if (/\bng build\b/.test(run) && !run.includes('--output-path dist/e2e-drafts')) {
      problems.push(`ng build must target the isolated drafts directory: ${run}`);
    }
    if (run.includes('--output-path dist/grim-dawn-builds')) {
      problems.push(`build must not overwrite the public artifact: ${run}`);
    }
  }

  // T-066b: the image scanner is pinned and the MEDIUM threshold is never relaxed.
  for (const run of runs) {
    if (!/\baquasec\/trivy:/.test(run)) continue;
    const image = run.match(/\baquasec\/trivy:\S+/)?.[0].replace(/["']/g, '') ?? '';
    if (!/^aquasec\/trivy:[\w.-]+@sha256:[0-9a-f]{64}$/.test(image)) {
      problems.push(`Trivy image must be pinned by tag and digest: ${image || 'missing'}`);
    }
    if (!run.includes('--severity MEDIUM,HIGH,CRITICAL')) {
      problems.push('Trivy scan must block from MEDIUM (--severity MEDIUM,HIGH,CRITICAL)');
    }
    if (/--ignore-unfixed|--ignorefile|--ignore-policy/.test(run)) {
      problems.push('Trivy must not ignore findings (--ignore-unfixed/--ignorefile)');
    }
  }

  // T-077: DAST runs the pinned ZAP image against loopback targets only, and never
  // passes a rules file or an "ignore warnings" flag that could hide alerts.
  // The ZAP command is a block scalar, so it is read from the raw lines, not `run:`.
  for (const run of lines) {
    if (!/\bzap-baseline\.py\b/.test(run)) continue;
    const image = run.match(/\bghcr\.io\/zaproxy\/zaproxy:\S+/)?.[0].replace(/["']/g, '') ?? '';
    if (!/^ghcr\.io\/zaproxy\/zaproxy:[\w.-]+@sha256:[0-9a-f]{64}$/.test(image)) {
      problems.push(`ZAP image must be pinned by tag and digest: ${image || 'missing'}`);
    }
    const target = run.match(/(?:^|\s)-t\s+("[^"]*"|'[^']*'|\S+)/)?.[1].replace(/["']/g, '') ?? '';
    if (!/^http:\/\/127\.0\.0\.1:\d{1,5}(?:[/?#]\S*)?$/.test(target)) {
      problems.push(`ZAP target must be a loopback URL (127.0.0.1): ${target || 'missing'}`);
    }
    const flags = run.split(/\s+/);
    for (const flag of ['-c', '-u', '-i', '-I', '-p', '--hook']) {
      if (flags.includes(flag)) {
        problems.push(`ZAP must not use ${flag} (a rules file or ignore flag can hide alerts)`);
      }
    }
  }
  for (const run of runs) {
    if (!/scripts\/check-dast\.mts/.test(run)) continue;
    if (/--severity|--allowlist|--threshold|--ignore\b/.test(run)) {
      problems.push(`DAST threshold must not be configurable: ${run}`);
    }
    if (!run.includes('--report')) problems.push(`DAST must evaluate a ZAP report: ${run}`);
  }
  const dastIdx = lines.findIndex((line) => /^ {2}dast:\s*$/.test(line));
  const verifyIdx = lines.findIndex((line) => /^ {2}verify:\s*$/.test(line));
  if (dastIdx < 0) {
    problems.push('missing dast job (T-077)');
  } else if (verifyIdx >= 0 && dastIdx < verifyIdx) {
    problems.push('dast job must be declared after verify');
  }

  // T-126: quality gates measure the built artifact, not the dev server.
  if (/\bng serve\b/.test(text)) problems.push('runs the dev server instead of the built artifact');

  // T-126: the drafts build and the Lighthouse step need their explicit env.
  if (!lines.some((l) => /^\s*INCLUDE_DRAFTS:\s*'true'\s*$/.test(l))) {
    problems.push("drafts build must set INCLUDE_DRAFTS: 'true'");
  }
  if (!lines.some((l) => /^\s*CHROME_PATH:\s*\/usr\/bin\/google-chrome\s*$/.test(l))) {
    problems.push('Lighthouse step must set CHROME_PATH on the runner');
  }

  // T-126: e2e + axe + Lighthouse do not fit in the old 30 minute budget.
  const timeoutIdx = lines.findIndex((l) => /^\s*timeout-minutes:\s*\d+\s*$/.test(l));
  if (timeoutIdx < 0) {
    problems.push('missing timeout-minutes (needed by the quality gates)');
  } else if (Number(lines[timeoutIdx].match(/(\d+)/)?.[1] ?? 0) < 40) {
    problems.push(`timeout-minutes must be at least 40 (line ${timeoutIdx + 1})`);
  }
  // T-077: a runaway job or an unbounded budget is rejected in every job.
  lines.forEach((line, index) => {
    const match = line.match(/^\s*timeout-minutes:\s*(\d+)\s*$/);
    if (!match) return;
    const minutes = Number(match[1]);
    if (minutes < 10 || minutes > 60) {
      problems.push(`timeout-minutes must be between 10 and 60 (line ${index + 1})`);
    }
  });

  // Minimal structural validation without a YAML parser: even indentation,
  // `steps:` entries starting with name/uses/run, and every job with `runs-on:`.
  // Line numbers refer to the comment-filtered text, as in the rules above.
  lines.forEach((line, index) => {
    if (line.trim() !== '' && indentOf(line) % 2 !== 0) {
      problems.push(`indentation must be a multiple of 2 (line ${index + 1})`);
    }
  });

  const jobsIdx = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (jobsIdx < 0) {
    problems.push('missing jobs: block');
  } else {
    const jobHeaders = blockAfter(lines, jobsIdx)
      .map((line, k) => ({ line, index: jobsIdx + 1 + k }))
      .filter(
        ({ line }) => line.trim() !== '' && indentOf(line) === 2 && line.trim().endsWith(':'),
      );
    if (jobHeaders.length === 0) problems.push('jobs: block declares no job');
    for (const job of jobHeaders) {
      const jobBlock = blockAfter(lines, job.index);
      if (!jobBlock.some((line) => /^\s*runs-on:/.test(line))) {
        problems.push(`job must declare runs-on: (line ${job.index + 1})`);
      }
      // T-077: every job (verify, container, dast) declares its own budget.
      if (!jobBlock.some((line) => /^\s*timeout-minutes:\s*\d+\s*$/.test(line))) {
        problems.push(`job must declare timeout-minutes: (line ${job.index + 1})`);
      }
    }
  }

  // Every job's `steps:` block must follow the same shape (T-066b added a second job).
  const stepsIndexes = lines
    .map((line, index) => (/^\s*steps:\s*$/.test(line) ? index : -1))
    .filter((index) => index >= 0);
  if (stepsIndexes.length === 0) {
    problems.push('missing steps: block');
  }
  for (const stepsIdx of stepsIndexes) {
    const items = blockAfter(lines, stepsIdx)
      .map((line, k) => ({ line, index: stepsIdx + 1 + k }))
      .filter(({ line }) => line.trim() !== '');
    const itemIndent = items.length > 0 ? indentOf(items[0].line) : 0;
    for (const item of items) {
      const trimmed = item.line.trim();
      if (indentOf(item.line) !== itemIndent) continue;
      if (!trimmed.startsWith('- ')) {
        problems.push(`steps entry must start with "- " (line ${item.index + 1})`);
        continue;
      }
      const key = trimmed.match(/^-\s+([A-Za-z_][\w-]*):/)?.[1];
      if (key !== 'name' && key !== 'uses' && key !== 'run') {
        problems.push(`steps entry must start with name, uses or run (line ${item.index + 1})`);
      }
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

  it('allows the secrets validator command (T-086: a file name is not a secret reference)', () => {
    const withValidator = mutate(
      /( {8}run: pnpm run check:secrets\n)/,
      '$1\n      - name: Check CI workflows for secrets\n        run: pnpm exec tsx scripts/check-ci-secrets.mts\n',
    );
    assert.deepEqual(validateCiWorkflow(withValidator), []);
  });

  it('runs content, drafts build, e2e/axe and performance in order, with performance last (T-126)', () => {
    const lines = real.split('\n');
    const runLine = (command: string): number => lines.indexOf(`        run: ${command}`);
    const indexOf = (command: string): number => {
      const index = runLine(command);
      assert.notEqual(index, -1, `missing run: ${command}`);
      return index;
    };

    const fixtureContent = indexOf(
      'pnpm run content:validate -- --dir scripts/fixtures/content-valid',
    );
    const realContent = indexOf('pnpm run content:validate -- --dir content');
    const catalog = indexOf('pnpm run catalog:check');
    const draftsBuild = indexOf('pnpm exec ng build --output-path dist/e2e-drafts');
    const journeys = indexOf('pnpm run e2e:journeys');
    const a11y = indexOf('pnpm run e2e:a11y');
    const apiTests = indexOf('pnpm --filter @gd/api test');
    const backendPerformance = indexOf('pnpm exec tsx scripts/check-performance.mts --backend');
    const performance = indexOf('pnpm run check:performance');

    assert.ok(fixtureContent < realContent, 'real content validation goes after the fixture one');
    assert.ok(realContent < catalog, 'catalog:check goes after the content validation');
    assert.ok(catalog < draftsBuild, 'the drafts build needs the validated content');
    assert.ok(draftsBuild < journeys, 'journeys need the drafts artifact');
    assert.ok(draftsBuild < a11y, 'axe runs on the built artifact');
    assert.ok(journeys < performance, 'performance measures the built artifact and runs last');
    assert.ok(a11y < performance, 'performance measures the built artifact and runs last');
    // T-128: the backend gate consumes the report written by the API tests and
    // never replaces the frontend Lighthouse gate.
    assert.ok(apiTests < backendPerformance, 'the backend gate reads the API test report');
    assert.ok(backendPerformance < performance, 'the frontend performance gate stays last');

    // T-066b adds a second job after `verify`; performance is still the last gate of the
    // verify job and must not move before the artifact it measures.
    const containerIdx = lines.findIndex((line) => /^ {2}container:\s*$/.test(line));
    assert.notEqual(containerIdx, -1, 'missing container job');
    const verifyRuns = lines
      .slice(0, containerIdx)
      .filter((line) => /^\s*(?:-\s+)?run:\s*\S/.test(line));
    assert.equal(verifyRuns.at(-1)?.trim(), 'run: pnpm run check:performance');
  });

  it('container job checks statically, builds, scans and applies the Trivy threshold (T-066b)', () => {
    const lines = real.split('\n');
    const jobIndex = lines.findIndex((line) => /^ {2}container:\s*$/.test(line));
    assert.notEqual(jobIndex, -1, 'missing container job');
    const runLine = (command: string): number => lines.indexOf(`        run: ${command}`);
    const indexOf = (command: string): number => {
      const index = runLine(command);
      assert.notEqual(index, -1, `missing run: ${command}`);
      assert.ok(index > jobIndex, `run: ${command} must be inside the container job`);
      return index;
    };

    const staticCheck = indexOf('pnpm run check-container');
    const build = indexOf('docker build --file apps/api/Dockerfile --tag gd-api:ci-scan .');
    const archive = indexOf(
      'docker save --output "$RUNNER_TEMP/gd-api-ci-scan.tar" gd-api:ci-scan',
    );
    const scan = indexOf(
      `docker run --rm -v "$RUNNER_TEMP:/scan" ${TRIVY_IMAGE} image --input /scan/gd-api-ci-scan.tar --format json --output /scan/trivy-image.json --scanners vuln --severity MEDIUM,HIGH,CRITICAL`,
    );
    const evaluate = indexOf(
      'pnpm exec tsx scripts/check-container.mts --report "$RUNNER_TEMP/trivy-image.json"',
    );

    assert.ok(staticCheck < build, 'static rules run before the image build');
    assert.ok(build < archive, 'the image must exist before it is exported');
    assert.ok(archive < scan, 'Trivy scans the exported archive');
    assert.ok(scan < evaluate, 'the JSON report is decided by check-container');
  });

  it('dast job builds, starts loopback targets, runs ZAP and applies the threshold (T-077)', () => {
    const lines = real.split('\n');
    const jobIndex = lines.findIndex((line) => /^ {2}dast:\s*$/.test(line));
    assert.notEqual(jobIndex, -1, 'missing dast job');
    const step = (name: string): number => {
      const index = lines.findIndex((line, i) => i > jobIndex && line === `      - name: ${name}`);
      assert.notEqual(index, -1, `missing dast step: ${name}`);
      return index;
    };

    const checkout = step('Check out repository');
    const install = step('Install dependencies (frozen lockfile)');
    const domainBuild = step('Domain build');
    const webBuild = step('Web build (fixture content)');
    const apiBuild = step('API build');
    const credentials = step('Generate ephemeral database credentials');
    const database = step('Start PostgreSQL 17 (pinned, loopback only)');
    const migrate = step('Apply migrations with the migrator role');
    const serve = step('Serve web artifact and start API (loopback only)');
    const zapWeb = step('ZAP baseline against the web artifact (loopback)');
    const zapApi = step('ZAP baseline against the API (loopback)');
    const evaluate = step('Evaluate ZAP reports (MEDIUM blocks)');

    assert.ok(checkout < install, 'checkout goes first');
    assert.ok(install < domainBuild, 'the domain builds before the web');
    assert.ok(domainBuild < webBuild, 'the domain package is needed by the web build');
    assert.ok(webBuild < apiBuild, 'both artifacts are built before the scan');
    assert.ok(apiBuild < credentials, 'credentials are generated after the official build');
    assert.ok(credentials < database, 'the database receives the ephemeral credential');
    assert.ok(database < migrate, 'migrations need the database');
    assert.ok(migrate < serve, 'the API needs the migrated schema');
    assert.ok(serve < zapWeb, 'ZAP scans the served web artifact');
    assert.ok(serve < zapApi, 'ZAP scans the live API');
    assert.ok(zapWeb < evaluate && zapApi < evaluate, 'check-dast decides after both scans');

    // The raw ZAP reports are never uploaded: only the redacted checker output is.
    const dastBlock = lines.slice(jobIndex).join('\n');
    assert.doesNotMatch(dastBlock, /upload-artifact/);
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
    [
      'write-all permissions',
      () => mutate(/^permissions:\n {2}contents: read/m, 'permissions: write-all'),
    ],
    ['tag instead of SHA', () => mutate(/actions\/checkout@[0-9a-f]{40}/, 'actions/checkout@v7')],
    ['SHA without version comment', () => mutate(/ # v7\.0\.1/, '')],
    ['floating runner', () => mutate('ubuntu-24.04', 'ubuntu-latest')],
    ['unfrozen install', () => mutate('pnpm install --frozen-lockfile', 'pnpm install')],
    [
      'secrets check removed',
      () => mutate(/ {6}- name: Check tracked secrets\n {8}run: pnpm run check:secrets\n/, ''),
    ],
    ['lint:md removed', () => mutate(/\n {6}- name: [^\n]*\n {8}run: pnpm run lint:md\n/, '\n')],
    ['markdown fix in CI', () => mutate('pnpm run lint:md\n', 'pnpm run lint:md:fix\n')],
    [
      'content validate not fixture-scoped',
      () =>
        mutate(
          'pnpm run content:validate -- --dir scripts/fixtures/content-valid',
          'pnpm run content:validate',
        ),
    ],
    [
      'secret reference',
      () => mutate('pnpm run build', 'pnpm run build\n        env:\n          X: ${{ secrets.X }}'),
    ],
    ['deploy step', () => mutate('pnpm run build', 'pnpm run build\n      - run: deploy-now')],
    [
      'checkout keeps credentials',
      () => mutate(/persist-credentials: false/g, 'persist-credentials: true'),
    ],
    // T-126: each quality gate and content check must stay in the PR workflow.
    [
      'journeys gate removed',
      () => mutate(/\n {6}- name: E2E journeys[^\n]*\n {8}run: pnpm run e2e:journeys\n/, '\n'),
    ],
    [
      'axe gate removed',
      () => mutate(/\n {6}- name: Accessibility gate[^\n]*\n {8}run: pnpm run e2e:a11y\n/, '\n'),
    ],
    [
      'performance gate removed',
      () =>
        mutate(
          /\n {6}- name: Performance budgets[^\n]*\n {8}env:\n {10}CHROME_PATH: \/usr\/bin\/google-chrome\n {8}run: pnpm run check:performance\n/,
          '\n',
        ),
    ],
    // T-128: the backend budgets must keep failing the PR on a real breach.
    [
      'backend performance gate removed',
      () =>
        mutate(
          /\n {6}- name: Backend performance budgets[^\n]*\n {8}run: pnpm exec tsx scripts\/check-performance\.mts --backend\n/,
          '\n',
        ),
    ],
    [
      'catalog check removed',
      () => mutate(/\n {6}- name: Catalog check[^\n]*\n {8}run: pnpm run catalog:check\n/, '\n'),
    ],
    [
      'playwright install removed',
      () =>
        mutate(
          /\n {6}- name: Install Playwright[^\n]*\n {8}run: pnpm exec playwright install --with-deps chromium\n/,
          '\n',
        ),
    ],
    [
      'real content validation removed',
      () =>
        mutate(
          /\n {6}- name: Content validation \(real fixture content\)\n {8}run: pnpm run content:validate -- --dir content\n/,
          '\n',
        ),
    ],
    [
      'drafts build overwrites the public artifact',
      () => mutate('--output-path dist/e2e-drafts', '--output-path dist/grim-dawn-builds'),
    ],
    [
      'drafts build without INCLUDE_DRAFTS',
      () => mutate("INCLUDE_DRAFTS: 'true'", "INCLUDE_DRAFTS: 'false'"),
    ],
    [
      'Lighthouse without CHROME_PATH',
      () => mutate('CHROME_PATH: /usr/bin/google-chrome', 'CHROME_PATH:'),
    ],
    [
      'dev server step',
      () =>
        mutate(
          /\n {6}- name: Install Playwright/,
          '\n      - name: Dev server\n        run: ng serve\n\n      - name: Install Playwright',
        ),
    ],
    ['short timeout', () => mutate('timeout-minutes: 45', 'timeout-minutes: 30')],
    [
      'tab indentation',
      () => mutate(/\n {8}run: pnpm run check:scope/, '\n\t        run: pnpm run check:scope'),
    ],
    [
      'e2e snapshots rewritten in CI',
      () => mutate('run: pnpm run e2e:journeys', 'run: pnpm run e2e:journeys --update-snapshots'),
    ],
    // T-066b: the container job and the Trivy threshold must stay enforced.
    ['container job removed', () => `${real.slice(0, real.indexOf('\n  container:'))}\n`],
    [
      'container static check removed',
      () =>
        mutate(
          /\n {6}- name: Container configuration check\n {8}run: pnpm run check-container\n/,
          '\n',
        ),
    ],
    [
      'api image build removed',
      () =>
        mutate(
          /\n {6}- name: Build API image for scanning[^\n]*\n {8}run: docker build[^\n]*\n/,
          '\n',
        ),
    ],
    [
      'trivy scan removed',
      () => mutate(/\n {6}- name: Scan image with Trivy[^\n]*\n {8}run: docker run[^\n]*\n/, '\n'),
    ],
    [
      'trivy threshold relaxed',
      () => mutate('--severity MEDIUM,HIGH,CRITICAL', '--severity HIGH,CRITICAL'),
    ],
    [
      'trivy report not evaluated',
      () =>
        mutate(
          /\n {6}- name: Evaluate Trivy report[^\n]*\n {8}run: [^\n]*check-container[^\n]*\n/,
          '\n',
        ),
    ],
    ['trivy image floating', () => mutate(TRIVY_IMAGE, 'aquasec/trivy:latest')],
    [
      'trivy ignores unfixed findings',
      () =>
        mutate(
          '--severity MEDIUM,HIGH,CRITICAL',
          '--severity MEDIUM,HIGH,CRITICAL --ignore-unfixed',
        ),
    ],
    // T-077: the DAST job, its pinned scanner and the loopback-only threshold gate.
    ['dast job removed', () => `${real.slice(0, real.indexOf('\n  dast:'))}\n`],
    ['zap image floating', () => mutate(ZAP_IMAGE, 'ghcr.io/zaproxy/zaproxy:latest')],
    [
      'remote DAST target',
      () => mutate('-t http://127.0.0.1:8081/', '-t https://dast.example.com/'),
    ],
    [
      'zap rules file hides alerts',
      () => mutate('zap-baseline.py -t', 'zap-baseline.py -c rules.tsv -t'),
    ],
    ['zap ignores warnings', () => mutate('zap-baseline.py -t', 'zap-baseline.py -I -t')],
    [
      'dast evaluation removed',
      () =>
        mutate(/\n {6}- name: Evaluate ZAP reports[^\n]*\n {8}run: [^\n]*check-dast[^\n]*\n/, '\n'),
    ],
    [
      'dast threshold lowered by flag',
      () => mutate('check-dast.mts --report', 'check-dast.mts --severity LOW --report'),
    ],
    [
      'dast allowlist added',
      () => mutate('check-dast.mts --report', 'check-dast.mts --allowlist 10038 --report'),
    ],
    [
      'dast job without timeout',
      () =>
        mutate(
          /\n {4}timeout-minutes: 40\n {4}permissions:\n {6}contents: read\n {4}env:\n {6}NG_CLI_ANALYTICS/,
          '\n    permissions:\n      contents: read\n    env:\n      NG_CLI_ANALYTICS',
        ),
    ],
  ];

  for (const [name, build] of regressions) {
    it(`fails on regression: ${name}`, () => {
      assert.notDeepEqual(validateCiWorkflow(build()), []);
    });
  }
});
