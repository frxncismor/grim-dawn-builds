import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import {
  PublicSourceSchema,
  type Author,
  type BuildInput,
  type Mastery,
  type Source,
} from '@gd/domain';
import type { ContractCollections } from '@gd/domain/testing';
import { prepareSeed, seedData } from '../src/db/seed.mjs';

/** Shared test seed normalization; production validation stays unchanged. */
export function prepareContractContent(
  docs: readonly BuildInput[],
  collections?: ContractCollections,
) {
  // The storage has one resource per slug. Preserve all private canaries while
  // normalizing repeated nested references; public attributes must be identical.
  const authors = new Map<string, Author>(
    (collections?.authors ?? []).map((author) => [author.slug, structuredClone(author)]),
  );
  const sources = new Map<string, Source>();
  const sourcePublic = (source: Source) =>
    Object.fromEntries(
      Object.keys(PublicSourceSchema.shape).map((key) => [
        key,
        (source as unknown as Record<string, unknown>)[key],
      ]),
    );
  for (const doc of docs) authors.set(doc.author.slug, structuredClone(doc.author));
  for (const source of [
    ...docs.flatMap((doc) => doc.sources),
    ...(collections?.tierLists.flatMap((list) => list.sources) ?? []),
  ]) {
    const previous = sources.get(source.slug);
    if (previous) assert.deepEqual(sourcePublic(previous), sourcePublic(source));
    sources.set(source.slug, {
      ...source,
      permission_ref: source.permission_ref ?? previous?.permission_ref ?? null,
      notes: [...new Set([previous?.notes ?? '', source.notes].filter(Boolean))].join('\n'),
    });
  }
  const masteries = new Map<string, Mastery>(
    (collections?.tierLists.flatMap((list) => list.masteries) ?? []).map((mastery) => [
      mastery.slug,
      mastery,
    ]),
  );
  for (const doc of docs)
    for (const mastery of doc.masteries) {
      if (!masteries.has(mastery.slug))
        masteries.set(mastery.slug, {
          slug: mastery.slug,
          name_es: mastery.name_es,
          name_en: mastery.name_en,
          accent_token: 'storm',
          fallback_icon: 'mastery-generic',
          asset_slug: null,
        });
    }
  const normalized: BuildInput[] = docs.map((doc) => ({
    ...structuredClone(doc),
    sources: doc.source_slugs.map((slug) => sources.get(slug)!),
  }));
  return prepareSeed({
    builds: normalized,
    authors: [...authors.values()],
    sources: [...sources.values()],
    masteries: [...masteries.values()],
    tierLists: collections?.tierLists ?? [],
    assets: [],
  });
}

/** Test-owned Docker resources only. Never uses the project's persistent volume. */
export class ContainerContentFixture {
  private readonly root = join(import.meta.dirname, '../../..');
  private readonly prefix = `gd-adapter-${process.pid}-${randomBytes(4).toString('hex')}`;
  private readonly tempBase = realpathSync(tmpdir());
  private work: string | undefined;
  private admin: pg.Client | undefined;
  private port = 0;
  private serial = 0;
  private database: string | undefined;
  private api: string | undefined;
  private networkCreated = false;
  private postgresCreated = false;
  private readonly apiImage = process.env['ADAPTER_API_IMAGE'] ?? 'gd-api:local';

