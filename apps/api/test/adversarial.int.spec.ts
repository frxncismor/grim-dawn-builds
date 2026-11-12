import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PublicBuildSchema, PublicTierListSchema } from '@gd/domain';
import { contractCollections, contractDocs } from '@gd/domain/testing';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabaseContentRepository } from '../src/content/repository.js';
import { checkDatabaseReadiness } from '../src/db/readiness.mjs';
import { seedData } from '../src/db/seed.mjs';
import { prepareContractContent } from './content-fixture.js';

/*
 * Adversarial HTTP cases (T-141, plan §17.49). Each attempt must fail closed:
 * hostile slugs/queries never reach the repository, error bodies stay constant
 * and free of traces, and public responses never expose private evidence. The
 * database part seeds one disposable PostgreSQL container; if it cannot start,
 * the pure suite still runs and the report says so.
 */

const root = join(import.meta.dirname, '../../..');
const enabled = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const config = () => loadConfig({ LOG_LEVEL: 'silent' });

const PRIVATE_CANARY = 'PRIVATE-ADVERSARIAL';
const TRACE = /\b(stack|select|insert|update|delete|drop)\b|node_modules|at .+:\d+:/i;

interface FakeRepositoryOptions {
  listBuilds?: () => Promise<unknown[]>;
  findBuild?: (slug: string) => Promise<unknown>;
  getTierList?: (slug: string) => Promise<unknown>;
  getAuthor?: (slug: string) => Promise<unknown>;
  listSlugs?: () => Promise<string[]>;
  listAssets?: () => Promise<unknown[]>;
}

function fakeRepository(options: FakeRepositoryOptions = {}) {
  return {
    listBuilds: options.listBuilds ?? (async () => []),
    findBuild: options.findBuild ?? (async () => null),
    getTierList: options.getTierList ?? (async () => null),
    getAuthor: options.getAuthor ?? (async () => null),
    listSlugs: options.listSlugs ?? (async () => []),
    listAssets: options.listAssets ?? (async () => []),
  };
}

function appWith(repositoryOverrides: FakeRepositoryOptions = {}, ready = true) {
  return buildApp(config(), {
    content: fakeRepository(repositoryOverrides),
    readiness: async () => ready,
  });
}

/** Every 4xx error body must be one of the constant, trace-free envelopes. */
function expectSafeError(response: {
  statusCode: number;
  body: string;
  headers: Record<string, unknown>;
}): void {
  expect(response.statusCode).toBeGreaterThanOrEqual(400);
  expect(response.statusCode).toBeLessThan(500);
  expect(response.headers['content-type']).toContain('application/json');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(TRACE.test(response.body), response.body).toBe(false);
  expect(response.body).not.toMatch(/PRIVATE-/);
}

