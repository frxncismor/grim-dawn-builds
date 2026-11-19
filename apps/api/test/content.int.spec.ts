import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BuildInput } from '@gd/domain';
import {
  contractDoc,
  runContentRepositoryContract,
  type ContractFactory,
  type ContentRepositoryPort,
} from '@gd/domain/testing';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabaseContentRepository } from '../src/content/repository.js';
import { checkDatabaseReadiness } from '../src/db/readiness.mjs';
import { readSeedFixtures, seedData } from '../src/db/seed.mjs';

import { prepareContractContent } from './content-fixture.js';

const root = join(import.meta.dirname, '../../..');
const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(root, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const enabled = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const suite = enabled ? describe : describe.skip;
const tempBase = realpathSync(tmpdir());
let work: string | undefined;
let container: string | undefined;
let admin: pg.Client | undefined;
let port: number;
let serial = 0;
let observedRequests = 0;
let observedMaxQueries = 0;
const resources: { database: string; app: ReturnType<typeof buildApp> }[] = [];
function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('Content PostgreSQL fixture command failed');
  return result.stdout.trim();
}

// T055: cases shell out to docker exec/psql or spawn the API against a real PostgreSQL; under CPU
// load they can exceed vitest's default 5 s testTimeout, so the suite carries its own timeout.
const SUITE_OPTIONS = { timeout: 30_000 };
suite('HTTP content contract on real PostgreSQL public views (T-060)', SUITE_OPTIONS, () => {
  const queries = vi.spyOn(pg.Client.prototype, 'query');
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-content-${process.pid}-${randomBytes(4).toString('hex')}`;
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      container,
      '--memory',
      '512m',
      '--memory-swap',
      '512m',
      '--cpus',
      '0.5',
      '--pids-limit',
      '100',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=256m',
      '--env',
      'POSTGRES_DB=gd_content_template',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '--publish',
      '127.0.0.1::5432',
      image,
    ]);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = spawnSync(
        'docker',
        [
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
          '-d',
          'gd_content_template',
        ],
        { windowsHide: true, timeout: 10000, stdio: 'ignore' },
      );
      if (result.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('Content PostgreSQL fixture did not start');
    port = Number(
      docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        container,
      ]),
    );
    const template = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: 'gd_content_template',
    });
    await template.connect();
    try {
      await template.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor NOLOGIN; CREATE ROLE api_ro LOGIN;
        GRANT CREATE ON DATABASE gd_content_template TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
      await migrate(drizzle(template), { migrationsFolder: join(root, 'apps/api/drizzle') });
      await template.query(
        'GRANT USAGE ON SCHEMA drizzle TO api_ro; GRANT SELECT ON drizzle.__drizzle_migrations TO api_ro',
      );
    } finally {
      await template.end();
    }
    admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    await admin.connect();
    work = mkdtempSync(join(tempBase, 'gd-content-int-'));
    writeFileSync(join(work, 'api-ro.txt'), randomBytes(24).toString('base64url'), { mode: 0o600 });
  }, 90000);
  afterEach(async () => {
    for (const { app, database } of resources.splice(0)) {
      await app.close();
      await admin!.query(`DROP DATABASE ${database} WITH (FORCE)`);
    }
  }, 30000);
  afterAll(async () => {
    writeFileSync(
      join(tempBase, 'gd-t060-query-budget.json'),
      JSON.stringify({
        container,
        requests: observedRequests,
        maxStatements: observedMaxQueries,
        measuredAt: new Date().toISOString(),
      }),
    );
    queries.mockRestore();
    await admin?.end().catch(() => undefined);
    if (container) docker(['rm', '--force', container]);
    if (work) {
      if (dirname(work) !== tempBase || !basename(work).startsWith('gd-content-int-'))
        throw new Error('Unsafe content fixture cleanup path');
      rmSync(work, { recursive: true, force: true });
    }
  });

  const factory: ContractFactory<ContentRepositoryPort> = async (docs, options, collections) => {
    if (options.includeDrafts) throw new Error('Public API never enables drafts');
    const database = `gd_content_${++serial}`;
    await admin!.query(`CREATE DATABASE ${database} TEMPLATE gd_content_template`);
    const env = {
      DB_HOST: '127.0.0.1',
      DB_PORT: String(port),
      POSTGRES_DB: database,
      DB_USER_API_RO: 'api_ro',
      DB_PASSWORD_API_RO_FILE: join(work!, 'api-ro.txt'),
    };
    const reader = createDatabaseContentRepository(env);
    const app = buildApp(loadConfig({ LOG_LEVEL: 'silent' }), {
      content: reader.repository,
      readiness: () => checkDatabaseReadiness(env),
    });
    app.addHook('onClose', reader.close);
    resources.push({ database, app });
    const data = prepareContractContent(docs, collections);
    const writer = new pg.Client({ host: '127.0.0.1', port, user: 'importer', database });
    await writer.connect();
    try {
      await seedData(writer, data);
    } finally {
      await writer.end();
    }
    const request = async <T>(path: string, nullable = false): Promise<T | null> => {
      const before = queries.mock.calls.length;
      const response = await app.inject({ method: 'GET', url: path });
      const count = queries.mock.calls.length - before;
      observedRequests += 1;
      observedMaxQueries = Math.max(observedMaxQueries, count);
      expect(count, 'real SQL statements per HTTP request').toBeGreaterThan(0);
      expect(count, 'real SQL statements per HTTP request').toBeLessThanOrEqual(6);
      if (nullable && response.statusCode === 404) return null;
      expect(response.statusCode, path).toBe(200);
      return response.json<T>();
    };
    return {
      listBuilds: async () =>
        (await request<Awaited<ReturnType<ContentRepositoryPort['listBuilds']>>>(
          '/api/v1/builds',
        ))!,
      findBuild: (slug) => request(`/api/v1/builds/${slug}`, true),
      listSlugs: async () => (await request<string[]>('/api/v1/slugs'))!,
      getAuthor: (slug) => request(`/api/v1/authors/${slug}`, true),
      getTierList: (slug) => request(`/api/v1/tier-lists/${slug}`, true),
    };
  };
  runContentRepositoryContract('PostgreSQL/api_ro over HTTP', factory, { localDrafts: false });

  it('serves the complete real catalog with its published own guide', async () => {
    const input = await readSeedFixtures(join(root, 'fixtures/content'));
    const repo = await factory(
      input.builds,
      { includeDrafts: false },
      { authors: input.authors, tierLists: input.tierLists },
    );
    const tier = await repo.getTierList('principal');
    expect(tier?.masteries).toEqual(input.tierLists[0]!.masteries);
    expect(tier?.combinations).toEqual(input.tierLists[0]!.combinations);
    expect(tier?.entries).toEqual(input.tierLists[0]!.entries);
    expect(tier?.entries).toHaveLength(46);
    const builds = await repo.listBuilds();
    expect(builds).toHaveLength(1);
    expect(builds[0]?.slug).toBe('chaman-demoledor-golpe-primigenio');
    expect((await repo.findBuild(input.builds[0]!.slug))?.slug).toBe(input.builds[0]!.slug);
    expect((await repo.getAuthor('grim-dawn-builds'))?.display_name).toBe('Grim Builds');
    expect(await repo.getAuthor('por-confirmar')).toBeNull();
    expect(JSON.stringify(tier)).not.toMatch(
      /permission_ref|rights_confirmed|is_placeholder|rights_notes|reviewed_by/,
    );
  });

  const EDITORIAL = [
    'intro',
    'stage',
    'changelog',
    'pros',
    'cons',
    'hotbar',
    'key_devotions',
  ] as const;

  it('spec009 T006: the seven editorial fields round-trip identically through seed, view and API', async () => {
    const input = await readSeedFixtures(join(root, 'fixtures/content'));
    const source = input.builds[0]!;
    expect(source.changelog.length).toBeGreaterThan(0);
    const repo = await factory(
      input.builds,
      { includeDrafts: false },
      { authors: input.authors, tierLists: input.tierLists },
    );
    const served = (await repo.findBuild(source.slug))!;
    for (const field of EDITORIAL) expect(served[field], field).toEqual(source[field]);
    const listed = (await repo.listBuilds()).find((build) => build.slug === source.slug)!;
    for (const field of EDITORIAL) expect(listed[field], field).toEqual(source[field]);
  });

  it('spec009 T006: the database rejects editorial values outside the data-model ranges', async () => {
    const document = contractDoc('editorial-ranges', {
      review_state: 'publicado',
      rights_status: 'own_original',
      rights_confirmed_by: 'Fixture',
      rights_confirmed_on: '2026-11-09',
      reviewed_by: 'Fixture',
      published_at: '2026-11-09',
    });
    await factory([document], { includeDrafts: false });
    const current = resources.at(-1)!;
    const writer = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: current.database,
    });
    await writer.connect();
    try {
      const rejected: [string, string, unknown][] = [
        ['builds_intro_ck', 'intro', 'a'.repeat(401)],
        ['builds_intro_ck', 'intro', ''],
        ['builds_stage_ck', 'stage', 'mitad'],
        ['builds_pros_ck', 'pros', ['a', 'b', 'c', 'd', 'e', 'f']],
        ['builds_pros_ck', 'pros', ['a'.repeat(121)]],
        ['builds_cons_ck', 'cons', ['']],
        ['builds_hotbar_ck', 'hotbar', Array.from({ length: 11 }, (_, i) => `n${i}`)],
        ['builds_hotbar_ck', 'hotbar', ['a', 'a']],
        ['builds_hotbar_ck', 'hotbar', ['No Slug']],
        ['builds_key_devotions_ck', 'key_devotions', Array.from({ length: 7 }, (_, i) => `c${i}`)],
        ['builds_changelog_ck', 'changelog', JSON.stringify({ date: '2026-11-10', text: 'x' })],
        ['builds_changelog_ck', 'changelog', JSON.stringify([{ date: '2026-11-10', text: '' }])],
        [
          'builds_changelog_ck',
          'changelog',
          JSON.stringify([{ date: '2026-11-10', text: 'a'.repeat(201) }]),
        ],
        [
          'builds_changelog_ck',
          'changelog',
          JSON.stringify([{ date: '10/11/2026', text: 'fecha mal formada' }]),
        ],
        [
          'builds_changelog_ck',
          'changelog',
          JSON.stringify([{ date: '2026-11-10', text: 'x', extra: 1 }]),
        ],
        [
          'builds_changelog_ck',
          'changelog',
          JSON.stringify([
            { date: '2026-11-10', text: 'repetida' },
            { date: '2026-11-10', text: 'repetida' },
          ]),
        ],
        [
          'builds_changelog_ck',
          'changelog',
          JSON.stringify([
            { date: '2026-11-10', text: 'ascendente' },
            { date: '2026-11-11', text: 'ascendente' },
          ]),
        ],
        [
          'builds_changelog_ck',
          'changelog',
          JSON.stringify([{ date: '2026-11-08', text: 'anterior a published_at' }]),
        ],
      ];
      for (const [constraint, column, value] of rejected) {
        await expect(
          writer.query(`UPDATE builds SET ${column}=$1 WHERE slug=$2`, [value, document.slug]),
          `${column} ${JSON.stringify(value).slice(0, 40)}`,
        ).rejects.toMatchObject({ constraint });
      }
      await writer.query(
        'UPDATE builds SET intro=$1, stage=$2, changelog=$3, pros=$4, cons=$5, hotbar=$6, key_devotions=$7 WHERE slug=$8',
        [
          'a'.repeat(400),
          'subida',
          JSON.stringify([
            { date: '2026-11-12', text: 'b'.repeat(200) },
            { date: '2026-11-09', text: 'límite: igual a published_at' },
          ]),
          ['a', 'b', 'c', 'd', 'e'],
          ['x'.repeat(120)],
          Array.from({ length: 10 }, (_, i) => `n${i}`),
          Array.from({ length: 6 }, (_, i) => `c${i}`),
          document.slug,
        ],
      );
    } finally {
      await writer.end();
    }
  });

  it('spec009 T006: 0015 applies over the previous database and gives existing rows neutral values', async () => {
    const migrations = join(root, 'apps/api/drizzle');
    const journal = JSON.parse(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8')) as {
      entries: { idx: number; tag: string }[];
    };
    const target = journal.entries.find((entry) => entry.tag.startsWith('0015_'))!;
    const previous = mkdtempSync(join(work!, 'previous-'));
    mkdirSync(join(previous, 'meta'));
    for (const entry of journal.entries.filter((e) => e.idx < target.idx))
      copyFileSync(join(migrations, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`));
    writeFileSync(
      join(previous, 'meta/_journal.json'),
      JSON.stringify({ ...journal, entries: journal.entries.filter((e) => e.idx < target.idx) }),
    );
    const database = `gd_content_prev_${++serial}`;
    await admin!.query(`CREATE DATABASE ${database}`);
    const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database });
    await client.connect();
    try {
      await client.query(`GRANT CREATE ON DATABASE ${database} TO migrator;
        GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
      await migrate(drizzle(client), { migrationsFolder: previous });
      await client.query('RESET ROLE');
      await client.query(`
        INSERT INTO authors (slug, display_name, is_placeholder, origin) VALUES ('autor-previo', 'Autor previo', false, 'fixture');
        INSERT INTO masteries (slug, name_es, name_en, accent_token, fallback_icon)
          VALUES ('chaman-previo', 'Chamán', 'Shaman', 'storm', 'x.svg');
        INSERT INTO builds (slug, title, title_a_mastery_id, eyebrow, subtitle, summary, damage_types,
          playstyle, content_tags, game_version, author_id, review_state, rights_status,
          rights_confirmed_by, rights_confirmed_on, reviewed_by, published_at, footer_disclaimer,
          hero_callout_title, hero_callout_body, origin)
        SELECT 'guia-previa', 'Guía previa', m.id, 'E', 'S', 'R', ARRAY['fisico']::damage_type[], 'melee',
          ARRAY['campana']::content_tag[], '1.2', a.id, 'borrador', 'own_original', 'F', CURRENT_DATE,
          'R', CURRENT_DATE, 'A', 'L', ARRAY['D'], 'fixture'
        FROM masteries m, authors a WHERE m.slug='chaman-previo' AND a.slug='autor-previo';
        INSERT INTO sources (slug, kind, title, author_name, license_note, retrieved_on, notes, origin)
        VALUES ('fuente-previa', 'original', 'Fuente previa', 'Autor previo', 'Prueba', CURRENT_DATE, '', 'fixture');
        INSERT INTO build_sources (build_id, source_id, role)
        SELECT b.id, s.id, 'principal' FROM builds b, sources s WHERE b.slug='guia-previa' AND s.slug='fuente-previa';
        UPDATE builds SET review_state='publicado' WHERE slug='guia-previa'`);
      await client.query('SET ROLE migrator');
      await migrate(drizzle(client), { migrationsFolder: migrations });
      await client.query('RESET ROLE');
      const row = await client.query(
        `SELECT intro, stage, changelog, pros, cons, hotbar, key_devotions FROM builds WHERE slug='guia-previa'`,
      );
      expect(row.rows[0]).toEqual({
        intro: null,
        stage: 'ambas',
        changelog: [],
        pros: [],
        cons: [],
        hotbar: [],
        key_devotions: [],
      });
      const view = await client.query(
        `SELECT document FROM v_public_build_documents WHERE slug='guia-previa'`,
      );
      const document = view.rows[0].document as Record<string, unknown>;
      expect(document['intro']).toBeNull();
      expect(document['stage']).toBe('ambas');
      for (const field of ['changelog', 'pros', 'cons', 'hotbar', 'key_devotions'])
        expect(document[field], field).toEqual([]);
    } finally {
      await client.end();
      await admin!.query(`DROP DATABASE ${database} WITH (FORCE)`);
    }
  });

  it('FR-16: serves approved asset descriptors and never pending art or private evidence', async () => {
    await factory([], { includeDrafts: false });
    const current = resources.at(-1)!;
    const writer = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'importer',
      database: current.database,
    });
    await writer.connect();
    try {
      await writer.query(
        `INSERT INTO assets
          (slug, file_path, origin_url, rights_holder, license_or_permission, proof_ref, recorded_on, status, fallback_svg)
         VALUES
          ('rayo-aprobado', 'public/assets/official/rayo.svg', 'https://example.test/fixture',
           'Fixture propio', 'Solo prueba', 'PRIVATE-EVIDENCE-PROOF', '2026-11-09', 'approved',
           'src/assets/icons/damage-rayo.svg'),
          ('rayo-pendiente', NULL, NULL, NULL, NULL, NULL, '2026-11-09', 'pending',
           'src/assets/icons/damage-rayo.svg'),
          ('rayo-rechazado', NULL, NULL, NULL, NULL, NULL, '2026-11-09', 'rejected',
           'src/assets/icons/damage-rayo.svg')`,
      );
      const response = await current.app.inject('/api/v1/assets');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        {
          slug: 'rayo-aprobado',
          file_path: 'public/assets/official/rayo.svg',
          fallback_svg: 'src/assets/icons/damage-rayo.svg',
        },
      ]);
      expect(response.body).not.toMatch(
        /PRIVATE-EVIDENCE|origin_url|rights_holder|license_or_permission|proof_ref|rayo-pendiente|rayo-rechazado/,
      );
    } finally {
      await writer.end();
    }
  });

  it('withdraws content immediately and refuses reads after migration drift without breaking health', async () => {
    const document = contractDoc('withdrawal-guide', {
      review_state: 'publicado',
      rights_status: 'own_original',
      rights_confirmed_by: 'Fixture',
      rights_confirmed_on: '2026-11-09',
      reviewed_by: 'Fixture',
      published_at: '2026-11-09',
    });
    const repo = await factory([document], { includeDrafts: false });
    expect(await repo.findBuild(document.slug)).not.toBeNull();
    const current = resources.at(-1)!;
    const writer = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: current.database,
    });
    await writer.connect();
    try {
      await writer.query("UPDATE builds SET rights_status='link_only' WHERE slug=$1", [
        document.slug,
      ]);
      expect(await repo.findBuild(document.slug)).toBeNull();
      expect(await repo.listSlugs()).toEqual([]);
      expect(await repo.getAuthor(document.author_slug)).toBeNull();
      await writer.query(
        "UPDATE builds SET review_state='borrador', rights_status='pending' WHERE slug=$1",
        [document.slug],
      );
      expect(await repo.findBuild(document.slug)).toBeNull();
      await writer.query(
        'DELETE FROM drizzle.__drizzle_migrations WHERE id=(SELECT max(id) FROM drizzle.__drizzle_migrations)',
      );
      const response = await current.app.inject('/api/v1/builds');
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: 'content_unavailable' });
      expect((await current.app.inject('/health')).statusCode).toBe(200);
    } finally {
      await writer.end();
    }
  });

  it('keeps base tables unreadable and unwritable to the API role', async () => {
    const connection = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'api_ro',
      database: 'gd_content_template',
    });
    await connection.connect();
    try {
      await expect(connection.query('SELECT * FROM builds')).rejects.toMatchObject({
        code: '42501',
      });
      await expect(
        connection.query(
          "INSERT INTO authors (slug, display_name, origin) VALUES ('denied', 'Denied', 'fixture')",
        ),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await connection.end();
    }
  });
});
