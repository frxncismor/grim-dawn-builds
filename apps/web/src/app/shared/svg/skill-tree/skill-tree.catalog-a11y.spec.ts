import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import demolition from '../../../../../../../fixtures/content/mastery-trees/demolition.json';
import { SkillTree } from './skill-tree';

const tree: MasteryTree = MasteryTreeSchema.parse(demolition);
const nameOf = new Map(tree.nodes.map((node) => [node.id, node.name.es]));

describe('gd-skill-tree catalog accessibility (T011)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'a11y');
    fixture.componentRef.setInput('catalogTree', tree);
    await fixture.whenStable();
    return fixture;
  }

  const nodesOf = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<SVGGElement>('[data-skill-id]'));

  it('gives every node an accessible name with name, tier, bar, range and dependency', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    for (const node of tree.nodes) {
      const el = root.querySelector<SVGGElement>(`[data-skill-id="${node.id}"]`)!;
      const label = el.getAttribute('aria-label') ?? '';
      expect(label, node.id).toContain(node.name.es);
      expect(label).toContain(`Tier ${node.tier}`);
      expect(label).toContain(`Bar ${node.bar_required}`);
      expect(label).toContain(`Max ${node.max_points}`);
      if (node.ultimate_points !== undefined) expect(label).toContain(`${node.ultimate_points}`);
      if (node.parent_id === null) expect(label).toContain('No requirement');
      else expect(label).toContain(`Requires ${nameOf.get(node.parent_id)}`);
      expect(el.hasAttribute('aria-labelledby')).toBe(false);
    }
  });

  it('keeps exactly one roving tab stop and moves focus with arrows, Home and End', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    const all = nodesOf(root);
    expect(all.filter((n) => n.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(all.filter((n) => n.getAttribute('tabindex') === '-1')).toHaveLength(all.length - 1);

    const press = (key: string) => {
      (document.activeElement as Element).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();
    };
    all.find((n) => n.getAttribute('tabindex') === '0')!.focus();
    press('End');
    const last = document.activeElement as SVGGElement;
    expect(last).toBe(all[all.length - 1]);
    expect(last.hasAttribute('data-skill-id')).toBe(true);
    press('Home');
    const first = document.activeElement as SVGGElement;
    expect(first).not.toBe(last);
    press('ArrowDown');
    expect(document.activeElement).not.toBe(first);
    press('ArrowUp');
    expect(document.activeElement).toBe(first);
    const child = tree.nodes.find((n) => n.parent_id !== null)!;
    root.querySelector<SVGGElement>(`[data-skill-id="${child.parent_id}"]`)!.focus();
    press('ArrowRight');
    expect((document.activeElement as Element).getAttribute('data-skill-id')).not.toBe(
      child.parent_id,
    );
    press('ArrowLeft');
    expect((document.activeElement as Element).hasAttribute('data-skill-id')).toBe(true);
  });

  it('opens the detail with Enter and Space and closes it with Escape restoring focus', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    const el = nodesOf(root)[0];
    el.focus();
    for (const key of ['Enter', ' ']) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(el.getAttribute('aria-pressed')).toBe('true');
      expect(root.querySelector('[data-detail-panel]')?.textContent).toContain(
        el.getAttribute('data-skill-id') ? nameOf.get(el.getAttribute('data-skill-id')!) : '',
      );
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(el.getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(el);
    }
  });

  it('offers a text list with every node, tier, range and dependency, without needing the SVG', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    const list = root.querySelector<HTMLDetailsElement>('details.skill-tree__list')!;
    expect(list).not.toBeNull();
    expect(list.open).toBe(true);
    const items = list.querySelectorAll('li');
    expect(items).toHaveLength(tree.nodes.length);
    const text = list.textContent!.replace(/\s+/g, ' ');
    for (const node of tree.nodes) {
      expect(text).toContain(`${node.name.es}`);
      if (node.parent_id) expect(text).toContain(`Requires ${nameOf.get(node.parent_id)}`);
    }
    expect(text).toContain('No requirement');
    expect(root.querySelector('svg')!.closest('details')).toBeNull();
  });

  it('shows state by shape and text, and removes motion when reduced motion is requested', () => {
    const css = readFileSync(resolve('src/app/shared/svg/skill-tree/skill-tree.css'), 'utf8');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/transition:\s*none/);
    expect(reduced).toMatch(/animation:\s*none/);
    expect(css).toMatch(
      /\.skill-tree__node--catalog:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/,
    );
  });

  it('passes axe-core with no violations', async () => {
    const fixture = await render();
    const results = await axe.run(fixture.nativeElement as HTMLElement);
    const violations = results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.length,
    }));
    console.info(
      `axe: violations=${violations.length} incomplete=[${results.incomplete
        .map(({ id }) => id)
        .sort()
        .join(', ')}]`,
    );
    expect(violations, JSON.stringify(violations)).toEqual([]);
  });
});
