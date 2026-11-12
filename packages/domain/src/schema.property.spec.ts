import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CONTENT_STATUSES,
  ENTRY_KINDS,
  PLACEHOLDER_AUTHOR_SLUG,
  PublicBuildSchema,
  REVIEW_STATES,
  RIGHTS_STATUSES,
  TIERS,
  TierEntrySchema,
} from './schema.js';

/** Semilla base de las propiedades de dominio (T-140). Cada propiedad usa SEED + n. */
const SEED = 20261111;

const logProperty = (name: string, numRuns: number, seed: number, detail: string) =>
  console.info(`[property] ${name} numRuns=${numRuns} seed=${seed} ${detail}`);

const CONFIRMED_AUTHOR = 'autor-real';
const SOURCE_SLUG = 'guia-original';
const PUBLIC_RIGHTS = ['own_original', 'licensed', 'permission_granted'];

const textArb = fc.string({ maxLength: 24 }).map((s) => `t${s}`);
const slugArb = fc.constantFrom('chaman', 'demoledor', 'golpe-primigenio', 'fuente-a');
const urlArb = fc.constantFrom('https://example.invalid/a', 'https://example.invalid/b');
const isoDateArb = fc
  .integer({ min: Date.UTC(2024, 0, 1), max: Date.UTC(2030, 11, 31) })
  .map((t) => new Date(t).toISOString().slice(0, 10));
const maybe = <T>(arb: fc.Arbitrary<T>) =>
  fc.oneof({ weight: 1, arbitrary: fc.constant(null) }, { weight: 1, arbitrary: arb });

/** Documento público válido (DTO sin campos editoriales). Las listas vacías son válidas. */
const publicBase = (): Record<string, unknown> => ({
  slug: 'build-sintetica',
  locale: 'es',
  title: 'Build sintética',
  eyebrow: 'Guía sintética',
  subtitle: 'Subtítulo sintético',
  summary: 'Resumen sintético',
  title_a_mastery_slug: 'chaman',
  title_b_mastery_slug: 'demoledor',
  damage_types: ['rayo'],
  playstyle: 'melee',
  content_tags: ['campana'],
  author_slug: CONFIRMED_AUTHOR,
  source_slugs: [SOURCE_SLUG],
  author: {
    slug: CONFIRMED_AUTHOR,
    display_name: 'Autor sintético',
    bio: null,
    url: null,
  },
  sources: [
    {
      slug: SOURCE_SLUG,
      kind: 'original',
      title: 'Guía original sintética',
      url: null,
      author_name: 'Autor sintético',
      license_note: 'Derechos propios sintéticos',
      retrieved_on: '2026-11-08',
    },
  ],
  game_version: '1.2.x',
  review_state: 'publicado',
  rights_status: 'own_original',
  content_status: 'sin_verificar',
  published_at: '2026-11-08',
  video_url: null,
  footer_disclaimer: 'Cantidades orientativas.',
  hero_callout_title: 'Lee esto primero',
  hero_callout_body: ['Dato sintético.'],
  masteries: [
    { slug: 'chaman', name_es: 'Chamán', name_en: 'Shaman', role_text: 'Daño' },
    { slug: 'demoledor', name_es: 'Demoledor', name_en: 'Demolitionist', role_text: 'Soporte' },
  ],
  priorities: [],
  skill_nodes: [],
  purchase_steps: [],
  notes: [],
  loot_filter_columns: [],
  guide_npcs: [],
  constellations: [],
  devotion_steps: [],
  sections_meta: [],
});

interface PublicCandidate {
  review_state: string;
  rights_status: string;
  author_slug: string;
  has_source: boolean;
  published_at: string | null;
  title: string;
  summary: string;
}

/** Candidato con mezcla de casos válidos e inválidos; el esquema decide. */
const publicCandidateArb: fc.Arbitrary<PublicCandidate> = fc.record({
  review_state: fc.constantFrom('publicado', 'publicado', 'publicado', 'en_revision', 'borrador'),
  rights_status: fc.constantFrom(
    'own_original',
    'licensed',
    'permission_granted',
    'link_only',
    'pending',
  ),
  author_slug: fc.constantFrom(CONFIRMED_AUTHOR, CONFIRMED_AUTHOR, PLACEHOLDER_AUTHOR_SLUG),
  has_source: fc.constantFrom(true, true, false),
  published_at: fc.oneof(
    { weight: 3, arbitrary: isoDateArb },
    { weight: 1, arbitrary: fc.constant(null) },
  ),
  title: textArb,
  summary: textArb,
});

