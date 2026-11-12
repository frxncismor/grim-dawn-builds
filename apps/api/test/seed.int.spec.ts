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
function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('Seed PostgreSQL fixture command failed');
  return result.stdout.trim();
}

suite('fixture import with a real restricted PostgreSQL role (T-059)', () => {
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-seed-${process.pid}-${randomBytes(4).toString('hex')}`;
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
      'POSTGRES_DB=gd_seed_test',
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
          'gd_seed_test',
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 10000 },
      );
      if (result.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('Seed PostgreSQL fixture did not start');
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
      database: 'gd_seed_test',
      connectionTimeoutMillis: 5000,
    });
    await admin.connect();
    await admin.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor NOLOGIN; CREATE ROLE api_ro NOLOGIN;
      GRANT CREATE ON DATABASE gd_seed_test TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
    await migrate(drizzle(admin), { migrationsFolder: join(root, 'apps/api/drizzle') });
    await admin.query('RESET ROLE');
    importer = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'importer',
      database: 'gd_seed_test',
      connectionTimeoutMillis: 5000,
    });
    await importer.connect();
    data = await readSeedFixtures(join(root, 'content'));
  }, 90000);
  afterAll(async () => {
    await importer?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (container) docker(['rm', '--force', container]);
  });

  it('loads real fixtures twice without duplicating roots or child collections', async () => {
    const expected = { builds: 1, tierLists: 1 };
    expect(await seedData(importer!, data)).toEqual(expected);
    const counts = async () =>
      (
        await admin!.query(`SELECT
      (SELECT count(*) FROM builds)::int AS builds,
      (SELECT count(*) FROM build_skill_nodes)::int AS skills,
      (SELECT count(*) FROM build_priorities)::int AS priorities,
      (SELECT count(*) FROM build_constellations)::int AS constellations,
      (SELECT count(*) FROM tier_entries)::int AS entries`)
      ).rows[0];
    const first = await counts();
    expect(first).toEqual({
      builds: 1,
      skills: data.builds[0]!.skill_nodes.length,
      priorities: data.builds[0]!.priorities.length,
      constellations: data.builds[0]!.constellations.length,
      entries: data.tierLists[0]!.entries.length,
    });
    expect(await seedData(importer!, data)).toEqual(expected);
    expect(await counts()).toEqual(first);
    const visibility = (
      await admin!.query(`SELECT
      (SELECT count(*) FROM v_public_builds)::int AS builds,
      (SELECT count(*) FROM v_public_build_documents)::int AS documents,
      (SELECT count(*) FROM v_public_tier_entries)::int AS entries`)
    ).rows[0];
    expect(visibility).toEqual({ builds: 1, documents: 1, entries: 46 });
    const state = (await admin!.query('SELECT review_state, rights_status FROM builds')).rows[0];
    expect(state).toEqual({ review_state: 'publicado', rights_status: 'own_original' });
    const unknown = await admin!.query(
      "SELECT count(*)::int AS count FROM tier_entries WHERE entry_kind='placeholder' AND playstyle IS NOT NULL",
    );
    expect(unknown.rows[0].count).toBe(0);
  });

  it('round-trips a complete synthetic published guide through the public SQL projection', async () => {
    const document = contractDoc('synthetic-public-guide', {
      review_state: 'publicado',
      rights_status: 'own_original',
      rights_confirmed_by: 'Confirmación sintética',
      rights_confirmed_on: '2026-11-09',
      reviewed_by: 'Revisor sintético',
      published_at: '2026-11-09',
    });
    await seedData(importer!, prepareSeed({ ...data, builds: [...data.builds, document] }));
    const actual = (
      await admin!.query(
        "SELECT document FROM v_public_build_documents WHERE slug='synthetic-public-guide'",
      )
    ).rows[0].document;
    const pick = (keys: string[], source: object) =>
      Object.fromEntries(keys.map((key) => [key, (source as Record<string, unknown>)[key]]));
    const expected = PublicBuildSchema.parse({
      ...pick(Object.keys(PublicBuildSchema.shape), document),
      author: pick(Object.keys(PublicAuthorSchema.shape), document.author),
      sources: document.sources.map((source) =>
        pick(Object.keys(PublicSourceSchema.shape), source),
      ),
    });
    expect(PublicBuildSchema.parse(actual)).toEqual(expected);
  });

  it('rolls back earlier writes when a later constraint fails', async () => {
    const modified = structuredClone(data);
    modified.authors[0]!.display_name = 'Must roll back';
    const client = importer!;
    await admin!.query(
      `ALTER TABLE build_notes ADD CONSTRAINT seed_rollback_probe CHECK (false) NOT VALID`,
    );
    try {
      await expect(seedData(client, modified)).rejects.toThrow('database-failed');
      const author = await admin!.query('SELECT display_name FROM authors WHERE slug=$1', [
        modified.authors[0]!.slug,
      ]);
      expect(author.rows[0].display_name).toBe(data.authors[0]!.display_name);
    } finally {
      await admin!.query('ALTER TABLE build_notes DROP CONSTRAINT seed_rollback_probe');
    }
  });

  it('does not overwrite an editor row inserted between the existence check and upsert', async () => {
    const modified = structuredClone(data);
    modified.authors.push({
      slug: 'concurrent-editor',
      display_name: 'Fixture',
      bio: null,
      url: null,
      is_placeholder: false,
    });
    let inserted = false;
    const client = {
      query: async (sql: string, values?: unknown[]) => {
        const result = await importer!.query(sql, values);
        if (
          !inserted &&
          sql.startsWith('SELECT origin FROM "authors"') &&
          values?.[0] === 'concurrent-editor'
        ) {
          inserted = true;
          await admin!.query(
            "INSERT INTO authors (slug, display_name, origin) VALUES ('concurrent-editor', 'Editor-owned', 'editor')",
          );
        }
        return result;
      },
    };
    await expect(seedData(client, modified)).rejects.toThrow('owned-content');
    expect(
      (
        await admin!.query(
          "SELECT display_name, origin FROM authors WHERE slug='concurrent-editor'",
        )
      ).rows[0],
    ).toEqual({ display_name: 'Editor-owned', origin: 'editor' });
  });

  it('refuses bootstrap and editor-owned records without changing stored content', async () => {
    const slug = data.authors[0]!.slug;
    await admin!.query("UPDATE authors SET origin='editor' WHERE slug=$1", [slug]);
    await expect(seedData(importer!, data)).rejects.toThrow('owned-content');
    await admin!.query("UPDATE authors SET origin='fixture' WHERE slug=$1", [slug]);
    await admin!.query(
      "INSERT INTO content_origin (bootstrapped_at, payload_hash, migration_version) VALUES (CURRENT_TIMESTAMP, 'synthetic-hash', 'test')",
    );
    await expect(seedData(importer!, data)).rejects.toThrow('bootstrapped');
    expect((await admin!.query('SELECT count(*)::int AS count FROM builds')).rows[0].count).toBe(2);
  });
});
