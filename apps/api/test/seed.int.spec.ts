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
import {
  prepareSeed,
  readSeedFixtures,
  seedCatalog,
  seedData,
  type SeedData,
} from '../src/db/seed.mjs';

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

// T055: cases shell out to docker exec/psql or spawn the API against a real PostgreSQL; under CPU
// load they can exceed vitest's default 5 s testTimeout, so the suite carries its own timeout.
const SUITE_OPTIONS = { timeout: 30_000 };
suite('fixture import with a real restricted PostgreSQL role (T-059)', SUITE_OPTIONS, () => {
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
    data = await readSeedFixtures(join(root, 'fixtures/content'));
  }, 90000);
  afterAll(async () => {
    await importer?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (container) docker(['rm', '--force', container]);
  });

  it('loads real fixtures twice without duplicating roots or child collections', async () => {
    const expected = { builds: 1, tierLists: 1, masteries: 6, nodes: 186 };
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

  it('seeds a guide that stops using a mastery together with the catalog that retires it (T036, C-003)', async () => {
    await seedData(importer!, data);
    const used = (
      await admin!.query(
        `SELECT DISTINCT c.mastery_id FROM build_skill_nodes b
         JOIN catalog_skill_nodes c ON c.id = b.skill_node_id ORDER BY 1`,
      )
    ).rows.map((r) => r.mastery_id as string);
    const retired = used[0]!;
    const build = data.builds[0]!;
    const kept = build.skill_nodes.filter((n) => !n.skill_node_id?.startsWith(`${retired}/`));
    const keptSlugs = new Set(kept.map((n) => n.slug));
    const rewritten: SeedData = {
      ...data,
      catalog: data.catalog.filter((t) => t.mastery.id !== retired),
      builds: [
        {
          ...build,
          skill_nodes: kept,
          priorities: build.priorities.map((p) => ({
            ...p,
            skill_node_slugs: p.skill_node_slugs.filter((slug) => keptSlugs.has(slug)),
          })),
        },
      ],
    };
    expect(rewritten.builds[0]!.skill_nodes.length).toBeLessThan(build.skill_nodes.length);
    try {
      await seedData(importer!, rewritten);
      expect(
        (await admin!.query('SELECT 1 FROM mastery_trees WHERE id = $1', [retired])).rowCount,
      ).toBe(0);
    } finally {
      await seedData(importer!, data);
    }
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

  describe('mastery catalog (spec 003 T024)', () => {
    const snapshot = async () =>
      (
        await admin!.query(`SELECT
        (SELECT json_agg(t ORDER BY id) FROM (SELECT id, slug, name_en, name_es, game_version, source_sha256, created_at FROM mastery_trees) t) AS trees,
        (SELECT json_agg(n ORDER BY id) FROM (SELECT id, mastery_id, name_en, name_es, kind, circular, tier, bar_required, grid_col, grid_row, max_points, ultimate_points, parent_id, icon, created_at FROM catalog_skill_nodes) n) AS nodes`)
      ).rows[0];
    const asApiRo = async (sql: string) => {
      await admin!.query('SET ROLE api_ro');
      try {
        return (await admin!.query(sql)).rows[0];
      } finally {
        await admin!.query('RESET ROLE');
      }
    };

    it('api_ro sees 6 masteries and 186 nodes after seeding, and a second run keeps the same state', async () => {
      await seedCatalog(importer!, data.catalog);
      expect(
        await asApiRo(
          'SELECT (SELECT count(*) FROM v_public_mastery_trees)::int AS m, (SELECT count(*) FROM v_public_skill_nodes)::int AS n',
        ),
      ).toEqual({ m: 6, n: 186 });
      const first = await snapshot();
      await seedCatalog(importer!, data.catalog);
      expect(await snapshot()).toEqual(first);
    });

    it('reflects a fixture regenerated with one node fewer (stale node and re-pointed child)', async () => {
      const modified = structuredClone(data);
      const tree = modified.catalog[0]!;
      const victim = tree.nodes.find((n) => n.parent_id !== null && n.tier >= 3)!;
      const kids = tree.nodes.filter((n) => n.parent_id === victim.id);
      for (const k of kids) k.parent_id = victim.parent_id; // keep schema-valid parent chain
      tree.nodes = tree.nodes.filter((n) => n.id !== victim.id);
      await seedCatalog(importer!, modified.catalog);
      const rows = await admin!.query('SELECT count(*)::int AS n FROM catalog_skill_nodes');
      expect(rows.rows[0].n).toBe(185);
      expect(
        (await admin!.query('SELECT 1 FROM catalog_skill_nodes WHERE id=$1', [victim.id])).rowCount,
      ).toBe(0);
      await seedCatalog(importer!, data.catalog);
      expect(
        (await admin!.query('SELECT count(*)::int AS n FROM catalog_skill_nodes')).rows[0].n,
      ).toBe(186);
    });

    const retiredTree = (): SeedData['catalog'][number] => ({
      mastery: { id: 'class09', slug: 'retired-test', name: { en: 'Retired', es: 'Retirada' } },
      game_version: data.catalog[0]!.game_version,
      source: { game_version: data.catalog[0]!.game_version, sha256: ['b'.repeat(64)] },
      nodes: [
        {
          id: 'class09/root',
          name: { en: 'Root', es: 'Raíz' },
          kind: 'active',
          circular: false,
          tier: 1,
          bar_required: 1,
          max_points: 5,
          grid: { col: 1, row: 0 },
          parent_id: null,
        },
      ],
    });

    it('retires a mastery absent from the catalog together with its nodes when no guide uses it (T007)', async () => {
      await seedCatalog(importer!, [...data.catalog, retiredTree()]);
      expect(
        (await admin!.query("SELECT count(*)::int AS n FROM mastery_trees WHERE id='class09'"))
          .rows[0].n,
      ).toBe(1);
      await expect(seedCatalog(importer!, data.catalog)).resolves.toEqual({
        masteries: 6,
        nodes: 186,
      });
      expect((await admin!.query('SELECT count(*)::int AS n FROM mastery_trees')).rows[0].n).toBe(
        6,
      );
      expect(
        (
          await admin!.query(
            "SELECT count(*)::int AS n FROM catalog_skill_nodes WHERE mastery_id='class09'",
          )
        ).rows[0].n,
      ).toBe(0);
    });

    it('aborts without partial changes and names the mastery when a guide uses a retired one (T007)', async () => {
      const used = (
        await admin!.query(
          `SELECT DISTINCT c.mastery_id FROM build_skill_nodes b
           JOIN catalog_skill_nodes c ON c.id = b.skill_node_id ORDER BY 1`,
        )
      ).rows.map((r) => r.mastery_id as string);
      expect(used.length).toBeGreaterThan(0);
      const retired = used[0]!;
      const before = await snapshot();
      const modified = structuredClone(data.catalog).filter((t) => t.mastery.id !== retired);
      modified[0]!.mastery.name.en = 'Must not persist';
      const failure = await seedCatalog(importer!, modified).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(failure).toMatchObject({ name: 'SeedError', code: 'reference' });
      expect((failure as Error).message).toContain(retired);
      expect(failure).toMatchObject({ detail: retired });
      expect((failure as Error).message).not.toMatch(/DELETE|violates|catalog_skill_nodes/i);
      expect(await snapshot()).toEqual(before);
    });

    it('does not retire anything when the catalog still lists every mastery (T007)', async () => {
      const before = await snapshot();
      await seedCatalog(importer!, data.catalog);
      await seedCatalog(importer!, data.catalog);
      expect(await snapshot()).toEqual(before);
    });

    it('rolls the whole catalog back if one tree cannot be written', async () => {
      const before = await snapshot();
      const modified = structuredClone(data.catalog);
      modified[5]!.nodes[0]!.name.en = 'Must roll back';
      modified[5]!.nodes[1]!.grid.row = modified[5]!.nodes[2]!.grid.row;
      modified[5]!.nodes[1]!.grid.col = modified[5]!.nodes[2]!.grid.col;
      await expect(seedCatalog(importer!, modified)).rejects.toThrow('database-failed');
      expect(await snapshot()).toEqual(before);
    });
  });
});
