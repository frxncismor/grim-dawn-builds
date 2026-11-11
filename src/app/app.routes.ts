import { inject, Injector, runInInjectionContext } from '@angular/core';
import { Routes, type ActivatedRouteSnapshot } from '@angular/router';
import { resolveCatalog } from './core/content/catalog.resolver';
import type { AuthorPageData } from './features/author/author.state';
import type { BuildPageContent } from './features/build/build.page';

/**
 * Loads a route resolver on navigation instead of preloading it in every route.
 * `app.routes.ts` belongs to the initial bundle, so a static import would drag the
 * build and author resolvers into `/tier-list`, which has a gzip budget (plan §17.48).
 * The router runs resolvers inside an injection context; it is captured before the
 * dynamic import and restored around the resolver.
 */
function lazyResolver<Result>(
  load: () => Promise<(route: ActivatedRouteSnapshot) => Result | Promise<Result>>,
): (route: ActivatedRouteSnapshot) => Promise<Result> {
  return (route) => {
    const injector = inject(Injector);
    return load().then((resolve) => runInInjectionContext(injector, () => resolve(route)));
  };
}

const resolveBuildPage = lazyResolver<BuildPageContent | null>(() =>
  import('./core/content/content.resolvers').then((module) => module.resolveBuildPage),
);
const resolveAuthor = lazyResolver<AuthorPageData | null>(() =>
  import('./features/author/author.state').then((module) => module.resolveAuthor),
);

export const routes: Routes = [
  {
    path: 'acerca',
    loadComponent: () => import('./features/static-pages/about.page').then((m) => m.AboutPage),
  },
  {
    path: 'autores/:slug',
    loadComponent: () => import('./features/author/author.page').then((m) => m.AuthorPage),
    resolve: { author: resolveAuthor },
  },
  {
    path: 'tier-list',
    loadComponent: () => import('./features/tier-list/tier-list.page').then((m) => m.TierListPage),
    resolve: { catalog: resolveCatalog },
  },
  {
    path: 'builds/:slug',
    loadComponent: () => import('./features/build/build-route.page').then((m) => m.BuildRoutePage),
    resolve: { content: resolveBuildPage },
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: '404',
    loadComponent: () =>
      import('./features/static-pages/not-found.page').then((m) => m.NotFoundPage),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/static-pages/not-found.page').then((m) => m.NotFoundPage),
  },
];
