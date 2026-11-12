import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { PublicBuild } from '@gd/domain';
import { SkillTree } from './skill-tree';

type Mastery = PublicBuild['masteries'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

const mastery: Mastery = {
  slug: 'chaman',
  name_es: 'Chamán',
  name_en: 'Shaman',
  role_text: 'Daño elemental',
};

const nodes: readonly SkillNode[] = Object.freeze([
  Object.freeze({
    slug: 'golpe-primigenio',
    mastery_slug: 'chaman',
    name_es: 'Golpe Primigenio',
    name_en: 'Primal Strike',
    bar_required: 1,
    parent_slug: null,
    status: 'recomendada',
    tag: null,
    rationale: 'Ataque principal de prueba.',
    max_points_hint: 12,
    points_label: '12 puntos',
    layout: Object.freeze({ x: 120, y: 40 }),
  }),
  Object.freeze({
    slug: 'viento-demonico',
    mastery_slug: 'chaman',
    name_es: 'Viento Demoníaco',
    name_en: 'Wind Devil',
    bar_required: 10,
    parent_slug: 'golpe-primigenio',
    status: 'meta',
    tag: 'Transmutador',
    rationale: 'Ayuda a reducir resistencias.',
    max_points_hint: null,
    points_label: null,
    layout: Object.freeze({ x: 240, y: 110 }),
  }),
  Object.freeze({
    slug: 'espiritu-de-roble',
    mastery_slug: 'chaman',
    name_es: 'Espíritu de Roble',
    name_en: 'Oak Skin',
    bar_required: 10,
    parent_slug: 'golpe-primigenio',
    status: 'omitir',
    tag: null,
    rationale: 'Opción defensiva para consultar.',
    max_points_hint: 1,
    points_label: '1 punto',
    layout: Object.freeze({ x: 0, y: 110 }),
  }),
]);

describe('gd-skill-tree', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(overrides: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'primary');
    fixture.componentRef.setInput('mastery', mastery);
    fixture.componentRef.setInput('nodes', nodes);
    fixture.componentRef.setInput('activeIds', []);
    for (const [name, value] of Object.entries(overrides))
      fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    return fixture;
  }

  it('renders editorial coordinates, deterministic parent edges, states, and an equivalent native list', async () => {
    const fixture = await render({ activeIds: ['viento-demonico'] });
    const root: HTMLElement = fixture.nativeElement;
    const svg: SVGSVGElement = root.querySelector('svg')!;
    const primal = root.querySelector<SVGGElement>('[data-skill-id="golpe-primigenio"]')!;
    const wind = root.querySelector<SVGGElement>('[data-skill-id="viento-demonico"]')!;

    expect(svg.getAttribute('role')).not.toBe('img');
    expect(svg.querySelector('title')?.textContent).toContain('Chamán');
    expect(svg.querySelectorAll('[data-edge-from="golpe-primigenio"][data-edge-to]').length).toBe(
      2,
    );
    const primalX = Number(primal.getAttribute('transform')?.match(/translate\(([-\d.]+)/)?.[1]);
    const windX = Number(wind.getAttribute('transform')?.match(/translate\(([-\d.]+)/)?.[1]);
    expect(windX - primalX).toBe(120);
    const labelledText = wind
      .getAttribute('aria-labelledby')!
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ');
    expect(labelledText).toContain('Viento Demoníaco');
    expect(labelledText).toContain('Bar 10');
    expect(wind.getAttribute('aria-pressed')).toBe('false');
    expect(wind.getAttribute('data-active-step')).toBe('true');
    expect(labelledText).toContain('Active step');
    const description = document.getElementById(wind.getAttribute('aria-describedby')!)!;
    expect(description.textContent).toContain('Wind Devil');
    expect(description.textContent).toContain('Meta');
    expect(description.textContent).toContain('Ayuda a reducir resistencias.');
    expect(root.querySelector('.skill-tree__active-label')?.textContent).toContain('Active step');
    expect(
      root.querySelector('[data-skill-state="omitir"]')?.textContent?.replace(/\s+/g, ' '),
    ).toContain('Espíritu de Roble');

    const list = root.querySelector<HTMLDetailsElement>('details.skill-tree__list')!;
    expect(list.open).toBe(true);
    expect(list.querySelectorAll('li')).toHaveLength(3);
    expect(list.textContent).toContain('12 puntos');
    expect(list.textContent).toContain('Transmutador');
  });

  it('keeps activeIds separate from selection, reports unknown bar honestly, and permits reading advice', async () => {
    const fixture = await render({ activeIds: ['golpe-primigenio'], currentBar: undefined });
    const root: HTMLElement = fixture.nativeElement;
    const primal = root.querySelector<SVGGElement>('[data-skill-id="golpe-primigenio"]')!;
    const wind = root.querySelector<SVGGElement>('[data-skill-id="viento-demonico"]')!;

    expect(root.querySelector('[data-selected="true"]')).toBeNull();
    expect(primal.getAttribute('data-active-step')).toBe('true');
    expect(root.textContent).not.toContain('Bar too low');
    expect(wind.getAttribute('aria-disabled')).toBeNull();
    wind.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(root.querySelector('[aria-live="polite"]')?.textContent).toContain('Viento Demoníaco');
    expect(document.activeElement).not.toBe(wind);

    fixture.componentRef.setInput('currentBar', 1);
    await fixture.whenStable();
    expect(root.textContent).toContain('Bar too low');
    expect(wind.getAttribute('aria-disabled')).toBeNull();
    fixture.componentRef.setInput('currentBar', 10);
    await fixture.whenStable();
    expect(root.textContent).not.toContain('Bar too low');
  });

  it('uses roving focus for arrows and Home/End, opens with Enter/Space, and restores focus on Escape', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    const primal = root.querySelector<SVGGElement>('[data-skill-id="golpe-primigenio"]')!;
    const wind = root.querySelector<SVGGElement>('[data-skill-id="viento-demonico"]')!;
    expect(primal.tabIndex).toBe(0);
    expect(wind.tabIndex).toBe(-1);

    primal.focus();
    primal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(wind);
    wind.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(primal);
    primal.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement?.getAttribute('data-skill-id')).toBe('espiritu-de-roble');
    wind.focus();
    wind.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('[data-selected="true"]')?.getAttribute('data-skill-id')).toBe(
      'viento-demonico',
    );
    expect(root.querySelector('[data-detail-panel]')?.textContent).toContain('Transmutador');
    wind.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(wind);
    expect(root.querySelector('[data-selected="true"]')).toBeNull();
    primal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('[data-selected="true"]')?.getAttribute('data-skill-id')).toBe(
      'golpe-primigenio',
    );
    root.querySelector<HTMLButtonElement>('[data-close-detail]')!.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(primal);
  });

  it('scopes generated ids to each tree instance and mastery', async () => {
    const one = await render();
    const two = await render({ treeId: 'secondary' });
    const oneIds = [...one.nativeElement.querySelectorAll('[id]')].map((node: Element) => node.id);
    const twoIds = [...two.nativeElement.querySelectorAll('[id]')].map((node: Element) => node.id);
    expect(new Set([...oneIds, ...twoIds]).size).toBe(oneIds.length + twoIds.length);
    expect(oneIds.some((id: string) => id.startsWith('primary-chaman-'))).toBe(true);
    expect(twoIds.some((id: string) => id.startsWith('secondary-chaman-'))).toBe(true);
  });

  it('filters mixed mastery inputs and scopes labels to the selected mastery', async () => {
    const demolisher: Mastery = {
      slug: 'demoledor',
      name_es: 'Demoledor',
      name_en: 'Demolitionist',
      role_text: 'Daño de fuego',
    };
    const otherMasteryNode: SkillNode = {
      ...nodes[0],
      mastery_slug: 'demoledor',
      name_es: 'Bomba de racimo',
      name_en: 'Canister Bomb',
    };
    const fixture = await render({
      treeId: 'demolisher',
      mastery: demolisher,
      nodes: [...nodes, otherMasteryNode],
    });
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('[data-skill-id]')).toHaveLength(1);
    expect(root.textContent).toContain('Bomba de racimo');
    expect(root.textContent).not.toContain('Viento Demoníaco');
  });

  it('shortens a long visible label while keeping the full bilingual name available', async () => {
    const longNodes = [
      {
        ...nodes[0],
        name_es: 'Habilidad sintética con un nombre extenso que debe acortarse en el diagrama',
        name_en: 'Synthetic skill with a long name preserved for assistive technology',
      },
    ];
    const fixture = await render({ nodes: longNodes });
    const root = fixture.nativeElement as HTMLElement;
    const node = root.querySelector<SVGGElement>('[data-skill-id="golpe-primigenio"]')!;
    const visible = node.querySelector('.skill-tree__name')?.textContent ?? '';
    const lines = [...node.querySelectorAll('.skill-tree__name tspan')].map(
      (line) => line.textContent ?? '',
    );
    const complete =
      document.getElementById(node.getAttribute('aria-describedby')!)?.textContent ?? '';
    expect(visible).toContain('…');
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(Math.max(...lines.map((line) => line.trim().length))).toBeLessThanOrEqual(24);
    expect(complete).toContain('Habilidad sintética con un nombre extenso');
    expect(complete).toContain('Synthetic skill with a long name preserved');
    expect(node.getAttribute('aria-labelledby')).not.toContain('-full-title');
    expect(node.getAttribute('aria-describedby')).toContain('-listitem');
  });

  it('keeps the native list available for empty data and contains invalid-tree errors without throwing', async () => {
    const empty = await render({ nodes: [] });
    const emptyRoot = empty.nativeElement as HTMLElement;
    expect(emptyRoot.querySelector<HTMLDetailsElement>('details.skill-tree__list')?.open).toBe(
      true,
    );
    expect(emptyRoot.textContent).toContain('There are no skills');

    const invalid = await render({ nodes: [nodes[0], { ...nodes[1], parent_slug: 'missing' }] });
    expect(invalid.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be drawn',
    );
    expect(invalid.nativeElement.querySelector('details.skill-tree__list li')).not.toBeNull();
  });

  it('renders an isolated tree from a larger, frozen 120-node input', async () => {
    const many = Object.freeze(
      Array.from({ length: 120 }, (_, index) =>
        Object.freeze({
          ...nodes[0],
          slug: `nodo-${index}`,
          parent_slug: index === 0 ? null : `nodo-${index - 1}`,
          layout: Object.freeze({ x: index, y: index * 12 }),
        }),
      ),
    );
    const fixture = await render({ nodes: many });
    expect(fixture.nativeElement.querySelectorAll('svg [data-skill-id]')).toHaveLength(120);
    expect(many).toHaveLength(120);
  });
});
