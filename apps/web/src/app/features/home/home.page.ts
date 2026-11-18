import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
  TransferState,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService, siteLocale } from '../../core/seo/seo.service';
import { CATALOG_STATE } from '../../core/content/catalog.resolver';
import { BuildCard } from '../../shared/ui/build-card/build-card';
import { buildCardData } from '../../shared/ui/build-card/build-card.labels';
import { formatLongDateUtc } from '../../shared/date/long-date';
import { homeBuilds } from './home-builds';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BuildCard],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage {
  private readonly catalog = inject(TransferState).get(CATALOG_STATE, null);
  private readonly builds = this.catalog
    ? homeBuilds(this.catalog, inject(LOCALE_ID).startsWith('es') ? 'es' : 'en')
    : null;
  readonly featuredCard = this.builds?.featured ? buildCardData(this.builds.featured) : null;
  /** Date of the very guide the featured card shows, never of another selection. */
  readonly featuredDate = this.builds?.featuredDate ?? null;
  /** The same date as the guide summary shows it: long form in the UI language, in UTC (FR-042). */
  readonly featuredDateLabel = formatLongDateUtc(inject(LOCALE_ID), this.featuredDate);
  readonly otherCards = (this.builds?.others ?? []).map(buildCardData);
  /** Game art on a card: Crate is credited and non-affiliation stated (§VII). */
  readonly showsGameArt = [this.featuredCard, ...this.otherCards].some((card) =>
    card?.masteries.some((m) => m.portrait.source === 'game'),
  );
  readonly masteries = this.builds?.masteries ?? [];
  readonly withoutGuide = this.builds?.withoutGuide ?? 0;
  readonly total = this.builds?.total ?? 0;
  constructor() {
    if (!this.catalog) throw new Error('Falta el catálogo prerenderizado.');
    const seo = inject(SeoService);
    seo.setPage({
      title: 'Grim Builds',
      description: $localize`:@@home.description:Browse Grim Dawn mastery combinations, with visible provenance and review statuses.`,
      path: '/',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Grim Builds',
          url: seo.canonical('/'),
          inLanguage: siteLocale(inject(LOCALE_ID)) === 'es' ? 'es-419' : 'en',
        },
      ],
    });
  }
}
