import { LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { BuildSummary, type BuildSummaryContent } from './build-summary';

const base: BuildSummaryContent = {
  slug: 'guia-de-muestra',
  title: 'Guía de muestra',
  masteries: [
    { slug: 'chaman', name_es: 'Chamán', name_en: 'Shaman', role_text: 'Rol de muestra' },
    { slug: 'maestria-rara', name_es: 'Rara', name_en: 'Rare', role_text: 'Otra' },
  ],
  damage_types: ['fisico', 'rayo'],
  author: {
    slug: 'ana-forjadora',
    display_name: 'Ana la Forjadora',
    bio: 'Autora ficticia.',
    url: null,
  },
  sources: [
    {
      slug: 'foro-de-muestra',
      kind: 'comunidad',
      title: 'Hilo de muestra',
      url: 'https://foro.example.com/hilo',
      author_name: 'Forjadora',
      license_note: 'Permiso de muestra.',
      retrieved_on: '2026-02-03',
    },
    {
      slug: 'otra',
      kind: 'oficial',
      title: 'Otra fuente',
      url: null,
      author_name: 'Equipo',
      license_note: 'Nota.',
      retrieved_on: '2026-01-02',
    },
  ],
  game_version: '1.2.0.5',
  review_state: 'publicado',
  content_status: 'verificado',
  published_at: '2026-03-05',
  sections_meta: [{ section_key: 'resumen', position: 1, visible: true }],
};

async function render(value: BuildSummaryContent = base, placeholder = false, locale = 'en-US') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildSummary],
    providers: [
      provideRouter([]),
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: LOCALE_ID, useValue: locale },
    ],
  });
  const fixture = TestBed.createComponent(BuildSummary);
  fixture.componentRef.setInput('content', value);
  fixture.componentRef.setInput('authorPlaceholder', placeholder);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('gd-build-summary (spec004 T020)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('is one labelled block with a heading', async () => {
    const root = await render();
    const block = root.querySelector('section[data-build-summary]')!;
    expect(block).not.toBeNull();
    const heading = block.querySelector('h2')!;
    expect(heading.textContent?.trim()).not.toBe('');
    expect(block.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('shows every mastery with its portrait at the reserved size, and an own fallback', async () => {
    const root = await render();
    const items = root.querySelectorAll('[data-summary-mastery]');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Chamán');
    expect(items[0].textContent).toContain('Shaman');
    const first = items[0].querySelector('img')!;
    expect(first.getAttribute('src')).toBe('assets/icons/mastery-chaman.svg');
    expect([first.getAttribute('width'), first.getAttribute('height')]).toEqual(['32', '32']);
    expect(first.getAttribute('alt')).toBe('');
    expect(items[1].querySelector('img')!.getAttribute('src')).toBe(
      'assets/icons/mastery-generic.svg',
    );
  });

  it('shows the damage types as localized text', async () => {
    const root = await render();
    const damage = root.querySelector('[data-summary-damage]')!.textContent!;
    expect(damage).toContain('Physical');
    expect(damage).toContain('Lightning');
    expect(damage).not.toContain('fisico');
  });

  it('omits the damage row when the guide has none', async () => {
    const root = await render({ ...base, damage_types: [] });
    expect(root.querySelector('[data-summary-damage]')).toBeNull();
  });

  it.each([
    ['borrador', 'Draft'],
    ['en_revision', 'In review'],
    ['publicado', 'Published'],
  ] as const)('shows the review state %s as text', async (review_state, label) => {
    const root = await render({ ...base, review_state });
    const badge = root.querySelector('[data-review-state]')!;
    expect(badge.getAttribute('data-review-state')).toBe(review_state);
    expect(badge.textContent?.trim()).toBe(label);
  });

  it.each([
    ['verificado', 'Verified'],
    ['sin_verificar', 'Unverified'],
    ['placeholder', 'Placeholder'],
  ] as const)('shows the content status %s as text', async (content_status, label) => {
    const root = await render({ ...base, content_status });
    const badge = root.querySelector('[data-content-status]')!;
    expect(badge.getAttribute('data-content-status')).toBe(content_status);
    expect(badge.textContent?.trim()).toBe(label);
  });

  it('labels both badges with text, not only with their shape', async () => {
    const root = await render();
    expect(root.textContent).toContain('Review state');
    expect(root.textContent).toContain('Content status');
    for (const sel of ['[data-review-state]', '[data-content-status]'])
      expect(root.querySelector(sel)!.classList.contains('badge')).toBe(true);
  });

  it('links a confirmed author and keeps an unconfirmed one as text with a badge', async () => {
    const root = await render();
    const link = root.querySelector<HTMLAnchorElement>('[data-author-link]')!;
    expect(link.getAttribute('href')).toBe('/autores/ana-forjadora');
    expect(link.textContent?.trim()).toBe('Ana la Forjadora');
    const pending = await render(base, true);
    expect(pending.querySelector('[data-author-link]')).toBeNull();
    expect(pending.querySelector('[data-author-name]')!.textContent).toContain('Ana la Forjadora');
    expect(pending.querySelector('[data-author-placeholder]')!.textContent).toContain(
      'Author to be confirmed',
    );
    const reserved = await render({ ...base, author: { ...base.author, slug: 'por-confirmar' } });
    expect(reserved.querySelector('[data-author-link]')).toBeNull();
  });

  it('shows the game version and the publication date in UTC, in English and Spanish', async () => {
    const root = await render();
    expect(root.querySelector('[data-game-version]')!.textContent?.trim()).toBe('1.2.0.5');
    expect(root.querySelector('[data-published]')!.textContent).toContain('March 5, 2026');
    const es = await render(base, false, 'es');
    expect(es.querySelector('[data-published]')!.textContent).toContain('5 de marzo de 2026');
    const undated = await render({ ...base, published_at: null });
    expect(undated.querySelector('[data-published]')!.textContent?.trim()).toBe('No date');
    const bad = await render({ ...base, published_at: 'not-a-date' });
    expect(bad.querySelector('[data-published]')!.textContent).toContain('not-a-date');
  });

  it('names the sources and points to the full attribution section', async () => {
    const root = await render();
    const source = root.querySelector('[data-summary-source]')!.textContent!;
    expect(source).toContain('Hilo de muestra');
    expect(source).toContain('+1');
    const link = root.querySelector<HTMLAnchorElement>('[data-summary-attribution] a')!;
    expect(link.getAttribute('href')).toMatch(/#fuentes$/);
    const none = await render({ ...base, sources: [] });
    expect(none.querySelector('[data-summary-source]')!.textContent).toContain(
      'No sources recorded',
    );
  });

  it('shows the unconfirmed version in the UI language and a real one untouched (T042)', async () => {
    const root = await render({ ...base, game_version: 'Sin confirmar' });
    expect(root.querySelector('[data-game-version]')!.textContent?.trim()).toBe(
      'Version unconfirmed',
    );
  });

  it('renders hostile text as text and no event handlers', async () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const root = await render({
      ...base,
      author: { ...base.author, display_name: hostile },
      game_version: hostile,
      sources: [{ ...base.sources[0], title: hostile }],
    });
    expect(root.textContent).toContain(hostile);
    expect(root.querySelector('img[src="x"]')).toBeNull();
    expect(root.querySelector('script')).toBeNull();
    for (const el of Array.from(root.querySelectorAll('*')))
      for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('on')).toBe(false);
  });

  it('is hidden when the guide hides its summary section', async () => {
    const root = await render({
      ...base,
      sections_meta: [{ section_key: 'resumen', position: 1, visible: false }],
    });
    expect(root.querySelector('[data-build-summary]')).toBeNull();
  });
});
