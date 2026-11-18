import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { BuildCard } from './build-card';
import { buildCardData } from './build-card.labels';
import type { BuildCardInput as BuildCardData } from './build-card.model';
import { homeBuilds } from '../../../features/home/home-builds';
import { catalogCardContext, catalogCardInput } from '../../../features/tier-list/card-data';
import {
  buildCatalog,
  type CatalogCard,
  type CatalogInput,
} from '../../../features/tier-list/catalog.model';
import {
  entry as ownEntry,
  input as catalogInput,
} from '../../../features/tier-list/catalog.test-data';

const portrait = (src: string, width = 197, height = 41) => ({ src, width, height });

const guide: BuildCardData = {
  key: 'guia-a',
  variant: 'standard',
  title: 'Chamán + Demoledor: Golpe Primigenio',
  masteries: [
    { portrait: portrait('assets/portraits/shaman.png') },
    { portrait: portrait('assets/portraits/demolition.png') },
  ],
  status: 'sin_verificar',
  reviewState: 'publicado',
  damage: ['Fuego', 'Físico'],
  author: 'Grim Builds',
  gameVersion: '1.3.x',
  href: ['/builds', 'chaman-demoledor-golpe-primigenio'],
  tierLabel: null,
};

const noGuide: BuildCardData = {
  key: 'sin-guia-a',
  variant: 'compact',
  title: 'Arcanista + Berserker',
  masteries: [{ portrait: null }, { portrait: null }],
  status: 'placeholder',
  reviewState: null,
  damage: [],
  author: null,
  gameVersion: '1.3.x',
  href: null,
  tierLabel: 'Tier S',
};

async function render(data: BuildCardData) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(BuildCard);
  fixture.componentRef.setInput('data', buildCardData(data));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('gd-build-card (spec004 T015)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('is a single link whose accessible name carries the title, the combination and the status', async () => {
    const el = await render({ ...guide, combination: 'Chamán + Demoledor' });
    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.hasAttribute('aria-label')).toBe(false);
    expect(links[0]!.hasAttribute('lang')).toBe(false);
    const name = links[0]!.textContent ?? '';
    expect(name).toContain('Chamán + Demoledor: Golpe Primigenio');
    expect(name).toContain('. Chamán + Demoledor');
    expect(name).toContain('. Unverified');
    expect(links[0]!.getAttribute('href')).toBe('/builds/chaman-demoledor-golpe-primigenio');
  });

  it('shows two portraits with real width/height and an empty alt', async () => {
    const imgs = [...(await render(guide)).querySelectorAll('img')];
    expect(imgs).toHaveLength(2);
    for (const img of imgs) {
      expect(img.getAttribute('width')).toBe('197');
      expect(img.getAttribute('height')).toBe('41');
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('uses an own fallback of reserved size when a portrait is missing', async () => {
    const el = await render({
      ...guide,
      masteries: [{ portrait: null }, guide.masteries[1]!],
    });
    const first = el.querySelector('img')!;
    expect(first.getAttribute('src')).toContain('assets/icons/mastery-generic.svg');
    expect(first.getAttribute('width')).toBe('32');
    expect(first.getAttribute('height')).toBe('32');
  });

  it('states content status and review by text, with the shape carried by data-status', async () => {
    const el = await render(guide);
    expect(el.querySelector('[data-status]')?.getAttribute('data-status')).toBe('sin_verificar');
    expect(el.textContent).toContain('Unverified');
    expect(el.textContent).toContain('Published');
  });

  it('shows damage, author and game version in the standard variant', async () => {
    const text = (await render(guide)).textContent ?? '';
    for (const part of ['Fuego', 'Físico', 'Grim Builds', '1.3.x']) expect(text).toContain(part);
  });

  it('a placeholder has no link, says "No guide" and never shows a tier or a recommendation', async () => {
    const el = await render(noGuide);
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('No guide');
    expect(el.textContent).not.toMatch(/tier/i);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-variant="compact"]')).not.toBeNull();
  });

  it('shows a documented tier only on a real build', async () => {
    const withTier = await render({ ...guide, tierLabel: 'Tier A' });
    expect(withTier.textContent).toContain('Tier A');
    TestBed.resetTestingModule();
    const ranked = await render({ ...noGuide, tierLabel: 'Tier S' });
    expect(ranked.textContent).not.toContain('Tier S');
  });

  it('never nests a card in a card and never repeats the card pattern inside', async () => {
    for (const data of [guide, { ...guide, variant: 'featured' as const }, noGuide]) {
      TestBed.resetTestingModule();
      const el = await render(data);
      expect(el.querySelectorAll('.build-card')).toHaveLength(1);
      expect(el.querySelectorAll('article')).toHaveLength(1);
      expect(el.querySelector('article article, article .build-card .build-card')).toBeNull();
    }
  });

  it('has featured, standard and compact variants', async () => {
    for (const variant of ['featured', 'standard', 'compact'] as const) {
      TestBed.resetTestingModule();
      const el = await render({ ...guide, variant });
      expect(el.querySelector(`[data-variant="${variant}"]`)).not.toBeNull();
    }
  });

  it('keeps a very long name complete in the accessible name and in the text', async () => {
    const title = 'Arcanista de la Tormenta Primigenia + Berserker de la Hoja de la Noche '
      .repeat(3)
      .trim();
    const el = await render({ ...guide, title });
    expect(el.querySelector('a')?.textContent).toContain(title);
    expect(el.textContent).toContain(title);
  });

  it('declares the 44 px target, the wrapping of long names and a visible focus in its styles', () => {
    const css = readFileSync(resolve(__dirname, '../../../../styles/build-card.css'), 'utf8');
    expect(css).toMatch(/min-block-size:\s*44px/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/position:\s*absolute/);
  });
});

