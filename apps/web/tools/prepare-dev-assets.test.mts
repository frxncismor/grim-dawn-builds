import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEV_ASSETS_DIR, prepareDevAssets } from './prepare-dev-assets.mts';

const WEB = resolve(import.meta.dirname, '..');
const REPO = resolve(WEB, '..', '..');

test('spec009 T001: el arranque de desarrollo genera deferred.css y los árboles canónicos en una carpeta propia', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-assets-'));
  try {
    const served = await prepareDevAssets(WEB, REPO, root);
    assert.equal(served, join(root, 'browser'));
    const css = await readFile(join(served, 'assets', 'deferred.css'), 'utf8');
    assert.match(css, /\.skill-tree__node--assigned/);
    assert.match(css, /\.devotion-map__svg/);
    const trees = await readdir(join(served, 'assets', 'mastery-trees'));
    assert.ok(trees.includes('index.json'));
    assert.ok(trees.includes('shaman.json'));
    const index = JSON.parse(
      await readFile(join(served, 'assets', 'mastery-trees', 'index.json'), 'utf8'),
    );
    assert.ok(Object.keys(index).length >= 6);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('spec009 T001: la configuración development sirve la carpeta generada como assets y `start` la prepara antes', async () => {
  const angular = JSON.parse(await readFile(join(WEB, 'angular.json'), 'utf8'));
  const dev =
    angular.projects[Object.keys(angular.projects)[0]!].architect.build.configurations.development;
  const inputs = dev.assets.map((asset: { input?: string }) => asset.input);
  assert.ok(
    inputs.includes(`${DEV_ASSETS_DIR}/browser`),
    `assets de development: ${inputs.join(', ')}`,
  );
  const pkg = JSON.parse(await readFile(join(REPO, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.start, /prepare-dev-assets\.mts.*&&.*start/);
  assert.match(pkg.scripts.watch, /prepare-dev-assets\.mts.*&&.*watch/);
});

test('spec009 T001: la carpeta generada está ignorada por git (nada generado se versiona)', () => {
  const out = execFileSync(
    'git',
    ['check-ignore', '-v', `apps/web/${DEV_ASSETS_DIR}/browser/assets/deferred.css`],
    {
      cwd: REPO,
      encoding: 'utf8',
    },
  );
  assert.match(out, /\.gitignore/);
});
