import { inject, InjectionToken, makeStateKey, TransferState } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';
import type { PublicAuthor } from '@gd/domain';
import { CATALOG_STATE } from '../../core/content/catalog.resolver';
import type { CatalogGuide, CatalogInput } from '../tier-list/catalog.model';

export interface AuthorSnapshot {
  profile: PublicAuthor;
  guideSlugs: readonly string[];
  ownsCatalog: boolean;
}
export interface PublicSiteData {
  catalog: CatalogInput;
  authors: readonly AuthorSnapshot[];
}
export interface AuthorPageData {
  profile: PublicAuthor;
  guides: readonly CatalogGuide[];
  ownsCatalog: boolean;
}
export const AUTHORS_STATE = makeStateKey<readonly AuthorSnapshot[] | null>('gd-public-authors');
/** Server provider creates one memoized loader per SSR injector, never a process-wide cache. */
export const PUBLIC_SITE_LOADER = new InjectionToken<() => Promise<PublicSiteData>>(
  'PUBLIC_SITE_LOADER',
);
export function resolveAuthor(route: ActivatedRouteSnapshot): AuthorPageData | null {
  const state = inject(TransferState),
    authors = state.get(AUTHORS_STATE, null),
    catalog = state.get(CATALOG_STATE, null);
  if (!authors || !catalog) throw new Error('Faltan los autores prerenderizados.');
  const slug = route.paramMap.get('slug') ?? '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const author = authors.find((a) => a.profile.slug === slug);
  if (!author) return null;
  const ids = new Set(author.guideSlugs),
    guides = catalog.guides.filter((g) => ids.has(g.slug));
  if (guides.length !== ids.size) throw new Error('Autores prerenderizados incoherentes.');
  return { profile: author.profile, ownsCatalog: author.ownsCatalog, guides };
}
export function safeAuthorUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
