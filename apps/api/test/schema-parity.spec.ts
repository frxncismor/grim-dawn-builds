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
import { AssetSchema, BuildSchema, CONTENT_STATUSES, TIERS, TierEntrySchema } from '@gd/domain';
import { contractDoc } from '@gd/domain/testing';
import * as db from '../src/db/schema.js';

const gatesSql = readFileSync(
  fileURLToPath(new URL('../drizzle/0001_gates.sql', import.meta.url)),
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
