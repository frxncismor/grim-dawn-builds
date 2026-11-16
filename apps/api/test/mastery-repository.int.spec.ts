/**
 * T009 (spec 003): the catalog read repository against real PostgreSQL. The versioned catalog
 * (`fixtures/content/mastery-trees/*.json`) is loaded with `importer`, read back with `api_ro`.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, PublicMasteryTreeSchema, type MasteryTree } from '@gd/domain';
import {
  CatalogUnavailableError,
  PostgresMasteryRepository,
} from '../src/catalog/mastery-repository.js';

const root = join(import.meta.dirname, '../../..');
const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(root, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const enabled = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const suite = enabled ? describe : describe.skip;
const DB = 'gd_mastery_repo_test';
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
let apiRo: pg.Pool | undefined;
let repo: PostgresMasteryRepository;

function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('Mastery PostgreSQL fixture command failed');
  return result.stdout.trim();
}

suite('mastery catalog repository on real PostgreSQL (spec 003 T009)', () => {
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-mastery-repo-${process.pid}-${randomBytes(4).toString('hex')}`;
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
    if (!ready) throw new Error('Mastery PostgreSQL fixture did not start');
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
    apiRo = new pg.Pool({ host: '127.0.0.1', port, user: 'api_ro', database: DB, max: 2 });
    repo = new PostgresMasteryRepository(apiRo);
  }, 120000);

  afterAll(async () => {
    await apiRo?.end();
    if (container) spawnSync('docker', ['rm', '--force', container], { windowsHide: true });
  });

  it('loads the real catalog: 6 masteries, 186 nodes', () => {
    expect(fixtures).toHaveLength(6);
    expect(fixtures.reduce((sum, t) => sum + t.nodes.length, 0)).toBe(186);
  });

  it('lists every mastery with its node count, ordered by slug', async () => {
    const list = await repo.listTrees();
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
    'returns %s equal to its versioned fixture without the game texture path',
    async (slug, expected) => {
      const tree = await repo.findTree(slug);
      expect(tree).toEqual(publicOf(expected));
      expect(PublicMasteryTreeSchema.safeParse(tree).success).toBe(true);
      // Exact checks: no `icon` key and none of the texture paths; `icon_id` is public.
      const json = JSON.stringify(tree);
      expect(json).not.toMatch(/"icon"\s*:/);
      expect(json).not.toMatch(/\.tex/);
      for (const node of expected.nodes) {
        if (node.icon) expect(json, node.icon).not.toContain(node.icon);
      }
      expect(json).toMatch(/"icon_id"\s*:\s*"ic-[0-9a-f]{16}"/);
    },
  );

  it('returns null for unknown or malformed slugs', async () => {
    expect(await repo.findTree('does-not-exist')).toBeNull();
    expect(await repo.findTree("x'; DROP TABLE mastery_trees;--")).toBeNull();
  });

  it('exposes no key outside the schema', async () => {
    const tree = (await repo.findTree('soldier'))!;
    expect(Object.keys(tree).sort()).toEqual(['game_version', 'mastery', 'nodes', 'source']);
    const allowed = new Set([
      'id',
      'name',
      'kind',
      'circular',
      'tier',
      'bar_required',
      'max_points',
      'ultimate_points',
      'grid',
      'parent_id',
      'icon_id', // public icon handle (spec004 T025); the texture path `icon` stays out
    ]);
    for (const n of tree.nodes) for (const k of Object.keys(n)) expect(allowed.has(k)).toBe(true);
    expect(JSON.stringify(tree)).not.toMatch(/created_at|updated_at|mastery_id|grid_col/);
  });

  it('api_ro cannot touch the base tables, so the repository reads views only', async () => {
    await expect(apiRo!.query('SELECT 1 FROM mastery_trees')).rejects.toThrow();
    await expect(apiRo!.query('SELECT 1 FROM catalog_skill_nodes')).rejects.toThrow();
  });

  it('maps database failures to an opaque error', async () => {
    const broken = new PostgresMasteryRepository({
      query: () => Promise.reject(new Error('password=secret host=db')),
    });
    await expect(broken.listTrees()).rejects.toThrow(CatalogUnavailableError);
    await expect(broken.findTree('soldier')).rejects.toMatchObject({
      message: 'catalog_unavailable',
    });
  });
});
