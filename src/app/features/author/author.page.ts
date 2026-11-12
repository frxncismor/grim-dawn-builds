import { ChangeDetectionStrategy, Component, inject, RESPONSE_INIT } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { safeAuthorUrl, type AuthorPageData } from './author.state';

@Component({
  selector: 'gd-author-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './author.page.html',
  styleUrl: '../static-pages/editorial.css',
})
export class AuthorPage {
  private readonly route = inject(ActivatedRoute);
  readonly author = this.route.snapshot.data['author'] as AuthorPageData | null;
  readonly externalUrl = this.author ? safeAuthorUrl(this.author.profile.url) : null;
  constructor() {
    const seo = inject(SeoService),
      response = inject(RESPONSE_INIT, { optional: true });
    if (!this.author) {
      if (response) response.status = 404;
      seo.setPage({
        title: $localize`:@@author.notFound:Author not found`,
        description: $localize`:@@author.notFoundDescription:This profile is not publicly available.`,
        path: '/404',
        robots: 'noindex,nofollow',
      });
      return;
    }
    const profile = this.author.profile;
    seo.setPage({
      title: $localize`:@@author.pageTitle:Profile of ${profile.display_name}`,
      description:
        profile.bio ??
        $localize`:@@author.description:Profile and published guides of ${profile.display_name}.`,
      path: `/autores/${profile.slug}`,
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          name: profile.display_name,
          url: seo.canonical(`/autores/${profile.slug}`),
          mainEntity: {
            '@type': 'Thing',
            name: profile.display_name,
            ...(profile.bio ? { description: profile.bio } : {}),
            ...(this.externalUrl ? { sameAs: this.externalUrl } : {}),
          },
        },
      ],
    });
  }
}
