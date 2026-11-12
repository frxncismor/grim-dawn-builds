import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFixtureRepository } from './fixture-source.server.ts';
import { PublicTierListSchema } from '@gd/domain';

test('server loader reads real fixture files without publishing their draft content', async () => {
  const root = join(import.meta.dirname, '../../../../scripts/fixtures/content-valid');
  const local = createFixtureRepository(root, { INCLUDE_DRAFTS: 'true' });
  assert.equal((await local.listBuilds()).length, 1);
  assert.equal((await local.listBuilds())[0].rights_status, 'pending');
  assert.deepEqual(await createFixtureRepository(root, {}).listBuilds(), []);
});

test('real catalog has 46 public slots, including the published own guide', async () => {
  const root = join(import.meta.dirname, '../../../../content');
  const publicRepo = createFixtureRepository(root, {});
  const catalog = await publicRepo.getTierList('principal');
  assert.equal(PublicTierListSchema.safeParse(catalog).success, true);
  assert.equal(catalog?.masteries.length, 10);
  assert.equal(catalog?.combinations.length, 45);
  assert.equal(catalog?.entries.length, 46);
  const placeholders = catalog?.entries.filter((entry) => entry.entry_kind === 'placeholder');
  assert.equal(placeholders?.length, 45);
  assert.ok(
    placeholders?.every((entry) => entry.build_slug === null && entry.tier === 'sin_clasificar'),
  );
  assert.deepEqual(
    catalog?.sources.map((source) => source.slug),
    ['catalogo-maestrias', 'guia-original'],
  );
  assert.doesNotMatch(
    JSON.stringify(catalog),
    /permission_ref|rights_confirmed_by|rights_notes|reviewed_by|skill_nodes/,
  );
  assert.equal((await publicRepo.getAuthor('grim-dawn-builds'))?.display_name, 'Grim Dawn Builds');
  assert.equal(await publicRepo.getAuthor('por-confirmar'), null);
  const local = createFixtureRepository(root, { INCLUDE_DRAFTS: 'true' });
  const localCatalog = await local.getTierList('principal');
  assert.equal(localCatalog?.entries.length, 46);
  const guide = localCatalog?.entries.find((entry) => entry.entry_kind === 'build_propia');
  assert.equal(guide?.review_state, 'publicado');
  assert.equal(guide?.rights_status, 'own_original');
  assert.equal(guide?.build_slug, 'chaman-demoledor-golpe-primigenio');
});

test('server configuration refuses release, unknown sources and accidental draft flag values', () => {
  for (const env of [
    { BUILD_MODE: 'release' },
    { CONTENT_SOURCE: 'api' },
    { INCLUDE_DRAFTS: '1' },
    { BUILD_MODE: 'typo' },
  ]) {
    assert.throws(() => createFixtureRepository('content', env));
  }
});

test('disk collections resolve normalized attribution and load tier lists as well as builds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-fixture-collections-'));
  try {
    const original = JSON.parse(
      await readFile(
        join(
          import.meta.dirname,
          '../../../../scripts/fixtures/content-valid/builds/valid-draft.json',
        ),
        'utf8',
      ),
    );
    const { author, sources, ...build } = original;
    const tier = {
      slug: 'principal',
      locale: 'es',
      title: 'Fixture local',
      game_version: 'test',
      review_state: 'borrador',
      author_slug: author.slug,
      masteries: [],
      combinations: [],
      entries: [],
      sources: [],
    };
    for (const [collection, documents] of Object.entries({
      builds: [build],
      authors: [author],
      sources,
      'tier-lists': [tier],
    })) {
      await mkdir(join(root, collection));
      for (const document of documents as { slug: string }[]) {
        await writeFile(join(root, collection, `${document.slug}.json`), JSON.stringify(document));
      }
    }
    const local = createFixtureRepository(root, { INCLUDE_DRAFTS: 'true' });
    assert.deepEqual(await local.findBuild(original.slug), original);
    assert.deepEqual(await local.getAuthor(author.slug), author);
    assert.deepEqual(await local.getTierList('principal'), tier);
    const publicRepo = createFixtureRepository(root, {});
    assert.equal(await publicRepo.getAuthor(author.slug), null);
    assert.equal(await publicRepo.getTierList('principal'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('disk JSON errors do not echo input or parser excerpts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-fixture-reader-'));
  try {
    await mkdir(join(root, 'authors'));
    await writeFile(join(root, 'authors/broken.json'), '{"secret":"PRIVATE-FIXTURE-MARKER"');
    await assert.rejects(createFixtureRepository(root, {}).listBuilds(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /authors\/broken.json/);
      assert.doesNotMatch(error.message, /PRIVATE-FIXTURE|SyntaxError|secret/);
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
