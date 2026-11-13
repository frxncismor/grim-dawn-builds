import { RenderMode, ServerRoute, PrerenderFallback } from '@angular/ssr';
import { inject } from '@angular/core';
import { MASTERY_CATALOG } from './core/content/masteries';
import { CONTENT_REPOSITORY } from './core/content/repository';
import { PUBLIC_SITE_LOADER } from './features/author/author.state';

/**
 * Prerender parameters come from the same repository initialized by `provideAppInitializer`.
 * The public build never receives drafts; a local `INCLUDE_DRAFTS=true` build does.
 */
export async function buildPrerenderParams(): Promise<{ slug: string }[]> {
  const repository = inject(CONTENT_REPOSITORY);
  return (await repository.listSlugs()).map((slug) => ({ slug }));
}

export const serverRoutes: ServerRoute[] = [
  {
    path: 'autores/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.None,
    async getPrerenderParams() {
      const load = inject(PUBLIC_SITE_LOADER);
      return (await load()).authors.map((author) => ({ slug: author.profile.slug }));
    },
  },
  {
    path: 'builds/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.None,
    getPrerenderParams: buildPrerenderParams,
  },
  {
    // Index of the mastery trees (T014): static path, its rows come from the catalog resolver.
    path: 'maestrias',
    renderMode: RenderMode.Prerender,
  },
  {
    // Catalog of mastery trees: one prerendered page per mastery, listed by the catalog itself.
    path: 'maestrias/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.None,
    async getPrerenderParams() {
      return (await inject(MASTERY_CATALOG).listSlugs()).map((slug) => ({ slug }));
    },
  },
  {
    // Static notice with no data dependency; prerendered as its own artifact.
    path: 'legal',
    renderMode: RenderMode.Prerender,
  },
  {
    // Angular 21 skips the catch-all in the prerender, so the same static page is
    // prerendered at `/404` and `scripts/emit-404.mts` copies it to `404.html`.
    path: '404',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
