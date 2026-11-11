import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TierListPage } from './tier-list.page';
import { buildCatalog } from './catalog.model';
import { input } from './catalog.test-data';
import { SITE_BASE_URL } from '../../core/seo/site-url';
describe('catalog page with URL state', () => {
  afterEach(() => TestBed.resetTestingModule());
  const start = async (url: string, locale: 'en' | 'es' = 'en') => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'tier-list',
            component: TierListPage,
            resolve: { catalog: () => buildCatalog(input, locale) },
          },
        ]),
        { provide: SITE_BASE_URL, useValue: 'https://example.org/' },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    return harness;
  };
  it('restores a combined query filter, count and canonical structured data', async () => {
    const harness = await start('/tier-list?m=chaman&d=rayo');
    expect(harness.routeNativeElement!.querySelectorAll('gd-tier-card')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('1 of 2');
    expect(harness.routeNativeElement!.querySelector('h1')?.getAttribute('lang')).toBe('es');
    expect(document.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(
      'https://example.org/tier-list',
    );
    const json = JSON.parse(document.querySelector('#gd-page-jsonld')!.textContent!);
    expect(json['@type']).toBe('ItemList');
    expect(json.numberOfItems).toBe(2);
    expect(harness.routeNativeElement!.textContent).toContain('test-version');
    expect(harness.routeNativeElement!.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-11-09',
    );
  });
  it('synchronizes controls with URL and restores selection when navigating between history states', async () => {
    const harness = await start('/tier-list');
    const button = [...harness.routeNativeElement!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Lightning',
    )!;
    button.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('d=rayo');
    expect(harness.routeNativeElement!.querySelectorAll('gd-tier-card')).toHaveLength(1);
    await harness.navigateByUrl('/tier-list?m=arcanista');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('gd-tier-card')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('Guide coming soon');
    await harness.navigateByUrl('/tier-list?d=rayo');
    await harness.fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
  it('shows an empty state and reset removes filter parameters', async () => {
    const harness = await start('/tier-list?d=caos');
    expect(harness.routeNativeElement!.querySelectorAll('gd-tier-card')).toHaveLength(0);
    expect(harness.routeNativeElement!.querySelector('gd-empty-state')).not.toBeNull();
    (
      harness.routeNativeElement!.querySelector('gd-empty-state button') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/tier-list');
    expect(harness.routeNativeElement!.querySelectorAll('gd-tier-card')).toHaveLength(2);
  });
  it('omits lang when the active locale matches the content locale', async () => {
    const harness = await start('/tier-list', 'es');
    expect(harness.routeNativeElement!.querySelector('h1')?.hasAttribute('lang')).toBe(false);
  });
});
