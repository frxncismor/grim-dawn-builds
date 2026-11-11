import { describe, expect, it, vi } from 'vitest';
import { PublicAuthorSchema, PublicBuildSchema, PublicSourceSchema } from '@gd/domain';
import { contractDoc } from '@gd/domain/testing';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import type { PublicContentRepository } from '../content/repository.js';

function fixture() {
  const doc = contractDoc('public-guide', {
    review_state: 'publicado',
    rights_status: 'own_original',
    published_at: '2026-11-09',
  });
  const pick = (keys: string[], source: object) =>
    Object.fromEntries(keys.map((key) => [key, (source as Record<string, unknown>)[key]]));
  return PublicBuildSchema.parse({
    ...pick(Object.keys(PublicBuildSchema.shape), doc),
    author: pick(Object.keys(PublicAuthorSchema.shape), doc.author),
    sources: doc.sources.map((source) => pick(Object.keys(PublicSourceSchema.shape), source)),
  });
}
const config = () => loadConfig({ LOG_LEVEL: 'silent' });
function repository(overrides: Partial<PublicContentRepository> = {}): PublicContentRepository {
  const doc = fixture();
  return {
    listBuilds: async () => [doc],
    findBuild: async (slug) => (slug === doc.slug ? doc : null),
    listSlugs: async () => [doc.slug],
    getAuthor: async (slug) => (slug === doc.author_slug ? doc.author : null),
    getTierList: async () => null,
    ...overrides,
  };
}
describe('public content HTTP routes', () => {
  it('serves complete JSON documents and deterministic slugs', async () => {
    const app = buildApp(config(), { content: repository(), readiness: async () => true });
    try {
      for (const url of [
        '/api/v1/builds',
        '/api/v1/builds/public-guide',
        '/api/v1/authors/autor-confirmado',
        '/api/v1/slugs',
      ]) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode, url).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).not.toMatch(
          /reviewed_by|rights_confirmed|permission_ref|is_placeholder/,
        );
      }
      const response = await app.inject('/api/v1/builds/public-guide');
      expect(response.json()).toEqual(fixture());
    } finally {
      await app.close();
    }
  });
  it('returns constant 404 responses for absent or nonpublic resources', async () => {
    const app = buildApp(config(), { content: repository(), readiness: async () => true });
    try {
      for (const url of [
        '/api/v1/builds/pending-guide',
        '/api/v1/authors/por-confirmar',
        '/api/v1/tier-lists/missing',
      ]) {
        const response = await app.inject(url);
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: 'not_found' });
      }
    } finally {
      await app.close();
    }
  });
  it('rejects invalid slugs before readiness or data access', async () => {
    const findBuild = vi.fn();
    const readiness = vi.fn();
    const app = buildApp(config(), { content: repository({ findBuild }), readiness });
    try {
      const response = await app.inject('/api/v1/builds/bad_slug');
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'invalid_slug' });
      expect(findBuild).not.toHaveBeenCalled();
      expect(readiness).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('fails closed when readiness is missing/false, database throws or a DTO contains private fields', async () => {
    const bad = async () => {
      throw new Error('PRIVATE-SQL-CANARY');
    };
    const unsafe = async () => ({ ...fixture(), reviewed_by: 'PRIVATE-EDITOR-CANARY' });
    for (const options of [
      {},
      { content: repository(), readiness: async () => false },
      { content: repository({ listBuilds: bad }), readiness: async () => true },
      {
        content: repository({ listBuilds: async () => [await unsafe()] }),
        readiness: async () => true,
      },
    ]) {
      const app = buildApp(config(), options);
      try {
        const response = await app.inject('/api/v1/builds');
        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({ error: 'content_unavailable' });
        expect(response.body).not.toMatch(/PRIVATE-|stack|SELECT/);
        expect((await app.inject('/health')).statusCode).toBe(200);
      } finally {
        await app.close();
      }
    }
  });
  it('does not expose public mutation methods', async () => {
    const app = buildApp(config(), { content: repository(), readiness: async () => true });
    try {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const)
        expect((await app.inject({ method, url: '/api/v1/builds' })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
