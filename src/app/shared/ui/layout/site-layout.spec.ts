import { Component } from '@angular/core';
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
    expect(root.querySelector('a')?.textContent).toContain('Saltar al contenido');
  });

  it('renders legal attribution and real href values for navigation without JavaScript', async () => {
    const fixture = TestBed.createComponent(HostFixture);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('footer')?.textContent).toContain(
      'No está afiliado a Crate Entertainment',
    );
    const hrefs = [...root.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    for (const href of ['/', '/tier-list', '/acerca', '/legal']) expect(hrefs).toContain(href);
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegación principal');
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
