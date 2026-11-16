import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { assertAssetStatusParity, checkAssets } from './check-assets.mts';

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

// T005 (A-03): one source of truth for an asset's status — the repository manifest rules.
test('assertAssetStatusParity: passes when the table and the manifest agree on what is public', () => {
  const root = repo({
    assets: [
      entry({ slug: 'mastery-soldier' }),
      entry({ slug: 'mastery-oathkeeper', status: 'withdrawn' }),
    ],
  });
  try {
    assert.doesNotThrow(() => assertAssetStatusParity(root, [{ slug: 'mastery-soldier' }]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertAssetStatusParity: fails closed naming the asset and both states when they disagree', () => {
  const root = repo({
    assets: [
      entry({ slug: 'mastery-soldier', status: 'withdrawn' }),
      entry({ slug: 'mastery-shaman' }),
    ],
  });
  try {
    // Table still publishes a withdrawn asset; manifest approves one the table does not publish.
    assert.throws(
      () => assertAssetStatusParity(root, [{ slug: 'mastery-soldier' }]),
      (error: Error) =>
        /mastery-soldier/.test(error.message) &&
        /tabla assets: approved/.test(error.message) &&
        /manifiesto: withdrawn/.test(error.message) &&
        /mastery-shaman/.test(error.message) &&
        /tabla assets: no publicado/.test(error.message) &&
        /manifiesto: approved/.test(error.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertAssetStatusParity: an asset public in the table but absent from the manifest is a discrepancy', () => {
  const root = repo({ assets: [entry({ slug: 'mastery-soldier' })] });
  try {
    assert.throws(
      () => assertAssetStatusParity(root, [{ slug: 'mastery-soldier' }, { slug: 'mastery-ghost' }]),
      /mastery-ghost.*tabla assets: approved.*manifiesto: ausente/s,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
