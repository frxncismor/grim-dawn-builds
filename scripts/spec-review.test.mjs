import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as helperApi from './spec-review.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperSource = path.join(repoRoot, 'scripts', 'spec-review.mjs');
const helperAvailable = existsSync(helperSource);

test('spec-review helper exists before contract behavior can be exercised', () => {
  assert.ok(
    helperAvailable,
    'scripts/spec-review.mjs is absent; contract tests cannot invoke the CLI',
  );
});

const integrationTest = (name, fn) => test(name, { skip: !helperAvailable }, fn);

test('helper is importable for tests without running the CLI', () => {
  assert.equal(typeof helperApi.prepare, 'function');
  assert.equal(typeof helperApi.check, 'function');
  assert.equal(typeof helperApi.parseTasks, 'function');
});

async function fixture({
  tasks = '- [x] T001 implement it\n',
  artifacts = true,
  ignoredFiles = false,
  feature = 'specs/sample-feature',
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'spec-review-contract-'));
  const featureDir = path.join(root, feature);
  const scriptDir = path.join(root, 'scripts');
  await mkdir(featureDir, { recursive: true });
  await mkdir(scriptDir, { recursive: true });
  await cp(helperSource, path.join(scriptDir, 'spec-review.mjs'));
  if (artifacts) {
    await writeFile(path.join(featureDir, 'spec.md'), '# Sample\n');
    await writeFile(path.join(featureDir, 'plan.md'), '# Plan\n');
    await writeFile(path.join(featureDir, 'tasks.md'), `# Tasks\n\n${tasks}`);
  }
  if (ignoredFiles) {
    await writeFile(path.join(root, '.gitignore'), 'ignored-fixtures/\n');
    await mkdir(path.join(root, 'ignored-fixtures'), { recursive: true });
    await writeFile(
      path.join(root, 'ignored-fixtures', 'sentinel.txt'),
      'SECRET_FIXTURE_SENTINEL_DO_NOT_READ',
    );
  }
  const git = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
  assert.equal(git.status, 0, `git init failed: ${git.stderr}`);
  const add = spawnSync('git', ['add', '.'], { cwd: root, encoding: 'utf8' });
  assert.equal(add.status, 0, `git add failed: ${add.stderr}`);
  return {
    root,
    feature,
    featureDir,
    async close() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

function cli(f, command, feature = f.feature) {
  const result = spawnSync(
    process.execPath,
    ['scripts/spec-review.mjs', command, '--feature', feature],
    {
      cwd: f.root,
      encoding: 'utf8',
    },
  );
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    /* asserted below with useful stderr */
  }
  return { ...result, json };
}

function validReport(snapshot, overrides = {}) {
  const specialties = ['code', 'architecture', 'security', 'best-practices'];
  const delegationAvailable = true;
  return {
    schemaVersion: 1,
    feature: 'specs/sample-feature',
    snapshot,
    createdAt: '2026-11-09T00:00:00.000Z',
    implementationActor: 'implementer@example.test',
    delegationAvailable,
    reviews: specialties.map((specialty) => ({
      specialty,
      reviewer: `reviewer-${specialty}@example.test`,
      mode: 'independent',
      status: 'completed',
      coverage: ['specs/sample-feature/tasks.md'],
      checks: [{ name: 'contract review', result: 'completed' }],
      limitations: [],
      findings: [],
    })),
    ...overrides,
  };
}

async function readyFixture(options) {
  const f = await fixture(options);
  const prepared = cli(f, 'prepare');
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  assert.equal(prepared.json?.status, 'ready');
  return f;
}

integrationTest(
  'prepare blocks modern and legacy unchecked tasks, including letter suffixes',
  async (t) => {
    for (const tasks of [
      '- [ ] T001 modern pending\n',
      '- **T-001** legacy without checkbox\n',
      '- [ ] T-066a pending suffix\n',
    ]) {
      const f = await fixture({ tasks });
      t.after(() => f.close());
      const result = cli(f, 'prepare');
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.equal(result.json?.status, 'pending-tasks');
      assert.ok(result.json?.pendingTasks?.length > 0);
    }
  },
);

