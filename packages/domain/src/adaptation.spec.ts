import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import {
  ADAPTATION_ENTRY_KIND,
  ADAPTATION_STATES,
  AdaptationPublicationSchema,
  BuildAdaptationSchema,
  EVIDENCE_REQUIREMENT_BY_RIGHTS,
  EVIDENCE_STATUSES,
  EVIDENCE_TYPES,
  PERMISSION_REQUEST_STATUSES,
  PermissionRequestSchema,
  SOURCE_CHANGE_OUTCOMES,
  SOURCE_CHANGE_TYPES,
  SourceChangeEventSchema,
  SourceRightsEvidenceSchema,
  TAKEDOWN_ACTIONS,
  TakedownEventSchema,
  TRANSFORMATION_SCOPES,
  isPermissionGranted,
  isPublishableRightsStatus,
  requiredEvidenceType,
} from './adaptation.js';
import type { BuildAdaptation, SourceRightsEvidence } from './adaptation.js';
import { RIGHTS_STATUSES } from './schema.js';

// Synthetic fixtures owned by this repo: no third-party build text is copied.
const evidence = (): SourceRightsEvidence => ({
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
  valid_until: '2027-01-01',
  status: 'vigente',
  verified_by: 'Revisor de derechos sintético',
  verified_on: '2026-01-02',
});

const permissionEvidence = (): SourceRightsEvidence => ({
  ...evidence(),
  id: 'evidencia-permiso',
  evidence_type: 'permiso_escrito',
  license_name: null,
  license_url: null,
});

