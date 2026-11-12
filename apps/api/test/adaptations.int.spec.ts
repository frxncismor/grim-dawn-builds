/**
 * T-108 / AC-20: live PostgreSQL rejection tests for third-party adaptations.
 *
 * Every rejection below fails through the concrete SQL gate it names: the
 * `gates_build_adaptations_publication` trigger (publication gate) or the
 * `tier_entries_*` CHECK constraints. The last tests prove that `api_ro` reads
 * only `v_public_build_adaptations` and never the base tables or private fields.
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');
const COMPOSE_PATH = join(ROOT, 'infra/docker/compose.yaml');
const POSTGRES_IMAGE = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(COMPOSE_PATH, 'utf8'),
)?.[1];
const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const DATABASE = 'gd_adaptations_test';
const MASTER_ID = '00000000-0000-4000-8000-000000000101';
const AUTHOR_ID = '00000000-0000-4000-8000-000000000102';
const SOURCE_ID = '00000000-0000-4000-8000-000000000103';
const TIER_LIST_ID = '00000000-0000-4000-8000-000000000104';
const COMBINATION_ID = '00000000-0000-4000-8000-000000000105';
const BUILD_ID = '00000000-0000-4000-8000-000000000110';
const BUILD_PENDING_ID = '00000000-0000-4000-8000-000000000111';
const BUILD_OTHER_ID = '00000000-0000-4000-8000-000000000112';
const EVIDENCE_ID = '00000000-0000-4000-8000-000000000120';
const EVIDENCE_REVOKED_ID = '00000000-0000-4000-8000-000000000121';
const EVIDENCE_EXPIRED_ID = '00000000-0000-4000-8000-000000000122';
const EVIDENCE_NO_COVER_ID = '00000000-0000-4000-8000-000000000123';
const EVIDENCE_NO_IMAGES_ID = '00000000-0000-4000-8000-000000000124';
const EVIDENCE_IMAGES_ID = '00000000-0000-4000-8000-000000000125';

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

/** Runs `sql` in a transaction that is always rolled back, so fixtures stay isolated. */
function inRollback(sql: string): CommandResult {
  return psql(`BEGIN;\n${sql}\nSET CONSTRAINTS ALL IMMEDIATE;\nROLLBACK;`);
}

function insertBuild(options: {
  readonly id: string;
  readonly slug: string;
  readonly rights?: 'licensed' | 'pending';
  readonly reviewState?: 'borrador' | 'publicado';
}): string {
  return `
    INSERT INTO builds (
      id, slug, title, title_a_mastery_id, eyebrow, subtitle, summary, damage_types, playstyle,
      content_tags, game_version, author_id, review_state, rights_status, rights_confirmed_by,
      rights_confirmed_on, reviewed_by, published_at, footer_disclaimer, hero_callout_title,
      hero_callout_body, origin
    ) VALUES (
      '${options.id}', '${options.slug}', 'Build fixture', '${MASTER_ID}', 'Fixture', 'Subtítulo',
      'Resumen', ARRAY['fisico']::damage_type[], 'melee', ARRAY['campana']::content_tag[],
      '1.2.1.0', '${AUTHOR_ID}', '${options.reviewState ?? 'publicado'}',
      '${options.rights ?? 'licensed'}', 'Confirmación fixture', CURRENT_DATE, 'Revisor de fixture',
      CURRENT_DATE, 'Aviso fixture', 'Llamada fixture', ARRAY['Detalle fixture'], 'fixture'
    );
    INSERT INTO build_sources (build_id, source_id, role)
      VALUES ('${options.id}', '${SOURCE_ID}', 'principal');
  `;
}

interface EvidenceOptions {
  readonly id: string;
  readonly status?: 'vigente' | 'caducada' | 'revocada';
  readonly coversAdaptation?: boolean;
  readonly coversTranslation?: boolean;
  readonly coversImages?: boolean;
  readonly validUntil?: string | null;
}