integrationTest(
  'prepare does not infer task completion from a future section; explicit SDD disposition excludes only named task',
  async (t) => {
    const future = await fixture({ tasks: '## Future\n- [ ] T-066a someday\n' });
    t.after(() => future.close());
    const pending = cli(future, 'prepare');
    assert.equal(pending.status, 1);
    assert.equal(pending.json?.status, 'pending-tasks');

    const disposed = await fixture({
      tasks: '- [x] T-001 complete\n- [ ] T-002 replaced [REEMPLAZADA por T-001; no ejecutar]\n',
    });
    t.after(() => disposed.close());
    const prepared = cli(disposed, 'prepare');
    assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
    assert.equal(prepared.json?.status, 'ready');
    assert.equal(prepared.json?.excludedTasks?.length, 1);
  },
);

integrationTest(
  'prepare accepts repository checked-bold IDs and slash-separated replacements without promoting legacy tasks',
  async (t) => {
    const f = await fixture({
      feature: 'specs/001-mvp-guias-builds',
      tasks: [
        '- [x] **T-051** verified task\n',
        '- [X] **T-066a** verified suffix task\n',
        '- **T-007** [REEMPLAZADA por T-071/T-055; no ejecutar]\n',
        '- **T-008** [REEMPLAZADA por T-073; no ejecutar]\n',
        '- **T-009** legacy pending task\n',
      ].join(''),
    });
    t.after(() => f.close());
    const result = cli(f, 'prepare');
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.equal(result.json?.status, 'pending-tasks');
    assert.deepEqual(
      result.json?.pendingTasks?.map(({ id }) => id),
      ['T-009'],
    );
    assert.deepEqual(
      result.json?.excludedTasks?.map(({ id }) => id),
      ['T-007', 'T-008'],
    );
  },
);

integrationTest(
  'prepare rejects malformed checked-bold tasks and malformed slash replacement IDs',
  async (t) => {
    for (const tasks of [
      '- [x] **T-051\n',
      '- [x] **T-051*\n',
      '- [x] **T-051**invalid\n',
      '- **T-007** [REEMPLAZADA por T-071//T-055; no ejecutar]\n',
      '- **T-007** [REEMPLAZADA por T-071/not-an-id; no ejecutar]\n',
    ]) {
      const f = await fixture({ feature: 'specs/001-mvp-guias-builds', tasks });
      t.after(() => f.close());
      const result = cli(f, 'prepare');
      assert.equal(result.status, 2, result.stderr || result.stdout);
      assert.equal(result.json?.status, 'invalid');
    }
  },
);

integrationTest(
  'prepare rejects missing artifacts and duplicate task IDs as invalid',
  async (t) => {
    const missing = await fixture({ artifacts: false });
    t.after(() => missing.close());
    const absent = cli(missing, 'prepare');
    assert.equal(absent.status, 2, absent.stderr || absent.stdout);
    assert.equal(absent.json?.status, 'invalid');

    const duplicate = await fixture({ tasks: '- [x] T001 one\n- [x] T001 duplicate\n' });
    t.after(() => duplicate.close());
    const dup = cli(duplicate, 'prepare');
    assert.equal(dup.status, 2, dup.stderr || dup.stdout);
    assert.equal(dup.json?.status, 'invalid');

    const malformed = await fixture({ tasks: '- [maybe] T003 malformed checkbox\n' });
    t.after(() => malformed.close());
    const malformedResult = cli(malformed, 'prepare');
    assert.equal(malformedResult.status, 2);
    assert.equal(malformedResult.json?.status, 'invalid');
  },
);

