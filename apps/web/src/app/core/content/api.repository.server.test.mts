import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { ApiContentRepository } from './api.repository.ts';
import { createFixtureRepository } from './fixture-source.server.ts';

const fixture = createFixtureRepository('content', {});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

test('native HTTP refuses redirects and aborts a stalled response without retaining network details', async () => {
  let redirected = false;
  const server = createServer((request, reply) => {
    if (request.url?.startsWith('/redirect/')) {
      reply.writeHead(302, { Location: '/private-destination' }).end();
    } else if (request.url === '/private-destination') {
      redirected = true;
      reply.end('[]');
    }
    // /stalled intentionally remains open until the adapter aborts it.
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    for (const path of ['redirect', 'stalled']) {
      await assert.rejects(
        new ApiContentRepository(`http://127.0.0.1:${address.port}/${path}/`).listSlugs(),
        (error: Error) =>
          error.message === 'API de contenido no disponible o respuesta inválida.' &&
          error.cause === undefined,
      );
    }
    assert.equal(redirected, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('HTTP adapter implements every port method with validated public DTOs', async () => {
  const catalog = await fixture.getTierList('principal');
  const author = await fixture.getAuthor('grim-dawn-builds');
  const requests: string[] = [];
  const repository = new ApiContentRepository('http://localhost:3000/', async (url, init) => {
    requests.push(String(url));
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    const path = new URL(String(url)).pathname;
    if (path === '/ready') return response({ status: 'ready' });
    if (path === '/api/v1/builds' || path === '/api/v1/slugs') return response([]);
    if (path.endsWith('/principal')) return response(catalog);
    if (path.endsWith('/grim-dawn-builds')) return response(author);
    return response({ error: 'not_found' }, 404);
  });
  await repository.ready();
  assert.deepEqual(await repository.listBuilds(), []);
  assert.deepEqual(await repository.listSlugs(), []);
  assert.deepEqual(await repository.getTierList('principal'), catalog);
  assert.deepEqual(await repository.getAuthor('grim-dawn-builds'), author);
  assert.equal(await repository.findBuild('missing'), null);
  assert.equal(await repository.getAuthor('missing'), null);
  assert.equal(await repository.getTierList('missing'), null);
  assert.equal(requests.length, 8);
});

test('FR-16: public asset descriptors are fetched and resolved without private evidence', async () => {
  const payload = [
    {
      slug: 'rayo-oficial',
      file_path: 'public/assets/official/rayo.svg',
      fallback_svg: 'src/assets/icons/damage-rayo.svg',
    },
    {
      slug: 'pendiente',
      status: 'pending',
      file_path: null,
      fallback_svg: 'src/assets/icons/status-placeholder.svg',
    },
  ];
  let requested = '';
  const repository = new ApiContentRepository('http://localhost:3000/', async (url) => {
    requested = new URL(String(url)).pathname;
    return response(payload);
  });

  assert.deepEqual(await repository.listAssets(), [
    {
      slug: 'pendiente',
      icon: {
        id: 'status-placeholder',
        src: 'assets/icons/status-placeholder.svg',
        fallbackSrc: 'assets/icons/status-placeholder.svg',
      },
    },
    {
      slug: 'rayo-oficial',
      icon: {
        id: 'damage-rayo',
        src: 'assets/official/rayo.svg',
        fallbackSrc: 'assets/icons/damage-rayo.svg',
      },
    },
  ]);
  assert.equal(requested, '/api/v1/assets');

  for (const hostile of [
    [{ ...payload[0]!, proof_ref: 'PRIVATE-EVIDENCE' }],
    [{ ...payload[0]!, origin_url: 'https://example.test/private' }],
    [{ ...payload[0]!, file_path: 'https://example.test/rayo.svg' }],
    [{ ...payload[0]!, file_path: 'public/assets/official/../private.svg' }],
    [{ ...payload[0]!, fallback_svg: 'https://example.test/fallback.svg' }],
    [{ ...payload[0]!, slug: 'bad/slug' }],
    [{ slug: payload[0]!.slug }],
  ]) {
    const hostileRepository = new ApiContentRepository('http://localhost', async () =>
      response(hostile),
    );
    await assert.rejects(hostileRepository.listAssets(), (error: Error) => {
      assert.equal(error.message, 'API de contenido no disponible o respuesta inválida.');
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('rejects invalid configuration and slugs before issuing requests', async () => {
  const authenticated = new URL('http://localhost');
  authenticated.username = 'name';
  authenticated.password = 'sentinel';
  for (const url of [
    'file:///tmp',
    authenticated.href,
    'http://localhost/?key=sentinel',
    'http://localhost/#sentinel',
    'garbage',
  ])
    assert.throws(() => new ApiContentRepository(url), /API_BASE_URL inválida/);
  let calls = 0;
  const repository = new ApiContentRepository('http://localhost', async () => {
    calls++;
    return response([]);
  });
  for (const slug of ['../secret', 'hello/world', 'Upper', '', '%2f'])
    await assert.rejects(repository.findBuild(slug), /slug inválido/);
  assert.equal(calls, 0);
});

test('fails closed on unavailable, malformed, private or unpublished responses without leaking causes', async () => {
  const catalog = await fixture.getTierList('principal');
  const draft = JSON.parse(
    await readFile('scripts/fixtures/content-valid/builds/valid-draft.json', 'utf8'),
  );
  for (const request of [
    async () => response({ sentinel: 'private-body' }, 503),
    async () => response({}, 404),
    async () => new Response('private-body: malformed JSON'),
    async () => response([draft]),
    async () => {
      throw new Error('sentinel: private network details');
    },
  ]) {
    const repository = new ApiContentRepository('http://localhost', request);
    await assert.rejects(repository.listBuilds(), (error: Error) => {
      assert.equal(error.message, 'API de contenido no disponible o respuesta inválida.');
      assert.equal(error.cause, undefined);
      return true;
    });
  }
  const privateTier = new ApiContentRepository('http://localhost', async () =>
    response({ ...catalog, rights_notes: 'private-body' }),
  );
  await assert.rejects(privateTier.getTierList('principal'));
  const privateAuthor = new ApiContentRepository('http://localhost', async () =>
    response({
      slug: 'someone',
      display_name: 'Someone',
      bio: null,
      url: null,
      is_placeholder: false,
    }),
  );
  await assert.rejects(privateAuthor.getAuthor('someone'));
  for (const payload of [['bad/slug'], ['same', 'same'], {}, null]) {
    await assert.rejects(
      new ApiContentRepository('http://localhost', async () => response(payload)).listSlugs(),
    );
  }
  await assert.rejects(
    new ApiContentRepository('http://localhost', async () =>
      response({ status: 'not_ready' }),
    ).ready(),
  );
});
