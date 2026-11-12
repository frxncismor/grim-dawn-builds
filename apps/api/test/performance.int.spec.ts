import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { contractDoc } from '@gd/domain/testing';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabaseContentRepository } from '../src/content/repository.js';
import { checkDatabaseReadiness } from '../src/db/readiness.mjs';
import { migrationFingerprint } from '../src/db/migration-state.js';
import { readSeedFixtures, seedData } from '../src/db/seed.mjs';

import { prepareContractContent } from './content-fixture.js';

/**
 * Presupuestos del backend (plan §12.12, T-128).
 *
 * Se miden sobre la API real en `127.0.0.1` con PostgreSQL 17 aislado (imagen
 * fijada por digest en Compose) y el catálogo completo de `content/` sembrado,
 * más una build publicada sintética para medir la lectura de detalle (el
 * fixture real no tiene ninguna build publicada). La puerta que decide en CI es
 * `scripts/check-performance.mts --backend`: consume el informe JSON que este
 * archivo escribe y contrasta los mismos umbrales.
 *
 * Método de medida:
 * - 40 muestras por ruta después de 5 peticiones de calentamiento; p95 por rango
 *   más cercano (`ceil(0.95·n)−1`), función pura `percentile95`.
 * - Consultas por petición: contador real de `pg.Client.prototype.query` (el
 *   mismo método de T-060); incluye la comprobación de readiness por petición y
 *   la comprobación de rol del pool, no solo la consulta de contenido.
 * - Arranque en frío: proceso nuevo (`node --import tsx src/server.ts`) medido
 *   desde el `spawn` hasta el primer `/ready` 200.
 * - Memoria: `process.memoryUsage()` del proceso que aloja la API tras las
 *   pruebas, publicado frente al objetivo de 200 MB. Excederlo no se declara
 *   aprobado ni se relaja el presupuesto; la imagen no sustituye la medición.
 *
 * El informe se escribe en `dist/performance/backend.json` (ignorado por git) o
 * en `GD_PERFORMANCE_REPORT`. Falta de Docker, de la imagen fijada o de catálogo
 * siembrado falla cerrado: no se omite ninguna medición.
 */

const ROOT = join(import.meta.dirname, '../../..');
const COMPOSE_PATH = join(ROOT, 'infra/docker/compose.yaml');
const POSTGRES_IMAGE = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(COMPOSE_PATH, 'utf8'),
)?.[1];
const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const DATABASE = 'gd_performance_test';
const PUBLISHED_SLUG = 'rendimiento-publicado';
const TIER_LIST_SLUG = 'principal';
const SAMPLE_COUNT = 40;
const WARMUP_REQUESTS = 5;
const REPORT_PATH =
  process.env['GD_PERFORMANCE_REPORT'] ?? join(ROOT, 'dist/performance/backend.json');

const BUDGETS = {
  healthP95Ms: 50,
  readyP95Ms: 200,
  readsP95Ms: 150,
  maxQueriesPerRequest: 6,
  coldStartMs: 5000,
  runtimeTargetBytes: 200 * 1024 * 1024,
  minSamples: 30,
} as const;

type RouteGroup = 'health' | 'ready' | 'read';

interface RoutePlan {
  readonly group: RouteGroup;
  readonly route: string;
}

interface RouteResult {
  group: RouteGroup;
  route: string;
  samples: number;
  p95Ms: number;
  maxMs: number;
  sampleMs: number[];
  statuses: number[];
  maxQueriesPerRequest: number;
}

interface MemoryUsage {
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
}

const ROUTES: readonly RoutePlan[] = [
  { group: 'health', route: '/health' },
  { group: 'ready', route: '/ready' },
  { group: 'read', route: '/api/v1/builds' },
  { group: 'read', route: `/api/v1/builds/${PUBLISHED_SLUG}` },
  { group: 'read', route: `/api/v1/tier-lists/${TIER_LIST_SLUG}` },
];

/**
 * p95 por rango más cercano: ordena y toma el índice `ceil(0.95·n)−1`. No
 * interpola: con 40 muestras el valor es una medición real observada.
 */
