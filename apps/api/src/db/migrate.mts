import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { z } from 'zod';
import { formatConfigError, loadSecrets, RedactedSecret, type SecretConfig } from '../config.js';
import { ConfigError, type ConfigIssue } from '../config/errors.js';
import { compareMigrations, MIGRATIONS_FOLDER, readExpectedHashes } from './migration-state.js';
import type { MigrationComparison } from './migration-state.js';

/**
 * T-057: one-shot migrator, run by the compose `migrate` service with the `migrator` role. The API
 * never imports this module and never migrates by itself. Running it again applies nothing.
 *
 * Output: counts and codes only. No connection string, password or SQL is printed.
 */

/** Advisory lock key that serialises concurrent migrators (drizzle's pg migrator takes no lock). */
const MIGRATION_LOCK_KEY = '4828391057';

const SAFE_HOST = /^[A-Za-z0-9.-]{1,253}$/;
const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

const PortSchema = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

const MigrateEnvSchema = z.object({
  DB_HOST: z.string().regex(SAFE_HOST).default('db'),
  DB_PORT: PortSchema.default(5432),
  POSTGRES_DB: z.string().regex(SQL_IDENTIFIER).default('gd_dev'),
  DB_USER_MIGRATOR: z.string().regex(SQL_IDENTIFIER).default('migrator'),
});

/** Migrator password: `DB_PASSWORD_MIGRATOR_FILE`, then /run/secrets/db_password_migrator, then env. */
const MIGRATOR_PASSWORD = {
  key: 'migratorPassword',
  env: 'DB_PASSWORD_MIGRATOR',
  secretName: 'db_password_migrator',
  required: true,
} as const;

export interface MigrateConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: RedactedSecret;
}

/**
 * Validates the migrator settings and loads its password through SecretSource. Throws ConfigError
 * (field names and codes only) or the redacted ConfigError from loadSecrets.
 */
export function loadMigrateConfig(
  env: Readonly<Record<string, string | undefined>>,
  secrets: (env: Readonly<Record<string, string | undefined>>) => SecretConfig = (e) =>
    loadSecrets([MIGRATOR_PASSWORD], e),
): MigrateConfig {
  const parsed = MigrateEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue): ConfigIssue => ({
        field: issue.path.map(String).join('.') || '(root)',
        code: issue.code,
      })),
    );
  }
  const loaded = secrets(env);
  const password = loaded['migratorPassword'];
  if (!password) throw new ConfigError([{ field: MIGRATOR_PASSWORD.env, code: 'required' }]);
  return {
    host: parsed.data.DB_HOST,
    port: parsed.data.DB_PORT,
    database: parsed.data.POSTGRES_DB,
    user: parsed.data.DB_USER_MIGRATOR,
    password,
  };
}

/** Raised when the database does not match the migrations shipped with this image. */
export class MigrationMismatchError extends Error {
  readonly comparison: MigrationComparison;

  constructor(comparison: MigrationComparison) {
    super(
      `migration state is ${comparison.reason} (expected ${comparison.expected}, applied ${comparison.applied})`,
    );
    this.name = 'MigrationMismatchError';
    this.comparison = comparison;
  }
}

/** Injected operations, so the ordering and idempotency rules are testable without PostgreSQL. */
export interface MigrationOps {
  /** Hashes of the migrations shipped in the image, in journal order. */
  readonly expected: () => readonly string[];
  /** Applies pending migrations. Must be a no-op when nothing is pending. */
  readonly migrate: () => Promise<void>;
  /** Hashes recorded as applied, in application order. */
  readonly applied: () => Promise<readonly string[]>;
  /** Runs `work` while holding the migration lock. */
  readonly withLock: <T>(work: () => Promise<T>) => Promise<T>;
}

/**
 * Applies migrations under the lock, then checks that the database matches the expected state.
 * Second and later runs find nothing pending and return `match` without changing anything.
 */
export async function applyMigrations(ops: MigrationOps): Promise<MigrationComparison> {
  return ops.withLock(async () => {
    const expected = ops.expected();
    const before = compareMigrations(expected, await ops.applied());
    if (before.reason === 'mismatch') throw new MigrationMismatchError(before);

    await ops.migrate();
    const comparison = compareMigrations(expected, await ops.applied());
    if (!comparison.ready) throw new MigrationMismatchError(comparison);
    return comparison;
  });
}

/** Opens one connection as the migrator role. The password is passed as a field, never in a URL. */
function createClient(config: MigrateConfig): pg.Client {
  return new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password.reveal(),
    application_name: 'gd-api-migrate',
    connectionTimeoutMillis: 5_000,
  });
}

/** Real operations against PostgreSQL through one client (the migrator role). */
export function postgresOps(client: pg.Client, folder: string = MIGRATIONS_FOLDER): MigrationOps {
  return {
    expected: () => readExpectedHashes(folder),
    migrate: async () => {
      await migrate(drizzle(client), { migrationsFolder: folder });
      await client.query('GRANT USAGE ON SCHEMA "drizzle" TO "api_ro"');
      await client.query('GRANT SELECT ON "drizzle"."__drizzle_migrations" TO "api_ro"');
    },
    applied: async () => {
      try {
        const result = await client.query<{ hash: string }>(
          'SELECT hash FROM "drizzle"."__drizzle_migrations" ORDER BY created_at ASC',
        );
        return result.rows.map((row) => row.hash);
      } catch (error) {
        // A new database has no Drizzle journal yet; the migrator creates it on first run.
        if ((error as { code?: unknown } | undefined)?.code === '42P01') return [];
        throw error;
      }
    },
    withLock: async (work) => {
      await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_KEY]);
      try {
        return await work();
      } finally {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_KEY]);
      }
    },
  };
}

/** Short, value-free code for a failure: a SQLSTATE when present, else a fixed label. */
export function failureCode(error: unknown): string {
  if (error instanceof ConfigError) return 'config';
  if (error instanceof MigrationMismatchError) return 'migration_mismatch';
  const candidates = [error, (error as { cause?: unknown } | undefined)?.cause];
  for (const candidate of candidates) {
    const code = (candidate as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return 'unknown';
}

/** Runs the migrator for the given environment. Returns the process exit code. */
export async function runMigrator(
  env: Readonly<Record<string, string | undefined>>,
  write: { out: (line: string) => void; err: (line: string) => void } = {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  },
): Promise<number> {
  let config: MigrateConfig;
  try {
    config = loadMigrateConfig(env);
  } catch (error) {
    write.err(formatConfigError(error));
    return 1;
  }

  const client = createClient(config);
  try {
    await client.connect();
    const comparison = await applyMigrations(postgresOps(client));
    write.out(
      `migrations ${comparison.reason}: applied ${comparison.applied} of ${comparison.expected} expected`,
    );
    return 0;
  } catch (error) {
    write.err(`migration failed: ${failureCode(error)}`);
    return 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Entry point only when this file is executed directly (not when imported by tests). */
function isEntrypoint(): boolean {
  const script = process.argv[1];
  if (!script) return false;
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  process.exitCode = await runMigrator(process.env);
}
