import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  createPortraitResolver,
  resolveMasteryPortrait,
  withCatalogPortraits,
  withCatalogTrees,
} from './portraits.server.ts';
import { parseAssetSource } from './portraits.ts';

const REAL_ROOT = 'fixtures/content';
const SLUGS = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'];
const ICON = {
  arcanist: 'arcanista',
  demolition: 'demoledor',
  nightblade: 'filo-nocturno',
  occult: 'ocultista',
  shaman: 'chaman',
  soldier: 'soldado',
};

const entry = (slug: string, over: Record<string, unknown> = {}) => ({
  slug: `mastery-${slug}`,
  status: 'approved',
  file_path: `public/assets/portraits/${slug}.png`,
  origin_url: 'https://store.steampowered.com/app/219990/Grim_Dawn/',
  rights_holder: 'Crate Entertainment',
  license_or_permission: 'tolerancia_de_facto_sin_permiso',
  proof_ref: 'specs/003-catalogo-arboles-maestria/research.md#t029',
  recorded_on: '2026-11-13',
  fallback_svg: `src/assets/icons/mastery-${ICON[slug as keyof typeof ICON]}.svg`,
  provenance: {
    game_version: 'v',
    source_path: 'ui/x.tex',
    sha256: 'a'.repeat(64),
    width: 197,
    height: 41,
  },
  ...over,
});
const manifest = (over: Record<string, Record<string, unknown>> = {}) => ({
  assets: SLUGS.map((slug) => entry(slug, over[slug])),
});
async function rootWith(content: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gd-portraits-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets', 'manifest.json'), JSON.stringify(content));
  return root;
}

test('parseAssetSource defaults to own and rejects anything but own|game', () => {
  assert.equal(parseAssetSource(undefined), 'own');
  assert.equal(parseAssetSource('own'), 'own');
  assert.equal(parseAssetSource('game'), 'game');
  for (const bad of ['', 'GAME', 'both', ' game'])
    assert.throws(() => parseAssetSource(bad), /ASSET_SOURCE/);
});

test('own: the six masteries use their own icon, even with approved game entries', () => {
  for (const slug of SLUGS) {
    const p = resolveMasteryPortrait(slug, 'own', manifest().assets);
    assert.deepEqual(p, {
      source: 'own',
      src: `assets/icons/mastery-${ICON[slug as keyof typeof ICON]}.svg`,
      width: 32,
      height: 32,
    });
  }
});

test('game: an approved entry yields the PNG with its real 197x41 size', () => {
  const p = resolveMasteryPortrait('soldier', 'game', manifest().assets);
  assert.deepEqual(p, {
    source: 'game',
    src: 'assets/portraits/soldier.png',
    width: 197,
    height: 41,
  });
});

test('game: withdrawn, pending, rejected, missing or other-license entries fall back', () => {
  const own = { source: 'own', src: 'assets/icons/mastery-soldado.svg', width: 32, height: 32 };
  for (const over of [
    { status: 'withdrawn', file_path: null },
    { status: 'pending', file_path: null },
    { status: 'rejected', file_path: null },
  ])
    assert.deepEqual(resolveMasteryPortrait('soldier', 'game', [entry('soldier', over)]), own);
  assert.deepEqual(resolveMasteryPortrait('soldier', 'game', []), own);
  assert.deepEqual(
    resolveMasteryPortrait('soldier', 'game', [
      entry('soldier', { license_or_permission: 'Permiso escrito' }),
    ]),
    own,
  );
});

test('game: an approved entry without a valid fallback fails closed', () => {
  for (const fallback_svg of ['', 'src/assets/icons/nope.svg', 'otra-cosa'])
    assert.throws(
      () => resolveMasteryPortrait('soldier', 'game', [entry('soldier', { fallback_svg })]),
      /fallback|no válida/i,
    );
});

test('game: an approved entry that is malformed or points outside portraits/ fails closed', () => {
  assert.throws(() =>
    resolveMasteryPortrait('soldier', 'game', [entry('soldier', { origin_url: null })]),
  );
  assert.throws(() =>
    resolveMasteryPortrait('soldier', 'game', [
      entry('soldier', { file_path: 'public/assets/official/soldier.png' }),
    ]),
  );
});

test('resolver reads the committed manifest: own by default, six PNGs with game', async () => {
  const own = await createPortraitResolver(REAL_ROOT, {});
  const game = await createPortraitResolver(REAL_ROOT, { ASSET_SOURCE: 'game' });
  for (const slug of SLUGS) {
    assert.equal(own(slug).source, 'own');
    assert.deepEqual(game(slug), {
      source: 'game',
      src: `assets/portraits/${slug}.png`,
      width: 197,
      height: 41,
    });
  }
});

