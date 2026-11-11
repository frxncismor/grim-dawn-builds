import { APP_BASE_HREF } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import draftFixture from '../../../../../content/builds/chaman-demoledor-golpe-primigenio.json';
import { BuildToc, type BuildTocContent } from './build-toc';

const fixture = draftFixture as unknown as BuildTocContent;

const note = (label: string): BuildTocContent['notes'][number] => ({
  kind: 'general',
  label,
  headline: label,
  detail: `${label} de muestra`,
  position: 1,
});

const content: BuildTocContent = {
  ...fixture,
  video_url: 'https://youtu.be/SampleID_01',
  sections_meta: [
    { section_key: 'fuentes', position: 10, visible: true },
    { section_key: 'video', position: 9, visible: true },
    { section_key: 'devociones', position: 8, visible: true },
    { section_key: 'guia-espiritual', position: 7, visible: true },
    { section_key: 'filtro-de-botin', position: 6, visible: true },
    { section_key: 'notas', position: 5, visible: true },
    { section_key: 'orden', position: 4, visible: true },
    { section_key: 'habilidades', position: 3, visible: true },
    { section_key: 'prioridades', position: 2, visible: true },
    { section_key: 'resumen', position: 1, visible: true },
  ],
};

const canonical = [
  'resumen',
  'prioridades',
  'habilidades',
  'orden',
  'notas',
  'filtro-de-botin',
  'guia-espiritual',
  'devociones',
  'video',
  'fuentes',
];

async function render(value: BuildTocContent = content, platform = 'browser', baseHref?: string) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildToc],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  if (baseHref) TestBed.overrideProvider(APP_BASE_HREF, { useValue: baseHref });
  const fixture = TestBed.createComponent(BuildToc);
  fixture.componentRef.setInput('content', value);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

const ids = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLAnchorElement>('nav a')].map(
    (link) => (link.getAttribute('href') ?? '').split('#')[1],
  );

