import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { BuildCard } from './build-card';
import { buildCardData } from './build-card.labels';
import type { BuildCardInput as BuildCardData } from './build-card.model';

const portrait = (src: string, width = 197, height = 41) => ({ src, width, height });

const guide: BuildCardData = {
  variant: 'standard',
  title: 'Chamán + Demoledor: Golpe Primigenio',
  masteries: [
    { portrait: portrait('assets/portraits/shaman.png') },
    { portrait: portrait('assets/portraits/demolition.png') },
  ],
  status: 'sin_verificar',
  reviewState: 'publicado',
  damage: ['Fuego', 'Físico'],
  author: 'Grim Dawn Builds',
  gameVersion: '1.3.x',
  href: ['/builds', 'chaman-demoledor-golpe-primigenio'],
  tierLabel: null,
};

const noGuide: BuildCardData = {
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
    for (const part of ['Fuego', 'Físico', 'Grim Dawn Builds', '1.3.x'])
      expect(text).toContain(part);
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
    const title = 'Arcanista de la Tormenta Primigenia + Berserker del Filo Nocturno '
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
