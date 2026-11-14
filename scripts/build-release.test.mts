import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { publicBuildEnv, runRelease } from './build-release.mts';
import { expectedMigration } from './check-release.mts';
import { assertStaticHome } from './static-home.mts';

/** Minimal repo layout where every mastery has an approved, hash-matching portrait. */
async function seedGameAssets(root: string, over: Record<string, unknown> = {}): Promise<void> {
  const png = Buffer.from('png-bytes');
  const sha256 = createHash('sha256').update(png).digest('hex');
  await mkdir(join(root, 'fixtures/content/mastery-trees'), { recursive: true });
  await writeFile(join(root, 'fixtures/content/mastery-trees/soldier.json'), '{}');
  await mkdir(join(root, 'fixtures/content/assets'), { recursive: true });
  await mkdir(join(root, 'apps/web/public/assets/portraits'), { recursive: true });
  await writeFile(join(root, 'apps/web/public/assets/portraits/soldier.png'), png);
  await writeFile(
    join(root, 'fixtures/content/assets/manifest.json'),
    JSON.stringify({
      assets: [
        {
          slug: 'mastery-soldier',
          status: 'approved',
          file_path: 'public/assets/portraits/soldier.png',
          origin_url: 'https://store.steampowered.com/app/219990/Grim_Dawn/',
          rights_holder: 'Crate Entertainment',
          license_or_permission: 'tolerancia_de_facto_sin_permiso',
          proof_ref: 'specs/003-catalogo-arboles-maestria/research.md#t029',
          recorded_on: '2026-11-13',
          fallback_svg: 'src/assets/icons/mastery-soldado.svg',
          provenance: {
            game_version: 'v',
            source_path: 'ui/x.tex',
            sha256,
            width: 197,
            height: 41,
          },
          ...over,
        },
      ],
    }),
  );
}

test('release defaults to ASSET_SOURCE=game; only an explicit own (withdrawal) overrides it', () => {
  assert.equal(publicBuildEnv({ CONTENT_SOURCE: 'api' })['ASSET_SOURCE'], 'game');
  assert.equal(
    publicBuildEnv({ CONTENT_SOURCE: 'api', ASSET_SOURCE: 'game' })['ASSET_SOURCE'],
    'game',
  );
  assert.equal(
    publicBuildEnv({ CONTENT_SOURCE: 'api', ASSET_SOURCE: 'own' })['ASSET_SOURCE'],
    'own',
  );
  assert.throws(() => publicBuildEnv({ CONTENT_SOURCE: 'api', ASSET_SOURCE: 'both' }));
});

test('release builds with ASSET_SOURCE=game and fails closed when the manifest does not allow it', async () => {
  const stub =
    (seen: Record<string, string>[]) => async (_output: string, env: Record<string, string>) => {
      seen.push(env);
      throw new Error('stop after recording the build environment');
    };
  const run = async (prepare: (root: string) => Promise<void>, env = {}) => {
    const root = await mkdtemp(join(tmpdir(), 'gd-release-assets-'));
    const seen: Record<string, string>[] = [];
    try {
      await mkdir(join(root, 'apps/api/drizzle/meta'), { recursive: true });
      await writeFile(
        join(root, 'apps/api/drizzle/meta/_journal.json'),
        JSON.stringify({ entries: [{ idx: 0, tag: '0000_first' }] }),
      );
      await writeFile(join(root, 'apps/api/drizzle/0000_first.sql'), 'SELECT 1;');
      await prepare(root);
      const migration = await expectedMigration(root);
      const request: typeof fetch = async () =>
        new Response('{"status":"ready"}', { headers: { 'X-Content-Migration': migration } });
      await assert.rejects(
        runRelease(root, { CONTENT_SOURCE: 'api', ...env }, { build: stub(seen), request }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    return seen;
  };
  const ok = await run((root) => seedGameAssets(root));
  assert.equal(ok.length, 1);
  assert.equal(ok[0]?.['ASSET_SOURCE'], 'game');
  // No usable manifest, withdrawn entry, other license or tampered file: the build never starts.
  assert.equal((await run(async () => {})).length, 0);
  assert.equal(
    (await run((r) => seedGameAssets(r, { status: 'withdrawn', file_path: null }))).length,
    0,
  );
  assert.equal(
    (await run((r) => seedGameAssets(r, { license_or_permission: 'Permiso' }))).length,
    0,
  );
  assert.equal(
    (
      await run((r) =>
        seedGameAssets(r, {
          provenance: {
            game_version: 'v',
            source_path: 'x',
            sha256: 'a'.repeat(64),
            width: 197,
            height: 41,
          },
        }),
      )
    ).length,
    0,
  );
  // Explicit own (the documented withdrawal switch) needs no game art.
  assert.equal((await run(async () => {}, { ASSET_SOURCE: 'own' }))[0]?.['ASSET_SOURCE'], 'own');
});

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
    await seedGameAssets(root);
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
