import { describe, expect, it } from 'vitest';
import { PublicAuthorSchema, PublicBuildSchema, PublicSourceSchema } from '@gd/domain';
import { contractCollections, contractDoc } from '@gd/domain/testing';
import { mapAuthor, mapBuild, mapSlugs, mapTierList } from './map-content.js';

const pick = (keys: string[], source: object) =>
  Object.fromEntries(keys.map((key) => [key, (source as Record<string, unknown>)[key]]));
function publicDoc() {
  const doc = contractDoc('public-guide', {
    review_state: 'publicado',
    rights_status: 'own_original',
    published_at: '2026-11-09',
  });
  return {
    ...pick(Object.keys(PublicBuildSchema.shape), doc),
    author: pick(Object.keys(PublicAuthorSchema.shape), doc.author),
    sources: doc.sources.map((source) => pick(Object.keys(PublicSourceSchema.shape), source)),
  };
}
describe('public database mappers', () => {
  it('preserves complete guide content and filters nonpublic states and link-only bodies', () => {
    const input = publicDoc();
    const output = mapBuild(input);
    expect(output).toEqual(input);
    expect(output?.skill_nodes).toHaveLength(1);
    for (const patch of [
      { review_state: 'borrador' },
      { review_state: 'en_revision' },
      { rights_status: 'pending' },
      { rights_status: 'link_only' },
    ]) {
      expect(mapBuild({ ...input, ...patch })).toBeNull();
    }
  });
  it('rejects private fields and malformed visible content without retaining the document', () => {
    for (const input of [
      { ...publicDoc(), reviewed_by: 'PRIVATE-CANARY' },
      { ...publicDoc(), title: { private_value: 'PRIVATE-CANARY' } },
    ]) {
      expect(() => mapBuild(input)).toThrow('invalid_content');
      try {
        mapBuild(input);
      } catch (error) {
        expect(String(error)).not.toContain('PRIVATE-CANARY');
        expect(error).not.toHaveProperty('cause');
      }
    }
  });
  it('filters tier entries and unused sources while preserving the catalog and external attribution', () => {
    const tier = structuredClone(contractCollections().tierLists[0]!);
    const raw = {
      ...tier,
      sources: tier.sources.map((source) => pick(Object.keys(PublicSourceSchema.shape), source)),
    };
    const result = mapTierList(raw, ['zeta-publicada']);
    expect(result?.entries.map((entry) => entry.display_name)).toEqual([
      'Ranura sintética',
      'Build pública',
      'Enlace externo',
    ]);
    expect(result?.masteries).toEqual(tier.masteries);
    expect(result?.combinations).toEqual(tier.combinations);
    expect(result?.entries[2]?.external_author).toBe('Autor externo sintético');
    expect(mapTierList({ ...raw, review_state: 'borrador' }, [])).toBeNull();
    expect(() => mapTierList({ ...raw, sources: tier.sources }, ['zeta-publicada'])).toThrow(
      'invalid_content',
    );
  });
  it('returns only validated deterministic public slugs and rejects malformed rows', () => {
    expect(
      mapSlugs([
        { slug: 'zeta', review_state: 'publicado', rights_status: 'own_original' },
        { slug: 'alfa', review_state: 'publicado', rights_status: 'licensed' },
        { slug: 'zeta', review_state: 'publicado', rights_status: 'own_original' },
        { slug: 'hidden', review_state: 'borrador', rights_status: 'pending' },
        { slug: 'external', review_state: 'publicado', rights_status: 'link_only' },
      ]),
    ).toEqual(['alfa', 'zeta']);
    expect(() =>
      mapSlugs([
        { slug: 'invalid/private', review_state: 'publicado', rights_status: 'own_original' },
      ]),
    ).toThrow('invalid_content');
  });
  it('keeps authors public and rejects editorial metadata', () => {
    expect(
      mapAuthor({ slug: 'por-confirmar', display_name: 'Pendiente', bio: null, url: null }),
    ).toBeNull();
    expect(() =>
      mapAuthor({
        slug: 'real',
        display_name: 'Real',
        bio: null,
        url: null,
        is_placeholder: false,
      }),
    ).toThrow('invalid_content');
  });
});
