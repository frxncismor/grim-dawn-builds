import { describe, expect, it, vi } from 'vitest';
import { contractDoc } from '@gd/domain/testing';
import { prepareSeed, runSeeder, seedData, SeedError, type SeedInput } from './seed.mjs';

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
