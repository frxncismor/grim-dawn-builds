import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import {
  contentFingerprint,
  expectedMigration,
  verifyRelease,
  probeReleaseApi,
} from './check-release.mts';

test('release migration fingerprint v1 uses journal order and exact SQL bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-release-hash-'));
  try {
    const folder = join(root, 'apps/api/drizzle');
    await mkdir(join(folder, 'meta'), { recursive: true });
    const journal = {
      entries: [
        { idx: 0, tag: '0000_first' },
        { idx: 1, tag: '0001_second' },
      ],
    };
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(journal));
    await writeFile(join(folder, '0000_first.sql'), 'SELECT 1;');
    await writeFile(join(folder, '0001_second.sql'), 'SELECT 2;');
    const baseline = await expectedMigration(root);
    assert.equal(baseline, 'd49a6e2052d5cd3c1e01268560b2a6868e0bd670fa4b3ec3c5e5f7ea641b28c6');
    await writeFile(join(folder, '0000_first.sql'), 'SELECT 1;\n');
    assert.notEqual(await expectedMigration(root), baseline);
    for (const entries of [
      [],
      [{ idx: 0, tag: '../private' }],
      [journal.entries[1]],
      [journal.entries[0], journal.entries[0]],
    ]) {
      await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ entries }));
      await assert.rejects(expectedMigration(root));
    }
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-release-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('readiness must match checkout, never absent or remote supplied expectation', async () => {
  const authenticated = new URL('http://localhost');
  authenticated.username = 'synthetic';
  authenticated.password = 'sentinel';
  await assert.rejects(probeReleaseApi(authenticated.href, 'a'.repeat(64)));
  const migration = 'a'.repeat(64);
  for (const [status, header, body] of [
    [503, migration, 'ready'],
    [200, '', 'ready'],
    [200, 'b'.repeat(64), 'ready'],
    [200, migration, 'not_ready'],
  ] as const) {
    await assert.rejects(
      probeReleaseApi(
        'http://localhost',
        migration,
        async () =>
          new Response(JSON.stringify({ status: body }), {
            status,
            headers: { 'X-Content-Migration': header },
          }),
      ),
    );
  }
  await probeReleaseApi('http://localhost', migration, async (_url, init) => {
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.credentials, 'omit');
    assert.ok(init?.signal);
    return new Response('{"status":"ready"}', { headers: { 'X-Content-Migration': migration } });
  });
  await assert.rejects(probeReleaseApi('file:///private', migration));
  await assert.rejects(
    probeReleaseApi('http://localhost', migration, async () => {
      throw new Error('private details');
    }),
    (e: Error) => !e.message.includes('private') && e.cause === undefined,
  );
});

test('public artifact fingerprint covers names and bytes and refuses symlink traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-release-files-'));
  try {
    const folder = join(root, 'public');
    await mkdir(folder);
    await writeFile(join(folder, 'a.html'), 'public');
    const first = await contentFingerprint(folder);
    assert.equal(await contentFingerprint(folder), first);
    await writeFile(join(folder, 'b.html'), 'public');
    assert.notEqual(await contentFingerprint(folder), first);
    await symlink(folder, join(folder, 'cycle'), 'junction');
    await assert.rejects(contentFingerprint(folder), /enlace simbólico/);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-release-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('release report rejects fixture, invalid date, migration drift and changed artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-release-report-'));
  try {
    const folder = join(root, 'browser');
    await mkdir(folder);
    await writeFile(
      join(folder, 'index.html'),
      '<script type="application/json">{"gd-content-source":{"source":"api","includeDrafts":false}}</script>',
    );
    const migration = 'a'.repeat(64);
    const contentHash = await contentFingerprint(folder);
    const info = { source: 'api', migration, builtAt: '2026-11-09T00:00:00.000Z', contentHash };
    await verifyRelease(info, folder, migration);
    for (const change of [
      { source: 'fixture' },
      { builtAt: 'invalid' },
      { builtAt: '2026-02-31T00:00:00.000Z' },
      { migration: 'b'.repeat(64) },
      { contentHash: 'c'.repeat(64) },
      { private: 'unexpected' },
    ])
      await assert.rejects(verifyRelease({ ...info, ...change }, folder, migration));
    await writeFile(join(folder, 'index.html'), 'fixture');
    await assert.rejects(verifyRelease(info, folder, migration));
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-release-'));
    await rm(root, { recursive: true, force: true });
  }
});