integrationTest('check leaves a missing or incomplete four-review report pending', async (t) => {
  const f = await readyFixture();
  t.after(() => f.close());
  const absent = cli(f, 'check');
  assert.equal(absent.status, 1);
  assert.equal(absent.json?.status, 'pending-review');

  const prepared = cli(f, 'prepare');
  const reportDir = path.join(f.featureDir, 'reviews');
  await mkdir(reportDir, { recursive: true });
  const partial = validReport(prepared.json.snapshot);
  partial.reviews.pop();
  await writeFile(path.join(reportDir, 'completion-review.json'), JSON.stringify(partial));
  const incomplete = cli(f, 'check');
  assert.equal(incomplete.status, 1);
  assert.equal(incomplete.json?.status, 'pending-review');
});

integrationTest(
  'check rejects not-run/failed results and false reviewer independence',
  async (t) => {
    const f = await readyFixture();
    t.after(() => f.close());
    const prepared = cli(f, 'prepare');
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });
    for (const [index, invalidReview] of [
      { status: 'not-run' },
      { status: 'failed' },
      { reviewer: '' },
      { reviewer: 'implementer@example.test' },
      { mode: 'self-review' },
    ].entries()) {
      const report = validReport(prepared.json.snapshot);
      report.reviews[index] = { ...report.reviews[index], ...invalidReview };
      await writeFile(reportPath, JSON.stringify(report));
      const result = cli(f, 'check');
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.equal(result.json?.status, 'pending-review');
    }
  },
);

integrationTest(
  'check requires truthful self-review capability and rejects malformed report values',
  async (t) => {
    const f = await readyFixture();
    t.after(() => f.close());
    const prepared = cli(f, 'prepare');
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });

    const selfReview = validReport(prepared.json.snapshot, { delegationAvailable: false });
    selfReview.reviews = selfReview.reviews.map((review) => ({
      ...review,
      mode: 'self-review',
      reviewer: 'implementer@example.test',
    }));
    await writeFile(reportPath, JSON.stringify(selfReview));
    assert.equal(cli(f, 'check').status, 1, 'self-review without capabilityReason must not pass');
    selfReview.reviews = selfReview.reviews.map((review) => ({
      ...review,
      capabilityReason: 'Harness has no agent delegation tool',
    }));
    await writeFile(reportPath, JSON.stringify(selfReview));
    assert.equal(cli(f, 'check').status, 0);

    const malformedReports = [
      '{not json',
      JSON.stringify(validReport('not-a-digest')),
      JSON.stringify(validReport(prepared.json.snapshot, { createdAt: 'yesterday' })),
      JSON.stringify(validReport(prepared.json.snapshot, { delegationAvailable: 'yes' })),
    ];
    for (const malformed of malformedReports) {
      await writeFile(reportPath, malformed);
      const result = cli(f, 'check');
      assert.equal(result.status, 1);
      assert.equal(result.json?.status, 'pending-review');
    }
  },
);

integrationTest(
  'malformed JSON keeps check pending without echoing any report bytes to stdout or stderr',
  async (t) => {
    const f = await readyFixture();
    t.after(() => f.close());
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });
    const privateSentinel = 'PRIVATE_REPORT_SENTINEL_MUST_NEVER_BE_ECHOED';
    await writeFile(reportPath, privateSentinel, 'utf8');
    const result = cli(f, 'check');
    assert.equal(result.status, 1);
    assert.equal(result.json?.status, 'pending-review');
    assert.deepEqual(result.json?.reasons, ['completion review report is malformed JSON']);
    assert.ok(!result.stdout.includes(privateSentinel));
    assert.ok(!result.stderr.includes(privateSentinel));
  },
);

