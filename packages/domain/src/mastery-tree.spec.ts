import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CatalogSkillNodeSchema,
  MasteryTreeSchema,
  SKILL_KINDS,
  TIER_BAR_REQUIRED,
  findDependencyCycle,
} from './mastery-tree.js';

const SEED = 20261113;

interface RawNode {
  id: string;
  tier: number;
  bar_required: number;
  grid: { col: number; row: number };
  [key: string]: unknown;
}

const node = (over: Record<string, unknown> = {}): RawNode => ({
  id: 'class01/cadence1',
  name: { en: 'Cadence', es: 'Cadencia' },
  kind: 'active',
  circular: false,
  tier: 1,
  bar_required: 1,
  max_points: 16,
  ultimate_points: 26,
  grid: { col: 1, row: 39 },
  parent_id: null,
  ...over,
});

const tree = (nodes: RawNode[] = [node()]): Record<string, unknown> => ({
  mastery: { id: 'class01', slug: 'soldier', name: { en: 'Soldier', es: 'Soldado' } },
  game_version: '1.3.1.0',
  source: { game_version: '1.3.1.0', sha256: ['a'.repeat(64)] },
  nodes,
});

describe('TIER_BAR_REQUIRED', () => {
  it('matches the engine thresholds (research T002 §1)', () => {
    expect(TIER_BAR_REQUIRED).toEqual([1, 5, 10, 15, 20, 25, 32, 40, 50]);
    expect(SKILL_KINDS).toEqual(['active', 'passive', 'modifier', 'transmuter']);
  });
});

describe('CatalogSkillNodeSchema', () => {
  it('accepts a valid node and optional ultimate_points/icon', () => {
    expect(CatalogSkillNodeSchema.safeParse(node()).success).toBe(true);
    const { ultimate_points: _u, ...noUltimate } = node();
    expect(CatalogSkillNodeSchema.safeParse(noUltimate).success).toBe(true);
    expect(CatalogSkillNodeSchema.safeParse(node({ icon: 'skills/x.tex' })).success).toBe(true);
  });

  it('is strict: rejects unknown (e.g. editorial) fields', () => {
    expect(CatalogSkillNodeSchema.safeParse(node({ rationale: 'x' })).success).toBe(false);
    expect(CatalogSkillNodeSchema.safeParse(node({ grid: { col: 1, row: 1, z: 1 } })).success).toBe(
      false,
    );
  });

  it.each([
    ['empty name', { name: { en: '', es: 'x' } }],
    ['missing es', { name: { en: 'x' } }],
    ['bad id', { id: 'Bad Id' }],
    ['id without mastery prefix', { id: 'cadence1' }],
    ['circular not boolean', { circular: 'yes' }],
    ['legacy max_rank field', { max_rank: 16 }],
    ['unknown kind', { kind: 'mastery' }],
    ['tier 0', { tier: 0, bar_required: 1 }],
    ['tier 10', { tier: 10, bar_required: 50 }],
    ['bar_required not matching tier', { tier: 2, bar_required: 1, grid: { col: 2, row: 39 } }],
    ['grid col != tier', { grid: { col: 2, row: 39 } }],
    ['max_points 0', { max_points: 0 }],
    ['ultimate below max', { max_points: 16, ultimate_points: 10 }],
    ['negative row', { grid: { col: 1, row: -1 } }],
    ['fractional row', { grid: { col: 1, row: 1.5 } }],
    ['self parent', { parent_id: 'class01/cadence1' }],
  ])('rejects %s', (_label, over) => {
    expect(CatalogSkillNodeSchema.safeParse(node(over)).success).toBe(false);
  });

  it('derives the same tier/bar pairs for every tier', () => {
    TIER_BAR_REQUIRED.forEach((bar, i) => {
      const r = CatalogSkillNodeSchema.safeParse(
        node({ tier: i + 1, bar_required: bar, grid: { col: i + 1, row: 39 } }),
      );
      expect(r.success).toBe(true);
    });
  });
});

