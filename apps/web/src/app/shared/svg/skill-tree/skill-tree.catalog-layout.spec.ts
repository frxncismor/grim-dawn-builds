import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import arcanist from '../../../../../../../fixtures/content/mastery-trees/arcanist.json';
import demolition from '../../../../../../../fixtures/content/mastery-trees/demolition.json';
import nightblade from '../../../../../../../fixtures/content/mastery-trees/nightblade.json';
import occult from '../../../../../../../fixtures/content/mastery-trees/occult.json';
import shaman from '../../../../../../../fixtures/content/mastery-trees/shaman.json';
import soldier from '../../../../../../../fixtures/content/mastery-trees/soldier.json';
import { CATALOG_MIN_ROW_STEP, SkillTree } from './skill-tree';

const trees: readonly MasteryTree[] = [
  arcanist,
  demolition,
  nightblade,
  occult,
  shaman,
  soldier,
].map((raw) => MasteryTreeSchema.parse(raw));

/** Short unique stand-in for a node id, so a synthetic name fits the label wrapping (T043). */
const shortId = (id: string) =>
  `n${[...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 100000, 7)}`;

/** Distinct names per language so the tests can tell which one is shown. */
function named(tree: MasteryTree): MasteryTree {
  return {
    ...tree,
    mastery: { ...tree.mastery, name: { en: 'Mastery EN', es: 'Maestría ES' } },
    nodes: tree.nodes.map((node) => ({
      ...node,
      name: { en: `${shortId(node.id)} en`, es: `${shortId(node.id)} es` },
    })),
  };
}

describe('gd-skill-tree catalog layout (T012)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(tree: MasteryTree, locale = 'en') {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'layout');
    fixture.componentRef.setInput('catalogTree', tree);
    await fixture.whenStable();
    return fixture;
  }

  /** Widest content box of the section on desktop (1280 px viewport), measured in the e2e (T043). */
  const DESKTOP_CANVAS_WIDTH = 1182;

  for (const tree of trees)
    it(`${tree.mastery.slug}: the whole tree fits the desktop canvas without horizontal scroll (T043)`, async () => {
      const fixture = await render(tree);
      const svg = (fixture.nativeElement as HTMLElement).querySelector('svg.skill-tree__svg')!;
      expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(DESKTOP_CANVAS_WIDTH);
    });

  it('the row step holds ring + name + kind/max + Circular lines of a node, with margin', async () => {
    const fixture = await render(trees[1]);
    const root: HTMLElement = fixture.nativeElement;
    const name = root.querySelector('.skill-tree__name')!;
    const meta = root.querySelector('.skill-tree__bar-required')!;
    const nameY = Number(name.getAttribute('y'));
    const metaY = Number(meta.getAttribute('y'));
    const lineStep = 14;
    const descent = 4;
    expect(metaY).toBeGreaterThanOrEqual(nameY + lineStep); // the name lines end above the meta line
    const metaLines = meta.querySelectorAll('tspan').length; // kind, max, circular (3 for a circular node)
    expect(metaLines).toBeGreaterThanOrEqual(2);
    const labelBottom = metaY + lineStep * 2 /* max + Circular */ + descent;
    const ring = Number(root.querySelector('.skill-tree__ring')!.getAttribute('r'));
    expect(CATALOG_MIN_ROW_STEP).toBeGreaterThanOrEqual(ring + labelBottom + 8);
  });

  it('the row step also holds the worst case: three name lines + kind + max + Circular (T043)', () => {
    const ring = 28;
    const worstBottom = 40 + 14 * (3 + 2) + 4;
    expect(CATALOG_MIN_ROW_STEP).toBeGreaterThanOrEqual(ring + worstBottom + 8);
  });

  it('long names wrap onto at most three lines and none of the real ones is cut (T043)', async () => {
    for (const tree of trees)
      for (const locale of ['en', 'es'] as const) {
        const fixture = await render(tree, locale);
        for (const item of fixture.componentInstance.catalog()!.nodes) {
          expect(item.labelLines.length, item.node.id).toBeLessThanOrEqual(3);
          expect(item.labelLines.join(' '), `${item.node.id} (${locale})`).not.toContain('…');
        }
        TestBed.resetTestingModule();
      }
  });

  for (const tree of trees) {
    it(`${tree.mastery.slug}: no two nodes of a column are closer than the row step`, async () => {
      const fixture = await render(tree);
      const nodes = fixture.componentInstance.catalog()!.nodes;
      expect(nodes).toHaveLength(tree.nodes.length);
      const byColumn = new Map<number, number[]>();
      for (const item of nodes) {
        const ys = byColumn.get(item.node.grid.col) ?? [];
        ys.push(item.y);
        byColumn.set(item.node.grid.col, ys);
      }
      for (const [column, ys] of byColumn) {
        ys.sort((a, b) => a - b);
        for (let i = 1; i < ys.length; i++)
          expect(ys[i] - ys[i - 1], `col ${column}`).toBeGreaterThanOrEqual(CATALOG_MIN_ROW_STEP);
      }
    });
  }

  describe('names follow the active language', () => {
    const tree = named(trees[1]);
    const node = tree.nodes[0];
    const parent = tree.nodes.find((n) => n.parent_id !== null)!;

    for (const [locale, main, other] of [
      ['en', 'en', 'es'],
      ['es', 'es', 'en'],
    ] as const) {
      it(`${locale}: main name in ${main}, secondary in ${other} with lang="${other}"`, async () => {
        const fixture = await render(tree, locale);
        const root: HTMLElement = fixture.nativeElement;
        const mainName = (n: { id: string }) => `${shortId(n.id)} ${main}`;
        const otherName = (n: { id: string }) => `${shortId(n.id)} ${other}`;

        const heading = root.querySelector('h2')!;
        expect(heading.textContent).toContain(main === 'en' ? 'Mastery EN' : 'Maestría ES');
        expect(heading.querySelector(`span[lang="${other}"]`)?.textContent).toContain(
          other === 'en' ? 'Mastery EN' : 'Maestría ES',
        );

        const label = root
          .querySelector(`[data-skill-id="${node.id}"]`)!
          .getAttribute('aria-label')!;
        expect(label.startsWith(mainName(node))).toBe(true);
        expect(label).not.toContain(otherName(node));

        const childLabel = root
          .querySelector(`[data-skill-id="${parent.id}"]`)!
          .getAttribute('aria-label')!;
        const parentNode = tree.nodes.find((n) => n.id === parent.parent_id)!;
        expect(childLabel).toContain(mainName(parentNode));

        const item = root.querySelector(`li[id$="${node.id}-listitem"]`)!;
        expect(item.querySelector('strong')?.textContent).toBe(mainName(node));
        expect(item.querySelector(`span[lang="${other}"]`)?.textContent).toContain(otherName(node));
        expect(item.querySelector(`span[lang="${main}"]`)).toBeNull();

        const svgText = root.querySelector('.skill-tree__name')!.textContent!;
        expect(svgText).not.toContain(` ${other}`);
      });
    }
  });
});