describe('spec004 T052: combination name and language-safe accessible name', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws the combination under an editorial title and keeps it out of the heading link text twice', async () => {
    const el = await render({ ...guide, combination: 'Shaman + Demolitionist', titleLang: 'es' });
    expect(el.querySelector('.build-card__combination')?.textContent).toBe(
      'Shaman + Demolitionist',
    );
    const link = el.querySelector('a')!;
    expect(link.hasAttribute('lang')).toBe(false);
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(link.textContent).toContain('. Shaman + Demolitionist. Unverified');
  });

  it('puts lang only on the title span, never on the hidden UI-language text', async () => {
    const el = await render({ ...guide, titleLang: 'es', combination: 'Shaman + Demolitionist' });
    const langs = [...el.querySelectorAll('[lang]')];
    expect(langs).toHaveLength(1);
    expect(langs[0]!.textContent).toBe(guide.title);
    expect(el.querySelector('.build-card__sr')?.hasAttribute('lang')).toBe(false);
  });

  it('spec005 T040 (T052 vs F-002): a content-language combination is described, not part of the link name', async () => {
    const el = await render({
      ...guide,
      title: 'Chamán + Demoledor',
      titleLang: undefined,
      combination: 'Guía editorial en español',
      combinationLang: 'es',
    });
    const link = el.querySelector('a')!;
    // The accessible name (link text) carries no foreign text and no lang at all.
    expect(link.querySelector('[lang]')).toBeNull();
    expect(link.hasAttribute('lang')).toBe(false);
    expect(link.textContent).not.toContain('Guía editorial');
    expect(link.textContent).toContain('Unverified');
    // AT still gets it: aria-describedby points at an element with its own lang.
    const id = link.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    const described = el.querySelector(`#${id}`);
    expect(described?.getAttribute('lang')).toBe('es');
    expect(described?.textContent).toContain('Guía editorial en español');
  });

  it('gives every card its own description id, derived from its key', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const idOf = (key: string) => {
      const fixture = TestBed.createComponent(BuildCard);
      fixture.componentRef.setInput(
        'data',
        buildCardData({ ...guide, key, combination: 'A', combinationLang: 'es' }),
      );
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement)
        .querySelector('a')!
        .getAttribute('aria-describedby');
    };
    const [a1, b1] = [idOf('a'), idOf('b')];
    const [b2, a2] = [idOf('b'), idOf('a')];
    expect(a1).toBe('build-card-combination-a');
    expect(b1).toBe('build-card-combination-b');
    expect(a2).toBe(a1);
    expect(b2).toBe(b1);
  });

  it('adds no description when the combination is in the UI language', async () => {
    const el = await render({ ...guide, combination: 'Shaman + Demolitionist' });
    expect(el.querySelector('a')!.hasAttribute('aria-describedby')).toBe(false);
  });

  it('draws no combination line when the title is the combination', async () => {
    const el = await render(guide);
    expect(el.querySelector('.build-card__combination')).toBeNull();
  });

  it('names the new tab on an external link, in the hidden text, without aria-label or lang on it', async () => {
    const el = await render({
      ...guide,
      href: null,
      titleLang: 'es',
      external: { url: 'https://example.invalid/g', author: null, note: null },
    });
    const link = el.querySelector('a')!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(link.hasAttribute('lang')).toBe(false);
    expect(el.querySelector('.build-card__sr')?.textContent).toContain('External source (new tab)');
  });

  it('hidden text is styled as visually hidden', () => {
    const css = readFileSync(resolve(__dirname, '../../../../styles/build-card.css'), 'utf8');
    expect(css).toMatch(/\.build-card__sr\s*\{[^}]*clip-path:\s*inset\(50%\)/);
  });
});

