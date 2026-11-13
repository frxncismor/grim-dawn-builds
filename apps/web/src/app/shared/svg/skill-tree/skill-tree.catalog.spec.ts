import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import arcanist from '../../../../../../../fixtures/content/mastery-trees/arcanist.json';
import demolition from '../../../../../../../fixtures/content/mastery-trees/demolition.json';
import nightblade from '../../../../../../../fixtures/content/mastery-trees/nightblade.json';
import occult from '../../../../../../../fixtures/content/mastery-trees/occult.json';
import shaman from '../../../../../../../fixtures/content/mastery-trees/shaman.json';
import soldier from '../../../../../../../fixtures/content/mastery-trees/soldier.json';
import { SkillTree } from './skill-tree';

const trees: readonly MasteryTree[] = [
  arcanist,
  demolition,
  nightblade,
  occult,
  shaman,
  soldier,
].map((raw) => MasteryTreeSchema.parse(raw));

describe('gd-skill-tree catalog mode', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(tree: MasteryTree) {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'catalog');
    fixture.componentRef.setInput('catalogTree', tree);
    await fixture.whenStable();
    return fixture;
  }

  it('covers the six real fixtures and 186 nodes', () => {
    expect(trees).toHaveLength(6);
    expect(trees.reduce((total, tree) => total + tree.nodes.length, 0)).toBe(186);
  });

  for (const tree of trees) {
    describe(tree.mastery.slug, () => {
      it('draws every node, one edge per parent_id, and no guide-only chrome', async () => {
        const fixture = await render(tree);
        const root: HTMLElement = fixture.nativeElement;
        expect(root.querySelectorAll('[data-skill-id]')).toHaveLength(tree.nodes.length);
        expect(root.querySelectorAll('[data-edge-to]')).toHaveLength(
          tree.nodes.filter((node) => node.parent_id !== null).length,
        );
        for (const node of tree.nodes) {
          expect(root.querySelector(`[data-skill-id="${node.id}"]`)).not.toBeNull();
          if (node.parent_id !== null)
            expect(
              root.querySelector(`[data-edge-from="${node.parent_id}"][data-edge-to="${node.id}"]`),
            ).not.toBeNull();
        }
        expect(root.querySelector('svg image')).toBeNull();
        expect(root.querySelector('svg foreignObject')).toBeNull();
        expect(root.querySelector('.skill-tree__error')).toBeNull();
      });

      it('derives positions from grid: same col shares x, tier order is left to right, rows stay compact', async () => {
        const fixture = await render(tree);
        const root: HTMLElement = fixture.nativeElement;
        const point = (id: string) => {
          const match = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(
            root.querySelector(`[data-skill-id="${id}"]`)!.getAttribute('transform')!,
          )!;
          return { x: Number(match[1]), y: Number(match[2]) };
        };
        const xByCol = new Map<number, Set<number>>();
        for (const node of tree.nodes) {
          const set = xByCol.get(node.grid.col) ?? new Set<number>();
          set.add(point(node.id).x);
          xByCol.set(node.grid.col, set);
        }
        for (const xs of xByCol.values()) expect(xs.size).toBe(1);
        const cols = [...xByCol.keys()].sort((a, b) => a - b);
        const colX = cols.map((col) => [...xByCol.get(col)!][0]);
        expect(colX).toEqual([...colX].sort((a, b) => a - b));
        expect(new Set(colX).size).toBe(colX.length);

        const rows = [...new Set(tree.nodes.map((node) => node.grid.row))].sort((a, b) => a - b);
        const ys = rows.map((row) => point(tree.nodes.find((n) => n.grid.row === row)!.id).y);
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
        expect(new Set(ys).size).toBe(rows.length);
        const step = ys[1] - ys[0];
        ys.slice(1).forEach((y, i) => expect(y - ys[i]).toBe(step));
        const cells = new Set(tree.nodes.map((node) => `${point(node.id).x}:${point(node.id).y}`));
        expect(cells.size).toBe(tree.nodes.length);
      });

      it('shows tier, required bar, kind, circular and points as text, not only color', async () => {
        const fixture = await render(tree);
        const root: HTMLElement = fixture.nativeElement;
        for (const node of tree.nodes) {
          const el = root.querySelector<SVGGElement>(`[data-skill-id="${node.id}"]`)!;
          expect(el.getAttribute('data-skill-kind')).toBe(node.kind);
          expect(el.getAttribute('data-tier')).toBe(String(node.tier));
          expect(el.getAttribute('data-circular')).toBe(String(node.circular));
          const text = el.textContent!.replace(/\s+/g, ' ');
          expect(text).toContain(`${node.max_points}`);
          if (node.ultimate_points !== undefined) expect(text).toContain(`${node.ultimate_points}`);
        }
        const tiers = new Set(tree.nodes.map((node) => node.tier));
        const headers = root.querySelectorAll('[data-tier-header]');
        expect(headers).toHaveLength(tiers.size);
        for (const header of Array.from(headers)) {
          const tier = Number(header.getAttribute('data-tier-header'));
          const bar = tree.nodes.find((n) => n.tier === tier)!.bar_required;
          expect(header.textContent).toContain(String(bar));
        }
      });
    });
  }

  it('ignores guide inputs and editorial layout entirely', async () => {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'catalog');
    fixture.componentRef.setInput('catalogTree', trees[1]);
    fixture.componentRef.setInput('nodes', [
      {
        slug: 'x',
        mastery_slug: 'demolition',
        name_es: 'X',
        name_en: 'X',
        bar_required: 1,
        parent_slug: null,
        status: 'recomendada',
        tag: null,
        rationale: 'x',
        max_points_hint: null,
        points_label: null,
        layout: { x: 9999, y: 9999 },
      },
    ]);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-skill-id="x"]')).toBeNull();
    expect(root.querySelectorAll('[data-skill-id]')).toHaveLength(trees[1].nodes.length);
    expect(root.querySelector('svg')!.getAttribute('width')).not.toContain('9999');
  });

  it('keeps one focusable node per skill with a roving tabindex and arrow navigation', async () => {
    const fixture = await render(trees[1]);
    const root: HTMLElement = fixture.nativeElement;
    const nodes = Array.from(root.querySelectorAll<SVGGElement>('[data-skill-id]'));
    expect(nodes.filter((n) => n.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(nodes.every((n) => n.hasAttribute('aria-label'))).toBe(true);
    const first = nodes.find((n) => n.getAttribute('tabindex') === '0')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).not.toBe(first);
    expect((document.activeElement as Element).hasAttribute('data-skill-id')).toBe(true);
  });

  it('keeps guide mode when no catalogTree is given', async () => {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'g');
    fixture.componentRef.setInput('mastery', {
      slug: 'm',
      name_es: 'M',
      name_en: 'M',
      role_text: 'r',
    });
    fixture.componentRef.setInput('nodes', []);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.skill-tree--catalog')).toBeNull();
  });
});
