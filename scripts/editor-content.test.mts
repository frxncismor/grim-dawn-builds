import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorContainerArguments, launchEditor } from './editor-content.mts';

const args = ['--kind', 'build', '--slug', 'local-guide', '--file', 'input.json'];
test('editor launcher refuses invalid environment and arguments before touching local resources', () => {
  let touched = false;
  const options = {
    run: () => {
      touched = true;
      throw new Error();
    },
    validFile: () => {
      touched = true;
      return true;
    },
    write: () => undefined,
  };
  assert.equal(launchEditor({}, args, options), 1);
  assert.equal(launchEditor({ APP_ENV: 'production' }, args, options), 1);
  assert.equal(launchEditor({ APP_ENV: 'test' }, ['--password', 'private'], options), 1);
  assert.equal(touched, false);
});
test('editor container receives only its input and its own readonly secret, with no database host port', () => {
  const result = editorContainerArguments(
    '/work',
    'project_default',
    'gd_dev',
    'test',
    'build',
    'local-guide',
    '/input.json',
  );
  const text = result.join(' ');
  assert.match(text, /db_password_editor.txt/);
  assert.match(text, /target=\/run\/editor\/input.json,readonly/);
  assert.doesNotMatch(
    text,
    /db_password_importer|db_password_api_ro|migrator|postgres_password|--env-file|--publish|--privileged/,
  );
  assert.equal(result[result.indexOf('--pull') + 1], 'never');
  assert.equal(result.includes('--read-only'), true);
});
test('editor launcher uses public metadata and relays only fixed completion counters or error codes', () => {
  const messages: string[] = [];
  const calls: string[][] = [];
  const run = (call: string[]) => {
    calls.push(call);
    if (call.includes('ps')) return { code: 0, output: 'a'.repeat(64) };
    if (call[0] === 'inspect') return { code: 0, output: '{"project_default":{}}' };
    if (call.includes('printenv')) return { code: 0, output: 'gd_dev' };
    return { code: 0, output: 'editor complete: 1 builds, 0 tier lists\n' };
  };
  assert.equal(
    launchEditor({ APP_ENV: 'development' }, args, {
      root: '/work',
      run,
      validFile: () => true,
      write: (line) => messages.push(line),
    }),
    0,
  );
  assert.deepEqual(messages, ['editor complete: 1 builds, 0 tier lists']);
  assert.ok(calls.at(-1)?.includes('DB_USER_EDITOR=editor'));
  messages.length = 0;
  assert.equal(
    launchEditor({ APP_ENV: 'test' }, args, {
      run: (call) =>
        call[0] === 'run'
          ? { code: 1, output: 'PRIVATE-CANARY', error: 'PRIVATE-CANARY' }
          : run(call),
      validFile: () => true,
      write: (line) => messages.push(line),
    }),
    1,
  );
  assert.doesNotMatch(messages.join(), /PRIVATE-CANARY/);
});
