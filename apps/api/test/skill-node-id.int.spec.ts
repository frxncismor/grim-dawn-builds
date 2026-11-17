/**
 * T031 (spec 003): `skill_node_id` end to end on real PostgreSQL. Real fixtures -> `seedData`
 * (catalog + guides, as `importer`) -> `GET /api/v1/builds/:slug` served by the `api_ro` pool.
 * The database itself rejects an unknown id and an id of another mastery.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabaseContentRepository } from '../src/content/repository.js';
import { checkDatabaseReadiness } from '../src/db/readiness.mjs';
import { readSeedFixtures, seedCatalog, seedData, type SeedData } from '../src/db/seed.mjs';

const root = join(import.meta.dirname, '../../..');
const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(root, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const enabled = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const suite = enabled ? describe : describe.skip;
const DB = 'gd_skill_node_id_test';
const SLUG = 'chaman-demoledor-golpe-primigenio';

let container: string | undefined;
let work: string | undefined;
let app: ReturnType<typeof buildApp> | undefined;
let admin: pg.Client | undefined;
let importer: pg.Client | undefined;
let data: SeedData;

function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('skill_node_id PostgreSQL fixture command failed');
  return result.stdout.trim();
}
const guideNodes = async () => {
  const response = await app!.inject(`/api/v1/builds/${SLUG}`);
  expect(response.statusCode).toBe(200);
  return (response.json() as { skill_nodes: { slug: string; skill_node_id?: string }[] })
    .skill_nodes;
};
const withRef = (nodes: { skill_node_id?: string }[]) => nodes.filter((n) => n.skill_node_id);
const reject = async (sql: string, values: unknown[]) => {
  await importer!.query('BEGIN');
  try {
    await importer!.query(sql, values);
  } catch (error) {
    return error as { code?: string; message: string };
  } finally {
    await importer!.query('ROLLBACK');
  }
  throw new Error('the database accepted a skill_node_id it must reject');
};
const SHAMAN_NODE = `(SELECT id FROM build_skill_nodes WHERE skill_node_id LIKE 'class06/%' LIMIT 1)`;

// T055: cases shell out to docker exec/psql or spawn the API against a real PostgreSQL; under CPU
// load they can exceed vitest's default 5 s testTimeout, so the suite carries its own timeout.
const SUITE_OPTIONS = { timeout: 30_000 };
const SUITE_TITLE = 'guide skill_node_id from fixture to API on real PostgreSQL (spec 003 T031)';
suite(SUITE_TITLE, SUITE_OPTIONS, () => {
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-skill-node-id-${process.pid}-${randomBytes(4).toString('hex')}`;
    docker([
      ...['run', '--detach', '--rm', '--name', container, '--memory', '512m', '--cpus', '0.5'],
      ...[
        '--pids-limit',
        '100',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=256m',
      ],
      ...['--env', `POSTGRES_DB=${DB}`, '--env', 'POSTGRES_HOST_AUTH_METHOD=trust'],
      ...['--publish', '127.0.0.1::5432', image],
    ]);
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      ready =
        spawnSync(
          'docker',
          ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', DB],
          { windowsHide: true, timeout: 10000, stdio: 'ignore' },
        ).status === 0;
      if (!ready) await new Promise((r) => setTimeout(r, 300));
    }
    if (!ready) throw new Error('skill_node_id PostgreSQL fixture did not start');
    const port = Number(
      docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        container,
      ]),
    );
    admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: DB });
    await admin.connect();
    await admin.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor NOLOGIN; CREATE ROLE api_ro LOGIN;
      GRANT CREATE ON DATABASE ${DB} TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
    await migrate(drizzle(admin), { migrationsFolder: join(root, 'apps/api/drizzle') });
    await admin.query('RESET ROLE');
    await admin.query(
      'GRANT USAGE ON SCHEMA drizzle TO api_ro; GRANT SELECT ON drizzle.__drizzle_migrations TO api_ro',
    );
    importer = new pg.Client({ host: '127.0.0.1', port, user: 'importer', database: DB });
    await importer.connect();
    data = await readSeedFixtures(join(root, 'fixtures/content'));
    await seedData(importer, data);
    work = mkdtempSync(join(realpathSync(tmpdir()), 'gd-skill-node-id-'));
    writeFileSync(join(work, 'api-ro.txt'), randomBytes(24).toString('base64url'), { mode: 0o600 });
    const env = {
      DB_HOST: '127.0.0.1',
      DB_PORT: String(port),
      POSTGRES_DB: DB,
      DB_USER_API_RO: 'api_ro',
      DB_PASSWORD_API_RO_FILE: join(work, 'api-ro.txt'),
    };
    const reader = createDatabaseContentRepository(env);
    app = buildApp(loadConfig({ LOG_LEVEL: 'silent' }), {
      content: reader.repository,
      masteries: reader.masteries,
      readiness: () => checkDatabaseReadiness(env),
    });
    app.addHook('onClose', reader.close);
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await importer?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (container) spawnSync('docker', ['rm', '--force', container], { windowsHide: true });
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('serves the 14 skill_node_id of the real guide exactly as the fixture declares them', async () => {
    const expected = data.builds
      .find((b) => b.slug === SLUG)!
      .skill_nodes.filter((n) => n.skill_node_id)
      .map((n) => `${n.slug}=${n.skill_node_id}`);
    expect(expected).toHaveLength(14);
    const served = withRef(await guideNodes()).map((n) => `${n.slug}=${n.skill_node_id}`);
    expect(served.sort()).toEqual(expected.sort());
  });

  it('keeps a guide node without reference working: the field is omitted, not null', async () => {
    await admin!.query(
      `UPDATE build_skill_nodes SET skill_node_id = NULL WHERE id = ${SHAMAN_NODE}`,
    );
    const nodes = await guideNodes();
    expect(withRef(nodes)).toHaveLength(13);
    expect(nodes.some((n) => 'skill_node_id' in n && n.skill_node_id == null)).toBe(false);
    await seedData(importer!, data);
    expect(withRef(await guideNodes())).toHaveLength(14);
  });

  it('rejects an id that is not in the catalog (foreign key)', async () => {
    const error = await reject(
      `UPDATE build_skill_nodes SET skill_node_id = 'class06/does-not-exist' WHERE id = ${SHAMAN_NODE}`,
      [],
    );
    expect(error.code).toBe('23503');
  });

  it('rejects an id of another mastery (trigger): a shaman node pointing at a demolition node', async () => {
    const other = (
      await admin!.query<{ id: string }>(
        "SELECT id FROM catalog_skill_nodes WHERE mastery_id = 'class02' LIMIT 1",
      )
    ).rows[0]!.id;
    const error = await reject(
      `UPDATE build_skill_nodes SET skill_node_id = $1 WHERE id = ${SHAMAN_NODE}`,
      [other],
    );
    expect(error.code).toBe('23514');
    expect(error.message).toMatch(/another mastery/);
  });

  it('seeding a guide whose skill_node_id is of another mastery fails closed and writes nothing', async () => {
    const bad = structuredClone(data);
    const node = bad.builds
      .find((b) => b.slug === SLUG)!
      .skill_nodes.find((n) => n.skill_node_id?.startsWith('class06/'))!;
    node.skill_node_id = data.catalog.find((t) => t.mastery.id === 'class02')!.nodes[0]!.id;
    bad.authors[0]!.display_name = 'Must roll back';
    await expect(seedData(importer!, bad)).rejects.toThrow('database-failed');
    const author = await admin!.query('SELECT display_name FROM authors WHERE slug=$1', [
      bad.authors[0]!.slug,
    ]);
    expect(author.rows[0]!['display_name']).not.toBe('Must roll back');
    expect(withRef(await guideNodes())).toHaveLength(14);
  });

  it('a catalog refresh that drops a node a guide still uses fails closed (ON DELETE RESTRICT)', async () => {
    const trimmed = structuredClone(data.catalog);
    const shaman = trimmed.find((t) => t.mastery.id === 'class06')!;
    shaman.nodes = shaman.nodes.filter((n) => n.id !== 'class06/savagestrike1b');
    await expect(seedCatalog(importer!, trimmed)).rejects.toThrow('reference: class06');
    const left = await admin!.query(
      "SELECT count(*)::int AS n FROM catalog_skill_nodes WHERE id = 'class06/savagestrike1b'",
    );
    expect(left.rows[0]!['n']).toBe(1);
    expect(withRef(await guideNodes())).toHaveLength(14);
  });

  it('rejects a second node of the same guide pointing at the same catalog node (unique index, T035)', async () => {
    const error = await reject(
      `UPDATE build_skill_nodes SET skill_node_id = (SELECT skill_node_id FROM build_skill_nodes WHERE skill_node_id LIKE 'class06/%' LIMIT 1)
       WHERE id = (SELECT id FROM build_skill_nodes WHERE skill_node_id LIKE 'class06/%' OFFSET 1 LIMIT 1)`,
      [],
    );
    expect(error.code).toBe('23505');
    expect(error.message).toMatch(/build_skill_node_uq/);
  });

  it('seeding a guide with a duplicated skill_node_id fails closed and writes nothing (T035)', async () => {
    const bad = structuredClone(data);
    const refs = bad.builds
      .find((b) => b.slug === SLUG)!
      .skill_nodes.filter((n) => n.skill_node_id?.startsWith('class06/'));
    refs[1]!.skill_node_id = refs[0]!.skill_node_id!;
    bad.authors[0]!.display_name = 'Must roll back too';
    await expect(seedData(importer!, bad)).rejects.toThrow('database-failed');
    const author = await admin!.query('SELECT display_name FROM authors WHERE slug=$1', [
      bad.authors[0]!.slug,
    ]);
    expect(author.rows[0]!['display_name']).not.toBe('Must roll back too');
    expect(withRef(await guideNodes())).toHaveLength(14);
  });

  describe('same-mastery invariant is revalidated when the other side changes (T035)', () => {
    // Each case runs in a transaction that is rolled back; the deferred check fires at COMMIT.
    const commitFails = async (...statements: string[]) => {
      await importer!.query('BEGIN');
      try {
        for (const sql of statements) await importer!.query(sql);
        await importer!.query('COMMIT');
      } catch (error) {
        await importer!.query('ROLLBACK').catch(() => undefined);
        return error as { code?: string; message: string };
      }
      throw new Error('the database accepted a change that invalidates a guide skill_node_id');
    };

    it('renaming the catalog tree of a referenced mastery fails at COMMIT', async () => {
      const error = await commitFails(
        "UPDATE mastery_trees SET slug = 'shaman-renamed', name_en = 'Shaman Renamed' WHERE id = 'class06'",
      );
      expect(error.code).toBe('23514');
      expect(error.message).toMatch(/another mastery/);
    });

    it('renaming the guide mastery (slug and English name) fails at COMMIT', async () => {
      const error = await commitFails(
        "UPDATE masteries SET slug = 'otra-cosa', name_en = 'Something Else' WHERE slug = 'chaman'",
      );
      expect(error.code).toBe('23514');
    });

    it('moving a guide skill or a catalog node to another mastery fails at COMMIT', async () => {
      const skill = await commitFails(
        `UPDATE skills SET mastery_id = (SELECT id FROM masteries WHERE slug <> 'chaman' LIMIT 1)
         WHERE id = (SELECT skill_id FROM build_skill_nodes WHERE skill_node_id LIKE 'class06/%' LIMIT 1)`,
      );
      expect(skill.code).toBe('23514');
      const node = await commitFails(
        `UPDATE catalog_skill_nodes SET mastery_id = 'class02', parent_id = NULL
         WHERE id = (SELECT skill_node_id FROM build_skill_nodes WHERE skill_node_id LIKE 'class06/%' LIMIT 1)`,
      );
      // Rejected at once by catalog_skill_nodes_id_ck, not by the deferred trigger (see the trigger case below).
      expect(['23514', '23503']).toContain(node.code);
    });

    // B-002 (T040): the acceptance of T035 is that a seed rewriting both sides in one transaction passes in
    // any order. These cases COMMIT for real, assert the final state and restore the original values.
    const TREE =
      "UPDATE mastery_trees SET slug = 'shaman-x', name_en = 'Shaman X' WHERE id = 'class06'";
    const MASTERY =
      "UPDATE masteries SET slug = 'chaman-x', name_en = 'Shaman X' WHERE slug = 'chaman'";
    const TREE_BACK =
      "UPDATE mastery_trees SET slug = 'shaman', name_en = 'Shaman' WHERE id = 'class06'";
    const MASTERY_BACK =
      "UPDATE masteries SET slug = 'chaman', name_en = 'Shaman' WHERE slug = 'chaman-x'";
    const commitOk = async (...statements: string[]) => {
      await importer!.query('BEGIN');
      try {
        for (const sql of statements) await importer!.query(sql);
        await importer!.query('COMMIT');
      } catch (error) {
        await importer!.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    };
    const names = async () =>
      (
        await admin!.query<{ tree: string; mastery: string }>(
          `SELECT t.slug || '/' || t.name_en AS tree, m.slug || '/' || m.name_en AS mastery
           FROM mastery_trees t, masteries m WHERE t.id = 'class06' AND m.slug IN ('chaman', 'chaman-x')`,
        )
      ).rows[0]!;
    let original: { tree: string; mastery: string };
    beforeAll(async () => {
      original = await names();
    });
    afterEach(async () => {
      // Whatever a case left behind, put both sides back together so the next case starts valid.
      await importer!.query('ROLLBACK').catch(() => undefined);
      await commitOk(TREE_BACK, MASTERY_BACK).catch(() => undefined);
      await commitOk(
        "UPDATE masteries SET slug = 'chaman', name_en = 'Shaman' WHERE slug = 'chaman'",
      ).catch(() => undefined);
    });

    it.each([
      ['tree first, then mastery', [TREE, MASTERY]],
      ['mastery first, then tree', [MASTERY, TREE]],
    ] as const)('rewriting both sides in one transaction COMMITs (%s)', async (_label, order) => {
      await commitOk(...order);
      expect(await names()).toEqual({ tree: 'shaman-x/Shaman X', mastery: 'chaman-x/Shaman X' });
      expect(withRef(await guideNodes())).toHaveLength(14);
      await commitOk(MASTERY_BACK, TREE_BACK);
      expect(await names()).toEqual(original);
    });

    it('rewriting both sides to values that no longer match fails at COMMIT with 23514 and changes nothing', async () => {
      const error = await commitFails(
        TREE,
        "UPDATE masteries SET slug = 'chaman-y', name_en = 'Shaman Y' WHERE slug = 'chaman'",
      );
      expect(error.code).toBe('23514');
      expect(error.message).toMatch(/another mastery/);
      expect(await names()).toEqual(original);
    });

    it('the trigger on catalog_skill_nodes.mastery_id exists and is deferred (its effect is unreachable by UPDATE)', async () => {
      // Moving a catalog node to another mastery cannot reach the deferred check: catalog_skill_nodes_id_ck
      // (id prefix = mastery_id) rejects it at once with 23514, and changing the id too is blocked by the
      // non-deferrable FK from build_skill_nodes (23503) or by the immediate 0010 trigger on build_skill_nodes.
      // So the behaviour cannot be exercised end to end; pin the trigger definition instead.
      const trigger = await admin!.query<{
        deferrable: boolean;
        initially: boolean;
        enabled: string;
      }>(
        `SELECT tgdeferrable AS deferrable, tginitdeferred AS initially, tgenabled AS enabled FROM pg_trigger
         WHERE tgname = 'catalog_skill_nodes_revalidate_skill_node_mastery' AND NOT tgisinternal`,
      );
      expect(trigger.rows).toEqual([{ deferrable: true, initially: true, enabled: 'O' }]);
      const immediate = await commitFails(
        `UPDATE catalog_skill_nodes SET mastery_id = 'class02', parent_id = NULL
         WHERE id = (SELECT skill_node_id FROM build_skill_nodes WHERE skill_node_id LIKE 'class06/%' LIMIT 1)`,
      );
      expect(immediate.message).toMatch(/catalog_skill_nodes_id_ck|foreign key|another mastery/);
    });

    it('an unchanged re-seed of catalog and guides still passes (rows rewritten with the same values)', async () => {
      await seedData(importer!, data);
      expect(withRef(await guideNodes())).toHaveLength(14);
    });
  });

  it('the listing endpoint serves the reference too, through the public view only', async () => {
    const list = await app!.inject('/api/v1/builds');
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).toContain('class06/savagestrike1');
  });
});
