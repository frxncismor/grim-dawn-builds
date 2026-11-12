import { PLATFORM_ID } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import draftFixture from '../../../../../../content/builds/chaman-demoledor-golpe-primigenio.json';
import { sampleAdaptation } from './source-attribution/source-attribution.fixture';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { BuildPage, type BuildPageContent } from './build.page';

const draftContent = draftFixture as unknown as BuildPageContent;

const canonicalSections = [
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

const chamanNodes = [
  'golpe-primigenio',
  'golpe-atronador',
  'torrente',
  'corriente-de-tormenta',
  'viento-demoniaco',
  'tempestad-furiosa',
  'totem-wendigo',
  'pacto-de-mogdrogen',
  'pacto-de-clamatormentas',
];

const demoledorNodes = [
  'tocado-por-las-llamas',
  'llama-vengativa',
  'granada-cegadora',
  'escudo-explosivo',
  'mina-de-termita',
];

const publicContent: BuildPageContent = {
  ...draftContent,
  slug: 'guia-publica',
  author_slug: 'ana-forjadora',
  title: 'Guía pública sintética',
  summary: 'Resumen sintético de la guía pública de pruebas.',
  review_state: 'publicado',
  rights_status: 'own_original',
  content_status: 'verificado',
  published_at: '2026-04-01',
  video_url: 'https://youtu.be/SampleID_01',
  author: {
    slug: 'ana-forjadora',
    display_name: 'Ana la Forjadora',
    bio: 'Autora ficticia de la prueba.',
    url: null,
  },
  sources: [
    {
      slug: 'guia-original',
      kind: 'comunidad',
      title: 'Hilo de muestra',
      url: 'https://foro.example.com/hilo-de-muestra',
      author_name: 'Forjadora',
      license_note: 'Permiso de muestra registrado.',
      retrieved_on: '2026-11-09',
    },
  ],
  source_slugs: ['guia-original'],
  sections_meta: draftContent.sections_meta.map((meta) =>
    meta.section_key === 'video' ? { ...meta, visible: true } : meta,
  ),
  authorIsPlaceholder: false,
  draft: false,
};

const draftPage: BuildPageContent = {
  ...draftContent,
  authorIsPlaceholder: true,
  draft: true,
};

interface RenderOptions {
  platform?: 'browser' | 'server';
}

async function createFixture(value: BuildPageContent, options: RenderOptions = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildPage],
    providers: [
      provideRouter([]),
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      { provide: SITE_BASE_URL, useValue: 'https://example.test/' },
    ],
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });
  await TestBed.compileComponents();
  const fixture = TestBed.createComponent(BuildPage);
  fixture.componentRef.setInput('content', value);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function renderDeferred(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  state: DeferBlockState,
) {
  const blocks = await fixture.getDeferBlocks();
  for (const block of blocks) await block.render(state);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return blocks;
}

