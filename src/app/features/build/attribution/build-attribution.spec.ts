import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { BuildAttribution, type BuildAttributionContent } from './build-attribution';

const base: BuildAttributionContent = {
  slug: 'guia-de-muestra',
  title: 'Guía de muestra',
  author: {
    slug: 'ana-forjadora',
    display_name: 'Ana la Forjadora',
    bio: 'Autora ficticia de la vista de pruebas.',
    url: null,
  },
  sources: [
    {
      slug: 'foro-de-muestra',
      kind: 'comunidad',
      title: 'Hilo de muestra',
      url: 'https://foro.example.com/hilo?p=1',
      author_name: 'Forjadora',
      license_note: 'Permiso de muestra registrado.',
      retrieved_on: '2026-02-03',
    },
    {
      slug: 'documento-sin-enlace',
      kind: 'oficial',
      title: 'Documento sin enlace utilizable',
      url: 'javascript:alert(1)',
      author_name: 'Equipo de muestra',
      license_note: 'Sin enlace seguro.',
      retrieved_on: '2026-01-02',
    },
  ],
  game_version: '1.2.0.5',
  review_state: 'publicado',
  content_status: 'verificado',
  published_at: '2026-03-05',
  footer_disclaimer: 'Aviso de muestra del pie de página.',
  notes: [
    {
      kind: 'general',
      label: 'Descargo',
      headline: 'Descargo de muestra',
      detail: 'Detalle ficticio del descargo.',
      position: 99,
    },
  ],
  sections_meta: [{ section_key: 'fuentes', position: 10, visible: true }],
};

