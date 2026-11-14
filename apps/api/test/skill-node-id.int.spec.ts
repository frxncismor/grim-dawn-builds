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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

suite('guide skill_node_id from fixture to API on real PostgreSQL (spec 003 T031)', () => {
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
    await expect(seedCatalog(importer!, trimmed)).rejects.toThrow('database-failed');
    const left = await admin!.query(
      "SELECT count(*)::int AS n FROM catalog_skill_nodes WHERE id = 'class06/savagestrike1b'",
    );
    expect(left.rows[0]!['n']).toBe(1);
    expect(withRef(await guideNodes())).toHaveLength(14);
  });

  it('the listing endpoint serves the reference too, through the public view only', async () => {
    const list = await app!.inject('/api/v1/builds');
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).toContain('class06/savagestrike1');
  });
});