export function percentile95(samples: readonly number[]): number {
  if (!samples.length) throw new Error('p95 necesita al menos una muestra');
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index]!;
}

it('percentil 95 por rango más cercano, sin interpolar', () => {
  expect(percentile95(Array.from({ length: 100 }, (_, index) => index + 1))).toBe(95);
  expect(percentile95([7, 1, 3])).toBe(7);
  expect(percentile95([4, 1, 3, 2])).toBe(4);
  expect(percentile95([2.5])).toBe(2.5);
  expect(() => percentile95([])).toThrow();
});

let container: string | undefined;
let databasePort = 0;
let work: string | undefined;
let admin: pg.Client | undefined;
let app: ReturnType<typeof buildApp> | undefined;
let reader: ReturnType<typeof createDatabaseContentRepository> | undefined;
let baseUrl = '';
let apiEnv: Record<string, string> = {};
let postgresVersion = '';
let catalog: Record<string, number> = {};
const routeResults: RouteResult[] = [];
let coldStartMs: number | null = null;
let memory: MemoryUsage | null = null;

const queries = vi.spyOn(pg.Client.prototype, 'query');

function docker(args: readonly string[], tolerateFailure = false): string {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Docker no está disponible: ${result.error.message}`);
  if (result.status !== 0 && !tolerateFailure) {
    const tail = `${result.stderr ?? ''}${result.stdout ?? ''}`
      .trim()
      .split(/\r?\n/)
      .slice(-2)
      .join(' ');
    throw new Error(`El fixture PostgreSQL 17 falló${tail ? `: ${tail}` : ''}`);
  }
  return result.stdout?.trim() ?? '';
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No hay puerto local disponible')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForReady(
  url: string,
  timeoutMs: number,
  child?: ChildProcess,
): Promise<{ ready: boolean; stderr: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) return { ready: false, stderr: '' };
    try {
      const response = await fetch(`${url}/ready`, { signal: AbortSignal.timeout(1000) });
      await response.text();
      if (response.status === 200) return { ready: true, stderr: '' };
    } catch {
      // Conexión rechazada mientras el proceso carga módulos: se reintenta.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return { ready: false, stderr: '' };
}

/** Arranque en frío real: proceso nuevo hasta el primer `/ready` 200. */
async function measureColdStart(): Promise<number> {
  const port = await freePort();
  const started = performance.now();
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...apiEnv,
      API_HOST: '127.0.0.1',
      API_PORT: String(port),
      LOG_LEVEL: 'silent',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer | string) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-2000);
  });
  try {
    const { ready } = await waitForReady(`http://127.0.0.1:${port}`, 20_000, child);
    const elapsed = performance.now() - started;
    if (!ready) {
      const detail = stderr.trim().split(/\r?\n/).slice(-2).join(' ');
      throw new Error(
        `el servidor no llegó a /ready 200 en 20 s${detail ? `: ${detail}` : ' (sin salida)'}`,
      );
    }
    return elapsed;
  } finally {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}

async function measureRoute(plan: RoutePlan): Promise<RouteResult> {
  for (let index = 0; index < WARMUP_REQUESTS; index += 1) {
    const warmup = await fetch(`${baseUrl}${plan.route}`, { signal: AbortSignal.timeout(5000) });
    await warmup.text();
  }
  const sampleMs: number[] = [];
  const statuses: number[] = [];
  let maxQueriesPerRequest = 0;
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const before = queries.mock.calls.length;
    const started = performance.now();
    const response = await fetch(`${baseUrl}${plan.route}`, {
      signal: AbortSignal.timeout(5000),
    });
    await response.text();
    sampleMs.push(performance.now() - started);
    statuses.push(response.status);
    maxQueriesPerRequest = Math.max(maxQueriesPerRequest, queries.mock.calls.length - before);
  }
  return {
    group: plan.group,
    route: plan.route,
    samples: SAMPLE_COUNT,
    p95Ms: percentile95(sampleMs),
    maxMs: Math.max(...sampleMs),
    sampleMs,
    statuses,
    maxQueriesPerRequest,
  };
}