async function render(
  value: BuildAttributionContent = base,
  authorPlaceholder = false,
  platform = 'browser',
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildAttribution],
    providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: platform }],
  });
  const fixture = TestBed.createComponent(BuildAttribution);
  fixture.componentRef.setInput('content', value);
  fixture.componentRef.setInput('authorPlaceholder', authorPlaceholder);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('gd-build-attribution', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('links a confirmed public author to /autores/:slug without a placeholder badge', async () => {
    const { root } = await render();
    const link = root.querySelector<HTMLAnchorElement>('[data-author-link]');
    expect(link?.getAttribute('href')).toBe('/autores/ana-forjadora');
    expect(link?.textContent?.trim()).toBe('Ana la Forjadora');
    expect(root.querySelector('[data-author-placeholder]')).toBeNull();
    expect(root.querySelector('[data-author-bio]')?.textContent?.trim()).toBe(base.author.bio);
  });

  it('renders a textual placeholder badge and no broken link for a placeholder author', async () => {
    const { root } = await render(base, true);
    expect(root.querySelector('[data-author-link]')).toBeNull();
    expect(root.querySelector('[data-author-name]')?.textContent?.trim()).toBe('Ana la Forjadora');
    const badge = root.querySelector('[data-author-placeholder]');
    expect(badge?.textContent?.trim()).toBe('Autor por confirmar');
    expect(badge?.getAttribute('aria-label')).toBe('Autor por confirmar');
  });

  it('never links the por-confirmar slug, even without the placeholder flag', async () => {
    const { root } = await render({
      ...base,
      author: { ...base.author, slug: 'por-confirmar', bio: null },
    });
    expect(root.querySelector('[data-author-link]')).toBeNull();
    expect(root.querySelector('[data-author-placeholder]')?.textContent).toContain(
      'Autor por confirmar',
    );
    expect(root.querySelector('[data-author-bio]')).toBeNull();
  });

  it.each([
    ['borrador', 'Borrador'],
    ['en_revision', 'En revisión'],
    ['publicado', 'Publicado'],
  ] as const)('shows the review state %s as text', async (review_state, label) => {
    const { root } = await render({ ...base, review_state });
    const badge = root.querySelector('[data-review-state]');
    expect(badge?.getAttribute('data-review-state')).toBe(review_state);
    expect(badge?.textContent?.trim()).toBe(label);
  });

  it.each([
    ['verificado', 'Verificado'],
    ['sin_verificar', 'Sin verificar'],
    ['placeholder', 'Placeholder'],
  ] as const)('shows the content status %s as text', async (content_status, label) => {
    const { root } = await render({ ...base, content_status });
    const badge = root.querySelector('[data-content-status]');
    expect(badge?.getAttribute('data-content-status')).toBe(content_status);
    expect(badge?.textContent?.trim()).toBe(label);
  });

  it('labels both masks with text in addition to their badge shape', async () => {
    const { root } = await render();
    const review = root.querySelector('[data-review-state]');
    const content = root.querySelector('[data-content-status]');
    expect(review?.classList.contains('badge')).toBe(true);
    expect(content?.classList.contains('badge')).toBe(true);
    expect(review?.textContent?.trim()).not.toBe('');
    expect(content?.textContent?.trim()).not.toBe('');
    expect(root.textContent).toContain('Estado de revisión');
    expect(root.textContent).toContain('Estado del contenido');
  });

  it('formats published_at in UTC or shows «Sin fecha» when null', async () => {
    const dated = await render();
    const published = dated.root.querySelector('[data-published]')?.textContent ?? '';
    expect(published).toContain('2026');
    expect(published).toContain('marzo');
    expect(published).not.toContain('Sin fecha');

    const undated = await render({ ...base, published_at: null });
    expect(undated.root.querySelector('[data-published]')?.textContent?.trim()).toBe('Sin fecha');
  });

  it('keeps the received source order and never mutates the array', async () => {
    const reversed = Object.freeze(
      [...base.sources].reverse().map((source) => Object.freeze({ ...source })),
    );
    const value = { ...base, sources: reversed } as BuildAttributionContent;
    const before = JSON.stringify(value.sources);
    const { root } = await render(value);
    const titles = [...root.querySelectorAll<HTMLElement>('[data-source-title]')].map((title) =>
      title.textContent?.trim(),
    );
    expect(titles).toEqual(reversed.map((source) => source.title));
    expect(root.textContent).toContain('Documento sin enlace utilizable');
    expect(root.textContent).toContain('Hilo de muestra');
    expect(JSON.stringify(value.sources)).toBe(before);
  });

  it('links only HTTP(S) URLs without credentials and derives the site from the host', async () => {
    const { root } = await render();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-source-link]')];
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://foro.example.com/hilo?p=1');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].textContent).toContain('Hilo de muestra');
    expect(links[0].textContent).toContain('foro.example.com');
    expect(links[0].textContent).toMatch(/pestaña nueva/i);
    const invalidSource = root.querySelector('[data-source="documento-sin-enlace"]');
    expect(invalidSource?.querySelector('[data-source-link]')).toBeNull();
    expect(invalidSource?.textContent).toContain('Documento sin enlace utilizable');
  });

  it.each([
    'no es una url',
    'javascript:alert(1)',
    'data:text/html,prueba',
    // Built at runtime on purpose: this must be an invalid URL for the rejection
    // test, not a credential. Writing it literally would trip scripts/check-secrets.mts.
    `https://${'usuario'}:${'clave'}@example.com/guia`,
    'http://usuario@example.com/guia',
    'ftp://example.com/guia',
  ])('renders %s as text without a link', async (url) => {
    const { root } = await render({
      ...base,
      sources: [{ ...base.sources[0], url }],
    });
    expect(root.querySelector('[data-source-link]')).toBeNull();
    expect(root.querySelector('[data-source]')?.textContent).toContain('Hilo de muestra');
  });

  it.each([
    ['original', 'Original'],
    ['comunidad', 'Comunidad'],
    ['oficial', 'Oficial'],
    ['video', 'Video'],
    ['externa_enlace', 'Enlace externo'],
  ] as const)('localizes the source kind %s', async (kind, label) => {
    const { root } = await render({ ...base, sources: [{ ...base.sources[0], kind }] });
    expect(root.querySelector('[data-source-kind]')?.textContent?.trim()).toBe(label);
  });

  it('renders the Descargo note once and suppresses the footer fallback', async () => {
    const { root } = await render();
    const blocks = root.querySelectorAll('[data-disclaimer]');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].textContent).toContain('Descargo de muestra');
    expect(blocks[0].textContent).toContain('Detalle ficticio del descargo.');
    expect(root.textContent).not.toContain('Aviso de muestra del pie de página.');
    expect(root.querySelectorAll('h3')).toHaveLength(2);
  });

  it('falls back once to footer_disclaimer when the guide has no Descargo note', async () => {
    const { root } = await render({ ...base, notes: [] });
    const blocks = root.querySelectorAll('[data-disclaimer]');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].textContent).toContain('Aviso de muestra del pie de página.');
    expect(blocks[0].textContent).toContain('Descargo');
  });

  it('ignores notes already consumed by other sections and non-Descargo notes', async () => {
    const { root } = await render({
      ...base,
      notes: [
        {
          kind: 'general',
          label: 'Orden real de compra',
          headline: 'Consumida',
          detail: 'x',
          position: 1,
        },
        { kind: 'general', label: 'Descargo del foro', headline: 'Otra', detail: 'y', position: 2 },
        { ...base.notes[0], position: 3 },
      ],
    });
    expect(root.querySelectorAll('[data-disclaimer]')).toHaveLength(1);
    expect(root.textContent).not.toContain('Consumida');
    expect(root.textContent).not.toContain('Otra');
    expect(root.textContent).toContain('Descargo de muestra');
  });

  it('does not render invented update dates or role labels', async () => {
    const legacy = {
      ...base,
      updated_at: '1999-12-31',
      author: { ...base.author, role_label: 'RolInventado' },
    } as unknown as BuildAttributionContent;
    const { root } = await render(legacy);
    expect(root.textContent).toContain('Ana la Forjadora');
    expect(root.textContent).not.toContain('RolInventado');
    expect(root.textContent).not.toContain('31 de diciembre de 1999');
    expect(root.textContent).toContain('marzo');
  });

  it('escapes hostile editorial strings as text without injecting markup', async () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const { root } = await render({
      ...base,
      author: { ...base.author, display_name: hostile, bio: '<script>alert(1)</script>' },
      sources: [
        {
          ...base.sources[0],
          title: hostile,
          author_name: '<b>Forjadora</b>',
          license_note: '<script>alert(2)</script>',
        },
      ],
      notes: [{ ...base.notes[0], headline: hostile, detail: '<svg onload=alert(3)>' }],
    });
    expect(root.querySelector('img, script, svg, b')).toBeNull();
    expect(root.textContent).toContain(hostile);
    expect(root.textContent).toContain('<script>alert(1)</script>');
    expect(root.textContent).toContain('<script>alert(2)</script>');
    expect(root.textContent).toContain('<svg onload=alert(3)>');
  });

  it('omits the section when the fuentes metadata marks it hidden', async () => {
    const { root } = await render({
      ...base,
      sections_meta: [{ section_key: 'fuentes', position: 10, visible: false }],
    });
    expect(root.querySelector('section')).toBeNull();
    expect(root.textContent?.trim()).toBe('');
  });

  it('renders complete server-side markup with the canonical fuentes anchor', async () => {
    const { root } = await render(base, false, 'server');
    const section = root.querySelector('section');
    expect(section?.id).toBe('fuentes');
    expect(section?.getAttribute('aria-labelledby')).toBe('fuentes-heading');
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('Autor y fuentes');
    expect(root.textContent).toContain('Ana la Forjadora');
    expect(root.textContent).toContain('Hilo de muestra');
    expect(root.textContent).toContain('Descargo de muestra');
    expect(root.querySelectorAll('[id]')).toHaveLength(
      new Set([...root.querySelectorAll('[id]')].map((element) => element.id)).size,
    );
  });

  it('exposes the public projection type without private rights fields', () => {
    const keys: (keyof BuildAttributionContent)[] = [
      'slug',
      'title',
      'author',
      'sources',
      'game_version',
      'review_state',
      'content_status',
      'published_at',
      'footer_disclaimer',
      'notes',
      'sections_meta',
    ];
    for (const key of keys) expect(Object.prototype.hasOwnProperty.call(base, key)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(base, 'rights_status')).toBe(false);
  });
});
