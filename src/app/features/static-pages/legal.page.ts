import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../core/seo/seo.service';

const TITLE = $localize`:@@legal.title:Legal notice`;
const DESCRIPTION = $localize`:@@legal.description:Ownership, attribution, assets, content takedown and privacy for the Grim Dawn Builds project.`;

/**
 * Static legal notice. Every statement is traceable to README.md, CONTRIBUTING.md,
 * the constitution or the asset manifest; the only contact channel is the public
 * issue tracker. No e-mail, owner, SLA or hosting detail is invented here.
 */
@Component({
  selector: 'gd-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal.page.html',
  styleUrl: './editorial.css',
})
export class LegalPage {
  readonly issuesUrl = 'https://github.com/frxncismor/grim-dawn-builds/issues';

  constructor() {
    const seo = inject(SeoService);
    seo.setPage({
      title: TITLE,
      description: DESCRIPTION,
      path: '/legal',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: TITLE,
          url: seo.canonical('/legal'),
        },
      ],
    });
  }
}