  private docker(args: string[], tolerateFailure = false): string {
    const result = spawnSync('docker', args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    });
    if (result.status !== 0 && !tolerateFailure)
      throw new Error('Adapter Docker fixture command failed');
    return result.stdout?.trim() ?? '';
  }

  async start(): Promise<void> {
    const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
      readFileSync(join(this.root, 'infra/docker/compose.yaml'), 'utf8'),
    )?.[1];
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    this.docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    this.docker(['image', 'inspect', this.apiImage, '--format', '{{.Id}}']);
    this.work = mkdtempSync(join(this.tempBase, 'gd-api-adapter-'));
    writeFileSync(join(this.work, 'api-ro.txt'), randomBytes(24).toString('base64url'), {
      mode: 0o600,
    });
    this.docker(['network', 'create', this.prefix]);
    this.networkCreated = true;
    this.docker([
      'run',
      '--detach',
      '--rm',
      '--pull',
      'never',
      '--name',
      `${this.prefix}-db`,
      '--network',
      this.prefix,
      '--network-alias',
      'db',
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
      'POSTGRES_DB=gd_adapter_template',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '--publish',
      '127.0.0.1::5432',
      image,
    ]);
    this.postgresCreated = true;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const probe = spawnSync(
        'docker',
        [
          'exec',
          `${this.prefix}-db`,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
          '-d',
          'gd_adapter_template',
        ],
        { windowsHide: true, stdio: 'ignore', timeout: 10000 },
      );
      if (probe.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error('Adapter PostgreSQL fixture not ready');
    this.port = Number(
      this.docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        `${this.prefix}-db`,
      ]),
    );
    const template = new pg.Client({
      host: '127.0.0.1',
      port: this.port,
      user: 'postgres',
      database: 'gd_adapter_template',
    });
    await template.connect();
    try {
      // Trust is confined to this disposable test network; no production credentials.
      await template.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor NOLOGIN; CREATE ROLE api_ro LOGIN;
        GRANT CREATE ON DATABASE gd_adapter_template TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
      await migrate(drizzle(template), { migrationsFolder: join(this.root, 'apps/api/drizzle') });
      await template.query(
        'GRANT USAGE ON SCHEMA drizzle TO api_ro; GRANT SELECT ON drizzle.__drizzle_migrations TO api_ro',
      );
    } finally {
      await template.end();
    }
    this.admin = new pg.Client({
      host: '127.0.0.1',
      port: this.port,
      user: 'postgres',
      database: 'postgres',
    });
    await this.admin.connect();
  }

  async create(docs: readonly BuildInput[], collections?: ContractCollections): Promise<string> {
    await this.reset();
    this.database = `gd_adapter_${++this.serial}`;
    await this.admin!.query(`CREATE DATABASE ${this.database} TEMPLATE gd_adapter_template`);
    const writer = new pg.Client({
      host: '127.0.0.1',
      port: this.port,
      user: 'importer',
      database: this.database,
    });
    await writer.connect();
    try {
      await seedData(writer, prepareContractContent(docs, collections));
    } finally {
      await writer.end();
    }
    this.api = `${this.prefix}-api`;
    this.docker([
      'run',
      '--detach',
      '--rm',
      '--pull',
      'never',
      '--name',
      this.api,
      '--network',
      this.prefix,
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
      '--memory',
      '256m',
      '--memory-swap',
      '256m',
      '--cpus',
      '0.5',
      '--pids-limit',
      '100',
      '--env',
      'DB_HOST=db',
      '--env',
      'DB_PORT=5432',
      '--env',
      `POSTGRES_DB=${this.database}`,
      '--env',
      'DB_USER_API_RO=api_ro',
      '--env',
      'DB_PASSWORD_API_RO_FILE=/run/secrets/api-ro.txt',
      '--env',
      'LOG_LEVEL=silent',
      '--env',
      'API_RATE_LIMIT=10000',
      '--mount',
      `type=bind,source=${join(this.work!, 'api-ro.txt')},target=/run/secrets/api-ro.txt,readonly`,
      '--publish',
      '127.0.0.1::3000',
      this.apiImage,
    ]);
    const port = Number(
      this.docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}',
        this.api,
      ]),
    );
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.status === 200) return base;
      } catch {
        /* Startup connection can be refused; no raw network error leaves the fixture. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Adapter API fixture not ready');
  }

  async reset(): Promise<void> {
    if (this.api) {
      this.docker(['rm', '--force', this.api], true);
      this.api = undefined;
    }
    if (this.database && this.admin) {
      await this.admin.query(`DROP DATABASE ${this.database} WITH (FORCE)`);
      this.database = undefined;
    }
  }

  async close(): Promise<void> {
    try {
      await this.reset();
    } finally {
      await this.admin?.end();
      if (this.postgresCreated) this.docker(['rm', '--force', `${this.prefix}-db`], true);
      if (this.networkCreated) this.docker(['network', 'rm', this.prefix], true);
      if (this.work) {
        if (
          dirname(this.work) !== this.tempBase ||
          !basename(this.work).startsWith('gd-api-adapter-')
        )
          throw new Error('Unsafe adapter fixture cleanup path');
        rmSync(this.work, { recursive: true, force: true });
      }
    }
  }
}
