import { ChangeDetectionStrategy, Component, inject, TransferState } from '@angular/core';
import { AUTHORS_STATE } from '../author/author.state';
import { SeoService } from '../../core/seo/seo.service';
@Component({
  selector: 'gd-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.page.html',
  styleUrl: './editorial.css',
})
export class AboutPage {
  private readonly authors = inject(TransferState).get(AUTHORS_STATE, null);
  readonly owners = this.authors?.filter((author) => author.ownsCatalog) ?? [];
  constructor() {
    if (!this.authors) throw new Error('Faltan los autores prerenderizados.');
    const seo = inject(SeoService);
    seo.setPage({
      title: $localize`:@@about.title:Acerca del proyecto`,
      description: $localize`:@@about.description:Criterios editoriales, atribución y estados del contenido de Grim Dawn Builds.`,
      path: '/acerca',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: $localize`:@@about.title:Acerca del proyecto`,
          url: seo.canonical('/acerca'),
        },
      ],
    });
  }
}
