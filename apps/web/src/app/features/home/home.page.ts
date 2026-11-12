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
import { selectFeaturedGuide } from './featured-guide';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage {
  private readonly catalog = inject(TransferState).get(CATALOG_STATE, null);
  readonly featured = this.catalog ? selectFeaturedGuide(this.catalog.guides) : null;
  constructor() {
    if (!this.catalog) throw new Error('Falta el catálogo prerenderizado.');
    const seo = inject(SeoService);
    seo.setPage({
      title: 'Grim Dawn Builds',
      description: $localize`:@@home.description:Browse Grim Dawn mastery combinations, with visible provenance and review statuses.`,
      path: '/',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Grim Dawn Builds',
          url: seo.canonical('/'),
          inLanguage: siteLocale(inject(LOCALE_ID)) === 'es' ? 'es-419' : 'en',
        },
      ],
    });
  }
}
