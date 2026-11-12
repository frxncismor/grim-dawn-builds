import {
  isPublishableRightsStatus,
  requiredEvidenceType,
  type BuildAdaptation,
  type SourceRightsEvidence,
} from './adaptation.js';

/**
 * Pure publication gate for third-party build adaptations (T-107).
 *
 * It applies the full checklist of plan §15.2 to an already parsed adaptation
 * and its referenced rights evidence, and decides whether the record may be
 * published natively, degraded to a link-only card, or rejected. Nothing here
 * touches the database, the filesystem, HTTP or the clock: `today` is injected,
 * so callers (fixtures, API, SQL mirrors in T-108) get the same answer for the
 * same input. The Zod shapes of `adaptation.ts` stay untouched; the SQL CHECK
 * and trigger that mirror this gate are T-108.
 *
 * Checklist mapping (plan §15.2, data-model «Adaptaciones de terceros»):
 *
 * 1. Source plus `source_rights_evidence` (type, private proof, scope,
 *    validity): `sin_evidencia`, `evidencia_no_corresponde`,
 *    `evidencia_no_cubre_adaptacion`, `evidencia_tipo_incoherente`,
 *    `evidencia_revocada`, `evidencia_caducada`, `solo_atribucion`.
 * 2. Rights reviewer ≠ adaptation editor (AC-20): `mismo_revisor_y_editor`.
 * 3. Evidence scope ⊇ `transformation_scope`:
 *    `evidencia_no_cubre_traduccion`.
 * 4. Complete FR-28 metadata: `metadatos_incompletos`.
 * 6. Content review against the game (`reviewed_by`):
 *    `sin_revision_de_contenido`, `revision_de_contenido_por_editor`.
 * 7. Any failure ⇒ never publish (`borrador` / link-only):
 *    `derechos_no_publicables`, `estado_no_publicable`, `estado_degradado`.
 *
 * Point 5 (rendered attribution inspected by a UI test) belongs to T-105 and is
 * deliberately out of the domain gate; `covers_images` is not required yet
 * because no image scope exists in `TRANSFORMATION_SCOPES`. If an image
 * transformation scope is added, point 3 must also demand `covers_images`.
 *
 * Why `link_only` is not a «degraded published build»: publishing an adaptation
 * hands the reader a native, derived build; `link_only` hands them a card that
 * only names the source (title, author, site, URL, date and attribution) and
 * carries no derived body, image, asset or ranking claim (plan §15.1,
 * Constitution I/VII). They are two modes that never mix, so the gate returns
 * the mode the record is allowed to appear in — never one mode with some fields
 * of the other. `rechazada` is the remaining case: the record never held a
 * rights basis covering the adaptation (attribution alone is not permission),
 * or it is still a draft/in review, so not even the source card may be derived
 * from it; it must be fixed or dropped instead of published.
 */

/** Domain points of the plan §15.2 checklist. Point 5 is T-105 (UI). */
export const PUBLICATION_GATE_CHECKLIST_POINTS = ['1', '2', '3', '4', '6', '7'] as const;

export type PublicationGateChecklistPoint = (typeof PUBLICATION_GATE_CHECKLIST_POINTS)[number];

/**
 * Stable, Spanish failure codes and the checklist point each one traces to.
 * Codes are part of the domain contract: the API/SQL mirrors of T-108 and the
 * UI of T-105/T-106 should reuse them instead of inventing new wording.
 */
export const PUBLICATION_GATE_CODES = Object.freeze({
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
} as const satisfies Readonly<Record<string, PublicationGateChecklistPoint>>);

export type PublicationGateCode = keyof typeof PUBLICATION_GATE_CODES;

/** Mode a record is allowed to appear in. There is no fourth, implicit mode. */
export type PublicationOutcome = 'publicado' | 'link_only' | 'rechazada';

export interface PublicationGateFailure {
  readonly code: PublicationGateCode;
  /** Plan §15.2 checklist point the failure traces back to. */
  readonly checklist_point: PublicationGateChecklistPoint;
  readonly message: string;
}

