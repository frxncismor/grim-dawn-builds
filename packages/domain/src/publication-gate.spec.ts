import { describe, expect, it } from 'vitest';
import type { BuildAdaptation, SourceRightsEvidence } from './adaptation.js';
import {
  LINK_ONLY_METADATA_FIELDS,
  PUBLICATION_GATE_CHECKLIST_POINTS,
  PUBLICATION_GATE_CODES,
  evaluatePublicationGate,
  toLinkOnlyMetadata,
} from './publication-gate.js';
import type { PublicationGateInput, PublicationGateResult } from './publication-gate.js';

// Synthetic fixtures owned by this repo: no third-party build text is copied.
const baseEvidence = (): SourceRightsEvidence => ({
  id: 'evidencia-licencia',
  source_slug: 'fuente-externa',
  evidence_type: 'licencia_explicita',
  evidence_ref: 'evidencia-privada/licencia-sintetica.txt',
  license_name: 'Licencia sintética de ejemplo',
  license_url: 'https://example.invalid/licencia',
  covers_adaptation: true,
  covers_translation: true,
  covers_images: false,
  scope_notes: 'Alcance sintético para pruebas de dominio.',
  granted_by: 'Titular sintético',
  recorded_on: '2026-01-01',
  valid_until: '2026-12-31',
  status: 'vigente',
  verified_by: 'Revisor de derechos sintético',
  verified_on: '2026-01-02',
});

const baseAdaptation = (): BuildAdaptation => ({
  build_slug: 'build-adaptada-sintetica',
  entry_kind: 'build_adaptada',
  source_slug: 'fuente-externa',
  evidence_id: 'evidencia-licencia',
  rights_status: 'licensed',
  source_url: 'https://example.invalid/build-original',
  original_title: 'Build original sintética',
  original_author: 'Autor sintético',
  original_site: 'Sitio sintético',
  retrieved_on: '2026-01-10',
  adaptation_editor: 'Editor sintético',
  rights_verified_by: 'Revisor de derechos sintético',
  transformation_scope: ['estructura', 'traduccion'],
  transformation_notes: 'Se conservó la estructura y se tradujo el texto al español.',
  adaptation_version: 2,
  source_revision_ref: 'revision-7',
  last_reviewed_on: '2026-06-01',
  reviewed_by: 'Revisor de contenido sintético',
  change_log: [
    { adaptation_version: 1, changed_on: '2026-02-01', summary: 'Primera adaptación.' },
    { adaptation_version: 2, changed_on: '2026-06-01', summary: 'Revisión contra el juego.' },
  ],
  attribution_text: 'Esta build fue adaptada de la fuente sintética.',
  adaptation_state: 'publicado',
});

const evidenceWith = (overrides: Partial<SourceRightsEvidence>): SourceRightsEvidence => ({
  ...baseEvidence(),
  ...overrides,
});

const adaptationWith = (overrides: Partial<BuildAdaptation>): BuildAdaptation => ({
  ...baseAdaptation(),
  ...overrides,
});

const gate = (
  adaptation: BuildAdaptation = baseAdaptation(),
  evidence: SourceRightsEvidence | null = baseEvidence(),
  today = '2026-07-01',
): PublicationGateResult => evaluatePublicationGate({ adaptation, evidence, today });

const codes = (result: PublicationGateResult): string[] =>
  result.failures.map((failure) => failure.code);

describe('publication gate codes', () => {
  it('fixes the stable failure codes and the checklist point each one traces to', () => {
    expect({ ...PUBLICATION_GATE_CODES }).toEqual({
      sin_evidencia: '1',
      evidencia_no_corresponde: '1',
      evidencia_no_cubre_adaptacion: '1',
      evidencia_tipo_incoherente: '1',
      evidencia_revocada: '1',
      evidencia_caducada: '1',
      solo_atribucion: '1',
      mismo_revisor_y_editor: '2',
      evidencia_no_cubre_traduccion: '3',
      metadatos_incompletos: '4',
      sin_revision_de_contenido: '6',
      revision_de_contenido_por_editor: '6',
      derechos_no_publicables: '7',
      estado_no_publicable: '7',
      estado_degradado: '7',
    });
  });

  it('traces every code to a checklist point and covers every domain point', () => {
    for (const point of Object.values(PUBLICATION_GATE_CODES)) {
      expect(PUBLICATION_GATE_CHECKLIST_POINTS).toContain(point);
    }
    const covered = [...new Set(Object.values(PUBLICATION_GATE_CODES))].sort();
    expect(covered).toEqual(['1', '2', '3', '4', '6', '7']);
    // Point 5 (rendered attribution) is T-105 UI and SQL CHECK/trigger is T-108.
    expect(PUBLICATION_GATE_CHECKLIST_POINTS).not.toContain('5');
  });
});

