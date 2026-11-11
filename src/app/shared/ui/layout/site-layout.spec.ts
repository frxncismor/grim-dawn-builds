import { Component, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SiteLayout } from './site-layout';
import { APP_BASE_HREF } from '@angular/common';

@Component({ template: '<p>Contenido de ruta</p>' })
class RouteFixture {}
@Component({
  imports: [SiteLayout],
  template: '<gd-site-layout><h1>Contenido proyectado</h1></gd-site-layout>',
})
class HostFixture {}

describe('SiteLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostFixture],
      providers: [
        provideRouter([
          { path: '', component: RouteFixture },
          { path: 'tier-list', component: RouteFixture },
        ]),
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('provides one main landmark, projected content and a focusable skip target', async () => {
    const fixture = TestBed.createComponent(HostFixture);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('main')).toHaveLength(1);
    expect(root.querySelector('main h1')?.textContent).toBe('Contenido proyectado');
    expect(root.querySelector('main')?.getAttribute('id')).toBe('main');
    expect(root.querySelector('main')?.getAttribute('tabindex')).toBe('-1');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/#main');
    expect(root.querySelector('a')?.textContent).toContain('Skip to content');
  });

  it('renders legal attribution and real href values for navigation without JavaScript', async () => {
    const fixture = TestBed.createComponent(HostFixture);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('footer')?.textContent).toContain(
      'Not affiliated with Crate Entertainment',
    );
    const hrefs = [...root.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    for (const href of ['/', '/tier-list', '/acerca', '/legal']) expect(hrefs).toContain(href);
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Main navigation');
    expect(root.querySelector('.header-inner > .lang-switch')?.textContent).toContain('English');
    expect(
      root.querySelector('.header-inner > .lang-switch a[hreflang="es"]')?.getAttribute('href'),
    ).toBe('/es/');
  });
  it('keeps the configured application base in the native skip target', async () => {
    TestBed.overrideProvider(APP_BASE_HREF, { useValue: '/project/' });
    const fixture = TestBed.createComponent(HostFixture);
    await TestBed.inject(Router).navigateByUrl('/tier-list?d=rayo');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.skip-link').getAttribute('href')).toBe(
      '/project/tier-list?d=rayo#main',
    );
  });

  it('preserves route and query in the locale links and excludes the fragment', async () => {
    const fixture = TestBed.createComponent(HostFixture);
    await TestBed.inject(Router).navigateByUrl('/tier-list?x=1#section');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('href')).toBe(
      '/tier-list?x=1',
    );
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('href')).toBe(
      '/es/tier-list?x=1',
    );
    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.hasAttribute('aria-current')).toBe(
      false,
    );
  });

  it('builds links from the Spanish base and marks Spanish as the active locale', async () => {
    TestBed.overrideProvider(LOCALE_ID, { useValue: 'es' });
    TestBed.overrideProvider(APP_BASE_HREF, { useValue: '/es/' });
    const fixture = TestBed.createComponent(HostFixture);
    await TestBed.inject(Router).navigateByUrl('/tier-list?x=1');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('href')).toBe(
      '/tier-list?x=1',
    );
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('href')).toBe(
      '/es/tier-list?x=1',
    );
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(root.querySelector('.lang-switch a[lang="en"]')?.textContent?.trim()).toBe('English');
    expect(root.querySelector('.lang-switch a[lang="es"]')?.textContent?.trim()).toBe('Español');
    expect(root.querySelector('.lang-switch button, .lang-switch [onclick]')).toBeNull();
  });

  it('updates the active navigation link using aria-current on router navigation', async () => {
    const fixture = TestBed.createComponent(HostFixture);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('header a[aria-current="page"]')?.getAttribute('href')).toBe('/');
    await router.navigateByUrl('/tier-list');
    await fixture.whenStable();
    expect(root.querySelector('header a[aria-current="page"]')?.getAttribute('href')).toBe(
      '/tier-list',
    );
    expect(root.querySelectorAll('header a[aria-current="page"]')).toHaveLength(1);
    await router.navigateByUrl('/tier-list?m=chaman');
    await fixture.whenStable();
    expect(root.querySelector('header a[aria-current="page"]')?.getAttribute('href')).toBe(
      '/tier-list',
    );
    expect(root.querySelector('.skip-link')?.getAttribute('href')).toBe('/tier-list?m=chaman#main');
    await router.navigateByUrl('/tier-list?d=rayo#old-section');
    await fixture.whenStable();
    expect(root.querySelector('.skip-link')?.getAttribute('href')).toBe('/tier-list?d=rayo#main');
  });
});