const toCandidate = (c: PublicCandidate): Record<string, unknown> => {
  const base = publicBase();
  return {
    ...base,
    review_state: c.review_state,
    rights_status: c.rights_status,
    published_at: c.published_at,
    title: c.title,
    summary: c.summary,
    author_slug: c.author_slug,
    author: { ...(base['author'] as object), slug: c.author_slug },
    source_slugs: c.has_source ? [SOURCE_SLUG] : [],
  };
};

describe('PublicBuildSchema properties', () => {
  it('todo DTO público aceptado cumple las invariantes de publicación', () => {
    const name =
      'PublicBuildSchema aceptado ⇒ publicado, derechos sobre contenido, fecha, autor y fuente';
    const numRuns = 200;
    const seed = SEED + 5;
    let cases = 0;
    let accepted = 0;
    let rejected = 0;
    fc.assert(
      fc.property(publicCandidateArb, (c) => {
        cases++;
        const result = PublicBuildSchema.safeParse(toCandidate(c));
        if (!result.success) {
          rejected++;
          return;
        }
        accepted++;
        const data = result.data;
        expect(data.review_state).toBe('publicado');
        expect(PUBLIC_RIGHTS).toContain(data.rights_status);
        expect(data.rights_status).not.toBe('link_only');
        expect(data.rights_status).not.toBe('pending');
        expect(data.published_at).not.toBeNull();
        expect(data.author_slug).not.toBe(PLACEHOLDER_AUTHOR_SLUG);
        expect(data.source_slugs.length).toBeGreaterThan(0);
      }),
      { numRuns, seed },
    );
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    logProperty(name, numRuns, seed, `casos=${cases} aceptados=${accepted} rechazados=${rejected}`);
  });

  it('link_only sin contenido propio no publica: falla cerrado por rights_status', () => {
    const name = 'PublicBuildSchema rechaza rights_status=link_only';
    const numRuns = 150;
    const seed = SEED + 6;
    let cases = 0;
    let rejections = 0;
    fc.assert(
      fc.property(
        fc.record({ title: textArb, summary: textArb, published_at: isoDateArb }),
        (fields) => {
          cases++;
          const candidate = toCandidate({
            review_state: 'publicado',
            rights_status: 'link_only',
            author_slug: CONFIRMED_AUTHOR,
            has_source: true,
            ...fields,
          });
          // Control: la misma guía con derechos sobre el contenido sí es válida.
          expect(
            PublicBuildSchema.safeParse({ ...candidate, rights_status: 'licensed' }).success,
          ).toBe(true);
          const result = PublicBuildSchema.safeParse(candidate);
          expect(result.success).toBe(false);
          if (!result.success) {
            rejections++;
            expect(result.error.issues.some((issue) => issue.path.includes('rights_status'))).toBe(
              true,
            );
          }
        },
      ),
      { numRuns, seed },
    );
    expect(rejections).toBe(numRuns);
    logProperty(
      name,
      numRuns,
      seed,
      `casos=${cases} rechazos_por_rights=${rejections} controles_validos=${cases}`,
    );
  });

  it('round-trip JSON exacto e idempotente sobre DTOs válidos', () => {
    const name = 'PublicBuildSchema round-trip JSON e idempotencia';
    const numRuns = 150;
    const seed = SEED + 7;
    let cases = 0;
    let accepted = 0;
    fc.assert(
      fc.property(publicCandidateArb, (c) => {
        cases++;
        const first = PublicBuildSchema.safeParse(toCandidate(c));
        if (!first.success) return;
        accepted++;
        const x = first.data;
        const roundTripped = PublicBuildSchema.parse(JSON.parse(JSON.stringify(x)));
        expect(roundTripped).toEqual(x);
        expect(PublicBuildSchema.parse(roundTripped)).toEqual(x);
      }),
      { numRuns, seed },
    );
    expect(accepted).toBeGreaterThan(0);
    logProperty(name, numRuns, seed, `casos=${cases} dtos_validos=${accepted}`);
  });
});

const COMBINATION_SLUG = 'chaman-demoledor';

const enlaceArb = fc.record({
  entry_kind: fc.constant<string>('enlace_externo'),
  combination_slug: fc.constant(COMBINATION_SLUG),
  display_name: textArb,
  build_slug: fc.constantFrom<string | null>(null, null, 'build-x'),
  tier: fc.constantFrom('sin_clasificar', 'sin_clasificar', 'S', 'A'),
  content_status: fc.constantFrom('sin_verificar', 'verificado', 'placeholder'),
  rights_status: fc.constantFrom('link_only', 'link_only', 'link_only', 'licensed', 'pending'),
  review_state: fc.constantFrom('publicado', 'borrador'),
  external_url: fc.constantFrom<string | null>(
    'https://example.invalid/a',
    'https://example.invalid/a',
    'https://example.invalid/a',
    null,
  ),
  external_author: fc.constantFrom<string | null>(
    'Autor externo',
    'Autor externo',
    'Autor externo',
    null,
  ),
  source_slug: fc.constantFrom<string | null>('fuente-a', 'fuente-a', 'fuente-a', null),
  evaluated_on: fc.constantFrom<string | null>('2026-11-01', '2026-11-01', null),
});

