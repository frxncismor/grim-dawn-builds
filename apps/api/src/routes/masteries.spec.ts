import { describe, expect, it, vi } from 'vitest';
import type { MasterySummary, MasteryTree } from '@gd/domain';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import type { MasteryCatalogRepository } from '../catalog/mastery-repository.js';

const config = () => loadConfig({ LOG_LEVEL: 'silent' });
const SHA = 'a'.repeat(64);

const summary: MasterySummary = {
  id: 'class01',
  slug: 'soldier',
  name: { en: 'Soldier', es: 'Soldado' },
  game_version: 'steam-build-25813250',
  node_count: 1,
};
const tree: MasteryTree = {
  mastery: { id: 'class01', slug: 'soldier', name: { en: 'Soldier', es: 'Soldado' } },
  game_version: 'steam-build-25813250',
  source: { game_version: 'steam-build-25813250', sha256: [SHA] },
  nodes: [
    {
      id: 'class01/weaponpool1',
      name: { en: 'Military Conditioning', es: 'Acondicionamiento militar' },
      kind: 'active',
      circular: false,
      tier: 1,
      bar_required: 1,
      max_points: 12,
      grid: { col: 1, row: 1 },
      parent_id: null,
    },
  ],
};

function masteries(overrides: Partial<MasteryCatalogRepository> = {}): MasteryCatalogRepository {
  return {
    listTrees: async () => [summary],
    findTree: async (slug) => (slug === 'soldier' ? tree : null),
    ...overrides,
  };
}

describe('mastery catalog HTTP routes (spec 003 T023)', () => {
  it('lists the summaries as JSON', async () => {
    const app = buildApp(config(), { masteries: masteries(), readiness: async () => true });
    try {
      const response = await app.inject('/api/v1/masteries');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toEqual([summary]);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    } finally {
      await app.close();
    }
  });

  it('serves one full tree by slug', async () => {
    const app = buildApp(config(), { masteries: masteries(), readiness: async () => true });
    try {
      const response = await app.inject('/api/v1/masteries/soldier');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(tree);
    } finally {
      await app.close();
    }
  });

  it('answers 404 for an unknown slug and for a malformed one, without touching the repository', async () => {
    const findTree = vi.fn(async () => null);
    const app = buildApp(config(), {
      masteries: masteries({ findTree }),
      readiness: async () => true,
    });
    try {
      for (const slug of ['does-not-exist', 'Bad_Slug', 'x%27%3B--']) {
        const response = await app.inject(`/api/v1/masteries/${slug}`);
        expect(response.statusCode, slug).toBe(404);
        expect(response.json()).toEqual({ error: 'not_found' });
      }
      expect(findTree).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('fails closed with an opaque 503 when readiness, the repository or the schema fail', async () => {
    const boom = async () => {
      throw new Error('PRIVATE-SQL-CANARY');
    };
    const leaky = async () => [{ ...summary, source_sha256: 'PRIVATE-LEAK-CANARY' }];
    const cases = [
      {},
      { masteries: masteries(), readiness: async () => false },
      { masteries: masteries({ listTrees: boom, findTree: boom }), readiness: async () => true },
      {
        masteries: masteries({
          listTrees: leaky as never,
          findTree: (async () => ({ nope: 1 })) as never,
        }),
        readiness: async () => true,
      },
    ];
    for (const options of cases) {
      const app = buildApp(config(), options);
      try {
        for (const url of ['/api/v1/masteries', '/api/v1/masteries/soldier']) {
          const response = await app.inject(url);
          expect(response.statusCode, url).toBe(503);
          expect(response.json()).toEqual({ error: 'content_unavailable' });
          expect(response.body).not.toMatch(/PRIVATE-|stack|SELECT/);
        }
        expect((await app.inject('/health')).statusCode).toBe(200);
      } finally {
        await app.close();
      }
    }
  });

  it('does not expose mutation methods', async () => {
    const app = buildApp(config(), { masteries: masteries(), readiness: async () => true });
    try {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const)
        for (const url of ['/api/v1/masteries', '/api/v1/masteries/soldier'])
          expect((await app.inject({ method, url })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
