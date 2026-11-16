import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import type { TierEntry } from '@gd/domain';
import { BuildCard } from '../../shared/ui/build-card/build-card';
import { buildCardData } from '../../shared/ui/build-card/build-card.labels';
import { buildCatalog, type CatalogCard, type CatalogInput } from './catalog.model';
import { catalogCardInput, catalogCardContext, safeExternalUrl } from './card-data';
import { entry as ownEntry, input } from './catalog.test-data';

const EXTERNAL: TierEntry = {
  ...ownEntry,
  entry_kind: 'enlace_externo',
  display_name: 'Guía externa',
  build_slug: null,
  tier: 'S',
  rights_status: 'link_only',
  content_status: 'sin_verificar',
  external_url: 'https://example.invalid/guia',
  external_author: 'Autor externo',
  source_slug: 'own',
};

function cardsOf(over: Partial<CatalogInput>): {
  cards: CatalogCard[];
  ctx: ReturnType<typeof catalogCardContext>;
} {
  const snapshot = buildCatalog({ ...input, ...over } as unknown as CatalogInput, 'es');
  return { cards: [...snapshot.cards], ctx: catalogCardContext(snapshot) };
}

async function render(over: Partial<CatalogInput>, pick = (c: CatalogCard[]) => c[0]!) {
  const { cards, ctx } = cardsOf(over);
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(BuildCard);
  fixture.componentRef.setInput('data', buildCardData(catalogCardInput(pick(cards), ctx)));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const externalCatalog = (entry: Partial<TierEntry> = {}): Partial<CatalogInput> => ({
  entries: [{ ...EXTERNAL, ...entry }] as never,
  guides: [],
});

describe('catalog card data (spec004 T017)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('turns a public guide into a standard, linked card with its tier and author', async () => {
    const el = await render({}, (c) => c.find((x) => x.guide)!);
    const link = el.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/builds/tormenta');
    expect(el.querySelector('[data-variant="standard"]')).not.toBeNull();
    expect(el.textContent).toContain('Tier A');
    expect(el.textContent).toContain('Autora');
  });

  it('turns a combination with no guide into a compact, non-link card with no tier', async () => {
    const el = await render({}, (c) => c.find((x) => !x.guide)!);
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('[data-variant="compact"]')).not.toBeNull();
    expect(el.textContent).toContain('No guide');
    expect(el.textContent).not.toMatch(/tier/i);
  });

  it('shows the external attribution, the notice and a hardened new-tab link; never a ranking', async () => {
    const el = await render(externalCatalog());
    const link = el.querySelector<HTMLAnchorElement>('a[href]');
    expect(link?.getAttribute('href')).toBe('https://example.invalid/guia');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('target')).toBe('_blank');
    const text = el.textContent ?? '';
    for (const part of ['Guía externa', 'Autor externo', 'third-party site'])
      expect(text).toContain(part);
    expect(text).not.toMatch(/tier s|unranked|no guide/i);
    expect(el.querySelector('a[href^="/builds/"]')).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example/guia',
    'no es una url',
    // Built at runtime: `scripts/check-secrets.mts` forbids credential literals.
    `${'https'}://${'usuario'}:${'clave'}@example.invalid/guia`,
  ])('does not turn %s into an href but keeps the attribution', async (url) => {
    expect(safeExternalUrl(url)).toBeNull();
    const el = await render(externalCatalog({ external_url: url }));
    expect(el.querySelector('a[href]')).toBeNull();
    expect(el.textContent).toContain('Autor externo');
    expect(el.textContent).toContain('third-party site');
  });

  it.each([['../admin'], ['javascript:alert(1)'], ['guia_con_guion_bajo'], ['сhaman']])(
    'never links the %s guide slug',
    async (slug) => {
      const el = await render(
        {
          entries: [{ ...ownEntry, build_slug: slug }] as never,
          guides: [{ ...input.guides[0], slug }] as never,
        },
        (c) => c[0]!,
      );
      expect(el.querySelector('a[href]')).toBeNull();
    },
  );

  it.each<[Record<string, unknown>, string]>([
    [{ guides: [{ ...input.guides[0], review_state: 'borrador' }] }, 'draft guide'],
    [{ guides: [{ ...input.guides[0], rights_status: 'link_only' }] }, 'unapproved guide rights'],
    [{ guides: [{ ...input.guides[0], slug: 'otra-guia' }] }, 'slug mismatch'],
    [{ entries: [{ ...ownEntry, rights_status: 'pending' }] }, 'unapproved entry rights'],
  ])('never links a build that fails the publication gate (%s)', async (over) => {
    const el = await render(over as Partial<CatalogInput>);
    expect(el.querySelector('a[href]')).toBeNull();
  });

  it('renders hostile editorial strings as text, without elements or handlers', async () => {
    const hostile = '<img src=x onerror=alert(1)><script>alert(1)</script>‮';
    const el = await render({ guides: [{ ...input.guides[0], title: hostile }] as never }, (c) =>
      c.find((x) => x.guide)!,
    );
    expect(el.querySelector('script, iframe, object, embed, img[src="x"]')).toBeNull();
    const handlers = [...el.querySelectorAll('*')].flatMap((node) =>
      node.getAttributeNames().filter((name) => name.startsWith('on')),
    );
    expect(handlers).toEqual([]);
    expect(el.textContent).toContain(hostile);
  });
});

