import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALE_ID, RESPONSE_INIT, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import { afterEach, describe, expect, it } from 'vitest';
import demolitionRaw from '../../../../../../fixtures/content/mastery-trees/demolition.json';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { MASTERY_SWITCHER_STATE, type MasterySummary } from '../../core/content/masteries';
import { MasteryPage } from './mastery.page';

const tree: MasteryTree = MasteryTreeSchema.parse({
  ...demolitionRaw,
  mastery: { ...demolitionRaw.mastery, name: { en: 'Demolitionist', es: 'Demoledor' } },
});

describe('mastery page', () => {
  afterEach(() => TestBed.resetTestingModule());

  const summaries: readonly MasterySummary[] = [
    { slug: 'demolition', name: { en: 'Demolitionist', es: 'Demoledor' }, nodeCount: 30 },
    { slug: 'zz-from-catalog', name: { en: 'Catalog Only', es: 'Solo Catálogo' }, nodeCount: 12 },
    { slug: 'empty-one', name: { en: 'Empty', es: 'Vacía' }, nodeCount: 0 },
  ] as unknown as readonly MasterySummary[];

  function create(
    mastery: MasteryTree | null,
    locale = 'en',
    response?: { status?: number },
    masteries: readonly MasterySummary[] | null = summaries,
  ) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: locale },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mastery, ...(masteries ? { masteries } : {}) },
              paramMap: convertToParamMap({}),
            },
          },
        },
        ...(response ? [{ provide: RESPONSE_INIT, useValue: response }] : []),
      ],
    });
    if (masteries) TestBed.inject(TransferState).set(MASTERY_SWITCHER_STATE, masteries);
    return TestBed.createComponent(MasteryPage);
  }

  it('shows the English name at / and every node of the tree in the DOM', async () => {
    const fixture = create(tree);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Demolitionist');
    expect(root.querySelectorAll('[data-skill-id]')).toHaveLength(tree.nodes.length);
    expect(root.querySelector('gd-skill-tree')).not.toBeNull();
    expect(root.textContent).toContain(String(tree.nodes.length));
  });

  it('shows the Spanish name under /es', async () => {
    const fixture = create(tree, 'es');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('Demoledor');
  });

  it('sets title, description, canonical and hreflang EN/ES/x-default', async () => {
    for (const [locale, prefix, name] of [
      ['en', '', 'Demolitionist'],
      ['es', '/es', 'Demoledor'],
    ] as const) {
      const fixture = create(tree, locale);
      await fixture.whenStable();
      expect(document.title).toContain(name);
      expect(document.title).toContain('Grim Builds');
      expect(
        document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
      ).toContain(name);
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        `https://example.test${prefix}/maestrias/demolition`,
      );
      const hreflang = Object.fromEntries(
        [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [
          l.getAttribute('hreflang'),
          l.getAttribute('href'),
        ]),
      );
      expect(hreflang).toEqual({
        en: 'https://example.test/maestrias/demolition',
        es: 'https://example.test/es/maestrias/demolition',
        'x-default': 'https://example.test/maestrias/demolition',
      });
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'index,follow',
      );
      TestBed.resetTestingModule();
    }
  });

  it('renders the not-found page with status 404 and noindex when the mastery does not exist', async () => {
    const response: { status?: number } = {};
    const fixture = create(null, 'en', response);
    await fixture.whenStable();
    expect(response.status).toBe(404);
    expect(fixture.nativeElement.querySelector('[data-not-found]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('gd-skill-tree')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex,follow',
    );
  });

  describe('mastery selector (spec004 T033)', () => {
    const links = (root: HTMLElement) =>
      Array.from(root.querySelectorAll<HTMLAnchorElement>('nav[data-mastery-switcher] a'));

    it('links to every mastery of the catalog, not to a hand-written list', async () => {
      const fixture = create(tree);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      expect(links(root).map((a) => a.getAttribute('href'))).toEqual([
        '/maestrias/demolition',
        '/maestrias/zz-from-catalog',
      ]);
      // A mastery without data is listed but not linked, as in the index.
      expect(root.querySelector('nav[data-mastery-switcher]')!.textContent).toContain('Empty');
      expect(root.querySelector('nav[data-mastery-switcher] a[href$="empty-one"]')).toBeNull();
    });

    it('is a labelled navigation, placed before the tree', async () => {
      const fixture = create(tree);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const nav = root.querySelector('nav[data-mastery-switcher]')!;
      expect(nav.getAttribute('aria-label') ?? nav.getAttribute('aria-labelledby')).toBeTruthy();
      const tree_ = root.querySelector('gd-skill-tree')!;
      expect(nav.compareDocumentPosition(tree_) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('marks the current mastery with aria-current and a non-colour cue', async () => {
      const fixture = create(tree);
      await fixture.whenStable();
      const current = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'nav[data-mastery-switcher] [aria-current="page"]',
      );
      expect(current).toHaveLength(1);
      expect(current[0].textContent).toContain('Demolitionist');
      expect(current[0].hasAttribute('data-current')).toBe(true);
    });

    it('names the masteries in the active language', async () => {
      const fixture = create(tree, 'es');
      await fixture.whenStable();
      const text = (fixture.nativeElement as HTMLElement).querySelector(
        'nav[data-mastery-switcher]',
      )!.textContent;
      expect(text).toContain('Solo Catálogo');
      expect(text).not.toContain('Catalog Only');
    });

    it('renders without the selector, and without errors, when the catalog gave no list', async () => {
      const fixture = create(tree, 'en', undefined, null);
      await fixture.whenStable();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('nav[data-mastery-switcher]'),
      ).toBeNull();
      expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
    });
  });

  it('opts every document into view transitions in CSS only, off for reduced motion (FR-025, Q15 = A)', () => {
    const css = readFileSync(resolve('src/styles/base.css'), 'utf8');
    expect(css).toMatch(/@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/@view-transition\s*\{\s*navigation:\s*none;?\s*\}/);
  });
});
