import { DOCUMENT, inject, Injectable, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { canonicalUrl, SITE_BASE_URL } from './site-url';

export type SiteLocale = 'en' | 'es';
type HreflangKey = SiteLocale | 'x-default';

export interface JsonLdRecord {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}
export interface SeoPage {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  robots?: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  image?: { path: string; alt: string; width: number; height: number };
  structuredData?: readonly JsonLdRecord[];
}
const SITE_NAME = 'Grim Dawn Builds';
const DEFAULT_SOCIAL_IMAGE = {
  path: '/og/site.png',
  alt: $localize`:@@seo.socialAlt:Grim Dawn Builds: English-language catalog, masteries and clear statuses.`,
  width: 1200,
  height: 630,
};
const JSON_LD_ID = 'gd-page-jsonld';
const LOCALE_PREFIX: Record<SiteLocale, string> = { en: '', es: '/es' };
const OG_LOCALE: Record<SiteLocale, string> = { en: 'en_US', es: 'es_ES' };
const LOCALE_PREFIX_SEGMENT = /^\/es(?=[/?#]|$)/;
const PRIVATE_KEYS = new Set([
  'reviewedby',
  'reviewedat',
  'rightsconfirmedby',
  'rightsconfirmedon',
  'rightsnotes',
  'permissionref',
  'evidenceref',
  'proofref',
  'isplaceholder',
]);

function assertPublicData(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (PRIVATE_KEYS.has(key.replace(/[_-]/g, '').toLowerCase()))
      throw new Error('Datos estructurados privados.');
    assertPublicData(nested);
  }
}

/** JSON serialization is validated and escaped before any head mutation. */
function serializeJsonLd(records: readonly JsonLdRecord[]): string | null {
  if (!records.length) return null;
  try {
    for (const record of records) {
      if (
        !record ||
        typeof record !== 'object' ||
        record['@context'] !== 'https://schema.org' ||
        typeof record['@type'] !== 'string' ||
        !record['@type'].trim()
      )
        throw new Error('Registro inválido.');
    }
    assertPublicData(records);
    return JSON.stringify(records.length === 1 ? records[0] : records).replace(
      /[<>&\u2028\u2029]/g,
      (character) =>
        ({
          '<': '\\u003c',
          '>': '\\u003e',
          '&': '\\u0026',
          '\u2028': '\\u2028',
          '\u2029': '\\u2029',
        })[character]!,
    );
  } catch {
    throw new Error('Datos estructurados inválidos.');
  }
}

export function siteLocale(value: string): SiteLocale {
  return value.toLowerCase().startsWith('es') ? 'es' : 'en';
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly baseUrl = inject(SITE_BASE_URL);
  private readonly locale = siteLocale(inject(LOCALE_ID));

  canonical(path: string): string {
    return this.localizedUrl(this.locale, path);
  }

  private localizedUrl(locale: SiteLocale, path: string): string {
    canonicalUrl(this.baseUrl, path);
    if (LOCALE_PREFIX_SEGMENT.test(path))
      throw new Error('La ruta canonical no debe incluir el prefijo de idioma.');
    return canonicalUrl(this.baseUrl, `${LOCALE_PREFIX[locale]}${path}`);
  }

  setPage(page: SeoPage): void {
    if (!page.title.trim() || !page.description.trim())
      throw new Error('SEO requiere título y descripción.');
    const title =
      page.title.trim() === SITE_NAME ? SITE_NAME : `${page.title.trim()} · ${SITE_NAME}`;
    const description = page.description.trim();
    const canonical = this.canonical(page.path);
    const jsonLd = serializeJsonLd(page.structuredData ?? []);
    const selectedImage = page.image ?? DEFAULT_SOCIAL_IMAGE;
    const alternates: Record<HreflangKey, string> = {
      en: this.localizedUrl('en', page.path),
      es: this.localizedUrl('es', page.path),
      'x-default': this.localizedUrl('en', page.path),
    };
    const image = { ...selectedImage, url: canonicalUrl(this.baseUrl, selectedImage.path) };
    if (
      !image.alt.trim() ||
      !Number.isInteger(image.width) ||
      image.width <= 0 ||
      !Number.isInteger(image.height) ||
      image.height <= 0
    )
      throw new Error('Imagen social inválida.');

    this.title.setTitle(title);
    this.setMeta('name', 'description', description);
    this.setMeta('name', 'robots', page.robots ?? 'index,follow');
    this.setMeta('property', 'og:title', title);
    this.setMeta('property', 'og:description', description);
    this.setMeta('property', 'og:url', canonical);
    this.setMeta('property', 'og:type', page.type ?? 'website');
    this.setMeta('property', 'og:site_name', SITE_NAME);
    this.setMeta('property', 'og:locale', OG_LOCALE[this.locale]);
    this.setMeta('property', 'og:locale:alternate', OG_LOCALE[this.locale === 'en' ? 'es' : 'en']);
    this.setMeta('name', 'twitter:card', 'summary_large_image');
    this.setMeta('name', 'twitter:title', title);
    this.setMeta('name', 'twitter:description', description);
    this.setMeta('name', 'twitter:url', canonical);
    for (const [key, value] of Object.entries({
      'og:image': image.url,
      'og:image:alt': image.alt,
      'og:image:width': image.width.toString(),
      'og:image:height': image.height.toString(),
    }))
      this.optionalMeta('property', key, value);
    this.optionalMeta('name', 'twitter:image', image.url);
    this.optionalMeta('name', 'twitter:image:alt', image.alt);

    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = canonical;
    for (const duplicate of this.document.querySelectorAll('link[rel="canonical"]'))
      if (duplicate !== link) duplicate.remove();

    for (const alternate of this.document.querySelectorAll('link[rel="alternate"][hreflang]'))
      alternate.remove();
    for (const [hreflang, href] of Object.entries(alternates)) {
      const alternate = this.document.createElement('link');
      alternate.setAttribute('rel', 'alternate');
      alternate.setAttribute('hreflang', hreflang);
      alternate.setAttribute('href', href);
      this.document.head.appendChild(alternate);
    }

    let script = this.document.querySelector<HTMLScriptElement>(`script#${JSON_LD_ID}`);
    if (!jsonLd) {
      script?.remove();
      return;
    }
    if (!script) {
      script = this.document.createElement('script');
      script.id = JSON_LD_ID;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = jsonLd;
  }

  private setMeta(kind: 'name' | 'property', key: string, content: string): void {
    const selector = `${kind}="${key}"`;
    const element = this.meta.updateTag({ [kind]: key, content }, selector);
    for (const duplicate of this.meta.getTags(selector))
      if (duplicate !== element) this.meta.removeTagElement(duplicate);
  }

  private optionalMeta(kind: 'name' | 'property', key: string, content: string | undefined): void {
    if (content !== undefined) this.setMeta(kind, key, content);
    else
      for (const element of this.meta.getTags(`${kind}="${key}"`))
        this.meta.removeTagElement(element);
  }
}
