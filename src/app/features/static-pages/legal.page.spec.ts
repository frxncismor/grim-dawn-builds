import { TestBed } from '@angular/core/testing';
import { PrerenderFallback, RenderMode } from '@angular/ssr';
import type { ServerRoutePrerender } from '@angular/ssr';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { LegalPage } from './legal.page';

const ISSUES_URL = 'https://github.com/frxncismor/grim-dawn-builds/issues';
const CANONICAL = 'https://example.org/legal';
const HEADINGS = [
  'Titularidad y derechos',
  'Atribución',
  'Fuentes y activos',
  'Retirada de contenido',
  'Privacidad',
  'No afiliación',
];

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<LegalPage>>;
  root: HTMLElement;
} {
  TestBed.configureTestingModule({
    providers: [{ provide: SITE_BASE_URL, useValue: 'https://example.org/' }],
  });
  const fixture = TestBed.createComponent(LegalPage);
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('legal notice page', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('publishes the six content blocks under a single first-level heading', () => {
    const { root } = render();
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Aviso legal');

    const sections = [...root.querySelectorAll('section')];
    expect(sections).toHaveLength(6);
    expect(sections.map((section) => section.querySelector('h2')?.textContent?.trim())).toEqual(
      HEADINGS,
    );

    for (const section of sections) {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).not.toBeNull();
      expect(section.querySelector('h2')?.id).toBe(labelledBy);
    }
  });

  it('states ownership, attribution, assets, takedown, privacy and non-affiliation facts', () => {
    const { root } = render();
    const text = root.textContent ?? '';

    expect(text).toContain('sin una licencia declarada');
    expect(text).toContain('todos los derechos quedan reservados');
    expect(text).toContain('no sustituye al permiso');
    expect(text).toContain('No se hace scraping automático');
    expect(text).toContain('estado aprobado');
    expect(text).toContain('glifos SVG propios');
    expect(text).toContain('se despublica primero');
    expect(text).toContain('no tiene cuentas, comentarios ni analítica de terceros');
    expect(text).toContain('progreso opcional del checklist de compra');
    expect(text).toContain('no está afiliado con Crate Entertainment ni con GrimTools');
  });

  it('points takedown and general contact at the real GitHub issue channel only', () => {
    const { root } = render();
    const link = root.querySelector<HTMLAnchorElement>(`a[href="${ISSUES_URL}"]`);

    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent?.trim().length ?? 0).toBeGreaterThan(10);
    expect(link?.textContent).toContain('issue');

    const hrefs = [...root.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href'));
    expect(hrefs).toEqual([ISSUES_URL]);
  });

  it('never invents an email address, phone number or unofficial contact service', () => {
    const { root } = render();
    const text = root.textContent ?? '';
    const anchors = [...root.querySelectorAll('a')];

    expect(
      anchors.some((anchor) => /^(mailto|tel):/i.test(anchor.getAttribute('href') ?? '')),
    ).toBe(false);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(text).not.toMatch(/\+\d[\d\s().-]{6,}/);
    expect(text.toLowerCase()).not.toContain('formulario de contacto');
  });

  it('publishes WebPage structured data with a canonical URL and description', () => {
    render();

    expect(document.title).toBe('Aviso legal · Grim Dawn Builds');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(CANONICAL);
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute('content')?.length ?? 0,
    ).toBeGreaterThan(40);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index,follow',
    );

    const jsonLd = document.querySelector('script#gd-page-jsonld')?.textContent ?? '';
    const parsed = JSON.parse(jsonLd) as Record<string, unknown>;
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('WebPage');
    expect(parsed['url']).toBe(CANONICAL);
    expect(parsed['name']).toBe('Aviso legal');
  });

  it('renders static text without assigning innerHTML', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!descriptor?.set || !descriptor.get)
      throw new Error('innerHTML no observable en este DOM.');
    let writes = 0;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      get: descriptor.get,
      set(value: string) {
        writes++;
        descriptor.set!.call(this, value);
      },
    });
    try {
      const { root } = render();
      expect(writes).toBe(0);
      expect(root.querySelector('script')).toBeNull();
    } finally {
      Object.defineProperty(Element.prototype, 'innerHTML', descriptor);
    }
  });

  it('registers a lazy client route and prerenders it', async () => {
    const clientRoute = routes.find((route) => route.path === 'legal');
    expect(clientRoute).toBeDefined();
    const loader = clientRoute?.loadComponent;
    expect(typeof loader).toBe('function');
    await expect((loader as () => Promise<unknown>)()).resolves.toBe(LegalPage);

    const serverRoute = serverRoutes.find((route) => route.path === 'legal') as
      ServerRoutePrerender | undefined;
    expect(serverRoute?.renderMode).toBe(RenderMode.Prerender);
    expect(serverRoute?.fallback ?? PrerenderFallback.None).toBe(PrerenderFallback.None);
  });
});
