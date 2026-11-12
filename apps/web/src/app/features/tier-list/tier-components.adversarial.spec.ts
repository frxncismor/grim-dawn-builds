import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PublicBuild, PublicSource, TierEntry } from '@gd/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { TierCard } from './tier-components';

/*
 * Adversarial UI cases for the catalog card (T-141, plan §17.49). Every hostile
 * value must fail closed: markup stays inert, unsafe URLs never reach `href`
 * and private fields injected into the view model are never rendered.
 */

const PLACEHOLDER_ENTRY: TierEntry = {
  entry_kind: 'placeholder',
  combination_slug: 'chaman-demoledor',
  display_name: 'Ranura de prueba',
  build_slug: null,
  tier: 'sin_clasificar',
  content_status: 'placeholder',
  rights_status: 'own_original',
  review_state: 'publicado',
  external_url: null,
  external_author: null,
  source_slug: null,
  evaluated_on: null,
};

const EXTERNAL_ENTRY: TierEntry = {
  ...PLACEHOLDER_ENTRY,
  entry_kind: 'enlace_externo',
  display_name: 'Guía externa',
  content_status: 'sin_verificar',
  rights_status: 'link_only',
  external_url: 'https://example.invalid/guia',
  external_author: 'Autor externo',
  source_slug: 'guia-original',
};

const PUBLIC_GUIDE: Pick<PublicBuild, 'slug' | 'title' | 'review_state' | 'rights_status'> = {
  slug: 'guia-publica',
  title: 'Guía pública',
  review_state: 'publicado',
  rights_status: 'own_original',
};

const HOSTILE = '<img src=x onerror=alert(1)>';
const SCRIPT = '<script>alert("x")</script>';

async function render(
  entry: TierEntry = PLACEHOLDER_ENTRY,
  options: {
    guide?: Pick<PublicBuild, 'slug' | 'title' | 'review_state' | 'rights_status'> | null;
    source?: Pick<PublicSource, 'title' | 'license_note'> | null;
    combinationName?: string;
    gameVersion?: string | null;
  } = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [TierCard], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(TierCard);
  fixture.componentRef.setInput('entry', entry);
  fixture.componentRef.setInput('combinationName', options.combinationName ?? 'Chamán + Demoledor');
  fixture.componentRef.setInput(
    'gameVersion',
    options.gameVersion === undefined ? '1.2.x' : options.gameVersion,
  );
  fixture.componentRef.setInput('guide', options.guide ?? null);
  fixture.componentRef.setInput('source', options.source ?? null);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** Every `on*` attribute would be an executable handler. */
function eventAttributes(root: HTMLElement): string[] {
  return [...root.querySelectorAll('*')].flatMap((element) =>
    [...element.attributes]
      .filter((attribute) => attribute.name.toLowerCase().startsWith('on'))
      .map((attribute) => `${element.tagName}:${attribute.name}`),
  );
}

describe('adversarial gd-tier-card: inert markup', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders hostile editorial strings as text without elements or handlers', async () => {
    const hostileEntry: TierEntry = {
      ...PLACEHOLDER_ENTRY,
      display_name: `${HOSTILE}${SCRIPT}`,
    };
    const root = await render(hostileEntry, {
      combinationName: HOSTILE,
      guide: { ...PUBLIC_GUIDE, title: SCRIPT },
    });

    expect(root.querySelector('script, iframe, object, embed')).toBeNull();
    expect(root.querySelector('img[src="x"]')).toBeNull();
    expect(eventAttributes(root)).toEqual([]);
    expect(root.textContent).toContain(HOSTILE);
    expect(root.textContent).toContain(SCRIPT);
  });

  it('preserves RTL, combining marks, homoglyphs and entities literally', async () => {
    const hostile = 'Autor \u202Egnp.exe \u0441haman Cham\u0061\u0301n &amp; &#x3C;';
    const root = await render({ ...PLACEHOLDER_ENTRY, display_name: hostile });
    expect(root.textContent).toContain(hostile);
    expect(root.querySelector('script')).toBeNull();
    expect(eventAttributes(root)).toEqual([]);
  });

  it('renders an oversized string without injecting markup or throwing', async () => {
    const huge = `<b>${'a'.repeat(50_000)}</b>`;
    const root = await render({ ...PLACEHOLDER_ENTRY, display_name: huge });
    expect(root.querySelector('b')).toBeNull();
    expect(root.textContent?.length).toBeGreaterThan(50_000);
    expect(root.querySelector('script')).toBeNull();
  });

  it('never renders private fields injected into the view model', async () => {
    const privateEntry = {
      ...EXTERNAL_ENTRY,
      reviewed_by: 'PRIVATE-EDITOR',
      rights_confirmed_by: 'PRIVATE-CONFIRMER',
      evidence_ref: 'PRIVATE-EVIDENCE',
    } as unknown as TierEntry;
    const privateGuide = {
      ...PUBLIC_GUIDE,
      reviewed_by: 'PRIVATE-EDITOR',
      rights_notes: 'PRIVATE-NOTES',
    } as unknown as Pick<PublicBuild, 'slug' | 'title' | 'review_state' | 'rights_status'>;
    const privateSource = {
      title: 'Fuente sintética',
      license_note: 'Permiso de prueba',
      permission_ref: 'PRIVATE-PROOF',
      notes: 'PRIVATE-NOTES',
    } as unknown as Pick<PublicSource, 'title' | 'license_note'>;
    const root = await render(privateEntry, { guide: privateGuide, source: privateSource });

    expect(root.textContent).not.toMatch(/PRIVATE-/);
    expect(root.textContent).toContain('Fuente sintética');
  });
});