describe('evaluatePublicationGate', () => {
  it('publishes when the whole checklist passes', () => {
    const result = gate();

    expect(result).toEqual({ outcome: 'publicado', failures: [] });
  });

  it('keeps the expiry boundary: valid_until equal to today is still current', () => {
    const result = gate(baseAdaptation(), evidenceWith({ valid_until: '2026-07-01' }));

    expect(result.outcome).toBe('publicado');
    expect(result.failures).toEqual([]);
  });

  it('rejects an attribution-only adaptation', () => {
    const result = gate(baseAdaptation(), evidenceWith({ covers_adaptation: false }));

    expect(result.outcome).toBe('rechazada');
    expect(codes(result)).toEqual(['evidencia_no_cubre_adaptacion', 'solo_atribucion']);
  });

  it('rejects an adaptation without any evidence record', () => {
    const result = gate(baseAdaptation(), null);

    expect(result.outcome).toBe('rechazada');
    expect(codes(result)).toEqual(['sin_evidencia', 'solo_atribucion']);
  });

  it('degrades to link-only when the evidence was revoked', () => {
    const result = gate(baseAdaptation(), evidenceWith({ status: 'revocada' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['evidencia_revocada']);
  });

  it('degrades to link-only when valid_until is before today', () => {
    const result = gate(baseAdaptation(), evidenceWith({ valid_until: '2026-06-30' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['evidencia_caducada']);
  });

  it('degrades to link-only when the evidence is marked caducada', () => {
    const result = gate(baseAdaptation(), evidenceWith({ status: 'caducada' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['evidencia_caducada']);
  });

  it('degrades to link-only while a source-change review is open', () => {
    const result = gate(adaptationWith({ adaptation_state: 'revision_pendiente' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['estado_degradado']);
  });

  it('degrades to link-only when the adaptation was withdrawn', () => {
    const result = gate(adaptationWith({ adaptation_state: 'retirada' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['estado_degradado']);
  });

  it('degrades to link-only when rights_status is not publishable but evidence exists', () => {
    const result = gate(adaptationWith({ rights_status: 'pending' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['derechos_no_publicables']);
  });

  it('rejects a non-publishable rights status without evidence', () => {
    const result = gate(adaptationWith({ rights_status: 'pending' }), null);

    expect(result.outcome).toBe('rechazada');
    expect(codes(result)).toEqual(['sin_evidencia', 'solo_atribucion', 'derechos_no_publicables']);
  });

  it('rejects a draft with a publication attempt', () => {
    const result = gate(adaptationWith({ adaptation_state: 'borrador' }));

    expect(result.outcome).toBe('rechazada');
    expect(codes(result)).toEqual(['estado_no_publicable']);
  });

  it('rejects an in-review adaptation', () => {
    const result = gate(adaptationWith({ adaptation_state: 'en_revision' }));

    expect(result.outcome).toBe('rechazada');
    expect(codes(result)).toEqual(['estado_no_publicable']);
  });

  it('does not publish when the rights reviewer is also the adaptation editor', () => {
    const result = gate(adaptationWith({ rights_verified_by: 'Editor sintético' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['mismo_revisor_y_editor']);
  });

  it('does not publish without a content review', () => {
    const result = gate(adaptationWith({ reviewed_by: '   ' }));

    expect(result.outcome).toBe('link_only');
    // `reviewed_by` is also an FR-28 field, so points 4 and 6 both fail.
    expect(codes(result)).toEqual(['metadatos_incompletos', 'sin_revision_de_contenido']);
  });

  it('does not publish when the content reviewer is the adaptation editor', () => {
    const result = gate(adaptationWith({ reviewed_by: 'Editor sintético' }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['revision_de_contenido_por_editor']);
  });

  it('does not publish with incomplete FR-28 metadata', () => {
    const result = gate(
      adaptationWith({ original_author: '  ', transformation_notes: '', last_reviewed_on: '' }),
    );

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['metadatos_incompletos']);
    expect(result.failures[0]?.message).toContain('original_author');
    expect(result.failures[0]?.message).toContain('transformation_notes');
    expect(result.failures[0]?.message).toContain('last_reviewed_on');
  });

  it('does not publish a declared translation without translation coverage', () => {
    const result = gate(baseAdaptation(), evidenceWith({ covers_translation: false }));

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual(['evidencia_no_cubre_traduccion']);
  });

  it('rejects evidence from another source or another record', () => {
    const fromAnotherSource = gate(baseAdaptation(), evidenceWith({ source_slug: 'otra-fuente' }));
    const fromAnotherRecord = gate(baseAdaptation(), evidenceWith({ id: 'evidencia-ajena' }));

    expect(fromAnotherSource.outcome).toBe('rechazada');
    expect(codes(fromAnotherSource)).toEqual(['evidencia_no_corresponde', 'solo_atribucion']);
    expect(fromAnotherRecord.outcome).toBe('rechazada');
    expect(codes(fromAnotherRecord)).toEqual(['evidencia_no_corresponde', 'solo_atribucion']);
  });

  it('rejects an evidence type that contradicts rights_status', () => {
    const result = gate(baseAdaptation(), evidenceWith({ evidence_type: 'permiso_escrito' }));

    expect(result.outcome).toBe('rechazada');
    expect(codes(result)).toEqual(['evidencia_tipo_incoherente', 'solo_atribucion']);
  });

  it('reports every failure in checklist order', () => {
    const result = gate(
      adaptationWith({
        adaptation_state: 'revision_pendiente',
        adaptation_editor: 'Editor sintético',
        rights_verified_by: 'Editor sintético',
        reviewed_by: '',
        original_site: ' ',
      }),
      evidenceWith({ status: 'revocada', covers_translation: false }),
    );

    expect(result.outcome).toBe('link_only');
    expect(codes(result)).toEqual([
      'evidencia_revocada',
      'mismo_revisor_y_editor',
      'evidencia_no_cubre_traduccion',
      'metadatos_incompletos',
      'sin_revision_de_contenido',
      'estado_degradado',
    ]);
    for (const failure of result.failures) {
      expect(failure.checklist_point).toBe(PUBLICATION_GATE_CODES[failure.code]);
      expect(failure.message.trim().length).toBeGreaterThan(0);
    }
  });

  it('is deterministic: the outcome follows the injected date, never the clock', () => {
    const input: PublicationGateInput = {
      adaptation: baseAdaptation(),
      evidence: evidenceWith({ valid_until: '2026-07-31' }),
      today: '2026-07-01',
    };

    expect(evaluatePublicationGate(input)).toEqual(evaluatePublicationGate(input));
    expect(evaluatePublicationGate(input).outcome).toBe('publicado');
    expect(evaluatePublicationGate({ ...input, today: '2026-08-01' }).outcome).toBe('link_only');
  });

  it('rejects an evaluation date that is not ISO', () => {
    expect(() => gate(baseAdaptation(), baseEvidence(), '01/07/2026')).toThrow(TypeError);
  });

  it('exposes the full adaptation for callers: it does not mutate its input', () => {
    const adaptation = baseAdaptation();
    const evidence = baseEvidence();
    const snapshot = structuredClone({ adaptation, evidence });

    evaluatePublicationGate({ adaptation, evidence, today: '2026-07-01' });

    expect({ adaptation, evidence }).toEqual(snapshot);
  });
});

describe('toLinkOnlyMetadata', () => {
  it('keeps only the factual metadata allowed on a link-only card', () => {
    const metadata = toLinkOnlyMetadata(baseAdaptation());

    expect(metadata).toEqual({
      source_url: 'https://example.invalid/build-original',
      original_title: 'Build original sintética',
      original_author: 'Autor sintético',
      original_site: 'Sitio sintético',
      retrieved_on: '2026-01-10',
      attribution_text: 'Esta build fue adaptada de la fuente sintética.',
    });
    expect(Object.keys(metadata).sort()).toEqual([...LINK_ONLY_METADATA_FIELDS].sort());
  });

  it('drops body, internal notes, evidence and derived fields', () => {
    const metadata: Record<string, unknown> = { ...toLinkOnlyMetadata(baseAdaptation()) };

    for (const forbidden of [
      'transformation_notes',
      'evidence_id',
      'evidence_ref',
      'source_revision_ref',
      'change_log',
      'adaptation_editor',
      'rights_verified_by',
      'reviewed_by',
      'adaptation_version',
      'rights_status',
      'adaptation_state',
    ]) {
      expect(forbidden in metadata).toBe(false);
    }
  });

  it('does not mutate the adaptation it reads', () => {
    const adaptation = baseAdaptation();
    const snapshot = structuredClone(adaptation);

    toLinkOnlyMetadata(adaptation);

    expect(adaptation).toEqual(snapshot);
  });
});