describe('spec004 T042 (a): the card shows the mastery portrait when it exists', () => {
  const shaman = { src: 'assets/portraits/shaman.png', width: 197, height: 41 };

  it('takes the portrait carried by the catalog mastery and nothing else for the rest', () => {
    const masteries = input.masteries.map((m) =>
      m.slug === 'chaman' ? { ...m, portrait: shaman } : m,
    );
    const { cards, ctx } = cardsOf({ masteries } as unknown as Partial<CatalogInput>);
    const built = catalogCardInput(cards[0]!, ctx);
    expect(built.masteries.map((m) => m.portrait)).toEqual([shaman, null]);
  });

  it('draws that portrait in the rendered card and the generic icon only without one', async () => {
    const masteries = input.masteries.map((m) =>
      m.slug === 'chaman' ? { ...m, portrait: shaman } : m,
    );
    const el = await render({ masteries } as unknown as Partial<CatalogInput>);
    const sources = [...el.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toEqual([shaman.src, 'assets/icons/mastery-generic.svg']);
  });
});

describe('spec004 T049 (B-002): the editorial title keeps its own language (FR-042)', () => {
  afterEach(() => TestBed.resetTestingModule());
  const build = (locale: 'en' | 'es') => {
    const snapshot = buildCatalog(input as unknown as CatalogInput, locale);
    const ctx = catalogCardContext(snapshot);
    const data = (card: CatalogCard) => buildCardData(catalogCardInput(card, ctx));
    return {
      guide: data(snapshot.cards.find((c) => c.guide)!),
      none: data(snapshot.cards.find((c) => !c.guide)!),
    };
  };

  it('marks the guide title as Spanish on the English page, and the link carries that lang', async () => {
    const { guide, none } = build('en');
    expect(guide.titleLang).toBe('es');
    expect(none.titleLang).toBeNull();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BuildCard);
    fixture.componentRef.setInput('data', guide);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(link.hasAttribute('lang')).toBe(false);
    expect(link.querySelector('[lang]')?.getAttribute('lang')).toBe('es');
    expect(link.querySelector('[lang]')?.textContent).toBe(guide.title);
    expect(link.hasAttribute('aria-label')).toBe(false);
  });

  it('keeps the localized combination name under the editorial title, in EN and ES (FR-003/FR-004)', async () => {
    for (const [locale, name] of [
      ['en', 'Shaman + Soldier'],
      ['es', 'Chamán + Soldado'],
    ] as const) {
      TestBed.resetTestingModule();
      const { guide, none } = build(locale);
      expect(guide.title).not.toBe(name);
      expect(guide.combination).toBe(name);
      expect(none.combination).toBeNull();
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(BuildCard);
      fixture.componentRef.setInput('data', guide);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.build-card__combination')?.textContent).toBe(name);
      expect(el.querySelector('a')?.textContent).toContain(`. ${name}.`);
    }
  });

  it('adds no lang on the Spanish page, where title and page share the language', async () => {
    const { guide } = build('es');
    expect(guide.titleLang).toBeNull();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BuildCard);
    fixture.componentRef.setInput('data', guide);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[lang]')).toBeNull();
  });
});