export interface PublicationGateResult {
  readonly outcome: PublicationOutcome;
  readonly failures: readonly PublicationGateFailure[];
}

export interface PublicationGateInput {
  readonly adaptation: BuildAdaptation;
  /** Evidence referenced by `adaptation.evidence_id`, or null when none is recorded. */
  readonly evidence: SourceRightsEvidence | null;
  /** Evaluation date (`AAAA-MM-DD`). Injected so the gate never reads the clock. */
  readonly today: string;
}

const fail = (code: PublicationGateCode, message: string): PublicationGateFailure => ({
  code,
  checklist_point: PUBLICATION_GATE_CODES[code],
  message,
});

/** FR-28 provenance fields every adaptation must carry (plan §15.2 point 4). */
export const FR28_METADATA_FIELDS = [
  'source_url',
  'original_title',
  'original_author',
  'original_site',
  'retrieved_on',
  'transformation_notes',
  'attribution_text',
  'reviewed_by',
  'last_reviewed_on',
] as const;

const isBlank = (value: string): boolean => value.trim().length === 0;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const missingFr28Fields = (adaptation: BuildAdaptation): string[] =>
  FR28_METADATA_FIELDS.filter((field) => isBlank(adaptation[field]));

/**
 * Evaluates the full domain checklist and returns the mode the record may
 * appear in plus every failure found, in checklist order. Multiple failures are
 * reported together on purpose: an editor must see all of them at once.
 *
 * Defensive by design: the Zod shapes already guarantee presence and formats,
 * but rows read from SQL or fixtures may bypass them, so blank FR-28 fields and
 * a blank `reviewed_by` are reported instead of published.
 */