function insertEvidence(options: EvidenceOptions): string {
  const status = options.status ?? 'vigente';
  const validUntil =
    options.validUntil === null
      ? 'NULL'
      : `'${options.validUntil ?? (status === 'caducada' ? '2026-05-01' : '2027-01-01')}'`;
  return `
    INSERT INTO source_rights_evidence (
      id, source_id, evidence_type, evidence_ref, license_name, license_url, covers_adaptation,
      covers_translation, covers_images, scope_notes, granted_by, recorded_on, valid_until, status,
      verified_by, verified_on
    ) VALUES (
      '${options.id}', '${SOURCE_ID}', 'licencia_explicita',
      'PRIVATE-EVIDENCE-CANARY', 'Licencia sintética', 'https://example.invalid/licencia',
      ${options.coversAdaptation ?? true}, ${options.coversTranslation ?? true},
      ${options.coversImages ?? false}, 'PRIVATE-SCOPE-CANARY', 'Titular sintético',
      '2026-01-01', ${validUntil}, '${status}', 'Revisor de derechos', '2026-01-02'
    );
  `;
}

interface AdaptationOptions {
  readonly buildId: string;
  readonly evidenceId: string;
  readonly state?: 'borrador' | 'en_revision' | 'publicado' | 'revision_pendiente' | 'retirada';
  readonly editor?: string;
  readonly scope?: readonly string[];
  readonly lastReviewedOn?: string;
}

function insertAdaptation(options: AdaptationOptions): string {
  const scope = (options.scope ?? ['estructura', 'traduccion'])
    .map((value) => `'${value}'`)
    .join(', ');
  return `
    INSERT INTO build_adaptations (
      build_id, source_id, evidence_id, source_url, original_title, original_author,
      original_site, retrieved_on, adaptation_editor, transformation_scope,
      transformation_notes, adaptation_version, source_revision_ref, last_reviewed_on,
      reviewed_by, change_log, attribution_text, adaptation_state
    ) VALUES (
      '${options.buildId}', '${SOURCE_ID}', '${options.evidenceId}',
      'https://example.invalid/build-original', 'Build original sintética', 'Autor sintético',
      'Sitio sintético', '2026-01-10', '${options.editor ?? 'Editor sintético'}',
      ARRAY[${scope}]::text[], 'PRIVATE-NOTES-CANARY', 1, 'revision-7',
      '${options.lastReviewedOn ?? '2026-06-01'}', 'Revisor de contenido sintético',
      '[{"adaptation_version": 1, "changed_on": "2026-02-01", "summary": "Sintética"}]',
      'Esta build fue adaptada de la fuente sintética.', '${options.state ?? 'publicado'}'
    );
  `;
}

function expectRejectedByGate(result: CommandResult, message: string): void {
  expect(result.status, result.output).not.toBe(0);
  expect(result.output, result.output).toContain('23514');
  expect(result.output, result.output).toContain(message);
}

const databaseSuite = RUN_DB_TESTS ? describe : describe.skip;

