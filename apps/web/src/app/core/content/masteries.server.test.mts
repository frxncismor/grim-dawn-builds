import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiMasteryCatalog,
  createMasteryCatalog,
  FixtureMasteryCatalog,
} from './masteries.server.ts';

const ROOT = 'fixtures/content';
const SLUGS = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const unavailable = 'Catálogo de maestrías no disponible o respuesta inválida.';
const summary = (slug: string) => ({
  id: 'class01',
  slug,
  name: { en: 'a', es: 'b' },
  game_version: 'v',
  node_count: 1,
});

async function tree(slug: string): Promise<{ mastery: { slug: string }; nodes: unknown[] }> {
  return JSON.parse(await readFile(join(ROOT, 'mastery-trees', `${slug}.json`), 'utf8'));
}

test('fixture catalog lists the six slugs sorted and validates each tree', async () => {
  const catalog = new FixtureMasteryCatalog(ROOT);
  assert.deepEqual(await catalog.listSlugs(), SLUGS);
  const demolition = await catalog.get('demolition');
  assert.equal(demolition?.mastery.slug, 'demolition');
  assert.equal(demolition?.nodes.length, 33);
  let total = 0;
  for (const slug of SLUGS) total += (await catalog.get(slug))!.nodes.length;
  assert.equal(total, 186);
});

test('fixture catalog returns null for an unknown or malformed slug', async () => {
  const catalog = new FixtureMasteryCatalog(ROOT);
  for (const slug of ['nope', '../masteries', 'Soldier', 'a/b', ''])
    assert.equal(await catalog.get(slug), null);
});

test('fixture catalog fails closed on an invalid tree, a slug mismatch or a missing folder', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gd-masteries-'));
  await mkdir(join(dir, 'mastery-trees'));
  const valid = await tree('soldier');
  const file = join(dir, 'mastery-trees', 'soldier.json');
  await writeFile(file, JSON.stringify({ ...valid, nodes: [] }));
  await assert.rejects(new FixtureMasteryCatalog(dir).get('soldier'), { message: unavailable });
  await writeFile(file, JSON.stringify({ ...valid, mastery: { ...valid.mastery, slug: 'other' } }));
  await assert.rejects(new FixtureMasteryCatalog(dir).get('soldier'), { message: unavailable });
  await assert.rejects(new FixtureMasteryCatalog(join(dir, 'missing')).listSlugs(), {
    message: unavailable,
  });
});

test('API catalog lists slugs and reads one tree with credential-free requests', async () => {
  const requests: string[] = [];
  const demolition = await tree('demolition');
  const catalog = new ApiMasteryCatalog('http://localhost:3000/', async (url, init) => {
    const path = new URL(String(url)).pathname;
    requests.push(path);
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.redirect, 'error');
    if (path === '/api/v1/masteries') return json(SLUGS.slice().reverse().map(summary));
    if (path === '/api/v1/masteries/demolition') return json(demolition);
    return json({ error: 'not_found' }, 404);
  });
  assert.deepEqual(await catalog.listSlugs(), SLUGS);
  assert.equal((await catalog.get('demolition'))?.nodes.length, 33);
  assert.equal(await catalog.get('missing'), null);
  assert.equal(await catalog.get('../x'), null);
  assert.deepEqual(requests, [
    '/api/v1/masteries',
    '/api/v1/masteries/demolition',
    '/api/v1/masteries/missing',
  ]);
});

test('API catalog turns 503, network errors, invalid bodies and slug mismatches into a build failure', async () => {
  const soldier = await tree('soldier');
  const attempts: [string, () => Promise<Response>][] = [
    ['503', async () => json({ error: 'content_unavailable' }, 503)],
    ['500', async () => json({}, 500)],
    ['network', async () => Promise.reject(new Error('secret-host'))],
    ['not json', async () => new Response('<html>')],
    ['invalid tree', async () => json({ mastery: 1 })],
    ['other slug', async () => json(soldier)],
  ];
  for (const [name, respond] of attempts)
    await assert.rejects(
      new ApiMasteryCatalog('http://localhost:3000/', respond).get('demolition'),
      (error: Error) => error.message === unavailable && error.cause === undefined,
      name,
    );
  for (const body of [
    { slug: 'x' },
    [{ slug: 'A' }],
    [summary('soldier'), summary('soldier')],
    [{}],
  ])
    await assert.rejects(
      new ApiMasteryCatalog('http://localhost:3000/', async () => json(body)).listSlugs(),
      { message: unavailable },
    );
  await assert.rejects(
    new ApiMasteryCatalog('http://localhost:3000/', async () => json({}, 503)).listSlugs(),
    { message: unavailable },
  );
});

test('API catalog rejects unsafe base URLs', () => {
  const authenticated = new URL('http://x/');
  authenticated.username = 'name';
  authenticated.password = 'sentinel';
  for (const url of ['ftp://x/', authenticated.href, 'http://x/?q=1', 'nope'])
    assert.throws(() => new ApiMasteryCatalog(url), { message: 'API_BASE_URL inválida.' });
});

test('selection: local uses fixtures, release needs the API and never falls back to fixtures', async () => {
  assert.equal((await createMasteryCatalog(ROOT, {}).listSlugs()).length, 6);
  assert.throws(() => createMasteryCatalog(ROOT, { BUILD_MODE: 'release' }));
  assert.throws(() =>
    createMasteryCatalog(ROOT, { BUILD_MODE: 'release', CONTENT_SOURCE: 'fixture' }),
  );
  assert.throws(() => createMasteryCatalog(ROOT, { CONTENT_SOURCE: 'typo' }));
  const requests: string[] = [];
  const api = createMasteryCatalog(
    'does-not-exist',
    { BUILD_MODE: 'release', CONTENT_SOURCE: 'api', API_BASE_URL: 'http://localhost:3000' },
    async (url) => {
      requests.push(new URL(String(url)).pathname);
      return json({}, 503);
    },
  );
  await assert.rejects(api.listSlugs(), { message: unavailable });
  assert.deepEqual(requests, ['/api/v1/masteries']);
});
