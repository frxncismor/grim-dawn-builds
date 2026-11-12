import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createPreviewServer } from './serve-svg-preview.mjs';
import { runSvgE2E } from './run-svg-e2e.mjs';

async function get(server: Server, path: string, method = 'GET') {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return new Promise<{ status: number; body: string; headers: Record<string, unknown> }>(
    (done, reject) => {
      const call = request(
        { host: '127.0.0.1', port: address.port, path, method, agent: false },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.on('end', () =>
            done({
              status: response.statusCode!,
              body: Buffer.concat(chunks).toString(),
              headers: response.headers,
            }),
          );
          response.on('error', reject);
        },
      );
      call.on('error', reject);
      call.setTimeout(5000, () => call.destroy(new Error('preview_timeout')));
      call.end();
    },
  );
}

test('preview serves only regular public output with correct MIME, HEAD and bounded paths', async () => {
  const ownedTemp = await realpath(tmpdir());
  const stage = await mkdtemp(join(ownedTemp, 'gd-svg-preview-test-'));
  let server: Server | undefined;
  try {
    const root = join(stage, 'public'),
      outside = join(stage, 'private');
    await mkdir(root);
    await mkdir(outside);
    await writeFile(join(root, 'index.html'), '<h1>Vista de prueba</h1>');
    await writeFile(join(root, 'style.css'), 'body { margin: 0; }');
    await writeFile(join(outside, 'hidden.txt'), 'contenido fuera de la raíz de prueba');
    await symlink(outside, join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(createPreviewServer(join(root, 'escape')), /invalid_preview_root/);
    server = await createPreviewServer(root);
    await new Promise<void>((done, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', done);
    });
    const page = await get(server, '/');
    assert.equal(page.status, 200);
    assert.match(String(page.headers['content-type']), /^text\/html/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal(page.body, '<h1>Vista de prueba</h1>');
    const head = await get(server, '/', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.ok(Number(head.headers['content-length']) > 0);
    const css = await get(server, '/style.css?cache=1');
    assert.equal(css.status, 200);
    assert.match(String(css.headers['content-type']), /^text\/css/);
    for (const path of [
      '/../private/hidden.txt',
      '/%2e%2e/private/hidden.txt',
      '/.env',
      '/escape/hidden.txt',
    ]) {
      const result = await get(server, path);
      assert.equal(result.status, 403, path);
      assert.ok(!result.body.includes('fuera de la raíz'));
    }
    assert.equal((await get(server, '/%')).status, 400);
    assert.equal((await get(server, '/missing')).status, 404);
    assert.equal((await get(server, '/escape/')).status, 403);
    assert.equal((await get(server, '/', 'POST')).status, 405);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((done) => server!.close(() => done()));
    }
    const absolute = resolve(stage);
    assert.ok(absolute.startsWith(ownedTemp + sep + 'gd-svg-preview-test-'));
    assert.equal(await realpath(stage), absolute);
    await rm(absolute, { recursive: true, force: true });
  }
});

test('a failed prerequisite prevents SVG tests from using an old build', async () => {
  let calls = 0;
  const result = await runSvgE2E([], async () => {
    calls++;
    return 17;
  });
  assert.equal(result, 17);
  assert.equal(calls, 1);
});
