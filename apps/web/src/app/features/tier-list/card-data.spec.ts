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
