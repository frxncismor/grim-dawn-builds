import { readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, cp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { SEED_ERROR_CODES } from '@gd/domain';
import { contractDoc } from '@gd/domain/testing';
import { bootstrapData, runBootstrap } from './bootstrap.mjs';
import { readExpectedHashes } from './migration-state.js';
import {
  prepareSeed,
  readSeedFixtures,
  runSeeder,
  seedCatalog,
  seedData,
  SeedError,
  type SeedData,
  type SeedInput,
} from './seed.mjs';
import { retireMasteries } from './write-content.mjs';

/** Spec 005 T036: the operator-facing error contract of the seeder and bootstrap. */

const tree = (id: string, slug: string) => ({
  mastery: { id, slug, name: { en: slug, es: slug } },
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
  catalog: [tree('class01', 'soldier')],
});
const data = (): SeedData => prepareSeed(raw());

/** A fake importer connection; `fkOnRetire` makes the mastery delete fail like the RESTRICT FK. */
const fakeClient = (options: { fkOnRetire?: boolean } = {}) => {
  const commands: string[] = [];
  return {
    commands,
    query: async (sql: string) => {
      commands.push(sql);
      if (sql.includes('current_user') || sql.includes('pg_roles'))
        return { rows: [{ role: 'importer', privileged: false }] };
      if (sql.includes('AS bootstrapped')) return { rows: [{ bootstrapped: false }] };
      if (sql.includes('AS occupied')) return { rows: [{ occupied: false }] };
      if (sql.includes('__drizzle_migrations'))
        return { rows: readExpectedHashes().map((hash) => ({ hash })) };
      if (sql.includes('FROM mastery_trees WHERE id <> ALL')) return { rows: [{ id: 'class09' }] };
      if (sql.includes('RETURNING id')) return { rows: [{ id: crypto.randomUUID() }] };
      if (options.fkOnRetire && sql.startsWith('DELETE FROM mastery_trees'))
        throw Object.assign(new Error('violates foreign key constraint secret_name'), {
          code: '23503',
        });
      return { rows: [] };
    },
    connect: async () => undefined,
    end: async () => undefined,
  };
};

describe('retired mastery reaches the operator (C-001, FR-012)', () => {
  const env = { APP_ENV: 'test', DB_PASSWORD_IMPORTER: 'PRIVATE-PASSWORD' };

  it('the seeder prints the code and the mastery id on stderr, nothing else', async () => {
    const client = fakeClient({ fkOnRetire: true });
    const err = vi.fn();
    const code = await runSeeder(env, {
      read: async () => data(),
      createClient: () => client as never,
      write: { out: vi.fn(), err },
    });
    expect(code).toBe(1);
    expect(err).toHaveBeenCalledExactlyOnceWith('seed failed: reference (class09)');
    const printed = JSON.stringify(err.mock.calls);
    expect(printed).not.toMatch(/secret_name|violates|DELETE|PRIVATE/);
  });

  it('bootstrap prints the same line with its own operation', async () => {
    const client = fakeClient({ fkOnRetire: true });
    const err = vi.fn();
    const code = await runBootstrap(
      {
        APP_ENV: 'test',
        DB_PASSWORD_IMPORTER_FILE: fileURLToPath(import.meta.url),
      },
      {
        read: async () => data(),
        createClient: () => client as never,
        write: { out: vi.fn(), err },
      },
    );
    expect(code).toBe(1);
    expect(err).toHaveBeenCalledExactlyOnceWith('bootstrap failed: reference (class09)');
  });

  it('drops a detail that is not a plain identifier', async () => {
    const err = vi.fn();
    await runSeeder(env, {
      read: async () => {
        throw new SeedError('reference', 'DROP TABLE "x"; -- PRIVATE');
      },
      write: { out: vi.fn(), err },
    });
    expect(err).toHaveBeenCalledExactlyOnceWith('seed failed: reference');
  });
});

describe('empty catalog fails closed (C-002)', () => {
  it('an empty mastery-trees folder is invalid-content, not a retirement of everything', async () => {
    const real = fileURLToPath(new URL('../../../../fixtures/content/', import.meta.url));
    const dir = await mkdtemp(join(tmpdir(), 'gd-seed-empty-'));
    try {
      await cp(real, dir, { recursive: true });
      await mkdir(join(dir, 'mastery-trees'), { recursive: true });
      for (const file of await readdir(join(dir, 'mastery-trees')))
        if (file.endsWith('.json')) await rm(join(dir, 'mastery-trees', file));
      await expect(readSeedFixtures(dir)).rejects.toMatchObject({
        name: 'SeedError',
        code: 'invalid-content',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('seedCatalog refuses an empty catalog before opening a transaction', async () => {
    const client = fakeClient();
    await expect(seedCatalog(client, [])).rejects.toMatchObject({ code: 'invalid-content' });
    expect(client.commands).toEqual([]);
  });

  it('retireMasteries retires nothing for an empty keep list', async () => {
    const client = fakeClient();
    await retireMasteries(client, []);
    expect(client.commands).toEqual([]);
  });

  it('seedData with no catalog does not delete any mastery', async () => {
    const client = fakeClient();
    await seedData(client, { ...data(), catalog: [] });
    expect(client.commands.some((sql) => sql.startsWith('DELETE FROM mastery_trees'))).toBe(false);
  });
});

describe('bootstrap forwards the writer code (F-003)', () => {
  it('keeps reference and its identifier instead of database-failed', async () => {
    const client = fakeClient({ fkOnRetire: true });
    await expect(bootstrapData(client, data())).rejects.toMatchObject({
      name: 'BootstrapError',
      code: 'reference',
      detail: 'class09',
    });
    expect(client.commands.at(-1)).toBe('ROLLBACK');
  });

  it('still reports database-failed for an error that is not a SeedError', async () => {
    const client = fakeClient();
    const query = client.query;
    client.query = async (sql: string) => {
      if (sql.includes('INSERT INTO mastery_trees')) throw new Error('boom');
      return query(sql);
    };
    await expect(bootstrapData(client, data())).rejects.toMatchObject({ code: 'database-failed' });
  });
});

describe('catalog before content, retirement after (C-003)', () => {
  it('seedData rewrites the guides before it retires masteries', async () => {
    const client = fakeClient();
    await seedData(client, data());
    const at = (needle: string) => client.commands.findIndex((sql) => sql.includes(needle));
    const upsert = at('INSERT INTO mastery_trees');
    const guides = at('INSERT INTO "build_skill_nodes"');
    const retire = at('DELETE FROM mastery_trees');
    expect(upsert).toBeGreaterThan(-1);
    expect(guides).toBeGreaterThan(upsert);
    expect(retire).toBeGreaterThan(guides);
    expect(client.commands.at(-1)).toBe('COMMIT');
  });

  it('bootstrapData keeps the same order', async () => {
    const client = fakeClient();
    await bootstrapData(client, data());
    const at = (needle: string) => client.commands.findIndex((sql) => sql.includes(needle));
    expect(at('DELETE FROM mastery_trees')).toBeGreaterThan(at('INSERT INTO "build_skill_nodes"'));
  });
});

describe('every emitted code belongs to the real contract (A-02, SC-002)', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const sources = readdirSync(dir)
    .filter((name) => /\.mts$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
  const known = new Set<string>(SEED_ERROR_CODES);

  it('finds the seeder sources it scans', () => {
    expect(sources.map((s) => s.name)).toEqual(
      expect.arrayContaining(['seed.mts', 'bootstrap.mts', 'write-content.mts']),
    );
  });

  it('every code literal passed to SeedError, BootstrapError or failureLine is in SEED_ERROR_CODES', () => {
    const literals = sources.flatMap(({ name, text }) =>
      [
        ...text.matchAll(/new (?:Seed|Bootstrap)Error\(\s*'([a-z-]+)'/g),
        ...text.matchAll(/failureLine\(\s*[^,()]+,\s*'([a-z-]+)'/g),
      ].map((m) => ({ name, code: m[1]! })),
    );
    expect(literals.length).toBeGreaterThan(20);
    expect(literals.filter((l) => !known.has(l.code))).toEqual([]);
    expect(literals.some((l) => l.code === 'arguments')).toBe(true);
  });

  it('no source prints a hand-written "<operation> failed: <code>" line', () => {
    const handWritten = sources.flatMap(({ name, text }) =>
      [...text.matchAll(/(?:seed|bootstrap) failed: [a-z-]+/g)].map((m) => `${name}: ${m[0]}`),
    );
    expect(handWritten).toEqual([]);
  });
});
