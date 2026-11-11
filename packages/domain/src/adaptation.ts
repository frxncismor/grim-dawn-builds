import { z } from 'zod';
import { RIGHTS_STATUSES, type RightsStatus } from './schema.js';

/**
 * Third-party build adaptations: rights evidence, provenance, takedowns and
 * source-change events. Shapes follow specs/001-mvp-guias-builds/data-model.md
 * ("Adaptaciones de terceros", rev. 6), plan §15, FR-27–FR-33 and AC-20.
 *
 * Two modes never mix (plan §15.1): an adaptation (`entry_kind='build_adaptada'`)
 * publishes native content only with `rights_status ∈ {licensed, permission_granted}`
 * plus evidence that expressly covers adaptation; anything else is `link_only`.
 * Attribution alone never authorizes an adaptation (Constitution I/VII, rev. 1.6.0).
 *
 * T-104 scope: Zod shapes plus the minimal publication gate checks in
 * `AdaptationPublicationSchema`. The full checklist (plan §15.2) and the
 * degradation to link-only are T-107; database CHECK/triggers and the
 * `tier_entries` enum sync are T-108. `ADAPTATION_ENTRY_KIND` is therefore NOT
 * added to `ENTRY_KINDS` in schema.ts here: the SQL enum of `tier_entries` only
 * changes in T-108, and the T-058 parity test compares both sides, so adding it
 * now would break parity without a migration.
 */

export const EVIDENCE_TYPES = ['licencia_explicita', 'permiso_escrito'] as const;
export const EVIDENCE_STATUSES = ['vigente', 'caducada', 'revocada'] as const;
export const TRANSFORMATION_SCOPES = [
  'estructura',
  'traduccion',
  'reescritura',
  'datos_factuales',
] as const;
export const ADAPTATION_STATES = [
  'borrador',
  'en_revision',
  'publicado',
  'revision_pendiente',
  'retirada',
] as const;
export const PERMISSION_REQUEST_STATUSES = [
  'enviada',
  'concedida',
  'denegada',
  'limitada',
  'sin_respuesta',
] as const;
export const TAKEDOWN_ACTIONS = ['link_only', 'retirada_total', 'rechazada'] as const;
export const SOURCE_CHANGE_TYPES = [
  'edicion',
  'licencia',
  'eliminacion',
  'bloqueo',
  'sin_cambios',
] as const;
export const SOURCE_CHANGE_OUTCOMES = ['sin_accion', 'revision_abierta', 'retirada'] as const;
/** Entry kind for an adapted build; the SQL enum gains it in T-108, not here. */
export const ADAPTATION_ENTRY_KIND = 'build_adaptada' as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export type TransformationScope = (typeof TRANSFORMATION_SCOPES)[number];
export type AdaptationState = (typeof ADAPTATION_STATES)[number];
export type PermissionRequestStatus = (typeof PERMISSION_REQUEST_STATUSES)[number];
export type TakedownAction = (typeof TAKEDOWN_ACTIONS)[number];
export type SourceChangeType = (typeof SOURCE_CHANGE_TYPES)[number];
export type SourceChangeOutcome = (typeof SOURCE_CHANGE_OUTCOMES)[number];
export type AdaptationEntryKind = typeof ADAPTATION_ENTRY_KIND;

