import { getTableName, is } from 'drizzle-orm';
import { getTableConfig, PgArray, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { AssetSchema, BuildSchema, TierEntrySchema } from '@gd/domain';
import { CONTENT_STATUSES, TIERS } from '@gd/domain/vocabulary';
import * as schema from './schema.js';

const tables: PgTable[] = Object.values(schema).flatMap((v): PgTable[] =>
  is(v, PgTable) ? [v] : [],
);

const tableByName = (name: string): PgTable => {
  const table = tables.find((t) => getTableName(t) === name);
  if (!table) throw new Error(`missing table ${name}`);
  return table;
};

const column = (name: string, col: string) => {
  const found = getTableConfig(tableByName(name)).columns.find((c) => c.name === col);
  if (!found) throw new Error(`missing column ${name}.${col}`);
  return found;
};

const configOf = (name: string) => getTableConfig(tableByName(name));

const EXPECTED_TABLES = [
  'authors',
  'sources',
  'masteries',
  'mastery_combinations',
  'assets',
  'skills',
  'constellations',
  'builds',
  'build_sources',
  'build_constellations',
  'build_masteries',
  'build_skill_nodes',
  'build_priorities',
  'build_purchase_steps',
  'build_notes',
  'build_devotion_steps',
  'loot_filter_columns',
  'loot_filter_rules',
  'build_guides_npcs',
  'build_sections_meta',
  'tier_lists',
  'tier_entries',
  'content_origin',
  'source_rights_evidence',
  'build_adaptations',
  'permission_requests',
  'takedown_events',
  'source_change_events',
];

const JOIN_TABLES = ['build_sources', 'build_masteries', 'build_constellations'];
// build_adaptations is a 1:1 extension keyed by build_id, not an entity with its own uuid id.
const KEYED_TABLES = ['build_adaptations'];
const ENTITY_TABLES = EXPECTED_TABLES.filter(
  (n) => !JOIN_TABLES.includes(n) && !KEYED_TABLES.includes(n),
);

describe('database schema: tables', () => {
  it('maps every core table of data-model.md', () => {
    expect(tables.map((t) => getTableName(t)).sort()).toEqual([...EXPECTED_TABLES].sort());
  });

  it('uses a uuid primary key with a database default for entity tables', () => {
    for (const name of ENTITY_TABLES) {
      const id = column(name, 'id');
      expect(id.columnType, name).toBe('PgUUID');
      expect(id.primary, name).toBe(true);
      expect(id.hasDefault, name).toBe(true);
    }
  });

  it('gives every entity table timestamptz created_at/updated_at', () => {
    for (const name of ENTITY_TABLES) {
      for (const col of ['created_at', 'updated_at']) {
        const c = column(name, col);
        expect(c.columnType, `${name}.${col}`).toBe('PgTimestamp');
        expect(c.notNull, `${name}.${col}`).toBe(true);
      }
    }
  });
});

describe('database schema: enums', () => {
  const enumValues = (name: string): string[] => {
    const found = Object.values(schema).find(
      (v) => typeof v === 'function' && 'enumName' in v && v.enumName === name,
    ) as { enumValues: string[] } | undefined;
    if (!found) throw new Error(`missing pg enum ${name}`);
    return [...found.enumValues];
  };

  it('defines the data-model enums with exactly their values', () => {
    expect(enumValues('review_state')).toEqual(['borrador', 'en_revision', 'publicado']);
    expect(enumValues('verification')).toEqual(['verificado', 'sin_verificar']);
    expect(enumValues('tier')).toEqual(['S', 'A', 'B', 'C', 'D', 'sin_clasificar']);
    expect(enumValues('damage_type')).toEqual([
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
    expect(enumValues('playstyle')).toEqual(['melee', 'rango', 'mascotas', 'hibrido']);
    expect(enumValues('content_tag')).toEqual([
      'campana',
      'shattered_realm',
      'crucible',
      'jefes',
      'farmeo',
    ]);
    expect(enumValues('node_status')).toEqual(['recomendada', 'meta', 'omitir']);
    expect(enumValues('source_kind')).toEqual([
      'original',
      'comunidad',
      'oficial',
      'video',
      'externa_enlace',
    ]);
    expect(enumValues('rights_status')).toEqual([
      'pending',
      'own_original',
      'licensed',
      'permission_granted',
      'link_only',
    ]);
    expect(enumValues('content_status')).toEqual(['verificado', 'sin_verificar', 'placeholder']);
    expect(enumValues('asset_status')).toEqual(['pending', 'approved', 'rejected']);
    expect(enumValues('entry_kind')).toEqual([
      'placeholder',
      'enlace_externo',
      'build_propia',
      'build_adaptada',
    ]);
    expect(enumValues('origin')).toEqual(['fixture', 'bootstrap', 'editor']);
    expect(enumValues('evidence_type')).toEqual(['licencia_explicita', 'permiso_escrito']);
    expect(enumValues('evidence_status')).toEqual(['vigente', 'caducada', 'revocada']);
    expect(enumValues('adaptation_state')).toEqual([
      'borrador',
      'en_revision',
      'publicado',
      'revision_pendiente',
      'retirada',
    ]);
    expect(enumValues('permission_request_status')).toEqual([
      'enviada',
      'concedida',
      'denegada',
      'limitada',
      'sin_respuesta',
    ]);
    expect(enumValues('takedown_action')).toEqual(['link_only', 'retirada_total', 'rechazada']);
    expect(enumValues('source_change_type')).toEqual([
      'edicion',
      'licencia',
      'eliminacion',
      'bloqueo',
      'sin_cambios',
    ]);
    expect(enumValues('source_change_outcome')).toEqual([
      'sin_accion',
      'revision_abierta',
      'retirada',
    ]);
  });

  it('shares the enums that the domain contract already defines (no second model)', () => {
    expect(enumValues('review_state')).toEqual([...BuildSchema.shape.review_state.options]);
    expect(enumValues('rights_status')).toEqual([...BuildSchema.shape.rights_status.options]);
    expect(enumValues('content_status')).toEqual([...CONTENT_STATUSES]);
    expect(enumValues('content_status')).toEqual([...BuildSchema.shape.content_status.options]);
    expect(enumValues('tier')).toEqual([...TIERS]);
    expect(enumValues('entry_kind')).toEqual([...TierEntrySchema.shape.entry_kind.options]);
    expect(enumValues('asset_status')).toEqual([...AssetSchema.shape.status.options]);
  });

  it('binds enum columns, including arrays, to their pg enum types', () => {
    expect(column('builds', 'review_state').columnType).toBe('PgEnumColumn');
    const damage = column('builds', 'damage_types');
    expect(damage.columnType).toBe('PgArray');
    expect(is(damage, PgArray)).toBe(true);
    if (!is(damage, PgArray)) throw new Error('damage_types is not an array column');
    expect(damage.dataType).toBe('array');
    expect(damage.baseColumn.columnType).toBe('PgEnumColumn');
    expect(column('tier_entries', 'tier').columnType).toBe('PgEnumColumn');
  });
});

describe('database schema: nullability and defaults', () => {
  it('requires review, rights and content state on builds, with the data-model defaults', () => {
    expect(column('builds', 'review_state').notNull).toBe(true);
    expect(column('builds', 'rights_status').notNull).toBe(true);
    expect(column('builds', 'rights_status').default).toBe('pending');
    expect(column('builds', 'content_status').default).toBe('sin_verificar');
    expect(column('builds', 'locale').default).toBe('es');
  });

  it('keeps review and publication metadata nullable until review', () => {
    for (const col of [
      'rights_notes',
      'rights_confirmed_by',
      'rights_confirmed_on',
      'reviewed_by',
      'reviewed_at',
      'published_at',
      'video_url',
    ]) {
      expect(column('builds', col).notNull, col).toBe(false);
    }
    expect(column('builds', 'slug').notNull).toBe(true);
    expect(column('builds', 'author_id').notNull).toBe(true);
    expect(column('builds', 'title_b_mastery_id').notNull).toBe(false);
  });

  it('models assets with provenance nullable at DB level (the approved gate is T-055)', () => {
    expect(column('assets', 'status').default).toBe('pending');
    for (const col of [
      'file_path',
      'origin_url',
      'rights_holder',
      'license_or_permission',
      'proof_ref',
    ]) {
      expect(column('assets', col).notNull, col).toBe(false);
    }
    expect(column('assets', 'recorded_on').notNull).toBe(true);
    expect(column('assets', 'fallback_svg').notNull).toBe(true);
  });

  it('anchors tier entries to a combination and allows placeholders without a build', () => {
    expect(column('tier_entries', 'combination_id').notNull).toBe(true);
    expect(column('tier_entries', 'build_id').notNull).toBe(false);
    expect(column('tier_entries', 'display_name').notNull).toBe(false);
    expect(column('tier_entries', 'source_id').notNull).toBe(false);
    expect(column('tier_entries', 'evaluated_on').notNull).toBe(false);
    expect(column('tier_entries', 'entry_kind').notNull).toBe(true);
    expect(column('tier_entries', 'tier').notNull).toBe(true);
  });

  it('records the origin of editorial rows on every editorial table', () => {
    for (const name of ['authors', 'sources', 'builds', 'tier_lists', 'tier_entries']) {
      expect(column(name, 'origin').notNull, name).toBe(true);
    }
  });
});

describe('database schema: content_origin', () => {
  it('is a provenance table with bootstrap metadata that must be filled', () => {
    for (const col of ['bootstrapped_at', 'payload_hash', 'migration_version']) {
      expect(column('content_origin', col).notNull, col).toBe(true);
    }
  });
});

describe('database schema: references and uniqueness', () => {
  const fkTargets = (name: string) =>
    configOf(name).foreignKeys.map((fk) => {
      const ref = fk.reference();
      return { column: ref.columns[0]?.name, target: getTableName(ref.foreignTable) };
    });

  it('references authors, masteries, sources and combinations from builds and tier entries', () => {
    expect(fkTargets('builds')).toEqual(
      expect.arrayContaining([
        { column: 'author_id', target: 'authors' },
        { column: 'title_a_mastery_id', target: 'masteries' },
        { column: 'title_b_mastery_id', target: 'masteries' },
      ]),
    );
    expect(fkTargets('tier_entries')).toEqual(
      expect.arrayContaining([
        { column: 'combination_id', target: 'mastery_combinations' },
        { column: 'build_id', target: 'builds' },
        { column: 'source_id', target: 'sources' },
        { column: 'tier_list_id', target: 'tier_lists' },
      ]),
    );
  });

  it('links build children to builds and catalog rows to skills and masteries', () => {
    expect(fkTargets('build_skill_nodes')).toEqual(
      expect.arrayContaining([
        { column: 'build_id', target: 'builds' },
        { column: 'skill_id', target: 'skills' },
      ]),
    );
    expect(fkTargets('skills')).toEqual(
      expect.arrayContaining([
        { column: 'mastery_id', target: 'masteries' },
        { column: 'parent_skill_id', target: 'skills' },
      ]),
    );
    expect(fkTargets('loot_filter_rules')).toEqual([
      { column: 'column_id', target: 'loot_filter_columns' },
    ]);
  });

  it('keeps unique slugs on catalog and content tables', () => {
    for (const name of [
      'authors',
      'masteries',
      'mastery_combinations',
      'assets',
      'constellations',
      'builds',
      'tier_lists',
    ]) {
      const cfg = configOf(name);
      const unique =
        column(name, 'slug').isUnique ||
        cfg.uniqueConstraints.some((u) => u.columns.map((c) => c.name).join() === 'slug');
      expect(unique, name).toBe(true);
    }
  });

  it('enforces one combination per mastery pair', () => {
    const pairs = configOf('mastery_combinations').uniqueConstraints.map((u) =>
      u.columns.map((c) => c.name).join(),
    );
    expect(pairs).toContain('mastery_a_id,mastery_b_id');
  });

  it('keeps skill slugs unique per mastery', () => {
    const pairs = configOf('skills').uniqueConstraints.map((u) =>
      u.columns.map((c) => c.name).join(),
    );
    expect(pairs).toContain('mastery_id,slug');
  });
});

describe('database schema: third-party adaptations (data-model rev. 6)', () => {
  const fkTargets = (name: string) =>
    configOf(name).foreignKeys.map((fk) => {
      const ref = fk.reference();
      return { column: ref.columns[0]?.name, target: getTableName(ref.foreignTable) };
    });

  it('keys build_adaptations by build_id and requires every FR-28 provenance field', () => {
    expect(column('build_adaptations', 'build_id').primary).toBe(true);
    for (const col of [
      'source_id',
      'evidence_id',
      'source_url',
      'original_title',
      'original_author',
      'original_site',
      'retrieved_on',
      'adaptation_editor',
      'transformation_scope',
      'transformation_notes',
      'adaptation_version',
      'last_reviewed_on',
      'reviewed_by',
      'change_log',
      'attribution_text',
      'adaptation_state',
    ]) {
      expect(column('build_adaptations', col).notNull, col).toBe(true);
    }
    expect(column('build_adaptations', 'source_revision_ref').notNull).toBe(false);
    const scope = column('build_adaptations', 'transformation_scope');
    expect(is(scope, PgArray)).toBe(true);
    if (!is(scope, PgArray)) throw new Error('transformation_scope is not an array column');
    expect(scope.baseColumn.columnType).toBe('PgText');
  });

  it('points each adaptation at its build, source and private evidence row', () => {
    expect(fkTargets('build_adaptations')).toEqual(
      expect.arrayContaining([
        { column: 'build_id', target: 'builds' },
        { column: 'source_id', target: 'sources' },
        { column: 'evidence_id', target: 'source_rights_evidence' },
      ]),
    );
    expect(fkTargets('source_rights_evidence')).toEqual(
      expect.arrayContaining([{ column: 'source_id', target: 'sources' }]),
    );
  });

  it('stores evidence coverage, validity and the independent verifier', () => {
    for (const col of [
      'evidence_type',
      'evidence_ref',
      'covers_adaptation',
      'covers_translation',
      'covers_images',
      'scope_notes',
      'granted_by',
      'recorded_on',
      'status',
      'verified_by',
      'verified_on',
    ]) {
      expect(column('source_rights_evidence', col).notNull, col).toBe(true);
    }
    expect(column('source_rights_evidence', 'covers_images').default).toBe(false);
    expect(column('source_rights_evidence', 'license_name').notNull).toBe(false);
    expect(column('source_rights_evidence', 'license_url').notNull).toBe(false);
    expect(column('source_rights_evidence', 'valid_until').notNull).toBe(false);
  });

  it('keeps unresolved responses, execution and review fields nullable', () => {
    for (const col of ['response_ref', 'responded_on']) {
      expect(column('permission_requests', col).notNull, col).toBe(false);
    }
    for (const col of ['build_id', 'tier_entry_id', 'executed_on', 'executed_by']) {
      expect(column('takedown_events', col).notNull, col).toBe(false);
    }
    for (const col of ['build_id', 'fingerprint', 'reviewed_by']) {
      expect(column('source_change_events', col).notNull, col).toBe(false);
    }
    expect(fkTargets('takedown_events')).toEqual(
      expect.arrayContaining([
        { column: 'build_id', target: 'builds' },
        { column: 'tier_entry_id', target: 'tier_entries' },
      ]),
    );
  });
});

describe('database schema: indexes', () => {
  // Index columns are PgColumn or PgArray (not a shared base), so read the SQL column name directly.
  const colName = (c: unknown): string => {
    const name = (c as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  };

  it('indexes tier entries by list, tier and position', () => {
    const names = configOf('tier_entries').indexes.map((i) => i.config.columns.map(colName).join());
    expect(names).toContain('tier_list_id,tier,position');
  });

  it('adds GIN indexes on the builds filter arrays', () => {
    const gin = configOf('builds').indexes.filter((i) => i.config.method === 'gin');
    const cols = gin.map((i) => i.config.columns.map(colName).join());
    expect(cols).toEqual(expect.arrayContaining(['damage_types', 'content_tags']));
  });
});

describe('database schema: scope boundaries', () => {
  it('declares no publication, asset or tier-entry CHECK gates (those are T-055)', () => {
    for (const name of EXPECTED_TABLES.filter((n) => n !== 'mastery_combinations')) {
      expect(
        configOf(name).checks.map((c) => c.name),
        name,
      ).toEqual([]);
    }
  });

  it('declares only the structural CHECK that orders each mastery pair', () => {
    expect(configOf('mastery_combinations').checks).toHaveLength(1);
  });
});
