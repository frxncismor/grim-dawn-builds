/**
 * T008 (spec 003): live PostgreSQL 17 tests for the mastery catalog migration.
 *
 * Proves that `api_ro` reads only `v_public_mastery_trees` / `v_public_skill_nodes`
 * (never the base tables, never writes) and that the CHECK / UNIQUE / FK constraints
 * reject what `CatalogSkillNodeSchema` rejects. Rows are inserted by the test itself.
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');
const COMPOSE_PATH = join(ROOT, 'infra/docker/compose.yaml');
const POSTGRES_IMAGE = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(COMPOSE_PATH, 'utf8'),
)?.[1];
const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const DATABASE = 'gd_mastery_catalog_test';

interface CommandResult {
  readonly status: number;
  readonly output: string;
}

let containerName: string | undefined;

function docker(args: readonly string[], input?: string): CommandResult {
  const result = spawnSync('docker', [...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Docker command failed (${result.error.message})`);
  }
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function expectDockerSuccess(result: CommandResult, label: string): void {
  expect(result.status, `${label}: ${result.output}`).toBe(0);
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const result = docker([
      'exec',
      containerName!,
      'pg_isready',
      '-h',
      '127.0.0.1',
      '-U',
      'postgres',
      '-d',
      DATABASE,
    ]);
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('The isolated PostgreSQL 17 fixture did not become ready');
}

function psql(
  sql: string,
  options: { readonly database?: string; readonly user?: string; readonly tcp?: boolean } = {},
): CommandResult {
  const args = [
    'exec',
    '-i',
    containerName!,
    'psql',
    '--no-psqlrc',
    '--no-align',
    '--tuples-only',
    '--set',
    'ON_ERROR_STOP=1',
    '--set',
    'VERBOSITY=verbose',
  ];
  if (options.tcp) args.push('-h', '127.0.0.1');
  args.push('-U', options.user ?? 'postgres', '-d', options.database ?? DATABASE, '-f', '-');
  return docker(args, sql);
}

/** Runs `sql` in a transaction that is always rolled back, so fixtures stay isolated. */
function inRollback(sql: string): CommandResult {
  return psql(`BEGIN;\n${sql}\nSET CONSTRAINTS ALL IMMEDIATE;\nROLLBACK;`);
}

const TREE = 'class01';
const OTHER_TREE = 'class02';
const BAR = [1, 5, 10, 15, 20, 25, 32, 40, 50];

function tree(id: string, slug: string): string {
  return `INSERT INTO mastery_trees (id, slug, name_en, name_es, game_version, source_sha256)
    VALUES ('${id}', '${slug}', 'Name ${slug}', 'Nombre ${slug}', 'steam-build-1',
            ARRAY['${'a'.repeat(64)}']);`;
}

interface NodeOptions {
  readonly id: string;
  readonly mastery?: string;
  readonly kind?: string;
  readonly tier?: number;
  readonly bar?: number;
  readonly col?: number;
  readonly row?: number;
  readonly max?: number;
  readonly ultimate?: number | null;
  readonly parent?: string | null;
  readonly icon?: string | null;
  readonly iconId?: string | null;
}

const literal = (value: string | number | null | undefined): string =>
  value === null || value === undefined
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : `'${value}'`;

function node(o: NodeOptions): string {
  const tier = o.tier ?? 1;
  return `INSERT INTO catalog_skill_nodes (id, mastery_id, name_en, name_es, kind, circular, tier,
      bar_required, grid_col, grid_row, max_points, ultimate_points, parent_id, icon, icon_id)
    VALUES ('${o.id}', '${o.mastery ?? TREE}', 'En ${o.id}', 'Es ${o.id}', '${o.kind ?? 'active'}',
      false, ${tier}, ${o.bar ?? BAR[tier - 1]}, ${o.col ?? tier}, ${o.row ?? 0}, ${o.max ?? 5},
      ${literal(o.ultimate)}, ${literal(o.parent)}, ${literal(o.icon)}, ${literal(o.iconId)});`;
}

function expectRejected(result: CommandResult, code: string, constraint: string): void {
  expect(result.status, result.output).not.toBe(0);
  expect(result.output, result.output).toContain(code);
  expect(result.output, result.output).toContain(constraint);
}

const databaseSuite = RUN_DB_TESTS ? describe : describe.skip;

