import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import type { MasterySummary } from '../../core/content/masteries';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { MasteryIndexPage } from './index.page';

const base: MasterySummary[] = [
  { slug: 'arcanist', name: { en: 'Arcanist', es: 'Arcanista' }, nodeCount: 30 },
  { slug: 'demolition', name: { en: 'Demolitionist', es: 'Demoledor' }, nodeCount: 33 },
  { slug: 'nightblade', name: { en: 'Nightblade', es: 'Hoja de la Noche' }, nodeCount: 31 },
  { slug: 'occult', name: { en: 'Occultist', es: 'Ocultista' }, nodeCount: 30 },
  { slug: 'shaman', name: { en: 'Shaman', es: 'Chamán' }, nodeCount: 30 },
  { slug: 'soldier', name: { en: 'Soldier', es: 'Soldado' }, nodeCount: 32 },
];

describe('mastery index page', () => {
  afterEach(() => TestBed.resetTestingModule());

  function create(masteries: readonly MasterySummary[], locale = 'en') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: locale },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/' },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { masteries } } } },
      ],
    });
    return TestBed.createComponent(MasteryIndexPage);
  }
  const rows = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-mastery]')];
  const linkText = (row: HTMLElement) => row.querySelector('a')?.textContent?.trim();

  it('lists the six masteries with their English names and real node counts', async () => {
    const fixture = create(base);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('h1')).not.toBeNull();
    expect(rows(root).map((row) => row.dataset['mastery'])).toEqual(base.map((m) => m.slug));
    expect(rows(root).map(linkText)).toEqual(base.map((m) => m.name!.en));
    expect(
      rows(root).map((row) => row.querySelector('[data-count]')?.textContent?.match(/\d+/)?.[0]),
    ).toEqual(['30', '33', '31', '30', '30', '32']);
  });

  it('shows the Spanish names under /es', async () => {
    const fixture = create(base, 'es');
    await fixture.whenStable();
    expect(rows(fixture.nativeElement).map(linkText)).toEqual(base.map((m) => m.name!.es));
  });

  it('links every mastery with data to /maestrias/<slug>', async () => {
    const fixture = create(base);
    await fixture.whenStable();
    const hrefs = rows(fixture.nativeElement).map((row) =>
      row.querySelector('a')?.getAttribute('href'),
    );
    expect(hrefs).toEqual(base.map((m) => `/maestrias/${m.slug}`));
  });

  it('shows a mastery without data as "no data", without a link and without breaking the page', async () => {
    const empty: MasterySummary = { slug: 'soldier', name: null, nodeCount: 0 };
    const zero: MasterySummary = { ...base[0]!, nodeCount: 0 };
    const fixture = create([zero, base[1]!, empty]);
    await fixture.whenStable();
    const list = rows(fixture.nativeElement);
    expect(list).toHaveLength(3);
    for (const row of [list[0]!, list[2]!]) {
      expect(row.querySelector('a')).toBeNull();
      expect(row.querySelector('[data-empty]')).not.toBeNull();
      expect(row.querySelector('[data-count]')).toBeNull();
    }
    expect(list[0]!.textContent).toContain('Arcanist');
    expect(list[2]!.textContent).toContain('soldier');
    expect(list[1]!.querySelector('a')?.getAttribute('href')).toBe('/maestrias/demolition');
  });

  it('survives an empty catalog snapshot', async () => {
    const fixture = create([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
    expect(rows(fixture.nativeElement)).toHaveLength(0);
  });

  it('sets title, description, canonical and hreflang EN/ES/x-default', async () => {
    for (const [locale, prefix] of [
      ['en', ''],
      ['es', '/es'],
    ] as const) {
      const fixture = create(base, locale);
      await fixture.whenStable();
      expect(document.title).toContain('Grim Dawn Builds');
      expect(
        document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
      ).toContain('6');
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        `https://example.test${prefix}/maestrias`,
      );
      const hreflang = Object.fromEntries(
        [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [
          l.getAttribute('hreflang'),
          l.getAttribute('href'),
        ]),
      );
      expect(hreflang).toEqual({
        en: 'https://example.test/maestrias',
        es: 'https://example.test/es/maestrias',
        'x-default': 'https://example.test/maestrias',
      });
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'index,follow',
      );
      TestBed.resetTestingModule();
    }
  });
});
