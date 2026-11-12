import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { PublicBuild } from '@gd/domain';
import { DevotionMap } from './devotion-map';

type Constellation = PublicBuild['constellations'][number];
type DevotionStep = PublicBuild['devotion_steps'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

const constellations = Object.freeze([
  Object.freeze({
    slug: 'aurora',
    name_en: 'Aurora',
    name_es: 'Aurora',
    tier_level: 2,
    affinity_required: Object.freeze({ ascendente: 5, primordial: 2 }),
    affinity_granted: Object.freeze({ ascendente: 3 }),
    layout: Object.freeze({
      nodes: Object.freeze([
        Object.freeze({ id: 'shared-star', x: 0, y: 0 }),
        Object.freeze({ id: 'east-star', x: 120, y: 0 }),
        Object.freeze({ id: 'south-star', x: 60, y: 80 }),
      ]),
      edges: Object.freeze([
        Object.freeze({ from: 'shared-star', to: 'east-star' }),
        Object.freeze({ from: 'east-star', to: 'south-star' }),
        Object.freeze({ from: 'south-star', to: 'shared-star' }),
      ]),
    }),
  }),
  Object.freeze({
    slug: 'aether',
    name_en: 'Aether',
    name_es: null,
    tier_level: null,
    affinity_required: null,
    affinity_granted: Object.freeze({}),
    layout: Object.freeze({
      nodes: Object.freeze([Object.freeze({ id: 'shared-star', x: 10, y: 20 })]),
      edges: Object.freeze([]),
    }),
  }),
]) as unknown as readonly Constellation[];

const skillNodes: readonly SkillNode[] = Object.freeze([
  Object.freeze({
    slug: 'golpe-sintetico',
    mastery_slug: 'maestria-prueba',
    name_es: 'Descarga de prueba',
    name_en: 'Sample Discharge',
    bar_required: 1,
    parent_slug: null,
    status: 'recomendada',
    tag: null,
    rationale: 'Habilidad de destino sintética.',
    max_points_hint: 1,
    points_label: '1 punto de prueba',
    layout: Object.freeze({ x: 0, y: 0 }),
  }),
  Object.freeze({
    slug: 'defensa-sintetica',
    mastery_slug: 'maestria-prueba',
    name_es: 'Defensa de prueba',
    name_en: 'Sample Defense',
    bar_required: 10,
    parent_slug: null,
    status: 'meta',
    tag: null,
    rationale: 'Segunda habilidad de destino sintética.',
    max_points_hint: null,
    points_label: null,
    layout: Object.freeze({ x: 0, y: 0 }),
  }),
]);

const steps = Object.freeze([
  Object.freeze({
    position: 1,
    label: 'Abrir la senda',
    constellation_slug: 'aurora',
    title_override: 'Poder sintético de Aurora',
    body: 'Consejo de ruta sintético.',
    bindings: Object.freeze([
      Object.freeze({ power_en: 'Stormcaller', skill_node_slug: 'golpe-sintetico' }),
    ]),
    accent: 'storm',
    verification: 'verificado',
    kind: 'ruta',
  }),
  Object.freeze({
    position: 2,
    label: 'Mención sin árbol',
    constellation_slug: 'aurora',
    title_override: null,
    body: 'Mención externa declarada en un paso sin verificar.',
    bindings: Object.freeze([
      Object.freeze({
        power_en: 'Unbound Spark',
        skill_node_slug: null,
        skill_name_es: 'Mención de prueba',
      }),
    ]),
    accent: 'ember',
    verification: 'sin_verificar',
    kind: 'ruta',
  }),
  Object.freeze({
    position: 3,
    label: 'Comprobar afinidad',
    constellation_slug: null,
    title_override: 'Comprobación sintética',
    body: 'Paso textual sin constelación asociada.',
    bindings: Object.freeze([
      Object.freeze({ power_en: 'Sample Guard', skill_node_slug: 'defensa-sintetica' }),
    ]),
    accent: 'storm',
    verification: 'verificado',
    kind: 'verificacion',
  }),
  Object.freeze({
    position: 4,
    label: 'Limpiar puntos sobrantes',
    constellation_slug: null,
    title_override: null,
    body: 'Instrucción sintética de limpieza.',
    bindings: Object.freeze([]),
    accent: 'ember',
    verification: 'verificado',
    kind: 'limpieza',
  }),
  Object.freeze({
    position: 5,
    label: 'Continuar por Aether',
    constellation_slug: 'aether',
    title_override: null,
    body: 'Paso sintético asociado a una segunda constelación.',
    bindings: Object.freeze([]),
    accent: 'storm',
    verification: 'verificado',
    kind: 'ruta',
  }),
]) as unknown as readonly DevotionStep[];

describe('gd-devotion-map', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(overrides: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(DevotionMap);
    fixture.componentRef.setInput('mapId', 'primary');
    fixture.componentRef.setInput('constellations', constellations);
    fixture.componentRef.setInput('steps', steps);
    fixture.componentRef.setInput('skillNodes', skillNodes);
    for (const [name, value] of Object.entries(overrides)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return fixture;
  }

  it('preserves closed local edges and coordinates without inventing links between constellations', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const svg = root.querySelector('svg')!;
    const north = root.querySelector<SVGGElement>('[data-constellation-id="aurora"]')!;
    const south = root.querySelector<SVGGElement>('[data-constellation-id="aether"]')!;

    expect(svg.getAttribute('role')).not.toBe('img');
    expect(svg.querySelectorAll('[data-edge-from][data-edge-to]')).toHaveLength(3);
    expect(
      svg.querySelector('[data-edge-from="south-star"][data-edge-to="shared-star"]'),
    ).not.toBeNull();
    const stars = north.parentElement!;
    const eastX = Number(stars.querySelector('[data-star-id="east-star"]')?.getAttribute('cx'));
    const originX = Number(stars.querySelector('[data-star-id="shared-star"]')?.getAttribute('cx'));
    expect(eastX - originX).toBe(120);
    expect(
      root
        .querySelector('[data-constellation-id="aether"]')
        ?.parentElement?.querySelector('[data-star-id="shared-star"]'),
    ).not.toBeNull();
    expect(north.id).not.toBe(south.id);
    expect(svg.querySelectorAll('[data-constellation-link]')).toHaveLength(0);
  });

  it('draws only documented affinity thresholds and keeps unknown distinct from explicit empty maps', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const north = root.querySelector('[data-constellation-id="aurora"]')!;

    expect(north.parentElement?.querySelectorAll('[data-threshold-key]')).toHaveLength(2);
    expect(
      north.parentElement?.querySelector('[data-threshold-key="ascendente"]')?.textContent,
    ).toContain('5');
    expect(root.querySelector('[data-affinity-granted="aurora"]')?.textContent).toContain(
      'ascendente 3',
    );
    const emptyAffinity = root.querySelector(
      '[data-list-constellation][data-constellation-id="aether"]',
    );
    expect(emptyAffinity?.textContent).toContain('Sin datos');
    expect(emptyAffinity?.textContent).toContain('Sin afinidad otorgada');
    expect(emptyAffinity?.textContent).not.toMatch(/\b0\b/);
    const explicitlyEmpty = [constellations[0], { ...constellations[1], affinity_required: {} }];
    const emptyFixture = await render({ constellations: explicitlyEmpty });
    expect(
      emptyFixture.nativeElement.querySelector(
        '[data-list-constellation][data-constellation-id="aether"]',
      )?.textContent,
    ).toContain('Sin requisitos documentados');
  });

  it('resolves real bindings, labels external mentions, and retains unbound route and cleanup steps', async () => {
    const fixture = await render({ activeStepPosition: undefined });
    const root = fixture.nativeElement as HTMLElement;
    const actual = root.querySelector(
      'details [data-binding-id="primary-aurora-step-1-0-binding-0"]',
    );

    expect(actual?.textContent).toContain('Stormcaller');
    expect(actual?.textContent).toContain('Descarga de prueba');
    expect(actual?.textContent).toContain('Sample Discharge');
    const mention = root.querySelector(
      'details [data-binding-id="primary-aurora-step-2-1-binding-0"]',
    );
    expect(mention?.textContent).toContain('Unbound Spark');
    expect(mention?.textContent).toContain('Mención de prueba');
    expect(mention?.textContent).toContain('Mención externa');
    expect(root.querySelector('[data-step-position="3"]')?.textContent).toContain(
      'Comprobar afinidad',
    );
    expect(root.querySelector('[data-step-position="4"]')?.textContent).toContain(
      'Limpiar puntos sobrantes',
    );
    expect(root.textContent).toContain('verifica en GrimTools antes de gastar');
  });

  it('keeps active route position separate from selected group detail and restores focus on Escape', async () => {
    const fixture = await render({ activeStepPosition: 2 });
    const root = fixture.nativeElement as HTMLElement;
    const north = root.querySelector<SVGGElement>('[data-constellation-id="aurora"]')!;
    const south = root.querySelector<SVGGElement>('[data-constellation-id="aether"]')!;

    expect(north.getAttribute('data-active-step')).toBe('true');
    expect(north.getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('[data-step-position="2"]')?.getAttribute('data-active-step')).toBe(
      'true',
    );
    north.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(root.querySelector('[data-detail-panel]')?.textContent).toContain('Mención sin árbol');
    expect(document.activeElement).not.toBe(north);
    north.focus();
    north.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(south);
    south.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(north);
    north.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(north.getAttribute('aria-pressed')).toBe('true');
    expect(north.getAttribute('data-active-step')).toBe('true');
    north.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(north);
    expect(north.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps complete power bindings and verification advice in the selected detail', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    root
      .querySelector<SVGGElement>('svg [data-constellation-id="aurora"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    const detail = root.querySelector('[data-detail-panel]')!;
    expect(detail.textContent).toContain('Stormcaller');
    expect(detail.textContent).toContain('Sample Discharge');
    expect(detail.textContent).toContain('Unbound Spark');
    expect(detail.textContent).toContain('Mención de prueba');
    expect(detail.textContent).toContain('verifica en GrimTools antes de gastar');
  });

  it('exposes complete bilingual group and route content in the open native list', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const list = root.querySelector<HTMLDetailsElement>('details.devotion-map__list')!;

    expect(list.open).toBe(true);
    expect(list.querySelectorAll('[data-list-constellation]')).toHaveLength(2);
    expect(list.querySelectorAll('[data-step-position]')).toHaveLength(5);
    expect(list.textContent).toContain('Aether');
    expect(list.textContent).toContain('Nombre en inglés');
    expect(list.textContent).toContain('Limpiar puntos sobrantes');
    expect(list.textContent).toContain('verifica en GrimTools antes de gastar');
    expect(list.textContent).toContain('Mención de prueba');
  });

  it('marks an abbreviated unbroken name while retaining the complete textual name', async () => {
    const name = 'ConstelacionDeMuestraConUnNombreExtremadamenteLargo';
    const fixture = await render({
      constellations: [{ ...constellations[0], name_es: name }, constellations[1]],
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('svg .devotion-map__group-name')?.textContent).toContain('…');
    expect(root.querySelector('details')?.textContent).toContain(name);
  });

  it('namespaces repeated local star and threshold ids by map and constellation', async () => {
    const one = await render();
    const two = await render({ mapId: 'secondary' });
    const oneIds = [...one.nativeElement.querySelectorAll('[id]')].map((node: Element) => node.id);
    const twoIds = [...two.nativeElement.querySelectorAll('[id]')].map((node: Element) => node.id);
    expect(new Set([...oneIds, ...twoIds]).size).toBe(oneIds.length + twoIds.length);
    expect(oneIds.some((id: string) => id.includes('aurora-shared-star'))).toBe(true);
    expect(oneIds.some((id: string) => id.includes('aether-shared-star'))).toBe(true);
    expect(oneIds.some((id: string) => id.includes('aurora-threshold-ascendente'))).toBe(true);
    expect(oneIds.some((id: string) => id.includes('aether-threshold-ascendente'))).toBe(false);
    expect(twoIds.every((id: string) => id.startsWith('secondary-'))).toBe(true);
  });

  it('contains invalid local edges, duplicate group ids, and broken bindings while preserving the text list', async () => {
    const brokenGroup = {
      ...constellations[0],
      layout: { nodes: [{ id: 'lonely', x: 0, y: 0 }], edges: [{ from: 'lonely', to: 'missing' }] },
    };
    const brokenSteps = [
      { ...steps[0], bindings: [{ power_en: 'Broken', skill_node_slug: 'missing-node' }] },
    ];
    const invalidCases = [
      { constellations: [brokenGroup, constellations[1]], steps },
      { constellations: [constellations[0], constellations[0]], steps },
      { constellations, steps: brokenSteps },
    ];
    for (const values of invalidCases) {
      const fixture = await render(values);
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('No se pudo dibujar');
      expect(root.querySelector('details.devotion-map__list li')).not.toBeNull();
      expect(root.textContent).toContain('Abrir la senda');
    }
  });

  it('shows an honest empty state and keeps the native list present', async () => {
    const fixture = await render({ constellations: [], steps: [], skillNodes: [] });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No hay constelaciones');
    expect(root.querySelector<HTMLDetailsElement>('details.devotion-map__list')?.open).toBe(true);
  });

  it('keeps frozen inputs intact and renders at most 120 passive stars', async () => {
    const manyConstellation: Constellation = {
      ...constellations[1],
      slug: 'estrellas-prueba',
      name_en: 'Synthetic star field',
      layout: {
        nodes: Array.from({ length: 119 }, (_, index) => ({
          id: `star-${index}`,
          x: index % 12,
          y: Math.floor(index / 12),
        })),
        edges: [],
      },
    };
    const fixture = await render({ constellations: [manyConstellation], steps: [] });
    expect(fixture.nativeElement.querySelectorAll('[data-star-id]')).toHaveLength(119);
    expect(
      fixture.nativeElement.querySelector('svg')?.getAttribute('data-graphic-node-count'),
    ).toBe('120');
    const oversized = await render({
      constellations: [
        {
          ...manyConstellation,
          layout: {
            nodes: [...manyConstellation.layout.nodes, { id: 'star-119', x: 119, y: 9 }],
            edges: [],
          },
        },
      ],
      steps: [],
    });
    expect(oversized.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(oversized.nativeElement.querySelector('details.devotion-map__list li')).not.toBeNull();
    expect(constellations[0].layout.edges).toHaveLength(3);
    expect(Object.isFrozen(constellations)).toBe(true);
  });
});
