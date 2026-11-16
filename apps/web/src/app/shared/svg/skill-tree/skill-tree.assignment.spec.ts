import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, type MasteryTree, type PublicBuild } from '@gd/domain';
import demolitionRaw from '../../../../../../../fixtures/content/mastery-trees/demolition.json';
import shamanRaw from '../../../../../../../fixtures/content/mastery-trees/shaman.json';
import guideRaw from '../../../../../../../fixtures/content/builds/chaman-demoledor-golpe-primigenio.json';
import { SkillTree } from './skill-tree';

type SkillNode = PublicBuild['skill_nodes'][number];

const shaman: MasteryTree = MasteryTreeSchema.parse(shamanRaw);
const demolition: MasteryTree = MasteryTreeSchema.parse(demolitionRaw);
const skillNodes = guideRaw.skill_nodes as unknown as SkillNode[];
const bySlot = (masterySlug: string) => skillNodes.filter((n) => n.mastery_slug === masterySlug);
const STATUS_TEXT: Record<string, string> = {
  recomendada: 'Recommended',
  meta: 'Meta',
  omitir: 'Skip',
};

describe('gd-skill-tree assignment mode (guide on the canonical grid)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(
    tree: MasteryTree,
    assignments: readonly SkillNode[],
    active: string[] = [],
  ) {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'guide');
    fixture.componentRef.setInput('catalogTree', tree);
    fixture.componentRef.setInput('assignments', assignments);
    fixture.componentRef.setInput('activeIds', active);
    await fixture.whenStable();
    return fixture;
  }
  const node = (root: HTMLElement, id: string) =>
    root.querySelector<SVGGElement>(`[data-skill-id="${id}"]`)!;

  it('the fixture guide has 14 nodes: 9 on shaman and 5 on demolition, all referenced', () => {
    expect(skillNodes).toHaveLength(14);
    expect(bySlot('chaman')).toHaveLength(9);
    expect(bySlot('demoledor')).toHaveLength(5);
    expect(skillNodes.every((n) => n.skill_node_id)).toBe(true);
  });

  for (const [name, tree, slot] of [
    ['shaman', shaman, 'chaman'],
    ['demolition', demolition, 'demoledor'],
  ] as const) {
    describe(name, () => {
      it('draws the full canonical tree and marks exactly the assigned nodes with their status', async () => {
        const assignments = bySlot(slot);
        const root: HTMLElement = (await render(tree, assignments)).nativeElement;
        expect(root.querySelectorAll('[data-skill-id]')).toHaveLength(tree.nodes.length);
        expect(root.querySelectorAll('[data-skill-id][data-assigned="true"]')).toHaveLength(
          assignments.length,
        );
        for (const item of assignments) {
          const el = node(root, item.skill_node_id!);
          expect(el.getAttribute('data-assigned')).toBe('true');
          expect(el.getAttribute('data-skill-state')).toBe(item.status);
        }
        const others = [...root.querySelectorAll('[data-skill-id]:not([data-assigned])')];
        expect(others).toHaveLength(tree.nodes.length - assignments.length);
        expect(others.every((el) => el.classList.contains('skill-tree__node--unassigned'))).toBe(
          true,
        );
      });

      it('uses the same positions as the catalog mode (canonical grid)', async () => {
        const catalog = TestBed.createComponent(SkillTree);
        catalog.componentRef.setInput('treeId', 'guide');
        catalog.componentRef.setInput('catalogTree', tree);
        await catalog.whenStable();
        const catalogRoot: HTMLElement = catalog.nativeElement;
        const root: HTMLElement = (await render(tree, bySlot(slot))).nativeElement;
        for (const item of tree.nodes)
          expect(node(root, item.id).getAttribute('transform')).toBe(
            node(catalogRoot, item.id).getAttribute('transform'),
          );
        expect(root.querySelectorAll('[data-edge-to]')).toHaveLength(
          catalogRoot.querySelectorAll('[data-edge-to]').length,
        );
      });

      it('names each assigned node with "Assigned" and its status, not only colour or glyph', async () => {
        const root: HTMLElement = (await render(tree, bySlot(slot))).nativeElement;
        for (const item of bySlot(slot)) {
          const el = node(root, item.skill_node_id!);
          const label = el.getAttribute('aria-label') ?? '';
          expect(label).toContain('Assigned');
          expect(label).toContain(STATUS_TEXT[item.status]);
          expect(el.querySelector(`[data-status-badge="${item.status}"]`)).not.toBeNull();
        }
        for (const el of root.querySelectorAll('[data-skill-id]:not([data-assigned])'))
          expect(el.getAttribute('aria-label')).not.toContain('Assigned');
      });

      it('explains the badges with a visible legend (glyph plus text, not colour alone)', async () => {
        const root: HTMLElement = (await render(tree, bySlot(slot))).nativeElement;
        const legend = root.querySelector('[data-assignment-legend]')!;
        expect(legend).not.toBeNull();
        for (const text of Object.values(STATUS_TEXT)) expect(legend.textContent).toContain(text);
        expect(legend.querySelectorAll('svg [data-status-badge]')).toHaveLength(3);
      });

      it('lists every assigned node first with its status and rationale', async () => {
        const root: HTMLElement = (await render(tree, bySlot(slot))).nativeElement;
        const items = [...root.querySelectorAll('.skill-tree__list li[data-assigned="true"]')];
        expect(items).toHaveLength(bySlot(slot).length);
        const text = items.map((li) => li.textContent).join(' ');
        for (const item of bySlot(slot)) {
          expect(text).toContain(item.rationale);
          expect(text).toContain(STATUS_TEXT[item.status]);
        }
        const all = [...root.querySelectorAll('.skill-tree__list li')];
        expect(all).toHaveLength(tree.nodes.length);
        const firstUnassigned = all.findIndex((li) => !li.hasAttribute('data-assigned'));
        expect(all.slice(firstUnassigned).some((li) => li.hasAttribute('data-assigned'))).toBe(
          false,
        );
      });
    });
  }

  it('shows rationale, status and points of the focused assigned node in the tooltip', async () => {
    const first = bySlot('chaman')[0];
    const fixture = await render(shaman, bySlot('chaman'));
    const root: HTMLElement = fixture.nativeElement;
    node(root, first.skill_node_id!).dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
    const detail = root.querySelector('[role="tooltip"]')!.textContent ?? '';
    expect(detail).toContain(first.rationale);
    expect(detail).toContain('Recommended');
    if (first.points_label) expect(detail).toContain(first.points_label);
  });

  it('flags the active purchase-step nodes by slug', async () => {
    const target = bySlot('chaman')[1];
    const root: HTMLElement = (await render(shaman, bySlot('chaman'), [target.slug])).nativeElement;
    const active = root.querySelectorAll('[data-active-step="true"]');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('data-skill-id')).toBe(target.skill_node_id);
    expect(active[0].getAttribute('aria-label')).toContain('Active step');
  });

  it('with no assignments it is the plain catalog mode (nothing marked)', async () => {
    const root: HTMLElement = (await render(shaman, [])).nativeElement;
    expect(root.querySelectorAll('[data-assigned]')).toHaveLength(0);
    expect(root.querySelectorAll('.skill-tree__node--unassigned')).toHaveLength(0);
  });
});