describe('gd-build-toc', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists every present and visible section in position order', async () => {
    const { root } = await render();
    expect(ids(root)).toEqual(canonical);
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Guide contents');
    expect(root.querySelectorAll('nav a')).toHaveLength(canonical.length);
  });

  it('omits a section with visible false even when its data exists', async () => {
    const { root } = await render({
      ...content,
      sections_meta: content.sections_meta.map((meta) =>
        meta.section_key === 'video' ? { ...meta, visible: false } : meta,
      ),
    });
    expect(ids(root)).not.toContain('video');
    expect(ids(root)).toHaveLength(canonical.length - 1);
  });

  it('omits sections that are absent from sections_meta', async () => {
    const { root } = await render({
      ...content,
      sections_meta: content.sections_meta.filter((meta) => meta.section_key !== 'notas'),
    });
    expect(ids(root)).not.toContain('notas');
  });

  it('accepts legacy aliases but emits only canonical ids', async () => {
    const { root } = await render({
      ...content,
      sections_meta: [
        { section_key: 'arboles', position: 1, visible: true },
        { section_key: 'filtro', position: 2, visible: true },
        { section_key: 'guia_espiritual', position: 3, visible: true },
      ],
    });
    expect(ids(root)).toEqual(['habilidades', 'filtro-de-botin', 'guia-espiritual']);
    expect(root.textContent).not.toContain('arboles');
    expect(root.textContent).not.toContain('guia_espiritual');
    expect(root.textContent).toContain('Spirit Guide');
  });

  it('shows video only when the shared validator accepts the URL', async () => {
    const valid = await render();
    expect(ids(valid.root)).toContain('video');

    for (const video_url of [
      null,
      '',
      'https://example.invalid/watch?v=SampleID_01',
      'http://youtube.com/watch?v=SampleID_01',
      'javascript:alert(1)',
      'https://youtube.com/watch?v=short',
    ]) {
      const invalid = await render({ ...content, video_url });
      expect(ids(invalid.root)).not.toContain('video');
    }
  });

  it('shows fuentes only with sources or a Descargo note', async () => {
    const withoutSources = await render({ ...content, sources: [], notes: [] });
    expect(ids(withoutSources.root)).not.toContain('fuentes');

    const withDisclaimer = await render({
      ...content,
      sources: [],
      notes: [note('Descargo')],
    });
    expect(ids(withDisclaimer.root)).toContain('fuentes');
  });

  it('hides sections whose backing data is empty', async () => {
    const { root } = await render({
      ...content,
      priorities: [],
      skill_nodes: [],
      purchase_steps: [],
      notes: [],
      loot_filter_columns: [],
      devotion_steps: [],
      guide_npcs: [],
    });
    expect(ids(root)).toEqual(['resumen', 'video', 'fuentes']);
  });

  it('builds href values with the real base href, query and no previous fragment', async () => {
    const { fixture, root } = await render(content, 'browser', '/project/');
    await TestBed.inject(Router).navigateByUrl('/builds/guia-de-muestra?d=rayo#viejo');
    await fixture.whenStable();
    fixture.detectChanges();
    const hrefs = [...root.querySelectorAll<HTMLAnchorElement>('nav a')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs[0]).toBe('/project/builds/guia-de-muestra?d=rayo#resumen');
    expect(hrefs).toContain('/project/builds/guia-de-muestra?d=rayo#fuentes');
    expect(hrefs.every((href) => !href?.includes('#viejo'))).toBe(true);
    expect(root.querySelectorAll('a[routerLink]')).toHaveLength(0);
  });

  it('renders an open native details with a localized summary for no-JavaScript use', async () => {
    const { root } = await render(content, 'server');
    const details = root.querySelector('details');
    expect(details?.open).toBe(true);
    expect(details?.querySelector('summary')?.textContent?.trim()).toBe('Contents');
    expect(details?.querySelector('nav a')).not.toBeNull();
  });

  it('keeps the details operable through its native summary', async () => {
    const { root } = await render();
    const details = root.querySelector<HTMLDetailsElement>('details')!;
    expect(details.open).toBe(true);
    details.open = false;
    expect(details.open).toBe(false);
    details.querySelector<HTMLElement>('summary')?.click();
    expect(details.querySelector('nav a')).not.toBeNull();
  });

  it('deduplicates repeated or aliased section metadata', async () => {
    const { root } = await render({
      ...content,
      sections_meta: [
        { section_key: 'resumen', position: 1, visible: true },
        { section_key: 'resumen', position: 2, visible: true },
        { section_key: 'arboles', position: 3, visible: true },
        { section_key: 'habilidades', position: 4, visible: true },
      ],
    });
    expect(ids(root)).toEqual(['resumen', 'habilidades']);
    expect(root.querySelectorAll('nav a')).toHaveLength(2);
  });

  it('applies scroll padding in the browser and restores it on destroy', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(document, 'scrollingElement');
    Object.defineProperty(document, 'scrollingElement', {
      configurable: true,
      value: document.documentElement,
    });
    const previous = document.documentElement.style.scrollPaddingBlockStart;
    document.documentElement.style.scrollPaddingBlockStart = '7px';
    try {
      const { fixture } = await render();
      expect(document.documentElement.style.scrollPaddingBlockStart).toBe('16px');
      fixture.destroy();
      expect(document.documentElement.style.scrollPaddingBlockStart).toBe('7px');
    } finally {
      document.documentElement.style.scrollPaddingBlockStart = previous;
      if (descriptor) Object.defineProperty(document, 'scrollingElement', descriptor);
      else delete (document as { scrollingElement?: Element }).scrollingElement;
    }
  });

  it('reserves anchor space in CSS for sibling sections without browser JavaScript', async () => {
    const previousPadding = document.documentElement.style.scrollPaddingBlockStart;
    const { root } = await render(content, 'server');
    const main = document.createElement('main');
    // TestBed creates a div host; mirror the real component element for CSS selectors.
    const toc = document.createElement('gd-build-toc');
    const unrelated = document.createElement('section');
    unrelated.id = 'unrelated';
    document.body.append(main, unrelated);
    main.append(toc);
    toc.append(root);
    try {
      const offset = getComputedStyle(main).getPropertyValue('--anchor-offset');
      expect(offset).toMatch(/calc\(.*var\(--space-/);
      for (const id of [...canonical, 'another-section']) {
        // Canonical ids can also belong to a component host rather than a section.
        const target = document.createElement(id === 'another-section' ? 'section' : 'div');
        target.id = id;
        main.append(target);
        expect(target.matches(':target')).toBe(false);
        expect(getComputedStyle(target).scrollMarginBlockStart, id).toBe('var(--anchor-offset)');
      }
      expect(getComputedStyle(unrelated).scrollMarginBlockStart).toBe('');
      expect(document.documentElement.style.scrollPaddingBlockStart).toBe(previousPadding);
    } finally {
      main.remove();
      unrelated.remove();
    }
  });

  it('renders only escaped text and never injects markup', async () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const { root } = await render({
      ...content,
      title: hostile,
      sections_meta: [
        ...content.sections_meta,
        { section_key: '<script>alert(1)</script>', position: 99, visible: true },
      ],
    });
    expect(root.querySelector('img, script')).toBeNull();
    expect(root.textContent).not.toContain(hostile);
    expect(root.textContent).not.toContain('<script>alert(1)</script>');
    expect(root.querySelectorAll('nav a')).toHaveLength(canonical.length);
    const labels = [...root.querySelectorAll('nav a')].map((link) => link.textContent?.trim());
    expect(labels).toEqual([
      'Overview',
      'Priorities',
      'Skills',
      'Purchase order',
      'Notes',
      'Loot filter',
      'Spirit Guide',
      'Devotions',
      'Video',
      'Sources',
    ]);
  });

  it('exposes the required public projection fields', () => {
    for (const key of [
      'title',
      'video_url',
      'sections_meta',
      'sources',
      'notes',
      'priorities',
      'skill_nodes',
      'purchase_steps',
      'loot_filter_columns',
      'devotion_steps',
      'guide_npcs',
    ] satisfies (keyof BuildTocContent)[]) {
      expect(content).toHaveProperty(key);
    }
  });
});
