import { describe, expect, it } from 'vitest';
import { layoutForest, type GraphNode } from './layout';
import { createKeyboardNav } from './keyboard-nav';

// Forest from the Chamán tree: two roots with children, and one childless root.
const chaman: GraphNode[] = [
  { id: 'golpe-primigenio', parentId: null, order: 0 },
  { id: 'golpe-atronador', parentId: 'golpe-primigenio', order: 0 },
  { id: 'torrente', parentId: 'golpe-primigenio', order: 1 },
  { id: 'viento-demonico', parentId: null, order: 1 },
  { id: 'tempestad-furiosa', parentId: 'viento-demonico', order: 0 },
  { id: 'totem-wendigo', parentId: null, order: 2 },
];

const byId = (layout: ReturnType<typeof layoutForest>) =>
  new Map(layout.nodes.map((n) => [n.id, n]));

describe('layoutForest', () => {
  it('places roots at level 0 and their children one level deeper', () => {
    const nodes = byId(layoutForest(chaman));
    expect(nodes.get('golpe-primigenio')?.level).toBe(0);
    expect(nodes.get('golpe-atronador')?.level).toBe(1);
    expect(nodes.get('tempestad-furiosa')?.level).toBe(1);
  });

  it('orders siblings by their order field, not by input position', () => {
    const shuffled = [...chaman].reverse();
    const layout = layoutForest(shuffled);
    const rows = layout.nodes.map((n) => n.id);
    expect(rows.indexOf('golpe-atronador')).toBeLessThan(rows.indexOf('torrente'));
  });

  it('lists each parent immediately before its children (preorder rows)', () => {
    const rows = layoutForest(chaman).nodes.map((n) => n.id);
    expect(rows).toEqual([
      'golpe-primigenio',
      'golpe-atronador',
      'torrente',
      'viento-demonico',
      'tempestad-furiosa',
      'totem-wendigo',
    ]);
  });

  it('indents deeper levels further right and stacks rows downward', () => {
    const nodes = byId(layoutForest(chaman));
    expect(nodes.get('golpe-atronador')!.x).toBeGreaterThan(nodes.get('golpe-primigenio')!.x);
    expect(nodes.get('torrente')!.y).toBeGreaterThan(nodes.get('golpe-atronador')!.y);
  });

  it('returns one edge per parent-child link', () => {
    const layout = layoutForest(chaman);
    expect(layout.edges).toHaveLength(3);
    expect(layout.edges).toContainEqual({ from: 'viento-demonico', to: 'tempestad-furiosa' });
  });

  it('is deterministic: the same input yields the same layout', () => {
    expect(layoutForest(chaman)).toEqual(layoutForest(chaman));
  });

  it('rejects a parent that does not exist', () => {
    expect(() => layoutForest([{ id: 'a', parentId: 'fantasma', order: 0 }])).toThrow(
      /padre desconocido/,
    );
  });

  it('rejects a cycle because its nodes are unreachable from any root', () => {
    expect(() =>
      layoutForest([
        { id: 'a', parentId: 'b', order: 0 },
        { id: 'b', parentId: 'a', order: 0 },
      ]),
    ).toThrow(/ciclo/);
  });

  it('rejects duplicated ids', () => {
    expect(() =>
      layoutForest([
        { id: 'a', parentId: null, order: 0 },
        { id: 'a', parentId: null, order: 1 },
      ]),
    ).toThrow(/duplicado/);
  });

  it('lays out 120 nodes in under 16 ms (smoke test)', () => {
    const big: GraphNode[] = Array.from({ length: 120 }, (_, i) => ({
      id: `n${i}`,
      parentId: i < 10 ? null : `n${Math.floor(i / 2) - 5}`,
      order: i,
    }));
    layoutForest(big); // warm-up
    const start = performance.now();
    const layout = layoutForest(big);
    const elapsed = performance.now() - start;
    expect(layout.nodes).toHaveLength(120);
    expect(elapsed).toBeLessThan(16);
  });
});

describe('createKeyboardNav', () => {
  const layout = layoutForest(chaman);
  const next = createKeyboardNav(layout);

  it('moves to the next and previous row with ArrowDown and ArrowUp', () => {
    expect(next('golpe-primigenio', 'ArrowDown')).toBe('golpe-atronador');
    expect(next('torrente', 'ArrowUp')).toBe('golpe-atronador');
  });

  it('returns null at the first and last rows', () => {
    expect(next('golpe-primigenio', 'ArrowUp')).toBeNull();
    expect(next('totem-wendigo', 'ArrowDown')).toBeNull();
  });

  it('moves into the first child with ArrowRight and back to the parent with ArrowLeft', () => {
    expect(next('viento-demonico', 'ArrowRight')).toBe('tempestad-furiosa');
    expect(next('tempestad-furiosa', 'ArrowLeft')).toBe('viento-demonico');
  });

  it('returns null for ArrowRight on a leaf and ArrowLeft on a root', () => {
    expect(next('totem-wendigo', 'ArrowRight')).toBeNull();
    expect(next('golpe-primigenio', 'ArrowLeft')).toBeNull();
  });

  it('jumps to the first and last rows with Home and End', () => {
    expect(next('torrente', 'Home')).toBe('golpe-primigenio');
    expect(next('torrente', 'End')).toBe('totem-wendigo');
  });

  it('returns null for an unknown node or an unsupported key', () => {
    expect(next('no-existe', 'ArrowDown')).toBeNull();
    expect(next('torrente', 'Enter')).toBeNull();
  });
});