function routeBudget(group: RouteGroup): number {
  if (group === 'health') return BUDGETS.healthP95Ms;
  if (group === 'ready') return BUDGETS.readyP95Ms;
  return BUDGETS.readsP95Ms;
}

function writeReport(): void {
  if (!coldStartMs || !memory || !routeResults.length) return;
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        kind: 'backend-performance',
        version: 1,
        measuredAt: new Date().toISOString(),
        method: {
          samples: SAMPLE_COUNT,
          warmupRequests: WARMUP_REQUESTS,
          percentile: 'nearest-rank ceil(0.95*n)-1',
          queries: 'contador de pg.Client.prototype.query por petición',
          coldStart: 'spawn de node --import tsx src/server.ts hasta el primer /ready 200',
          memory: 'process.memoryUsage() del proceso que aloja la API tras las pruebas',
        },
        environment: {
          node: process.version,
          platform: `${process.platform}-${process.arch}`,
          postgres: postgresVersion,
          image: POSTGRES_IMAGE ?? null,
          catalog,
          warmupRequests: WARMUP_REQUESTS,
        },
        budgets: BUDGETS,
        results: { coldStartMs, memory, routes: routeResults },
      },
      null,
      2,
    ),
  );
}

/** Tabla de muestra y entorno junto al informe; el detalle vive en el JSON. */
function printSummary(): void {
  if (!coldStartMs || !memory) return;
  const rows = routeResults.map((result) => {
    const limit = routeBudget(result.group);
    return `${result.route.padEnd(36)} ${String(result.samples).padEnd(8)} ${`${result.p95Ms.toFixed(1)} ms`.padEnd(10)} ${`${result.maxMs.toFixed(1)} ms`.padEnd(10)} ${String(result.maxQueriesPerRequest).padEnd(10)} p95 ≤ ${limit} ms`;
  });
  console.log(
    [
      '',
      'Backend T-128 · muestra y entorno',
      `  Node: ${process.version} (${process.platform}-${process.arch})`,
      `  PostgreSQL: ${postgresVersion.split(' on ')[0]}`,
      `  Imagen: ${POSTGRES_IMAGE ?? 'no declarada'}`,
      `  Catálogo sembrado: ${Object.entries(catalog)
        .map(([name, count]) => `${name}=${count}`)
        .join(', ')}`,
      `  Muestras por ruta: ${SAMPLE_COUNT} tras ${WARMUP_REQUESTS} de calentamiento; p95 por rango más cercano`,
      '  Ruta                                  Muestras  p95        Máximo     Consultas  Límite',
      ...rows.map((row) => `  ${row}`),
      `  Arranque en frío: ${coldStartMs.toFixed(0)} ms (≤ ${BUDGETS.coldStartMs} ms)`,
      `  Memoria: RSS ${(memory.rssBytes / (1024 * 1024)).toFixed(1)} MB, heap ${(memory.heapUsedBytes / (1024 * 1024)).toFixed(1)} MB (objetivo ≤ ${BUDGETS.runtimeTargetBytes / (1024 * 1024)} MB)`,
      '',
    ].join('\n'),
  );
}

const suite = RUN_DB_TESTS ? describe : describe.skip;