describe('spec004 T042 (b): unconfirmed game version is localized', () => {
  it('replaces the Spanish content value with the UI-language label', () => {
    const data = buildCardData({ ...guide, gameVersion: 'Sin confirmar' });
    expect(data.facts).not.toContain('Sin confirmar');
    expect(data.facts).toContain('Version unconfirmed');
  });

  it('keeps a real game version untouched', () => {
    expect(buildCardData({ ...guide, gameVersion: '1.3.x' }).facts).toContain('1.3.x');
  });
});

describe('spec005 T009 (S4-D3, Q-C = A): the status is announced once', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** Text a screen reader reads: everything but the subtrees hidden with `aria-hidden="true"`. */
  const announced = (node: Node): string =>
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent ?? '')
      : (node as Element).getAttribute?.('aria-hidden') === 'true'
        ? ''
        : [...node.childNodes].map(announced).join(' ');
  const times = (text: string, word: string) => text.split(word).length - 1;

  it('hides the visible status line from assistive technology and keeps it as text', async () => {
    const el = await render({ ...guide, combination: 'Chamán + Demoledor' });
    const status = el.querySelector('.build-card__status')!;
    expect(status.getAttribute('aria-hidden')).toBe('true');
    expect(status.textContent).toContain('Unverified');
    expect(times(announced(el.querySelector('a')!), 'Unverified')).toBe(1);
    expect(times(announced(el.querySelector('article')!), 'Unverified')).toBe(1);
  });

  it('still announces the status of a card with no link', async () => {
    const el = await render(noGuide);
    expect(times(announced(el.querySelector('article')!), 'No guide')).toBe(1);
  });
});

