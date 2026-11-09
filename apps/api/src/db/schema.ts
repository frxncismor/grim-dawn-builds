/**
 * PostgreSQL schema (Drizzle) for the MVP content store. Source of truth for production content.
 * Mirrors specs/001-mvp-guias-builds/data-model.md (enums and tables).
 *
 * Canonical model: `@gd/domain` owns the content contract (Zod). This file must not invent a
 * second vocabulary: shared enums come from `@gd/domain` (CONTENT_STATUSES, TIERS) or are
 * declared here with values identical to the domain/data-model, and `schema.spec.ts` fails when
 * they drift. Known differences, by design:
 * - Domain fixtures are slug-based (`author_slug`, `source_slugs`, `skill_nodes[].parent_slug`).
 *   The database uses uuid primary keys and foreign keys / join tables. Importers map slugs to ids.
 * - Domain `Build` is the fixture summary; the `builds` table is the full editorial record
 *   (`title` comes from the domain, the rest from data-model.md).
 * - DB-only enums (no domain contract yet): verification, damage_type, playstyle, content_tag,
 *   node_status, source_kind, note_kind, accent, build_source_role, loot_rule_action,
 *   devotion_step_kind. They are not in `@gd/domain` and must not be duplicated there silently.
 * - `origin` ('fixture' | 'bootstrap' | 'editor') and `content_origin` are database-only provenance.
 *
 * Scope: this file declares structure only. Publication gates, asset gates, tier-entry CHECKs,
 * triggers, views and roles are added by the custom migration in T-055, not here. The only CHECK
 * declared is the structural mastery-pair ordering from data-model.md.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { CONTENT_STATUSES, TIERS } from '@gd/domain/vocabulary';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const reviewStateEnum = pgEnum('review_state', ['borrador', 'en_revision', 'publicado']);
export const verificationEnum = pgEnum('verification', ['verificado', 'sin_verificar']);
export const tierEnum = pgEnum('tier', TIERS);
export const damageTypeEnum = pgEnum('damage_type', [
  'fisico',
  'fuego',
  'frio',
  'rayo',
  'acido',
  'vitalidad',
  'caos',
  'eter',
  'elemental',
  'sangrado',
  'mascotas',
]);
export const playstyleEnum = pgEnum('playstyle', ['melee', 'rango', 'mascotas', 'hibrido']);
export const contentTagEnum = pgEnum('content_tag', [
  'campana',
  'shattered_realm',
  'crucible',
  'jefes',
  'farmeo',
]);
export const nodeStatusEnum = pgEnum('node_status', ['recomendada', 'meta', 'omitir']);
export const sourceKindEnum = pgEnum('source_kind', [
  'original',
  'comunidad',
  'oficial',
  'video',
  'externa_enlace',
]);
export const rightsStatusEnum = pgEnum('rights_status', [
  'pending',
  'own_original',
  'licensed',
  'permission_granted',
  'link_only',
]);
export const contentStatusEnum = pgEnum('content_status', CONTENT_STATUSES);
export const assetStatusEnum = pgEnum('asset_status', ['pending', 'approved', 'rejected']);
export const entryKindEnum = pgEnum('entry_kind', [
  'placeholder',
  'enlace_externo',
  'build_propia',
]);
export const originEnum = pgEnum('origin', ['fixture', 'bootstrap', 'editor']);
export const noteKindEnum = pgEnum('note_kind', [
  'devociones',
  'nombres',
  'atributos',
  'arma',
  'mas_adelante',
  'rotacion',
  'general',
]);
export const accentEnum = pgEnum('accent', ['storm', 'ember']);
export const buildSourceRoleEnum = pgEnum('build_source_role', ['principal', 'referencia']);
export const lootRuleActionEnum = pgEnum('loot_rule_action', ['marcar', 'desmarcar', 'aviso']);
export const devotionStepKindEnum = pgEnum('devotion_step_kind', [
  'ruta',
  'verificacion',
  'limpieza',
]);

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const idColumn = () => uuid('id').primaryKey().defaultRandom();
const timestamps = () => ({
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Editorial people and sources
// ---------------------------------------------------------------------------

export const contentOrigin = pgTable('content_origin', {
  id: idColumn(),
  bootstrapped_at: timestamp('bootstrapped_at', { withTimezone: true, mode: 'date' }).notNull(),
  payload_hash: text('payload_hash').notNull(),
  migration_version: text('migration_version').notNull(),
  ...timestamps(),
});

export const authors = pgTable('authors', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  display_name: text('display_name').notNull(),
  bio: text('bio'),
  url: text('url'),
  is_placeholder: boolean('is_placeholder').notNull().default(false),
  origin: originEnum('origin').notNull(),
  ...timestamps(),
});

export const sources = pgTable('sources', {
  id: idColumn(),
  kind: sourceKindEnum('kind').notNull(),
  title: text('title').notNull(),
  url: text('url'),
  author_name: text('author_name').notNull(),
  license_note: text('license_note').notNull(),
  permission_ref: text('permission_ref'),
  retrieved_on: date('retrieved_on', { mode: 'string' }).notNull(),
  notes: text('notes').notNull(),
  origin: originEnum('origin').notNull(),
  ...timestamps(),
});

// ---------------------------------------------------------------------------
// Game catalog: assets, masteries, skills, constellations
// ---------------------------------------------------------------------------

export const assets = pgTable('assets', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  file_path: text('file_path'),
  origin_url: text('origin_url'),
  rights_holder: text('rights_holder'),
  license_or_permission: text('license_or_permission'),
  proof_ref: text('proof_ref'),
  recorded_on: date('recorded_on', { mode: 'string' }).notNull(),
  status: assetStatusEnum('status').notNull().default('pending'),
  fallback_svg: text('fallback_svg').notNull(),
  ...timestamps(),
});

export const masteries = pgTable('masteries', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  name_es: text('name_es').notNull(),
  name_en: text('name_en').notNull(),
  accent_token: text('accent_token').notNull(),
  fallback_icon: text('fallback_icon').notNull(),
  asset_id: uuid('asset_id').references(() => assets.id),
  ...timestamps(),
});

export const masteryCombinations = pgTable(
  'mastery_combinations',
  {
    id: idColumn(),
    slug: text('slug').notNull().unique(),
    mastery_a_id: uuid('mastery_a_id')
      .notNull()
      .references(() => masteries.id),
    mastery_b_id: uuid('mastery_b_id').references(() => masteries.id),
    ...timestamps(),
  },
  (t) => [
    unique('mastery_combinations_pair_uq').on(t.mastery_a_id, t.mastery_b_id),
    check('mastery_combinations_order_ck', sql`${t.mastery_a_id} < ${t.mastery_b_id}`),
  ],
);

export const skills = pgTable(
  'skills',
  {
    id: idColumn(),
    mastery_id: uuid('mastery_id')
      .notNull()
      .references(() => masteries.id),
    slug: text('slug').notNull(),
    name_es: text('name_es').notNull(),
    name_en: text('name_en').notNull(),
    bar_required: integer('bar_required').notNull(),
    parent_skill_id: uuid('parent_skill_id').references((): AnyPgColumn => skills.id),
    ...timestamps(),
  },
  (t) => [unique('skills_mastery_slug_uq').on(t.mastery_id, t.slug)],
);

export const constellations = pgTable('constellations', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  name_en: text('name_en').notNull(),
  name_es: text('name_es'),
  tier_level: integer('tier_level').notNull(),
  affinity_required: jsonb('affinity_required'),
  affinity_granted: jsonb('affinity_granted'),
  layout: jsonb('layout').notNull(),
  ...timestamps(),
});

// ---------------------------------------------------------------------------
// Builds and their children
// ---------------------------------------------------------------------------

export const builds = pgTable(
  'builds',
  {
    id: idColumn(),
    slug: text('slug').notNull().unique(),
    locale: text('locale').notNull().default('es'),
    title: text('title').notNull(),
    title_a_mastery_id: uuid('title_a_mastery_id')
      .notNull()
      .references(() => masteries.id),
    title_b_mastery_id: uuid('title_b_mastery_id').references(() => masteries.id),
    eyebrow: text('eyebrow').notNull(),
    subtitle: text('subtitle').notNull(),
    summary: text('summary').notNull(),
    damage_types: damageTypeEnum('damage_types').array().notNull(),
    playstyle: playstyleEnum('playstyle').notNull(),
    content_tags: contentTagEnum('content_tags').array().notNull(),
    game_version: text('game_version').notNull(),
    author_id: uuid('author_id')
      .notNull()
      .references(() => authors.id),
    review_state: reviewStateEnum('review_state').notNull(),
    rights_status: rightsStatusEnum('rights_status').notNull().default('pending'),
    rights_notes: text('rights_notes'),
    rights_confirmed_by: text('rights_confirmed_by'),
    rights_confirmed_on: date('rights_confirmed_on', { mode: 'string' }),
    content_status: contentStatusEnum('content_status').notNull().default('sin_verificar'),
    reviewed_by: text('reviewed_by'),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
    published_at: date('published_at', { mode: 'string' }),
    video_url: text('video_url'),
    footer_disclaimer: text('footer_disclaimer').notNull(),
    hero_callout_title: text('hero_callout_title').notNull(),
    hero_callout_body: text('hero_callout_body').array().notNull(),
    origin: originEnum('origin').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('builds_damage_types_gin').using('gin', t.damage_types),
    index('builds_content_tags_gin').using('gin', t.content_tags),
  ],
);

export const buildSources = pgTable(
  'build_sources',
  {
    build_id: uuid('build_id')
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    source_id: uuid('source_id')
      .notNull()
      .references(() => sources.id),
    role: buildSourceRoleEnum('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.build_id, t.source_id] })],
);

export const buildMasteries = pgTable(
  'build_masteries',
  {
    build_id: uuid('build_id')
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    mastery_id: uuid('mastery_id')
      .notNull()
      .references(() => masteries.id),
    position: integer('position').notNull(),
    role_text: text('role_text').notNull(),
  },
  (t) => [primaryKey({ columns: [t.build_id, t.mastery_id] })],
);

export const buildSkillNodes = pgTable('build_skill_nodes', {
  id: idColumn(),
  build_id: uuid('build_id')
    .notNull()
    .references(() => builds.id, { onDelete: 'cascade' }),
  skill_id: uuid('skill_id')
    .notNull()
    .references(() => skills.id),
  status: nodeStatusEnum('status').notNull(),
  tag: text('tag'),
  rationale: text('rationale').notNull(),
  max_points_hint: integer('max_points_hint'),
  points_label: text('points_label'),
  layout_x: numeric('layout_x').notNull(),
  layout_y: numeric('layout_y').notNull(),
  display_order: integer('display_order').notNull(),
  ...timestamps(),
});

export const buildPriorities = pgTable('build_priorities', {
  id: idColumn(),
  build_id: uuid('build_id')
    .notNull()
    .references(() => builds.id, { onDelete: 'cascade' }),
  rank: integer('rank'),
  group_label: text('group_label').notNull(),
  headline: text('headline').notNull(),
  note: text('note').notNull(),
  // Array of build_skill_nodes.id. Postgres cannot declare an FK over an array; the importer validates it.
  skill_node_ids: uuid('skill_node_ids').array().notNull(),
  ...timestamps(),
});

export const buildPurchaseSteps = pgTable('build_purchase_steps', {
  id: idColumn(),
  build_id: uuid('build_id')
    .notNull()
    .references(() => builds.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  threshold_label: text('threshold_label').notNull(),
  mastery_id: uuid('mastery_id').references(() => masteries.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  highlights: jsonb('highlights').notNull(),
  ...timestamps(),
});

export const buildNotes = pgTable('build_notes', {
  id: idColumn(),
  build_id: uuid('build_id')
    .notNull()
    .references(() => builds.id, { onDelete: 'cascade' }),
  kind: noteKindEnum('kind').notNull(),
  label: text('label').notNull(),
  headline: text('headline').notNull(),
  detail: text('detail').notNull(),
  position: integer('position').notNull(),
  ...timestamps(),
});

export const buildDevotionSteps = pgTable('build_devotion_steps', {
  id: idColumn(),
  build_id: uuid('build_id')
    .notNull()
    .references(() => builds.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  label: text('label').notNull(),
  constellation_id: uuid('constellation_id').references(() => constellations.id),
  title_override: text('title_override'),
  body: text('body').notNull(),
  bindings: jsonb('bindings').notNull(),
  accent: accentEnum('accent').notNull(),
  verification: verificationEnum('verification').notNull(),
  kind: devotionStepKindEnum('kind').notNull(),
  ...timestamps(),
});

export const lootFilterColumns = pgTable('loot_filter_columns', {
  id: idColumn(),
  build_id: uuid('build_id')
    .notNull()
    .references(() => builds.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  name: text('name').notNull(),
  subtitle: text('subtitle').notNull(),
  ...timestamps(),
});

export const lootFilterRules = pgTable('loot_filter_rules', {
  id: idColumn(),
  column_id: uuid('column_id')
    .notNull()
    .references(() => lootFilterColumns.id, { onDelete: 'cascade' }),
  action: lootRuleActionEnum('action').notNull(),
  label: text('label').notNull(),
  detail: text('detail').notNull(),
  position: integer('position').notNull(),
  ...timestamps(),
});

export const buildGuidesNpcs = pgTable('build_guides_npcs', {
  id: idColumn(),
  build_id: uuid('build_id')
    .notNull()
    .references(() => builds.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  group_label: text('group_label').notNull(),
  name: text('name'),
  location: text('location'),
  detail: text('detail').notNull(),
  ...timestamps(),
});

export const buildSectionsMeta = pgTable(
  'build_sections_meta',
  {
    id: idColumn(),
    build_id: uuid('build_id')
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    section_key: text('section_key').notNull(),
    position: integer('position').notNull(),
    visible: boolean('visible').notNull(),
    ...timestamps(),
  },
  (t) => [unique('build_sections_meta_key_uq').on(t.build_id, t.section_key)],
);

// ---------------------------------------------------------------------------
// Tier list
// ---------------------------------------------------------------------------

export const tierLists = pgTable('tier_lists', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  game_version: text('game_version').notNull(),
  review_state: reviewStateEnum('review_state').notNull(),
  author_id: uuid('author_id')
    .notNull()
    .references(() => authors.id),
  origin: originEnum('origin').notNull(),
  ...timestamps(),
});

export const tierEntries = pgTable(
  'tier_entries',
  {
    id: idColumn(),
    tier_list_id: uuid('tier_list_id')
      .notNull()
      .references(() => tierLists.id, { onDelete: 'cascade' }),
    combination_id: uuid('combination_id')
      .notNull()
      .references(() => masteryCombinations.id),
    build_id: uuid('build_id').references(() => builds.id),
    display_name: text('display_name'),
    entry_kind: entryKindEnum('entry_kind').notNull(),
    tier: tierEnum('tier').notNull(),
    mastery_ids: uuid('mastery_ids').array().notNull(),
    damage_types: damageTypeEnum('damage_types').array().notNull(),
    playstyle: playstyleEnum('playstyle').notNull(),
    content_tags: contentTagEnum('content_tags').array().notNull(),
    note: text('note').notNull(),
    content_status: contentStatusEnum('content_status').notNull(),
    rights_status: rightsStatusEnum('rights_status').notNull(),
    review_state: reviewStateEnum('review_state').notNull(),
    external_url: text('external_url'),
    external_author: text('external_author'),
    source_id: uuid('source_id').references(() => sources.id),
    evaluated_on: date('evaluated_on', { mode: 'string' }),
    position: integer('position').notNull(),
    origin: originEnum('origin').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('tier_entries_list_tier_position_idx').on(t.tier_list_id, t.tier, t.position),
    index('tier_entries_damage_types_gin').using('gin', t.damage_types),
    index('tier_entries_content_tags_gin').using('gin', t.content_tags),
  ],
);