describe('MasteryTreeSchema', () => {
  const child = (over: Record<string, unknown> = {}) =>
    node({
      id: 'class01/cadence2',
      kind: 'modifier',
      tier: 2,
      bar_required: 5,
      grid: { col: 2, row: 39 },
      parent_id: 'class01/cadence1',
      ...over,
    });

  it('accepts a valid tree and is strict', () => {
    expect(MasteryTreeSchema.safeParse(tree([node(), child()])).success).toBe(true);
    expect(MasteryTreeSchema.safeParse({ ...tree(), extra: 1 }).success).toBe(false);
  });

  it('requires mastery.slug in kebab-case', () => {
    const t = tree() as { mastery: Record<string, unknown> };
    for (const slug of ['Soldier', '', 'so ldier'])
      expect(MasteryTreeSchema.safeParse({ ...t, mastery: { ...t.mastery, slug } }).success).toBe(
        false,
      );
    const { slug: _s, ...noSlug } = t.mastery;
    expect(MasteryTreeSchema.safeParse({ ...t, mastery: noSlug }).success).toBe(false);
  });

  it('rejects empty trees and malformed source', () => {
    expect(MasteryTreeSchema.safeParse(tree([])).success).toBe(false);
    expect(
      MasteryTreeSchema.safeParse({ ...tree(), source: { game_version: '1', sha256: ['zz'] } })
        .success,
    ).toBe(false);
    expect(
      MasteryTreeSchema.safeParse({ ...tree(), source: { game_version: '1', sha256: [] } }).success,
    ).toBe(false);
  });

  it('rejects mismatched game_version between tree and source', () => {
    const bad = { ...tree(), game_version: '1.0.0.0' };
    expect(MasteryTreeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const r = MasteryTreeSchema.safeParse(tree([node(), node({ grid: { col: 1, row: 71 } })]));
    expect(r.success).toBe(false);
  });

  it('rejects a missing parent', () => {
    expect(
      MasteryTreeSchema.safeParse(tree([node(), child({ parent_id: 'class01/nope' })])).success,
    ).toBe(false);
  });

  it('rejects a cycle', () => {
    const a = node({
      id: 'class01/a',
      parent_id: 'class01/b',
      tier: 2,
      bar_required: 5,
      grid: { col: 2, row: 1 },
    });
    const b = node({
      id: 'class01/b',
      parent_id: 'class01/a',
      tier: 2,
      bar_required: 5,
      grid: { col: 2, row: 2 },
    });
    expect(MasteryTreeSchema.safeParse(tree([a, b])).success).toBe(false);
  });

  it('rejects grid collisions', () => {
    const r = MasteryTreeSchema.safeParse(tree([node(), node({ id: 'class01/other' })]));
    expect(r.success).toBe(false);
  });

  it('requires tier to grow strictly from parent to child', () => {
    const same = child({ tier: 1, bar_required: 1, grid: { col: 1, row: 71 } });
    expect(MasteryTreeSchema.safeParse(tree([node(), same])).success).toBe(false);
    const lower = node({
      id: 'class01/low',
      tier: 1,
      bar_required: 1,
      grid: { col: 1, row: 100 },
      parent_id: 'class01/cadence2',
    });
    expect(MasteryTreeSchema.safeParse(tree([node(), child(), lower])).success).toBe(false);
  });
});

describe('findDependencyCycle', () => {
  it('returns null for a forest and members for a loop', () => {
    expect(
      findDependencyCycle([
        { id: 'a', parent_id: null },
        { id: 'b', parent_id: 'a' },
      ]),
    ).toBeNull();
    expect(
      findDependencyCycle([
        { id: 'a', parent_id: 'b' },
        { id: 'b', parent_id: 'a' },
        { id: 'c', parent_id: null },
      ])?.sort(),
    ).toEqual(['a', 'b']);
  });
});

/** Property tests: acyclicity, id uniqueness and grid collisions. */
describe('mastery tree properties', () => {
  const logProperty = (name: string, numRuns: number, seed: number) =>
    console.info(`[property] ${name} numRuns=${numRuns} seed=${seed}`);

  /** Valid forest: node i takes any earlier node of a strictly lower tier as parent; unique cells. */
  const validTreeArb = fc
    .array(fc.tuple(fc.integer({ min: 1, max: 9 }), fc.nat(1000)), { minLength: 1, maxLength: 25 })
    .map((raw) => {
      const nodes: RawNode[] = [];
      raw.forEach(([tier, pick], i) => {
        const lower = nodes.filter((n) => n.tier < tier);
        const parent = lower.length > 0 && pick % 2 === 0 ? lower[pick % lower.length] : undefined;
        nodes.push(
          node({
            id: `class01/n${i}`,
            tier,
            bar_required: TIER_BAR_REQUIRED[tier - 1],
            grid: { col: tier, row: i },
            parent_id: parent ? parent.id : null,
          }),
        );
      });
      return nodes;
    });

  it('accepts every generated valid tree', () => {
    logProperty('valid-trees', 200, SEED);
    fc.assert(
      fc.property(validTreeArb, (nodes) => MasteryTreeSchema.safeParse(tree(nodes)).success),
      { numRuns: 200, seed: SEED },
    );
  });

  it('rejects any tree where a parent chain is closed into a loop', () => {
    logProperty('cycle', 200, SEED + 1);
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 9 }), fc.nat(100), (size, offset) => {
        // ring of `size` nodes, each the parent of the next; all in distinct cells
        const nodes = Array.from({ length: size }, (_, i) =>
          node({
            id: `class01/r${i}`,
            tier: 2,
            bar_required: 5,
            grid: { col: 2, row: offset + i },
            parent_id: `class01/r${(i + 1) % size}`,
          }),
        );
        return (
          !MasteryTreeSchema.safeParse(tree(nodes)).success &&
          findDependencyCycle(nodes as unknown as { id: string; parent_id: string | null }[]) !==
            null
        );
      }),
      { numRuns: 200, seed: SEED + 1 },
    );
  });

  it('rejects any tree with a duplicated id', () => {
    logProperty('duplicate-id', 200, SEED + 2);
    fc.assert(
      fc.property(validTreeArb, fc.nat(1000), (nodes, pick) => {
        const dup = nodes[pick % nodes.length]!;
        const copy = { ...dup, grid: { col: dup.tier, row: 5000 } };
        return !MasteryTreeSchema.safeParse(tree([...nodes, copy])).success;
      }),
      { numRuns: 200, seed: SEED + 2 },
    );
  });

  it('rejects any tree where two nodes share a grid cell', () => {
    logProperty('grid-collision', 200, SEED + 3);
    fc.assert(
      fc.property(validTreeArb, fc.nat(1000), (nodes, pick) => {
        const target = nodes[pick % nodes.length]!;
        const intruder = node({
          id: 'class01/intruder',
          tier: target.tier,
          bar_required: target.bar_required,
          grid: target.grid,
        });
        return !MasteryTreeSchema.safeParse(tree([...nodes, intruder])).success;
      }),
      { numRuns: 200, seed: SEED + 3 },
    );
  });
});
