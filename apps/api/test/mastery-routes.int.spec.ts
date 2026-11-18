/**
 * T023 (spec 003): the catalog HTTP routes against real PostgreSQL. The versioned catalog
 * (`fixtures/content/mastery-trees/*.json`) is loaded with `importer`; the server reads it with the
 * `api_ro` pool built by `createDatabaseContentRepository`, exactly as `server.ts` does.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, PublicMasteryTreeSchema, type MasteryTree } from '@gd/domain';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabaseContentRepository } from '../src/content/repository.js';
import { checkDatabaseReadiness } from '../src/db/readiness.mjs';

const root = join(import.meta.dirname, '../../..');
const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(root, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const enabled = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const suite = enabled ? describe : describe.skip;
const DB = 'gd_mastery_routes_test';
const fixtureDir = join(root, 'fixtures/content/mastery-trees');
/** Public contract (S-004): the source fixture minus the game's texture path. */
const publicOf = (tree: MasteryTree): unknown => ({
  ...tree,
  nodes: tree.nodes.map((node) => {
    const copy: Record<string, unknown> = { ...node };
    delete copy['icon'];
    return copy;
  }),
});

const fixtures: MasteryTree[] = readdirSync(fixtureDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => MasteryTreeSchema.parse(JSON.parse(readFileSync(join(fixtureDir, f), 'utf8'))));

let container: string | undefined;
let work: string | undefined;
let app: ReturnType<typeof buildApp> | undefined;

function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('Mastery routes PostgreSQL fixture command failed');
  return result.stdout.trim();
}

// T055: cases shell out to docker exec/psql or spawn the API against a real PostgreSQL; under CPU
// load they can exceed vitest's default 5 s testTimeout, so the suite carries its own timeout.
const SUITE_OPTIONS = { timeout: 30_000 };
suite('mastery catalog HTTP routes on real PostgreSQL (spec 003 T023)', SUITE_OPTIONS, () => {
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-mastery-routes-${process.pid}-${randomBytes(4).toString('hex')}`;
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
    if (!ready) throw new Error('Mastery routes PostgreSQL fixture did not start');
    const port = Number(
      docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        container,
      ]),
    );
    const admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: DB });
    await admin.connect();
    try {
      await admin.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor NOLOGIN; CREATE ROLE api_ro LOGIN;
        GRANT CREATE ON DATABASE ${DB} TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
      await migrate(drizzle(admin), { migrationsFolder: join(root, 'apps/api/drizzle') });
      await admin.query(
        'GRANT USAGE ON SCHEMA drizzle TO api_ro; GRANT SELECT ON drizzle.__drizzle_migrations TO api_ro',
      );
    } finally {
      await admin.end();
    }
    const importer = new pg.Client({ host: '127.0.0.1', port, user: 'importer', database: DB });
    await importer.connect();
    try {
      for (const tree of fixtures) {
        await importer.query(
          `INSERT INTO mastery_trees (id, slug, name_en, name_es, game_version, source_sha256)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            tree.mastery.id,
            tree.mastery.slug,
            tree.mastery.name.en,
            tree.mastery.name.es,
            tree.game_version,
            tree.source.sha256,
          ],
        );
      }
      // Parents first (tier order) so the composite FK holds without deferral.
      for (const tree of fixtures) {
        for (const n of [...tree.nodes].sort((a, b) => a.tier - b.tier)) {
          await importer.query(
            `INSERT INTO catalog_skill_nodes (id, mastery_id, name_en, name_es, kind, circular, tier,
               bar_required, grid_col, grid_row, max_points, ultimate_points, parent_id, icon, icon_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
              n.id,
              tree.mastery.id,
              n.name.en,
              n.name.es,
              n.kind,
              n.circular,
              n.tier,
              n.bar_required,
              n.grid.col,
              n.grid.row,
              n.max_points,
              n.ultimate_points ?? null,
              n.parent_id,
              n.icon ?? null,
              n.icon_id ?? null,
            ],
          );
        }
      }
    } finally {
      await importer.end();
    }
    work = mkdtempSync(join(realpathSync(tmpdir()), 'gd-mastery-routes-'));
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
    if (container) spawnSync('docker', ['rm', '--force', container], { windowsHide: true });
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('loads the real catalog: 6 masteries, 186 nodes', () => {
    expect(fixtures).toHaveLength(6);
    expect(fixtures.reduce((sum, t) => sum + t.nodes.length, 0)).toBe(186);
  });

  it('GET /api/v1/masteries lists the 6 masteries ordered by slug', async () => {
    const response = await app!.inject('/api/v1/masteries');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const list = response.json<{ slug: string; node_count: number }[]>();
    expect(list).toHaveLength(6);
    expect(list.map((s) => s.slug)).toEqual(fixtures.map((t) => t.mastery.slug).sort());
    expect(list.reduce((sum, s) => sum + s.node_count, 0)).toBe(186);
    for (const s of list) {
      const t = fixtures.find((f) => f.mastery.slug === s.slug)!;
      expect(s).toEqual({
        id: t.mastery.id,
        slug: t.mastery.slug,
        name: t.mastery.name,
        game_version: t.game_version,
        node_count: t.nodes.length,
      });
    }
  });

  it.each(fixtures.map((t) => [t.mastery.slug, t] as const))(
    'GET /api/v1/masteries/%s returns the tree equal to its fixture without the game texture path',
    async (slug, expected) => {
      const response = await app!.inject(`/api/v1/masteries/${slug}`);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(publicOf(expected));
      expect(PublicMasteryTreeSchema.safeParse(response.json()).success).toBe(true);
      // Exact checks: no `icon` key and none of the texture paths; `icon_id` is public.
      expect(response.body).not.toMatch(/"icon"\s*:/);
      expect(response.body).not.toMatch(/\.tex/);
      for (const node of expected.nodes) {
        if (node.icon) expect(response.body, node.icon).not.toContain(node.icon);
      }
      expect(response.body).toMatch(/"icon_id"\s*:\s*"ic-[0-9a-f]{16}"/);
    },
  );

  it('answers 404 for unknown and malformed slugs', async () => {
    for (const slug of [
      'does-not-exist',
      'Bad_Slug',
      "x'%3B%20DROP%20TABLE%20mastery_trees%3B--",
    ]) {
      const response = await app!.inject(`/api/v1/masteries/${slug}`);
      expect(response.statusCode, slug).toBe(404);
      expect(response.json()).toEqual({ error: 'not_found' });
    }
  });

  it('exposes no internal column in any response', async () => {
    const bodies = [
      (await app!.inject('/api/v1/masteries')).body,
      (await app!.inject('/api/v1/masteries/soldier')).body,
    ].join('');
    expect(bodies).not.toMatch(
      /created_at|updated_at|mastery_id|grid_col|grid_row|node_count":null/,
    );
  });

  it('keeps the existing content routes working next to the catalog', async () => {
    expect((await app!.inject('/api/v1/builds')).statusCode).toBe(200);
    expect((await app!.inject('/health')).statusCode).toBe(200);
  });
});