describe('spec006 T003 (L2): a content-language combination only exists on a linked card', () => {
  afterEach(() => TestBed.resetTestingModule());
  // One third-party link and one combination with no guide, next to the own guide.
  const external = {
    ...ownEntry,
    entry_kind: 'enlace_externo',
    display_name: 'Guía externa',
    build_slug: null,
    tier: 'S',
    rights_status: 'link_only',
    external_url: 'https://example.invalid/guia',
    external_author: 'Autor externo',
    combination_slug: 'chaman-arcanista',
  };
  const full = {
    ...catalogInput,
    entries: [...catalogInput.entries, external],
  } as unknown as CatalogInput;

  const inputsOf = (locale: 'en' | 'es'): BuildCardData[] => {
    const snapshot = buildCatalog(full, locale);
    const ctx = catalogCardContext(snapshot);
    const cards: CatalogCard[] = [...snapshot.cards];
    const home = homeBuilds(full, locale);
    return [
      ...cards.map((card) => catalogCardInput(card, ctx)),
      ...(home.featured ? [home.featured] : []),
      ...home.others,
    ];
  };

  it.each(['en', 'es'] as const)(
    'the real adapters (%s) set combinationLang only with a href',
    (locale) => {
      const inputs = inputsOf(locale);
      expect(inputs.some((i) => i.href === null)).toBe(true);
      expect(inputs.some((i) => i.external)).toBe(true);
      for (const i of inputs.filter((x) => x.combinationLang))
        expect(i.href, `${i.key} has a combinationLang`).not.toBeNull();
      // The English page does produce one, so the check above is not vacuous.
      if (locale === 'en') expect(inputs.some((i) => i.combinationLang)).toBe(true);
    },
  );

  it.each(['en', 'es'] as const)('a card with no link draws no srCombination (%s)', (locale) => {
    for (const i of inputsOf(locale).filter((x) => x.href === null)) {
      const data = buildCardData(i);
      expect(data.srCombination ?? null, i.key).toBeNull();
      expect(i.combinationLang ?? null, i.key).toBeNull();
    }
  });
});

describe('spec007 T002 (B-002): buildCardData imposes srCombination only on linked cards', () => {
  afterEach(() => TestBed.resetTestingModule());
  const withCombination: BuildCardData = {
    ...guide,
    title: 'Chamán + Demoledor',
    combination: 'Guía editorial en español',
    combinationLang: 'es',
  };

  it('a card with no link and a combinationLang has no srCombination and exposes the line with its lang', async () => {
    const input: BuildCardData = { ...withCombination, href: null, external: null };
    const data = buildCardData(input);
    expect(data.srCombination ?? null).toBeNull();
    expect(data.srText).not.toContain('Guía editorial');
    const el = await render(input);
    const line = el.querySelector('.build-card__combination')!;
    expect(line.hasAttribute('aria-hidden')).toBe(false);
    expect(line.getAttribute('lang')).toBe('es');
    expect(line.textContent).toContain('Guía editorial en español');
  });

  it('an external card with a URL keeps srCombination and hides the line it describes', async () => {
    const input: BuildCardData = {
      ...withCombination,
      href: null,
      external: { url: 'https://example.invalid/guia', author: null, note: null },
    };
    expect(buildCardData(input).srCombination).toBe('. Guía editorial en español');
    const el = await render(input);
    const line = el.querySelector('.build-card__combination')!;
    expect(line.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('a')!.getAttribute('aria-describedby')).toBe(line.id);
  });

  it('an external card with url null behaves like a card with no link', async () => {
    const input: BuildCardData = {
      ...withCombination,
      href: null,
      external: { url: null, author: null, note: null },
    };
    expect(buildCardData(input).srCombination ?? null).toBeNull();
    const el = await render(input);
    expect(el.querySelector('.build-card__combination')!.hasAttribute('aria-hidden')).toBe(false);
  });

  it('a linked card keeps its srCombination and its hidden line', async () => {
    expect(buildCardData(withCombination).srCombination).toBe('. Guía editorial en español');
    const el = await render(withCombination);
    expect(el.querySelector('.build-card__combination')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('a combination in the UI language keeps its hidden line (it is in srText)', async () => {
    const el = await render({ ...guide, combination: 'Shaman + Demolitionist' });
    expect(el.querySelector('.build-card__combination')!.getAttribute('aria-hidden')).toBe('true');
  });
});
