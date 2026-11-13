import { describe, expect, it } from 'vitest';
import {
  InvalidCatalogError,
  mapMasterySummary,
  mapMasteryTree,
  type MasteryTreeRow,
  type SkillNodeRow,
} from './map-mastery.js';

const SHA = 'a'.repeat(64);
const treeRow: MasteryTreeRow = {
  id: 'class01',
  slug: 'soldier',
  name_en: 'Soldier',
  name_es: 'Soldado',
  game_version: 'steam-build-1',
  source_sha256: [SHA],
};
const nodeRow = (over: Partial<SkillNodeRow> = {}): SkillNodeRow => ({
  id: 'class01/root',
  mastery_id: 'class01',
  name_en: 'Root',
  name_es: 'Raíz',
  kind: 'active',
  circular: false,
  tier: 1,
  bar_required: 1,
  grid_col: 1,
  grid_row: 4,
  max_points: 12,
  ultimate_points: 22,
  parent_id: null,
  icon: 'ui/icon.tex',
  ...over,
});

describe('mapMasteryTree', () => {
  it('maps view rows to the public DTO', () => {
    const child = nodeRow({
      id: 'class01/child',
      tier: 2,
      bar_required: 5,
      grid_col: 2,
      parent_id: 'class01/root',
    });
    expect(mapMasteryTree(treeRow, [nodeRow(), child])).toEqual({
      mastery: { id: 'class01', slug: 'soldier', name: { en: 'Soldier', es: 'Soldado' } },
      game_version: 'steam-build-1',
      source: { game_version: 'steam-build-1', sha256: [SHA] },
      nodes: [
        {
          id: 'class01/root',
          name: { en: 'Root', es: 'Raíz' },
          kind: 'active',
          circular: false,
          tier: 1,
          bar_required: 1,
          max_points: 12,
          ultimate_points: 22,
          grid: { col: 1, row: 4 },
          parent_id: null,
          icon: 'ui/icon.tex',
        },
        expect.objectContaining({ id: 'class01/child', parent_id: 'class01/root' }),
      ],
    });
  });

  it('omits ultimate_points and icon when the view returns NULL', () => {
    const [n] = mapMasteryTree(treeRow, [nodeRow({ ultimate_points: null, icon: null })]).nodes;
    expect(n).toBeDefined();
    expect(Object.keys(n!)).not.toContain('ultimate_points');
    expect(Object.keys(n!)).not.toContain('icon');
  });

  it('never leaks internal columns', () => {
    const dirty = { ...nodeRow(), created_at: new Date(), updated_at: new Date() };
    const tree = mapMasteryTree({ ...treeRow, created_at: new Date() } as MasteryTreeRow, [dirty]);
    expect(JSON.stringify(tree)).not.toMatch(/created_at|updated_at|mastery_id|grid_col/);
  });

  it('rejects invalid rows with an opaque error', () => {
    expect(() => mapMasteryTree(treeRow, [nodeRow({ bar_required: 7 })])).toThrow(
      InvalidCatalogError,
    );
    expect(() => mapMasteryTree(treeRow, [])).toThrow(InvalidCatalogError);
    expect(() => mapMasteryTree(treeRow, [nodeRow({ kind: 'bogus' })])).toThrow(
      InvalidCatalogError,
    );
    expect(() => mapMasteryTree({ ...treeRow, source_sha256: [] }, [nodeRow()])).toThrow(
      InvalidCatalogError,
    );
    try {
      mapMasteryTree(treeRow, [nodeRow({ id: 'SECRET' })]);
    } catch (error) {
      expect((error as Error).message).toBe('invalid_catalog');
      expect(String(error)).not.toContain('SECRET');
    }
  });
});

describe('mapMasterySummary', () => {
  it('maps a tree row plus node count', () => {
    expect(mapMasterySummary({ ...treeRow, node_count: 32 })).toEqual({
      id: 'class01',
      slug: 'soldier',
      name: { en: 'Soldier', es: 'Soldado' },
      game_version: 'steam-build-1',
      node_count: 32,
    });
  });
  it('rejects bad counts and slugs', () => {
    expect(() => mapMasterySummary({ ...treeRow, node_count: -1 })).toThrow(InvalidCatalogError);
    expect(() => mapMasterySummary({ ...treeRow, slug: 'Bad Slug', node_count: 1 })).toThrow(
      InvalidCatalogError,
    );
  });
});
