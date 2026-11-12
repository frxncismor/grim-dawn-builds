import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SITE_BASE_URL } from './site-url';
import { SeoService, type JsonLdRecord } from './seo.service';

/*
 * Adversarial JSON-LD cases (T-141, plan §17.49). The structured data written
 * to `<head>` escapes script-breaking characters, rejects any private key at
 * any depth and never mutates the document when the payload is invalid.
 */

const SCRIPT_BREAKING = '</script><script>PRIVATE-INJECTION</script>&\u2028\u2029';

const record = (overrides: Record<string, unknown> = {}): JsonLdRecord =>
  ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: SCRIPT_BREAKING,
    ...overrides,
  }) as JsonLdRecord;

describe('adversarial SeoService: JSON-LD', () => {
  let service: SeoService;
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Adversarial');
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: doc },
        { provide: SITE_BASE_URL, useValue: 'https://example.test/site/' },
      ],
    });
    service = TestBed.inject(SeoService);
  });
  afterEach(() => TestBed.resetTestingModule());

  const jsonLdScript = () => doc.querySelector<HTMLScriptElement>('script#gd-page-jsonld');

  it('escapes script-breaking characters at any depth while keeping valid JSON', () => {
    service.setPage({
      title: SCRIPT_BREAKING,
      description: SCRIPT_BREAKING,
      path: '/builds/guia-adversarial',
      structuredData: [
        record({
          author: { '@type': 'Person', name: SCRIPT_BREAKING },
          isBasedOn: ['https://example.invalid/\u202E/guia'],
          nested: [{ deep: SCRIPT_BREAKING }],
        }),
      ],
    });

    const script = jsonLdScript();
    expect(script).not.toBeNull();
    const raw = script!.textContent ?? '';
    expect(raw).not.toContain('<');
    expect(raw).not.toContain('>');
    expect(raw).not.toContain('&');
    expect(raw).not.toContain('\u2028');
    expect(raw).not.toContain('\u2029');
    expect(doc.querySelectorAll('script')).toHaveLength(1);

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed['headline']).toBe(SCRIPT_BREAKING);
    expect((parsed['author'] as Record<string, unknown>)['name']).toBe(SCRIPT_BREAKING);
    expect((parsed['nested'] as Record<string, unknown>[])[0]?.['deep']).toBe(SCRIPT_BREAKING);
  });

  it.each([
    'reviewed_by',
    'reviewedAt',
    'rights_confirmed_by',
    'rights-confirmed-on',
    'rightsNotes',
    'permission_ref',
    'evidence_ref',
    'proofRef',
    'is_placeholder',
    'IS_PLACEHOLDER',
  ])('rejects the private key %s at any depth and never writes data', (key) => {
    service.setPage({
      title: 'Página segura',
      description: 'Descripción segura.',
      path: '/',
      structuredData: [record()],
    });
    const before = jsonLdScript()?.textContent;
    expect(before).toBeTruthy();

    for (const payload of [
      record({ [key]: 'PRIVATE-CANARY' }),
      record({ author: { '@type': 'Person', name: 'x', [key]: 'PRIVATE-CANARY' } }),
      record({ nested: [[{ [key]: 'PRIVATE-CANARY' }]] }),
    ]) {
      expect(() =>
        service.setPage({
          title: 'Página hostil',
          description: 'Descripción hostil.',
          path: '/builds/hostil',
          structuredData: [payload],
        }),
      ).toThrow('Datos estructurados inválidos.');
    }

    expect(doc.title).toBe('Página segura · Grim Dawn Builds');
    expect(jsonLdScript()?.textContent).toBe(before);
    expect(doc.body.textContent).not.toContain('PRIVATE-CANARY');
  });

  it.each([
    ['missing context', { '@type': 'Article', name: 'x' }],
    ['foreign context', { '@context': 'https://evil.example', '@type': 'Article' }],
    ['missing type', { '@context': 'https://schema.org' }],
    ['blank type', { '@context': 'https://schema.org', '@type': '   ' }],
    ['non-string type', { '@context': 'https://schema.org', '@type': 42 }],
  ])('rejects an invalid record (%s) before mutating the head', (_label, payload) => {
    const before = doc.title;
    expect(() =>
      service.setPage({
        title: 'Página hostil',
        description: 'Descripción hostil.',
        path: '/',
        structuredData: [payload as unknown as JsonLdRecord],
      }),
    ).toThrow('Datos estructurados inválidos.');
    expect(jsonLdScript()).toBeNull();
    expect(doc.title).toBe(before);
  });

  it('removes the previous JSON-LD when the next page has no structured data', () => {
    service.setPage({
      title: 'Con datos',
      description: 'Descripción.',
      path: '/',
      structuredData: [record()],
    });
    expect(jsonLdScript()).not.toBeNull();
    service.setPage({ title: 'Sin datos', description: 'Descripción.', path: '/' });
    expect(jsonLdScript()).toBeNull();
  });

  it('handles a 100 000 character string without throwing or truncating it', () => {
    const huge = `${'a'.repeat(100_000)}</script>`;
    service.setPage({
      title: 'Enorme',
      description: 'Descripción.',
      path: '/',
      structuredData: [record({ headline: huge })],
    });
    const raw = jsonLdScript()?.textContent ?? '';
    expect(raw).not.toContain('<');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed['headline']).toBe(huge);
  });
});
