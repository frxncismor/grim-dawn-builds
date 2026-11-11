import { ChangeDetectionStrategy, Component, inject, TransferState } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTHORS_STATE } from '../author/author.state';
import { SeoService } from '../../core/seo/seo.service';
@Component({
  selector: 'gd-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './about.page.html',
  styleUrl: './editorial.css',
})
export class AboutPage {
  private readonly authors = inject(TransferState).get(AUTHORS_STATE, null);
  readonly owners = this.authors?.filter((author) => author.ownsCatalog) ?? [];
  constructor() {
    if (!this.authors) throw new Error('Missing prerendered authors.');
    const seo = inject(SeoService);
    seo.setPage({
      title: $localize`:@@about.title:About the project`,
      description: $localize`:@@about.description:Editorial criteria, attribution and content statuses for Grim Dawn Builds.`,
      path: '/acerca',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: $localize`:@@about.title:About the project`,
          url: seo.canonical('/acerca'),
        },
      ],
    });
  }
}
