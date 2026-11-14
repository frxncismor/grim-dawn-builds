import { describe, expect, it, vi } from 'vitest';
import { contractDoc } from '@gd/domain/testing';
import {
  prepareSeed,
  readSeedFixtures,
  runSeeder,
  seedCatalog,
  seedData,
  SeedError,
  type SeedInput,
} from './seed.mjs';

const raw = (): SeedInput => ({
  builds: [contractDoc('seed-guide')],
  authors: [],
  sources: [],
  tierLists: [],
  assets: [],
  masteries: [
    {
      slug: 'chaman',
      name_es: 'Chamán',
      name_en: 'Shaman',
      accent_token: 'storm',
      fallback_icon: 'mastery-generic',
      asset_slug: null,
    },
  ],
});

describe('local fixture seeder', () => {
  it.each([undefined, '', 'production', 'staging', 'Development'])(
    'rejects APP_ENV=%s before files, secrets or connection',
    async (appEnv) => {
      const read = vi.fn();
      const createClient = vi.fn();
      const err = vi.fn();
      expect(
        await runSeeder({ APP_ENV: appEnv }, { read, createClient, write: { out: vi.fn(), err } }),
      ).toBe(1);
      expect(read).not.toHaveBeenCalled();
      expect(createClient).not.toHaveBeenCalled();
      expect(err).toHaveBeenCalledWith('seed failed: environment');
    },
  );

  it('validates and resolves complete nested resources without promoting drafts', () => {
    const input = raw();
    const before = JSON.stringify(input);
    const data = prepareSeed(input);
    expect(data.builds[0]?.rights_status).toBe('pending');
    expect(data.builds[0]?.review_state).toBe('borrador');
    expect(data.authors).toHaveLength(1);
    expect(data.sources).toHaveLength(1);
    expect(data.builds[0]?.skill_nodes).toHaveLength(1);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('rejects invalid or conflicting content without retaining private input in errors', () => {
    const input = raw();
    input.builds = [{ ...contractDoc('seed-guide'), title: { private_value: 'PRIVATE-CANARY' } }];
    expect(() => prepareSeed(input)).toThrow('invalid-content');
    try {
      prepareSeed(input);
    } catch (error) {
      expect(String(error)).not.toContain('PRIVATE-CANARY');
      expect(error).not.toHaveProperty('cause');
    }
    const conflict = raw();
    conflict.authors = [{ ...contractDoc('seed-guide').author, display_name: 'Conflicto' }];
    expect(() => prepareSeed(conflict)).toThrow('conflicting-resource');
    const missing = raw();
    missing.masteries = [];
    expect(() => prepareSeed(missing)).toThrow('reference');
  });

  it('rejects duplicate guide slugs', () => {
    const input = raw();
    input.builds.push(contractDoc('seed-guide'));
    expect(() => prepareSeed(input)).toThrow('duplicate');
  });

  it('rolls back before writing when bootstrap exists', async () => {
    const commands: string[] = [];
    const client = {
      query: async (sql: string) => {
        commands.push(sql);
        if (sql.includes('current_user'))
          return { rows: [{ role: 'importer', privileged: false }] };
        if (sql.includes('EXISTS')) return { rows: [{ bootstrapped: true }] };
        return { rows: [] };
      },
    };
    await expect(seedData(client, prepareSeed(raw()))).rejects.toThrow('bootstrapped');
    expect(commands.at(-1)).toBe('ROLLBACK');
    expect(commands.some((sql) => sql.includes('INSERT INTO'))).toBe(false);
    expect(commands.findIndex((sql) => sql.startsWith('LOCK TABLE'))).toBeLessThan(
      commands.findIndex((sql) => sql.includes('EXISTS')),
    );
  });

  it('rejects privileged sessions and rolls back database errors without their values', async () => {
    const privileged = { query: async () => ({ rows: [{ role: 'postgres', privileged: true }] }) };
    await expect(seedData(privileged, prepareSeed(raw()))).rejects.toThrow('role');
    const commands: string[] = [];
    const client = {
      query: async (sql: string) => {
        commands.push(sql);
        if (sql.includes('current_user'))
          return { rows: [{ role: 'importer', privileged: false }] };
        if (sql.includes('EXISTS')) return { rows: [{ bootstrapped: false }] };
        if (sql.startsWith('INSERT')) throw new Error('PRIVATE-DATABASE-CANARY');
        return { rows: [] };
      },
    };
    try {
      await seedData(client, prepareSeed(raw()));
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(SeedError);
      expect(String(error)).not.toContain('PRIVATE-DATABASE-CANARY');
    }
    expect(commands.at(-1)).toBe('ROLLBACK');
  });
});

describe('mastery catalog seed (spec 003 T024)', () => {
  const tree = (slug = 'soldier', id = 'class01') => ({
    mastery: { id, slug, name: { en: 'Soldier', es: 'Soldado' } },
    game_version: '1.2.1.0',
    source: { game_version: '1.2.1.0', sha256: ['a'.repeat(64)] },
    nodes: [
      {
        id: `${id}/root`,
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

  it('validates the catalog and fails closed on an invalid tree', () => {
    const ok = prepareSeed({ ...raw(), catalog: [tree()] });
    expect(ok.catalog).toHaveLength(1);
    expect(prepareSeed(raw()).catalog).toEqual([]);
    const bad = { ...tree(), nodes: [] };
    expect(() => prepareSeed({ ...raw(), catalog: [bad] })).toThrow('invalid-content');
    expect(() => prepareSeed({ ...raw(), catalog: [tree(), tree()] })).toThrow('duplicate');
  });

  it('reads and validates mastery-trees from a fixtures root', async () => {
    const { mkdtemp, mkdir, writeFile, cp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const real = fileURLToPath(new URL('../../../../fixtures/content/', import.meta.url));
    const dir = await mkdtemp(join(tmpdir(), 'gd-seed-'));
    await cp(real, dir, { recursive: true });
    const data = await readSeedFixtures(dir);
    expect(data.catalog).toHaveLength(6);
    expect(data.catalog.reduce((n, t) => n + t.nodes.length, 0)).toBe(186);
    await mkdir(join(dir, 'mastery-trees'), { recursive: true });
    await writeFile(join(dir, 'mastery-trees', 'broken.json'), '{"mastery":1}');
    await expect(readSeedFixtures(dir)).rejects.toThrow('invalid-content');
  });

  it('writes the catalog in one transaction, stale nodes removed, parents first', async () => {
    const commands: string[] = [];
    const client = {
      query: async (sql: string) => {
        commands.push(sql);
        if (sql.includes('current_user'))
          return { rows: [{ role: 'importer', privileged: false }] };
        if (sql.includes('EXISTS')) return { rows: [{ bootstrapped: false }] };
        return { rows: [] };
      },
    };
    await seedCatalog(client, prepareSeed({ ...raw(), catalog: [tree()] }).catalog);
    expect(commands[0]).toBe('BEGIN');
    expect(commands.at(-1)).toBe('COMMIT');
    expect(commands.some((s) => s.includes('INSERT INTO mastery_trees'))).toBe(true);
    expect(commands.some((s) => s.includes('DELETE FROM catalog_skill_nodes'))).toBe(true);
  });
});

describe('skill_node_id reaches the database (spec 003 T031)', () => {
  const catalog = {
    mastery: { id: 'class06', slug: 'shaman', name: { en: 'Shaman', es: 'Chamán' } },
    game_version: '1.2.1.0',
    source: { game_version: '1.2.1.0', sha256: ['a'.repeat(64)] },
    nodes: [
      {
        id: 'class06/root',
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
  };
  const run = async (skillNodeId?: string) => {
    const guide = contractDoc('seed-guide');
    if (skillNodeId) guide.skill_nodes[0]!.skill_node_id = skillNodeId;
    const queries: { sql: string; values: unknown[] }[] = [];
    const client = {
      query: async (sql: string, values: unknown[] = []) => {
        queries.push({ sql, values });
        if (sql.includes('current_user'))
          return { rows: [{ role: 'importer', privileged: false }] };
        if (sql.includes('bootstrapped')) return { rows: [{ bootstrapped: false }] };
        if (sql.includes('RETURNING id')) return { rows: [{ id: crypto.randomUUID() }] };
        return { rows: [] };
      },
    };
    await seedData(client, prepareSeed({ ...raw(), builds: [guide], catalog: [catalog] }));
    return queries;
  };

  it('loads the catalog before the guides so the node reference can resolve', async () => {
    const queries = await run('class06/root');
    const catalogAt = queries.findIndex((q) => q.sql.includes('INSERT INTO catalog_skill_nodes'));
    const nodeAt = queries.findIndex((q) => q.sql.includes('INSERT INTO "build_skill_nodes"'));
    expect(catalogAt).toBeGreaterThan(-1);
    expect(nodeAt).toBeGreaterThan(catalogAt);
  });

  it('writes skill_node_id, and NULL when the guide node has no reference', async () => {
    const withRef = (await run('class06/root')).find((q) =>
      q.sql.includes('INSERT INTO "build_skill_nodes"'),
    )!;
    expect(withRef.sql).toContain('"skill_node_id"');
    expect(withRef.values).toContain('class06/root');
    const without = (await run()).find((q) => q.sql.includes('INSERT INTO "build_skill_nodes"'))!;
    expect(without.sql).toContain('"skill_node_id"');
    expect(without.values).toContain(null);
  });
});
