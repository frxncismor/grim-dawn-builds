import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { publicBuildEnv, runRelease } from './build-release.mts';
import { expectedMigration } from './check-release.mts';
import { assertStaticHome } from './static-home.mts';

test('release environment permits public configuration and excludes private and executable overrides', () => {
  const env = publicBuildEnv({
    CONTENT_SOURCE: 'api',
    BASE_URL: 'https://example.test',
    PRIVATE_CANARY: 'private',
    DB_PASSWORD_API_RO: 'private',
    NODE_OPTIONS: '--inspect',
    NG_BUILD_MAX_WORKERS: '99',
    PATH: 'runtime-path',
  });
  assert.equal(env['CONTENT_SOURCE'], 'api');
  assert.equal(env['BUILD_MODE'], 'release');
  assert.equal(env['NG_BUILD_MAX_WORKERS'], '2');
  assert.equal(env['PATH'], 'runtime-path');
  for (const key of ['PRIVATE_CANARY', 'DB_PASSWORD_API_RO', 'NODE_OPTIONS'])
    assert.equal(env[key], undefined);
});

test('release invalidates prior report, stages build, verifies twice and reports only success', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-release-flow-'));
  try {
    const folder = join(root, 'apps/api/drizzle');
    await mkdir(join(folder, 'meta'), { recursive: true });
    await writeFile(
      join(folder, 'meta/_journal.json'),
      JSON.stringify({ entries: [{ idx: 0, tag: '0000_first' }] }),
    );
    await writeFile(join(folder, '0000_first.sql'), 'SELECT 1;');
    await mkdir(join(root, 'dist'));
    const report = join(root, 'dist/build-info.json');
    await writeFile(report, '{"source":"api"}');
    let builds = 0;
    let probes = 0;
    const migration = await expectedMigration(root);
    const request: typeof fetch = async () => {
      probes++;
      return new Response('{"status":"ready"}', { headers: { 'X-Content-Migration': migration } });
    };
    const build = async (output: string) => {
      builds++;
      await assert.rejects(access(report));
      await mkdir(join(output, 'browser'), { recursive: true });
      await writeFile(
        join(output, 'browser/index.html'),
        await readFile(new URL('./fixtures/static-home.html', import.meta.url), 'utf8'),
      );
      for (const name of ['main.js', 'home.js'])
        await writeFile(join(output, 'browser', name), 'console.log(1);');
      await writeFile(
        join(output, 'stats.json'),
        JSON.stringify({
          outputs: {
            'main.js': { imports: [] },
            'home.js': { imports: [], entryPoint: 'src/app/features/home/home.page.ts' },
          },
        }),
      );
    };
    for (const env of [
      {},
      { CONTENT_SOURCE: 'fixture' },
      { CONTENT_SOURCE: 'api', INCLUDE_DRAFTS: 'true' },
    ]) {
      await assert.rejects(runRelease(root, env, { build, request }));
      await assert.rejects(access(report));
    }
    assert.equal(builds, 0);
    const info = await runRelease(root, { CONTENT_SOURCE: 'api' }, { build, request });
    assert.equal(info.source, 'api');
    assert.equal(probes, 2);
    assert.deepEqual(JSON.parse(await readFile(report, 'utf8')), info);
    assertStaticHome(
      await readFile(join(root, 'dist/grim-dawn-builds/browser/index.html'), 'utf8'),
    );
    const sentinel = `gd-release-canary-${Date.now()}`;
    await assert.rejects(
      runRelease(
        root,
        { CONTENT_SOURCE: 'api', CI_TOKEN: sentinel },
        {
          request,
          build: async (output) => {
            await build(output);
            await writeFile(
              join(output, 'browser/leaked.bin'),
              Buffer.concat([Buffer.from([0]), Buffer.from(sentinel)]),
            );
          },
        },
      ),
      /public-build: sensitive-value/,
    );
    await assert.rejects(access(report));
    let driftProbes = 0;
    await assert.rejects(
      runRelease(
        root,
        { CONTENT_SOURCE: 'api', CI_TOKEN: sentinel },
        {
          request,
          build: async (output) => {
            await build(output);
            const page = join(output, 'browser/index.html');
            await writeFile(
              page,
              (await readFile(page, 'utf8')).replace('discarded public snapshot', sentinel),
            );
          },
        },
      ),
      /public-build: sensitive-value/,
    );
    await assert.rejects(access(report));
    await assert.rejects(
      runRelease(
        root,
        { CONTENT_SOURCE: 'api' },
        {
          build,
          request: async () =>
            new Response('{"status":"ready"}', {
              headers: {
                'X-Content-Migration': ++driftProbes === 1 ? migration : 'b'.repeat(64),
              },
            }),
        },
      ),
    );
    assert.equal(driftProbes, 2);
    await assert.rejects(access(report));
    await assert.rejects(
      runRelease(
        root,
        { CONTENT_SOURCE: 'api' },
        {
          build: async () => {
            throw new Error('private build details');
          },
          request,
        },
      ),
    );
    await assert.rejects(access(report));
    await assert.rejects(
      runRelease(
        root,
        { CONTENT_SOURCE: 'api' },
        {
          build,
          request: async () => {
            throw new Error('private network');
          },
        },
      ),
    );
    await assert.rejects(access(report));
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-release-'));
    await rm(root, { recursive: true, force: true });
  }
});
