import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSteps, VERIFY_STEPS } from './verify-local.mjs';

test('verify requires the offline public build secret guard after the normal build (T-084)', () => {
  const names = VERIFY_STEPS.map((step) => step.name);
  assert.equal(names.indexOf('public-build'), names.indexOf('build') + 1);
  assert.equal(VERIFY_STEPS[names.indexOf('public-build')].command, 'pnpm check:public-build');
});

test('verify runs check-scope before the other steps (T-069)', () => {
  const names = VERIFY_STEPS.map((step) => step.name);
  assert.ok(names.includes('check-scope'), 'check-scope step missing');
  assert.equal(names[0], 'check-scope');
  assert.equal(VERIFY_STEPS[0].command, 'pnpm run check:scope');
});

test('verify runs the secrets guard after boundaries (T-066a)', () => {
  const names = VERIFY_STEPS.map((step) => step.name);
  const index = names.indexOf('check-secrets');
  assert.notEqual(index, -1, 'check-secrets step missing');
  assert.equal(names.indexOf('check-boundaries') + 1, index);
  assert.equal(VERIFY_STEPS[index].command, 'pnpm run check:secrets');
});

test('verify runs the domain typecheck, lint and tests (T-051)', () => {
  const commands = VERIFY_STEPS.map((step) => step.command);
  assert.ok(commands.includes('pnpm --filter @gd/domain typecheck'), 'domain typecheck missing');
  assert.ok(commands.includes('pnpm --filter @gd/domain lint'), 'domain lint missing');
  assert.ok(commands.includes('pnpm --filter @gd/domain test'), 'domain test missing');
});

test('verify runs the API typecheck, lint and tests (T-053)', () => {
  const commands = VERIFY_STEPS.map((step) => step.command);
  assert.ok(commands.includes('pnpm --filter @gd/api typecheck'), 'api typecheck missing');
  assert.ok(commands.includes('pnpm --filter @gd/api lint'), 'api lint missing');
  assert.ok(commands.includes('pnpm --filter @gd/api test'), 'api test missing');
});

test('verify builds @gd/domain before any consumer (T-071 blocker 2)', () => {
  const commands = VERIFY_STEPS.map((step) => step.command);
  const build = commands.indexOf('pnpm --filter @gd/domain build');
  assert.notEqual(build, -1, 'domain build missing');
  for (const consumer of [
    'pnpm --filter @gd/domain typecheck',
    'pnpm --filter @gd/api typecheck',
    'pnpm assets:check',
    'pnpm test',
    'pnpm build',
  ]) {
    const index = commands.indexOf(consumer);
    assert.notEqual(index, -1, `${consumer} missing`);
    assert.ok(build < index, `domain build must run before "${consumer}"`);
  }
});

test('a failed rotation integration blocks the remaining verification gates (T-082)', async () => {
  const calls = [];
  const result = await runSteps(VERIFY_STEPS, async (step) => {
    calls.push(step.name);
    return step.name === 'test:rotation' ? 1 : 0;
  });
  assert.equal(result.ok, false);
  assert.equal(result.failedStep, 'test:rotation');
  assert.equal(calls.at(-1), 'test:rotation');
  assert.equal(calls.includes('build'), false);
});

test('runs every step in order when all succeed', async () => {
  const calls = [];
  const exec = async (step) => {
    calls.push(step.name);
    return 0;
  };

  const result = await runSteps(
    [
      { name: 'lint', command: 'npm run lint' },
      { name: 'test', command: 'npm test' },
    ],
    exec,
  );

  assert.deepEqual(calls, ['lint', 'test']);
  assert.equal(result.ok, true);
  assert.equal(result.failedStep, undefined);
});

test('stops at the first failing step and reports it', async () => {
  const calls = [];
  const exec = async (step) => {
    calls.push(step.name);
    return step.name === 'lint' ? 1 : 0;
  };

  const result = await runSteps(
    [
      { name: 'lint', command: 'npm run lint' },
      { name: 'build', command: 'npm run build' },
    ],
    exec,
  );

  assert.deepEqual(calls, ['lint']);
  assert.equal(result.ok, false);
  assert.equal(result.failedStep, 'lint');
  assert.equal(result.exitCode, 1);
});
