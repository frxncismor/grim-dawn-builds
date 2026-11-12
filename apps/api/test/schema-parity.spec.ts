/**
 * T-058: parity between the Drizzle schema (apps/api/src/db) and the @gd/domain Zod contract,
 * plus the SQL gates of drizzle/0001_gates.sql that the domain rules must mirror.
 *
 * Scope: static and in-memory checks only. No PostgreSQL is started here; live SQL gate tests are
 * T-073. The SQL side is read from the migration text and compared with domain decisions.
 * `drizzle-kit generate` without schema diff is enforced by src/db/migrations.spec.ts (also run by
 * the CI "API tests" step), so it is not repeated here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  ADAPTATION_ENTRY_KIND,
  ADAPTATION_STATES,
  AdaptationPublicationSchema,
  AssetSchema,
  BuildSchema,
  CONTENT_STATUSES,
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
  TIERS,
  TierEntrySchema,
  type BuildAdaptation,
  type SourceRightsEvidence,
} from '@gd/domain';
import { contractDoc } from '@gd/domain/testing';
import * as db from '../src/db/schema.js';

const gatesSql = readFileSync(
  fileURLToPath(new URL('../drizzle/0001_gates.sql', import.meta.url)),
  'utf8',
);
// T-108 custom SQL: enum value, adaptation gates, link-only/adaptation CHECKs and view.
const adaptationsSql = readFileSync(
  fileURLToPath(new URL('../drizzle/0007_third_party_adaptations.sql', import.meta.url)),
  'utf8',
);
// T-169 custom SQL: the public asset view stops publishing provenance (LOW-2).
const assetViewSql = readFileSync(
  fileURLToPath(new URL('../drizzle/0008_public_asset_view.sql', import.meta.url)),
  'utf8',
);

interface SafeParseLike {
  success: boolean;
  error?: { issues: readonly { message: string }[] };
}

const messagesOf = (result: SafeParseLike): string[] =>
  result.success ? [] : (result.error?.issues.map((i) => i.message) ?? []);

const nullableInZod = (schema: { safeParse: (v: unknown) => SafeParseLike }): boolean =>
  schema.safeParse(null).success;

const configOf = (table: PgTable) => getTableConfig(table);

const columnOf = (table: PgTable, name: string) => {
  const found = configOf(table).columns.find((c) => c.name === name);
  if (!found) throw new Error(`missing column ${configOf(table).name}.${name}`);
  return found;
};

describe('parity: enums (Drizzle pgEnum ↔ domain Zod options)', () => {
  // DB column and every domain option list that must carry the same values.
  const cases: {
    column: [PgTable, string];
    domain: readonly (readonly string[])[];
  }[] = [
    {
      column: [db.builds, 'review_state'],
      domain: [BuildSchema.shape.review_state.options, TierEntrySchema.shape.review_state.options],
    },
    {
      column: [db.builds, 'rights_status'],
      domain: [
        BuildSchema.shape.rights_status.options,
        TierEntrySchema.shape.rights_status.options,
      ],
    },
    {
      column: [db.builds, 'content_status'],
      domain: [
        CONTENT_STATUSES,
        BuildSchema.shape.content_status.options,
        TierEntrySchema.shape.content_status.options,
      ],
    },
    {
      column: [db.tierEntries, 'tier'],
      domain: [TIERS, TierEntrySchema.shape.tier.options],
    },
    {
      column: [db.tierEntries, 'entry_kind'],
      domain: [TierEntrySchema.shape.entry_kind.options],
    },
    {
      column: [db.tierEntries, 'review_state'],
      domain: [TierEntrySchema.shape.review_state.options],
    },
    {
      column: [db.tierEntries, 'content_status'],
      domain: [TierEntrySchema.shape.content_status.options],
    },
    {
      column: [db.tierEntries, 'rights_status'],
      domain: [TierEntrySchema.shape.rights_status.options],
    },
    {
      column: [db.assets, 'status'],
      domain: [AssetSchema.shape.status.options],
    },
    // T-108: third-party adaptation enums.
    {
      column: [db.sourceRightsEvidence, 'evidence_type'],
      domain: [EVIDENCE_TYPES],
    },
    {
      column: [db.sourceRightsEvidence, 'status'],
      domain: [EVIDENCE_STATUSES],
    },
    {
      column: [db.buildAdaptations, 'adaptation_state'],
      domain: [ADAPTATION_STATES],
    },
    {
      column: [db.permissionRequests, 'status'],
      domain: [PERMISSION_REQUEST_STATUSES],
    },
    {
      column: [db.takedownEvents, 'action'],
      domain: [TAKEDOWN_ACTIONS],
    },
    {
      column: [db.sourceChangeEvents, 'change_type'],
      domain: [SOURCE_CHANGE_TYPES],
    },
    {
      column: [db.sourceChangeEvents, 'outcome'],
      domain: [SOURCE_CHANGE_OUTCOMES],
    },
  ];

  for (const c of cases) {
    const [table, name] = c.column;
    it(`${configOf(table).name}.${name} has exactly the domain values`, () => {
      const enumValues = (columnOf(table, name) as { enumValues?: readonly string[] }).enumValues;
      expect(enumValues, name).toBeDefined();
      for (const options of c.domain) {
        expect([...(enumValues ?? [])], name).toEqual([...options]);
      }
    });
  }
});

describe('parity: nullability (Drizzle notNull ↔ Zod nullable)', () => {
  it('preserves unknown constellation tiers and source slug identity', () => {
    expect(columnOf(db.constellations, 'tier_level').notNull).toBe(false);
    expect(columnOf(db.sources, 'slug').notNull).toBe(true);
    expect(columnOf(db.sources, 'slug').isUnique).toBe(true);
  });
  it('permits unknown catalog playstyle while requiring real guide playstyle', () => {
    expect(columnOf(db.tierEntries, 'playstyle').notNull).toBe(false);
    expect(columnOf(db.builds, 'playstyle').notNull).toBe(true);
    expect(
      BuildSchema.safeParse({ ...contractDoc('unknown-style'), playstyle: null }).success,
    ).toBe(false);
  });
  // [table, DB column, domain schema for the same field]
  const pairs: [PgTable, string, { safeParse: (v: unknown) => SafeParseLike }][] = [
    [db.builds, 'slug', BuildSchema.shape.slug],
    [db.builds, 'title', BuildSchema.shape.title],
    [db.builds, 'author_id', BuildSchema.shape.author_slug],
    [db.builds, 'game_version', BuildSchema.shape.game_version],
    [db.builds, 'review_state', BuildSchema.shape.review_state],
    [db.builds, 'rights_status', BuildSchema.shape.rights_status],
    [db.builds, 'rights_confirmed_by', BuildSchema.shape.rights_confirmed_by],
    [db.builds, 'rights_confirmed_on', BuildSchema.shape.rights_confirmed_on],
    [db.builds, 'content_status', BuildSchema.shape.content_status],
    [db.builds, 'reviewed_by', BuildSchema.shape.reviewed_by],
    [db.builds, 'published_at', BuildSchema.shape.published_at],
    [db.tierEntries, 'combination_id', TierEntrySchema.shape.combination_slug],
    [db.tierEntries, 'display_name', TierEntrySchema.shape.display_name],
    [db.tierEntries, 'build_id', TierEntrySchema.shape.build_slug],
    [db.tierEntries, 'entry_kind', TierEntrySchema.shape.entry_kind],
    [db.tierEntries, 'tier', TierEntrySchema.shape.tier],
    [db.tierEntries, 'content_status', TierEntrySchema.shape.content_status],
    [db.tierEntries, 'rights_status', TierEntrySchema.shape.rights_status],
    [db.tierEntries, 'review_state', TierEntrySchema.shape.review_state],
    [db.tierEntries, 'external_url', TierEntrySchema.shape.external_url],
    [db.tierEntries, 'external_author', TierEntrySchema.shape.external_author],
    [db.tierEntries, 'source_id', TierEntrySchema.shape.source_slug],
    [db.tierEntries, 'evaluated_on', TierEntrySchema.shape.evaluated_on],
    [db.assets, 'status', AssetSchema.shape.status],
    [db.assets, 'file_path', AssetSchema.shape.file_path],
    [db.assets, 'origin_url', AssetSchema.shape.origin_url],
    [db.assets, 'rights_holder', AssetSchema.shape.rights_holder],
    [db.assets, 'license_or_permission', AssetSchema.shape.license_or_permission],
    [db.assets, 'proof_ref', AssetSchema.shape.proof_ref],
    [db.assets, 'recorded_on', AssetSchema.shape.recorded_on],
    [db.assets, 'fallback_svg', AssetSchema.shape.fallback_svg],
  ];

  for (const [table, name, zod] of pairs) {
    it(`${configOf(table).name}.${name} matches its domain field`, () => {
      expect(columnOf(table, name).notNull, name).toBe(!nullableInZod(zod));
    });
  }
});

describe('parity: v_public_assets drops private provenance (T-169 LOW-2)', () => {
  const start = assetViewSql.indexOf('CREATE VIEW v_public_assets');
  const end = assetViewSql.indexOf(';', start);
  const view = start > -1 && end > start ? assetViewSql.slice(start, end) : '';

  it('publishes the descriptor fields only when the asset is approved', () => {
    expect(view).toContain('CREATE VIEW v_public_assets');
    for (const field of ['id', 'slug', 'file_path', 'status', 'fallback_svg']) {
      expect(view, field).toContain(field);
    }
    expect(view).toMatch(/WHERE status = 'approved'/);
  });

  it('never exposes origin_url, rights_holder or license_or_permission', () => {
    for (const forbidden of ['origin_url', 'rights_holder', 'license_or_permission']) {
      expect(view, forbidden).not.toContain(forbidden);
    }
  });

  it('restores the api_ro read grant after recreating the view', () => {
    expect(assetViewSql).toMatch(/GRANT SELECT ON v_public_assets TO api_ro;/);
  });
});

describe('parity: builds publication gate (SQL builds_publication_ck + gates_check_build ↔ BuildSchema)', () => {
  const publicationCk = gatesSql.slice(
    gatesSql.indexOf('builds_publication_ck'),
    gatesSql.indexOf('ALTER TABLE tier_entries'),
  );
  const approvedInSql = [
    ...(publicationCk.match(/rights_status IN \(([^)]*)\)/)?.[1] ?? '').matchAll(/'([^']+)'/g),
  ].map((m) => m[1] ?? '');

  const published: Record<string, unknown> = {
    ...contractDoc('build-publicada', { author_slug: 'autor-real', source_slugs: ['fuente-real'] }),
    slug: 'build-publicada',
    locale: 'es',
    title: 'Build publicada',
    author_slug: 'autor-real',
    source_slugs: ['fuente-real'],
    game_version: '1.0',
    review_state: 'publicado',
    rights_status: 'licensed',
    rights_confirmed_by: 'Ana',
    rights_confirmed_on: '2026-01-01',
    content_status: 'verificado',
    reviewed_by: 'Revisor',
    published_at: '2026-01-02',
  };

  it('the publication CHECK exists in the migration and approves the four rights statuses', () => {
    expect(gatesSql).toMatch(/ADD CONSTRAINT builds_publication_ck CHECK/);
    expect([...approvedInSql].sort()).toEqual(
      ['own_original', 'licensed', 'permission_granted', 'link_only'].sort(),
    );
  });

  it('accepts a complete published build and a draft without gate metadata', () => {
    expect(BuildSchema.safeParse(published).success).toBe(true);
    const draft = {
      ...published,
      ...contractDoc('build-borrador', { author_slug: 'por-confirmar', source_slugs: [] }),
      review_state: 'borrador',
      author_slug: 'por-confirmar',
      source_slugs: [],
      rights_status: 'pending',
      rights_confirmed_by: null,
      rights_confirmed_on: null,
      reviewed_by: null,
      published_at: null,
    };
    expect(BuildSchema.safeParse(draft).success).toBe(true);
  });

  const missing: [string, Record<string, unknown>, string, RegExp][] = [
    [
      'published_at',
      { published_at: null },
      'publicado requiere fecha de publicación',
      /published_at IS NOT NULL/,
    ],
    ['reviewed_by', { reviewed_by: null }, 'publicado requiere revisor', /reviewed_by IS NOT NULL/],
    [
      'rights_confirmed_by',
      { rights_confirmed_by: null },
      'publicado requiere confirmación de derechos',
      /rights_confirmed_by IS NOT NULL/,
    ],
    [
      'rights_confirmed_on',
      { rights_confirmed_on: null },
      'publicado requiere confirmación de derechos',
      /rights_confirmed_on IS NOT NULL/,
    ],
    [
      'placeholder author',
      { author_slug: 'por-confirmar' },
      'publicado requiere un autor confirmado',
      /'por-confirmar'/,
    ],
    [
      'source',
      { source_slugs: [] },
      'publicado requiere al menos una fuente',
      /published build requires a source/,
    ],
  ];

  for (const [label, patch, message, sqlTerm] of missing) {
    it(`rejects a published build without ${label}; the SQL gate states the same rule`, () => {
      expect(messagesOf(BuildSchema.safeParse({ ...published, ...patch }))).toContain(message);
      expect(gatesSql).toMatch(sqlTerm);
    });
  }

  it('accepts exactly the rights statuses that the SQL publication CHECK approves', () => {
    for (const status of BuildSchema.shape.rights_status.options) {
      const domainAccepts = BuildSchema.safeParse({ ...published, rights_status: status }).success;
      expect(domainAccepts, status).toBe(approvedInSql.includes(status));
    }
  });
});

describe('parity: tier_entries CHECKs (SQL tier_entries_*_ck ↔ TierEntrySchema)', () => {
  const base: Record<string, unknown> = {
    entry_kind: 'build_propia',
    combination_slug: 'combo-a-b',
    display_name: null,
    build_slug: 'mi-build',
    tier: 'A',
    content_status: 'verificado',
    rights_status: 'own_original',
    review_state: 'publicado',
    external_url: null,
    external_author: null,
    source_slug: 'fuente-real',
    evaluated_on: '2026-01-01',
  };

  const placeholder: Record<string, unknown> = {
    ...base,
    entry_kind: 'placeholder',
    build_slug: null,
    display_name: 'Pendiente',
    tier: 'sin_clasificar',
    content_status: 'placeholder',
    rights_status: 'pending',
    source_slug: null,
    evaluated_on: null,
  };

  const link: Record<string, unknown> = {
    ...base,
    entry_kind: 'enlace_externo',
    build_slug: null,
    display_name: 'Guía externa',
    tier: 'sin_clasificar',
    external_url: 'https://example.com/guia',
    external_author: 'Autor externo',
    rights_status: 'link_only',
  };

  it('accepts one valid row of each entry kind', () => {
    expect(TierEntrySchema.safeParse(base).success).toBe(true);
    expect(TierEntrySchema.safeParse(placeholder).success).toBe(true);
    expect(TierEntrySchema.safeParse(link).success).toBe(true);
  });

  // Each violation: the domain must reject with its message, and the SQL CHECK must exist.
  const violations: [string, string, Record<string, unknown>, string][] = [
    [
      'tier_entries_identity_ck',
      'no build_slug and no display_name',
      { ...placeholder, display_name: null },
      'requiere build_slug o display_name',
    ],
    [
      'tier_entries_placeholder_ck',
      'placeholder with a real tier',
      { ...placeholder, tier: 'A' },
      'placeholder sin tier',
    ],
    [
      'tier_entries_placeholder_ck',
      'placeholder referencing a build',
      { ...placeholder, build_slug: 'mi-build' },
      'placeholder no referencia build',
    ],
    [
      'tier_entries_link_only_ck',
      'enlace_externo without URL',
      { ...link, external_url: null },
      'enlace_externo requiere URL',
    ],
    [
      'tier_entries_link_only_ck',
      'enlace_externo without external author',
      { ...link, external_author: null },
      'requiere autor externo',
    ],
    [
      'tier_entries_link_only_ck',
      'enlace_externo without link_only rights',
      { ...link, rights_status: 'licensed' },
      'enlace_externo requiere rights_status=link_only',
    ],
    [
      'tier_entries_build_ck',
      'build_propia without build',
      { ...base, build_slug: null, display_name: 'x' },
      'build_propia requiere build_slug',
    ],
    [
      'tier_entries_real_tier_ck',
      'real tier without source',
      { ...base, source_slug: null },
      'un tier real requiere source_slug y evaluated_on',
    ],
    [
      'tier_entries_real_tier_ck',
      'real tier without evaluated_on',
      { ...base, evaluated_on: null },
      'un tier real requiere source_slug y evaluated_on',
    ],
  ];

  for (const [ck, label, row, message] of violations) {
    it(`rejects ${label} (${ck})`, () => {
      expect(messagesOf(TierEntrySchema.safeParse(row))).toContain(message);
      expect(gatesSql).toMatch(new RegExp(`ADD CONSTRAINT ${ck} CHECK`));
    });
  }
});

describe('parity: tier_entries gains build_adaptada (0007 SQL ↔ TierEntrySchema)', () => {
  it('adds the adapted kind to the SQL enum and to ENTRY_KINDS', () => {
    expect(adaptationsSql).toMatch(/ALTER TYPE "public"\."entry_kind" ADD VALUE 'build_adaptada'/);
    expect(columnOf(db.tierEntries, 'entry_kind').enumValues).toContain(ADAPTATION_ENTRY_KIND);
    expect([...TierEntrySchema.shape.entry_kind.options]).toContain(ADAPTATION_ENTRY_KIND);
  });

  const adapted: Record<string, unknown> = {
    entry_kind: 'build_adaptada',
    combination_slug: 'combo-a-b',
    display_name: null,
    build_slug: 'build-adaptada-sintetica',
    tier: 'A',
    content_status: 'verificado',
    rights_status: 'licensed',
    review_state: 'publicado',
    external_url: null,
    external_author: null,
    source_slug: 'fuente-externa',
    evaluated_on: '2026-01-10',
  };

  it('accepts an adapted entry that points at its build', () => {
    expect(TierEntrySchema.safeParse(adapted).success).toBe(true);
  });

  it('rejects an adapted entry without build_slug; the SQL CHECK states the same rule', () => {
    expect(
      messagesOf(
        TierEntrySchema.safeParse({ ...adapted, build_slug: null, display_name: 'Adaptación' }),
      ),
    ).toContain('build_adaptada requiere build_slug');
    expect(adaptationsSql).toMatch(
      /ADD CONSTRAINT tier_entries_adaptation_ck CHECK \(\s*entry_kind::text <> 'build_adaptada' OR build_id IS NOT NULL/,
    );
  });

  it('keeps link cards unranked in the domain and in the recreated SQL CHECK', () => {
    expect(
      messagesOf(
        TierEntrySchema.safeParse({
          ...adapted,
          entry_kind: 'enlace_externo',
          build_slug: null,
          display_name: 'Guía externa',
          tier: 'A',
          rights_status: 'link_only',
          external_url: 'https://example.invalid/guia',
          external_author: 'Autor externo',
        }),
      ),
    ).toContain('una tarjeta de enlace no lleva ranking derivado de la fuente');
    expect(adaptationsSql).toMatch(/ADD CONSTRAINT tier_entries_link_only_ck CHECK/);
    expect(adaptationsSql).toMatch(/tier = 'sin_clasificar'/);
  });
});

describe('parity: adaptation publication gate (0007 SQL ↔ AdaptationPublicationSchema)', () => {
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
    scope_notes: 'Alcance sintético para pruebas de paridad.',
    granted_by: 'Titular sintético',
    recorded_on: '2026-01-01',
    valid_until: '2027-01-01',
    status: 'vigente',
    verified_by: 'Revisor de derechos sintético',
    verified_on: '2026-01-02',
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

  const publish = (patch: {
    adaptation?: Partial<BuildAdaptation>;
    evidence?: Partial<SourceRightsEvidence>;
  }) =>
    AdaptationPublicationSchema.safeParse({
      adaptation: { ...adaptation(), ...patch.adaptation },
      evidence: { ...evidence(), ...patch.evidence },
    });

  it('accepts a complete publication and states every SQL gate rule', () => {
    expect(publish({}).success).toBe(true);
    for (const rule of [
      'IF NOT evidence.covers_adaptation THEN',
      "IF evidence.status <> 'vigente' THEN",
      'IF evidence.valid_until IS NOT NULL AND evidence.valid_until < adaptation.last_reviewed_on THEN',
      'IF adaptation.adaptation_editor = evidence.verified_by THEN',
      "IF 'imagenes' = ANY(adaptation.transformation_scope) AND NOT evidence.covers_images THEN",
      "IF 'traduccion' = ANY(adaptation.transformation_scope) AND NOT evidence.covers_translation THEN",
      "IF build_rights NOT IN ('licensed', 'permission_granted') THEN",
    ]) {
      expect(adaptationsSql, rule).toContain(rule);
    }
  });

  it('rejects evidence that does not cover the adaptation', () => {
    expect(messagesOf(publish({ evidence: { covers_adaptation: false } }))).toContain(
      'la evidencia no cubre la adaptación',
    );
  });

  it('rejects revoked and expired evidence', () => {
    expect(messagesOf(publish({ evidence: { status: 'revocada' } }))).toContain(
      'evidencia revocada no habilita publicación',
    );
    expect(
      messagesOf(
        publish({
          evidence: { status: 'caducada', valid_until: '2026-05-01' },
        }),
      ),
    ).toContain('la evidencia estaba caducada en la última revisión');
  });

  it('rejects the adaptation editor as the rights verifier', () => {
    expect(
      messagesOf(
        publish({
          adaptation: {
            adaptation_editor: 'Revisor de derechos sintético',
            rights_verified_by: 'Revisor de derechos sintético',
          },
        }),
      ),
    ).toContain('quien verifica los derechos no puede ser el editor de la adaptación');
  });

  it('publishes only allowed adaptation columns and never the private evidence', () => {
    const start = adaptationsSql.indexOf('CREATE VIEW v_public_build_adaptations');
    const end = adaptationsSql.indexOf('CREATE TRIGGER gates_importer_cutover_build_adaptations');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const view = adaptationsSql.slice(start, end);
    for (const field of [
      'source_url',
      'original_title',
      'original_author',
      'original_site',
      'attribution_text',
      'retrieved_on',
      'license_name',
      'license_url',
    ]) {
      expect(view, field).toContain(field);
    }
    for (const forbidden of ['evidence_ref', 'transformation_notes', 'change_log', 'scope_notes']) {
      expect(view, forbidden).not.toContain(forbidden);
    }
    expect(adaptationsSql).toMatch(/GRANT SELECT ON v_public_build_adaptations TO api_ro;/);
    expect(adaptationsSql).not.toMatch(
      /GRANT [^;]* ON (build_adaptations|source_rights_evidence|permission_requests|takedown_events|source_change_events) TO api_ro/,
    );
  });

  it('mirrors the private adaptation table CHECKs with their domain rules', () => {
    const cases: [string, RegExp, SafeParseLike, string][] = [
      [
        'source_rights_evidence_license_ck',
        /ADD CONSTRAINT source_rights_evidence_license_ck CHECK \(\s*\(evidence_type = 'licencia_explicita'/,
        SourceRightsEvidenceSchema.safeParse({ ...evidence(), license_name: null }),
        'una licencia explícita requiere nombre de licencia',
      ],
      [
        'permission_requests_response_ck',
        /ADD CONSTRAINT permission_requests_response_ck CHECK/,
        PermissionRequestSchema.safeParse({
          id: 'solicitud-sintetica',
          source_slug: 'fuente-externa',
          author_contact_ref: 'contacto-sintetico',
          requested_on: '2026-01-01',
          scope_requested: 'Adaptar la build al formato interactivo.',
          status: 'concedida',
          response_ref: null,
          responded_on: null,
        }),
        'un permiso concedido requiere referencia de respuesta',
      ],
      [
        'takedown_events_target_ck',
        /num_nonnulls\(build_id, tier_entry_id\) = 1/,
        TakedownEventSchema.safeParse({
          id: 'retirada-sintetica',
          build_slug: 'build-adaptada-sintetica',
          tier_entry_ref: 'entrada-sintetica',
          requested_by: 'Solicitante sintético',
          received_on: '2026-01-01',
          action: 'retirada_total',
          executed_on: null,
          executed_by: null,
          notes: 'Solicitud sintética de retirada.',
        }),
        'requiere exactamente build_slug o tier_entry_ref',
      ],
      [
        'source_change_events_outcome_ck',
        /outcome = 'sin_accion' AND change_type = 'sin_cambios'/,
        SourceChangeEventSchema.safeParse({
          id: 'cambio-sintetico',
          source_slug: 'fuente-externa',
          build_slug: null,
          observed_on: '2026-01-01',
          change_type: 'edicion',
          fingerprint: null,
          reviewed_by: null,
          outcome: 'sin_accion',
        }),
        'sin_accion requiere change_type=sin_cambios',
      ],
    ];

    for (const [constraint, sqlTerm, result, message] of cases) {
      expect(messagesOf(result), constraint).toContain(message);
      expect(adaptationsSql, constraint).toMatch(sqlTerm);
      expect(adaptationsSql, constraint).toContain(`CONSTRAINT ${constraint}`);
    }
  });
});
