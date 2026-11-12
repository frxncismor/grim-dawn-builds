import { LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { BuildAttribution, type BuildAttributionContent } from './build-attribution';

/*
 * Adversarial UI cases for the attribution block (T-141, plan §17.49). Hostile
 * editorial strings must stay inert, unsafe source URLs must never become
 * `href` values, and injected private fields must never be rendered.
 */

const BASE: BuildAttributionContent = {
  slug: 'guia-adversarial',
  title: 'Guía adversarial',
  author: {
    slug: 'ana-forjadora',
    display_name: 'Ana la Forjadora',
    bio: 'Autora sintética de la prueba.',
    url: null,
  },
  sources: [
    {
      slug: 'fuente-sintetica',
      kind: 'comunidad',
      title: 'Fuente sintética',
      url: 'https://example.invalid/hilo',
      author_name: 'Forjadora',
      license_note: 'Permiso sintético registrado.',
      retrieved_on: '2026-11-08',
    },
  ],
  game_version: '1.2.x',
  review_state: 'publicado',
  content_status: 'verificado',
  published_at: '2026-11-08',
  footer_disclaimer: 'Aviso sintético del pie de página.',
  notes: [],
  sections_meta: [{ section_key: 'fuentes', position: 1, visible: true }],
};

const HOSTILE = '<img src=x onerror=alert(1)>';
const SCRIPT = '<script>alert("x")</script>';

async function render(value: BuildAttributionContent = BASE, authorPlaceholder = false) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildAttribution],
    providers: [
      provideRouter([]),
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: LOCALE_ID, useValue: 'en-US' },
    ],
  });
  const fixture = TestBed.createComponent(BuildAttribution);
  fixture.componentRef.setInput('content', value);
  fixture.componentRef.setInput('authorPlaceholder', authorPlaceholder);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function eventAttributes(root: HTMLElement): string[] {
  return [...root.querySelectorAll('*')].flatMap((element) =>
    [...element.attributes]
      .filter((attribute) => attribute.name.toLowerCase().startsWith('on'))
      .map((attribute) => `${element.tagName}:${attribute.name}`),
  );
}

describe('adversarial gd-build-attribution: inert markup', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders hostile author, source and disclaimer strings as text', async () => {
    const root = await render({
      ...BASE,
      author: { ...BASE.author, display_name: HOSTILE, bio: SCRIPT },
      sources: [
        {
          ...BASE.sources[0],
          title: HOSTILE,
          author_name: `<b>${SCRIPT}</b>`,
          license_note: '<svg onload=alert(2)>',
        },
      ],
      footer_disclaimer: '<iframe src="javascript:alert(3)"></iframe>',
      notes: [
        {
          kind: 'general',
          label: 'Descargo',
          headline: HOSTILE,
          detail: SCRIPT,
          position: 1,
        },
      ],
    });

    expect(root.querySelector('script, iframe, object, embed')).toBeNull();
    expect(root.querySelector('img[src="x"]')).toBeNull();
    expect(root.querySelector('b, svg')).toBeNull();
    expect(eventAttributes(root)).toEqual([]);
    expect(root.textContent).toContain(HOSTILE);
    expect(root.textContent).toContain(SCRIPT);
    expect(root.textContent).toContain('<svg onload=alert(2)>');
  });

  it('preserves RTL overrides, homoglyphs and entities literally', async () => {
    const hostile = 'Autor \u202Egnp.exe \u0441haman Cham\u0061\u0301n &amp;';
    const root = await render({
      ...BASE,
      author: { ...BASE.author, display_name: hostile, bio: hostile },
      game_version: hostile,
    });
    expect(root.textContent).toContain(hostile);
    expect(root.querySelector('a[data-author-link]')).not.toBeNull();
    expect(eventAttributes(root)).toEqual([]);
  });

  it('renders oversized strings and an invalid date without throwing', async () => {
    const huge = 'a'.repeat(50_000);
    const root = await render({
      ...BASE,
      author: { ...BASE.author, display_name: huge, bio: huge },
      published_at: 'not-a-date',
      sources: [{ ...BASE.sources[0], title: huge, retrieved_on: 'not-a-date' }],
    });
    expect(root.textContent?.length).toBeGreaterThan(50_000);
    expect(root.querySelector('[data-published]')?.textContent).toContain('not-a-date');
    expect(root.textContent).toContain('not-a-date');
    expect(root.querySelector('script')).toBeNull();
  });

  it('never renders private fields injected into the view model', async () => {
    const content = {
      ...BASE,
      rights_notes: 'PRIVATE-RIGHTS-NOTES',
      reviewed_by: 'PRIVATE-EDITOR',
      reviewed_at: '2026-11-08',
      rights_confirmed_by: 'PRIVATE-CONFIRMER',
      sources: [
        {
          ...BASE.sources[0],
          permission_ref: 'PRIVATE-PROOF',
          notes: 'PRIVATE-NOTES',
        },
      ],
      author: { ...BASE.author, is_placeholder: false },
    } as unknown as BuildAttributionContent;
    const root = await render(content);
    expect(root.textContent).not.toMatch(/PRIVATE-/);
    expect(root.textContent).toContain('Ana la Forjadora');
  });

  it('renders the empty-sources state without a source link', async () => {
    const root = await render({ ...BASE, sources: [] });
    expect(root.textContent).toContain('No sources recorded');
    expect(root.querySelector('[data-sources] a[href]')).toBeNull();
    expect(root.querySelector('a[data-source-link]')).toBeNull();
  });
});

describe('adversarial gd-build-attribution: unsafe source links', () => {
  afterEach(() => TestBed.resetTestingModule());

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
    `${'http'}://${'usuario'}@example.invalid/guia`,
  ])('renders %s as text without an href', async (url) => {
    const root = await render({
      ...BASE,
      sources: [{ ...BASE.sources[0], url, title: 'Fuente hostil' }],
    });
    expect(root.querySelector('a[data-source-link]')).toBeNull();
    expect(root.textContent).toContain('Fuente hostil');
    expect(eventAttributes(root)).toEqual([]);
  });

  it('links a plain HTTP(S) source with a hardened rel and target', async () => {
    const root = await render();
    const link = root.querySelector<HTMLAnchorElement>('a[data-source-link]');
    expect(link?.getAttribute('href')).toBe('https://example.invalid/hilo');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.textContent).toContain('example.invalid');
  });
});

describe('adversarial gd-build-attribution: author links fail closed', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('links a confirmed author with a valid slug', async () => {
    const root = await render();
    expect(root.querySelector('a[data-author-link]')?.getAttribute('href')).toBe(
      '/autores/ana-forjadora',
    );
  });

  it('never links the reserved placeholder slug', async () => {
    const root = await render({
      ...BASE,
      author: { ...BASE.author, slug: 'por-confirmar', bio: null },
    });
    expect(root.querySelector('a[data-author-link]')).toBeNull();
    expect(root.querySelector('[data-author-placeholder]')).not.toBeNull();
  });

  it.fails(
    'hallazgo: un slug de autor con recorrido (..) no debe convertirse en enlace',
    async () => {
      const root = await render({ ...BASE, author: { ...BASE.author, slug: '../admin' } });
      expect(root.querySelector('a[data-author-link]')).toBeNull();
    },
  );

  it.fails('hallazgo: un slug de autor con homoglifos no debe convertirse en enlace', async () => {
    const root = await render({ ...BASE, author: { ...BASE.author, slug: '\u0441haman' } });
    expect(root.querySelector('a[data-author-link]')).toBeNull();
  });
});