test('resolver fails closed on an invalid ASSET_SOURCE or an unreadable manifest with game', async () => {
  await assert.rejects(createPortraitResolver(REAL_ROOT, { ASSET_SOURCE: 'x' }), /ASSET_SOURCE/);
  const empty = await mkdtemp(join(tmpdir(), 'gd-portraits-'));
  await assert.rejects(createPortraitResolver(empty, { ASSET_SOURCE: 'game' }), /manifiesto/i);
  const own = await createPortraitResolver(empty, {});
  assert.equal(own('soldier').source, 'own');
  const bad = await rootWith({ assets: 'x' });
  await assert.rejects(createPortraitResolver(bad, { ASSET_SOURCE: 'game' }), /manifiesto/i);
});

test('resolver with game and a withdrawn entry serves the own icon', async () => {
  const root = await rootWith(manifest({ soldier: { status: 'withdrawn', file_path: null } }));
  const game = await createPortraitResolver(root, { ASSET_SOURCE: 'game' });
  assert.equal(game('soldier').source, 'own');
  assert.equal(game('shaman').source, 'game');
});

test('spec004 T042: catalog masteries get the portrait of their tree, the rest none', async () => {
  const catalog = {
    masteries: [
      { slug: 'chaman', name_es: 'Chamán', name_en: 'Shaman' },
      { slug: 'demoledor', name_es: 'Demoledor', name_en: 'Demolitionist' },
      { slug: 'berserker', name_es: 'Berserker', name_en: 'Berserker' },
    ],
  };
  const game = await createPortraitResolver(await rootWith(manifest()), { ASSET_SOURCE: 'game' });
  const [chaman, demoledor, berserker] = withCatalogPortraits(catalog, game).masteries;
  assert.deepEqual(chaman?.portrait, {
    source: 'game',
    src: 'assets/portraits/shaman.png',
    width: 197,
    height: 41,
  });
  assert.equal(demoledor?.portrait?.src, 'assets/portraits/demolition.png');
  assert.equal('portrait' in (berserker ?? {}), false, 'a mastery with no tree stays generic');
  const own = await createPortraitResolver('unused', { ASSET_SOURCE: 'own' });
  assert.equal(
    withCatalogPortraits(catalog, own).masteries[0]?.portrait?.src,
    'assets/icons/mastery-chaman.svg',
  );
  assert.equal(withCatalogPortraits(catalog, own).masteries[0]?.portrait?.source, 'own');
});

test('every mastery tree of the catalog is joined to a catalog mastery by TREE_SLUG (T050, A-02/B-003)', async () => {
  const masteries = JSON.parse(await readFile(join(REAL_ROOT, 'masteries.json'), 'utf8')) as {
    slug: string;
  }[];
  const trees = (await readdir(join(REAL_ROOT, 'mastery-trees')))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
  assert.ok(trees.length > 0, 'no mastery trees in the catalog');
  const asked: string[] = [];
  const joined = withCatalogPortraits({ masteries }, (tree) => {
    asked.push(tree);
    return { source: 'own', src: `assets/icons/${tree}.svg`, width: 32, height: 32 };
  }).masteries as { slug: string; portrait?: { src: string } }[];
  // A tree with no entry in TREE_SLUG would never be asked for: its mastery card would silently
  // fall back to the generic icon. Each tree must be reached exactly once, by one catalog mastery.
  assert.deepEqual(
    asked.sort(),
    trees,
    'a tree has no TREE_SLUG entry (or an entry points to a missing tree)',
  );
  assert.equal(joined.filter((m) => m.portrait).length, trees.length);
});

test('spec005 T033: a catalog mastery whose tree is not in the data is flagged noTree, the rest are untouched', async () => {
  const masteries = JSON.parse(await readFile(join(REAL_ROOT, 'masteries.json'), 'utf8')) as {
    slug: string;
  }[];
  const trees = new Set(
    (await readdir(join(REAL_ROOT, 'mastery-trees')))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length)),
  );
  const joined = withCatalogTrees({ masteries }, trees).masteries as {
    slug: string;
    noTree?: true;
  }[];
  assert.deepEqual(
    joined
      .filter((m) => m.noTree)
      .map((m) => m.slug)
      .sort(),
    ['berserker', 'guardian-del-juramento', 'inquisidor', 'nigromante'],
  );
  assert.equal(joined.filter((m) => !m.noTree).length, trees.size);
  // The criterion comes from the data: with one tree fewer, its mastery loses the link too.
  const fewer = new Set([...trees].filter((t) => t !== 'soldier'));
  const slugs = (
    withCatalogTrees({ masteries }, fewer).masteries as { slug: string; noTree?: true }[]
  )
    .filter((m) => m.noTree)
    .map((m) => m.slug);
  assert.ok(slugs.includes('soldado'));
});
