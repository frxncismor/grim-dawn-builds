import { LOCALE_ID, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import { afterEach, describe, expect, it } from 'vitest';
import demolitionRaw from '../../../../../../fixtures/content/mastery-trees/demolition.json';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { MasteryPage } from './mastery.page';

const tree: MasteryTree = MasteryTreeSchema.parse({
  ...demolitionRaw,
  mastery: { ...demolitionRaw.mastery, name: { en: 'Demolitionist', es: 'Demoledor' } },
});

describe('mastery page', () => {
  afterEach(() => TestBed.resetTestingModule());

  function create(mastery: MasteryTree | null, locale = 'en', response?: { status?: number }) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: locale },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { mastery }, paramMap: convertToParamMap({}) } },
        },
        ...(response ? [{ provide: RESPONSE_INIT, useValue: response }] : []),
      ],
    });
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
      expect(document.title).toContain('Grim Dawn Builds');
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
});
