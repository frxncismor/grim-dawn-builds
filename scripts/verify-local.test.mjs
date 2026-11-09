import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSteps } from './verify-local.mjs';

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
