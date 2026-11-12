import { Component, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import type { PublicBuild } from '@gd/domain';
import { DevotionMap } from './devotion-map';

type Constellation = PublicBuild['constellations'][number];
type DevotionStep = PublicBuild['devotion_steps'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

const previewConstellations: readonly Constellation[] = [
  {
    slug: 'aurora-sintetica',
    name_es: 'Aurora de muestra',
    name_en: 'Sample Aurora',
    tier_level: 2,
    affinity_required: { ascendente: 5, primigenia: 2 },
    affinity_granted: { primordial: 3 },
    layout: {
      nodes: [
        { id: 'estrella-central', x: 0, y: 0 },
        { id: 'estrella-oriente', x: 120, y: 0 },
        { id: 'estrella-sur', x: 60, y: 80 },
      ],
      edges: [
        { from: 'estrella-central', to: 'estrella-oriente' },
        { from: 'estrella-oriente', to: 'estrella-sur' },
        { from: 'estrella-sur', to: 'estrella-central' },
      ],
    },
  },
  {
    slug: 'bruma-sintetica',
    name_es: null,
    name_en: 'SampleMistConstellationWithAnIntentionallyUnbrokenLongName',
    tier_level: null,
    affinity_required: null,
    affinity_granted: {},
    layout: {
      nodes: [{ id: 'estrella-solitaria', x: 0, y: 0 }],
      edges: [],
    },
  },
];

const previewSteps: readonly DevotionStep[] = [
  {
    position: 1,
    label: 'Abrir constelación sintética',
    constellation_slug: 'aurora-sintetica',
    title_override: null,
    body: 'Paso de demostración asociado a una constelación sintética.',
    bindings: [
      { power_en: 'Sample Spark', skill_node_slug: 'golpe-sintetico' },
      {
        power_en: 'External Example',
        skill_node_slug: null,
        skill_name_es: 'Mención sintética',
      },
    ],
    accent: 'storm',
    verification: 'sin_verificar',
    kind: 'ruta',
  },
  {
    position: 2,
    label: 'Verificación sin constelación',
    constellation_slug: null,
    title_override: null,
    body: 'Ejemplo textual de verificación sin destino de constelación.',
    bindings: [],
    accent: 'storm',
    verification: 'verificado',
    kind: 'verificacion',
  },
  {
    position: 3,
    label: 'Limpieza sintética',
    constellation_slug: null,
    title_override: null,
    body: 'Ejemplo textual de limpieza que permanece en la ruta.',
    bindings: [],
    accent: 'ember',
    verification: 'verificado',
    kind: 'limpieza',
  },
];

const previewSkills: readonly SkillNode[] = [
  {
    slug: 'golpe-sintetico',
    mastery_slug: 'maestria-sintetica',
    name_es: 'Impacto de muestra',
    name_en: 'Sample Impact',
    bar_required: 1,
    parent_slug: null,
    status: 'recomendada',
    tag: null,
    rationale: 'Destino sintético para mostrar un binding válido.',
    max_points_hint: 1,
    points_label: '1 punto de prueba',
    layout: { x: 0, y: 0 },
  },
];

const stressConstellations: readonly Constellation[] = [
  {
    slug: 'campo-sintetico',
    name_es: 'Campo sintético de prueba',
    name_en: 'Synthetic sample field',
    tier_level: 1,
    affinity_required: { primigenia: 1 },
    affinity_granted: {},
    layout: {
      nodes: Array.from({ length: 118 }, (_, index) => ({
        id: `estrella-${index + 1}`,
        x: (index % 12) * 24,
        y: Math.floor(index / 12) * 24,
      })),
      edges: [],
    },
  },
];

@Component({
  selector: 'gd-devotion-map-preview',
  imports: [DevotionMap],
  template: `
    <main>
      <h1 i18n="@@devotionMapPreview.title">Mapa de devociones</h1>
      <p class="preview__notice" i18n="@@devotionMapPreview.notice">
        Vista aislada con datos sintéticos; los nombres, afinidades y pasos no son una guía del
        juego.
      </p>
      <section aria-labelledby="preview-controls-title">
        <h2 id="preview-controls-title" i18n="@@devotionMapPreview.controls">
          Controles de muestra
        </h2>
        <div class="preview__controls">
          <button
            type="button"
            data-preview-step="route"
            [attr.aria-pressed]="activeStepPosition() === 1"
            (click)="activeStepPosition.set(1)"
            i18n="@@devotionMapPreview.activeRoute"
          >
            Resaltar paso asociado
          </button>
          <button
            type="button"
            data-preview-step="unbound"
            [attr.aria-pressed]="activeStepPosition() === 2"
            (click)="activeStepPosition.set(2)"
            i18n="@@devotionMapPreview.unboundRoute"
          >
            Resaltar paso sin constelación
          </button>
        </div>
      </section>
      <gd-devotion-map
        mapId="preview-primary"
        [constellations]="constellations"
        [steps]="steps"
        [skillNodes]="skillNodes"
        [activeStepPosition]="activeStepPosition()"
      />
      <details class="preview__stress" data-preview-stress>
        <summary i18n="@@devotionMapPreview.stressSummary">
          Abrir muestra de estrés de 120 objetos gráficos
        </summary>
        <button
          type="button"
          data-preview-stress-step
          [attr.aria-pressed]="stressActive()"
          (click)="stressActive.update((active) => !active)"
          i18n="@@devotionMapPreview.stressToggle"
        >
          Alternar paso activo en la muestra de estrés
        </button>
        <gd-devotion-map
          mapId="preview-stress"
          [constellations]="stressConstellations"
          [steps]="stressSteps"
          [skillNodes]="skillNodes"
          [activeStepPosition]="stressActive() ? 1 : undefined"
        />
      </details>
    </main>
  `,
  styles: `
    main {
      max-inline-size: var(--page-max);
      margin-inline: auto;
      padding: var(--space-5);
    }
    h1,
    h2 {
      color: var(--color-bone);
      font-family: var(--font-display);
      font-weight: var(--weight-display);
    }
    h1 {
      font-size: var(--text-heading);
    }
    h2 {
      font-size: var(--text-large);
    }
    p {
      max-inline-size: var(--reading-measure);
    }
    .preview__notice {
      color: var(--color-ash);
    }
    .preview__controls {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    button {
      min-block-size: 44px;
      padding-inline: var(--space-4);
      border: 1px solid var(--color-ash);
      background: var(--color-panel);
      color: var(--color-bone);
      font: inherit;
      cursor: pointer;
    }
    button:hover,
    button[aria-pressed='true'] {
      border-color: var(--color-storm);
    }
    button:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
    .preview__stress {
      margin-block: var(--space-6);
    }
    .preview__stress summary {
      min-block-size: 44px;
      cursor: pointer;
    }
    @media (min-width: 48rem) {
      main {
        padding: var(--space-6);
      }
    }
  `,
})
export class DevotionMapPreview {
  readonly constellations = previewConstellations;
  readonly steps = previewSteps;
  readonly skillNodes = previewSkills;
  readonly stressConstellations = stressConstellations;
  readonly stressSteps: readonly DevotionStep[] = [
    {
      position: 1,
      label: 'Paso sintético de estrés',
      constellation_slug: 'campo-sintetico',
      title_override: null,
      body: 'Paso sintético para medir actualización con 120 objetos gráficos.',
      bindings: [],
      accent: 'storm',
      verification: 'verificado',
      kind: 'ruta',
    },
  ];
  readonly activeStepPosition = signal<number | undefined>(1);
  readonly stressActive = signal(false);
}

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class DevotionMapPreviewRoot {}

export const devotionMapPreviewProviders = [
  provideRouter([{ path: '', component: DevotionMapPreview }]),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