export function evaluatePublicationGate(input: PublicationGateInput): PublicationGateResult {
  const { adaptation, evidence, today } = input;
  if (!ISO_DATE.test(today)) {
    throw new TypeError(`today debe ser una fecha ISO (AAAA-MM-DD): ${today}`);
  }

  const failures: PublicationGateFailure[] = [];

  // Point 1: a source with rights evidence of a coherent type that covers the
  // adaptation and is still current.
  let coversAdaptation = false;
  if (evidence === null) {
    failures.push(fail('sin_evidencia', 'la adaptación no tiene evidencia de derechos registrada'));
  } else {
    const sameRecord =
      evidence.id === adaptation.evidence_id && evidence.source_slug === adaptation.source_slug;
    if (!sameRecord) {
      failures.push(
        fail(
          'evidencia_no_corresponde',
          'la evidencia indicada no es la registrada para esta fuente y adaptación',
        ),
      );
    }
    if (!evidence.covers_adaptation) {
      failures.push(fail('evidencia_no_cubre_adaptacion', 'la evidencia no cubre la adaptación'));
    }
    const required = requiredEvidenceType(adaptation.rights_status);
    const coherentType = required === null || evidence.evidence_type === required;
    if (!coherentType) {
      failures.push(
        fail(
          'evidencia_tipo_incoherente',
          `rights_status=${adaptation.rights_status} requiere evidencia ${required}`,
        ),
      );
    }
    if (evidence.status === 'revocada') {
      failures.push(fail('evidencia_revocada', 'la evidencia fue revocada'));
    } else if (evidence.status === 'caducada') {
      failures.push(fail('evidencia_caducada', 'la evidencia figura caducada'));
    } else if (evidence.valid_until !== null && evidence.valid_until < today) {
      failures.push(fail('evidencia_caducada', `la evidencia caducó el ${evidence.valid_until}`));
    }
    // Attribution alone is never permission (Constitution I/VII).
    coversAdaptation = sameRecord && evidence.covers_adaptation && coherentType;
  }
  if (!coversAdaptation) {
    failures.push(
      fail(
        'solo_atribucion',
        'la atribución no sustituye al permiso: no hay evidencia que habilite la adaptación',
      ),
    );
  }

  // Point 2: separation of duties between rights reviewer and adaptation editor.
  if (adaptation.adaptation_editor === adaptation.rights_verified_by) {
    failures.push(
      fail(
        'mismo_revisor_y_editor',
        'quien verifica los derechos no puede ser el editor de la adaptación',
      ),
    );
  }

  // Point 3: the evidence scope must contain the declared transformation scope.
  // A missing evidence record is already reported at point 1; scope only
  // matters when there is a record whose scope can be checked.
  if (
    evidence !== null &&
    adaptation.transformation_scope.includes('traduccion') &&
    !evidence.covers_translation
  ) {
    failures.push(
      fail('evidencia_no_cubre_traduccion', 'la evidencia no cubre la traducción declarada'),
    );
  }

  // Point 4: complete FR-28 provenance metadata.
  const missing = missingFr28Fields(adaptation);
  if (missing.length > 0) {
    failures.push(fail('metadatos_incompletos', `faltan metadatos FR-28: ${missing.join(', ')}`));
  }

  // Point 6: editorial content review against the game, by someone else.
  if (isBlank(adaptation.reviewed_by)) {
    failures.push(
      fail('sin_revision_de_contenido', 'la adaptación no tiene revisión de contenido'),
    );
  } else if (adaptation.reviewed_by === adaptation.adaptation_editor) {
    failures.push(
      fail(
        'revision_de_contenido_por_editor',
        'quien revisa el contenido no puede ser el editor de la adaptación',
      ),
    );
  }

  // Point 7: rights status and editorial state must allow the native mode.
  if (!isPublishableRightsStatus(adaptation.rights_status)) {
    failures.push(
      fail(
        'derechos_no_publicables',
        `rights_status=${adaptation.rights_status} no habilita una adaptación publicada`,
      ),
    );
  }
  if (adaptation.adaptation_state === 'borrador') {
    failures.push(
      fail('estado_no_publicable', 'un borrador no se publica: complete la revisión primero'),
    );
  } else if (adaptation.adaptation_state === 'en_revision') {
    failures.push(fail('estado_no_publicable', 'una adaptación en revisión todavía no se publica'));
  } else if (
    adaptation.adaptation_state === 'revision_pendiente' ||
    adaptation.adaptation_state === 'retirada'
  ) {
    failures.push(
      fail(
        'estado_degradado',
        `adaptation_state=${adaptation.adaptation_state} solo admite tarjeta de enlace`,
      ),
    );
  }

  let outcome: PublicationOutcome;
  if (adaptation.adaptation_state === 'borrador' || adaptation.adaptation_state === 'en_revision') {
    // The record is not ready: keep it unpublished instead of degrading it.
    outcome = 'rechazada';
  } else if (!coversAdaptation) {
    // Attribution alone: no rights basis ever covered the adaptation.
    outcome = 'rechazada';
  } else if (adaptation.adaptation_state === 'publicado' && failures.length === 0) {
    outcome = 'publicado';
  } else {
    // Evidence existed but no longer enables the native mode, or another
    // checklist point fails: only the factual source card may be shown.
    outcome = 'link_only';
  }

  return { outcome, failures };
}

/** Factual fields a link-only card may show (plan §15.1, T-106). */
export const LINK_ONLY_METADATA_FIELDS = [
  'source_url',
  'original_title',
  'original_author',
  'original_site',
  'retrieved_on',
  'attribution_text',
] as const;

export type LinkOnlyMetadataField = (typeof LINK_ONLY_METADATA_FIELDS)[number];

/**
 * Factual metadata of the source, and nothing else: no body, no internal notes,
 * no `evidence_ref` and no field derived from the original guide. T-106 builds
 * the public link-only card on top of this shape.
 */
export type LinkOnlyMetadata = Readonly<Record<LinkOnlyMetadataField, string>>;

/** Projects an adaptation onto the factual metadata a link-only card may show. */
export function toLinkOnlyMetadata(
  adaptation: Pick<BuildAdaptation, LinkOnlyMetadataField>,
): LinkOnlyMetadata {
  return {
    source_url: adaptation.source_url,
    original_title: adaptation.original_title,
    original_author: adaptation.original_author,
    original_site: adaptation.original_site,
    retrieved_on: adaptation.retrieved_on,
    attribution_text: adaptation.attribution_text,
  };
}
