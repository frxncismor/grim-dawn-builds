import { LOCALE_ID } from '@angular/core';
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
    expect(harness.routeNativeElement!.querySelectorAll('gd-build-card')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('1 of 2');
    expect(harness.routeNativeElement!.querySelector('h1')?.getAttribute('lang')).toBe('es');
    expect(document.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(
      'https://example.org/tier-list',
    );
    const json = JSON.parse(document.querySelector('#gd-page-jsonld')!.textContent!);
    expect(json['@type']).toBe('ItemList');
    expect(json.numberOfItems).toBe(2);
    expect(harness.routeNativeElement!.textContent).toContain('test-version');
  });
  it('synchronizes controls with URL and restores selection when navigating between history states', async () => {
    const harness = await start('/tier-list');
    const button = [...harness.routeNativeElement!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Lightning',
    )!;
    button.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('d=rayo');
    expect(harness.routeNativeElement!.querySelectorAll('gd-build-card')).toHaveLength(1);
    await harness.navigateByUrl('/tier-list?m=arcanista');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('gd-build-card')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('No guide');
    await harness.navigateByUrl('/tier-list?d=rayo');
    await harness.fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
  it('shows an empty state and reset removes filter parameters', async () => {
    const harness = await start('/tier-list?d=caos');
    expect(harness.routeNativeElement!.querySelectorAll('gd-build-card')).toHaveLength(0);
    expect(harness.routeNativeElement!.querySelector('gd-empty-state')).not.toBeNull();
    (
      harness.routeNativeElement!.querySelector('gd-empty-state button') as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/tier-list');
    expect(harness.routeNativeElement!.querySelectorAll('gd-build-card')).toHaveLength(2);
  });
  it('lists real builds first and folds the combinations with no guide into their own section (spec004 FR-006)', async () => {
    const harness = await start('/tier-list');
    const root = harness.routeNativeElement!;
    const folded = root.querySelector<HTMLDetailsElement>('details.unguided')!;
    expect(folded).not.toBeNull();
    expect(folded.open).toBe(false);
    expect(folded.querySelectorAll('[data-variant="compact"]')).toHaveLength(1);
    expect(folded.textContent).toContain('Combinations still without a guide');
    expect(folded.querySelector('summary')?.textContent).toContain('(1)');
    expect(root.querySelectorAll('gd-tier-row [data-variant="standard"]')).toHaveLength(1);
    expect(root.querySelectorAll('gd-tier-row [data-variant="compact"]')).toHaveLength(0);
    expect(root.querySelector('article article')).toBeNull();
  });
  it('omits lang when the active locale matches the content locale', async () => {
    const harness = await start('/tier-list', 'es');
    expect(harness.routeNativeElement!.querySelector('h1')?.hasAttribute('lang')).toBe(false);
  });
  describe('Crate credit (spec004 T047)', () => {
    const startWith = async (source: 'game' | 'own' | null, locale: 'en' | 'es') => {
      const data = {
        ...input,
        masteries: input.masteries.map((m) =>
          source
            ? {
                ...m,
                portrait: {
                  source,
                  src:
                    source === 'game'
                      ? `assets/portraits/${m.slug}.png`
                      : `assets/icons/${m.slug}.svg`,
                  width: 197,
                  height: 41,
                },
              }
            : m,
        ),
      };
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            {
              path: 'tier-list',
              component: TierListPage,
              resolve: { catalog: () => buildCatalog(data, locale) },
            },
          ]),
          { provide: LOCALE_ID, useValue: locale },
          { provide: SITE_BASE_URL, useValue: 'https://example.org/' },
        ],
      });
      const harness = await RouterTestingHarness.create('/tier-list');
      await harness.fixture.whenStable();
      return harness.routeNativeElement as HTMLElement;
    };
    it('credits Crate and states non-affiliation when a card shows a game portrait, in both languages', async () => {
      for (const locale of ['en', 'es'] as const) {
        const el = await startWith('game', locale);
        expect(el.querySelector('img[src^="assets/portraits/"]')).not.toBeNull();
        const credit = el.querySelector('[data-credit]');
        expect(credit?.textContent).toContain('Crate Entertainment');
        expect(credit?.textContent).toContain('Grim Dawn');
        TestBed.resetTestingModule();
      }
    });
    it('shows no credit with own art or with no portrait', async () => {
      expect((await startWith('own', 'en')).querySelector('[data-credit]')).toBeNull();
      TestBed.resetTestingModule();
      expect((await startWith(null, 'en')).querySelector('[data-credit]')).toBeNull();
    });
  });
});
