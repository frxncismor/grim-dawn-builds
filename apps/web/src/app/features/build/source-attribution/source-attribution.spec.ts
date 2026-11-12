import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { LinkOnlyMetadata } from '@gd/domain';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { SourceAttribution } from './source-attribution';
import { sampleAdaptation } from './source-attribution.fixture';

const stylesheet = readFileSync(
  resolve('src/app/features/build/source-attribution/source-attribution.css'),
  'utf8',
);

async function render(value: LinkOnlyMetadata = sampleAdaptation, locale = 'en-US') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SourceAttribution],
    providers: [{ provide: LOCALE_ID, useValue: locale }],
  });
  const fixture = TestBed.createComponent(SourceAttribution);
  fixture.componentRef.setInput('attribution', value);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('gd-source-attribution', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the adaptation heading and the six factual fields', async () => {
    const { root } = await render();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('This build was adapted from');
    expect(root.querySelector('[data-attribution-text]')?.textContent?.trim()).toBe(
      sampleAdaptation.attribution_text,
    );
    expect(root.querySelector('[data-original-title]')?.textContent?.trim()).toBe(
      sampleAdaptation.original_title,
    );
    expect(root.querySelector('[data-original-author]')?.textContent?.trim()).toBe(
      sampleAdaptation.original_author,
    );
    expect(root.querySelector('[data-original-site]')?.textContent?.trim()).toBe(
      sampleAdaptation.original_site,
    );

    const retrieved = root.querySelector('[data-retrieved-on]');
    expect(retrieved?.tagName).toBe('TIME');
    expect(retrieved?.getAttribute('datetime')).toBe(sampleAdaptation.retrieved_on);
    expect(retrieved?.textContent?.trim()).toBe('October 1, 2026');
  });

  it('formats the retrieval date in the injected locale', async () => {
    const { root } = await render(sampleAdaptation, 'es');
    expect(root.querySelector('[data-retrieved-on]')?.textContent?.trim()).toBe(
      '1 de octubre de 2026',
    );
  });

  it('links the original with descriptive text, a new tab and a safe rel', async () => {
    const { root } = await render();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links).toHaveLength(1);

    const [link] = links;
    expect(link.getAttribute('href')).toBe(sampleAdaptation.source_url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.hasAttribute('data-original-link')).toBe(true);

    const text = link.textContent ?? '';
    expect(text).toMatch(/original build/i);
    expect(text).toContain('foro.example.com');
    expect(text).toMatch(/new tab/i);
    expect(text.trim()).not.toMatch(/^(here|aquí)$/i);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,prueba',
    'no es una url',
    'ftp://foro.example.com/tema',
    // Built at runtime on purpose: this must be an invalid URL for the rejection
    // test, not a credential. Writing it literally would trip scripts/check-secrets.mts.
    `https://${'usuario'}:${'clave'}@foro.example.com/tema`,
    'http://usuario@foro.example.com/tema',
  ])('keeps %s as text and never creates an href', async (source_url) => {
    const { root } = await render({ ...sampleAdaptation, source_url });

    expect(root.querySelector('a')).toBeNull();
    expect(root.querySelector('[data-original-link]')).toBeNull();
    expect(root.querySelector('[data-original-url]')?.textContent?.trim()).toBe(source_url);
  });

  it('never renders fields derived from the source beyond the factual metadata', async () => {
    const withDerived = {
      ...sampleAdaptation,
      summary: 'RESUMEN DERIVADO',
      body: 'CUERPO DERIVADO',
      image_url: 'https://foro.example.com/derivada.png',
      tier: 'TIER-DERIVADO',
      ranking: 'RANKING-DERIVADO',
    } as unknown as LinkOnlyMetadata;

    const { root } = await render(withDerived);
    expect(root.textContent).not.toContain('RESUMEN DERIVADO');
    expect(root.textContent).not.toContain('CUERPO DERIVADO');
    expect(root.textContent).not.toContain('derivada.png');
    expect(root.textContent).not.toContain('TIER-DERIVADO');
    expect(root.textContent).not.toContain('RANKING-DERIVADO');
    expect(root.querySelector('img, script, svg, iframe')).toBeNull();
  });

  it('escapes hostile editorial strings as text without injecting markup', async () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const { root } = await render({
      ...sampleAdaptation,
      original_title: hostile,
      original_author: '<b>Autora</b>',
      attribution_text: '<script>alert(2)</script>',
      original_site: '<svg onload=alert(3)>',
    });

    expect(root.querySelector('img, script, svg, b')).toBeNull();
    expect(root.textContent).toContain(hostile);
    expect(root.textContent).toContain('<script>alert(2)</script>');
    expect(root.textContent).toContain('<svg onload=alert(3)>');
    expect(root.innerHTML).not.toContain('<img src=x');
  });

  it('exposes the original link as a native, focusable anchor', async () => {
    const { root } = await render();
    const link = root.querySelector<HTMLAnchorElement>('[data-original-link]');
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toBe(sampleAdaptation.source_url);
    expect(link?.getAttribute('tabindex')).toBeNull();
    expect(link?.classList.contains('attribution__link')).toBe(true);
  });

  it('declares a visible focus ring and only uses the existing colour tokens', () => {
    expect(stylesheet).toMatch(/:focus-visible/);
    expect(stylesheet).toMatch(/outline:\s*var\(--focus-ring\)/);
    expect(stylesheet).toMatch(/outline-offset:\s*var\(--focus-offset\)/);
    expect(stylesheet).toMatch(/color:\s*var\(--color-storm\)/);
    expect(stylesheet).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(stylesheet).not.toMatch(/\b(?:rgb|hsl)a?\(/);
  });

  it('lays out the fields with fluid tracks and no width-specific media queries', () => {
    expect(stylesheet).toMatch(
      /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*12rem\),\s*1fr\)\)/,
    );
    expect(stylesheet).toMatch(/overflow-wrap:\s*anywhere/);
    expect(stylesheet).not.toMatch(/@media\s*\([^)]*width/);
  });

  it('passes axe-core with no violations in the rendered block', async () => {
    const { root } = await render();
    const results = await axe.run(root);
    const violations = results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.length,
    }));
    // jsdom does not resolve layout or final colours, so layout-dependent rules
    // (e.g. `color-contrast`) come back as `incomplete`, never as violations.
    // The token pairs are gated separately by `pnpm run check:contrast`.
    const incomplete = results.incomplete.map(({ id }) => id).sort();
    console.info(`axe: violations=${violations.length} incomplete=[${incomplete.join(', ')}]`);
    expect(violations, JSON.stringify(violations)).toEqual([]);
  });
});
