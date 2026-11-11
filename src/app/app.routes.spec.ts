import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { PrerenderFallback, RenderMode } from '@angular/ssr';
import type { ServerRoutePrerenderWithParams } from '@angular/ssr';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { CONTENT_REPOSITORY, type ContentRepository } from './core/content/repository';
import { SITE_BASE_URL } from './core/seo/site-url';
import { BuildRoutePage } from './features/build/build-route.page';
import { NotFoundPage } from './features/static-pages/not-found.page';

function stubRepository(slugs: readonly string[]): ContentRepository {
  return {
    findBuild: async () => null,
    listBuilds: async () => [],
    listSlugs: async () => slugs,
    getTierList: async () => null,
    getAuthor: async () => null,
  };
}

const load = async (route: (typeof routes)[number]): Promise<unknown> => {
  const loader = route.loadComponent;
  if (typeof loader !== 'function') throw new Error('La ruta no es lazy.');
  return (loader as () => Promise<unknown>)();
};

describe('application routes', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lazy-loads the controlled build page and loads its resolver on navigation', async () => {
    const buildRoute = routes.find((route) => route.path === 'builds/:slug');
    expect(buildRoute).toBeDefined();
    const resolver = buildRoute?.resolve?.['content'];
    expect(typeof resolver).toBe('function');
    expect(await load(buildRoute!)).toBe(BuildRoutePage);

    // Plan §17.48: the resolver module stays out of the initial bundle but still resolves.
    await expect(
      Promise.resolve(
        TestBed.runInInjectionContext(() =>
          resolver!({
            paramMap: convertToParamMap({ slug: 'no-existe' }),
          } as ActivatedRouteSnapshot),
        ),
      ),
    ).resolves.toBeNull();
  });

  it('keeps the wildcard route last, lazy and pointing to the static 404 page', async () => {
    const wildcard = routes[routes.length - 1];
    expect(wildcard?.path).toBe('**');
    expect(await load(wildcard!)).toBe(NotFoundPage);
  });

  it('prerenders only the slugs exposed by the repository', async () => {
    const route = serverRoutes.find((serverRoute) => serverRoute.path === 'builds/:slug') as
      ServerRoutePrerenderWithParams | undefined;
    expect(route?.renderMode).toBe(RenderMode.Prerender);
    expect(route?.fallback).toBe(PrerenderFallback.None);

    TestBed.configureTestingModule({
      providers: [{ provide: CONTENT_REPOSITORY, useValue: stubRepository([]) }],
    });
    expect(await TestBed.runInInjectionContext(() => route!.getPrerenderParams!())).toEqual([]);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CONTENT_REPOSITORY,
          useValue: stubRepository(['chaman-demoledor-golpe-primigenio']),
        },
      ],
    });
    expect(await TestBed.runInInjectionContext(() => route!.getPrerenderParams!())).toEqual([
      { slug: 'chaman-demoledor-golpe-primigenio' },
    ]);
  });

  it('prerenders an explicit /404 so the post-build emitter can publish 404.html', async () => {
    const notFoundRoute = routes.find((route) => route.path === '404');
    expect(notFoundRoute).toBeDefined();
    expect(await load(notFoundRoute!)).toBe(NotFoundPage);

    const serverRoute = serverRoutes.find((candidate) => candidate.path === '404');
    expect(serverRoute?.renderMode).toBe(RenderMode.Prerender);
  });

  it('keeps the wildcard server route prerendered so the host can emit a 404 artifact', () => {
    const wildcard = serverRoutes.find((serverRoute) => serverRoute.path === '**');
    expect(wildcard?.renderMode).toBe(RenderMode.Prerender);
  });

  it('renders a static, localized 404 with both navigation links and noindex without data providers', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/' },
      ],
    });
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent).toContain('no encontrada');
    expect([...root.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/tier-list',
    ]);
    expect(root.querySelector('[data-not-found]')).not.toBeNull();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex,follow',
    );
  });

  it('falls back to the 404 page when the resolver returns no public guide', async () => {
    TestBed.configureTestingModule({
      imports: [BuildRoutePage],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/' },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { content: null } } } },
      ],
    });
    const fixture = TestBed.createComponent(BuildRoutePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('gd-not-found-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('gd-build-page')).toBeNull();
  });
});