const adaptation = (): BuildAdaptation => ({
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

type ParseResult = { success: true } | { success: false; error: ZodError };
const issuePaths = (result: ParseResult): PropertyKey[][] =>
  result.success ? [] : result.error.issues.map((issue) => issue.path);
const failedOn = (result: ParseResult, field: string): boolean =>
  !result.success && result.error.issues.some((issue) => issue.path.includes(field));

describe('adaptation enums match data-model rev. 6', () => {
  it('fixes every published enum value', () => {
    expect([...EVIDENCE_TYPES]).toEqual(['licencia_explicita', 'permiso_escrito']);
    expect([...EVIDENCE_STATUSES]).toEqual(['vigente', 'caducada', 'revocada']);
    expect([...TRANSFORMATION_SCOPES]).toEqual([
      'estructura',
      'traduccion',
      'reescritura',
      'datos_factuales',
    ]);
    expect([...ADAPTATION_STATES]).toEqual([
      'borrador',
      'en_revision',
      'publicado',
      'revision_pendiente',
      'retirada',
    ]);
    expect([...PERMISSION_REQUEST_STATUSES]).toEqual([
      'enviada',
      'concedida',
      'denegada',
      'limitada',
      'sin_respuesta',
    ]);
    expect([...TAKEDOWN_ACTIONS]).toEqual(['link_only', 'retirada_total', 'rechazada']);
    expect([...SOURCE_CHANGE_TYPES]).toEqual([
      'edicion',
      'licencia',
      'eliminacion',
      'bloqueo',
      'sin_cambios',
    ]);
    expect([...SOURCE_CHANGE_OUTCOMES]).toEqual(['sin_accion', 'revision_abierta', 'retirada']);
    expect(ADAPTATION_ENTRY_KIND).toBe('build_adaptada');
    expect([...RIGHTS_STATUSES]).toEqual([
      'pending',
      'own_original',
      'licensed',
      'permission_granted',
      'link_only',
    ]);
  });
});

describe('source_rights_evidence', () => {
  it('accepts a current explicit license and a current written permission', () => {
    expect(SourceRightsEvidenceSchema.parse(evidence())).toEqual(evidence());
    expect(SourceRightsEvidenceSchema.parse(permissionEvidence())).toEqual(permissionEvidence());
  });

  it('requires name and URL for an explicit license', () => {
    expect(
      failedOn(
        SourceRightsEvidenceSchema.safeParse({ ...evidence(), license_name: null }),
        'license_name',
      ),
    ).toBe(true);
    expect(
      failedOn(
        SourceRightsEvidenceSchema.safeParse({ ...evidence(), license_url: null }),
        'license_url',
      ),
    ).toBe(true);
  });

  it('never treats a written permission as a license', () => {
    expect(
      failedOn(
        SourceRightsEvidenceSchema.safeParse({
          ...permissionEvidence(),
          license_name: 'Licencia improcedente',
        }),
        'license_name',
      ),
    ).toBe(true);
    expect(
      failedOn(
        SourceRightsEvidenceSchema.safeParse({
          ...permissionEvidence(),
          license_url: 'https://example.invalid/licencia',
        }),
        'license_url',
      ),
    ).toBe(true);
  });

  it('keeps explicit states instead of recalculating expiry from the clock', () => {
    const expired = { ...evidence(), status: 'caducada' as const, valid_until: '2026-03-01' };
    expect(SourceRightsEvidenceSchema.safeParse(expired).success).toBe(true);
    expect(
      failedOn(
        SourceRightsEvidenceSchema.safeParse({ ...expired, valid_until: null }),
        'valid_until',
      ),
    ).toBe(true);
    expect(
      failedOn(
        SourceRightsEvidenceSchema.safeParse({ ...evidence(), valid_until: '2025-12-31' }),
        'valid_until',
      ),
    ).toBe(true);
    const revoked = { ...evidence(), status: 'revocada' as const };
    expect(SourceRightsEvidenceSchema.safeParse(revoked).success).toBe(true);
  });

  it('keeps evidence without adaptation coverage as valid data', () => {
    const linkOnlyEvidence = { ...permissionEvidence(), covers_adaptation: false };
    expect(SourceRightsEvidenceSchema.safeParse(linkOnlyEvidence).success).toBe(true);
  });

  it('accepts only HTTP(S) license URLs', () => {
    expect(
      failedOn(
        SourceRightsEvidenceSchema.safeParse({
          ...evidence(),
          license_url: 'ftp://example.invalid/licencia',
        }),
        'license_url',
      ),
    ).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(
      SourceRightsEvidenceSchema.safeParse({ ...evidence(), captured_at: '2026-01-01' }).success,
    ).toBe(false);
  });
});

describe('build_adaptations (FR-28 provenance)', () => {
  it('round-trips a complete published adaptation', () => {
    expect(BuildAdaptationSchema.parse(adaptation())).toEqual(adaptation());
  });

  it('rejects a missing or altered entry_kind', () => {
    expect(
      failedOn(
        BuildAdaptationSchema.safeParse({ ...adaptation(), entry_kind: 'build_propia' }),
        'entry_kind',
      ),
    ).toBe(true);
    const { entry_kind: _entryKind, ...rest } = adaptation();
    expect(issuePaths(BuildAdaptationSchema.safeParse(rest))).toContainEqual(['entry_kind']);
    expect(_entryKind).toBe(ADAPTATION_ENTRY_KIND);
  });

  it('requires every FR-28 field', () => {
    const required = [
      'build_slug',
      'source_slug',
      'evidence_id',
      'rights_status',
      'source_url',
      'original_title',
      'original_author',
      'original_site',
      'retrieved_on',
      'adaptation_editor',
      'rights_verified_by',
      'transformation_scope',
      'transformation_notes',
      'adaptation_version',
      'last_reviewed_on',
      'reviewed_by',
      'change_log',
      'attribution_text',
      'adaptation_state',
    ] as const;
    for (const field of required) {
      const withoutField = Object.fromEntries(
        Object.entries(adaptation()).filter(([key]) => key !== field),
      );
      const result = BuildAdaptationSchema.safeParse(withoutField);
      expect(result.success, `missing ${field} must fail`).toBe(false);
      expect(issuePaths(result), `missing ${field} must point at the field`).toContainEqual([
        field,
      ]);
    }
  });

  it('rejects a short attribution text', () => {
    expect(
      failedOn(
        BuildAdaptationSchema.safeParse({ ...adaptation(), attribution_text: 'corta' }),
        'attribution_text',
      ),
    ).toBe(true);
  });

  it('rejects the editor verifying its own rights evidence (AC-20)', () => {
    const samePerson = { ...adaptation(), rights_verified_by: adaptation().adaptation_editor };
    expect(failedOn(BuildAdaptationSchema.safeParse(samePerson), 'rights_verified_by')).toBe(true);
  });

  it('keeps version and change log coherent', () => {
    expect(
      failedOn(
        BuildAdaptationSchema.safeParse({ ...adaptation(), adaptation_version: 3 }),
        'adaptation_version',
      ),
    ).toBe(true);
    expect(
      failedOn(BuildAdaptationSchema.safeParse({ ...adaptation(), change_log: [] }), 'change_log'),
    ).toBe(true);
    expect(
      failedOn(
        BuildAdaptationSchema.safeParse({ ...adaptation(), change_log: [] }),
        'adaptation_version',
      ),
    ).toBe(true);
    // The last history entry must be the current version, so an unordered log is incoherent.
    const descending = { ...adaptation(), change_log: [...adaptation().change_log].reverse() };
    expect(failedOn(BuildAdaptationSchema.safeParse(descending), 'adaptation_version')).toBe(true);
  });

  it('requires a non-empty scope without duplicates', () => {
    expect(
      failedOn(
        BuildAdaptationSchema.safeParse({ ...adaptation(), transformation_scope: [] }),
        'transformation_scope',
      ),
    ).toBe(true);
    expect(
      failedOn(
        BuildAdaptationSchema.safeParse({
          ...adaptation(),
          transformation_scope: ['estructura', 'estructura'],
        }),
        'transformation_scope',
      ),
    ).toBe(true);
    expect(
      failedOn(
        BuildAdaptationSchema.safeParse({
          ...adaptation(),
          transformation_scope: ['imagenes'],
        }),
        'transformation_scope',
      ),
    ).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(
      BuildAdaptationSchema.safeParse({ ...adaptation(), adaptation_note: 'extra' }).success,
    ).toBe(false);
  });
});

describe('publication gate (T-104)', () => {
  const publication = () => ({ adaptation: adaptation(), evidence: evidence() });

  it('publishes a licensed adaptation whose current evidence covers adaptation and translation', () => {
    expect(AdaptationPublicationSchema.parse(publication())).toEqual(publication());
    const permission = {
      adaptation: {
        ...adaptation(),
        rights_status: 'permission_granted' as const,
        evidence_id: 'evidencia-permiso',
      },
      evidence: permissionEvidence(),
    };
    expect(AdaptationPublicationSchema.safeParse(permission).success).toBe(true);
  });

  it('rejects non-publishable rights statuses (a)', () => {
    for (const rights_status of ['pending', 'link_only', 'own_original'] as const) {
      const result = AdaptationPublicationSchema.safeParse({
        adaptation: { ...adaptation(), rights_status, evidence_id: 'evidencia-permiso' },
        evidence: permissionEvidence(),
      });
      expect(failedOn(result, 'rights_status'), rights_status).toBe(true);
    }
  });

  it('rejects evidence from another source or another record (b)', () => {
    expect(
      failedOn(
        AdaptationPublicationSchema.safeParse({
          ...publication(),
          evidence: { ...evidence(), source_slug: 'otra-fuente' },
        }),
        'source_slug',
      ),
    ).toBe(true);
    expect(
      failedOn(
        AdaptationPublicationSchema.safeParse({
          ...publication(),
          evidence: { ...evidence(), id: 'otra-evidencia' },
        }),
        'id',
      ),
    ).toBe(true);
  });

  it('rejects evidence without adaptation coverage (c)', () => {
    expect(
      failedOn(
        AdaptationPublicationSchema.safeParse({
          ...publication(),
          evidence: { ...evidence(), covers_adaptation: false },
        }),
        'covers_adaptation',
      ),
    ).toBe(true);
  });

  it('rejects expired or revoked evidence (d)', () => {
    for (const status of ['caducada', 'revocada'] as const) {
      const result = AdaptationPublicationSchema.safeParse({
        ...publication(),
        evidence: { ...evidence(), status },
      });
      expect(failedOn(result, 'status'), status).toBe(true);
    }
  });

  it('rejects evidence expired at the last review date (e)', () => {
    expect(
      failedOn(
        AdaptationPublicationSchema.safeParse({
          ...publication(),
          evidence: { ...evidence(), valid_until: '2026-05-31' },
        }),
        'valid_until',
      ),
    ).toBe(true);
    expect(
      AdaptationPublicationSchema.safeParse({
        ...publication(),
        evidence: { ...evidence(), valid_until: null },
      }).success,
    ).toBe(true);
  });

  it('rejects evidence whose type does not match the rights status (f)', () => {
    expect(
      failedOn(
        AdaptationPublicationSchema.safeParse({
          adaptation: { ...adaptation(), rights_status: 'permission_granted' },
          evidence: evidence(),
        }),
        'evidence_type',
      ),
    ).toBe(true);
  });

  it('requires translation coverage for a declared translation (g)', () => {
    expect(
      failedOn(
        AdaptationPublicationSchema.safeParse({
          ...publication(),
          evidence: { ...evidence(), covers_translation: false },
        }),
        'covers_translation',
      ),
    ).toBe(true);
    // Without a declared translation, translation coverage is irrelevant.
    expect(
      AdaptationPublicationSchema.safeParse({
        adaptation: { ...adaptation(), transformation_scope: ['estructura'] },
        evidence: { ...evidence(), covers_translation: false },
      }).success,
    ).toBe(true);
    // Factual data does not require image rights.
    expect(
      AdaptationPublicationSchema.safeParse({
        ...publication(),
        adaptation: { ...adaptation(), transformation_scope: ['datos_factuales'] },
        evidence: { ...evidence(), covers_images: false },
      }).success,
    ).toBe(true);
  });

  it('does not gate drafts, reviews, pending reviews or withdrawn records', () => {
    for (const adaptation_state of [
      'borrador',
      'en_revision',
      'revision_pendiente',
      'retirada',
    ] as const) {
      const result = AdaptationPublicationSchema.safeParse({
        adaptation: {
          ...adaptation(),
          adaptation_state,
          rights_status: 'pending',
          evidence_id: 'evidencia-permiso',
        },
        evidence: { ...permissionEvidence(), status: 'revocada', covers_adaptation: false },
      });
      expect(result.success, adaptation_state).toBe(true);
    }
  });

  it('rejects unknown fields', () => {
    expect(AdaptationPublicationSchema.safeParse({ ...publication(), extra: true }).success).toBe(
      false,
    );
  });
});

describe('rights helpers', () => {
  it('maps each rights status to the evidence it requires', () => {
    expect(EVIDENCE_REQUIREMENT_BY_RIGHTS.licensed).toBe('licencia_explicita');
    expect(EVIDENCE_REQUIREMENT_BY_RIGHTS.permission_granted).toBe('permiso_escrito');
    expect(EVIDENCE_REQUIREMENT_BY_RIGHTS.pending).toBeNull();
    expect(EVIDENCE_REQUIREMENT_BY_RIGHTS.link_only).toBeNull();
    expect(EVIDENCE_REQUIREMENT_BY_RIGHTS.own_original).toBeNull();
    for (const rights_status of RIGHTS_STATUSES) {
      expect(requiredEvidenceType(rights_status)).toBe(
        EVIDENCE_REQUIREMENT_BY_RIGHTS[rights_status],
      );
    }
    expect(Object.isFrozen(EVIDENCE_REQUIREMENT_BY_RIGHTS)).toBe(true);
  });

  it('publishes only licensed and permission_granted rights', () => {
    for (const rights_status of RIGHTS_STATUSES) {
      const publishable = rights_status === 'licensed' || rights_status === 'permission_granted';
      expect(isPublishableRightsStatus(rights_status), rights_status).toBe(publishable);
    }
  });
});

describe('permission_requests (FR-30/FR-31)', () => {
  const request = () => ({
    id: 'solicitud-sintetica',
    source_slug: 'fuente-externa',
    author_contact_ref: 'contacto-privado/sintetico',
    requested_on: '2026-01-05',
    scope_requested: 'Adaptar, traducir y atribuir con retirada bajo petición.',
    status: 'concedida' as const,
    response_ref: 'respuesta-privada/sintetica',
    responded_on: '2026-01-08',
  });

  it('accepts a granted request with its recorded response', () => {
    expect(PermissionRequestSchema.parse(request())).toEqual(request());
  });

  it('requires response reference and date when granted', () => {
    expect(
      failedOn(
        PermissionRequestSchema.safeParse({ ...request(), response_ref: null }),
        'response_ref',
      ),
    ).toBe(true);
    expect(
      failedOn(
        PermissionRequestSchema.safeParse({ ...request(), responded_on: null }),
        'responded_on',
      ),
    ).toBe(true);
  });

  it('requires a response reference when denied or limited', () => {
    for (const status of ['denegada', 'limitada'] as const) {
      const result = PermissionRequestSchema.safeParse({
        ...request(),
        status,
        response_ref: null,
      });
      expect(failedOn(result, 'response_ref'), status).toBe(true);
      expect(PermissionRequestSchema.safeParse({ ...request(), status }).success).toBe(true);
    }
  });

  it('keeps silence as no response at all', () => {
    const silence = {
      ...request(),
      status: 'sin_respuesta' as const,
      response_ref: null,
      responded_on: null,
    };
    expect(PermissionRequestSchema.safeParse(silence).success).toBe(true);
    expect(
      failedOn(
        PermissionRequestSchema.safeParse({ ...silence, response_ref: 'algo' }),
        'response_ref',
      ),
    ).toBe(true);
    expect(
      failedOn(
        PermissionRequestSchema.safeParse({ ...silence, responded_on: '2026-01-09' }),
        'response_ref',
      ),
    ).toBe(true);
  });

  it('rejects a response dated before the request', () => {
    expect(
      failedOn(
        PermissionRequestSchema.safeParse({ ...request(), responded_on: '2026-01-04' }),
        'responded_on',
      ),
    ).toBe(true);
  });

  it('treats only an explicit grant as permission', () => {
    expect(isPermissionGranted({ status: 'concedida' })).toBe(true);
    for (const status of ['enviada', 'denegada', 'limitada', 'sin_respuesta'] as const) {
      expect(isPermissionGranted({ status }), status).toBe(false);
    }
  });

  it('rejects unknown fields', () => {
    expect(PermissionRequestSchema.safeParse({ ...request(), channel: 'correo' }).success).toBe(
      false,
    );
  });
});

describe('takedown_events (FR-32)', () => {
  const event = () => ({
    id: 'retirada-sintetica',
    build_slug: 'build-adaptada-sintetica',
    tier_entry_ref: null,
    requested_by: 'Titular sintético',
    received_on: '2026-07-01',
    action: 'link_only' as const,
    executed_on: '2026-07-02',
    executed_by: 'Editor sintético',
    notes: 'Solicitud sintética de retirada.',
  });

  it('accepts an executed takedown targeting a build', () => {
    expect(TakedownEventSchema.parse(event())).toEqual(event());
    expect(
      TakedownEventSchema.safeParse({ ...event(), build_slug: null, tier_entry_ref: 'fila-1' })
        .success,
    ).toBe(true);
  });

  it('requires exactly one target', () => {
    expect(TakedownEventSchema.safeParse({ ...event(), build_slug: null }).success).toBe(false);
    expect(TakedownEventSchema.safeParse({ ...event(), tier_entry_ref: 'fila-1' }).success).toBe(
      false,
    );
  });

  it('requires execution for link-only and full takedowns', () => {
    for (const action of ['link_only', 'retirada_total'] as const) {
      expect(
        failedOn(
          TakedownEventSchema.safeParse({ ...event(), action, executed_by: null }),
          'executed_by',
        ),
      ).toBe(true);
      expect(
        failedOn(
          TakedownEventSchema.safeParse({ ...event(), action, executed_on: null }),
          'executed_on',
        ),
      ).toBe(true);
    }
  });

  it('records no execution for a rejected request', () => {
    const rejected = { ...event(), action: 'rechazada' as const };
    expect(
      TakedownEventSchema.safeParse({ ...rejected, executed_on: null, executed_by: null }).success,
    ).toBe(true);
    expect(
      failedOn(TakedownEventSchema.safeParse({ ...rejected, executed_by: null }), 'executed_on'),
    ).toBe(true);
  });

  it('rejects execution before the request was received', () => {
    expect(
      failedOn(
        TakedownEventSchema.safeParse({ ...event(), executed_on: '2026-06-30' }),
        'executed_on',
      ),
    ).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(TakedownEventSchema.safeParse({ ...event(), reason: 'copyright' }).success).toBe(false);
  });
});

describe('source_change_events (FR-33)', () => {
  const event = () => ({
    id: 'cambio-sintetico',
    source_slug: 'fuente-externa',
    build_slug: 'build-adaptada-sintetica',
    observed_on: '2026-08-01',
    change_type: 'edicion' as const,
    fingerprint: 'huella-sintetica',
    reviewed_by: 'Revisor sintético',
    outcome: 'revision_abierta' as const,
  });

  it('accepts a real change that opens an editorial review', () => {
    expect(SourceChangeEventSchema.parse(event())).toEqual(event());
    expect(
      SourceChangeEventSchema.safeParse({
        ...event(),
        change_type: 'sin_cambios',
        outcome: 'sin_accion',
        reviewed_by: null,
        fingerprint: null,
      }).success,
    ).toBe(true);
  });

  it('keeps no-change and no-action together', () => {
    expect(
      failedOn(
        SourceChangeEventSchema.safeParse({
          ...event(),
          change_type: 'sin_cambios',
          outcome: 'revision_abierta',
        }),
        'outcome',
      ),
    ).toBe(true);
    expect(
      failedOn(
        SourceChangeEventSchema.safeParse({ ...event(), outcome: 'sin_accion' }),
        'change_type',
      ),
    ).toBe(true);
  });

  it('rejects no action for removal, blocking or license changes', () => {
    for (const change_type of ['eliminacion', 'bloqueo', 'licencia'] as const) {
      const result = SourceChangeEventSchema.safeParse({
        ...event(),
        change_type,
        outcome: 'sin_accion',
      });
      expect(failedOn(result, 'change_type'), change_type).toBe(true);
      expect(
        SourceChangeEventSchema.safeParse({ ...event(), change_type, outcome: 'retirada' }).success,
        change_type,
      ).toBe(true);
    }
  });

  it('rejects unknown fields', () => {
    expect(SourceChangeEventSchema.safeParse({ ...event(), source_id: 'externo' }).success).toBe(
      false,
    );
  });
});