describe('adversarial HTTP: slug and query injection without a database', () => {
  it.each([
    ['sql string', "' OR 1=1--"],
    ['sql stack', '1; DROP TABLE builds;--'],
    ['encoded traversal', '..%2F..%2Fetc%2Fpasswd'],
    ['nul byte', 'guia%00'],
    ['uppercase', 'Guia-Publica'],
    ['underscore', 'guia_publica'],
    // Properly encoded Cyrillic homoglyph: valid UTF-8, invalid slug pattern.
    ['homoglyph', '%D1%81haman'],
  ])('rejects the %s slug before readiness or data access', async (_label, slug) => {
    const findBuild = vi.fn();
    const readiness = vi.fn(async () => true);
    const app = buildApp(config(), {
      content: fakeRepository({ findBuild }),
      readiness,
    });
    try {
      const response = await app.inject({ method: 'GET', url: `/api/v1/builds/${slug}` });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'invalid_slug' });
      expectSafeError(response);
      expect(findBuild).not.toHaveBeenCalled();
      expect(readiness).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('ignores hostile query strings and returns the same catalog', async () => {
    const listBuilds = vi.fn(async () => []);
    const app = appWith({ listBuilds });
    try {
      const clean = await app.inject('/api/v1/builds');
      const hostile = await app.inject(
        "/api/v1/builds?slug='%20OR%201=1--&$where=1&limit=1e999&%00=1",
      );
      expect(clean.statusCode).toBe(200);
      expect(hostile.statusCode).toBe(200);
      expect(hostile.body).toBe(clean.body);
      expect(listBuilds).toHaveBeenCalledTimes(2);
      expect(listBuilds).toHaveBeenCalledWith();
    } finally {
      await app.close();
    }
  });

  it.each([
    ['an oversized slug', `/api/v1/builds/${'a'.repeat(10_000)}`],
    ['an oversized query string', `/api/v1/builds?q=${'a'.repeat(100_000)}`],
  ])('answers %s with a safe 4xx/2xx instead of a trace', async (_label, url) => {
    const app = appWith();
    try {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBeLessThan(500);
      expect(response.headers['content-type']).toContain('application/json');
      expect(TRACE.test(response.body), response.body).toBe(false);
      expect(response.body).not.toMatch(/PRIVATE-/);
      if (response.statusCode < 400) expect(Array.isArray(response.json())).toBe(true);
    } finally {
      await app.close();
    }
  });

  it.fails(
    'hallazgo: los errores del router (400 de URL mal formada y 414 de parámetro largo) deben llevar el sobre constante y las cabeceras de seguridad',
    async () => {
      const app = appWith();
      try {
        for (const url of [`/api/v1/builds/${'a'.repeat(10_000)}`, '/api/v1/builds/%C1%81']) {
          const response = await app.inject({ method: 'GET', url });
          expect(response.statusCode).toBeLessThan(500);
          expect(response.headers['x-content-type-options']).toBe('nosniff');
          expect(response.json()).not.toHaveProperty('code');
          expect(response.json()).not.toHaveProperty('message');
        }
      } finally {
        await app.close();
      }
    },
  );

  it('rejects unexpected request bodies, malformed lengths and foreign origins', async () => {
    const app = appWith();
    try {
      const body = await app.inject({
        method: 'GET',
        url: '/api/v1/builds',
        payload: { campo_inyectado: 'x' },
      });
      expect(body.json()).toEqual({ error: 'unexpected_body' });
      expectSafeError(body);

      const malformed = await app.inject({
        method: 'GET',
        url: '/api/v1/builds',
        headers: { 'content-length': 'abc' },
      });
      expect(malformed.json()).toEqual({ error: 'bad_request' });
      expectSafeError(malformed);

      const oversized = await app.inject({
        method: 'GET',
        url: '/api/v1/builds',
        headers: { 'content-length': '999999' },
      });
      expect(oversized.json()).toEqual({ error: 'payload_too_large' });
      expectSafeError(oversized);

      const origin = await app.inject({
        method: 'GET',
        url: '/api/v1/builds',
        headers: { origin: 'https://evil.example' },
      });
      expect(origin.json()).toEqual({ error: 'origin_forbidden' });
      expectSafeError(origin);
    } finally {
      await app.close();
    }
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'TRACE'] as const)(
    'does not expose %s on the public routes',
    async (method) => {
      const app = appWith();
      try {
        const response = await app.inject({ method, url: '/api/v1/builds' });
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: 'not_found' });
        expectSafeError(response);
      } finally {
        await app.close();
      }
    },
  );

  it('normalizes hostile paths to a constant 404 without redirecting or leaking', async () => {
    const app = appWith();
    try {
      for (const url of [
        '/api/v1/builds/guia/../admin',
        '/api/v1/builds/..',
        '/api/v1/builds/%2e%2e',
        '/api/v1/builds//',
        '/api/v1/../admin',
        '/api/v1/builds%2f..',
      ]) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode, url).toBeGreaterThanOrEqual(400);
        expect(response.statusCode, url).toBeLessThan(500);
        expectSafeError(response);
      }
    } finally {
      await app.close();
    }
  });
});

