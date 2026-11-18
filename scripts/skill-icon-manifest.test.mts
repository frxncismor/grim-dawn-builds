import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkAssetManifest } from '@gd/domain';
import { checkAssets } from './check-assets.mts';

/**
 * spec004 T027 (constitution 1.11.0 §VII, research.md §R10): the derived skill icons are versioned
 * with exactly one approved manifest entry per icon. The tests read the repository as it is.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, 'apps/web/public/assets/skill-icons');
const TREES = join(ROOT, 'fixtures/content/mastery-trees');
const SPRITE = readFileSync(join(ROOT, 'apps/web/public/assets/ui/skill-icons.svg'), 'utf8');

interface Entry {
  slug: string;
  status: string;
  file_path: string | null;
  origin_url: string | null;
  rights_holder: string | null;
  license_or_permission: string | null;
  proof_ref: string | null;
  fallback_svg: string;
  provenance?: {
    game_version: string;
    source_path: string;
    sha256: string;
    width: number;
    height: number;
  };
}

const manifest = JSON.parse(
  readFileSync(join(ROOT, 'fixtures/content/assets/manifest.json'), 'utf8'),
) as { assets: Entry[] };
const iconEntries = manifest.assets.filter((a) => /^ic-[0-9a-f]{16}$/.test(a.slug));

/** Own symbol of a node (T024, T045): always the one of its type; scripts cannot import the web zone. */
const skillSymbol = (node: { kind: string }): string => `skill-${node.kind}`;

/** icon_id -> own symbol expected from the nodes that use it (kind and circular marker). */
function expectedSymbols(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const name of readdirSync(TREES).filter((n) => n.endsWith('.json'))) {
    const tree = JSON.parse(readFileSync(join(TREES, name), 'utf8')) as {
      nodes: {
        icon_id: string;
        kind: 'active' | 'passive' | 'modifier' | 'transmuter';
        circular: boolean;
      }[];
    };
    for (const node of tree.nodes) {
      const set = out.get(node.icon_id) ?? new Set<string>();
      set.add(skillSymbol(node));
      out.set(node.icon_id, set);
    }
  }
  return out;
}

test('one approved entry per icon of the catalog, and no other icon entry', () => {
  const expected = expectedSymbols();
  assert.equal(expected.size, 164);
  assert.deepEqual(iconEntries.map((e) => e.slug).sort(), [...expected.keys()].sort());
  for (const entry of iconEntries) assert.equal(entry.status, 'approved', entry.slug);
});

test('every entry carries the common condition of section VII and a real own fallback', () => {
  const expected = expectedSymbols();
  for (const entry of iconEntries) {
    assert.equal(entry.rights_holder, 'Crate Entertainment', entry.slug);
    assert.equal(entry.license_or_permission, 'tolerancia_de_facto_sin_permiso', entry.slug);
    assert.equal(entry.proof_ref, 'specs/004-rediseno-ui-grim-dawn/research.md#r10', entry.slug);
    assert.match(entry.origin_url ?? '', /^https:\/\//, entry.slug);
    assert.equal(entry.file_path, `public/assets/skill-icons/${entry.slug}.png`, entry.slug);
    const [symbol] = [...(expected.get(entry.slug) ?? [])];
    assert.equal(entry.fallback_svg, `public/assets/ui/skill-icons.svg#${symbol}`, entry.slug);
    assert.ok(SPRITE.includes(`id="${symbol}"`), `${entry.slug}: ${symbol} not in the sprite`);
    assert.equal(expected.get(entry.slug)?.size, 1, `${entry.slug}: kinds disagree`);
  }
});

test('each PNG is on disk, unmodified (sha256 of the manifest) and 32 x 32', () => {
  const files = readdirSync(ICONS_DIR).filter((n) => n.endsWith('.png'));
  assert.equal(files.length, 164);
  for (const entry of iconEntries) {
    const path = join(ICONS_DIR, `${entry.slug}.png`);
    assert.ok(existsSync(path), `${entry.slug}.png missing`);
    const bytes = readFileSync(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.provenance?.sha256);
    assert.equal(bytes.readUInt32BE(16), 32, `${entry.slug} width`);
    assert.equal(bytes.readUInt32BE(20), 32, `${entry.slug} height`);
  }
});

test('assets:check on the repository finds no issue', () => {
  assert.deepEqual(checkAssets(ROOT).issues, []);
});

test('the check fails with an invalid entry or an unlisted file', () => {
  const first = iconEntries[0]!;
  const file = first.file_path!;
  const bad = (over: Partial<Entry>) =>
    checkAssetManifest({ assets: [{ ...first, ...over }] }, [file], {
      [file]: first.provenance!.sha256,
    });
  assert.deepEqual(bad({}), []);
  assert.notDeepEqual(bad({ license_or_permission: 'libre' }), []);
  assert.notDeepEqual(
    bad({ proof_ref: 'specs/003-catalogo-arboles-maestria/research.md#t029' }),
    [],
  );
  assert.notDeepEqual(bad({ fallback_svg: '' }), []);
  assert.notDeepEqual(bad({ file_path: 'public/assets/skill-icons/ic-0000000000000000.png' }), []);
  assert.notDeepEqual(
    checkAssetManifest({ assets: [first] }, [file], { [file]: 'f'.repeat(64) }),
    [],
  );
  assert.notDeepEqual(checkAssetManifest({ assets: [] }, [file]), []);
});

test('the Angular build never copies the game skill icons from public/ (SC-009)', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'apps/web/angular.json'), 'utf8')) as unknown;
  const globs: { input?: string; ignore?: string[] }[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (object['input'] === 'public') globs.push(object as { input?: string; ignore?: string[] });
      Object.values(object).forEach(visit);
    }
  };
  visit(config);
  // Every glob that keeps the portraits out of the build (production and the preview builds) must
  // keep the skill icons out too; the development configuration serves both, like the portraits.
  const guarded = globs.filter((glob) => glob.ignore?.includes('assets/portraits/**'));
  assert.ok(guarded.length >= 2);
  for (const glob of guarded)
    assert.ok(glob.ignore?.includes('assets/skill-icons/**'), JSON.stringify(glob));
});
