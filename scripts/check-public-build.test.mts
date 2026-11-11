import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assertPublicBuild,
  createCanaryEnvironment,
  sensitiveValues,
  runPublicBuildCheck,
} from './check-public-build.mts';
import { createPublicBuildEnv } from './public-build-env.mts';

const canary = () => `gd-canary-${randomBytes(20).toString('hex')}`;
const clean = async (root: string) => {
  assert.equal(dirname(root), tmpdir());
  assert.ok(basename(root).startsWith('gd-public-'));
  await rm(root, { recursive: true, force: true });
};

test('public modes reject executable/private overrides and preserve only public configuration', () => {
  const privateValue = canary();
  const env = createCanaryEnvironment({
    PRIVATE_PASSWORD: privateValue,
    UNKNOWN_TOKEN: privateValue,
    DB_PASSWORD_API_RO_FILE: '/private/local/file',
    BASE_URL: 'https://example.test',
    NODE_OPTIONS: '--inspect',
  });
  assert.ok(sensitiveValues(env).includes(privateValue));
  assert.ok(sensitiveValues(env).includes('/private/local/file'));
  for (const mode of ['fixture', 'release'] as const) {
    const child = createPublicBuildEnv(env, mode);
    assert.equal(child['CONTENT_SOURCE'], mode === 'fixture' ? 'fixture' : 'api');
    assert.equal(child['BUILD_MODE'], mode === 'fixture' ? 'local' : 'release');
    assert.equal(child['INCLUDE_DRAFTS'], 'false');
    assert.equal(child['BASE_URL'], 'https://example.test');
    for (const [key, value] of Object.entries(env))
      if (key.includes('PASSWORD') || key.includes('TOKEN') || key.includes('KEY')) {
        assert.equal(child[key], undefined);
        if (value) assert.ok(!Object.values(child).includes(value));
      }
    assert.equal(child['NODE_OPTIONS'], undefined);
  }
  assert.throws(() => createPublicBuildEnv({ BASE_URL: 'file:///private' }, 'fixture'));
});

test('artifact guard finds sentinel bytes in bundles, maps, binary data and filenames without exposing them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-public-scan-'));
  const secret = canary();
  try {
    await writeFile(join(root, 'index.html'), '<p>Contenido público</p>');
    assert.equal((await assertPublicBuild(root, [secret])).files, 1);
    for (const [name, data] of [
      ['main.js', `const data=${JSON.stringify(secret)}`],
      ['main.js.map', JSON.stringify({ source: secret })],
      ['font.woff2', Buffer.concat([Buffer.from([0, 1]), Buffer.from(secret)])],
      [secret, 'innocent'],
    ] as const) {
      await writeFile(join(root, name), data);
      await assert.rejects(
        assertPublicBuild(root, [secret]),
        (error: Error) =>
          error.message === 'public-build: sensitive-value' &&
          error.cause === undefined &&
          !JSON.stringify(error).includes(secret),
      );
      await rm(join(root, name));
    }
    for (const encoded of [
      JSON.stringify(secret + '"').slice(1, -1),
      Buffer.from(secret).toString('base64'),
      Buffer.from(secret, 'utf16le'),
    ]) {
      await writeFile(join(root, 'encoded.bin'), encoded);
      await assert.rejects(
        assertPublicBuild(root, [
          typeof encoded === 'string' && encoded.includes('\\"') ? secret + '"' : secret,
        ]),
      );
    }
  } finally {
    await clean(root);
  }
});

test('guard checks report text, provider patterns, empty output and symlinks without a path exclusion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-public-extra-'));
  const secret = canary();
  try {
    await assert.rejects(assertPublicBuild(root, [secret]));
    await writeFile(join(root, 'index.html'), '<p>Seguro</p>');
    await assert.rejects(
      assertPublicBuild(root, [secret], [JSON.stringify({ source: 'api', token: secret })]),
    );
    const synthetic = ['gh', 'p_', 'a'.repeat(36)].join('');
    await writeFile(join(root, 'README.md'), synthetic);
    await assert.rejects(assertPublicBuild(root, []), /secret-pattern/);
    await rm(join(root, 'README.md'));
    await symlink(root, join(root, 'loop'), 'junction');
    await assert.rejects(assertPublicBuild(root, []), /unsafe-artifact/);
  } finally {
    await clean(root);
  }
});

test('public canary workflow uses isolated output and removes it after success or rejection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-public-flow-'));
  try {
    let calls = 0;
    await runPublicBuildCheck(
      root,
      { UNKNOWN_SECRET: canary() },
      {
        build: async (output, env) => {
          calls++;
          assert.equal(env['UNKNOWN_SECRET'], undefined);
          assert.equal(env['CONTENT_SOURCE'], 'fixture');
          await writeFile(join(output, 'index.html'), '<p>Público</p>');
        },
      },
    );
    assert.equal(calls, 1);
    assert.deepEqual(await readdir(join(root, 'dist')), []);
    await assert.rejects(
      runPublicBuildCheck(
        root,
        {},
        {
          build: async () => {
            throw new Error('PRIVATE-CANARY');
          },
        },
      ),
      (error: Error) => !error.message.includes('PRIVATE-CANARY'),
    );
    assert.deepEqual(await readdir(join(root, 'dist')), []);
    await mkdir(join(root, 'dist'), { recursive: true });
    const sentinel = canary();
    await writeFile(join(root, 'dist/build-info.json'), JSON.stringify({ token: sentinel }));
    await assert.rejects(
      runPublicBuildCheck(
        root,
        { CI_TOKEN: sentinel },
        {
          build: async (output) => {
            await writeFile(join(output, 'index.html'), '<p>Público</p>');
          },
        },
      ),
    );
    await rm(join(root, 'dist/build-info.json'));
    await writeFile(join(root, 'dist/residual.bin'), Buffer.from(sentinel));
    await assert.rejects(
      runPublicBuildCheck(
        root,
        { CI_TOKEN: sentinel },
        {
          build: async (output) => {
            await writeFile(join(output, 'index.html'), '<p>Público</p>');
          },
        },
      ),
      /sensitive-value/,
    );
  } finally {
    await clean(root);
  }
});
