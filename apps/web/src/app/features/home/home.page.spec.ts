import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, LOCALE_ID, TransferState } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home.page';
import { CATALOG_STATE } from '../../core/content/catalog.resolver';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { input } from '../tier-list/catalog.test-data';
describe('native Home from public server snapshot', () => {
  afterEach(() => TestBed.resetTestingModule());
  const setup = () =>
    TestBed.configureTestingModule({
      providers: [
        { provide: SITE_BASE_URL, useValue: 'https://example.org/project/' },
        provideRouter([]),
      ],
    });
  it('offers the real catalog and editorial criteria when no guide is public', async () => {
    setup();
    TestBed.inject(TransferState).set(CATALOG_STATE, { ...input, guides: [] });
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('h1')).toHaveLength(1);
    expect(f.nativeElement.querySelector('a[href="/tier-list"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('a[href="#criterios"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('#criterios')).not.toBeNull();
    expect(f.nativeElement.textContent).toContain('No guides published yet');
    expect(f.nativeElement.querySelector('a[href^="/builds/"]')).toBeNull();
    expect(f.nativeElement.querySelector('button,input,iframe')).toBeNull();
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.org/project/og/site.png',
    );
  });
  it('features only public title/date/version, never private or guide body metadata', async () => {
    setup();
    TestBed.inject(TransferState).set(CATALOG_STATE, {
      ...input,
      guides: [
        { ...input.guides[0], rights_notes: 'PRIVATE-CANARY', summary: 'PRIVATE-BODY' } as never,
      ],
    });
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    expect(f.nativeElement.querySelector('a[href="/builds/tormenta"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-09');
    expect(f.nativeElement.textContent).toContain('test-version');
    expect(f.nativeElement.innerHTML).not.toContain('PRIVATE-');
    expect(f.nativeElement.textContent).not.toContain('No guides published yet');
  });
  it('shows the latest guide as a featured card and one catalog access per mastery (spec004 T016)', async () => {
    setup();
    TestBed.inject(TransferState).set(CATALOG_STATE, input);
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('[data-variant="featured"]')).toHaveLength(1);
    expect(el.querySelector('[data-variant="featured"] a[href="/builds/tormenta"]')).not.toBeNull();
    for (const slug of ['chaman', 'soldado', 'arcanista'])
      expect(el.querySelector(`a[href="/tier-list?m=${slug}"]`)).not.toBeNull();
    expect(el.querySelector('article article')).toBeNull();
    expect(el.textContent).toMatch(/1 of 2 combinations/);
  });
  it('keeps the mastery accesses and the honest empty state when no guide is public', async () => {
    setup();
    TestBed.inject(TransferState).set(CATALOG_STATE, { ...input, guides: [] });
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    expect(f.nativeElement.querySelector('[data-variant]')).toBeNull();
    expect(f.nativeElement.querySelector('a[href="/tier-list?m=chaman"]')).not.toBeNull();
    expect(f.nativeElement.textContent).toMatch(/2 of 2 combinations/);
  });
  it('fails explicitly without the server snapshot', () => {
    setup();
    expect(() => TestBed.createComponent(HomePage)).toThrow('Falta el catálogo prerenderizado.');
  });
  describe('Crate credit (spec004 T047)', () => {
    const withPortraits = (source: 'game' | 'own') => ({
      ...input,
      masteries: input.masteries.map((m) => ({
        ...m,
        portrait: {
          source,
          src: source === 'game' ? `assets/portraits/${m.slug}.png` : `assets/icons/${m.slug}.svg`,
          width: 197,
          height: 41,
        },
      })),
    });
    const render = async (data: unknown, locale = 'en') => {
      TestBed.configureTestingModule({
        providers: [
          { provide: SITE_BASE_URL, useValue: 'https://example.org/project/' },
          { provide: LOCALE_ID, useValue: locale },
          provideRouter([]),
        ],
      });
      TestBed.inject(TransferState).set(CATALOG_STATE, data as never);
      const f = TestBed.createComponent(HomePage);
      await f.whenStable();
      return f.nativeElement as HTMLElement;
    };
    it('credits Crate and states non-affiliation when a card shows a game portrait, in both languages', async () => {
      for (const locale of ['en', 'es']) {
        const el = await render(withPortraits('game'), locale);
        expect(el.querySelector('img[src^="assets/portraits/"]')).not.toBeNull();
        const credit = el.querySelector('[data-credit]');
        expect(credit?.textContent).toContain('Crate Entertainment');
        expect(credit?.textContent).toContain('Grim Dawn');
        TestBed.resetTestingModule();
      }
    });
    it('shows no credit with own art or with no portrait', async () => {
      expect((await render(withPortraits('own'))).querySelector('[data-credit]')).toBeNull();
      TestBed.resetTestingModule();
      expect((await render(input)).querySelector('[data-credit]')).toBeNull();
    });
  });
});

