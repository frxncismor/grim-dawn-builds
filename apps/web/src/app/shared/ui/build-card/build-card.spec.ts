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
    { name: 'Chamán', portrait: portrait('assets/portraits/shaman.png') },
    { name: 'Demoledor', portrait: portrait('assets/portraits/demolition.png') },
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
  masteries: [
    { name: 'Arcanista', portrait: null },
    { name: 'Berserker', portrait: null },
  ],
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

  it('is a single link whose accessible name carries the combination and the status', async () => {
    const el = await render(guide);
    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const name = links[0]!.getAttribute('aria-label') ?? '';
    expect(name).toContain('Chamán + Demoledor: Golpe Primigenio');
    expect(name).toContain('Unverified');
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
      masteries: [{ name: 'Chamán', portrait: null }, guide.masteries[1]!],
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
    expect(el.querySelector('a')?.getAttribute('aria-label')).toContain(title);
    expect(el.textContent).toContain(title);
  });

  it('declares the 44 px target, the wrapping of long names and a visible focus in its styles', () => {
    const css = readFileSync(resolve(__dirname, 'build-card.css'), 'utf8');
    expect(css).toMatch(/min-block-size:\s*44px/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/position:\s*absolute/);
  });
});
