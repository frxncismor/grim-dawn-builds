import { inject, InjectionToken, makeStateKey, TransferState } from '@angular/core';

const LOCAL_SITE_URL = 'http://localhost:4200/';
export const SITE_URL_KEY = makeStateKey<string>('gd:site-base-url');

/** Public configuration only. A base with credentials or tracking parameters is never serialized. */
export function normalizeSiteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('BASE_URL pública inválida.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href.includes('?') ||
    url.href.includes('#')
  ) {
    throw new Error('BASE_URL pública inválida.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function canonicalUrl(base: string, path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    throw new Error('La ruta canonical debe ser interna.');
  const site = new URL(normalizeSiteUrl(base));
  const url = new URL(path.slice(1), site);
  if (
    url.origin !== site.origin ||
    !url.pathname.startsWith(site.pathname) ||
    url.username ||
    url.password
  ) {
    throw new Error('La ruta canonical debe permanecer dentro de la URL base pública.');
  }
  url.search = '';
  url.hash = '';
  return url.href;
}

export function transferSiteUrl(state: TransferState, value: string | undefined): string {
  const url = normalizeSiteUrl(value ?? LOCAL_SITE_URL);
  state.set(SITE_URL_KEY, url);
  return url;
}

export const SITE_BASE_URL = new InjectionToken<string>('SITE_BASE_URL', {
  providedIn: 'root',
  factory: () => normalizeSiteUrl(inject(TransferState).get(SITE_URL_KEY, LOCAL_SITE_URL)),
});
