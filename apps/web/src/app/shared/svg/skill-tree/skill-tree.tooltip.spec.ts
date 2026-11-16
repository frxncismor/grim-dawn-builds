import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MasteryTreeSchema, type MasteryTree, type PublicBuild } from '@gd/domain';
import demolitionRaw from '../../../../../../../fixtures/content/mastery-trees/demolition.json';
import guideRaw from '../../../../../../../fixtures/content/builds/chaman-demoledor-golpe-primigenio.json';
import { SkillTree } from './skill-tree';

type SkillNode = PublicBuild['skill_nodes'][number];

const tree: MasteryTree = MasteryTreeSchema.parse(demolitionRaw);
const guideNodes = (guideRaw.skill_nodes as unknown as SkillNode[]).filter(
  (n) => n.mastery_slug === 'demoledor',
);
// The test locale is English: the main name is `name.en`.
const child = tree.nodes.find((n) => n.parent_id !== null)!;
const root0 = tree.nodes.find((n) => n.parent_id === null)!;
const parentOf = (id: string) => tree.nodes.find((n) => n.id === id)!;

describe('gd-skill-tree tooltip next to the node (spec004 T011)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(assignments: readonly SkillNode[] = []) {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'tip');
    fixture.componentRef.setInput('catalogTree', tree);
    if (assignments.length) fixture.componentRef.setInput('assignments', assignments);
    await fixture.whenStable();
    return fixture;
  }
  const host = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
  const node = (f: { nativeElement: unknown }, id: string) =>
    host(f).querySelector<SVGGElement>(`[data-skill-id="${id}"]`)!;
  const tooltip = (f: { nativeElement: unknown }) =>
    host(f).querySelectorAll<HTMLElement>('[role="tooltip"]');
  const fire = (el: Element, type: string) =>
    el.dispatchEvent(new MouseEvent(type, { bubbles: false }));

  it('shows nothing until a node is hovered or focused', async () => {
    const f = await render();
    expect(tooltip(f)).toHaveLength(0);
    expect(host(f).querySelector('[aria-describedby^="tip-"][data-skill-id]')).toBeNull();
  });

  it('shows a role=tooltip with the factual data on hover and links it with aria-describedby', async () => {
    const f = await render();
    fire(node(f, child.id), 'mouseenter');
    f.detectChanges();
    const tips = tooltip(f);
    expect(tips).toHaveLength(1);
    const text = tips[0].textContent!.replace(/\s+/g, ' ');
    expect(text).toContain(child.name.en);
    expect(text).toContain(child.name.es);
    expect(text).toContain(`Tier ${child.tier}`);
    expect(text).toContain(`Bar ${child.bar_required}`);
    expect(text).toContain(`Max ${child.max_points}`);
    expect(text).toContain(`Requires ${parentOf(child.parent_id!).name.en}`);
    expect(tips[0].id).not.toBe('');
    expect(node(f, child.id).getAttribute('aria-describedby')).toBe(tips[0].id);
    expect(node(f, root0.id).hasAttribute('aria-describedby')).toBe(false);
  });

  it('hides it after a short tolerance when the pointer leaves, and keeps it while over the tooltip', async () => {
    const f = await render();
    vi.useFakeTimers();
    const el = node(f, child.id);
    fire(el, 'mouseenter');
    f.detectChanges();
    fire(el, 'mouseleave');
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(1);
    // Entering the tooltip inside the tolerance keeps it open (WCAG 1.4.13 hoverable).
    fire(tooltip(f)[0], 'mouseenter');
    vi.advanceTimersByTime(1000);
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(1);
    fire(tooltip(f)[0], 'mouseleave');
    vi.advanceTimersByTime(1000);
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(0);
    expect(el.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows on keyboard focus (also after arrow navigation) and hides on blur', async () => {
    const f = await render();
    const start = node(f, root0.id);
    start.focus();
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(1);
    expect(tooltip(f)[0].textContent).toContain(root0.name.en);
    start.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    );
    f.detectChanges();
    const now = document.activeElement as Element;
    expect(now).not.toBe(start);
    expect(tooltip(f)).toHaveLength(1);
    expect(now.getAttribute('aria-describedby')).toBe(tooltip(f)[0].id);
    (now as HTMLElement).blur();
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(0);
  });

  it('shows at most one tooltip, and the focused node wins over a residual hover', async () => {
    const f = await render();
    fire(node(f, child.id), 'mouseenter');
    node(f, root0.id).focus();
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(1);
    expect(tooltip(f)[0].textContent).toContain(root0.name.en);
    expect(node(f, child.id).hasAttribute('aria-describedby')).toBe(false);
  });

  it('closes with Escape without moving focus, and reopens on the next interaction', async () => {
    const f = await render();
    const el = node(f, child.id);
    el.focus();
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(0);
    expect(document.activeElement).toBe(el);
    fire(node(f, root0.id), 'mouseenter');
    f.detectChanges();
    expect(tooltip(f)).toHaveLength(1);
  });

  it('adds state, points and rationale of the guide in assignment mode', async () => {
    const f = await render(guideNodes);
    const assigned = guideNodes.find((n) => n.skill_node_id)!;
    fire(node(f, assigned.skill_node_id!), 'mouseenter');
    f.detectChanges();
    const text = tooltip(f)[0].textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Assigned');
    expect(text).toContain(assigned.rationale);
    if (assigned.points_label) expect(text).toContain(assigned.points_label);
  });

  it('positions the tooltip next to the node, relative to its stage, with DOM style properties', async () => {
    const rects = new Map<string, DOMRect>();
    const rect = (left: number, top: number, width: number, height: number) =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
      }) as DOMRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.hasAttribute('data-skill-id')) return rect(600, 400, 40, 40);
      if (this.getAttribute('role') === 'tooltip') return rect(0, 0, 200, 100);
      if (this.classList.contains('skill-tree__stage')) return rect(100, 100, 900, 600);
      return rects.get('other') ?? rect(0, 0, 0, 0);
    });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    const f = await render();
    fire(node(f, child.id), 'mouseenter');
    f.detectChanges();
    await f.whenStable();
    const el = tooltip(f)[0];
    // top side: left = 600 + 20 - 100 - stage.left(100); top = 400 - 8 - 100 - stage.top(100).
    expect(el.style.left).toBe('420px');
    expect(el.style.top).toBe('192px');
    expect(el.getAttribute('data-side')).toBe('top');
    expect(el.style.visibility).not.toBe('hidden');
  });
});
