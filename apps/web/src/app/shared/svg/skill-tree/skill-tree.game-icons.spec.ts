import { LOCALE_ID, TransferState } from '@angular/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import soldier from '../../../../../../../fixtures/content/mastery-trees/soldier.json';
import { SKILL_ICONS_STATE, type SkillIconSource } from '../../../core/content/skill-icons';
import { SkillTree } from './skill-tree';

const tree: MasteryTree = MasteryTreeSchema.parse(soldier);
const WITHDRAWN = tree.nodes[0]!.icon_id!;
const WITHDRAWN_NODES = tree.nodes.filter((node) => node.icon_id === WITHDRAWN).length;

/**
 * spec004 T028: with `ASSET_SOURCE=game` (state written by the server) each node draws the PNG of
 * its icon; a `withdrawn` icon keeps the own symbol; with `own` nothing of the game is drawn.
 */
describe('gd-skill-tree game icons (T028)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(state: SkillIconSource | null, locale = 'en') {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
    if (state) TestBed.inject(TransferState).set(SKILL_ICONS_STATE, state);
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'game');
    fixture.componentRef.setInput('catalogTree', tree);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the derived PNG with fixed size, lazy and decorative, never a texture path', async () => {
    const root = await render({ source: 'game', withdrawn: [WITHDRAWN] });
    const nodes = [...root.querySelectorAll<SVGGElement>('g[data-skill-id]')];
    expect(nodes.length).toBe(tree.nodes.length);
    for (const node of nodes) {
      const id = node.getAttribute('data-skill-id')!;
      const source = tree.nodes.find((n) => n.id === id)!;
      const images = node.querySelectorAll('image.skill-tree__icon-art');
      const symbols = node.querySelectorAll('use.skill-tree__icon');
      if (source.icon_id === WITHDRAWN) {
        expect(images.length, id).toBe(0);
        expect(symbols.length, id).toBe(1);
        continue;
      }
      expect(symbols.length, id).toBe(0);
      expect(images.length, id).toBe(1);
      const image = images[0]!;
      expect(image.getAttribute('href')).toBe(`assets/skill-icons/${source.icon_id!}.png`);
      expect(image.getAttribute('width')).toBe('32');
      expect(image.getAttribute('height')).toBe('32');
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('decoding')).toBe('async');
      expect(image.getAttribute('aria-hidden')).toBe('true');
    }
    expect(root.innerHTML).not.toMatch(/\.tex|ui\/skills/);
    expect(WITHDRAWN_NODES).toBeGreaterThan(0);
  });

  it('with own (no state) draws only own symbols and no credit to Crate', async () => {
    const root = await render(null);
    expect(root.querySelectorAll('image').length).toBe(0);
    expect(root.querySelectorAll('use.skill-tree__icon').length).toBe(tree.nodes.length);
    expect(root.querySelector('[data-game-art-credit]')).toBeNull();
  });

  it('credits Crate and states non-affiliation next to the tree when the game art is drawn', async () => {
    const root = await render({ source: 'game', withdrawn: [] });
    const credit = root.querySelector('[data-game-art-credit]');
    expect(credit?.textContent).toContain('Crate Entertainment');
    expect(credit?.textContent).toMatch(/not affiliated/i);
  });

  it('has the Spanish credit in the locale file, with Crate and the non-affiliation notice', () => {
    const xlf = readFileSync(resolve(process.cwd(), 'src/locale/messages.es.xlf'), 'utf8');
    const start = xlf.indexOf('<trans-unit id="skillTree.gameArtCredit"');
    expect(start).toBeGreaterThan(-1);
    const unit = xlf.slice(start, xlf.indexOf('</trans-unit>', start));
    const target = unit.match(/<target[^>]*>([\s\S]*?)<\/target>/)![1];
    expect(target).toContain('Crate Entertainment');
    expect(target).toMatch(/no está afiliad/i);
  });

  it('draws no credit when every icon is withdrawn (no game art on screen)', async () => {
    const all = [...new Set(tree.nodes.map((node) => node.icon_id!))];
    const root = await render({ source: 'game', withdrawn: all });
    expect(root.querySelectorAll('image').length).toBe(0);
    expect(root.querySelector('[data-game-art-credit]')).toBeNull();
  });
});
