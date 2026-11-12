import { describe, expect, it, vi } from 'vitest';
import { contractDoc } from '@gd/domain/testing';
import { prepareSeed } from './seed.mjs';
import { readExpectedHashes } from './migration-state.js';
import {
  bootstrapData,
  bootstrapPayloadHash,
  contentTableNames,
  runBootstrap,
} from './bootstrap.mjs';

const input = () =>
  prepareSeed({
    builds: [contractDoc('bootstrap-guide')],
    tierLists: [],
    authors: [],
    sources: [],
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
describe('bootstrap boundary and payload', () => {
  it('hashes canonical data deterministically without using object insertion order', () => {
    const data = input();
    expect(bootstrapPayloadHash(data)).toMatch(/^[a-f0-9]{64}$/);
    expect(bootstrapPayloadHash(JSON.parse(JSON.stringify(data)))).toBe(bootstrapPayloadHash(data));
    expect(bootstrapPayloadHash({ a: 1, b: { c: 2, d: 3 } })).toBe(
      bootstrapPayloadHash({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(bootstrapPayloadHash([1, 2])).not.toBe(bootstrapPayloadHash([2, 1]));
    expect(contentTableNames()).toHaveLength(27);
    expect(contentTableNames()).not.toContain('content_origin');
  });
  it('validates before querying the database', async () => {
    const query = vi.fn();
    await expect(
      bootstrapData({ query }, { ...input(), builds: [{ private: 'PRIVATE-CANARY' }] } as never),
    ).rejects.toThrow('invalid-content');
    expect(query).not.toHaveBeenCalled();
  });
  it('refuses nonlocal environments before file or secret I/O', async () => {
    const read = vi.fn();
    const createClient = vi.fn();
    for (const APP_ENV of [undefined, 'production'])
      expect(
        await runBootstrap(
          { APP_ENV },
          { read, createClient, write: { out: vi.fn(), err: vi.fn() } },
        ),
      ).toBe(1);
    expect(read).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
  it('rejects malformed local input before credentials and redacts its contents', async () => {
    const createClient = vi.fn();
    const err = vi.fn();
    expect(
      await runBootstrap(
        { APP_ENV: 'test' },
        {
          read: async () => ({ builds: [{ private: 'PRIVATE-CANARY' }] }) as never,
          createClient,
          write: { out: vi.fn(), err },
        },
      ),
    ).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith('bootstrap failed: invalid-content');
    expect(JSON.stringify(err.mock.calls)).not.toContain('PRIVATE-CANARY');
  });
});
describe('bootstrap transaction refusals', () => {
  it.each(['role', 'already', 'not-empty', 'migration'])(
    'rolls back %s without content or marker mutation',
    async (reason) => {
      const sqls: string[] = [];
      const query = vi.fn(async (sql: string) => {
        sqls.push(sql);
        if (sql.includes('pg_roles'))
          return { rows: [{ role: reason === 'role' ? 'editor' : 'importer', privileged: false }] };
        if (sql.includes('AS bootstrapped'))
          return { rows: [{ bootstrapped: reason === 'already' }] };
        if (sql.includes('AS occupied')) return { rows: [{ occupied: reason === 'not-empty' }] };
        if (sql.includes('__drizzle_migrations'))
          return {
            rows: (reason === 'migration' ? [] : readExpectedHashes()).map((hash) => ({ hash })),
          };
        return { rows: [] };
      });
      await expect(bootstrapData({ query }, input())).rejects.toThrow();
      expect(sqls).toContain('ROLLBACK');
      expect(sqls.some((sql) => /^INSERT|^UPDATE|^DELETE/.test(sql))).toBe(false);
      if (reason === 'not-empty')
        expect(sqls.findIndex((sql) => sql.startsWith('LOCK TABLE "assets"'))).toBeLessThan(
          sqls.findIndex((sql) => sql.includes('AS occupied')),
        );
    },
  );
});
