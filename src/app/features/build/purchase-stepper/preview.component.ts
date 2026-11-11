import { Component, inject, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import {
  Meta,
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import type { PublicBuild } from '@gd/domain';
import { SkillTree } from '../../../shared/svg/skill-tree/skill-tree';
import {
  PurchaseStepper,
  type PurchaseStepperContent,
  type PurchaseStepSelection,
} from './purchase-stepper';

type Mastery = PublicBuild['masteries'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

const sampleMasteries: readonly Mastery[] = [
  {
    slug: 'maestria-alfa',
    name_es: 'Maestría Alfa',
    name_en: 'Mastery Alpha',
    role_text: 'Maestría sintética para comprobar la conexión del preview.',
  },
  {
    slug: 'maestria-beta',
    name_es: 'Maestría Beta',
    name_en: 'Mastery Beta',
    role_text: 'Segunda maestría sintética para probar referencias cruzadas.',
  },
];

const sampleNodes: readonly SkillNode[] = [
  {
    slug: 'alfa-inicio',
    mastery_slug: 'maestria-alfa',
    name_es: 'Nodo Alfa',
    name_en: 'Alpha Node',
    bar_required: 2,
    parent_slug: null,
    status: 'recomendada',
    tag: null,
    rationale: 'Consejo sintético para el preview, sin recomendación de juego.',
    max_points_hint: 10,
    points_label: null,
    layout: { x: 0, y: 0 },
  },
  {
    slug: 'alfa-avance',
    mastery_slug: 'maestria-alfa',
    name_es: 'Nodo Alfa de avance',
    name_en: 'Alpha Follow-up Node',
    bar_required: 7,
    parent_slug: 'alfa-inicio',
    status: 'meta',
    tag: null,
    rationale: 'Texto demostrativo de una habilidad posterior.',
    max_points_hint: null,
    points_label: null,
    layout: { x: 130, y: 88 },
  },
  {
    slug: 'beta-inicio',
    mastery_slug: 'maestria-beta',
    name_es: 'Nodo Beta',
    name_en: 'Beta Node',
    bar_required: 3,
    parent_slug: null,
    status: 'recomendada',
    tag: null,
    rationale: 'Otro texto sintético para revisar el segundo árbol.',
    max_points_hint: 8,
    points_label: null,
    layout: { x: 0, y: 0 },
  },
  {
    slug: 'beta-avance',
    mastery_slug: 'maestria-beta',
    name_es: 'Nodo Beta de avance',
    name_en: 'Beta Follow-up Node',
    bar_required: 9,
    parent_slug: 'beta-inicio',
    status: 'meta',
    tag: null,
    rationale: 'Texto de ejemplo para probar un highlight cruzado.',
    max_points_hint: null,
    points_label: null,
    layout: { x: 130, y: 88 },
  },
];

const sampleContent: PurchaseStepperContent = {
  slug: 'compra-de-muestra',
  game_version: 'versión sintética A',
  purchase_steps: [
    {
      position: 2,
      threshold_label: 'Primera etiqueta de muestra',
      mastery_slug: 'maestria-alfa',
      title: 'Inicio con referencias en ambas maestrías',
      body: 'Fila sintética para comprobar puntos cero, sin cifra y selección cruzada.',
      highlights: [
        { skill_node_slug: 'alfa-inicio', points: 0 },
        { skill_node_slug: 'beta-inicio', points: null },
      ],
    },
    {
      position: 5,
      threshold_label: 'Esta etiqueta se conserva como texto',
      mastery_slug: 'maestria-beta',
      title: 'Segundo paso de muestra',
      body: 'Este contenido solo existe para inspeccionar el componente.',
      highlights: [{ skill_node_slug: 'beta-avance', points: 2 }],
    },
    {
      position: 11,
      threshold_label: 'Último objetivo sintético',
      mastery_slug: null,
      title: 'Paso cruzado sin maestría asignada',
      body: 'La maestría es nula y sus tres referencias abarcan los dos árboles.',
      highlights: [
        { skill_node_slug: 'alfa-avance', points: null },
        { skill_node_slug: 'beta-inicio', points: 0 },
        { skill_node_slug: 'beta-avance', points: null },
      ],
    },
  ],
  skill_nodes: [...sampleNodes],
  masteries: [...sampleMasteries],
  notes: [
    {
      kind: 'general',
      label: 'Orden real de compra',
      headline: 'Introducción de muestra',
      detail: 'Introducción sintética que no contiene recomendaciones de juego.',
      position: 1,
    },
  ],
  sections_meta: [{ section_key: 'orden', position: 1, visible: true }],
};

@Component({
  selector: 'gd-purchase-stepper-preview',
  imports: [PurchaseStepper, SkillTree],
  template: `<main>
    <h1 i18n="@@purchaseStepperPreview.title">Progreso de una guía de muestra</h1>
    <p class="preview-notice" i18n="@@purchaseStepperPreview.notice">
      Preview aislado con contenido sintético. No representa una guía real ni una configuración del
      juego.
    </p>
    <div
      class="diagnostics"
      aria-label="Controles de prueba"
      i18n-aria-label="@@purchaseStepperPreview.diagnostics"
    >
      <button
        type="button"
        data-change-guide
        (click)="changeGuide()"
        i18n="@@purchaseStepperPreview.changeGuide"
      >
        Cambiar guía de muestra
      </button>
      <button
        type="button"
        data-change-revision
        (click)="changeRevision()"
        i18n="@@purchaseStepperPreview.changeRevision"
      >
        Cambiar revisión de muestra
      </button>
    </div>
    <gd-purchase-stepper [content]="content()" (selectionChange)="selectionChanged($event)" />
    <section class="trees" aria-labelledby="trees-heading">
      <h2 id="trees-heading" i18n="@@purchaseStepperPreview.trees">
        Árboles sintéticos de muestra
      </h2>
      <gd-skill-tree
        treeId="purchase-preview-alpha"
        [mastery]="masteries[0]"
        [nodes]="content().skill_nodes"
        [activeIds]="activeIds()"
      />
      <gd-skill-tree
        treeId="purchase-preview-beta"
        [mastery]="masteries[1]"
        [nodes]="content().skill_nodes"
        [activeIds]="activeIds()"
      />
    </section>
  </main>`,
  styles: `
    main {
      max-inline-size: var(--page-max);
      margin-inline: auto;
      padding: var(--space-4);
    }
    .preview-notice {
      max-inline-size: var(--reading-measure);
      margin-block: var(--space-4) var(--space-5);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-line);
      background: var(--color-panel);
      color: var(--color-ash);
    }
    .diagnostics {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-block: var(--space-5);
    }
    .diagnostics button {
      min-block-size: 44px;
      max-inline-size: 100%;
      white-space: normal;
      text-align: start;
    }
    .trees {
      display: grid;
      gap: var(--space-6);
      margin-block-start: var(--space-7);
    }
    @media (min-width: 48rem) {
      main {
        padding: var(--space-6);
      }
    }
  `,
})
export class PurchaseStepperPreview {
  private readonly meta = inject(Meta);
  readonly content = signal(sampleContent);
  readonly masteries = sampleMasteries;
  readonly activeIds = signal<readonly string[]>([]);

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
  }

  selectionChanged(selection: PurchaseStepSelection): void {
    this.activeIds.set(selection.activeIds);
  }

  changeGuide(): void {
    this.content.update((current) => ({ ...current, slug: 'otra-guia-sintetica' }));
  }

  changeRevision(): void {
    this.content.update((current) => ({
      ...current,
      game_version: `${current.game_version} revisada`,
    }));
  }
}

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class PurchaseStepperPreviewRoot {}

export const purchaseStepperPreviewProviders = [
  provideRouter([{ path: '', component: PurchaseStepperPreview }]),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