describe('Home: the date belongs to the featured card (spec004 T049, C-001)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('does not show the date of a newer guide the catalog does not publish', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SITE_BASE_URL, useValue: 'https://example.org/project/' },
        provideRouter([]),
      ],
    });
    // `reciente` is newer and published, but no catalog entry links it: the card is `tormenta`.
    TestBed.inject(TransferState).set(CATALOG_STATE, {
      ...input,
      guides: [
        ...input.guides,
        { ...input.guides[0], slug: 'reciente', title: 'Reciente', published_at: '2026-12-31' },
      ],
    } as never);
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-variant="featured"] a[href="/builds/tormenta"]')).not.toBeNull();
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-09');
    expect(el.textContent).not.toContain('2026-12-31');
  });
  it('shows the featured date in the UI language, with the ISO date in datetime (spec004 T052)', async () => {
    for (const [locale, label] of [
      ['es', '9 de noviembre de 2026'],
      ['en', 'November 9, 2026'],
    ] as const) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: SITE_BASE_URL, useValue: 'https://example.org/project/' },
          { provide: LOCALE_ID, useValue: locale },
          provideRouter([]),
        ],
      });
      TestBed.inject(TransferState).set(CATALOG_STATE, input as never);
      const f = TestBed.createComponent(HomePage);
      await f.whenStable();
      const time: HTMLElement = f.nativeElement.querySelector('time');
      expect(time.getAttribute('datetime')).toBe('2026-11-09');
      expect(time.textContent).toBe(label);
    }
  });
});

describe('Home: the list key is the destination (spec005 T010, S4-D4)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('keeps both cards when two guides share a title but not a destination', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SITE_BASE_URL, useValue: 'https://example.org/project/' },
        provideRouter([]),
      ],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const guide = (slug: string, published_at: string) => ({
      ...input.guides[0],
      slug,
      title: 'Misma tormenta',
      published_at,
    });
    const entryOf = (combination_slug: string, build_slug: string) => ({
      ...input.entries[0],
      combination_slug,
      build_slug,
      display_name: 'Misma tormenta',
    });
    TestBed.inject(TransferState).set(CATALOG_STATE, {
      ...input,
      combinations: [
        ...input.combinations,
        { slug: 'soldado-arcanista', mastery_a_slug: 'soldado', mastery_b_slug: 'arcanista' },
      ],
      entries: [
        entryOf('chaman-soldado', 'uno'),
        entryOf('chaman-arcanista', 'dos'),
        entryOf('soldado-arcanista', 'tres'),
      ],
      guides: [guide('uno', '2026-11-09'), guide('dos', '2026-11-08'), guide('tres', '2026-11-07')],
    } as never);
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-variant="featured"] a[href="/builds/uno"]')).not.toBeNull();
    expect(el.querySelectorAll('.builds__list a[href="/builds/dos"]')).toHaveLength(1);
    expect(el.querySelectorAll('.builds__list a[href="/builds/tres"]')).toHaveLength(1);
    // The key is only checked when the list is reconciled again: swap the two cards in place.
    const page = f.componentInstance as unknown as { otherCards: readonly unknown[] };
    page.otherCards = [...page.otherCards].reverse();
    f.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    f.detectChanges();
    const hrefs = [...el.querySelectorAll('.builds__list a[href^="/builds/"]')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/builds/tres', '/builds/dos']);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('NG0955');
  });
});
