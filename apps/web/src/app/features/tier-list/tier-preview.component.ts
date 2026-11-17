import { Component, computed, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { EMPTY_FILTER } from './filter';
import { EmptyState, FilterBar, FilterChip, TierRow, type FilterGroup } from './tier-components';
import { BuildCard } from '../../shared/ui/build-card/build-card';
import { buildCardData } from '../../shared/ui/build-card/build-card.labels';

@Component({
  selector: 'gd-tier-preview',
  imports: [FilterBar, FilterChip, TierRow, BuildCard, EmptyState],
  template: `<main>
    <h1 i18n="@@tierPreview.title">Catálogo de builds</h1>
    <p i18n="@@tierPreview.notice">
      Prueba visual aislada: todos los datos de esta página son sintéticos, escritos para verificar
      componentes.
    </p>
    <gd-filter-bar [value]="filter()" [groups]="groups" (valueChange)="filter.set($event)" />
    <p role="status" aria-live="polite">{{ selectionSummary() }}</p>
    <gd-tier-row label="Sin clasificar" i18n-label="@@tierPreview.unranked">
      <gd-build-card [data]="cards.placeholder" />
      <gd-build-card [data]="cards.own" />
      <gd-build-card [data]="cards.external" />
    </gd-tier-row>
    <gd-tier-row label="Nombres extensos" i18n-label="@@tierPreview.longNames">
      <gd-build-card [data]="cards.long" />
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
  readonly cards = {
    placeholder: buildCardData({
      key: 'preview-placeholder',
      variant: 'compact',
      title: 'Chamán + Demoledor',
      masteries: [],
      status: 'placeholder',
      reviewState: null,
      damage: [],
      author: null,
      gameVersion: '1.3.x',
      href: null,
      tierLabel: null,
    }),
    own: buildCardData({
      key: 'preview-own',
      variant: 'standard',
      title: 'Guía propia de prueba',
      masteries: [{ portrait: null }, { portrait: null }],
      status: 'verificado',
      reviewState: 'publicado',
      damage: ['Rayo'],
      author: 'Autora sintética',
      gameVersion: '1.3.x',
      href: ['/builds', 'guia-propia-de-prueba'],
      tierLabel: null,
    }),
    external: buildCardData({
      key: 'preview-external',
      variant: 'standard',
      title: 'Referencia externa de prueba',
      masteries: [],
      status: 'sin_verificar',
      reviewState: null,
      damage: [],
      author: null,
      gameVersion: '1.3.x',
      href: null,
      tierLabel: null,
      external: {
        url: 'https://example.org/',
        author: 'Autora sintética',
        note: 'Fuente sintética de prueba · Solo enlace; ningún cuerpo de guía republicado.',
      },
    }),
    long: buildCardData({
      key: 'preview-long',
      variant: 'compact',
      title:
        'Guardián del Juramento + Nigromante · combinación de nombre extenso para comprobar el ajuste de texto',
      masteries: [],
      status: 'placeholder',
      reviewState: null,
      damage: [],
      author: null,
      gameVersion: '1.3.x',
      href: null,
      tierLabel: null,
    }),
  };
}
@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class TierPreviewRoot {}
export const tierPreviewProviders = [
  provideRouter([{ path: '', component: TierPreview }]),
  provideClientHydration(withEventReplay()),
];
