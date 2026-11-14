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

const game = (slug: string) => ({
  source: 'game' as const,
  src: `assets/portraits/${slug}.png`,
  width: 197,
  height: 41,
});
const OWN_SRC: Record<string, string> = {
  arcanist: 'arcanista',
  demolition: 'demoledor',
  nightblade: 'filo-nocturno',
  occult: 'ocultista',
  shaman: 'chaman',
  soldier: 'soldado',
};
const own = (slug: string) => ({
  source: 'own' as const,
  src: `assets/icons/mastery-${OWN_SRC[slug]}.svg`,
  width: 32,
  height: 32,
});

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

  describe('portraits (T015)', () => {
    const art = (row: HTMLElement) => row.querySelector<HTMLImageElement>('img[data-portrait]');

    it('with ASSET_SOURCE=game shows the 197x41 button of each mastery, decorative and unstretched', async () => {
      const fixture = create(base.map((m) => ({ ...m, portrait: game(m.slug) })));
      await fixture.whenStable();
      const list = rows(fixture.nativeElement);
      expect(list).toHaveLength(6);
      list.forEach((row, i) => {
        const img = art(row)!;
        expect(img.getAttribute('src')).toBe(`assets/portraits/${base[i]!.slug}.png`);
        expect(img.getAttribute('width')).toBe('197');
        expect(img.getAttribute('height')).toBe('41');
        expect(img.getAttribute('alt')).toBe('');
        expect(img.getAttribute('decoding')).toBe('async');
        expect(row.dataset['portrait']).toBe('game');
      });
      expect(art(list[0]!)!.getAttribute('loading')).toBeNull();
      expect(art(list[5]!)!.getAttribute('loading')).toBe('lazy');
    });

    it('with ASSET_SOURCE=own shows the own icon in the six rows and no attribution', async () => {
      const fixture = create(base.map((m) => ({ ...m, portrait: own(m.slug) })));
      await fixture.whenStable();
      const list = rows(fixture.nativeElement);
      list.forEach((row, i) => {
        expect(art(row)!.getAttribute('src')).toBe(own(base[i]!.slug).src);
        expect(art(row)!.getAttribute('width')).toBe('32');
        expect(row.dataset['portrait']).toBe('own');
      });
      expect(fixture.nativeElement.querySelector('[data-credit]')).toBeNull();
    });

    it('falls back to the own icon when a summary carries no portrait', async () => {
      const fixture = create(base);
      await fixture.whenStable();
      const list = rows(fixture.nativeElement);
      expect(list.map((row) => art(row)!.getAttribute('src'))).toEqual(
        base.map((m) => own(m.slug).src),
      );
    });

    it('credits Crate and states non-affiliation whenever game art is shown, in both languages', async () => {
      for (const [locale, word] of [
        ['en', 'Crate Entertainment'],
        ['es', 'Crate Entertainment'],
      ] as const) {
        const fixture = create(
          base.map((m) => ({ ...m, portrait: game(m.slug) })),
          locale,
        );
        await fixture.whenStable();
        const credit = fixture.nativeElement.querySelector('[data-credit]') as HTMLElement;
        expect(credit.textContent).toContain(word);
        expect(credit.textContent).toContain('Grim Dawn');
        TestBed.resetTestingModule();
      }
    });

    it('keeps the accessible name of the link equal to the mastery name', async () => {
      const fixture = create(base.map((m) => ({ ...m, portrait: game(m.slug) })));
      await fixture.whenStable();
      expect(rows(fixture.nativeElement).map(linkText)).toEqual(base.map((m) => m.name!.en));
    });
  });
});
