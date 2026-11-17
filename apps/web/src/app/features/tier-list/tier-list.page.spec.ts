import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  it('spec005 T037 (B-01): the desktop title is a non-interactive heading kept apart from the folding summary', async () => {
    const harness = await start('/tier-list?d=rayo');
    const panel = harness.routeNativeElement!.querySelector('details.filter-panel')!;
    const title = panel.querySelector('.filter-title')!;
    expect(title.tagName).not.toBe('SUMMARY');
    expect(title.textContent).toContain('Filter catalog');
    expect(title.getAttribute('data-count')).toBe('1');
    expect(title.querySelector('button, a, [tabindex]')).toBeNull();
    // The summary stays the control for the phone; the stylesheet hides it from desktop.
    expect(panel.querySelector(':scope > summary')?.textContent).toContain('Filter catalog');
  });

  it('restores a combined query filter, count and canonical structured data', async () => {
    const harness = await start('/tier-list?m=chaman&d=rayo');
    expect(harness.routeNativeElement!.querySelectorAll('gd-build-card')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('1 of 2');
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

describe('spec005 T020 (F-01): the catalog title follows the page language', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('renders the localized title in the H1, the document and the structured data, with no lang override', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'tier-list',
            component: TierListPage,
            resolve: { catalog: () => buildCatalog(input, 'en') },
          },
        ]),
        { provide: SITE_BASE_URL, useValue: 'https://example.org/' },
      ],
    });
    const harness = await RouterTestingHarness.create('/tier-list');
    await harness.fixture.whenStable();
    const h1 = harness.routeNativeElement!.querySelector('h1')!;
    expect(h1.textContent?.trim()).toBe('Catalog of mastery combinations');
    expect(h1.hasAttribute('lang')).toBe(false);
    expect(document.title).toContain('Catalog of mastery combinations');
    const json = JSON.parse(document.querySelector('#gd-page-jsonld')!.textContent!);
    expect(json.name).toBe('Catalog of mastery combinations');
  });
});

describe('spec005 T026 (F-06, F-07): catalog width and the filter panel', () => {
  afterEach(() => TestBed.resetTestingModule());
  const css = readFileSync(resolve('src/styles/tier-list.css'), 'utf8');
  const filtersCss = readFileSync(resolve('src/styles/tier-components.css'), 'utf8');
  const rule = (source: string, selector: string): string => {
    const start = source.indexOf(`${selector} {`);
    expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf('}', start));
  };
  const start = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'tier-list',
            component: TierListPage,
            resolve: { catalog: () => buildCatalog(input, 'en') },
          },
        ]),
        { provide: SITE_BASE_URL, useValue: 'https://example.org/' },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  };

  it('renders the filter panel folded and shows how many filters are active', async () => {
    const el = await start('/tier-list?m=chaman&d=rayo');
    const panel = el.querySelector('details.filter-panel')!;
    expect(panel.hasAttribute('open')).toBe(false);
    expect(panel.querySelector('summary')?.textContent).toContain('Filter catalog');
    expect(panel.querySelector('summary')?.getAttribute('data-count')).toBe('2');
  });

  it('adds no count when no filter is active', async () => {
    const el = await start('/tier-list');
    expect(el.querySelector('details.filter-panel summary')?.hasAttribute('data-count')).toBe(
      false,
    );
  });

  it('keeps the panel open from 48rem up with CSS only, and lets header and counter use the container width', () => {
    expect(rule(css, 'gd-tier-list-page .catalog-intro')).not.toContain('max-inline-size');
    expect(rule(css, 'gd-tier-list-page .result-count')).toContain('max-inline-size: none');
    // B-01: only where `::details-content` is supported, and the inert summary leaves the a11y tree.
    expect(css).toMatch(
      /@media \(min-width: 48\.0625rem\)\s*\{\s*@supports selector\(::details-content\)[^@]*::details-content/s,
    );
    expect(css).toMatch(/\.filter-panel > summary \{\s*display: none;/);
    expect(css).not.toContain('pointer-events: none');
    expect(rule(filtersCss, 'gd-filter-bar > .filters')).toContain('padding-inline');
    expect(rule(css, 'gd-tier-list-page .filter-help')).toContain('padding-inline');
  });
});