databaseSuite('mastery catalog migration (spec 003 T008)', () => {
  beforeAll(async () => {
    if (!POSTGRES_IMAGE || !/@sha256:[a-f0-9]{64}$/.test(POSTGRES_IMAGE)) {
      throw new Error('The Compose file must pin the PostgreSQL 17 fixture image by digest');
    }
    const imagePresent = docker(['image', 'inspect', POSTGRES_IMAGE, '--format', '{{.Id}}']);
    if (imagePresent.status !== 0) {
      throw new Error(
        'The pinned PostgreSQL 17 image is not available locally; the test never pulls it',
      );
    }
    containerName = `gd-mastery-catalog-${process.pid}-${randomBytes(4).toString('hex')}`;
    expectDockerSuccess(
      docker([
        'run',
        '--detach',
        '--rm',
        '--name',
        containerName,
        '--network',
        'none',
        '--memory',
        '512m',
        '--memory-swap',
        '512m',
        '--cpus',
        '0.50',
        '--pids-limit',
        '100',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=256m',
        '--tmpfs',
        '/var/run/postgresql:rw,nosuid,nodev,noexec,size=16m',
        '--env',
        `POSTGRES_DB=${DATABASE}`,
        '--env',
        'POSTGRES_USER=postgres',
        '--env',
        'POSTGRES_HOST_AUTH_METHOD=trust',
        POSTGRES_IMAGE,
      ]),
      'start isolated PostgreSQL container',
    );
    await waitForPostgres();
    expectDockerSuccess(
      psql(`
        CREATE ROLE migrator NOLOGIN;
        CREATE ROLE importer NOLOGIN;
        CREATE ROLE editor NOLOGIN;
        CREATE ROLE api_ro NOLOGIN;
        GRANT CREATE ON DATABASE ${DATABASE} TO migrator;
        GRANT USAGE, CREATE ON SCHEMA public TO migrator;
        CREATE SCHEMA drizzle AUTHORIZATION migrator;
        ALTER ROLE migrator LOGIN;
        ALTER ROLE api_ro LOGIN;
        ALTER ROLE importer LOGIN;
      `),
      'prepare restricted roles',
    );
    expectDockerSuccess(
      psql(
        `CREATE TABLE drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);`,
        { user: 'migrator', tcp: true },
      ),
      'prepare the Drizzle journal',
    );
    const journal = JSON.parse(
      readFileSync(join(ROOT, 'apps/api/drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((e) => e.tag)).toContain('0009_mastery_catalog');
    const pending = journal.entries
      .map((entry) => readFileSync(join(ROOT, `apps/api/drizzle/${entry.tag}.sql`), 'utf8'))
      .join('\n');
    expectDockerSuccess(
      psql(`BEGIN;\n${pending}\nCOMMIT;`, { user: 'migrator', tcp: true }),
      'apply every migration in one transaction as migrator',
    );
    expectDockerSuccess(
      psql(`BEGIN;
        ${tree(TREE, 'soldier')}
        ${tree(OTHER_TREE, 'demolition')}
        ${node({ id: 'class01/root', tier: 1, row: 4, icon: 'icon.tex', iconId: 'ic-0123456789abcdef' })}
        ${node({ id: 'class01/child', tier: 2, row: 4, parent: 'class01/root', max: 5, ultimate: 8, kind: 'modifier' })}
        ${node({ id: 'class02/root', mastery: OTHER_TREE, tier: 1, row: 4 })}
        COMMIT;`),
      'insert the catalog rows as owner',
    );
  }, 90_000);

  afterAll(() => {
    if (containerName) docker(['rm', '--force', containerName]);
  });

  it('api_ro reads both public views with the contract columns', () => {
    const trees = psql('SELECT row_to_json(t)::text FROM v_public_mastery_trees t ORDER BY id', {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(trees, 'read v_public_mastery_trees as api_ro');
    expect(trees.output).toContain('"slug":"soldier"');
    expect(trees.output).toContain('"name_es":"Nombre soldier"');
    expect(trees.output).toContain('"game_version":"steam-build-1"');
    expect(trees.output).not.toMatch(/created_at|updated_at/);
    const nodes = psql(
      "SELECT row_to_json(n)::text FROM v_public_skill_nodes n WHERE id = 'class01/child'",
      { user: 'api_ro', tcp: true },
    );
    expectDockerSuccess(nodes, 'read v_public_skill_nodes as api_ro');
    for (const field of [
      '"mastery_id":"class01"',
      '"kind":"modifier"',
      '"circular":false',
      '"tier":2',
      '"bar_required":5',
      '"grid_col":2',
      '"grid_row":4',
      '"max_points":5',
      '"ultimate_points":8',
      '"parent_id":"class01/root"',
    ]) {
      expect(nodes.output, field).toContain(field);
    }
    expect(nodes.output).not.toMatch(/created_at|updated_at/);
    // S-004: the base table keeps `icon` (texture path); the public view exposes only `icon_id`.
    expect(nodes.output).not.toMatch(/"icon"\s*:/);
    expect(nodes.output).not.toContain('icon.tex');
    expect(nodes.output).toContain('"icon_id":null');
    // The root row carries both a texture path and an icon id in the base table.
    const root = psql(
      "SELECT row_to_json(n)::text FROM v_public_skill_nodes n WHERE id = 'class01/root'",
      { user: 'api_ro', tcp: true },
    );
    expectDockerSuccess(root, 'read the root node as api_ro');
    expect(root.output).toContain('"icon_id":"ic-0123456789abcdef"');
    expect(root.output).not.toMatch(/"icon"\s*:/);
    expect(root.output).not.toContain('icon.tex');
    const columns = psql(
      "SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name = 'v_public_skill_nodes'",
      { user: 'api_ro', tcp: true },
    );
    expectDockerSuccess(columns, 'list v_public_skill_nodes columns');
    const names = columns.output.trim().split(',');
    expect(names).not.toContain('icon');
    expect(names).toContain('icon_id');
    const count = psql('SELECT count(*) FROM v_public_skill_nodes', { user: 'api_ro', tcp: true });
    expect(count.output.trim()).toBe('3');
  });

  it('api_ro cannot read or write the base tables, nor write the views', () => {
    for (const table of ['mastery_trees', 'catalog_skill_nodes']) {
      const read = psql(`SELECT count(*) FROM ${table}`, { user: 'api_ro', tcp: true });
      expect(read.status, table).not.toBe(0);
      expect(read.output, table).toContain('42501');
      const write = psql(`DELETE FROM ${table}`, { user: 'api_ro', tcp: true });
      expect(write.status, table).not.toBe(0);
      expect(write.output, table).toContain('42501');
      const acl = psql(`SELECT has_table_privilege('api_ro', '${table}', 'SELECT')
        OR has_table_privilege('api_ro', '${table}', 'INSERT')
        OR has_table_privilege('api_ro', '${table}', 'UPDATE')
        OR has_table_privilege('api_ro', '${table}', 'DELETE')`);
      expect(acl.output.trim(), table).toBe('f');
    }
    for (const view of ['v_public_mastery_trees', 'v_public_skill_nodes']) {
      const write = psql(`DELETE FROM ${view}`, { user: 'api_ro', tcp: true });
      expect(write.status, view).not.toBe(0);
      expect(write.output, view).toMatch(/42501|55000/);
      const acl = psql(`SELECT has_table_privilege('api_ro', '${view}', 'SELECT')
        AND NOT has_table_privilege('api_ro', '${view}', 'INSERT')
        AND NOT has_table_privilege('api_ro', '${view}', 'UPDATE')
        AND NOT has_table_privilege('api_ro', '${view}', 'DELETE')`);
      expect(acl.output.trim(), view).toBe('t');
    }
  });

  it('importer maintains the catalog; editor has no access', () => {
    const importer = psql(
      `BEGIN; ${tree('class03', 'nightblade')} ${node({ id: 'class03/root', mastery: 'class03' })} ROLLBACK;`,
      { user: 'importer', tcp: true },
    );
    expectDockerSuccess(importer, 'importer inserts catalog rows');
    const editor = psql(
      `SELECT has_table_privilege('editor', 'mastery_trees', 'SELECT')
         OR has_table_privilege('editor', 'catalog_skill_nodes', 'SELECT')`,
    );
    expect(editor.output.trim()).toBe('f');
  });

  const rejected = (sql: string): CommandResult => psql(`BEGIN;\n${sql}\nROLLBACK;`);

  it('rejects a tier outside 1..9 (catalog_skill_nodes_tier_ck)', () => {
    for (const tier of [0, 10]) {
      // CHECKs run in name order: the bar_required table also fails for a tier it does not know.
      const result = rejected(node({ id: 'class01/t', tier, bar: 1, col: tier, row: 1 }));
      expect(result.status, result.output).not.toBe(0);
      expect(result.output).toContain('23514');
      expect(result.output).toMatch(/catalog_skill_nodes_(tier|bar_required)_ck/);
    }
  });

  it('rejects a bar_required that does not match the tier (catalog_skill_nodes_bar_required_ck)', () => {
    expectRejected(
      rejected(node({ id: 'class01/b', tier: 3, bar: 5, row: 1 })),
      '23514',
      'catalog_skill_nodes_bar_required_ck',
    );
  });

  it('rejects a grid column that differs from the tier (catalog_skill_nodes_grid_col_ck)', () => {
    expectRejected(
      rejected(node({ id: 'class01/c', tier: 3, col: 4, row: 1 })),
      '23514',
      'catalog_skill_nodes_grid_col_ck',
    );
  });

  it('rejects a duplicated grid cell inside a mastery but allows it in another (catalog_skill_nodes_grid_cell_uq)', () => {
    expectRejected(
      rejected(node({ id: 'class01/dup', tier: 1, row: 4 })),
      '23505',
      'catalog_skill_nodes_grid_cell_uq',
    );
    expectDockerSuccess(
      rejected(node({ id: 'class02/other', mastery: OTHER_TREE, tier: 2, row: 9 })),
      'same cell in a different mastery is fine',
    );
  });

  it('rejects an invalid kind (skill_kind enum)', () => {
    const result = rejected(node({ id: 'class01/k', kind: 'ultimate', row: 7 }));
    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toContain('22P02');
    expect(result.output).toContain('skill_kind');
  });

  it('rejects ultimate_points below max_points and accepts equal or null (catalog_skill_nodes_ultimate_ck)', () => {
    expectRejected(
      rejected(node({ id: 'class01/u', max: 5, ultimate: 4, row: 7 })),
      '23514',
      'catalog_skill_nodes_ultimate_ck',
    );
    expectDockerSuccess(rejected(node({ id: 'class01/u2', max: 5, ultimate: 5, row: 7 })), 'equal');
    expectDockerSuccess(
      rejected(node({ id: 'class01/u3', max: 5, ultimate: null, row: 7 })),
      'null',
    );
  });

  it('rejects non-positive max_points (catalog_skill_nodes_max_points_ck)', () => {
    expectRejected(
      rejected(node({ id: 'class01/m', max: 0, row: 7 })),
      '23514',
      'catalog_skill_nodes_max_points_ck',
    );
  });

  it('rejects a node that is its own parent (catalog_skill_nodes_no_self_parent_ck)', () => {
    expectRejected(
      rejected(node({ id: 'class01/self', parent: 'class01/self', tier: 2, row: 7 })),
      '23514',
      'catalog_skill_nodes_no_self_parent_ck',
    );
  });

  it('enforces the parent foreign key, inside the same mastery', () => {
    expectRejected(
      rejected(node({ id: 'class01/orphan', parent: 'class01/missing', tier: 2, row: 7 })),
      '23503',
      'catalog_skill_nodes_parent_fk',
    );
    expectRejected(
      rejected(node({ id: 'class01/cross', parent: 'class02/root', tier: 2, row: 7 })),
      '23503',
      'catalog_skill_nodes_parent_fk',
    );
    expectDockerSuccess(
      rejected(node({ id: 'class01/ok', parent: 'class01/root', tier: 2, row: 7 })),
      'valid parent in the same mastery',
    );
  });

  it('keeps node ids inside their mastery prefix and mastery ids as classNN', () => {
    expectRejected(
      rejected(node({ id: 'class02/stray', row: 7 })),
      '23514',
      'catalog_skill_nodes_id_ck',
    );
    expectRejected(rejected(tree('soldier', 'bad-id')), '23514', 'mastery_trees_id_ck');
  });

  it('keeps mastery slugs unique and restricts deleting a tree that still has nodes', () => {
    expectRejected(rejected(tree('class09', 'soldier')), '23505', 'mastery_trees_slug_unique');
    const del = rejected("DELETE FROM mastery_trees WHERE id = 'class01';");
    expect(del.status, del.output).not.toBe(0);
    expect(del.output).toContain('23503');
  });
});