async function render(value: BuildPageContent = publicContent, options: RenderOptions = {}) {
  const fixture = await createFixture(value, options);
  await renderDeferred(fixture, DeferBlockState.Complete);
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

const tree = (root: HTMLElement, index: number): HTMLElement =>
  [...root.querySelectorAll<HTMLElement>('gd-skill-tree')][index];

const skillIds = (host: HTMLElement): string[] =>
  [...host.querySelectorAll<HTMLElement>('[data-skill-id]')].map(
    (node) => node.getAttribute('data-skill-id') ?? '',
  );

const activeSkillIds = (host: HTMLElement): string[] =>
  [...host.querySelectorAll<HTMLElement>('[data-active-step="true"]')].map(
    (node) => node.getAttribute('data-skill-id') ?? '',
  );

const jsonLd = (): Record<string, unknown>[] => {
  const script = document.querySelector<HTMLScriptElement>('script#gd-page-jsonld');
  return script?.textContent ? (JSON.parse(script.textContent) as Record<string, unknown>[]) : [];
};

const robots = (): string | null =>
  document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? null;

describe('gd-build-page', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('assembles the ten canonical sections in plan §2 order', async () => {
    const { root } = await render();
    const rendered = [...root.querySelectorAll<HTMLElement>('[id]')]
      .map((element) => element.id)
      .filter((id) => canonicalSections.includes(id));
    expect(rendered).toEqual(canonicalSections);
  });

  it('renders one skill tree per mastery with only that mastery nodes', async () => {
    const { root } = await render();
    const trees = [...root.querySelectorAll<HTMLElement>('gd-skill-tree')];
    expect(trees).toHaveLength(2);

    const [first, second] = trees;
    expect(first.querySelectorAll('[data-skill-id]')).toHaveLength(chamanNodes.length);
    expect([...new Set(skillIds(first))].sort()).toEqual([...chamanNodes].sort());
    expect(second.querySelectorAll('[data-skill-id]')).toHaveLength(demoledorNodes.length);
    expect([...new Set(skillIds(second))].sort()).toEqual([...demoledorNodes].sort());

    expect(root.querySelector('#guia-publica-tree-a-chaman-heading')?.textContent).toContain(
      'Chamán',
    );
    expect(root.querySelector('#guia-publica-tree-b-demoledor-heading')?.textContent).toContain(
      'Demoledor',
    );
  });

  it('reflects the stepper selection in both trees without computing bars or points', async () => {
    const { fixture, root } = await render();
    const step = root.querySelector<HTMLButtonElement>('[data-select-step][data-position="6"]')!;
    step.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeIds()).toEqual([
      'pacto-de-clamatormentas',
      'escudo-explosivo',
      'mina-de-termita',
    ]);
    expect(activeSkillIds(tree(root, 0))).toEqual(['pacto-de-clamatormentas']);
    expect(activeSkillIds(tree(root, 1)).sort()).toEqual(['escudo-explosivo', 'mina-de-termita']);
  });

  it('owns activeStepPosition, follows the devotion output and resets when the guide changes', async () => {
    const { fixture, root } = await render();
    const page = fixture.componentInstance;
    expect(page.activeStepPosition()).toBeUndefined();

    const step = root.querySelector<HTMLButtonElement>(
      '[data-select-position][data-position="4"]',
    )!;
    step.click();
    fixture.detectChanges();
    expect(page.activeStepPosition()).toBe(4);
    expect(step.getAttribute('aria-pressed')).toBe('true');

    fixture.componentRef.setInput('content', { ...publicContent, slug: 'otra-guia' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.activeStepPosition()).toBeUndefined();
    const pressed = [...root.querySelectorAll<HTMLElement>('[data-select-position]')].map(
      (button) => button.getAttribute('aria-pressed'),
    );
    expect(pressed.every((value) => value === 'false')).toBe(true);
  });

  it('renders no video facade at all when video_url is null', async () => {
    const { root } = await render({ ...publicContent, video_url: null });
    expect(root.querySelector('gd-video-facade')).toBeNull();
    expect(root.querySelector('#video')).toBeNull();
    expect(root.querySelector('iframe')).toBeNull();
  });

  it('renders the table of contents with every present section', async () => {
    const { root } = await render();
    const toc = root.querySelector('gd-build-toc');
    expect(toc).not.toBeNull();
    const links = [...(toc?.querySelectorAll('nav a') ?? [])].map(
      (link) => (link.getAttribute('href') ?? '').split('#')[1],
    );
    expect(links).toEqual(canonicalSections);
  });

  it('shows the draft banner and noindex,follow for drafts', async () => {
    const { root } = await render(draftPage);
    const banner = root.querySelector('[data-draft-banner]');
    expect(banner?.textContent?.trim()).toBe('Draft · not public');
    expect(banner?.getAttribute('role')).toBe('status');
    expect(robots()).toBe('noindex,follow');
    expect(document.querySelector('[data-draft-banner]')).not.toBeNull();
  });

  it('hides the draft banner and indexes public guides', async () => {
    const { root } = await render();
    expect(root.querySelector('[data-draft-banner]')).toBeNull();
    expect(robots()).toBe('index,follow');
  });

  it('emits Article and BreadcrumbList JSON-LD with public data only', async () => {
    await render();
    const records = jsonLd();
    expect(records.map((record) => record['@type'])).toEqual(['Article', 'BreadcrumbList']);

    const [article, breadcrumbs] = records;
    expect(article['headline']).toBe(publicContent.title);
    expect(article['inLanguage']).toBe('es');
    expect(article['datePublished']).toBe('2026-04-01');
    expect((article['author'] as Record<string, unknown>)['name']).toBe('Ana la Forjadora');
    expect(article['isBasedOn']).toEqual(['https://foro.example.com/hilo-de-muestra']);
    expect(breadcrumbs['itemListElement']).toHaveLength(2);

    const serialized = JSON.stringify(records).toLowerCase();
    for (const key of [
      'reviewed_by',
      'reviewedby',
      'rights_confirmed',
      'rightsconfirmed',
      'rights_notes',
      'permission_ref',
      'permissionref',
      'is_placeholder',
      'isplaceholder',
      'proof_ref',
    ]) {
      expect(serialized).not.toContain(key);
    }
  });

  it('does not claim publication or verified authorship in draft structured data', async () => {
    await render(draftPage);
    const [article] = jsonLd();
    expect(article['author']).toBeUndefined();
    expect(article['datePublished']).toBeUndefined();
  });

  it('renders the adaptation block and its source in isBasedOn for the server markup', async () => {
    const { root } = await render(
      { ...publicContent, adaptation: sampleAdaptation },
      { platform: 'server' },
    );

    const block = root.querySelector('gd-source-attribution');
    expect(block).not.toBeNull();
    expect(block?.querySelector('[data-attribution-text]')?.textContent?.trim()).toBe(
      sampleAdaptation.attribution_text,
    );
    expect(block?.querySelector('[data-original-title]')?.textContent?.trim()).toBe(
      sampleAdaptation.original_title,
    );
    expect(block?.querySelector('[data-original-author]')?.textContent?.trim()).toBe(
      sampleAdaptation.original_author,
    );
    expect(block?.querySelector('[data-original-site]')?.textContent?.trim()).toBe(
      sampleAdaptation.original_site,
    );
    expect(block?.querySelector('[data-original-link]')?.getAttribute('href')).toBe(
      sampleAdaptation.source_url,
    );

    const [article] = jsonLd();
    expect(article['isBasedOn']).toEqual([
      'https://foro.example.com/hilo-de-muestra',
      sampleAdaptation.source_url,
    ]);
  });

  it('omits the adaptation block and leaves isBasedOn unchanged without adaptation', async () => {
    const { root } = await render(publicContent, { platform: 'server' });

    expect(root.querySelector('gd-source-attribution')).toBeNull();
    const [article] = jsonLd();
    expect(article['isBasedOn']).toEqual(['https://foro.example.com/hilo-de-muestra']);
    expect(JSON.stringify(article)).not.toContain('attribution_text');
  });

  it('never duplicates an adaptation URL already cited nor adds an unsafe one', async () => {
    const cited = {
      ...publicContent.sources[0],
      slug: 'adaptacion-citada',
      url: sampleAdaptation.source_url,
    };
    await render(
      {
        ...publicContent,
        sources: [...publicContent.sources, cited],
        adaptation: sampleAdaptation,
      },
      { platform: 'server' },
    );
    const [duplicated] = jsonLd();
    expect(
      (duplicated['isBasedOn'] as string[]).filter((url) => url === sampleAdaptation.source_url),
    ).toHaveLength(1);

    const { root } = await render(
      {
        ...publicContent,
        adaptation: { ...sampleAdaptation, source_url: 'javascript:alert(1)' },
      },
      { platform: 'server' },
    );
    expect(root.querySelector('gd-source-attribution')).not.toBeNull();
    expect(root.querySelector('[data-original-link]')).toBeNull();
    const [article] = jsonLd();
    expect(article['isBasedOn']).toEqual(['https://foro.example.com/hilo-de-muestra']);
    expect(JSON.stringify(article)).not.toContain('javascript:');
  });

  it('keeps a single h1, unique ids and the canonical anchors in server markup', async () => {
    const { root } = await render(publicContent, { platform: 'server' });
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(publicContent.title);

    const ids = [...root.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of canonicalSections) expect(root.querySelector(`#${id}`)).not.toBeNull();
  });

  it('escapes hostile editorial strings instead of injecting markup', async () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const { root } = await render({ ...publicContent, title: hostile });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain(hostile);
  });

  it('creates and renders without repository, HTTP or storage providers', async () => {
    const { root } = await render();
    expect(root.textContent).toContain(publicContent.title);
    expect(root.querySelector('gd-build-attribution')).not.toBeNull();
    expect(root.querySelector('gd-loot-filter')).not.toBeNull();
  });

  it('keeps the essential text alternative in the deferred skill-tree placeholder', async () => {
    const fixture = await createFixture(publicContent);
    const root = fixture.nativeElement as HTMLElement;
    const blocks = await renderDeferred(fixture, DeferBlockState.Placeholder);
    expect(blocks).toHaveLength(2);

    expect(root.querySelector('#habilidades')).not.toBeNull();
    expect(root.textContent).toContain('Golpe Primigenio');
    expect(root.textContent).toContain('Primal Strike');
    expect(root.textContent).toContain('Recommended');
    expect(root.textContent).toContain('Bar 5');
    expect(root.textContent).toContain('Chamán');
    expect(root.textContent).toContain('Shaman');

    await blocks[0].render(DeferBlockState.Loading);
    fixture.detectChanges();
    expect(root.querySelector('#habilidades')).not.toBeNull();
    expect(root.querySelector('.build-skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.textContent).toContain('Golpe Primigenio');
  });

  it('keeps every devotion step, including the ones without a constellation, in the placeholder', async () => {
    const fixture = await createFixture(publicContent);
    const root = fixture.nativeElement as HTMLElement;
    const blocks = await renderDeferred(fixture, DeferBlockState.Placeholder);
    await blocks[1].render(DeferBlockState.Placeholder);
    fixture.detectChanges();

    const section = root.querySelector('#devociones');
    expect(section).not.toBeNull();
    expect(section?.textContent).toContain(draftContent.devotion_steps[0]!.body);
    expect(section?.textContent).toContain('Unverified');
    expect(section?.textContent).toContain(draftContent.devotion_steps.at(-1)!.body);
    expect(section?.querySelectorAll('[data-fallback-devotion-step]')).toHaveLength(
      draftContent.devotion_steps.length,
    );
  });

  it('keeps instances isolated when two pages share the document', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BuildPage],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/' },
      ],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    await TestBed.compileComponents();
    const first = TestBed.createComponent(BuildPage);
    first.componentRef.setInput('content', publicContent);
    first.detectChanges();
    const second = TestBed.createComponent(BuildPage);
    second.componentRef.setInput('content', { ...publicContent, slug: 'guia-segunda' });
    second.detectChanges();
    await Promise.all([first.whenStable(), second.whenStable()]);

    const blocks = [...(await first.getDeferBlocks()), ...(await second.getDeferBlocks())];
    for (const block of blocks) await block.render(DeferBlockState.Complete);
    first.detectChanges();
    second.detectChanges();

    const firstRoot = first.nativeElement as HTMLElement;
    const secondRoot = second.nativeElement as HTMLElement;
    expect(firstRoot.querySelector('#guia-publica-tree-a-chaman-heading')).not.toBeNull();
    expect(secondRoot.querySelector('#guia-segunda-tree-a-chaman-heading')).not.toBeNull();

    const firstIds = [...firstRoot.querySelectorAll<HTMLElement>('[id]')]
      .map((node) => node.id)
      .filter((id) => id.includes('guia-publica'));
    const secondIds = [...secondRoot.querySelectorAll<HTMLElement>('[id]')].map((node) => node.id);
    expect(firstIds.length).toBeGreaterThan(0);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);

    firstRoot.querySelector<HTMLButtonElement>('[data-select-step][data-position="6"]')!.click();
    first.detectChanges();
    expect(activeSkillIds(tree(firstRoot, 0))).toEqual(['pacto-de-clamatormentas']);
    expect(activeSkillIds(tree(secondRoot, 0))).toEqual([]);
  });

  it('does not use innerHTML in the page template', async () => {
    const { root } = await render({ ...publicContent, title: '<b>texto</b>' });
    expect(root.innerHTML).not.toContain('<b>texto</b>');
    expect(root.querySelector('b')).toBeNull();
  });
});