describe('adversarial gd-tier-card: unsafe external links', () => {
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
  ])('does not turn %s into an href', async (externalUrl) => {
    const root = await render({ ...EXTERNAL_ENTRY, external_url: externalUrl } as TierEntry);
    expect(root.querySelector('a[href]')).toBeNull();
    expect(root.textContent).toContain('Guía externa');
    expect(root.textContent).toContain('Autor externo');
    expect(eventAttributes(root)).toEqual([]);
  });

  it('links a plain HTTP(S) URL with a hardened rel and target', async () => {
    const root = await render(EXTERNAL_ENTRY);
    const link = root.querySelector<HTMLAnchorElement>('a[href]');
    expect(link?.getAttribute('href')).toBe('https://example.invalid/guia');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('keeps the external notice even without a usable URL or author', async () => {
    const root = await render({
      ...EXTERNAL_ENTRY,
      external_url: 'javascript:alert(1)',
      external_author: null,
    } as TierEntry);
    expect(root.querySelector('a[href]')).toBeNull();
    expect(root.textContent).toContain('Link to a third-party site');
  });
});

describe('adversarial gd-tier-card: build links fail closed', () => {
  afterEach(() => TestBed.resetTestingModule());

  const ownEntry: TierEntry = {
    ...PLACEHOLDER_ENTRY,
    entry_kind: 'build_propia',
    display_name: null,
    build_slug: PUBLIC_GUIDE.slug,
    rights_status: 'own_original',
    content_status: 'verificado',
  };

  it('links a published build with approved rights and a valid slug', async () => {
    const root = await render(ownEntry, { guide: PUBLIC_GUIDE });
    const link = root.querySelector<HTMLAnchorElement>('a[href]');
    expect(link?.getAttribute('href')).toBe('/builds/guia-publica');
    expect(link?.textContent?.trim()).toBe('Guía pública');
  });

  it.each([
    ['../admin', 'path traversal'],
    ['javascript:alert(1)', 'javascript URL'],
    ['guia_con_guion_bajo', 'invalid slug'],
    ['\u0441haman', 'homoglyph slug'],
  ])('never links the %s guide slug (%s)', async (slug) => {
    const entry = { ...ownEntry, build_slug: slug } as TierEntry;
    const root = await render(entry, { guide: { ...PUBLIC_GUIDE, slug } });
    expect(root.querySelector('a[href]')).toBeNull();
    expect(root.textContent).toContain('Guide coming soon');
  });

  it.each([
    [{ ...PUBLIC_GUIDE, review_state: 'borrador' as const }, 'draft guide'],
    [{ ...PUBLIC_GUIDE, rights_status: 'link_only' as const }, 'unapproved guide rights'],
    [{ ...PUBLIC_GUIDE, slug: 'otra-guia' }, 'slug mismatch'],
  ])('never links a build that fails the publication gate (%s)', async (guide) => {
    const root = await render(ownEntry, { guide });
    expect(root.querySelector('a[href]')).toBeNull();
    expect(root.textContent).toContain('Guide coming soon');
  });

  it('never links a build_propia entry with unapproved rights', async () => {
    const root = await render({ ...ownEntry, rights_status: 'pending' } as TierEntry, {
      guide: PUBLIC_GUIDE,
    });
    expect(root.querySelector('a[href]')).toBeNull();
  });
});

describe('adversarial gd-tier-card: empty and null values', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('falls back to the combination name when display_name is null', async () => {
    const root = await render(
      { ...PLACEHOLDER_ENTRY, display_name: null },
      {
        combinationName: 'Chamán + Demoledor',
      },
    );
    expect(root.querySelector('h3')?.textContent?.trim()).toBe('Chamán + Demoledor');
    expect(root.querySelector('script')).toBeNull();
  });

  it('renders without a source, date or game version', async () => {
    const root = await render(
      { ...PLACEHOLDER_ENTRY, display_name: null, evaluated_on: null },
      { combinationName: 'Chamán + Demoledor', gameVersion: null },
    );
    expect(root.textContent).toContain('Chamán + Demoledor');
    expect(root.textContent).not.toContain('Version:');
    expect(root.querySelector('a[href]')).toBeNull();
  });
});
