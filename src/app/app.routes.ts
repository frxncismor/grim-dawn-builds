import { Routes } from '@angular/router';
import { resolveCatalog } from './core/content/catalog.resolver';
import { resolveAuthor } from './features/author/author.state';

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
    path: '',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
];
