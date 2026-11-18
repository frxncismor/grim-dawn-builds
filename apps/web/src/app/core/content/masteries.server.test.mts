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

type Tree = { mastery: { slug: string }; nodes: Record<string, unknown>[] };

/** The versioned source fixture: its nodes still carry `icon` (the extractor needs it). */
async function sourceTree(slug: string): Promise<Tree> {
  return JSON.parse(await readFile(join(ROOT, 'mastery-trees', `${slug}.json`), 'utf8'));
}

/** What the API sends (S-004): the same tree without the game's texture path. */
async function tree(slug: string): Promise<Tree> {
  const source = await sourceTree(slug);
  return {
    ...source,
    nodes: source.nodes.map((node) =>
      Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'icon')),
    ),
  };
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

test('S-004: the fixture catalog serves no node icon; the API catalog rejects one', async () => {
  const source = await sourceTree('demolition');
  assert.ok(
    source.nodes.some((node) => 'icon' in node),
    'the fixture keeps the icon for the extractor',
  );
  const fromFixture = await new FixtureMasteryCatalog(ROOT).get('demolition');
  assert.ok(fromFixture);
  assert.equal(fromFixture.nodes.length, source.nodes.length);
  assert.ok(fromFixture.nodes.every((node) => !('icon' in node)));
  await assert.rejects(
    new ApiMasteryCatalog('http://localhost:3000/', async () => json(source)).get('demolition'),
    (error: Error) => error.message === unavailable,
  );
});

test('spec004 T025: the public fixture view keeps the public icon_id of every node and drops the texture', async () => {
  const source = await sourceTree('demolition');
  const fromFixture = await new FixtureMasteryCatalog(ROOT).get('demolition');
  assert.ok(fromFixture);
  for (const node of source.nodes) {
    const served = fromFixture.nodes.find((n) => n.id === node.id)!;
    assert.match(String(served.icon_id), /^ic-[0-9a-f]{16}$/, node.id);
    assert.equal(served.icon_id, node.icon_id);
    assert.doesNotMatch(JSON.stringify(served), /\.tex|"icon"/);
  }
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

test('fixture catalog summarizes the six masteries with their real node counts (T014)', async () => {
  const summaries = await new FixtureMasteryCatalog(ROOT).listSummaries();
  assert.deepEqual(
    summaries.map((item) => [item.slug, item.nodeCount]),
    [
      ['arcanist', 30],
      ['demolition', 33],
      ['nightblade', 31],
      ['occult', 30],
      ['shaman', 30],
      ['soldier', 32],
    ],
  );
  assert.deepEqual(summaries[1]?.name, { en: 'Demolitionist', es: 'Demoledor' });
});

test('fixture summaries mark a tree that does not load as no data instead of failing (US2 scenario 2)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gd-masteries-'));
  await mkdir(join(dir, 'mastery-trees'));
  const valid = await tree('soldier');
  await writeFile(join(dir, 'mastery-trees', 'soldier.json'), JSON.stringify(valid));
  await writeFile(join(dir, 'mastery-trees', 'broken.json'), '{ not json');
  assert.deepEqual(await new FixtureMasteryCatalog(dir).listSummaries(), [
    { slug: 'broken', name: null, nodeCount: 0 },
    { slug: 'soldier', name: { en: 'Soldier', es: 'Soldado' }, nodeCount: valid.nodes.length },
  ]);
});

test('API summaries come from the list endpoint with its node_count, sorted, in one request', async () => {
  const requests: string[] = [];
  const catalog = new ApiMasteryCatalog('http://localhost:3000/', async (url) => {
    requests.push(new URL(String(url)).pathname);
    return json([
      { ...summary('soldier'), node_count: 32, name: { en: 'Soldier', es: 'Soldado' } },
      { ...summary('arcanist'), node_count: 0, name: { en: 'Arcanist', es: 'Arcanista' } },
    ]);
  });
  assert.deepEqual(await catalog.listSummaries(), [
    { slug: 'arcanist', name: { en: 'Arcanist', es: 'Arcanista' }, nodeCount: 0 },
    { slug: 'soldier', name: { en: 'Soldier', es: 'Soldado' }, nodeCount: 32 },
  ]);
  assert.deepEqual(requests, ['/api/v1/masteries']);
});

test('API summaries fail closed in release: 503, network, invalid item or duplicate (no fallback)', async () => {
  const bad: [string, () => Promise<Response>][] = [
    ['503', async () => json({ error: 'content_unavailable' }, 503)],
    ['network', async () => Promise.reject(new Error('secret-host'))],
    ['not a list', async () => json({})],
    ['no name', async () => json([{ slug: 'soldier', node_count: 1 }])],
    ['bad count', async () => json([{ ...summary('soldier'), node_count: -1 }])],
    ['fractional count', async () => json([{ ...summary('soldier'), node_count: 1.5 }])],
    ['extra field', async () => json([{ ...summary('soldier'), icon: 'ui/secret.tex' }])],
    ['invalid slug', async () => json([summary('Bad Slug')])],
    ['negative count', async () => json([{ ...summary('soldier'), node_count: -3 }])],
    [
      'missing game_version',
      async () =>
        json([{ slug: 'soldier', id: 'class01', name: { en: 'a', es: 'b' }, node_count: 1 }]),
    ],
    ['duplicate', async () => json([summary('soldier'), summary('soldier')])],
    ['empty', async () => json([])],
  ];
  for (const [name, respond] of bad)
    await assert.rejects(
      new ApiMasteryCatalog('http://localhost:3000/', respond).listSummaries(),
      (error: Error) => error.message === unavailable && error.cause === undefined,
      name,
    );
  const requests: string[] = [];
  const release = createMasteryCatalog(
    'does-not-exist',
    { BUILD_MODE: 'release', CONTENT_SOURCE: 'api', API_BASE_URL: 'http://localhost:3000' },
    async (url) => {
      requests.push(new URL(String(url)).pathname);
      return json({}, 503);
    },
  );
  await assert.rejects(release.listSummaries(), { message: unavailable });
  assert.deepEqual(requests, ['/api/v1/masteries']);
});
