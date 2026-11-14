import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CONTENT_MOUNT,
  contentContainerArguments,
  launchContentImport,
  launchSeed,
  seedContainerArguments,
  successPattern,
} from './seed-content.mts';

test('seed reports the fixed bootstrap refusal without forwarding arbitrary stderr', () => {
  const messages: string[] = [];
  const result = launchSeed(
    { APP_ENV: 'test' },
    {
      validPath: () => true,
      write: (line) => messages.push(line),
      run: (args) => {
        if (args.includes('ps')) return { code: 0, output: 'a'.repeat(64) };
        if (args[0] === 'inspect') return { code: 0, output: '{"project_default":{}}' };
        if (args.includes('printenv')) return { code: 0, output: 'gd_dev' };
        return { code: 1, output: 'PRIVATE-CANARY', error: 'seed failed: bootstrapped\n' };
      },
    },
  );
  assert.equal(result, 1);
  assert.deepEqual(messages, ['seed failed: bootstrapped']);
});

test('production or missing APP_ENV rejects before filesystem and Docker access', () => {
  for (const APP_ENV of [undefined, '', 'production', 'staging']) {
    let touched = false;
    const code = launchSeed(
      { APP_ENV },
      {
        run: () => {
          touched = true;
          throw new Error('Unexpected Docker access');
        },
        validPath: () => {
          touched = true;
          return true;
        },
        write: () => undefined,
      },
    );
    assert.equal(code, 1);
    assert.equal(touched, false);
  }
});
test('the container gets only importer credentials and readonly content without host ports', () => {
  const args = seedContainerArguments('/work', 'gd_default', 'gd_dev', 'test');
  const text = args.join(' ');
  assert.ok(text.includes('db_password_importer.txt'));
  assert.ok(text.includes('APP_ENV=test'));
  assert.doesNotMatch(
    text,
    /db_password_api_ro|db_password_migrator|postgres_password|--env-file|--publish|--privileged/,
  );
  assert.equal(args.includes('--read-only'), true);
  assert.equal(args[args.indexOf('--pull') + 1], 'never');
  assert.equal(
    args.filter((arg) => arg.startsWith('type=bind')).every((arg) => arg.endsWith(',readonly')),
    true,
  );
});
test('public metadata selects the running database without reading its environment file', () => {
  const calls: string[][] = [];
  const messages: string[] = [];
  const code = launchSeed(
    { APP_ENV: 'development' },
    {
      root: '/work',
      validPath: () => true,
      write: (line) => messages.push(line),
      run: (args) => {
        calls.push(args);
        if (args.includes('ps')) return { code: 0, output: 'a'.repeat(64) };
        if (args[0] === 'inspect') return { code: 0, output: '{"project_default":{}}' };
        if (args.includes('printenv')) return { code: 0, output: 'custom_db\n' };
        return {
          code: 0,
          output: 'seed complete: 1 builds, 1 tier lists, 6 masteries, 186 nodes\n',
        };
      },
    },
  );
  assert.equal(code, 0);
  assert.ok(calls.at(-1)?.includes('POSTGRES_DB=custom_db'));
  assert.ok(calls.at(-1)?.includes('project_default'));
  assert.deepEqual(messages, ['seed complete: 1 builds, 1 tier lists, 6 masteries, 186 nodes']);
});
test('failed metadata and child output are redacted and never treated as success', () => {
  const messages: string[] = [];
  assert.equal(
    launchSeed(
      { APP_ENV: 'test' },
      {
        validPath: () => true,
        run: () => ({ code: 1, output: 'PRIVATE-CANARY' }),
        write: (line) => messages.push(line),
      },
    ),
    1,
  );
  assert.equal(
    messages.some((line) => line.includes('PRIVATE-')),
    false,
  );
});

test('the mount target and the SEED_CONTENT_ROOT the seeder reads are the same path', () => {
  for (const operation of ['seed', 'bootstrap'] as const) {
    const args = contentContainerArguments(operation, '/work', 'gd_default', 'gd_dev', 'test');
    const mount = args.find((arg) => arg.startsWith('type=bind') && arg.includes('fixtures'));
    const target = /target=([^,]+)/.exec(mount ?? '')?.[1];
    assert.ok(target, 'fixtures bind mount present');
    assert.equal(target, CONTENT_MOUNT);
    assert.ok(args.includes(`SEED_CONTENT_ROOT=${CONTENT_MOUNT}`));
  }
});

test('the success pattern accepts the exact line the seeders print', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = `
    const s = await import('./apps/api/src/db/seed.mts');
    const b = await import('./apps/api/src/db/bootstrap.mts');
    console.log(JSON.stringify({
      seed: s.seedCompleteLine({ builds: 2, tierLists: 3, masteries: 6, nodes: 186 }),
      bootstrap: b.bootstrapCompleteLine({ builds: 2, tierLists: 3 }),
    }));`;
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr);
  const lines = JSON.parse(child.stdout) as Record<'seed' | 'bootstrap', string>;
  for (const operation of ['seed', 'bootstrap'] as const) {
    assert.match(lines[operation], successPattern(operation));
    const messages: string[] = [];
    const code = launchContentImport(
      operation,
      { APP_ENV: 'test' },
      {
        root: '/work',
        validPath: () => true,
        write: (line) => messages.push(line),
        run: (args) => {
          if (args.includes('ps')) return { code: 0, output: 'a'.repeat(64) };
          if (args[0] === 'inspect') return { code: 0, output: '{"n":{}}' };
          if (args.includes('printenv')) return { code: 0, output: 'gd_dev' };
          return { code: 0, output: `${lines[operation]}\n` };
        },
      },
    );
    assert.equal(code, 0);
    assert.deepEqual(messages, [lines[operation]]);
  }
});
