import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import soldier from '../../../../../../../fixtures/content/mastery-trees/soldier.json';
import { SkillTree } from './skill-tree';

const tree: MasteryTree = MasteryTreeSchema.parse(soldier);

/**
 * spec004 T024 (fase b): with `ASSET_SOURCE=own` every catalog node draws its own icon from the
 * sprite (`<use>` of `/assets/ui/skill-icons.svg`), never the game's texture or an `<image>`.
 */
describe('gd-skill-tree own icons on catalog nodes (T024)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'icons');
    fixture.componentRef.setInput('catalogTree', tree);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('every node has exactly one own icon, decorative, chosen by circular marker then type', async () => {
    const root = await render();
    const nodes = [...root.querySelectorAll<SVGGElement>('g[data-skill-id]')];
    expect(nodes.length).toBe(tree.nodes.length);
    for (const node of nodes) {
      const icons = node.querySelectorAll('use.skill-tree__icon');
      expect(icons.length, node.getAttribute('data-skill-id') ?? '').toBe(1);
      const icon = icons[0]!;
      const expected =
        node.getAttribute('data-circular') === 'true'
          ? 'skill-circular'
          : `skill-${node.getAttribute('data-skill-kind')}`;
      expect(icon.getAttribute('href')).toBe(`/assets/ui/skill-icons.svg#${expected}`);
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('width')).toBe('24');
      expect(icon.getAttribute('height')).toBe('24');
    }
  });

  it('draws no game art: no <image> and no texture path in the tree', async () => {
    const root = await render();
    expect(root.querySelectorAll('image').length).toBe(0);
    expect(root.innerHTML).not.toMatch(/\.tex|ui\/skills|\/assets\/(?:portraits|skill-icons)\//);
  });

  it('keeps the accessible name of each node (the icon adds no text)', async () => {
    const root = await render();
    for (const node of root.querySelectorAll('g[data-skill-id]'))
      expect(node.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(0);
    expect(root.querySelectorAll('use.skill-tree__icon title').length).toBe(0);
  });
});
