import { Component, inject } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import {
  Meta,
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import type { PublicBuild } from '@gd/domain';
import { LootFilter, type LootFilterContent } from './loot-filter';

type LootColumn = PublicBuild['loot_filter_columns'][number];

const sampleColumns: readonly LootColumn[] = [
  {
    position: 1,
    name: 'Calidad de muestra',
    subtitle: 'Rareza ilustrativa',
    rules: [
      {
        position: 1,
        action: 'marcar',
        label: 'Conservar el ejemplo A',
        detail: 'Regla sintética para revisar la etiqueta Marcar.',
      },
      {
        position: 2,
        action: 'desmarcar',
        label: 'Ocultar el ejemplo B',
        detail: 'Regla sintética para revisar la etiqueta Desmarcar.',
      },
    ],
  },
  {
    position: 2,
    name: 'Tipo de muestra',
    subtitle: 'Categoría ilustrativa',
    rules: [
      {
        position: 1,
        action: 'marcar',
        label: 'Categoría A',
        detail: 'Descripción inventada solo para este preview.',
      },
      {
        position: 2,
        action: 'desmarcar',
        label: 'Categoría B',
        detail: 'Descripción inventada solo para este preview.',
      },
    ],
  },
  {
    position: 3,
    name: 'Daño de muestra',
    subtitle: 'Grupo ilustrativo',
    rules: [
      {
        position: 1,
        action: 'marcar',
        label: 'Grupo alfa',
        detail: 'Un criterio sintético de ejemplo.',
      },
      {
        position: 2,
        action: 'desmarcar',
        label: 'Grupo beta',
        detail: 'Otro criterio sintético de ejemplo.',
      },
      {
        position: 3,
        action: 'aviso',
        label: 'Regla OR de muestra',
        detail: 'Este aviso no contiene una recomendación real del juego.',
      },
    ],
  },
  {
    position: 4,
    name: 'Personaje de muestra',
    subtitle: 'Preferencia ilustrativa',
    rules: [
      {
        position: 1,
        action: 'marcar',
        label: 'Preferencia alfa',
        detail: 'Dato inventado para demostrar una regla de personaje.',
      },
    ],
  },
];

const sampleContent: LootFilterContent = {
  slug: 'filtro-de-muestra',
  title: 'Filtro de botín de muestra',
  loot_filter_columns: [...sampleColumns],
  notes: [
    {
      kind: 'general',
      label: 'Filtro de botín',
      headline: 'Introducción 1',
      detail: 'Contenido sintético. No es una guía ni recomienda ajustes del juego.',
      position: 1,
    },
    {
      kind: 'general',
      label: 'Filtro de botín',
      headline: 'Nota final de muestra',
      detail: 'Texto inventado para revisar el pie de la sección.',
      position: 2,
    },
  ],
  sections_meta: [{ section_key: 'filtro-de-botin', position: 1, visible: true }],
};

@Component({
  selector: 'gd-loot-filter-preview',
  imports: [LootFilter],
  template: `
    <main>
      <h1 i18n="@@lootFilterPreview.title">Filtro de botín de muestra</h1>
      <p class="preview-notice" i18n="@@lootFilterPreview.notice">
        Vista aislada con datos sintéticos. No representa una guía ni contenido del juego.
      </p>
      <gd-loot-filter sectionId="filtro-preview" [content]="content" />
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
      border: var(--frame-border);
      background: var(--surface-sheen), var(--color-panel);
      color: var(--color-ash);
      line-height: var(--line-body);
    }
    @media (min-width: 48rem) {
      main {
        padding: var(--space-6);
      }
    }
  `,
})
export class LootFilterPreview {
  private readonly meta = inject(Meta);
  readonly content = sampleContent;

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
  }
}

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class LootFilterPreviewRoot {}

export const lootFilterPreviewProviders = [
  provideRouter([{ path: '', component: LootFilterPreview }]),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
