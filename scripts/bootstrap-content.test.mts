import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBootstrap } from './bootstrap-content.mts';

test('bootstrap Docker command keeps only importer input and its fixed entrypoint', () => {
  const calls: string[][] = [];
  const messages: string[] = [];
  const code = launchBootstrap(
    { APP_ENV: 'test' },
    {
      validPath: () => true,
      write: (line) => messages.push(line),
      run: (args) => {
        calls.push(args);
        if (args.includes('ps')) return { code: 0, output: 'a'.repeat(64) };
        if (args[0] === 'inspect') return { code: 0, output: '{"project_default":{}}' };
        if (args.includes('printenv')) return { code: 0, output: 'gd_dev' };
        return { code: 0, output: 'bootstrap complete: 1 builds, 1 tier lists\n' };
      },
    },
  );
  assert.equal(code, 0);
  assert.ok(calls.at(-1)?.includes('dist/db/bootstrap.mjs'));
  assert.doesNotMatch(
    calls.at(-1)!.join(' '),
    /db_password_editor|db_password_api_ro|migrator|postgres_password|--publish|--env-file/,
  );
  assert.deepEqual(messages, ['bootstrap complete: 1 builds, 1 tier lists']);
});
test('bootstrap launcher rejects nonlocal environment before touching files or Docker', () => {
  let touched = false;
  assert.equal(
    launchBootstrap(
      {},
      {
        validPath: () => {
          touched = true;
          return true;
        },
        write: () => undefined,
      },
    ),
    1,
  );
  assert.equal(touched, false);
});
test('bootstrap launcher relays only a fixed refusal code from container stderr', () => {
  const messages: string[] = [];
  const result = launchBootstrap(
    { APP_ENV: 'test' },
    {
      validPath: () => true,
      write: (line) => messages.push(line),
      run: (args) => {
        if (args.includes('ps')) return { code: 0, output: 'a'.repeat(64) };
        if (args[0] === 'inspect') return { code: 0, output: '{"project_default":{}}' };
        if (args.includes('printenv')) return { code: 0, output: 'gd_dev' };
        return { code: 1, output: 'PRIVATE-CANARY', error: 'bootstrap failed: not-empty\n' };
      },
    },
  );
  assert.equal(result, 1);
  assert.deepEqual(messages, ['bootstrap failed: not-empty']);
});