describe('adversarial HTTP: private fields leaked by the repository', () => {
  it.each([
    ['a nested source permission_ref', { sources: [{ permission_ref: PRIVATE_CANARY }] }],
    ['a private notes field', { notes: PRIVATE_CANARY }],
    ['a private author flag', { author: { is_placeholder: true } }],
  ])('fails closed with 503 when the repository returns %s', async (_label, patch) => {
    const doc = { slug: 'guia-publica' };
    const app = appWith({
      listBuilds: async () => [{ ...doc, ...patch }],
      findBuild: async () => ({ ...doc, ...patch }),
    });
    try {
      for (const url of ['/api/v1/builds', '/api/v1/builds/guia-publica']) {
        const response = await app.inject(url);
        expect(response.statusCode, url).toBe(503);
        expect(response.json()).toEqual({ error: 'content_unavailable' });
        expect(response.body).not.toMatch(/PRIVATE-/);
        expect(TRACE.test(response.body)).toBe(false);
      }
      expect((await app.inject('/health')).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

const suite = enabled ? describe : describe.skip;
const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(root, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const tempBase = realpathSync(tmpdir());
let work: string | undefined;
let container: string | undefined;
let admin: pg.Client | undefined;
let app: ReturnType<typeof buildApp> | undefined;
let closeRepository: (() => Promise<void>) | undefined;
let database: string | undefined;
let port = 0;

function docker(args: string[]): string {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  if (result.status !== 0) throw new Error('Adversarial PostgreSQL fixture command failed');
  return result.stdout.trim();
}

/** Counts rows through a superuser connection to prove the DROP injection did not run. */
async function countBuilds(): Promise<number> {
  const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database });
  await client.connect();
  try {
    const result = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM builds',
    );
    return Number(result.rows[0]?.count);
  } finally {
    await client.end();
  }
}

suite('adversarial HTTP on real PostgreSQL public views', () => {
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-adversarial-${process.pid}-${randomBytes(4).toString('hex')}`;
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
      'POSTGRES_DB=gd_adversarial_template',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '--publish',
      '127.0.0.1::5432',
      image,
    ]);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const probe = spawnSync(
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
          'gd_adversarial_template',
        ],
        { windowsHide: true, stdio: 'ignore', timeout: 10_000 },
      );
      if (probe.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('Adversarial PostgreSQL fixture did not start');
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
      database: 'gd_adversarial_template',
    });
    await template.connect();
    try {
      await template.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor NOLOGIN; CREATE ROLE api_ro LOGIN;
        GRANT CREATE ON DATABASE gd_adversarial_template TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
      await migrate(drizzle(template), { migrationsFolder: join(root, 'apps/api/drizzle') });
      await template.query(
        'GRANT USAGE ON SCHEMA drizzle TO api_ro; GRANT SELECT ON drizzle.__drizzle_migrations TO api_ro',
      );
    } finally {
      await template.end();
    }
    admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    await admin.connect();
    work = mkdtempSync(join(tempBase, 'gd-adversarial-int-'));
    writeFileSync(join(work, 'api-ro.txt'), randomBytes(24).toString('base64url'), { mode: 0o600 });
    database = `gd_adversarial_${process.pid}`;
    await admin.query(`CREATE DATABASE ${database} TEMPLATE gd_adversarial_template`);

    const docs = contractDocs();
    const published = docs.find((doc) => doc.slug === 'zeta-publicada')!;
    published.rights_notes = `${PRIVATE_CANARY}-RIGHTS-NOTES`;
    published.reviewed_by = `${PRIVATE_CANARY}-EDITOR`;
    published.reviewed_at = '2026-11-08';
    published.sources[0]!.permission_ref = `${PRIVATE_CANARY}-PROOF`;
    const collections = contractCollections();
    const writer = new pg.Client({ host: '127.0.0.1', port, user: 'importer', database });
    await writer.connect();
    try {
      await seedData(writer, prepareContractContent(docs, collections));
    } finally {
      await writer.end();
    }

    const env = {
      DB_HOST: '127.0.0.1',
      DB_PORT: String(port),
      POSTGRES_DB: database,
      DB_USER_API_RO: 'api_ro',
      DB_PASSWORD_API_RO_FILE: join(work, 'api-ro.txt'),
    };
    const reader = createDatabaseContentRepository(env);
    closeRepository = reader.close;
    app = buildApp(loadConfig({ LOG_LEVEL: 'silent' }), {
      content: reader.repository,
      readiness: () => checkDatabaseReadiness(env),
    });
  }, 90_000);

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    await closeRepository?.().catch(() => undefined);
    if (database && admin)
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (container) docker(['rm', '--force', container]);
    if (work) {
      if (dirname(work) !== tempBase || !basename(work).startsWith('gd-adversarial-int-'))
        throw new Error('Unsafe adversarial fixture cleanup path');
      rmSync(work, { recursive: true, force: true });
    }
  }, 30_000);

  it('serves public documents without private evidence or editorial notes', async () => {
    const build = await app!.inject('/api/v1/builds/zeta-publicada');
    expect(build.statusCode).toBe(200);
    expect(PublicBuildSchema.safeParse(build.json()).success).toBe(true);
    expect(build.body).not.toMatch(
      /PRIVATE-ADVERSARIAL|PRIVATE-TIER-PROOF|permission_ref|rights_notes|reviewed_by|is_placeholder|evidence_ref/,
    );
    expect(build.json()).not.toHaveProperty('author_slug', 'por-confirmar');

    const tier = await app!.inject('/api/v1/tier-lists/principal');
    expect(tier.statusCode).toBe(200);
    expect(PublicTierListSchema.safeParse(tier.json()).success).toBe(true);
    expect(tier.body).not.toMatch(/PRIVATE-TIER-PROOF|permission_ref|evidence_ref/);

    const author = await app!.inject('/api/v1/authors/autor-confirmado');
    expect(author.statusCode).toBe(200);
    expect(author.body).not.toMatch(/is_placeholder|PRIVATE-ADVERSARIAL/);
    expect((await app!.inject('/api/v1/authors/por-confirmar')).statusCode).toBe(404);

    const assets = await app!.inject('/api/v1/assets');
    expect(assets.statusCode).toBe(200);
    expect(assets.body).not.toMatch(/origin_url|rights_holder|license_or_permission|proof_ref/);
  });

  it('rejects injection attempts against the real views without damaging the database', async () => {
    for (const slug of ["'%20OR%201=1--", '1%3B%20DROP%20TABLE%20builds%3B--', '..%2F..%2Fetc']) {
      const response = await app!.inject({ method: 'GET', url: `/api/v1/builds/${slug}` });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'invalid_slug' });
      expectSafeError(response);
    }
    const injected = await app!.inject({
      method: 'GET',
      url: "/api/v1/builds/zeta-publicada?slug='%20OR%201=1--",
    });
    expect(injected.statusCode).toBe(200);
    expect(injected.body).not.toMatch(/PRIVATE-ADVERSARIAL|SELECT|postgres/);

    const survived = await countBuilds();
    expect(survived).toBeGreaterThan(0);
    expect((await app!.inject('/health')).statusCode).toBe(200);
    expect((await app!.inject('/api/v1/builds')).statusCode).toBe(200);
  });

  it('caps oversized payloads and unused write methods before touching the database', async () => {
    const oversized = await app!.inject({
      method: 'GET',
      url: '/api/v1/builds',
      payload: { relleno: 'a'.repeat(20_000) },
    });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: 'payload_too_large' });
    expectSafeError(oversized);

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const response = await app!.inject({
        method,
        url: '/api/v1/builds',
        payload: { slug: 'guia-insertada', reviewed_by: 'PRIVATE-ADVERSARIAL' },
      });
      expect(response.statusCode, method).toBe(404);
      expect(response.json()).toEqual({ error: 'not_found' });
      expectSafeError(response);
    }
    const survived = await countBuilds();
    expect(survived).toBeGreaterThan(0);
  });
});