integrationTest(
  'check rejects path traversal, invalid finding fields, and symlink review paths',
  async (t) => {
    const f = await readyFixture();
    t.after(() => f.close());
    const prepared = cli(f, 'prepare');
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });
    for (const finding of [
      { path: '../../outside.txt', line: 1 },
      { path: 'specs/sample-feature/spec.md', line: 0 },
      { path: 'specs/sample-feature/spec.md', line: 1, severity: 'URGENT' },
    ]) {
      const report = validReport(prepared.json.snapshot);
      report.reviews[0].findings = [
        {
          id: 'F-1',
          severity: finding.severity ?? 'LOW',
          path: finding.path,
          line: finding.line,
          evidence: 'evidence',
          impact: 'impact',
          recommendation: 'fix',
          disposition: 'open',
        },
      ];
      await writeFile(reportPath, JSON.stringify(report));
      const result = cli(f, 'check');
      assert.equal(result.status, 1);
      assert.equal(result.json?.status, 'pending-review');
    }

    const outside = await mkdtemp(path.join(os.tmpdir(), `spec-review-outside-${process.pid}-`));
    const outsideFile = path.join(outside, 'source.txt');
    await writeFile(outsideFile, 'outside fixture');
    try {
      const { symlink } = await import('node:fs/promises');
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      const reviewLink = path.join(f.featureDir, 'reviews', 'external');
      await symlink(outside, reviewLink, linkType);
      const maliciousReport = validReport(prepared.json.snapshot);
      maliciousReport.reviews[0].findings = [
        {
          id: 'F-link',
          severity: 'LOW',
          path: `${f.feature}/reviews/external/source.txt`,
          line: 1,
          evidence: 'linked path',
          impact: 'outside repository',
          recommendation: 'reject path',
          disposition: 'open',
        },
      ];
      await writeFile(reportPath, JSON.stringify(maliciousReport));
      const rejectedPath = cli(f, 'check');
      assert.equal(rejectedPath.status, 1);
      assert.equal(rejectedPath.json?.status, 'pending-review');

      await symlink(outside, path.join(f.featureDir, 'external-link'), linkType);
    } catch (error) {
      await rm(outside, { recursive: true, force: true });
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        t.diagnostic(`symlink case unavailable on this host: ${error.code}`);
        return;
      }
      throw error;
    }
    const refreshed = cli(f, 'prepare');
    assert.equal(refreshed.status, 2, 'snapshot must reject symlinks before reading their targets');
    await rm(outside, { recursive: true, force: true });
  },
);

integrationTest(
  'check blocks open CRITICAL/HIGH and requires disposition for MEDIUM/LOW',
  async (t) => {
    const f = await readyFixture();
    t.after(() => f.close());
    const prepared = cli(f, 'prepare');
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });
    for (const severity of ['CRITICAL', 'HIGH']) {
      const report = validReport(prepared.json.snapshot);
      report.reviews[0].findings = [
        {
          id: 'F-1',
          severity,
          path: 'specs/sample-feature/spec.md',
          line: 1,
          evidence: 'evidence',
          impact: 'impact',
          recommendation: 'fix',
          disposition: 'open',
        },
      ];
      await writeFile(reportPath, JSON.stringify(report));
      const result = cli(f, 'check');
      assert.equal(result.status, 1);
      assert.equal(result.json?.status, 'blocked');
    }
    for (const severity of ['MEDIUM', 'LOW']) {
      const report = validReport(prepared.json.snapshot);
      report.reviews[0].findings = [
        {
          id: 'F-1',
          severity,
          path: 'specs/sample-feature/spec.md',
          line: 1,
          evidence: 'evidence',
          impact: 'impact',
          recommendation: 'fix',
          disposition: 'open',
        },
      ];
      await writeFile(reportPath, JSON.stringify(report));
      assert.equal(cli(f, 'check').status, 1);
    }
  },
);

