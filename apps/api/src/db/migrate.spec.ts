import { describe, expect, it, vi } from 'vitest';
import { ConfigError } from '../config/errors.js';
import { RedactedSecret } from '../config/secret-source.js';
import {
  applyMigrations,
  failureCode,
  loadMigrateConfig,
  MigrationMismatchError,
  type MigrationOps,
} from './migrate.mjs';

function operations(initial: readonly string[] = []): MigrationOps & {
  state: string[];
  migrateCount: { value: number };
  lockCount: { value: number };
} {
  const state = [...initial];
  const migrateCount = { value: 0 };
  const lockCount = { value: 0 };
  return {
    state,
    migrateCount,
    lockCount,
    expected: () => ['hash-1', 'hash-2'],
    migrate: async () => {
      migrateCount.value += 1;
      state.splice(0, state.length, 'hash-1', 'hash-2');
    },
    applied: async () => [...state],
    withLock: async (work) => {
      lockCount.value += 1;
      return work();
    },
  };
}

describe('loadMigrateConfig', () => {
  it('validates connection fields and loads a redacted password', () => {
    const config = loadMigrateConfig({ DB_HOST: 'db', DB_PORT: '5433' }, () => ({
      migratorPassword: new RedactedSecret('runtime-secret'),
    }));
    expect(config).toMatchObject({ host: 'db', port: 5433, database: 'gd_dev', user: 'migrator' });
    expect(JSON.stringify(config)).not.toContain('runtime-secret');
    expect(config.password.reveal()).toBe('runtime-secret');
  });

  it('rejects invalid settings without including their values', () => {
    expect(() => loadMigrateConfig({ DB_HOST: 'bad host password-secret' })).toThrow(ConfigError);
    expect(() => loadMigrateConfig({ DB_HOST: 'bad host password-secret' })).not.toThrow(
      /password-secret/,
    );
  });
});

describe('applyMigrations', () => {
  it('applies pending migrations under the lock and is a no-op on the second run', async () => {
    const ops = operations();
    const first = await applyMigrations(ops);
    const second = await applyMigrations(ops);
    expect(first).toMatchObject({ ready: true, reason: 'match', expected: 2, applied: 2 });
    expect(second).toEqual(first);
    expect(ops.migrateCount.value).toBe(2); // Drizzle runs twice; the second run applies nothing.
    expect(ops.lockCount.value).toBe(2);
  });

  it('rejects an incompatible existing history before running migrations', async () => {
    const ops = operations(['unknown-hash']);
    await expect(applyMigrations(ops)).rejects.toBeInstanceOf(MigrationMismatchError);
    expect(ops.migrateCount.value).toBe(0);
  });

  it('fails closed if Drizzle leaves an incomplete history', async () => {
    const ops = operations();
    const incomplete: MigrationOps = {
      ...ops,
      migrate: async () => {
        ops.migrateCount.value += 1;
        ops.state.splice(0, ops.state.length, 'hash-1');
      },
    };
    await expect(applyMigrations(incomplete)).rejects.toMatchObject({
      comparison: { reason: 'pending' },
    });
  });
});

describe('failureCode', () => {
  it('returns a SQLSTATE when present, otherwise a fixed label', () => {
    expect(failureCode({ code: '42P01' })).toBe('42P01');
    expect(failureCode(new Error('sensitive detail'))).toBe('unknown');
    expect(
      failureCode(new ConfigError([{ field: 'DB_PASSWORD_MIGRATOR', code: 'required' }])),
    ).toBe('config');
  });
});

describe('runMigrator', () => {
  it('does not connect or disclose values when required configuration is missing', async () => {
    const err: string[] = [];
    const result = await (
      await import('./migrate.mjs')
    ).runMigrator(
      {},
      {
        out: vi.fn(),
        err: (line) => err.push(line),
      },
    );
    expect(result).toBe(1);
    expect(err.join('\n')).toContain('DB_PASSWORD_MIGRATOR');
    expect(err.join('\n')).not.toContain('secret');
  });
});
