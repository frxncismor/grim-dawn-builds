import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ADAPTATION_STATES,
  AdaptationPublicationSchema,
  EVIDENCE_STATUSES,
  EVIDENCE_TYPES,
  TRANSFORMATION_SCOPES,
  isPublishableRightsStatus,
  requiredEvidenceType,
} from './adaptation.js';
import { RIGHTS_STATUSES } from './schema.js';

/** Semilla base de las propiedades de dominio (T-140). Cada propiedad usa SEED + n. */
const SEED = 20261111;

const logProperty = (name: string, numRuns: number, seed: number, detail: string) =>
  console.info(`[property] ${name} numRuns=${numRuns} seed=${seed} ${detail}`);

const isoDateArb = fc
  .integer({ min: Date.UTC(2024, 0, 1), max: Date.UTC(2030, 11, 31) })
  .map((t) => new Date(t).toISOString().slice(0, 10));

/** Entrada de un caso: el arbitrario decide; el esquema es quien acepta o rechaza. */
interface PublicationInput {
  rights_status: string;
  adaptation_state: string;
  evidence_type: string;
  evidence_status: string;
  consistent_ref: boolean;
  consistent_source: boolean;
  consistent_log: boolean;
  covers_adaptation: boolean;
  covers_translation: boolean;
  scope: string[];
  version: number;
  editor: string;
  verifier: string;
  last_reviewed_on: string;
  valid_until: string | null;
}

/** Caso íntegro salvo lo que cada propiedad sobrescribe. Forma de data-model rev. 6. */
const consistentInput: PublicationInput = {
  rights_status: 'licensed',
  adaptation_state: 'publicado',
  evidence_type: 'licencia_explicita',
  evidence_status: 'vigente',
  consistent_ref: true,
  consistent_source: true,
  consistent_log: true,
  covers_adaptation: true,
  covers_translation: true,
  scope: ['estructura', 'traduccion'],
  version: 2,
  editor: 'Editor sintético',
  verifier: 'Revisor de derechos sintético',
  last_reviewed_on: '2026-06-01',
  valid_until: '2027-06-01',
};

const toPublication = (p: PublicationInput): Record<string, unknown> => {
  const licensed = p.evidence_type === 'licencia_explicita';
  return {
    adaptation: {
      build_slug: 'build-adaptada-sintetica',
      entry_kind: 'build_adaptada',
      source_slug: 'fuente-a',
      evidence_id: 'evidencia-a',
      rights_status: p.rights_status,
      source_url: 'https://example.invalid/build-original',
      original_title: 'Build original sintética',
      original_author: 'Autor sintético',
      original_site: 'Sitio sintético',
      retrieved_on: '2026-01-10',
      adaptation_editor: p.editor,
      rights_verified_by: p.verifier,
      transformation_scope: p.scope,
      transformation_notes: 'Adaptación sintética de prueba.',
      adaptation_version: p.version,
      source_revision_ref: null,
      last_reviewed_on: p.last_reviewed_on,
      reviewed_by: 'Revisor de contenido sintético',
      change_log: [
        {
          adaptation_version: p.consistent_log ? p.version : p.version + 1,
          changed_on: '2026-02-01',
          summary: 'Revisión sintética.',
        },
      ],
      attribution_text: 'Atribución sintética de la fuente.',
      adaptation_state: p.adaptation_state,
    },
    evidence: {
      id: p.consistent_ref ? 'evidencia-a' : 'evidencia-b',
      source_slug: p.consistent_source ? 'fuente-a' : 'fuente-b',
      evidence_type: p.evidence_type,
      evidence_ref: 'evidencia-privada/sintetica.txt',
      license_name: licensed ? 'Licencia sintética' : null,
      license_url: licensed ? 'https://example.invalid/licencia' : null,
      covers_adaptation: p.covers_adaptation,
      covers_translation: p.covers_translation,
      covers_images: false,
      scope_notes: 'Alcance sintético para pruebas de dominio.',
      granted_by: 'Titular sintético',
      recorded_on: '2026-01-01',
      valid_until: p.valid_until,
      status: p.evidence_status,
      verified_by: 'Verificador sintético',
      verified_on: '2026-01-02',
    },
  };
};

/** Derecho → evidencia exigida, escrito a mano según plan §15.1 (no se importa la tabla del código). */
const EVIDENCE_FOR_LICENSED: Record<string, string> = {
  licensed: 'licencia_explicita',
  permission_granted: 'permiso_escrito',
};