integrationTest(
  'check requires verified SDD resolution for resolved findings and allows reasoned MEDIUM/LOW deferral',
  async (t) => {
    const f = await readyFixture();
    t.after(() => f.close());
    const prepared = cli(f, 'prepare');
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });
    const report = validReport(prepared.json.snapshot);
    report.reviews[0].findings = [
      {
        id: 'F-1',
        severity: 'LOW',
        path: 'specs/sample-feature/spec.md',
        line: 1,
        evidence: 'evidence',
        impact: 'impact',
        recommendation: 'fix',
        disposition: 'resolved',
        resolution: 'fixed and checked',
      },
    ];
    await writeFile(reportPath, JSON.stringify(report));
    assert.equal(cli(f, 'check').status, 1);
    report.reviews[0].findings[0] = {
      ...report.reviews[0].findings[0],
      resolution: 'Verified in T-999: test passed',
    };
    await writeFile(reportPath, JSON.stringify(report));
    assert.equal(cli(f, 'check').status, 1, 'a nonexistent SDD task cannot resolve a finding');
    report.reviews[0].findings[0] = {
      ...report.reviews[0].findings[0],
      resolution: 'Verified in T-001: test passed',
    };
    await writeFile(reportPath, JSON.stringify(report));
    assert.equal(cli(f, 'check').status, 0);
    report.reviews[0].findings[0] = {
      ...report.reviews[0].findings[0],
      disposition: 'deferred',
      deferReason: 'Out of scope; disposition documented in T-001',
    };
    await writeFile(reportPath, JSON.stringify(report));
    assert.equal(cli(f, 'check').status, 0);
  },
);

integrationTest(
  'a report becomes stale after tracked changes, new eligible files, or deletion',
  async (t) => {
    const f = await readyFixture();
    t.after(() => f.close());
    await writeFile(path.join(f.root, 'tracked-extra.txt'), 'tracked baseline');
    const addTracked = spawnSync('git', ['add', 'tracked-extra.txt'], {
      cwd: f.root,
      encoding: 'utf8',
    });
    assert.equal(addTracked.status, 0);
    const prepared = cli(f, 'prepare');
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });
    const report = validReport(prepared.json.snapshot);
    const writeReport = () => writeFile(reportPath, JSON.stringify(report));
    await writeReport();
    assert.equal(cli(f, 'check').status, 0);

    await writeFile(path.join(f.featureDir, 'spec.md'), '# Changed\n');
    assert.equal(cli(f, 'check').json?.status, 'pending-review');
    const next = cli(f, 'prepare');
    report.snapshot = next.json.snapshot;
    await writeReport();
    await writeFile(path.join(f.root, 'new-untracked.txt'), 'new');
    assert.equal(cli(f, 'check').json?.status, 'pending-review');
    await rm(path.join(f.root, 'new-untracked.txt'));

    const refreshed = cli(f, 'prepare');
    report.snapshot = refreshed.json.snapshot;
    await writeReport();
    await rm(path.join(f.root, 'tracked-extra.txt'));
    assert.equal(cli(f, 'check').json?.status, 'pending-review');
  },
);

integrationTest(
  'review reports and the local feature pointer do not change the snapshot; ignored content is absent from output',
  async (t) => {
    const f = await readyFixture({ ignoredFiles: true });
    t.after(() => f.close());
    const prepared = cli(f, 'prepare');
    await mkdir(path.join(f.root, '.specify'), { recursive: true });
    await writeFile(path.join(f.root, '.specify', 'feature.json'), '{"secret":"POINTER_SENTINEL"}');
    const reportPath = path.join(f.featureDir, 'reviews', 'completion-review.json');
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(validReport(prepared.json.snapshot)));
    await writeFile(path.join(path.dirname(reportPath), 'reviewer-notes.txt'), 'REVIEW_SENTINEL');
    const result = cli(f, 'check');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.json?.snapshot, prepared.json.snapshot);
    assert.ok(!result.stdout.includes('SECRET_FIXTURE_SENTINEL_DO_NOT_READ'));
    assert.ok(!result.stdout.includes('POINTER_SENTINEL'));
    assert.ok(!result.stdout.includes('REVIEW_SENTINEL'));
  },
);
