import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PublicAuthorSchema, PublicBuildSchema, PublicSourceSchema } from '@gd/domain';
import { contractDoc } from '@gd/domain/testing';
import { prepareSeed, readSeedFixtures, seedData, type SeedData } from '../src/db/seed.mjs';

import { prepareEdit, editData } from '../src/db/editor.mjs';

const root = join(import.meta.dirname, '../../..');
const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(root, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const suite =
  process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true' ? describe : describe.skip;
let container: string | undefined;
let admin: pg.Client | undefined;
let importer: pg.Client | undefined;
let data: SeedData;
let editor: pg.Client | undefined;
function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('Editor PostgreSQL fixture command failed');
  return result.stdout.trim();
}

suite('editor with real PostgreSQL and restricted roles after bootstrap (T-129)', () => {
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-editor-${process.pid}-${randomBytes(4).toString('hex')}`;
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      container,
      '--memory',
      '512m',
      '--memory-swap',
      '512m',
      '--cpus',
      '0.5',
      '--pids-limit',
      '100',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=256m',
      '--env',
      'POSTGRES_DB=gd_editor_test',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '--publish',
      '127.0.0.1::5432',
      image,
    ]);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      const result = spawnSync(
        'docker',
        [
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
          '-d',
          'gd_editor_test',
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 10000 },
      );
      if (result.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('Editor PostgreSQL fixture did not start');
    const port = Number(
      docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        container,
      ]),
    );
    admin = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: 'gd_editor_test',
      connectionTimeoutMillis: 5000,
    });
    await admin.connect();
    await admin.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor LOGIN; CREATE ROLE api_ro NOLOGIN;
      GRANT CREATE ON DATABASE gd_editor_test TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
    await migrate(drizzle(admin), { migrationsFolder: join(root, 'apps/api/drizzle') });
    await admin.query('RESET ROLE');
    importer = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'importer',
      database: 'gd_editor_test',
      connectionTimeoutMillis: 5000,
    });
    await importer.connect();
    data = await readSeedFixtures(join(root, 'content'));
    await seedData(importer!, data);
    const synthetic = contractDoc('editor-public', {
      review_state: 'publicado',
      rights_status: 'own_original',
      rights_confirmed_by: 'Synthetic confirmer',
      rights_confirmed_on: '2026-11-09',
      reviewed_by: 'Synthetic reviewer',
      published_at: '2026-11-09',
    });
    await seedData(importer!, prepareSeed({ ...data, builds: [synthetic], tierLists: [] }));
    for (const table of ['authors', 'sources', 'builds', 'tier_lists', 'tier_entries'])
      await admin!.query('UPDATE ' + table + " SET origin='bootstrap'");
    await admin!.query(
      "INSERT INTO content_origin (bootstrapped_at,payload_hash,migration_version) VALUES (CURRENT_TIMESTAMP,'test-only','test')",
    );
    editor = new pg.Client({ host: '127.0.0.1', port, user: 'editor', database: 'gd_editor_test' });
    await editor.connect();
  }, 90000);
  afterAll(async () => {
    await editor?.end().catch(() => undefined);
    await importer?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (container) docker(['rm', '--force', container]);
  });

  it('edits the complete pending guide after bootstrap without publishing it or changing shared resources', async () => {
    const doc = structuredClone(data.builds[0]!);
    doc.title = 'Local editorial title';
    doc.summary = 'Local editorial summary';
    doc.purchase_steps[0]!.body = 'Edited purchase step';
    const before = (await admin!.query('SELECT id,origin,display_name FROM authors ORDER BY slug'))
      .rows;
    const outcome = await editData(editor!, prepareEdit('build', doc.slug, { document: doc }));
    expect(outcome).toEqual({ builds: 1, tierLists: 0 });
    expect(
      (
        await admin!.query('SELECT title,summary,origin,rights_status FROM builds WHERE slug=$1', [
          doc.slug,
        ])
      ).rows[0],
    ).toEqual({
      title: doc.title,
      summary: doc.summary,
      origin: 'editor',
      rights_status: 'pending',
    });
    expect(
      (await admin!.query('SELECT id,origin,display_name FROM authors ORDER BY slug')).rows,
    ).toEqual(before);
    for (const [table, expected] of [
      ['build_skill_nodes', doc.skill_nodes.length],
      ['build_priorities', doc.priorities.length],
      ['build_purchase_steps', doc.purchase_steps.length],
      ['build_notes', doc.notes.length],
      ['loot_filter_columns', doc.loot_filter_columns.length],
      ['build_guides_npcs', doc.guide_npcs.length],
      ['build_constellations', doc.constellations.length],
      ['build_devotion_steps', doc.devotion_steps.length],
      ['build_sections_meta', doc.sections_meta.length],
    ] as const) {
      expect(
        (
          await admin!.query(
            'SELECT count(*)::int AS n FROM ' +
              table +
              ' WHERE build_id=(SELECT id FROM builds WHERE slug=$1)',
            [doc.slug],
          )
        ).rows[0].n,
      ).toBe(expected);
    }
    expect(
      (
        await admin!.query('SELECT count(*)::int AS n FROM v_public_builds WHERE slug=$1', [
          doc.slug,
        ])
      ).rows[0].n,
    ).toBe(0);
  });

  it('edits a tier list using existing guide references without reimporting their bodies', async () => {
    const tier = structuredClone(data.tierLists[0]!);
    tier.title = 'Edited catalog';
    const builds = (await admin!.query('SELECT id,title,origin FROM builds ORDER BY slug')).rows;
    expect(
      await editData(editor!, prepareEdit('tier-list', tier.slug, { document: tier })),
    ).toEqual({ builds: 0, tierLists: 1 });
    expect(
      (await admin!.query('SELECT title,origin FROM tier_lists WHERE slug=$1', [tier.slug]))
        .rows[0],
    ).toEqual({ title: tier.title, origin: 'editor' });
    expect((await admin!.query('SELECT id,title,origin FROM builds ORDER BY slug')).rows).toEqual(
      builds,
    );
  });

  it('preserves all public guide fields and editorial signatures independently', async () => {
    const doc = contractDoc('editor-public', {
      review_state: 'publicado',
      rights_status: 'own_original',
      rights_confirmed_by: 'Synthetic confirmer',
      rights_confirmed_on: '2026-11-09',
      reviewed_by: 'Synthetic reviewer',
      published_at: '2026-11-09',
    });
    doc.title = 'Edited synthetic public guide';
    doc.priorities[0]!.note = 'Edited priority';
    await editData(editor!, prepareEdit('build', doc.slug, { document: doc }));
    const pick = (keys: string[], value: object) =>
      Object.fromEntries(keys.map((key) => [key, (value as Record<string, unknown>)[key]]));
    const expected = PublicBuildSchema.parse({
      ...pick(Object.keys(PublicBuildSchema.shape), doc),
      author: pick(Object.keys(PublicAuthorSchema.shape), doc.author),
      sources: doc.sources.map((source) => pick(Object.keys(PublicSourceSchema.shape), source)),
    });
    expect(
      (
        await admin!.query('SELECT document FROM v_public_build_documents WHERE slug=$1', [
          doc.slug,
        ])
      ).rows[0].document,
    ).toEqual(expected);
    expect(
      (
        await admin!.query('SELECT reviewed_by,rights_confirmed_by FROM builds WHERE slug=$1', [
          doc.slug,
        ])
      ).rows[0],
    ).toEqual({ reviewed_by: 'Synthetic reviewer', rights_confirmed_by: 'Synthetic confirmer' });
  });

  it('rejects changes to shared dependencies and rolls back a late SQL constraint', async () => {
    const doc = structuredClone(data.builds[0]!);
    doc.author.display_name = 'Conflicting shared author';
    await expect(
      editData(editor!, prepareEdit('build', doc.slug, { document: doc })),
    ).rejects.toThrow('dependency-conflict');
    doc.author = structuredClone(data.builds[0]!.author);
    doc.title = 'Must roll back';
    await admin!.query(
      'ALTER TABLE build_notes ADD CONSTRAINT editor_rollback_probe CHECK (false) NOT VALID',
    );
    try {
      await expect(
        editData(editor!, prepareEdit('build', doc.slug, { document: doc })),
      ).rejects.toThrow('database-failed');
    } finally {
      await admin!.query('ALTER TABLE build_notes DROP CONSTRAINT editor_rollback_probe');
    }
    expect(
      (await admin!.query('SELECT title FROM builds WHERE slug=$1', [doc.slug])).rows[0].title,
    ).toBe('Local editorial title');
  });

  it('requires explicit creation of absent dependencies and never grants editor DDL or marker mutation', async () => {
    const doc = contractDoc('new-editor-guide', {
      author_slug: 'new-editor-author',
      source_slugs: ['new-editor-source'],
    });
    await expect(
      editData(editor!, prepareEdit('build', doc.slug, { document: doc })),
    ).rejects.toThrow('dependency-missing');
    expect(
      await editData(
        editor!,
        prepareEdit('build', doc.slug, { document: doc, createMissingDependencies: true }),
      ),
    ).toEqual({ builds: 1, tierLists: 0 });
    expect(
      (await admin!.query('SELECT origin FROM authors WHERE slug=$1', [doc.author_slug])).rows[0]
        .origin,
    ).toBe('editor');
    for (const sql of [
      'UPDATE content_origin SET payload_hash=payload_hash',
      'DELETE FROM content_origin',
      'CREATE TABLE editor_forbidden(id int)',
    ])
      await expect(editor!.query(sql)).rejects.toMatchObject({ code: '42501' });
  });

  it('blocks importer DML after bootstrap even if it changes origin or touches child rows', async () => {
    for (const sql of [
      'UPDATE builds SET title=title',
      "UPDATE builds SET origin='editor'",
      'DELETE FROM build_notes',
      "INSERT INTO authors(slug,display_name,origin) VALUES ('forbidden','Forbidden','editor')",
    ])
      await expect(importer!.query(sql)).rejects.toMatchObject({ code: '23514' });
    await expect(seedData(importer!, data)).rejects.toThrow('bootstrapped');
  });

  it('refuses to reparent a shared skill and rolls back newly declared dependencies', async () => {
    const doc = contractDoc('editor-reparent');
    doc.skill_nodes.push({
      ...doc.skill_nodes[0]!,
      slug: 'new-editor-parent',
      name_es: 'Padre sintético',
      name_en: 'Synthetic parent',
    });
    doc.skill_nodes[0]!.parent_slug = 'new-editor-parent';
    await expect(
      editData(
        editor!,
        prepareEdit('build', doc.slug, { document: doc, createMissingDependencies: true }),
      ),
    ).rejects.toThrow('dependency-conflict');
    expect(
      (await admin!.query("SELECT count(*)::int AS n FROM skills WHERE slug='new-editor-parent'"))
        .rows[0].n,
    ).toBe(0);
    expect(
      (await admin!.query('SELECT count(*)::int AS n FROM builds WHERE slug=$1', [doc.slug]))
        .rows[0].n,
    ).toBe(0);
  });
});