/** Casos mayoritariamente válidos: así la premisa de publicación se cumple con frecuencia. */
const validInputArb: fc.Arbitrary<PublicationInput> = fc
  .record({
    rights_status: fc.constantFrom(
      'licensed',
      'permission_granted',
      'licensed',
      'permission_granted',
      'pending',
      'own_original',
      'link_only',
    ),
    adaptation_state: fc.constantFrom(...ADAPTATION_STATES, 'publicado', 'publicado'),
    evidence_status: fc.constantFrom(...EVIDENCE_STATUSES, 'vigente', 'vigente'),
    valid_until: fc.constantFrom<string | null>(null, '2027-06-01', '2028-01-01'),
    last_reviewed_on: fc.constantFrom('2026-06-01', '2026-03-01'),
  })
  .map((p) => ({
    ...consistentInput,
    ...p,
    evidence_type: EVIDENCE_FOR_LICENSED[p.rights_status] ?? 'permiso_escrito',
  }));

/** Casos aleatorios: cualquier combinación de campos, para forzar rechazos por inconsistencia. */
const randomInputArb: fc.Arbitrary<PublicationInput> = fc.record({
  rights_status: fc.constantFrom(...RIGHTS_STATUSES),
  adaptation_state: fc.constantFrom(...ADAPTATION_STATES),
  evidence_type: fc.constantFrom(...EVIDENCE_TYPES),
  evidence_status: fc.constantFrom(...EVIDENCE_STATUSES),
  consistent_ref: fc.boolean(),
  consistent_source: fc.boolean(),
  consistent_log: fc.boolean(),
  covers_adaptation: fc.boolean(),
  covers_translation: fc.boolean(),
  scope: fc.uniqueArray(fc.constantFrom(...TRANSFORMATION_SCOPES), { minLength: 1, maxLength: 4 }),
  version: fc.integer({ min: 1, max: 3 }),
  editor: fc.constantFrom('Editor A', 'Editor B'),
  verifier: fc.constantFrom('Editor A', 'Revisor B'),
  last_reviewed_on: isoDateArb,
  valid_until: fc.oneof(
    { weight: 1, arbitrary: fc.constant(null) },
    { weight: 1, arbitrary: isoDateArb },
  ),
});

const publicationInputArb = fc.oneof(
  { weight: 3, arbitrary: validInputArb },
  { weight: 1, arbitrary: randomInputArb },
);

describe('AdaptationPublicationSchema properties', () => {
  it('solo licensed y permission_granted publican, con evidencia vigente y del tipo exigido', () => {
    const name =
      'AdaptationPublicationSchema publicado ⇒ derecho publicable, evidencia exigida y vigente';
    const numRuns = 200;
    const seed = SEED + 9;
    let cases = 0;
    let accepted = 0;
    let published = 0;
    fc.assert(
      fc.property(publicationInputArb, (p) => {
        cases++;
        const result = AdaptationPublicationSchema.safeParse(toPublication(p));
        if (!result.success) return;
        accepted++;
        const { adaptation, evidence } = result.data;
        if (adaptation.adaptation_state !== 'publicado') return;
        published++;
        expect(isPublishableRightsStatus(adaptation.rights_status)).toBe(true);
        expect(requiredEvidenceType(adaptation.rights_status)).toBe(evidence.evidence_type);
        expect(evidence.status).toBe('vigente');
      }),
      { numRuns, seed },
    );
    expect(published).toBeGreaterThan(0);
    logProperty(
      name,
      numRuns,
      seed,
      `casos=${cases} aceptados=${accepted} publicados=${published}`,
    );
  });

  it('pending, own_original y link_only nunca publican: falla cerrado por rights_status', () => {
    const name = 'AdaptationPublicationSchema rechaza publicado con derecho no publicable';
    const numRuns = 150;
    const seed = SEED + 10;
    let cases = 0;
    let rejected = 0;
    fc.assert(
      fc.property(
        fc.record({
          rights_status: fc.constantFrom('pending', 'own_original', 'link_only'),
          evidence_type: fc.constantFrom(...EVIDENCE_TYPES),
        }),
        ({ rights_status, evidence_type }) => {
          cases++;
          const candidate = toPublication({
            ...consistentInput,
            rights_status,
            evidence_type,
            adaptation_state: 'publicado',
          });
          // Control: el mismo caso con licencia explícita sí publica.
          expect(
            AdaptationPublicationSchema.safeParse(
              toPublication({ ...consistentInput, evidence_type: 'licencia_explicita' }),
            ).success,
          ).toBe(true);
          const result = AdaptationPublicationSchema.safeParse(candidate);
          expect(result.success).toBe(false);
          if (!result.success) {
            rejected++;
            expect(
              result.error.issues.some(
                (issue) => issue.path.join('.') === 'adaptation.rights_status',
              ),
            ).toBe(true);
          }
        },
      ),
      { numRuns, seed },
    );
    expect(rejected).toBe(numRuns);
    logProperty(
      name,
      numRuns,
      seed,
      `casos=${cases} rechazos_por_rights=${rejected} control_valido=${cases}`,
    );
  });
});