databaseSuite('third-party adaptation SQL gates (T-108, AC-20)', () => {
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

    containerName = `gd-adaptations-${process.pid}-${randomBytes(4).toString('hex')}`;
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

    expectDockerSuccess(
      psql(
        `CREATE TABLE drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
      );`,
        { user: 'migrator', tcp: true },
      ),
      'prepare the Drizzle journal as migrator before applying SQL',
    );

    // Drizzle's migrator applies every pending migration inside one transaction.
    // Replicate that exactly: it is what exposes 55P04 when a new enum value is
    // used before the commit that adds it.
    const journal = JSON.parse(
      readFileSync(join(ROOT, 'apps/api/drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    const pending = journal.entries
      .map((entry) => readFileSync(join(ROOT, `apps/api/drizzle/${entry.tag}.sql`), 'utf8'))
      .join('\n');
    expectDockerSuccess(
      psql(`BEGIN;\n${pending}\nCOMMIT;`, { user: 'migrator', tcp: true }),
      'apply every pending migration in one transaction as migrator (not superuser)',
    );

    const fixtureData = psql(`
      BEGIN;
      INSERT INTO masteries (id, slug, name_es, name_en, accent_token, fallback_icon)
      VALUES ('${MASTER_ID}', 'fixture-mastery', 'Maestría', 'Mastery', 'storm', 'sword');
      INSERT INTO authors (id, slug, display_name, is_placeholder, origin)
      VALUES ('${AUTHOR_ID}', 'fixture-author', 'Autor de fixture', false, 'fixture');
      INSERT INTO sources (id, slug, kind, title, url, author_name, license_note, retrieved_on, notes, origin)
      VALUES ('${SOURCE_ID}', 'fixture-source', 'original', 'Fuente de fixture', NULL,
              'Autor de fixture', 'Contenido sintético de prueba', CURRENT_DATE,
              'PRIVATE-SOURCE-NOTES', 'fixture');
      INSERT INTO mastery_combinations (id, slug, mastery_a_id, mastery_b_id)
      VALUES ('${COMBINATION_ID}', 'fixture-single-mastery', '${MASTER_ID}', NULL);
      INSERT INTO tier_lists (id, slug, title, game_version, review_state, author_id, origin)
      VALUES ('${TIER_LIST_ID}', 'fixture-tier-list', 'Tier list fixture', '1.2.1.0',
              'borrador', '${AUTHOR_ID}', 'fixture');
      ${insertBuild({ id: BUILD_ID, slug: 'adaptation-build' })}
      ${insertBuild({ id: BUILD_PENDING_ID, slug: 'pending-rights-build', rights: 'pending', reviewState: 'borrador' })}
      ${insertBuild({ id: BUILD_OTHER_ID, slug: 'other-adaptation-build' })}
      ${insertEvidence({ id: EVIDENCE_ID })}
      ${insertEvidence({ id: EVIDENCE_REVOKED_ID, status: 'revocada' })}
      ${insertEvidence({ id: EVIDENCE_EXPIRED_ID, validUntil: '2026-01-15' })}
      ${insertEvidence({ id: EVIDENCE_NO_COVER_ID, coversAdaptation: false })}
      ${insertEvidence({ id: EVIDENCE_NO_IMAGES_ID })}
      ${insertEvidence({ id: EVIDENCE_IMAGES_ID, coversImages: true })}
      ${insertAdaptation({ buildId: BUILD_ID, evidenceId: EVIDENCE_ID })}
      INSERT INTO tier_entries (
        tier_list_id, combination_id, build_id, display_name, entry_kind, tier, mastery_ids,
        damage_types, playstyle, content_tags, note, content_status, rights_status, review_state,
        external_url, external_author, source_id, evaluated_on, position, origin
      ) VALUES (
        '${TIER_LIST_ID}', '${COMBINATION_ID}', '${BUILD_ID}', NULL, 'build_adaptada', 'A',
        ARRAY['${MASTER_ID}']::uuid[], ARRAY['fisico']::damage_type[], 'melee',
        ARRAY['campana']::content_tag[], 'Adaptación sintética', 'sin_verificar', 'licensed',
        'publicado', NULL, NULL, '${SOURCE_ID}', CURRENT_DATE, 1, 'fixture'
      );
      INSERT INTO tier_entries (
        tier_list_id, combination_id, build_id, display_name, entry_kind, tier, mastery_ids,
        damage_types, playstyle, content_tags, note, content_status, rights_status, review_state,
        external_url, external_author, source_id, evaluated_on, position, origin
      ) VALUES (
        '${TIER_LIST_ID}', '${COMBINATION_ID}', NULL, 'Guía externa', 'enlace_externo',
        'sin_clasificar', ARRAY['${MASTER_ID}']::uuid[], ARRAY['fisico']::damage_type[], 'melee',
        ARRAY['campana']::content_tag[], 'Enlace sintético', 'sin_verificar', 'link_only',
        'publicado', 'https://example.invalid/guia', 'Autor externo', '${SOURCE_ID}', CURRENT_DATE,
        2, 'fixture'
      );
      COMMIT;
    `);
    expectDockerSuccess(fixtureData, 'insert synthetic adaptation fixture rows');
  }, 90_000);

  afterAll(() => {
    if (containerName) docker(['rm', '--force', containerName]);
  });

  it('installs the publication gate trigger and the public adaptation view', () => {
    const result = psql(`
      SELECT tgname FROM pg_trigger WHERE tgname = 'gates_build_adaptations_publication';
      SELECT viewname FROM pg_views WHERE viewname = 'v_public_build_adaptations';
    `);
    expectDockerSuccess(result, 'read adaptation gate and view names');
    expect(result.output).toContain('gates_build_adaptations_publication');
    expect(result.output).toContain('v_public_build_adaptations');
  });

  it('publishes only the allowed adaptation columns through v_public_build_adaptations', () => {
    const columns = psql(`
      SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'v_public_build_adaptations';
    `);
    expectDockerSuccess(columns, 'read public adaptation view columns');
    expect(columns.output.trim()).toBe(
      [
        'build_id',
        'source_url',
        'original_title',
        'original_author',
        'original_site',
        'attribution_text',
        'retrieved_on',
        'license_name',
        'license_url',
      ].join(','),
    );

    const row = psql('SELECT row_to_json(a)::text FROM v_public_build_adaptations a', {
      user: 'api_ro',
      tcp: true,
    });
    expectDockerSuccess(row, 'read public adaptation as api_ro');
    expect(row.output).toContain('Build original sintética');
    expect(row.output).toContain('Licencia sintética');
    expect(row.output).not.toMatch(
      /PRIVATE-|evidence_ref|transformation_notes|change_log|adaptation_editor|verified_by/,
    );
  });

  it('rejects a published adaptation whose evidence does not cover it (gates_build_adaptations_publication)', () => {
    expectRejectedByGate(
      inRollback(insertAdaptation({ buildId: BUILD_OTHER_ID, evidenceId: EVIDENCE_NO_COVER_ID })),
      'adaptation evidence must cover the adaptation',
    );
  });

  it('rejects a published adaptation with revoked evidence (gates_build_adaptations_publication)', () => {
    expectRejectedByGate(
      inRollback(insertAdaptation({ buildId: BUILD_OTHER_ID, evidenceId: EVIDENCE_REVOKED_ID })),
      'published adaptation requires vigente evidence',
    );
  });

  it('rejects a published adaptation whose evidence expired before the last review (gates_build_adaptations_publication)', () => {
    expectRejectedByGate(
      inRollback(insertAdaptation({ buildId: BUILD_OTHER_ID, evidenceId: EVIDENCE_EXPIRED_ID })),
      'evidence expired before the last review',
    );
  });

  it('rejects a published adaptation whose editor verified the rights (gates_build_adaptations_publication)', () => {
    expectRejectedByGate(
      inRollback(
        insertAdaptation({
          buildId: BUILD_OTHER_ID,
          evidenceId: EVIDENCE_ID,
          editor: 'Revisor de derechos',
        }),
      ),
      'adaptation editor cannot verify the rights evidence',
    );
  });

  it('rejects an image scope without image rights and accepts it when covered (gates_build_adaptations_publication)', () => {
    expectRejectedByGate(
      inRollback(
        insertAdaptation({
          buildId: BUILD_OTHER_ID,
          evidenceId: EVIDENCE_NO_IMAGES_ID,
          scope: ['estructura', 'imagenes'],
        }),
      ),
      'image scope requires image rights evidence',
    );

    expectDockerSuccess(
      inRollback(
        insertAdaptation({
          buildId: BUILD_OTHER_ID,
          evidenceId: EVIDENCE_IMAGES_ID,
          scope: ['estructura', 'imagenes'],
        }),
      ),
      'accept an adaptation whose evidence covers images',
    );
  });

  it('rejects a published adaptation on a build without publishable rights (gates_build_adaptations_publication)', () => {
    expectRejectedByGate(
      inRollback(insertAdaptation({ buildId: BUILD_PENDING_ID, evidenceId: EVIDENCE_ID })),
      'published adaptation requires licensed or permission_granted rights',
    );
  });

  it('rejects a link card with a real tier (tier_entries_link_only_ck)', () => {
    const result = inRollback(`
      INSERT INTO tier_entries (
        tier_list_id, combination_id, build_id, display_name, entry_kind, tier, mastery_ids,
        damage_types, playstyle, content_tags, note, content_status, rights_status, review_state,
        external_url, external_author, source_id, evaluated_on, position, origin
      ) VALUES (
        '${TIER_LIST_ID}', '${COMBINATION_ID}', NULL, 'Guía externa', 'enlace_externo', 'A',
        ARRAY['${MASTER_ID}']::uuid[], ARRAY['fisico']::damage_type[], 'melee',
        ARRAY['campana']::content_tag[], 'Enlace sintético', 'sin_verificar', 'link_only',
        'publicado', 'https://example.invalid/guia', 'Autor externo', '${SOURCE_ID}', CURRENT_DATE,
        3, 'fixture'
      );
    `);
    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toContain('23514');
    expect(result.output).toContain('tier_entries_link_only_ck');
  });

  it('rejects an adapted tier entry without build_id (tier_entries_adaptation_ck)', () => {
    const result = inRollback(`
      INSERT INTO tier_entries (
        tier_list_id, combination_id, build_id, display_name, entry_kind, tier, mastery_ids,
        damage_types, playstyle, content_tags, note, content_status, rights_status, review_state,
        external_url, external_author, source_id, evaluated_on, position, origin
      ) VALUES (
        '${TIER_LIST_ID}', '${COMBINATION_ID}', NULL, 'Adaptación sin build', 'build_adaptada', 'A',
        ARRAY['${MASTER_ID}']::uuid[], ARRAY['fisico']::damage_type[], 'melee',
        ARRAY['campana']::content_tag[], 'Adaptación sintética', 'sin_verificar', 'licensed',
        'publicado', NULL, NULL, '${SOURCE_ID}', CURRENT_DATE, 4, 'fixture'
      );
    `);
    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toContain('23514');
    expect(result.output).toContain('tier_entries_adaptation_ck');
  });

  it('hides withdrawn, review-pending or revoked adaptations from the public view', () => {
    const result = psql(`
      BEGIN;
      SELECT 'PUBLIC=' || count(*) FROM v_public_build_adaptations;
      UPDATE build_adaptations SET adaptation_state = 'revision_pendiente'
        WHERE build_id = '${BUILD_ID}';
      SET LOCAL ROLE api_ro;
      SELECT 'PENDING=' || count(*) FROM v_public_build_adaptations;
      RESET ROLE;
      UPDATE build_adaptations SET adaptation_state = 'retirada' WHERE build_id = '${BUILD_ID}';
      SET LOCAL ROLE api_ro;
      SELECT 'WITHDRAWN=' || count(*) FROM v_public_build_adaptations;
      RESET ROLE;
      UPDATE build_adaptations SET adaptation_state = 'publicado' WHERE build_id = '${BUILD_ID}';
      UPDATE source_rights_evidence SET status = 'revocada' WHERE id = '${EVIDENCE_ID}';
      SET LOCAL ROLE api_ro;
      SELECT 'REVOKED=' || count(*) FROM v_public_build_adaptations;
      ROLLBACK;
    `);
    expectDockerSuccess(result, 'withdraw public adaptation projections in rollback transaction');
    expect(result.output).toContain('PUBLIC=1');
    for (const label of ['PENDING', 'WITHDRAWN', 'REVOKED']) {
      expect(result.output, label).toContain(`${label}=0`);
    }
  });

  it('denies api_ro access to the adaptation base tables and writes', () => {
    for (const table of [
      'build_adaptations',
      'source_rights_evidence',
      'permission_requests',
      'takedown_events',
      'source_change_events',
    ]) {
      const read = psql(`SELECT * FROM ${table} LIMIT 1`, { user: 'api_ro', tcp: true });
      expect(read.status, table).not.toBe(0);
      expect(read.output, table).toContain('42501');
    }
    const write = psql(
      `INSERT INTO source_rights_evidence (
        source_id, evidence_type, evidence_ref, covers_adaptation, covers_translation,
        scope_notes, granted_by, recorded_on, status, verified_by, verified_on
      ) VALUES ('${SOURCE_ID}', 'permiso_escrito', 'PRIVATE-EVIDENCE-CANARY', true, false,
        'Intento denegado', 'Titular sintético', CURRENT_DATE, 'vigente', 'Revisor', CURRENT_DATE)`,
      { user: 'api_ro', tcp: true },
    );
    expect(write.status).not.toBe(0);
    expect(write.output).toContain('42501');
  });
});