suite('presupuestos backend medibles sobre PostgreSQL 17 real (T-128)', () => {
  beforeAll(async () => {
    if (!POSTGRES_IMAGE || !/@sha256:[a-f0-9]{64}$/.test(POSTGRES_IMAGE))
      throw new Error('Compose debe fijar la imagen de PostgreSQL 17 por digest');
    docker(['image', 'inspect', POSTGRES_IMAGE, '--format', '{{.Id}}']);

    container = `gd-performance-${process.pid}-${randomBytes(4).toString('hex')}`;
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
      `POSTGRES_DB=${DATABASE}`,
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '--publish',
      '127.0.0.1::5432',
      POSTGRES_IMAGE,
    ]);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const probe = spawnSync(
        'docker',
        ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', DATABASE],
        { windowsHide: true, stdio: 'ignore', timeout: 10_000 },
      );
      if (probe.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('El PostgreSQL 17 aislado no arrancó');
    databasePort = Number(
      docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        container,
      ]),
    );

    const template = new pg.Client({
      host: '127.0.0.1',
      port: databasePort,
      user: 'postgres',
      database: DATABASE,
    });
    await template.connect();
    try {
      await template.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN;
        CREATE ROLE editor NOLOGIN; CREATE ROLE api_ro LOGIN;
        GRANT CREATE ON DATABASE ${DATABASE} TO migrator;
        GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
      await migrate(drizzle(template), { migrationsFolder: join(ROOT, 'apps/api/drizzle') });
      await template.query(
        'GRANT USAGE ON SCHEMA drizzle TO api_ro; GRANT SELECT ON drizzle.__drizzle_migrations TO api_ro',
      );
    } finally {
      await template.end();
    }

    const fixtures = await readSeedFixtures(join(ROOT, 'content'));
    const published = contractDoc(PUBLISHED_SLUG, {
      review_state: 'publicado',
      rights_status: 'licensed',
      rights_confirmed_by: 'Fixture de rendimiento',
      rights_confirmed_on: '2026-11-11',
      reviewed_by: 'Revisor de rendimiento',
      reviewed_at: '2026-11-11',
      published_at: '2026-11-11',
      content_status: 'verificado',
    });
    const data = prepareContractContent([...fixtures.builds, published], {
      authors: fixtures.authors,
      tierLists: fixtures.tierLists,
    });
    const writer = new pg.Client({
      host: '127.0.0.1',
      port: databasePort,
      user: 'importer',
      database: DATABASE,
    });
    await writer.connect();
    try {
      await seedData(writer, data);
    } finally {
      await writer.end();
    }

    admin = new pg.Client({
      host: '127.0.0.1',
      port: databasePort,
      user: 'postgres',
      database: DATABASE,
    });
    await admin.connect();
    postgresVersion = (await admin.query<{ version: string }>('SELECT version() AS version'))
      .rows[0]!.version;
    const counts = (
      await admin.query<Record<string, string>>(`SELECT
        (SELECT count(*) FROM builds) AS builds,
        (SELECT count(*) FROM authors) AS authors,
        (SELECT count(*) FROM sources) AS sources,
        (SELECT count(*) FROM masteries) AS masteries,
        (SELECT count(*) FROM mastery_combinations) AS combinations,
        (SELECT count(*) FROM tier_lists) AS tier_lists,
        (SELECT count(*) FROM tier_entries) AS tier_entries`)
    ).rows[0]!;
    catalog = Object.fromEntries(
      Object.entries(counts).map(([name, count]) => [name, Number(count)]),
    );
    const expectedEntries = fixtures.tierLists.reduce(
      (total, list) => total + list.entries.length,
      0,
    );
    if (
      catalog['builds'] !== fixtures.builds.length + 1 ||
      catalog['tier_lists'] !== fixtures.tierLists.length ||
      catalog['tier_entries'] !== expectedEntries ||
      (catalog['masteries'] ?? 0) < 1
    )
      throw new Error(
        `El catálogo sembrado no está completo (builds=${catalog['builds']}, tier_lists=${catalog['tier_lists']}, tier_entries=${catalog['tier_entries']}); no se mide sobre una base vacía`,
      );

    work = mkdtempSync(join(realpathSync(tmpdir()), 'gd-performance-int-'));
    writeFileSync(join(work, 'api-ro.txt'), randomBytes(24).toString('base64url'), {
      mode: 0o600,
    });
    apiEnv = {
      DB_HOST: '127.0.0.1',
      DB_PORT: String(databasePort),
      POSTGRES_DB: DATABASE,
      DB_USER_API_RO: 'api_ro',
      DB_PASSWORD_API_RO_FILE: join(work, 'api-ro.txt'),
    };
    reader = createDatabaseContentRepository(apiEnv);
    app = buildApp(loadConfig({ LOG_LEVEL: 'silent', API_RATE_LIMIT: '10000' }), {
      readiness: () => checkDatabaseReadiness(apiEnv),
      migration: migrationFingerprint,
      content: reader.repository,
    });
    app.addHook('onClose', reader.close);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string')
      throw new Error('La API no expuso un puerto TCP local');
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 180_000);

  afterAll(async () => {
    writeReport();
    queries.mockRestore();
    await app?.close().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    if (container) docker(['rm', '--force', container], true);
    if (work) {
      if (
        dirname(work) !== realpathSync(tmpdir()) ||
        !basename(work).startsWith('gd-performance-int-')
      )
        throw new Error('Ruta de limpieza del fixture de rendimiento no segura');
      rmSync(work, { recursive: true, force: true });
    }
  }, 60_000);

  it('mide sobre PostgreSQL 17 aislado con el catálogo completo sembrado', () => {
    expect(postgresVersion).toMatch(/^PostgreSQL 17\./);
    expect(catalog['tier_lists']).toBeGreaterThanOrEqual(1);
    expect(catalog['tier_entries']).toBeGreaterThanOrEqual(1);
    expect(catalog['masteries']).toBeGreaterThanOrEqual(1);
    expect(catalog['builds']).toBeGreaterThanOrEqual(2);
  });

  it('arranca en frío hasta el primer /ready 200 dentro de 5 s', async () => {
    coldStartMs = await measureColdStart();
    expect(coldStartMs).toBeLessThanOrEqual(BUDGETS.coldStartMs);
  }, 60_000);

  it('cumple p95 por ruta y ≤ 6 consultas SQL por petición', async () => {
    for (const plan of ROUTES) routeResults.push(await measureRoute(plan));
    expect(routeResults).toHaveLength(ROUTES.length);

    for (const result of routeResults) {
      expect(new Set(result.statuses), `${result.route} solo responde 200`).toEqual(new Set([200]));
      expect(result.samples, `${result.route} muestras`).toBe(SAMPLE_COUNT);
      expect(result.samples, `${result.route} muestras mínimas`).toBeGreaterThanOrEqual(
        BUDGETS.minSamples,
      );
      expect(result.p95Ms, `${result.route} p95`).toBeLessThanOrEqual(routeBudget(result.group));
      expect(
        result.maxQueriesPerRequest,
        `${result.route} consultas por petición`,
      ).toBeLessThanOrEqual(BUDGETS.maxQueriesPerRequest);
      if (result.group !== 'health')
        expect(
          result.maxQueriesPerRequest,
          `${result.route} no llegó a la base de datos`,
        ).toBeGreaterThan(0);
    }
  }, 180_000);

  it('registra la memoria en runtime frente al objetivo de 200 MB', () => {
    const usage = process.memoryUsage();
    memory = {
      rssBytes: usage.rss,
      heapUsedBytes: usage.heapUsed,
      heapTotalBytes: usage.heapTotal,
    };
    expect(Number.isFinite(memory.rssBytes)).toBe(true);
    expect(Number.isFinite(memory.heapUsedBytes)).toBe(true);
    expect(memory.heapUsedBytes).toBeLessThanOrEqual(memory.heapTotalBytes);
    // La memoria se publica frente al objetivo; superarlo no se declara aprobado
    // ni se relaja el presupuesto, y la imagen nunca sustituye esta medición.
  }, 15_000);

  it('escribe el informe JSON que consume la puerta del CI', () => {
    writeReport();
    printSummary();
    expect(coldStartMs).not.toBeNull();
    expect(routeResults.map((result) => result.route)).toEqual(ROUTES.map((plan) => plan.route));
    const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as {
      kind: string;
      budgets: Record<string, number>;
      results: { routes: { route: string }[] };
    };
    expect(report.kind).toBe('backend-performance');
    expect(report.budgets).toEqual(BUDGETS);
    expect(report.results.routes).toHaveLength(ROUTES.length);
  }, 15_000);
});
