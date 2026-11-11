import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { loadSecrets } from '../config.js';
import * as schema from './schema.js';
import { compareMigrations, migrationFingerprint, readExpectedHashes } from './migration-state.js';
import { prepareSeed, readSeedFixtures, type SeedData } from './seed.mjs';
import { writeContentRows, type SeedClient } from './write-content.mjs';

export class BootstrapError extends Error {
  constructor(
    readonly code:
      | 'invalid-content'
      | 'role'
      | 'already'
      | 'not-empty'
      | 'migration'
      | 'credentials'
      | 'database-failed',
  ) {
    super(`bootstrap: ${code}`);
    this.name = 'BootstrapError';
  }
}
export function contentTableNames(): string[] {
  return Object.values(schema)
    .flatMap((value) => (is(value, PgTable) ? [getTableName(value)] : []))
    .filter((name) => name !== 'content_origin')
    .sort();
}
const quote = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new BootstrapError('database-failed');
  return `"${name}"`;
};
export function bootstrapPayloadHash(data: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(data)))
    .digest('hex');
}

/** Initial load only. Never adopts, resets or overwrites an editorial database. */
export async function bootstrapData(
  client: SeedClient,
  input: SeedData,
): Promise<{ builds: number; tierLists: number }> {
  let data: SeedData;
  try {
    data = prepareSeed(input);
    if (!data.builds.length && !data.tierLists.length) throw new Error();
  } catch {
    throw new BootstrapError('invalid-content');
  }
  const payloadHash = bootstrapPayloadHash(data);
  const expected = readExpectedHashes();
  const migration = migrationFingerprint(expected);
  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    const role = (
      await client.query(`SELECT current_user AS role,
      (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls) AS privileged
      FROM pg_roles WHERE rolname=current_user`)
    ).rows[0];
    if (role?.['role'] !== 'importer' || role['privileged'] !== false)
      throw new BootstrapError('role');
    await client.query('LOCK TABLE content_origin IN SHARE ROW EXCLUSIVE MODE');
    const marker = (
      await client.query('SELECT EXISTS (SELECT 1 FROM content_origin) AS bootstrapped')
    ).rows[0];
    if (marker?.['bootstrapped'] !== false) throw new BootstrapError('already');
    const tables = contentTableNames();
    if (!tables.length) throw new BootstrapError('database-failed');
    await client.query(`LOCK TABLE ${tables.map(quote).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    const occupied = (
      await client.query(
        `SELECT EXISTS (${tables.map((table) => `SELECT 1 FROM ${quote(table)}`).join(' UNION ALL ')} LIMIT 1) AS occupied`,
      )
    ).rows[0];
    if (occupied?.['occupied'] !== false) throw new BootstrapError('not-empty');
    const applied = await client.query(
      'SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at ASC',
    );
    if (
      !compareMigrations(
        expected,
        applied.rows.map((row) => String(row['hash'])),
      ).ready
    )
      throw new BootstrapError('migration');
    await writeContentRows(client, data);
    for (const table of ['authors', 'sources', 'builds', 'tier_lists', 'tier_entries'])
      await client.query(`UPDATE ${quote(table)} SET origin='bootstrap'`);
    await client.query(
      'INSERT INTO content_origin (bootstrapped_at,payload_hash,migration_version) VALUES (CURRENT_TIMESTAMP,$1,$2)',
      [payloadHash, migration],
    );
    await client.query('COMMIT');
    return { builds: data.builds.length, tierLists: data.tierLists.length };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof BootstrapError) throw error;
    throw new BootstrapError('database-failed');
  }
}

const Config = z.object({
  DB_HOST: z
    .string()
    .regex(/^[A-Za-z0-9.:-]{1,253}$/)
    .default('db'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  POSTGRES_DB: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/)
    .default('gd_dev'),
  DB_USER_IMPORTER: z.literal('importer').default('importer'),
});
interface BootstrapDependencies {
  read(): Promise<SeedData>;
  createClient(config: pg.ClientConfig): pg.Client;
  write: { out(line: string): void; err(line: string): void };
}
export async function runBootstrap(
  env: Readonly<Record<string, string | undefined>>,
  overrides: Partial<BootstrapDependencies> = {},
): Promise<number> {
  const write = overrides.write ?? { out: console.log, err: console.error };
  if (!['development', 'test'].includes(env['APP_ENV'] ?? '')) {
    write.err('bootstrap failed: environment');
    return 1;
  }
  let client: pg.Client | undefined;
  try {
    const config = Config.safeParse(env);
    if (!config.success) throw new BootstrapError('credentials');
    let data: SeedData;
    try {
      data = prepareSeed(await (overrides.read ?? readSeedFixtures)());
    } catch {
      throw new BootstrapError('invalid-content');
    }
    if (!data.builds.length && !data.tierLists.length) throw new BootstrapError('invalid-content');
    if (!env['DB_PASSWORD_IMPORTER_FILE'] || env['DB_PASSWORD_IMPORTER'])
      throw new BootstrapError('credentials');
    const password = loadSecrets(
      [
        {
          key: 'importerPassword',
          env: 'DB_PASSWORD_IMPORTER',
          secretName: 'db_password_importer',
          required: true,
        },
      ],
      env,
    )['importerPassword'];
    if (!password) throw new BootstrapError('credentials');
    client = (overrides.createClient ?? ((configuration) => new pg.Client(configuration)))({
      host: config.data.DB_HOST,
      port: config.data.DB_PORT,
      database: config.data.POSTGRES_DB,
      user: 'importer',
      password: password.reveal(),
      application_name: 'gd-bootstrap',
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
    });
    await client.connect();
    const result = await bootstrapData(client, data);
    write.out(`bootstrap complete: ${result.builds} builds, ${result.tierLists} tier lists`);
    return 0;
  } catch (error) {
    write.err(
      `bootstrap failed: ${error instanceof BootstrapError ? error.code : 'database-failed'}`,
    );
    return 1;
  } finally {
    await client?.end().catch(() => undefined);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) {
    console.error('bootstrap failed: arguments');
    process.exitCode = 1;
  } else process.exitCode = await runBootstrap(process.env);
}
