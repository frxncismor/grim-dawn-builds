import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureRepository } from './fixture-source.server.ts';
import { loadCatalogData } from './catalog.server.ts';
import { loadPublicSiteData } from './author-pages.server.ts';
import { BuildSchema } from '@gd/domain';
import type { ContentRepository } from './repository';
const base = () => createFixtureRepository('content', { INCLUDE_DRAFTS: 'true' });
test('site loader reads catalog once and only its public owner; legacy wrapper keeps two calls', async () => {
  const source = base(),
    counts = { tier: 0, builds: 0, author: 0 };
  const repository = Object.create(source) as ContentRepository<boolean>;
  repository.getTierList = async (slug) => {
    counts.tier++;
    return source.getTierList(slug);
  };
  repository.listBuilds = async () => {
    counts.builds++;
    return source.listBuilds();
  };
  repository.getAuthor = async (slug) => {
    counts.author++;
    return source.getAuthor(slug);
  };
  const data = await loadPublicSiteData(repository);
  assert.deepEqual(counts, { tier: 1, builds: 1, author: 1 });
  assert.deepEqual(
    data.authors.map((a) => a.profile.slug),
    ['grim-dawn-builds'],
  );
  assert.equal(data.authors[0].ownsCatalog, true);
  assert.deepEqual(data.authors[0].guideSlugs, []);
  for (const key of [
    'is_placeholder',
    'rights_confirmed_by',
    'permission_ref',
    'skill_nodes',
    'por-confirmar',
  ])
    assert.ok(!JSON.stringify(data).includes(key));
  Object.assign(counts, { tier: 0, builds: 0, author: 0 });
  await loadCatalogData(repository);
  assert.deepEqual(counts, { tier: 1, builds: 1, author: 0 });
});
async function published() {
  const source = base(),
    raw = (await source.listBuilds())[0],
    owner = await source.getAuthor('grim-dawn-builds');
  return BuildSchema.parse({
    ...raw,
    slug: 'synthetic-guide',
    title: 'Guía propia de prueba',
    review_state: 'publicado',
    rights_status: 'own_original',
    published_at: '2026-11-10',
    reviewed_by: 'synthetic-reviewer',
    reviewed_at: '2026-11-10',
    rights_confirmed_by: 'synthetic-licensor',
    rights_confirmed_on: '2026-11-10',
    author_slug: owner!.slug,
    author: owner,
  });
}
test('embedded public profiles are reused without getAuthor and no guide body is duplicated', async () => {
  const source = base(),
    guide = await published();
  let calls = 0;
  const data = await loadPublicSiteData({
    getTierList: (slug) => source.getTierList(slug),
    listBuilds: async () => [guide],
    getAuthor: async () => {
      calls++;
      throw Error('Should reuse');
    },
  } as ContentRepository<boolean>);
  assert.equal(calls, 0);
  assert.deepEqual(data.authors[0].guideSlugs, ['synthetic-guide']);
  assert.ok(!JSON.stringify(data.authors).includes('purchase_steps'));
});
test('contradictory profiles and placeholder owners fail sanitized', async () => {
  const source = base(),
    guide = await published();
  const conflicting = {
    ...guide,
    slug: 'another-guide',
    author: { ...guide.author, bio: 'Conflicting' },
  };
  await assert.rejects(
    loadPublicSiteData({
      getTierList: (slug) => source.getTierList(slug),
      listBuilds: async () => [guide, conflicting],
      getAuthor: async () => null,
    } as ContentRepository<boolean>),
    { message: 'No se pudieron preparar los autores públicos.' },
  );
  const owner = await source.getAuthor('grim-dawn-builds');
  await assert.rejects(
    loadPublicSiteData({
      getTierList: (slug) => source.getTierList(slug),
      listBuilds: async () => [],
      getAuthor: async () => ({ ...owner!, is_placeholder: true }),
    } as ContentRepository<boolean>),
    { message: 'No se pudieron preparar los autores públicos.' },
  );
});
test('credential-bearing owner URL is never serialized', async () => {
  const source = base(),
    owner = await source.getAuthor('grim-dawn-builds'),
    url = new URL('https://example.org');
  url.username = 'synthetic-user';
  url.password = crypto.randomUUID();
  await assert.rejects(
    loadPublicSiteData({
      getTierList: (slug) => source.getTierList(slug),
      listBuilds: async () => [],
      getAuthor: async () => ({ ...owner!, url: url.href }),
    } as ContentRepository<boolean>),
    (error) =>
      error instanceof Error &&
      error.message === 'No se pudieron preparar los autores públicos.' &&
      !error.cause,
  );
});
