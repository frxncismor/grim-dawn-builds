import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkAssets } from './check-assets.mts';

const PNG = Buffer.from('not-really-a-png');
const SHA = createHash('sha256').update(PNG).digest('hex');
const FILE = 'public/assets/portraits/soldier.png';

const entry = (over: Record<string, unknown> = {}) => ({
  slug: 'soldier',
  status: 'approved',
  file_path: FILE,
  origin_url: 'https://store.steampowered.com/app/219990/Grim_Dawn/',
  rights_holder: 'Crate Entertainment',
  license_or_permission: 'tolerancia_de_facto_sin_permiso',
  proof_ref: 'specs/003-catalogo-arboles-maestria/research.md#t029',
  recorded_on: '2026-11-13',
  fallback_svg: 'src/assets/icons/mastery-soldado.svg',
  provenance: {
    game_version: 'steam-build-1',
    source_path: 'ui/x.tex',
    sha256: SHA,
    width: 197,
    height: 41,
  },
  ...over,
});

function repo(manifest: unknown, withFile = true): string {
  const root = mkdtempSync(join(tmpdir(), 'gd-assets-'));
  const put = (path: string, data: string | Buffer) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), data);
  };
  put('fixtures/content/assets/manifest.json', JSON.stringify(manifest));
  if (withFile) put(`apps/web/${FILE}`, PNG);
  return root;
}

function check(manifest: unknown, withFile = true) {
  const root = repo(manifest, withFile);
  try {
    return checkAssets(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a valid portrait entry with a matching file passes', () => {
  assert.deepEqual(check({ assets: [entry()] }), { count: 1, issues: [] });
});

test('a file that differs from the recorded sha256 fails', () => {
  const bad = entry({ provenance: { ...entry().provenance, sha256: 'a'.repeat(64) } });
  assert.match(check({ assets: [bad] }).issues[0]?.message ?? '', /sha256/);
});

test('an approved entry without its file fails', () => {
  assert.equal(check({ assets: [entry()] }, false).issues.length, 1);
});

test('a portrait file with no manifest entry fails', () => {
  assert.equal(check({ assets: [] }).issues.length, 1);
});

test('an approved entry missing provenance fields fails', () => {
  assert.ok(check({ assets: [entry({ license_or_permission: null })] }).issues.length > 0);
});

test('an unreadable or malformed manifest fails', () => {
  assert.equal(check('nope').issues.length, 1);
  assert.equal(check({ assets: 'x' }).issues.length, 1);
});

test('a withdrawn entry with its file deleted passes; keeping the file fails', () => {
  const withdrawn = entry({ status: 'withdrawn', file_path: null });
  assert.deepEqual(check({ assets: [withdrawn] }, false).issues, []);
  assert.ok(check({ assets: [withdrawn] }, true).issues.length > 0);
});
