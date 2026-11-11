import { ChangeDetectionStrategy, Component, inject, TransferState } from '@angular/core';
import { SeoService } from '../../core/seo/seo.service';
import { CATALOG_STATE } from '../../core/content/catalog.resolver';
import { selectFeaturedGuide } from './featured-guide';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      description: $localize`:@@home.description:Explora las combinaciones de maestrías de Grim Dawn, con procedencia y estados de revisión visibles.`,
      path: '/',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Grim Dawn Builds',
          url: seo.canonical('/'),
          inLanguage: 'es-419',
        },
      ],
    });
  }
}
