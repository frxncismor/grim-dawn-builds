import pg from 'pg';
import { z } from 'zod';
import { loadSecrets, type SecretConfig } from '../config.js';
import { RedactedSecret } from '../config/secret-source.js';
import { ConfigError, type ConfigIssue } from '../config/errors.js';
import { compareMigrations, readExpectedHashes } from './migration-state.js';

const SAFE_HOST = /^[A-Za-z0-9.-]{1,253}$/;
const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const PortSchema = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

const ReadinessEnvSchema = z.object({
  DB_HOST: z.string().regex(SAFE_HOST).default('db'),
  DB_PORT: PortSchema.default(5432),
  POSTGRES_DB: z.string().regex(SQL_IDENTIFIER).default('gd_dev'),
  DB_USER_API_RO: z.string().regex(SQL_IDENTIFIER).default('api_ro'),
});

const API_RO_PASSWORD = {
  key: 'apiRoPassword',
  env: 'DB_PASSWORD_API_RO',
  secretName: 'db_password_api_ro',
  required: false,
} as const;

export interface ReadinessConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: RedactedSecret;
}

/** Reads the API-only credential. Missing/invalid configuration makes readiness false. */
export function loadReadinessConfig(
  env: Readonly<Record<string, string | undefined>>,
  secrets: (env: Readonly<Record<string, string | undefined>>) => SecretConfig = (e) =>
    loadSecrets([API_RO_PASSWORD], e),
): ReadinessConfig {
  const parsed = ReadinessEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue): ConfigIssue => ({
        field: issue.path.map(String).join('.') || '(root)',
        code: issue.code,
      })),
    );
  }
  const loaded = secrets(env);
  const password = loaded['apiRoPassword'];
  if (!password) throw new ConfigError([{ field: API_RO_PASSWORD.env, code: 'required' }]);
  return {
    host: parsed.data.DB_HOST,
    port: parsed.data.DB_PORT,
    database: parsed.data.POSTGRES_DB,
    user: parsed.data.DB_USER_API_RO,
    password,
  };
}

/** Returns false on config, connection, query or migration drift; never emits database details. */
export async function checkDatabaseReadiness(
  env: Readonly<Record<string, string | undefined>>,
): Promise<boolean> {
  let config: ReadinessConfig;
  try {
    config = loadReadinessConfig(env);
  } catch {
    return false;
  }

  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password.reveal(),
    application_name: 'gd-api-ready',
    connectionTimeoutMillis: 1_500,
    statement_timeout: 1_500,
  });
  try {
    await client.connect();
    const result = await client.query<{ hash: string }>(
      'SELECT hash FROM "drizzle"."__drizzle_migrations" ORDER BY created_at ASC',
    );
    return compareMigrations(
      readExpectedHashes(),
      result.rows.map((row) => row.hash),
    ).ready;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}
