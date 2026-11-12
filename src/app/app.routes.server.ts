import { RenderMode, ServerRoute, PrerenderFallback } from '@angular/ssr';
import { inject } from '@angular/core';
import { PUBLIC_SITE_LOADER } from './features/author/author.state';

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
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
