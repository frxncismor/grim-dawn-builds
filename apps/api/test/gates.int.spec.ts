import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PublicBuildSchema, TierEntrySchema } from '@gd/domain';

const ROOT = join(import.meta.dirname, '../../..');
const COMPOSE_PATH = join(ROOT, 'infra/docker/compose.yaml');
const POSTGRES_IMAGE = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(COMPOSE_PATH, 'utf8'),
)?.[1];
const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const DATABASE = 'gd_gates_test';
const MASTER_ID = '00000000-0000-4000-8000-000000000001';
const AUTHOR_ID = '00000000-0000-4000-8000-000000000002';
const PLACEHOLDER_AUTHOR_ID = '00000000-0000-4000-8000-000000000003';
const SOURCE_ID = '00000000-0000-4000-8000-000000000004';
const TIER_LIST_ID = '00000000-0000-4000-8000-000000000005';
const COMBINATION_ID = '00000000-0000-4000-8000-000000000006';

interface CommandResult {
  readonly status: number;
  readonly output: string;
}

let containerName: string | undefined;

function docker(args: readonly string[], input?: string): CommandResult {
  const result = spawnSync('docker', [...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Docker command failed (${result.error.message})`);
  }
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function expectDockerSuccess(result: CommandResult, label: string): void {
  expect(result.status, `${label}: ${result.output}`).toBe(0);
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const result = docker([
      'exec',
      containerName!,
      'pg_isready',
      '-h',
      '127.0.0.1',
      '-U',
      'postgres',
      '-d',
      DATABASE,
    ]);
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('The isolated PostgreSQL 17 fixture did not become ready');
}

function psql(
  sql: string,
  options: { readonly database?: string; readonly user?: string; readonly tcp?: boolean } = {},
): CommandResult {
  const args = [
    'exec',
    '-i',
    containerName!,
    'psql',
    '--no-psqlrc',
    '--no-align',
    '--tuples-only',
    '--set',
    'ON_ERROR_STOP=1',
    '--set',
    'VERBOSITY=verbose',
  ];
  if (options.tcp) args.push('-h', '127.0.0.1');
  args.push('-U', options.user ?? 'postgres', '-d', options.database ?? DATABASE, '-f', '-');
  return docker(args, sql);
}

function insertBuild(options: {
  readonly slug: string;
  readonly authorId?: string;
  readonly rights?: 'pending' | 'own_original';
  readonly reviewState?: 'borrador' | 'en_revision' | 'publicado';
  readonly reviewer?: string | null;
  readonly source?: boolean;
}): string {
  const rights = options.rights ?? 'own_original';
  const reviewer = options.reviewer === null ? 'NULL' : "'Revisor de fixture'";
  const attachSource =
    options.source === false
      ? ''
      : `INSERT INTO build_sources (build_id, source_id, role)
       SELECT id, '${SOURCE_ID}', 'principal' FROM builds WHERE slug = '${options.slug}';`;
  return `
    INSERT INTO builds (
      slug, title, title_a_mastery_id, eyebrow, subtitle, summary, damage_types, playstyle,
      content_tags, game_version, author_id, review_state, rights_status, rights_confirmed_by,
      rights_confirmed_on, reviewed_by, published_at, footer_disclaimer, hero_callout_title,
      hero_callout_body, origin
    ) VALUES (
      '${options.slug}', 'Build fixture', '${MASTER_ID}', 'Fixture', 'Subtítulo', 'Resumen',
      ARRAY['fisico']::damage_type[], 'melee', ARRAY['campana']::content_tag[], '1.2.1.0',
      '${options.authorId ?? AUTHOR_ID}', '${options.reviewState ?? 'publicado'}', '${rights}',
      'Confirmación fixture', CURRENT_DATE, ${reviewer}, CURRENT_DATE, 'Aviso fixture',
      'Llamada fixture', ARRAY['Detalle fixture'], 'fixture'
    );
    ${attachSource}
  `;
}

interface TierEntryOptions {
  readonly displayName?: string | null;
  readonly entryKind?: 'placeholder' | 'enlace_externo' | 'build_propia';
  readonly tier?: 'A' | 'sin_clasificar';
  readonly buildId?: string | null;
  readonly contentStatus?: 'placeholder' | 'verificado';
  readonly rightsStatus?: 'pending' | 'own_original' | 'link_only';
  readonly externalUrl?: string | null;
  readonly externalAuthor?: string | null;
  readonly sourceId?: string | null;
  readonly evaluatedOn?: string | null;
}

function insertTierEntry(options: TierEntryOptions = {}): string {
  const entryKind = options.entryKind ?? 'placeholder';
  const tier = options.tier ?? (entryKind === 'placeholder' ? 'sin_clasificar' : 'A');
  const contentStatus =
    options.contentStatus ?? (entryKind === 'placeholder' ? 'placeholder' : 'verificado');
  const rightsStatus =
    options.rightsStatus ?? (entryKind === 'enlace_externo' ? 'link_only' : 'pending');
  const displayName =
    options.displayName === null ? 'NULL' : `'${options.displayName ?? 'Entrada fixture'}'`;
  const buildId = options.buildId === null ? 'NULL' : (options.buildId ?? 'NULL');
  const externalUrl =
    options.externalUrl === null
      ? 'NULL'
      : options.externalUrl === undefined && entryKind !== 'enlace_externo'
        ? 'NULL'
        : `'${options.externalUrl ?? 'https://example.invalid/synthetic'}'`;
  const externalAuthor =
    options.externalAuthor === null
      ? 'NULL'
      : options.externalAuthor === undefined && entryKind !== 'enlace_externo'
        ? 'NULL'
        : `'${options.externalAuthor ?? 'Autor fixture'}'`;
  const sourceId = options.sourceId === null ? 'NULL' : `'${options.sourceId ?? SOURCE_ID}'`;
  const evaluatedOn =
    options.evaluatedOn === null ? 'NULL' : (options.evaluatedOn ?? 'CURRENT_DATE');
  return `
    INSERT INTO tier_entries (
      tier_list_id, combination_id, build_id, display_name, entry_kind, tier, mastery_ids,
      damage_types, playstyle, content_tags, note, content_status, rights_status, review_state,
      external_url, external_author, source_id, evaluated_on, position, origin
    ) VALUES (
      '${TIER_LIST_ID}', '${COMBINATION_ID}', ${buildId}, ${displayName},
      '${entryKind}', '${tier}',
      ARRAY['${MASTER_ID}']::uuid[], ARRAY['fisico']::damage_type[], 'melee',
      ARRAY['campana']::content_tag[], 'Fixture SQL sintético',
      '${contentStatus}', '${rightsStatus}',
      'borrador', ${externalUrl}, ${externalAuthor}, ${sourceId}, ${evaluatedOn}, 1, 'fixture'
    );
  `;
}

function rejectedByPublicationGate(sql: string, database = DATABASE): void {
  const result = psql(`BEGIN;\n${sql}\nSET CONSTRAINTS ALL IMMEDIATE;\nCOMMIT;`, { database });
  expect(result.status, result.output).not.toBe(0);
  expect(result.output, result.output).toContain('23514');
}

interface CheckMutation {
  readonly constraint: string;
  readonly table: 'builds' | 'tier_entries' | 'assets';
  readonly violatingRow: string;
}

const CHECK_MUTATIONS: readonly CheckMutation[] = [
  {
    constraint: 'builds_publication_ck',
    table: 'builds',
    violatingRow: insertBuild({ slug: 'mutation-pending-publication', rights: 'pending' }),
  },
  {
    constraint: 'tier_entries_identity_ck',
    table: 'tier_entries',
    violatingRow: insertTierEntry({ displayName: null }),
  },
  {
    constraint: 'tier_entries_placeholder_ck',
    table: 'tier_entries',
    violatingRow: insertTierEntry({ entryKind: 'placeholder', tier: 'A' }),
  },
  {
    constraint: 'tier_entries_link_only_ck',
    table: 'tier_entries',
    violatingRow: insertTierEntry({ entryKind: 'enlace_externo', externalUrl: null }),
  },
  {
    constraint: 'tier_entries_build_ck',
    table: 'tier_entries',
    violatingRow: insertTierEntry({ entryKind: 'build_propia', tier: 'A' }),
  },
  {
    constraint: 'tier_entries_real_tier_ck',
    table: 'tier_entries',
    violatingRow: insertTierEntry({
      entryKind: 'build_propia',
      tier: 'A',
      displayName: null,
      buildId: "(SELECT id FROM builds WHERE slug = 'valid-published-build')",
      sourceId: null,
      evaluatedOn: null,
    }),
  },
  {
    constraint: 'assets_approved_provenance_ck',
    table: 'assets',
    violatingRow: `INSERT INTO assets (slug, file_path, recorded_on, status, fallback_svg)
      VALUES ('mutation-approved-no-provenance', 'assets/no-rights.svg', CURRENT_DATE, 'approved', '<svg/>');`,
  },
  {
    constraint: 'assets_file_path_approved_ck',
    table: 'assets',
    violatingRow: `INSERT INTO assets (
        slug, file_path, origin_url, rights_holder, license_or_permission, proof_ref,
        recorded_on, status, fallback_svg
      ) VALUES ('mutation-unapproved-file', 'assets/not-approved.svg',
        'https://example.invalid/asset', 'Titular fixture', 'Licencia fixture',
        'prueba-sintetica', CURRENT_DATE, 'pending', '<svg/>');`,
  },
];

function proveCheckAndMutation(check: CheckMutation): void {
  const rejected = psql(`BEGIN;\n${check.violatingRow}\nSET CONSTRAINTS ALL IMMEDIATE;\nCOMMIT;`);
  expect(rejected.status, `${check.constraint}: ${rejected.output}`).not.toBe(0);
  expect(rejected.output, check.constraint).toContain('23514');
  expect(rejected.output, check.constraint).toContain(check.constraint);

  const acceptedAfterMutation = psql(`
    BEGIN;
    ALTER TABLE ${check.table} DROP CONSTRAINT ${check.constraint};
    ${check.violatingRow}
    SET CONSTRAINTS ALL IMMEDIATE;
    ROLLBACK;
    SELECT conname FROM pg_constraint WHERE conname = '${check.constraint}';
  `);
  expectDockerSuccess(acceptedAfterMutation, `mutation transaction for ${check.constraint}`);
  expect(acceptedAfterMutation.output).toContain(check.constraint);
}

const databaseSuite = RUN_DB_TESTS ? describe : describe.skip;

databaseSuite('PostgreSQL publication and API-role gates (T-073)', () => {
  beforeAll(async () => {
    if (!POSTGRES_IMAGE || !/@sha256:[a-f0-9]{64}$/.test(POSTGRES_IMAGE)) {
      throw new Error('The Compose file must pin the PostgreSQL 17 fixture image by digest');
    }
    const imagePresent = docker(['image', 'inspect', POSTGRES_IMAGE, '--format', '{{.Id}}']);
    if (imagePresent.status !== 0) {
      throw new Error(
        'The pinned PostgreSQL 17 image is not available locally; the test never pulls it',
      );
    }

    containerName = `gd-gates-${process.pid}-${randomBytes(4).toString('hex')}`;
    const started = docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--network',
      'none',
      '--memory',
      '512m',
      '--memory-swap',
      '512m',
      '--cpus',
      '0.50',
      '--pids-limit',
      '100',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=256m',
      '--tmpfs',
      '/var/run/postgresql:rw,nosuid,nodev,noexec,size=16m',
      '--env',
      `POSTGRES_DB=${DATABASE}`,
      '--env',
      'POSTGRES_USER=postgres',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      POSTGRES_IMAGE,
    ]);
    expectDockerSuccess(started, 'start isolated PostgreSQL container');
    await waitForPostgres();

    const roleSetup = psql(`
      CREATE ROLE migrator NOLOGIN;
      CREATE ROLE importer NOLOGIN;
      CREATE ROLE editor NOLOGIN;
      CREATE ROLE api_ro NOLOGIN;
      GRANT CREATE ON DATABASE ${DATABASE} TO migrator;
      GRANT USAGE, CREATE ON SCHEMA public TO migrator;
      CREATE SCHEMA drizzle AUTHORIZATION migrator;
      ALTER ROLE migrator LOGIN;
      ALTER ROLE api_ro LOGIN;
    `);
    expectDockerSuccess(roleSetup, 'prepare restricted migration and API roles');

    // Drizzle creates its journal before applying custom SQL. This fixture applies
    // SQL manually to exercise upgrades, so prepare the same relation as its owner.
    expectDockerSuccess(
      psql(
        `CREATE TABLE drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
      );`,
        { user: 'migrator', tcp: true },
      ),
      'prepare the Drizzle journal as migrator before applying SQL',
    );

    const journal = JSON.parse(
      readFileSync(join(ROOT, 'apps/api/drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    for (const entry of journal.entries) {
      const sql = readFileSync(join(ROOT, `apps/api/drizzle/${entry.tag}.sql`), 'utf8');
      if (entry.tag === '0002_public_content') {
        expectDockerSuccess(
          psql(`
          INSERT INTO sources (id, kind, title, author_name, license_note, retrieved_on, notes, origin)
          VALUES ('00000000-0000-4000-8000-000000000099', 'original', 'Legacy source',
            'Autor de prueba', 'Prueba', CURRENT_DATE, 'ORPHAN-PRIVATE-CANARY', 'fixture');
        `),
          'insert legacy source before upgrading populated schema',
        );
        const upgrade = psql(
          `BEGIN;
          INSERT INTO content_origin (bootstrapped_at, payload_hash, migration_version)
          VALUES (CURRENT_TIMESTAMP, 'synthetic-hash', '0001_gates');
          ${sql}
          SELECT slug FROM sources WHERE id = '00000000-0000-4000-8000-000000000099';
          ROLLBACK;`,
          { user: 'migrator', tcp: true },
        );
        expectDockerSuccess(upgrade, 'upgrade bootstrapped legacy schema inside rollback');
        expect(upgrade.output).toContain('legacy-00000000-0000-4000-8000-000000000099');
      }
      const migration = psql(sql, {
        user: 'migrator',
        tcp: true,
      });
      expectDockerSuccess(migration, `apply ${entry.tag} as migrator (not superuser)`);
    }

    const fixtureData = psql(`
      BEGIN;
      INSERT INTO masteries (id, slug, name_es, name_en, accent_token, fallback_icon)
      VALUES ('${MASTER_ID}', 'fixture-mastery', 'Maestría', 'Mastery', 'storm', 'sword');
      INSERT INTO authors (id, slug, display_name, is_placeholder, origin)
      VALUES
        ('${AUTHOR_ID}', 'fixture-author', 'Autor de fixture', false, 'fixture'),
        ('${PLACEHOLDER_AUTHOR_ID}', 'por-confirmar', 'Autor sin confirmar', true, 'fixture');
      INSERT INTO sources (id, slug, kind, title, url, author_name, license_note, retrieved_on, notes, permission_ref, origin)
      VALUES ('${SOURCE_ID}', 'fixture-source', 'original', 'Fuente de fixture', NULL, 'Autor de fixture',
              'Contenido sintético de prueba', CURRENT_DATE, 'PRIVATE-NOTES-CANARY', 'PRIVATE-EVIDENCE-CANARY', 'fixture');
      INSERT INTO mastery_combinations (id, slug, mastery_a_id, mastery_b_id)
      VALUES ('${COMBINATION_ID}', 'fixture-single-mastery', '${MASTER_ID}', NULL);
      INSERT INTO tier_lists (id, slug, title, game_version, review_state, author_id, origin)
      VALUES ('${TIER_LIST_ID}', 'fixture-tier-list', 'Tier list fixture', '1.2.1.0',
              'borrador', '${AUTHOR_ID}', 'fixture');
      INSERT INTO assets (slug, recorded_on, status, fallback_svg)
      VALUES ('fixture-pending-asset', CURRENT_DATE, 'pending', '<svg/>');
      INSERT INTO assets (
        slug, file_path, origin_url, rights_holder, license_or_permission, proof_ref,
        recorded_on, status, fallback_svg
      ) VALUES ('fixture-approved-asset', 'assets/synthetic.svg', 'https://example.invalid/asset',
                'Titular fixture', 'Licencia fixture', 'prueba-sintetica', CURRENT_DATE,
                'approved', '<svg/>');
      ${insertBuild({ slug: 'valid-published-build' })}
      ${insertTierEntry()}
      ${insertTierEntry({
        entryKind: 'enlace_externo',
        tier: 'sin_clasificar',
        contentStatus: 'verificado',
        rightsStatus: 'link_only',
      })}
      ${insertTierEntry({
        entryKind: 'build_propia',
        tier: 'A',
        contentStatus: 'verificado',
        rightsStatus: 'own_original',
        displayName: null,
        buildId: "(SELECT id FROM builds WHERE slug = 'valid-published-build')",
      })}
      ${insertBuild({ slug: 'draft-approved-rights', reviewState: 'borrador' })}
      ${insertBuild({ slug: 'draft-pending-rights', reviewState: 'borrador', rights: 'pending' })}
      ${insertBuild({ slug: 'in-review-approved-rights', reviewState: 'en_revision' })}
      COMMIT;
    `);
    expectDockerSuccess(fixtureData, 'insert synthetic fixture rows');
  }, 90_000);

  afterAll(() => {
    if (containerName) docker(['rm', '--force', containerName]);
  });

  it('allows a valid publication with a real author, approved rights, reviewer and source', () => {
    const result = psql("SELECT slug FROM v_public_builds WHERE slug = 'valid-published-build'", {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(result, 'read public build view as api_ro');
    expect(result.output).toContain('valid-published-build');
  });

  it('rejects published rows with pending rights', () => {
    rejectedByPublicationGate(insertBuild({ slug: 'published-pending-rights', rights: 'pending' }));
  });

  it('rejects published rows without a reviewer', () => {
    rejectedByPublicationGate(insertBuild({ slug: 'published-without-reviewer', reviewer: null }));
  });

  it('rejects published rows without a source', () => {
    rejectedByPublicationGate(insertBuild({ slug: 'published-without-source', source: false }));
  });

  it('rejects published rows whose author is a placeholder', () => {
    rejectedByPublicationGate(
      insertBuild({ slug: 'published-placeholder-author', authorId: PLACEHOLDER_AUTHOR_ID }),
    );
  });

  it('rejects approved assets without provenance and file paths on unapproved assets', () => {
    const missingProvenance = psql(`
      INSERT INTO assets (slug, recorded_on, status, fallback_svg)
      VALUES ('approved-without-provenance', CURRENT_DATE, 'approved', '<svg/>');
    `);
    expect(missingProvenance.status).not.toBe(0);
    expect(missingProvenance.output).toContain('23514');

    const unapprovedFile = psql(`
      INSERT INTO assets (slug, file_path, recorded_on, status, fallback_svg)
      VALUES ('unapproved-file-path', 'assets/unapproved.svg', CURRENT_DATE, 'pending', '<svg/>');
    `);
    expect(unapprovedFile.status).not.toBe(0);
    expect(unapprovedFile.output).toContain('23514');
  });

  it('keeps drafts and pending rights out of public views', () => {
    const result = psql('SELECT slug FROM v_public_builds ORDER BY slug', {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(result, 'read public view as api_ro');
    expect(result.output).toContain('valid-published-build');
    expect(result.output).not.toContain('draft-approved-rights');
    expect(result.output).not.toContain('draft-pending-rights');
    expect(result.output).not.toContain('in-review-approved-rights');

    const assets = psql('SELECT slug FROM v_public_assets ORDER BY slug', {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(assets, 'read public assets view as api_ro');
    expect(assets.output).not.toContain('fixture-pending-asset');
    expect(assets.output).toContain('fixture-approved-asset');
  });

  it('denies api_ro access to base tables and writes', () => {
    const baseRead = psql('SELECT slug FROM builds LIMIT 1', { user: 'api_ro', tcp: true });
    expect(baseRead.status).not.toBe(0);
    expect(baseRead.output).toContain('42501');

    const write = psql(
      "INSERT INTO authors (slug, display_name, is_placeholder, origin) VALUES ('api-ro-write', 'Denied', false, 'fixture')",
      { user: 'api_ro', tcp: true },
    );
    expect(write.status).not.toBe(0);
    expect(write.output).toContain('42501');
  });

  it('detects removal of each database CHECK using isolated rollback mutations', () => {
    expect(CHECK_MUTATIONS).toHaveLength(8);
    for (const check of CHECK_MUTATIONS) proveCheckAndMutation(check);
  });

  it('reconstructs every public guide section without exposing editorial fields (T-127)', () => {
    const setup = psql(`
      BEGIN;
      INSERT INTO build_masteries (build_id, mastery_id, position, role_text)
        SELECT id, '${MASTER_ID}', 1, 'Daño sintético' FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO skills (id, mastery_id, slug, name_es, name_en, bar_required)
        VALUES ('00000000-0000-4000-8000-000000000010', '${MASTER_ID}', 'skill-root', 'Raíz', 'Root', 0);
      INSERT INTO build_skill_nodes (id, build_id, skill_id, status, rationale, layout_x, layout_y, display_order)
        SELECT '00000000-0000-4000-8000-000000000011', id, '00000000-0000-4000-8000-000000000010',
          'recomendada', 'Motivo sintético', 10, 20, 1 FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO build_priorities (build_id, position, rank, group_label, headline, note, skill_node_ids)
        SELECT id, 1, NULL, 'Grupo', 'Prioridad', 'Nota', ARRAY['00000000-0000-4000-8000-000000000011']::uuid[]
        FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO build_purchase_steps (build_id, position, threshold_label, mastery_id, title, body, highlights)
        SELECT id, 1, 'Barra 0', '${MASTER_ID}', 'Compra', 'Detalle',
          '[{"skill_node_slug":"skill-root","points":null,"private_note":"PRIVATE-JSON-CANARY"}]'
        FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO build_notes (build_id, kind, label, headline, detail, position)
        SELECT id, 'general', 'Nota', 'Consejo', 'Detalle', 1 FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO build_notes (build_id, kind, label, headline, detail, position)
        SELECT id, 'general', 'Oculta', 'DRAFT-CHILD-CANARY', 'No visible', 1 FROM builds WHERE slug = 'draft-pending-rights';
      INSERT INTO constellations (id, slug, name_en, tier_level, layout)
        VALUES ('00000000-0000-4000-8000-000000000012', 'constellation-mentioned', 'Mentioned', NULL,
          '{"nodes":[{"id":"star","x":1,"y":2,"private_note":"PRIVATE-LAYOUT-CANARY"}],"edges":[],"private_note":"PRIVATE-LAYOUT-CANARY"}');
      INSERT INTO build_constellations (build_id, constellation_id, position)
        SELECT id, '00000000-0000-4000-8000-000000000012', 1 FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO build_devotion_steps (build_id, position, label, title_override, body, bindings, accent, verification, kind)
        SELECT id, 1, 'Paso', 'Mención', 'Detalle',
          '[{"power_en":"Power","skill_node_slug":null,"skill_name_es":"Habilidad externa","private_note":"PRIVATE-JSON-CANARY"}]',
          'storm', 'sin_verificar', 'ruta' FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO loot_filter_columns (id, build_id, position, name, subtitle)
        SELECT '00000000-0000-4000-8000-000000000013', id, 1, 'Calidad', 'Subtítulo' FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO loot_filter_rules (column_id, action, label, detail, position)
        VALUES ('00000000-0000-4000-8000-000000000013', 'marcar', 'Regla', 'Detalle', 1);
      INSERT INTO build_guides_npcs (build_id, position, group_label, name, location, detail)
        SELECT id, 1, 'Acto', 'NPC', 'Lugar', 'Detalle' FROM builds WHERE slug = 'valid-published-build';
      INSERT INTO build_sections_meta (build_id, section_key, position, visible)
        SELECT id, 'resumen', 1, true FROM builds WHERE slug = 'valid-published-build';
      COMMIT;
    `);
    expectDockerSuccess(setup, 'insert all child sections');
    const result = psql(
      "SELECT document::text FROM v_public_build_documents WHERE slug = 'valid-published-build'",
      { user: 'api_ro', tcp: true },
    );
    expectDockerSuccess(result, 'select complete public document');
    const document: unknown = JSON.parse(result.output.trim());
    const build = PublicBuildSchema.parse(document);
    for (const field of [
      'masteries',
      'skill_nodes',
      'priorities',
      'purchase_steps',
      'notes',
      'loot_filter_columns',
      'guide_npcs',
      'constellations',
      'devotion_steps',
      'sections_meta',
    ] as const) {
      expect(build[field], field).toHaveLength(1);
    }
    expect(build.priorities[0]?.skill_node_slugs).toEqual(['skill-root']);
    expect(build.purchase_steps[0]?.highlights).toEqual([
      { skill_node_slug: 'skill-root', points: null },
    ]);
    expect(build.constellations[0]?.tier_level).toBeNull();
    expect(build.constellations[0]?.layout).toEqual({
      nodes: [{ id: 'star', x: 1, y: 2 }],
      edges: [],
    });
    expect(build.skill_nodes[0]).toMatchObject({
      name_es: 'Raíz',
      name_en: 'Root',
      layout: { x: 10, y: 20 },
    });
    expect(build.loot_filter_columns[0]?.rules).toEqual([
      { action: 'marcar', label: 'Regla', detail: 'Detalle', position: 1 },
    ]);
    expect(build.devotion_steps[0]?.bindings).toEqual([
      { power_en: 'Power', skill_node_slug: null, skill_name_es: 'Habilidad externa' },
    ]);
    expect(result.output).not.toMatch(
      /PRIVATE-|DRAFT-CHILD|reviewed_by|rights_confirmed|permission_ref|rights_notes/,
    );
    const all = psql('SELECT document::text FROM v_public_build_documents', {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(all, 'read all public documents');
    expect(all.output).not.toMatch(/draft-|in-review|DRAFT-CHILD/);
    const denied = psql('SELECT * FROM build_constellations', { user: 'api_ro', tcp: true });
    expect(denied.status).not.toBe(0);
    expect(denied.output).toContain('42501');
  });

  it('upgrades source identity without publishing orphan data or asset evidence', () => {
    const legacy = psql(
      "SELECT slug FROM sources WHERE id = '00000000-0000-4000-8000-000000000099'",
    );
    expectDockerSuccess(legacy, 'read migrated legacy source');
    expect(legacy.output.trim()).toBe('legacy-00000000-0000-4000-8000-000000000099');
    const sources = psql('SELECT row_to_json(s)::text FROM v_public_sources s', {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(sources, 'read public sources');
    expect(sources.output).toContain('fixture-source');
    expect(sources.output).not.toMatch(/PRIVATE-|legacy-|permission_ref|"notes"/);
    const assets = psql('SELECT count(*) FROM v_public_assets WHERE proof_ref IS NOT NULL', {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(assets, 'redact private asset evidence');
    expect(assets.output.trim()).toBe('0');
    for (const view of [
      'v_public_sources',
      'v_public_masteries',
      'v_public_mastery_combinations',
      'v_public_build_documents',
    ]) {
      const write = psql(`DELETE FROM ${view}`, { user: 'api_ro', tcp: true });
      expect(write.status, view).not.toBe(0);
      // PostgreSQL can reject a joined view during rewrite (55000), before ACLs.
      // Check the ACL independently so non-updatability cannot hide a bad grant.
      expect(write.output, view).toMatch(/42501|55000/);
      const grants = psql(`SELECT has_table_privilege('api_ro', '${view}', 'SELECT')
        AND NOT has_table_privilege('api_ro', '${view}', 'INSERT')
        AND NOT has_table_privilege('api_ro', '${view}', 'UPDATE')
        AND NOT has_table_privilege('api_ro', '${view}', 'DELETE')`);
      expectDockerSuccess(grants, `inspect ${view} ACL`);
      expect(grants.output.trim(), view).toBe('t');
    }
    const baseGrants =
      psql(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (has_table_privilege('api_ro', c.oid, 'SELECT') OR has_table_privilege('api_ro', c.oid, 'INSERT')
        OR has_table_privilege('api_ro', c.oid, 'UPDATE') OR has_table_privilege('api_ro', c.oid, 'DELETE'))`);
    expectDockerSuccess(baseGrants, 'inspect every editorial base table ACL');
    expect(baseGrants.output.trim()).toBe('0');
  });

  it('withdraws guide, source and author projections together, including link_only bodies', () => {
    const result = psql(`
      BEGIN;
      UPDATE builds SET rights_status = 'link_only' WHERE slug = 'valid-published-build';
      SET LOCAL ROLE api_ro;
      SELECT 'BODY=' || count(*) FROM v_public_build_documents;
      SELECT 'SOURCE=' || count(*) FROM v_public_sources;
      SELECT 'AUTHOR=' || count(*) FROM v_public_authors;
      RESET ROLE;
      UPDATE builds SET review_state = 'borrador' WHERE slug = 'valid-published-build';
      SET LOCAL ROLE api_ro;
      SELECT 'DRAFT=' || count(*) FROM v_public_build_documents;
      ROLLBACK;
    `);
    expectDockerSuccess(result, 'withdraw public projections in rollback transaction');
    for (const label of ['BODY', 'SOURCE', 'AUTHOR', 'DRAFT']) {
      expect(result.output).toContain(`${label}=0`);
    }
  });

  it('exposes safe tier states and slug references only while both list and entry are public', () => {
    const query = `SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.entry_kind), '[]') FROM v_public_tier_entries e;`;
    const result = psql(`BEGIN;
      UPDATE tier_lists SET review_state = 'publicado' WHERE id = '${TIER_LIST_ID}';
      UPDATE tier_entries SET review_state = 'publicado',
        rights_status = CASE WHEN entry_kind = 'enlace_externo' THEN 'link_only'::rights_status ELSE 'own_original'::rights_status END;
      SET LOCAL ROLE api_ro;
      ${query}
      RESET ROLE;
      UPDATE builds SET review_state = 'borrador' WHERE slug = 'valid-published-build';
      SET LOCAL ROLE api_ro;
      SELECT 'REMAINING=' || count(*) FROM v_public_tier_entries;
      RESET ROLE;
      UPDATE tier_lists SET review_state = 'borrador' WHERE id = '${TIER_LIST_ID}';
      SET LOCAL ROLE api_ro;
      SELECT 'HIDDEN=' || count(*) FROM v_public_tier_entries;
      ROLLBACK;`);
    expectDockerSuccess(result, 'read tier projections with API role in rollback transaction');
    const rows = JSON.parse(
      result.output.split('\n').find((line) => line.startsWith('[')) ?? 'null',
    ) as Record<string, unknown>[];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const projected = Object.fromEntries(
        Object.keys(TierEntrySchema.shape).map((key) => [key, row[key]]),
      );
      expect(TierEntrySchema.safeParse(projected).success).toBe(true);
      expect(row['combination_slug']).toBe('fixture-single-mastery');
      expect(row['source_slug']).toBe('fixture-source');
    }
    expect(result.output).toContain('REMAINING=2');
    expect(result.output).toContain('HIDDEN=0');
    expect(result.output).not.toMatch(/PRIVATE-|permission_ref|reviewed_by|rights_confirmed/);
  });
});
