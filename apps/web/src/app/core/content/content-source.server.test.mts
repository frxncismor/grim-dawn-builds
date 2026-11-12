import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContentSource } from './content-source.server.ts';

test('local source defaults to fixture and reports only public source metadata', async () => {
  const selected = createContentSource('content', { PRIVATE_SENTINEL: 'do-not-transfer' });
  await selected.initialize();
  assert.deepEqual(selected.metadata, { source: 'fixture', includeDrafts: false });
  assert.deepEqual(await selected.repository.listBuilds(), []);
  const local = createContentSource('content', { INCLUDE_DRAFTS: 'true' });
  assert.equal((await local.repository.listBuilds()).length, 1);
});

test('selection refuses invalid modes, implicit release, fixture release and API drafts', () => {
  for (const env of [
    { BUILD_MODE: 'release' },
    { BUILD_MODE: 'release', CONTENT_SOURCE: 'fixture' },
    { BUILD_MODE: 'typo' },
    { CONTENT_SOURCE: 'typo' },
    { CONTENT_SOURCE: 'api', INCLUDE_DRAFTS: 'true' },
    { CONTENT_SOURCE: 'api', INCLUDE_DRAFTS: '1' },
  ])
    assert.throws(() => createContentSource('content', env));
});

test('API initialization eagerly checks readiness and slugs, and never falls back to files', async () => {
  const requests: string[] = [];
  const source = createContentSource(
    'does-not-exist',
    { BUILD_MODE: 'release', CONTENT_SOURCE: 'api' },
    async (url) => {
      const path = new URL(String(url)).pathname;
      requests.push(path);
      return new Response(JSON.stringify(path === '/ready' ? { status: 'ready' } : []));
    },
  );
  await source.initialize();
  assert.deepEqual(requests, ['/ready', '/api/v1/slugs']);
  assert.deepEqual(source.metadata, { source: 'api', includeDrafts: false });
  for (const failedPath of ['/ready', '/api/v1/slugs']) {
    const down = createContentSource(
      'content',
      { CONTENT_SOURCE: 'api' },
      async (url) =>
        new Response(JSON.stringify({ status: 'ready' }), {
          status: String(url).endsWith(failedPath) ? 503 : 200,
        }),
    );
    await assert.rejects(down.initialize(), /API de contenido no disponible/);
  }
});
