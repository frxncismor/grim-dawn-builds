import { Component, inject, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import {
  Meta,
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import type { PublicBuild } from '@gd/domain';
import { DevotionSection, type DevotionSectionContent } from './devotion-section';

type Constellation = PublicBuild['constellations'][number];
type DevotionStep = PublicBuild['devotion_steps'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

const sampleConstellations: readonly Constellation[] = [
  {
    slug: 'brillo-de-muestra',
    name_es: 'Brillo de muestra',
    name_en: 'Sample Gleam',
    tier_level: 2,
    affinity_required: { sintética: 2 },
    affinity_granted: { muestra: 1 },
    layout: {
      nodes: [
        { id: 'estrella-central', x: 0, y: 0 },
        { id: 'estrella-lateral', x: 96, y: 40 },
      ],
      edges: [{ from: 'estrella-central', to: 'estrella-lateral' }],
    },
  },
  {
    slug: 'niebla-de-muestra',
    name_es: null,
    name_en: 'Sample Mist',
    tier_level: null,
    affinity_required: null,
    affinity_granted: {},
    layout: {
      nodes: [{ id: 'estrella-aislada', x: 0, y: 0 }],
      edges: [],
    },
  },
];

const sampleSteps: readonly DevotionStep[] = [
  {
    position: 2,
    label: 'Ruta de muestra',
    constellation_slug: 'brillo-de-muestra',
    title_override: 'Destino de muestra',
    body: 'Texto sintético para comprobar una ruta asociada.',
    bindings: [
      { power_en: 'Sample Power', skill_node_slug: 'habilidad-de-muestra' },
      {
        power_en: 'External Sample Power',
        skill_node_slug: null,
        skill_name_es: 'Mención de muestra',
      },
    ],
    accent: 'storm',
    verification: 'sin_verificar',
    kind: 'ruta',
  },
  {
    position: 5,
    label: 'Verificación de muestra',
    constellation_slug: null,
    title_override: null,
    body: 'Texto sintético de verificación sin destino asociado.',
    bindings: [],
    accent: 'storm',
    verification: 'verificado',
    kind: 'verificacion',
  },
  {
    position: 9,
    label: 'Limpieza de muestra',
    constellation_slug: null,
    title_override: 'Cierre de muestra',
    body: 'Texto sintético de limpieza sin constelación.',
    bindings: [],
    accent: 'ember',
    verification: 'verificado',
    kind: 'limpieza',
  },
];

const sampleSkillNodes: readonly SkillNode[] = [
  {
    slug: 'habilidad-de-muestra',
    mastery_slug: 'maestria-de-muestra',
    name_es: 'Habilidad de muestra',
    name_en: 'Sample Skill',
    bar_required: 1,
    parent_slug: null,
    status: 'recomendada',
    tag: null,
    rationale: 'Nodo sintético para probar una referencia local.',
    max_points_hint: 1,
    points_label: null,
    layout: { x: 0, y: 0 },
  },
];

const sampleContent: DevotionSectionContent = {
  slug: 'devociones-de-muestra',
  constellations: [...sampleConstellations],
  devotion_steps: [...sampleSteps],
  skill_nodes: [...sampleSkillNodes],
  notes: [
    {
      kind: 'general',
      label: 'Ruta de devoción',
      headline: 'Introducción sintética',
      detail: 'Introducción de muestra, sin recomendaciones de juego.',
      position: 1,
    },
    {
      kind: 'general',
      label: 'Esquemas de habilidades y devociones',
      headline: 'Nota de esquema sintética',
      detail: 'Contenido inventado únicamente para revisar el diseño del componente.',
      position: 2,
    },
    {
      kind: 'general',
      label: 'Referencias de devoción',
      headline: 'Nota de referencia sintética',
      detail: 'Esta nota no contiene referencias ni consejos reales.',
      position: 3,
    },
  ],
  sections_meta: [{ section_key: 'devociones', position: 1, visible: true }],
};

@Component({
  selector: 'gd-devotion-section-preview',
  imports: [DevotionSection],
  template: `
    <main>
      <h1 i18n="@@devotionSectionPreview.title">Ruta de muestra</h1>
      <p class="preview-notice" i18n="@@devotionSectionPreview.notice">
        Vista aislada con datos sintéticos. No representa una guía ni contenido del juego.
      </p>
      <gd-devotion-section
        sectionId="devociones-preview"
        mapId="devociones-preview-mapa"
        [content]="content()"
        [activeStepPosition]="activeStepPosition()"
        (activeStepPositionChange)="selectPosition($event)"
      />
    </main>
  `,
  styles: `
    main {
      max-inline-size: var(--page-max);
      min-inline-size: 0;
      margin-inline: auto;
      padding: var(--space-4);
    }
    h1 {
      margin-block: var(--space-4);
      color: var(--color-bone);
      font-family: var(--font-display);
      font-size: var(--text-heading);
      font-weight: var(--weight-display);
    }
    .preview-notice {
      max-inline-size: var(--reading-measure);
      margin-block: var(--space-4) var(--space-6);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-line);
      background: var(--color-panel);
      color: var(--color-ash);
    }
    @media (min-width: 48rem) {
      main {
        padding: var(--space-6);
      }
    }
  `,
})
export class DevotionSectionPreview {
  private readonly meta = inject(Meta);
  readonly content = signal(sampleContent);
  readonly activeStepPosition = signal<number | undefined>(undefined);

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
  }

  selectPosition(position: number): void {
    this.activeStepPosition.set(position);
  }
}

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class DevotionSectionPreviewRoot {}

export const devotionSectionPreviewProviders = [
  provideRouter([{ path: '', component: DevotionSectionPreview }]),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
