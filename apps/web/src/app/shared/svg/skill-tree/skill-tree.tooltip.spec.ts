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

  describe('viewport following (spec004 T054)', () => {
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
    const rafCallbacks: FrameRequestCallback[] = [];
    let nodeRect = rect(600, 400, 40, 40);

    function mockLayout() {
      rafCallbacks.length = 0;
      nodeRect = rect(600, 400, 40, 40);
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        if (this.hasAttribute('data-skill-id')) return nodeRect;
        if (this.getAttribute('role') === 'tooltip') return rect(0, 0, 200, 100);
        if (this.classList.contains('skill-tree__stage')) return rect(100, 100, 900, 600);
        return rect(0, 0, 0, 0);
      });
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    }
    const flushFrames = () => rafCallbacks.splice(0).forEach((cb) => cb(0));

    it.each(['resize', 'orientationchange'])(
      'keeps the open tooltip next to its node after a window %s',
      async (type) => {
        mockLayout();
        const f = await render();
        fire(node(f, child.id), 'mouseenter');
        f.detectChanges();
        await f.whenStable();
        const el = tooltip(f)[0];
        expect(el.style.left).toBe('420px');
        expect(el.style.top).toBe('192px');
        expect(el.getAttribute('data-side')).toBe('top');
        // The node ends up at the top edge after the viewport change: the tooltip flips below it.
        nodeRect = rect(300, 10, 40, 40);
        window.dispatchEvent(new Event(type));
        flushFrames();
        expect(el.getAttribute('data-side')).toBe('bottom');
        expect(el.style.left).not.toBe('420px');
        expect(el.style.top).not.toBe('192px');
        // Still next to the node: its vertical gap to the node is the placement offset.
        const gap = parseFloat(el.style.top) + 100 - (nodeRect.bottom as number);
        expect(Math.abs(gap)).toBeLessThanOrEqual(16);
      },
    );

    it('removes the window listeners when the tooltip closes', async () => {
      mockLayout();
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      const f = await render();
      fire(node(f, child.id), 'mouseenter');
      f.detectChanges();
      await f.whenStable();
      const count = (spy: typeof add, name: string) =>
        spy.mock.calls.filter(([t]) => t === name).length;
      expect(count(add, 'resize')).toBe(1);
      expect(count(add, 'orientationchange')).toBe(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      await f.whenStable();
      expect(count(remove, 'resize')).toBe(1);
      expect(count(remove, 'orientationchange')).toBe(1);
    });

    it('leaves no listeners when the tooltip opens and closes before the render', async () => {
      mockLayout();
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      const f = await render();
      const el = node(f, child.id);
      fire(el, 'mouseenter');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      await f.whenStable();
      const names = ['resize', 'orientationchange'];
      const added = add.mock.calls.filter(([t]) => names.includes(t as string)).length;
      const removed = remove.mock.calls.filter(([t]) => names.includes(t as string)).length;
      expect(added).toBe(removed);
      expect(tooltip(f)).toHaveLength(0);
    });
  });

  describe('touch pin and retired bottom panel (spec004 T012)', () => {
    const tap = (f: { nativeElement: unknown }, id: string) => {
      const el = node(f, id);
      fire(el, 'mouseenter');
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };
    const closeButton = (f: { nativeElement: unknown }) =>
      tooltip(f)[0]?.querySelector<HTMLButtonElement>('button[data-close-detail]') ?? null;

    it('has no bottom detail panel in catalog mode but keeps the full text list', async () => {
      const f = await render();
      expect(host(f).querySelector('[data-detail-panel]')).toBeNull();
      expect(host(f).querySelector('.skill-tree__detail')).toBeNull();
      const items = host(f).querySelectorAll('details.skill-tree__list li');
      expect(items).toHaveLength(tree.nodes.length);
    });

    it('does not show the close button on plain hover or focus', async () => {
      const f = await render();
      fire(node(f, child.id), 'mouseenter');
      f.detectChanges();
      expect(tooltip(f)).toHaveLength(1);
      expect(closeButton(f)).toBeNull();
    });

    it('pins the tooltip on tap with a close button, and it survives the pointer leaving', async () => {
      const f = await render();
      vi.useFakeTimers();
      tap(f, child.id);
      fire(node(f, child.id), 'mouseleave');
      f.detectChanges();
      vi.advanceTimersByTime(2000);
      f.detectChanges();
      expect(tooltip(f)).toHaveLength(1);
      expect(closeButton(f)).not.toBeNull();
      expect(node(f, child.id).getAttribute('aria-pressed')).toBe('true');
      expect(node(f, child.id).getAttribute('aria-describedby')).toBe(tooltip(f)[0].id);
    });

    it('closes when tapping outside, without stealing focus, but not when tapping inside it', async () => {
      const f = await render();
      tap(f, child.id);
      f.detectChanges();
      tooltip(f)[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      f.detectChanges();
      expect(tooltip(f)).toHaveLength(1);
      const other = document.createElement('button');
      document.body.append(other);
      other.focus();
      other.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      f.detectChanges();
      expect(tooltip(f)).toHaveLength(0);
      expect(node(f, child.id).getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(other);
      other.remove();
    });

    it('moves the pin to another node when it is tapped', async () => {
      const f = await render();
      tap(f, child.id);
      f.detectChanges();
      node(f, root0.id).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      tap(f, root0.id);
      f.detectChanges();
      expect(tooltip(f)).toHaveLength(1);
      expect(tooltip(f)[0].textContent).toContain(root0.name.en);
      expect(node(f, child.id).getAttribute('aria-pressed')).toBe('false');
      expect(closeButton(f)).not.toBeNull();
    });

    it('closes with its button and returns the focus to the node', async () => {
      const f = await render();
      const el = node(f, child.id);
      el.focus();
      tap(f, child.id);
      f.detectChanges();
      closeButton(f)!.click();
      f.detectChanges();
      expect(tooltip(f)).toHaveLength(0);
      expect(document.activeElement).toBe(el);
      expect(el.getAttribute('aria-pressed')).toBe('false');
    });

    it('Escape unpins a tapped tooltip and restores the focus to the node', async () => {
      const f = await render();
      const el = node(f, child.id);
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      f.detectChanges();
      expect(closeButton(f)).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(tooltip(f)).toHaveLength(0);
      expect(el.getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(el);
    });
  });
});
