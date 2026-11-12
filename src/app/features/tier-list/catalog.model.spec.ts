import { describe, expect, it } from 'vitest';
import { buildCatalog, catalogGroups, catalogItemList } from './catalog.model';
import { EMPTY_FILTER, applyFilter } from './filter';
import { entry, input } from './catalog.test-data';
describe('public catalog view model', () => {
  it('preserves public entries, completes known combinations and invents no metadata for placeholders', () => {
    const result = buildCatalog(input);
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].entry.build_slug).toBe('tormenta');
    expect(result.cards[1].entry.entry_kind).toBe('placeholder');
    expect(result.cards[1].damageTypes).toEqual([]);
    expect(result.cards[1].playstyle).toBeNull();
    expect(result.cards[1].entry.evaluated_on).toBeNull();
    expect(result.cards[1].tier).toBe('sin_clasificar');
  });
  it('filters with AND/OR and searches both Spanish and English mastery names', () => {
    const model = buildCatalog(input);
    expect(
      applyFilter(model.cards, { ...EMPTY_FILTER, masteries: ['chaman'], damageTypes: ['rayo'] }),
    ).toHaveLength(1);
    expect(applyFilter(model.cards, { ...EMPTY_FILTER, text: 'Shaman Soldier' })).toHaveLength(1);
    expect(catalogGroups(model).find((g) => g.key === 'masteries')?.options).toHaveLength(3);
  });
  it('retains multiple builds and suppresses redundant placeholders for their combination', () => {
    const model = buildCatalog({
      ...input,
      entries: [
        ...input.entries,
        { ...entry, build_slug: 'second', tier: 'S' },
        {
          ...entry,
          entry_kind: 'placeholder',
          build_slug: null,
          content_status: 'placeholder',
          tier: 'sin_clasificar',
        },
      ],
      guides: [...input.guides, { ...input.guides[0], slug: 'second' }],
    });
    expect(model.cards).toHaveLength(3);
    expect(model.cards.map((c) => c.tier)).toEqual(['S', 'A', 'sin_clasificar']);
    expect(new Set(model.cards.map((c) => c.id)).size).toBe(3);
  });
  it('creates structured data with public guide URL and honest placeholders without ranking', () => {
    const data = catalogItemList(buildCatalog(input), (path) => `https://example.org${path}`);
    const text = JSON.stringify(data);
    expect(text).toContain('https://example.org/builds/tormenta');
    expect(text).not.toContain('aggregateRating');
    const elements = data['itemListElement'] as { item: Record<string, unknown> }[];
    expect(elements[1].item['url']).toBeUndefined();
    expect(elements[1].item['@type']).toBe('Thing');
  });
});
