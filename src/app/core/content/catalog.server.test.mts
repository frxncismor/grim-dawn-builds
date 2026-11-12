import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureRepository } from './fixture-source.server.ts';
import { loadCatalogSnapshot } from './catalog.server.ts';
import { resolve } from 'node:path';
import { BuildSchema } from '@gd/domain';

test('real fixtures produce only public catalog metadata, including the published guide card', async () => {
  const repository = createFixtureRepository(resolve('content'), { INCLUDE_DRAFTS: 'true' });
  const model = await loadCatalogSnapshot(repository);
  assert.equal(model.cards.length, 45);
  const guides = model.cards.filter((card) => card.guide);
  assert.equal(guides.length, 1);
  assert.equal(guides[0]?.guide?.slug, 'chaman-demoledor-golpe-primigenio');
  const placeholders = model.cards.filter((card) => !card.guide);
  assert.equal(placeholders.length, 44);
  assert.ok(placeholders.every((card) => card.entry.entry_kind === 'placeholder'));
  const output = JSON.stringify(model);
  for (const key of [
    'reviewed_by',
    'rights_confirmed_by',
    'rights_notes',
    'permission_ref',
    'proof_ref',
    'skill_nodes',
    'purchase_steps',
    'Golpe Primigenio',
  ])
    assert.ok(!output.includes(key));
});
test('missing catalog and source failure are sanitized and never fall back', async () => {
  const repository = createFixtureRepository(resolve('content'), {});
  for (const getTierList of [
    async () => null,
    async () => {
      throw new Error('PRIVATE-CANARY');
    },
  ]) {
    await assert.rejects(
      loadCatalogSnapshot({
        ...repository,
        getTierList,
        listBuilds: () => repository.listBuilds(),
      } as never),
      (error) =>
        error instanceof Error &&
        error.message === 'No se pudo preparar el catálogo público.' &&
        !error.cause,
    );
  }
});

test('synthetic own publication projects filters and excludes every private canary and guide body', async () => {
  const repository = createFixtureRepository(resolve('content'), { INCLUDE_DRAFTS: 'true' });
  const original = (await repository.listBuilds())[0];
  const guide = BuildSchema.parse({
    ...original,
    slug: 'synthetic-public-guide',
    title: 'Guía sintética propia',
    review_state: 'publicado',
    rights_status: 'own_original',
    published_at: '2026-11-09',
    reviewed_by: 'PRIVATE-CANARY',
    reviewed_at: '2026-11-09',
    rights_confirmed_by: 'PRIVATE-CANARY',
    rights_confirmed_on: '2026-11-09',
    rights_notes: 'PRIVATE-CANARY',
    author_slug: 'synthetic-author',
    author: {
      slug: 'synthetic-author',
      display_name: 'Autora sintética',
      bio: null,
      url: null,
      is_placeholder: false,
    },
    source_slugs: ['synthetic-source'],
    sources: [
      {
        slug: 'synthetic-source',
        kind: 'original',
        title: 'Fuente propia',
        url: null,
        author_name: 'Autora sintética',
        license_note: 'Texto propio para prueba',
        permission_ref: 'PRIVATE-CANARY',
        retrieved_on: '2026-11-09',
        notes: 'PRIVATE-CANARY',
      },
    ],
  });
  const tier = structuredClone((await repository.getTierList('principal'))!);
  const index = tier.entries.findIndex((e) => e.entry_kind === 'build_propia');
  tier.entries[index] = {
    ...tier.entries[index],
    build_slug: guide.slug,
    review_state: 'publicado',
    rights_status: 'own_original',
    source_slug: 'synthetic-source',
  };
  tier.sources.push(guide.sources[0]);
  const result = await loadCatalogSnapshot({
    getTierList: async () => tier,
    listBuilds: async () => [original, guide],
  } as never);
  const card = result.cards.find((c) => c.guide?.slug === guide.slug);
  assert.equal(result.cards.length, 45);
  assert.equal(card?.guide?.slug, guide.slug);
  assert.deepEqual(card?.damageTypes, guide.damage_types);
  assert.deepEqual(card?.contentTags, guide.content_tags);
  const output = JSON.stringify(result);
  for (const key of [
    'PRIVATE-CANARY',
    'skill_nodes',
    'purchase_steps',
    'hero_callout_body',
    'rights_notes',
    'permission_ref',
  ])
    assert.ok(!output.includes(key));
});

test('credential-bearing external URL never enters transfer state or structured data', async () => {
  const repository = createFixtureRepository(resolve('content'), {});
  const tier = structuredClone((await repository.getTierList('principal'))!);
  const url = new URL('https://example.org/');
  url.username = 'synthetic-user';
  url.password = crypto.randomUUID();
  tier.entries[0] = {
    ...tier.entries[0],
    entry_kind: 'enlace_externo',
    rights_status: 'link_only',
    content_status: 'sin_verificar',
    external_url: url.href,
    external_author: 'Autora sintética',
    source_slug: 'own',
  };
  await assert.rejects(
    loadCatalogSnapshot({ getTierList: async () => tier, listBuilds: async () => [] } as never),
    { message: 'No se pudo preparar el catálogo público.' },
  );
});
