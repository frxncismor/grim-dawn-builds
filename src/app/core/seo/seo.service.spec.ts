import { TestBed } from '@angular/core/testing';
import { DOCUMENT, LOCALE_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SITE_BASE_URL } from './site-url';
import { SeoService, type JsonLdRecord } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let doc: Document;
  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Before');
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: doc },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/site/' },
      ],
    });
    service = TestBed.inject(SeoService);
  });
  afterEach(() => TestBed.resetTestingModule());
  const webSite = (name = 'Sitio de prueba'): JsonLdRecord => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
  });

  it('writes unique title, description, canonical, Open Graph and Twitter tags', () => {
    service.setPage({
      title: 'Catálogo',
      description: 'Combinaciones con procedencia.',
      path: '/tier-list?m=chaman#filters',
      structuredData: [webSite()],
    });
    expect(doc.title).toBe('Catálogo · Grim Dawn Builds');
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Combinaciones con procedencia.',
    );
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://example.test/site/tier-list',
    );
    expect(doc.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://example.test/site/tier-list',
    );
    expect(doc.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
    expect(doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(
      doc.title,
    );
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
    expect(JSON.parse(doc.querySelector('#gd-page-jsonld')!.textContent!)).toEqual(webSite());
  });

  it('replaces owned metadata and restores the social default without stale overrides', () => {
    service.setPage({
      title: 'Primera',
      description: 'Primera página.',
      path: '/first',
      type: 'article',
      robots: 'noindex,nofollow',
      image: {
        path: '/og/first.png',
        alt: 'Imagen de la primera página',
        width: 1200,
        height: 630,
      },
      structuredData: [webSite()],
    });
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.test/site/og/first.png',
    );
    expect(doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    );
    service.setPage({ title: 'Grim Dawn Builds', description: 'Portada.', path: '/' });
    service.setPage({ title: 'Grim Dawn Builds', description: 'Portada.', path: '/' });
    expect(doc.title).toBe('Grim Dawn Builds');
    expect(doc.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(doc.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
    expect(doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    );
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.test/site/og/site.png',
    );
    expect(doc.querySelector('meta[property="og:image:width"]')?.getAttribute('content')).toBe(
      '1200',
    );
    expect(doc.querySelector('meta[property="og:image:height"]')?.getAttribute('content')).toBe(
      '630',
    );
    expect(doc.querySelector('meta[property="og:image:alt"]')?.getAttribute('content')).toContain(
      'Grim Dawn Builds',
    );
    expect(doc.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
    expect(doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
      'https://example.test/site/og/site.png',
    );
    expect(doc.querySelector('#gd-page-jsonld')).toBeNull();
  });

  it('escapes script-breaking characters while preserving valid JSON-LD data', () => {
    const value = '</script><script>PRIVATE-INJECTION</script>&\u2028\u2029';
    service.setPage({
      title: 'Segura',
      description: 'Datos como texto.',
      path: '/',
      structuredData: [webSite(value)],
    });
    const script = doc.querySelector('#gd-page-jsonld')!;
    expect(script.textContent).not.toContain('<');
    expect(script.textContent).not.toContain('&');
    expect(JSON.parse(script.textContent!).name).toBe(value);
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(script.getAttribute('type')).toBe('application/ld+json');
  });

  it('rejects nested editorial fields and serialization failures before changing the head', () => {
    service.setPage({ title: 'Original', description: 'Original.', path: '/' });
    for (const key of [
      'reviewed_by',
      'rights_confirmed_by',
      'rights_confirmed_on',
      'rights_notes',
      'permission_ref',
      'evidence_ref',
      'proof_ref',
      'is_placeholder',
    ]) {
      const record = { ...webSite(), author: { [key]: 'PRIVATE-VALUE' } };
      expect(() =>
        service.setPage({
          title: 'Changed',
          description: 'Changed.',
          path: '/',
          structuredData: [record],
        }),
      ).toThrow();
      expect(doc.title).toBe('Original · Grim Dawn Builds');
    }
    const circular = webSite();
    circular['self'] = circular;
    for (const record of [circular, { ...webSite(), value: BigInt(1) }]) {
      expect(() =>
        service.setPage({
          title: 'Changed',
          description: 'Changed.',
          path: '/',
          structuredData: [record],
        }),
      ).toThrow(/estructurados/);
    }
    expect(doc.title).toBe('Original · Grim Dawn Builds');
  });

  it('does not create metadata from blank content or an external canonical route', () => {
    expect(() => service.setPage({ title: ' ', description: 'Description', path: '/' })).toThrow();
    expect(() => service.setPage({ title: 'Title', description: ' ', path: '/' })).toThrow();
    expect(() =>
      service.setPage({ title: 'Title', description: 'Description', path: '//external.test/' }),
    ).toThrow();
    expect(doc.title).toBe('Before');
  });
});

describe('SeoService locales', () => {
  let doc: Document;
  const configure = (locale: string, base = 'https://example.test/site/') => {
    TestBed.resetTestingModule();
    doc = document.implementation.createHTMLDocument('Before');
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: doc },
        { provide: LOCALE_ID, useValue: locale },
        { provide: SITE_BASE_URL, useValue: base },
      ],
    });
    return TestBed.inject(SeoService);
  };
  const page = { title: 'Catálogo', description: 'Combinaciones.', path: '/tier-list' };
  const alternates = () =>
    Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]')).map((link) => [
      link.getAttribute('hreflang'),
      link.getAttribute('href'),
    ]);
  afterEach(() => TestBed.resetTestingModule());

  it('uses the English root for en and the /es prefix for es', () => {
    expect(configure('en-US').canonical('/tier-list')).toBe('https://example.test/site/tier-list');
    expect(configure('es').canonical('/tier-list')).toBe('https://example.test/site/es/tier-list');
    expect(configure('es').canonical('/')).toBe('https://example.test/site/es/');
  });

  it('emits exactly en, es and x-default alternates with absolute URLs', () => {
    configure('es').setPage(page);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://example.test/site/es/tier-list',
    );
    expect(alternates()).toEqual([
      ['en', 'https://example.test/site/tier-list'],
      ['es', 'https://example.test/site/es/tier-list'],
      ['x-default', 'https://example.test/site/tier-list'],
    ]);
    expect(doc.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('es_ES');
    expect(doc.querySelector('meta[property="og:locale:alternate"]')?.getAttribute('content')).toBe(
      'en_US',
    );
  });

  it('keeps the head idempotent across repeated navigations', () => {
    const service = configure('en');
    service.setPage(page);
    service.setPage({ ...page, path: '/' });
    service.setPage(page);
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(doc.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(3);
    expect(doc.querySelectorAll('meta[property="og:locale"]')).toHaveLength(1);
    expect(doc.querySelectorAll('meta[property="og:locale:alternate"]')).toHaveLength(1);
    expect(alternates()[0]).toEqual(['en', 'https://example.test/site/tier-list']);
  });

  it('keeps subpath base URLs and static social images outside the locale prefix', () => {
    const service = configure('es', 'https://example.test/grim/');
    service.setPage(page);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://example.test/grim/es/tier-list',
    );
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.test/grim/og/site.png',
    );
  });

  it('rejects external routes and paths that already carry the locale prefix', () => {
    const service = configure('es');
    for (const path of ['//external.test/', '/es/tier-list', '/es', '/es?x=1']) {
      expect(() => service.canonical(path)).toThrow();
      expect(() =>
        service.setPage({ title: 'Título', description: 'Descripción', path }),
      ).toThrow();
    }
    expect(doc.title).toBe('Before');
    expect(doc.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(0);
  });
});