/** Adds a custom issue at `path` with a message in Spanish. */
type Ctx = z.RefinementCtx;
const fail = (ctx: Ctx, path: (string | number)[], message: string) =>
  ctx.addIssue({ code: 'custom', path, message });

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug en minúsculas ASCII');
const text = z.string().trim().min(1);
const isoDate = z.iso.date();
const httpUrl = z.url().refine((value) => /^https?:\/\//.test(value), 'URL HTTP(S) requerida');
const positiveVersion = z.number().int().positive();

/**
 * `source_rights_evidence` (data-model rev. 6, plan §15.2 checkpoint 1).
 * Evidence is private: `evidence_ref` points at the archived proof and is never
 * published. `verified_by/verified_on` are mandatory for every state so a
 * revoked or expired record keeps its traceability (plan §15.4).
 */
export const SourceRightsEvidenceSchema = z
  .object({
    id: slug,
    source_slug: slug,
    evidence_type: z.enum(EVIDENCE_TYPES),
    evidence_ref: text,
    license_name: text.nullable(),
    license_url: httpUrl.nullable(),
    covers_adaptation: z.boolean(),
    covers_translation: z.boolean(),
    covers_images: z.boolean(),
    scope_notes: text,
    granted_by: text,
    recorded_on: isoDate,
    valid_until: isoDate.nullable(),
    status: z.enum(EVIDENCE_STATUSES),
    verified_by: text,
    verified_on: isoDate,
  })
  .strict()
  .superRefine((evidence, ctx) => {
    // A license names its terms; a written permission is not a license.
    if (evidence.evidence_type === 'licencia_explicita') {
      if (!evidence.license_name) {
        fail(ctx, ['license_name'], 'una licencia explícita requiere nombre de licencia');
      }
      if (!evidence.license_url) {
        fail(ctx, ['license_url'], 'una licencia explícita requiere URL de licencia');
      }
    }
    if (evidence.evidence_type === 'permiso_escrito') {
      if (evidence.license_name !== null) {
        fail(
          ctx,
          ['license_name'],
          'un permiso escrito no es una licencia: license_name debe ser null',
        );
      }
      if (evidence.license_url !== null) {
        fail(
          ctx,
          ['license_url'],
          'un permiso escrito no es una licencia: license_url debe ser null',
        );
      }
    }
    // Expiry is data, never inferred from the clock: the status is explicit.
    if (
      evidence.status === 'vigente' &&
      evidence.valid_until !== null &&
      evidence.valid_until < evidence.recorded_on
    ) {
      fail(
        ctx,
        ['valid_until'],
        'la vigencia no puede terminar antes del registro de la evidencia',
      );
    }
    if (evidence.status === 'caducada' && evidence.valid_until === null) {
      fail(ctx, ['valid_until'], 'una evidencia caducada requiere fecha de caducidad');
    }
  });

export type SourceRightsEvidence = z.infer<typeof SourceRightsEvidenceSchema>;

const ChangeLogEntrySchema = z
  .object({
    adaptation_version: positiveVersion,
    changed_on: isoDate,
    summary: text,
  })
  .strict();

/**
 * `build_adaptations` (data-model rev. 6) with the FR-28 provenance fields.
 * Every field is mandatory: a missing FR-28 field makes the adaptation
 * unpublishable (AC-20). The editor of the adaptation and the person who
 * verified the rights evidence must differ (plan §15.2 checkpoint 2, AC-20).
 */
export const BuildAdaptationSchema = z
  .object({
    build_slug: slug,
    entry_kind: z.literal(ADAPTATION_ENTRY_KIND),
    source_slug: slug,
    evidence_id: slug,
    rights_status: z.enum(RIGHTS_STATUSES),
    source_url: httpUrl,
    original_title: text,
    original_author: text,
    original_site: text,
    retrieved_on: isoDate,
    adaptation_editor: text,
    rights_verified_by: text,
    transformation_scope: z.array(z.enum(TRANSFORMATION_SCOPES)).min(1),
    transformation_notes: text,
    adaptation_version: positiveVersion,
    source_revision_ref: text.nullable(),
    last_reviewed_on: isoDate,
    reviewed_by: text,
    change_log: z.array(ChangeLogEntrySchema).min(1),
    attribution_text: text.min(10),
    adaptation_state: z.enum(ADAPTATION_STATES),
  })
  .strict()
  .superRefine((adaptation, ctx) => {
    if (adaptation.adaptation_editor === adaptation.rights_verified_by) {
      fail(
        ctx,
        ['rights_verified_by'],
        'quien verifica los derechos no puede ser el editor de la adaptación',
      );
    }
    const scope = adaptation.transformation_scope;
    if (new Set(scope).size !== scope.length) {
      fail(ctx, ['transformation_scope'], 'alcances de transformación duplicados');
    }
    // Version and history move together: the last logged entry is the current version.
    const last = adaptation.change_log.at(-1);
    if (!last || last.adaptation_version !== adaptation.adaptation_version) {
      fail(
        ctx,
        ['adaptation_version'],
        'la versión debe coincidir con la última entrada del historial de cambios',
      );
    }
  });

export type BuildAdaptation = z.infer<typeof BuildAdaptationSchema>;

/**
 * Evidence type each rights status requires for an adaptation (plan §15.1).
 * `own_original` is a title attestation and does not apply to adaptations;
 * `pending` and `link_only` are never publishable, whatever the evidence says.
 */
export const EVIDENCE_REQUIREMENT_BY_RIGHTS: Readonly<Record<RightsStatus, EvidenceType | null>> =
  Object.freeze({
    pending: null,
    own_original: null,
    licensed: 'licencia_explicita',
    permission_granted: 'permiso_escrito',
    link_only: null,
  });

/** Evidence type the rights status demands, or null when no evidence enables publication. */
export function requiredEvidenceType(rights_status: RightsStatus): EvidenceType | null {
  return EVIDENCE_REQUIREMENT_BY_RIGHTS[rights_status];
}

/** Only licensed and permission_granted adaptations can ever be published (FR-27). */
export function isPublishableRightsStatus(rights_status: RightsStatus): boolean {
  return rights_status === 'licensed' || rights_status === 'permission_granted';
}

/**
 * T-104 publication gate: FR-28 provenance plus evidence covering the
 * adaptation. It only applies to `adaptation_state='publicado'`; drafts,
 * in-review, review-pending and withdrawn records may hold unresolved rights
 * (pending/revoked evidence is legitimate data). The complete checklist and
 * link-only degradation belong to T-107.
 */
export const AdaptationPublicationSchema = z
  .object({
    adaptation: BuildAdaptationSchema,
    evidence: SourceRightsEvidenceSchema,
  })
  .strict()
  .superRefine((publication, ctx) => {
    const { adaptation, evidence } = publication;
    if (adaptation.adaptation_state !== 'publicado') return;

    if (!isPublishableRightsStatus(adaptation.rights_status)) {
      fail(
        ctx,
        ['adaptation', 'rights_status'],
        `publicado no admite rights_status=${adaptation.rights_status}`,
      );
    }
    if (evidence.source_slug !== adaptation.source_slug) {
      fail(ctx, ['evidence', 'source_slug'], 'la evidencia no corresponde a la fuente indicada');
    }
    if (evidence.id !== adaptation.evidence_id) {
      fail(ctx, ['evidence', 'id'], 'la evidencia no es la referenciada por la adaptación');
    }
    if (!evidence.covers_adaptation) {
      fail(ctx, ['evidence', 'covers_adaptation'], 'la evidencia no cubre la adaptación');
    }
    if (evidence.status !== 'vigente') {
      fail(ctx, ['evidence', 'status'], `evidencia ${evidence.status} no habilita publicación`);
    }
    if (evidence.valid_until !== null && evidence.valid_until < adaptation.last_reviewed_on) {
      fail(ctx, ['evidence', 'valid_until'], 'la evidencia estaba caducada en la última revisión');
    }
    const requiredEvidence = requiredEvidenceType(adaptation.rights_status);
    if (requiredEvidence !== null && evidence.evidence_type !== requiredEvidence) {
      fail(
        ctx,
        ['evidence', 'evidence_type'],
        `rights_status=${adaptation.rights_status} requiere evidencia ${requiredEvidence}`,
      );
    }
    // Evidence scope must contain the transformation scope (plan §15.2 checkpoint 3).
    if (adaptation.transformation_scope.includes('traduccion') && !evidence.covers_translation) {
      fail(
        ctx,
        ['evidence', 'covers_translation'],
        'la evidencia no cubre la traducción declarada',
      );
    }
    // `datos_factuales` needs no image rights. If an image scope is added to
    // TRANSFORMATION_SCOPES later, it must require `covers_images`.
  });

export type AdaptationPublication = z.infer<typeof AdaptationPublicationSchema>;

/** `permission_requests` (data-model rev. 6, plan §15.3). Silence is not permission. */
export const PermissionRequestSchema = z
  .object({
    id: slug,
    source_slug: slug,
    author_contact_ref: text,
    requested_on: isoDate,
    scope_requested: text,
    status: z.enum(PERMISSION_REQUEST_STATUSES),
    response_ref: text.nullable(),
    responded_on: isoDate.nullable(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.status === 'concedida') {
      if (!request.response_ref) {
        fail(ctx, ['response_ref'], 'un permiso concedido requiere referencia de respuesta');
      }
      if (!request.responded_on) {
        fail(ctx, ['responded_on'], 'un permiso concedido requiere fecha de respuesta');
      }
    }
    if ((request.status === 'denegada' || request.status === 'limitada') && !request.response_ref) {
      fail(ctx, ['response_ref'], 'una respuesta denegada o limitada requiere referencia');
    }
    if (
      request.status === 'sin_respuesta' &&
      (request.response_ref !== null || request.responded_on !== null)
    ) {
      fail(ctx, ['response_ref'], 'sin_respuesta no puede registrar una respuesta');
    }
    if (request.responded_on !== null && request.responded_on < request.requested_on) {
      fail(ctx, ['responded_on'], 'la respuesta no puede ser anterior a la solicitud');
    }
  });

export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;

/**
 * Only an explicit grant counts as permission (FR-30/FR-31): `limitada` and
 * `sin_respuesta` are not permission and force the link-only mode.
 */
export function isPermissionGranted(request: { status: PermissionRequestStatus }): boolean {
  return request.status === 'concedida';
}

/** `takedown_events` (data-model rev. 6, plan §15.4/FR-32). */
export const TakedownEventSchema = z
  .object({
    id: slug,
    build_slug: slug.nullable(),
    tier_entry_ref: text.nullable(),
    requested_by: text,
    received_on: isoDate,
    action: z.enum(TAKEDOWN_ACTIONS),
    executed_on: isoDate.nullable(),
    executed_by: text.nullable(),
    notes: text,
  })
  .strict()
  .superRefine((event, ctx) => {
    const targetsBuild = event.build_slug !== null;
    const targetsTierEntry = event.tier_entry_ref !== null;
    if (targetsBuild === targetsTierEntry) {
      fail(ctx, ['build_slug'], 'requiere exactamente build_slug o tier_entry_ref');
    }
    if (event.action === 'rechazada') {
      if (event.executed_on !== null || event.executed_by !== null) {
        fail(ctx, ['executed_on'], 'una solicitud rechazada no registra ejecución');
      }
      return;
    }
    if (!event.executed_on) {
      fail(ctx, ['executed_on'], 'una acción de retirada requiere fecha de ejecución');
    }
    if (!event.executed_by) {
      fail(ctx, ['executed_by'], 'una acción de retirada requiere responsable');
    }
    if (event.executed_on !== null && event.executed_on < event.received_on) {
      fail(ctx, ['executed_on'], 'la ejecución no puede ser anterior a la recepción');
    }
  });

export type TakedownEvent = z.infer<typeof TakedownEventSchema>;

/** `source_change_events` (data-model rev. 6, plan §15.5/FR-33). */
export const SourceChangeEventSchema = z
  .object({
    id: slug,
    source_slug: slug,
    build_slug: slug.nullable(),
    observed_on: isoDate,
    change_type: z.enum(SOURCE_CHANGE_TYPES),
    fingerprint: text.nullable(),
    reviewed_by: text.nullable(),
    outcome: z.enum(SOURCE_CHANGE_OUTCOMES),
  })
  .strict()
  .superRefine((event, ctx) => {
    // "No change" and "no action" are the same non-event; any real change needs
    // an editorial review or a takedown (never an automatic update).
    if (event.outcome === 'sin_accion') {
      if (event.change_type !== 'sin_cambios') {
        fail(ctx, ['change_type'], 'sin_accion requiere change_type=sin_cambios');
      }
    } else if (event.change_type === 'sin_cambios') {
      fail(ctx, ['outcome'], 'sin_cambios requiere outcome=sin_accion');
    }
  });

export type SourceChangeEvent = z.infer<typeof SourceChangeEventSchema>;
