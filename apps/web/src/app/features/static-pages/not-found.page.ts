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
      <h1 id="not-found-title" i18n="@@notFound.title">Page not found</h1>
      <p class="not-found-code" i18n="@@notFound.eyebrow">Error 404</p>
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
    /* spec004 T030: own frame and tokens only; the 404 code sits under the title, not above it. */
    .not-found {
      display: grid;
      gap: var(--space-4);
      max-inline-size: 48rem;
      margin-block: var(--space-6) var(--space-8);
      padding: var(--space-5) var(--space-6);
      border-style: solid;
      border-width: var(--frame-width);
      border-image-source: var(--frame-image-panel);
      border-image-slice: 16;
      border-image-repeat: stretch;
      background-color: var(--color-panel);
      background-image: var(--texture-surface);
    }
    .not-found h1 {
      margin: 0;
      color: var(--color-bone);
      font-size: var(--text-hero);
      line-height: var(--line-heading);
    }
    .not-found p {
      margin: 0;
      color: var(--color-ash);
    }
    .not-found .not-found-code {
      font-family: var(--font-mono);
      font-size: var(--text-small);
      font-weight: var(--weight-emphasis);
    }
    .not-found-links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }
    .not-found-links a {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      color: var(--color-storm);
      font-weight: var(--weight-emphasis);
    }
    .not-found-links a:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-offset);
    }
    @media (prefers-contrast: more) {
      .not-found {
        border-image: none;
        border-width: 2px;
        border-color: var(--color-ash);
        background-image: none;
      }
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
