import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { emitPortraits } from './emit-portraits.mts';

const WEB_ROOT = resolve(import.meta.dirname, '..');

async function artifact(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'emit-portraits-'));
  for (const dir of ['browser/assets', 'browser/es/assets', 'browser/404'])
    await mkdir(join(root, dir), { recursive: true });
  return root;
}

const portraits = async (root: string, locale = ''): Promise<string[]> =>
  readdir(join(root, 'browser', locale, 'assets', 'portraits')).then((names) => names.sort());

test('S-001: the angular asset glob ignores the game portraits and development keeps them', async () => {
  const config = JSON.parse(await readFile(join(WEB_ROOT, 'angular.json'), 'utf8'));
  const project = config.projects['grim-dawn-builds'].architect.build;
  const publicGlob = project.options.assets.find(
    (asset: { input?: string }) => asset.input === 'public',
  );
  assert.deepEqual(publicGlob.ignore, ['assets/portraits/**']);
  // `ng serve` / `ng build --watch` are never published: they keep serving the folder.
  const development = project.configurations.development.assets.find(
    (asset: { input?: string }) => asset.input === 'public',
  );
  assert.equal(development.ignore, undefined);
});

test('with game the PNGs are copied to the artifact of every locale', async () => {
  const root = await artifact();
  try {
    const written = await emitPortraits(WEB_ROOT, root, 'game');
    assert.equal(written.length, 6);
    assert.ok(written.every((name) => name.endsWith('.png')));
    assert.deepEqual(await portraits(root), written);
    assert.deepEqual(await portraits(root, 'es'), written);
    await assert.rejects(readdir(join(root, 'browser', '404', 'assets')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('with own no PNG ends up in the artifact, and a stale folder is removed', async () => {
  const root = await artifact();
  try {
    await emitPortraits(WEB_ROOT, root, 'game');
    assert.deepEqual(await emitPortraits(WEB_ROOT, root, 'own'), []);
    for (const locale of ['', 'es'])
      await assert.rejects(readdir(join(root, 'browser', locale, 'assets', 'portraits')), {
        code: 'ENOENT',
      });
    await writeFile(join(root, 'browser', 'assets', 'keep.txt'), 'x');
    await emitPortraits(WEB_ROOT, root, 'own');
    assert.equal(await readFile(join(root, 'browser', 'assets', 'keep.txt'), 'utf8'), 'x');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails closed on an invalid source or a missing artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'emit-portraits-'));
  try {
    await assert.rejects(emitPortraits(WEB_ROOT, root, 'game'), /portraits/);
    await mkdir(join(root, 'browser'));
    await assert.rejects(emitPortraits(WEB_ROOT, root, 'both' as 'own'), /portraits/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
