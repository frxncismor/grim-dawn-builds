import { Component, computed, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import type { TierEntry } from '@gd/domain';
import { EMPTY_FILTER } from './filter';
import {
  EmptyState,
  FilterBar,
  FilterChip,
  TierCard,
  TierRow,
  type FilterGroup,
} from './tier-components';

const placeholder: TierEntry = {
  entry_kind: 'placeholder',
  combination_slug: 'chaman-demoledor',
  display_name: 'Chamán + Demoledor',
  build_slug: null,
  tier: 'sin_clasificar',
  content_status: 'placeholder',
  rights_status: 'own_original',
  review_state: 'publicado',
  external_url: null,
  external_author: null,
  source_slug: null,
  evaluated_on: null,
};
@Component({
  selector: 'gd-tier-preview',
  imports: [FilterBar, FilterChip, TierRow, TierCard, EmptyState],
  template: `<main>
    <h1 i18n="@@tierPreview.title">Catálogo de builds</h1>
    <p i18n="@@tierPreview.notice">
      Prueba visual aislada: todos los datos de esta página son sintéticos, escritos para verificar
      componentes.
    </p>
    <gd-filter-bar [value]="filter()" [groups]="groups" (valueChange)="filter.set($event)" />
    <p role="status" aria-live="polite">{{ selectionSummary() }}</p>
    <gd-tier-row label="Sin clasificar" i18n-label="@@tierPreview.unranked">
      <gd-tier-card [entry]="placeholder" combinationName="Chamán + Demoledor" />
      <gd-tier-card [entry]="own" [guide]="guide" combinationName="Chamán + Soldado" />
      <gd-tier-card [entry]="external" [source]="source" combinationName="Inquisidor + Demoledor" />
    </gd-tier-row>
    <gd-tier-row label="Nombres extensos" i18n-label="@@tierPreview.longNames">
      <gd-tier-card [entry]="long" combinationName="Guardián del Juramento + Nigromante" />
    </gd-tier-row>
    <gd-empty-state (filtersReset)="filter.set(empty)" />
    <section aria-labelledby="disabled-heading">
      <h2 id="disabled-heading" i18n="@@tierPreview.disabled">Filtros deshabilitados</h2>
      <gd-filter-chip
        label="Rayo"
        i18n-label="@@tierPreview.lightning"
        [selected]="true"
        [disabled]="true"
      />
      <gd-filter-bar [disabled]="true" [groups]="disabledGroups" />
    </section>
  </main>`,
  styles: `
    main {
      max-inline-size: var(--page-max);
      margin-inline: auto;
      padding: var(--space-5);
    }
    @media (min-width: 48rem) {
      main {
        padding: var(--space-6);
      }
    }
  `,
})
export class TierPreview {
  readonly empty = EMPTY_FILTER;
  readonly filter = signal(EMPTY_FILTER);
  readonly selectionSummary = computed(
    () =>
      $localize`:@@tierPreview.selection:Selección actual: ${this.filter().damageTypes.join(', ') || 'ningún daño'}; ${this.filter().text || 'sin búsqueda'}.`,
  );
  readonly groups: readonly FilterGroup[] = [
    {
      key: 'masteries',
      label: $localize`:@@tierPreview.masteries:Maestrías`,
      options: [
        { value: 'chaman', label: 'Chamán' },
        { value: 'demoledor', label: 'Demoledor' },
        { value: 'guardian-del-juramento', label: 'Guardián del Juramento' },
      ],
    },
    {
      key: 'damageTypes',
      label: $localize`:@@tierPreview.damage:Tipo de daño`,
      options: [
        { value: 'rayo', label: 'Rayo' },
        { value: 'fuego', label: 'Fuego' },
      ],
    },
    {
      key: 'contentTags',
      label: $localize`:@@tierPreview.content:Contenido`,
      options: [
        { value: 'campana', label: 'Campaña' },
        { value: 'crucible', label: 'Crucible' },
      ],
    },
    {
      key: 'playstyles',
      label: $localize`:@@tierPreview.playstyle:Estilo`,
      options: [
        { value: 'melee', label: 'Cuerpo a cuerpo' },
        { value: 'pets', label: 'Mascotas', disabled: true },
      ],
    },
    {
      key: 'contentStatuses',
      label: $localize`:@@tierPreview.status:Estado del contenido`,
      options: [
        { value: 'verificado', label: 'Verificado' },
        { value: 'sin_verificar', label: 'Sin verificar' },
        { value: 'placeholder', label: 'Placeholder' },
      ],
    },
  ];
  readonly disabledGroups = [this.groups[1]];
  readonly placeholder = placeholder;
  readonly own: TierEntry = {
    ...placeholder,
    entry_kind: 'build_propia',
    display_name: 'Guía propia de prueba',
    build_slug: 'guia-propia-de-prueba',
    content_status: 'verificado',
  };
  readonly guide = {
    slug: 'guia-propia-de-prueba',
    title: 'Guía propia de prueba',
    review_state: 'publicado',
    rights_status: 'own_original',
  } as const;
  readonly external: TierEntry = {
    ...placeholder,
    entry_kind: 'enlace_externo',
    display_name: 'Referencia externa de prueba',
    content_status: 'sin_verificar',
    rights_status: 'link_only',
    external_url: 'https://example.org/',
    external_author: 'Autora sintética',
    source_slug: 'prueba',
  };
  readonly source = {
    title: 'Fuente sintética de prueba',
    license_note: 'Solo enlace; ningún cuerpo de guía republicado.',
  };
  readonly long: TierEntry = {
    ...placeholder,
    display_name:
      'Guardián del Juramento + Nigromante · combinación de nombre extenso para comprobar el ajuste de texto',
  };
}
@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class TierPreviewRoot {}
export const tierPreviewProviders = [
  provideRouter([{ path: '', component: TierPreview }]),
  provideClientHydration(withEventReplay()),
];
