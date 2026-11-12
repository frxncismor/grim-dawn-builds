import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { TierListSchema, type Author, type Source } from '@gd/domain';
import { generateCatalog } from './gen-catalog.mts';

const root = resolve(import.meta.dirname, '..');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const masteries = await readJson(join(root, 'content/masteries.json'));
const build = await readJson(join(root, 'content/builds/chaman-demoledor-golpe-primigenio.json'));
const author: Author = {
  slug: 'grim-dawn-builds',
  display_name: 'Grim Dawn Builds',
  bio: null,
  url: null,
  is_placeholder: false,
};
const source: Source = {
  slug: 'catalogo-maestrias',
  kind: 'oficial',
  title: 'Masteries',
  url: 'https://www.grimdawn.com/guide/character/masteries/',
  author_name: 'Crate Entertainment',
  license_note: 'Nombres y pertenencia al catálogo; no descripciones ni arte.',
  permission_ref: null,
  retrieved_on: '2026-11-09',
  notes: '',
};
const input = () => ({
  masteries: structuredClone(masteries),
  builds: [structuredClone(build)],
  author,
  source,
  gameVersion: '1.3.x (Fangs of Asterkarn)',
});

test('the official catalog has ten distinct masteries, including Berserker', () => {
  assert.equal(masteries.length, 10);
  assert.deepEqual(
    masteries.map((mastery: { name_en: string }) => mastery.name_en).sort(),
    [
      'Arcanist',
      'Berserker',
      'Demolitionist',
      'Inquisitor',
      'Necromancer',
      'Nightblade',
      'Oathkeeper',
      'Occultist',
      'Shaman',
      'Soldier',
    ].sort(),
  );
});

test('generation covers all 45 unordered pairs exactly once with placeholders', () => {
  const catalog = generateCatalog(input());
  assert.equal(TierListSchema.safeParse(catalog).success, true);
  assert.equal(catalog.combinations.length, 45);
  const expected = new Set<string>();
  const slugs = masteries.map((mastery: { slug: string }) => mastery.slug).sort();
  for (const a of slugs) for (const b of slugs) if (a < b) expected.add(`${a}|${b}`);
  assert.deepEqual(
    new Set(catalog.combinations.map((pair) => `${pair.mastery_a_slug}|${pair.mastery_b_slug}`)),
    expected,
  );
  const placeholders = catalog.entries.filter((entry) => entry.entry_kind === 'placeholder');
  assert.equal(placeholders.length, 45);
  assert.equal(new Set(placeholders.map((entry) => entry.combination_slug)).size, 45);
  for (const entry of placeholders) {
    assert.equal(entry.build_slug, null);
    assert.equal(entry.external_url, null);
    assert.equal(entry.tier, 'sin_clasificar');
    assert.equal(entry.content_status, 'placeholder');
    assert.equal(entry.review_state, 'publicado');
    assert.equal(entry.rights_status, 'own_original');
    assert.equal(entry.source_slug, source.slug);
  }
});

test('generation is independent of input order and does not mutate its inputs', () => {
  const original = input();
  const before = JSON.stringify(original);
  assert.deepEqual(
    generateCatalog(original),
    generateCatalog({ ...original, masteries: [...original.masteries].reverse() }),
  );
  assert.equal(JSON.stringify(original), before);
  assert.equal(
    JSON.stringify(generateCatalog(original)),
    JSON.stringify(generateCatalog(original)),
  );
});

test('the published own guide keeps its provenance and source in the generated catalog', () => {
  const catalog = generateCatalog(input());
  const entry = catalog.entries.find((entry) => entry.build_slug === build.slug)!;
  assert.equal(catalog.entries.length, 46);
  assert.equal(entry.entry_kind, 'build_propia');
  assert.equal(entry.review_state, 'publicado');
  assert.equal(entry.rights_status, 'own_original');
  assert.equal(entry.content_status, 'sin_verificar');
  assert.equal(entry.tier, 'sin_clasificar');
  assert.equal(entry.source_slug, build.sources[0].slug);
  assert.deepEqual(
    catalog.sources.find((item) => item.slug === build.sources[0].slug),
    build.sources[0],
  );
});

test('duplicates, missing combinations, placeholder authors and conflicting sources fail', () => {
  const original = input();
  assert.throws(() => generateCatalog({ ...original, masteries: [...masteries, masteries[0]] }));
  assert.throws(() => generateCatalog({ ...original, builds: [build, build] }));
  assert.throws(() =>
    generateCatalog({
      ...original,
      masteries: masteries.filter((mastery: { slug: string }) => mastery.slug !== 'demoledor'),
    }),
  );
  assert.throws(() =>
    generateCatalog({ ...original, author: { ...author, is_placeholder: true } }),
  );
  assert.throws(() =>
    generateCatalog({ ...original, source: { ...source, slug: build.sources[0].slug } }),
  );
});

test('a link_only document is not transformed into a native guide', () => {
  const original = input();
  assert.throws(() =>
    generateCatalog({ ...original, builds: [{ ...build, rights_status: 'link_only' }] }),
  );
});

test('CLI is deterministic and --check refuses differences without overwriting them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gd-catalog-cli-'));
  try {
    await mkdir(join(dir, 'authors'));
    await mkdir(join(dir, 'sources'));
    await mkdir(join(dir, 'builds'));
    await writeFile(join(dir, 'masteries.json'), JSON.stringify(masteries));
    await writeFile(join(dir, 'authors/grim-dawn-builds.json'), JSON.stringify(author));
    await writeFile(join(dir, 'sources/catalogo-maestrias.json'), JSON.stringify(source));
    await writeFile(join(dir, `builds/${build.slug}.json`), JSON.stringify(build));
    const args = ['--import', 'tsx', join(root, 'scripts/gen-catalog.mts'), '--dir', dir];
    const run = (extra: string[] = []) =>
      execFileSync(process.execPath, [...args, ...extra], {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    run();
    const file = join(dir, 'tier-lists/principal.json');
    const first = await readFile(file, 'utf8');
    run();
    assert.equal(await readFile(file, 'utf8'), first);
    run(['--check']);
    assert.equal(await readFile(file, 'utf8'), first);
    const changed = first.replace('Catálogo de combinaciones', 'Modificación local del catálogo');
    assert.notEqual(changed, first);
    await writeFile(file, changed);
    assert.throws(() => run(['--check']));
    assert.equal(await readFile(file, 'utf8'), changed);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
