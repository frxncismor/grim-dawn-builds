import { APP_BASE_HREF, Location } from '@angular/common';
import { Component, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { LanguageSwitcher } from './language-switcher';

@Component({ template: '' })
class RouteFixture {}

async function createSwitcher(locale = 'en', baseHref = '/') {
  await TestBed.configureTestingModule({
    imports: [LanguageSwitcher],
    providers: [
      provideRouter([{ path: '**', component: RouteFixture }]),
      { provide: LOCALE_ID, useValue: locale },
      { provide: APP_BASE_HREF, useValue: baseHref },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LanguageSwitcher);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('LanguageSwitcher', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders native locale links at the English root', async () => {
    const fixture = await createSwitcher();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('href')).toBe('/');
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('href')).toBe('/es/');
    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.hasAttribute('aria-current')).toBe(
      false,
    );
  });

  it('preserves the route and query and excludes the fragment after NavigationEnd', async () => {
    const fixture = await createSwitcher();
    const router = TestBed.inject(Router);
    let navigationEnd: NavigationEnd | undefined;
    const subscription = router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) navigationEnd = event;
    });
    await router.navigateByUrl('/tier-list?x=1#section');
    subscription.unsubscribe();
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('href')).toBe(
      '/tier-list?x=1',
    );
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('href')).toBe(
      '/es/tier-list?x=1',
    );
    expect(navigationEnd?.urlAfterRedirects).toBe('/tier-list?x=1#section');
  });

  it('removes the Spanish base segment when building links from /es/', async () => {
    const fixture = await createSwitcher('es', '/es/');
    const root: HTMLElement = fixture.nativeElement;

    expect(TestBed.inject(Location).prepareExternalUrl('/')).toBe('/es/');
    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('href')).toBe('/');
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('href')).toBe('/es/');
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('aria-current')).toBe(
      'true',
    );

    await TestBed.inject(Router).navigateByUrl('/tier-list?x=1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('.lang-switch a[hreflang="en"]')?.getAttribute('href')).toBe(
      '/tier-list?x=1',
    );
    expect(root.querySelector('.lang-switch a[hreflang="es"]')?.getAttribute('href')).toBe(
      '/es/tier-list?x=1',
    );
  });

  it('uses destination language metadata and visible labels without buttons or click handlers', async () => {
    const fixture = await createSwitcher();
    const root: HTMLElement = fixture.nativeElement;
    const nav = root.querySelector('nav');
    const english = root.querySelector('a[hreflang="en"]');
    const spanish = root.querySelector('a[hreflang="es"]');

    expect(nav?.getAttribute('aria-label')).toBe('Language');
    expect(english?.getAttribute('lang')).toBe('en');
    expect(english?.textContent?.trim()).toBe('English');
    expect(spanish?.getAttribute('lang')).toBe('es');
    expect(spanish?.textContent?.trim()).toBe('Español');
    expect(root.querySelector('button')).toBeNull();
    expect([...root.querySelectorAll('a')].every((link) => link.hasAttribute('href'))).toBe(true);
    expect(root.querySelector('[onclick]')).toBeNull();
  });
});