const placeholderArb = fc.record({
  entry_kind: fc.constant<string>('placeholder'),
  combination_slug: fc.constant(COMBINATION_SLUG),
  display_name: textArb,
  build_slug: fc.constantFrom<string | null>(null, null, null, 'build-x'),
  tier: fc.constant<string>('sin_clasificar'),
  content_status: fc.constantFrom('placeholder', 'placeholder', 'verificado'),
  rights_status: fc.constantFrom(...RIGHTS_STATUSES),
  review_state: fc.constantFrom(...REVIEW_STATES),
  external_url: fc.constantFrom<string | null>(null, null, null, 'https://example.invalid/a'),
  external_author: maybe(textArb),
  source_slug: maybe(slugArb),
  evaluated_on: maybe(isoDateArb),
});

const buildPropiaArb = fc.record({
  entry_kind: fc.constant<string>('build_propia'),
  combination_slug: fc.constant(COMBINATION_SLUG),
  display_name: maybe(textArb),
  build_slug: fc.constantFrom<string | null>('build-x', 'build-x', null),
  tier: fc.constantFrom(...TIERS),
  content_status: fc.constantFrom(...CONTENT_STATUSES),
  rights_status: fc.constantFrom(...RIGHTS_STATUSES),
  review_state: fc.constantFrom(...REVIEW_STATES),
  external_url: maybe(urlArb),
  external_author: maybe(textArb),
  source_slug: maybe(slugArb),
  evaluated_on: maybe(isoDateArb),
});

const anyEntryArb = fc.record({
  entry_kind: fc.constantFrom(...ENTRY_KINDS),
  combination_slug: fc.constant(COMBINATION_SLUG),
  display_name: maybe(textArb),
  build_slug: maybe(slugArb),
  tier: fc.constantFrom(...TIERS),
  content_status: fc.constantFrom(...CONTENT_STATUSES),
  rights_status: fc.constantFrom(...RIGHTS_STATUSES),
  review_state: fc.constantFrom(...REVIEW_STATES),
  external_url: maybe(urlArb),
  external_author: maybe(textArb),
  source_slug: maybe(slugArb),
  evaluated_on: maybe(isoDateArb),
});

const tierEntryArb = fc.oneof(
  { weight: 2, arbitrary: enlaceArb },
  { weight: 2, arbitrary: placeholderArb },
  { weight: 1, arbitrary: buildPropiaArb },
  { weight: 1, arbitrary: anyEntryArb },
);

describe('TierEntrySchema properties', () => {
  it('enlace_externo y placeholder respetan sus invariantes de tier', () => {
    const name =
      'TierEntrySchema enlace_externo ⇒ link_only+URL+autor+fuente; placeholder ⇒ sin build ni URL';
    const numRuns = 200;
    const seed = SEED + 8;
    let cases = 0;
    const acceptedByKind: Record<string, number> = { enlace_externo: 0, placeholder: 0 };
    fc.assert(
      fc.property(tierEntryArb, (entry) => {
        cases++;
        const result = TierEntrySchema.safeParse(entry);
        if (!result.success) return;
        const data = result.data;
        if (data.entry_kind === 'enlace_externo') {
          acceptedByKind['enlace_externo'] = (acceptedByKind['enlace_externo'] ?? 0) + 1;
          expect(data.rights_status).toBe('link_only');
          expect(data.external_url).toBeTruthy();
          expect(data.external_author).toBeTruthy();
          expect(data.source_slug).toBeTruthy();
        }
        if (data.entry_kind === 'placeholder') {
          acceptedByKind['placeholder'] = (acceptedByKind['placeholder'] ?? 0) + 1;
          expect(data.build_slug).toBeNull();
          expect(data.external_url).toBeNull();
        }
      }),
      { numRuns, seed },
    );
    expect(acceptedByKind['enlace_externo']).toBeGreaterThan(0);
    expect(acceptedByKind['placeholder']).toBeGreaterThan(0);
    logProperty(
      name,
      numRuns,
      seed,
      `casos=${cases} aceptados_enlace_externo=${acceptedByKind['enlace_externo']} aceptados_placeholder=${acceptedByKind['placeholder']}`,
    );
  });
});
