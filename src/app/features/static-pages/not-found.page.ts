import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';

const TITLE = $localize`:@@notFound.seoTitle:Page not found`;
const DESCRIPTION = $localize`:@@notFound.seoDescription:The requested address does not exist or is no longer available. Go back to the home page or check the tier list.`;

/**
 * Static 404 page: no repository, content or API dependency. Its markup is prerendered for
 * the wildcard route and the host decides the real HTTP status (deferred configuration).
 */
@Component({
  selector: 'gd-not-found-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found" data-not-found aria-labelledby="not-found-title">
      <p class="not-found-eyebrow" i18n="@@notFound.eyebrow">Error 404</p>
      <h1 id="not-found-title" i18n="@@notFound.title">Page not found</h1>
      <p i18n="@@notFound.body">
        The address you are looking for does not exist or is no longer available.
      </p>
      <nav class="not-found-links" aria-label="Recovery links" i18n-aria-label="@@notFound.nav">
        <a routerLink="/" i18n="@@notFound.home">Back to the home page</a>
        <a routerLink="/tier-list" i18n="@@notFound.catalog">View the tier list</a>
      </nav>
    </section>
  `,
  styles: `
    .not-found {
      display: grid;
      gap: var(--space-4, 1rem);
      max-width: 48rem;
      padding: var(--space-10, 4rem) 0;
    }
    .not-found-eyebrow {
      margin: 0;
      color: var(--color-ember, #e07845);
      font-size: 0.875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .not-found h1 {
      margin: 0;
      color: var(--color-bone, #eadfca);
      font-size: clamp(2rem, 5vw, 3rem);
      line-height: 1.1;
    }
    .not-found p {
      margin: 0;
      color: var(--color-ash, #a3947a);
    }
    .not-found-links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4, 1rem);
    }
    .not-found-links a {
      color: var(--color-storm, #d8b15a);
      font-weight: 700;
    }
    .not-found-links a:focus-visible {
      outline: 2px solid var(--color-storm, #d8b15a);
      outline-offset: 3px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  constructor() {
    inject(SeoService).setPage({
      title: TITLE,
      description: DESCRIPTION,
      path: '/404',
      robots: 'noindex,follow',
    });
  }
}
