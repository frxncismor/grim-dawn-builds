import { z } from 'zod';
import { ConfigError } from './config/errors.js';

export { ConfigError, type ConfigIssue } from './config/errors.js';
export {
  PROHIBITED_SECRET_VALUES,
  SecretValueSchema,
  loadSecrets,
  type SecretConfig,
} from './config/secrets.js';
export {
  REDACTED,
  RedactedSecret,
  SecretResolutionError,
  resolveSecret,
  type SecretIO,
  type SecretSpec,
  type SecretSourceKind,
} from './config/secret-source.js';

/** Pino levels accepted by LOG_LEVEL. */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Hostnames or IP literals: letters, digits, dots, colons (IPv6) and dashes only. */
const SAFE_HOST = /^[A-Za-z0-9.:-]{1,253}$/;

const PortSchema = z
  .string()
  .regex(/^\d{1,5}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

const ConfigSchema = z.object({
  API_HOST: z.string().regex(SAFE_HOST).default('127.0.0.1'),
  API_PORT: PortSchema.default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly logLevel: LogLevel;
}

/**
 * Validates environment variables into the minimal API config.
 * Throws ConfigError (field-oriented, redacted) when a value is invalid.
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || '(root)',
        code: issue.code,
      })),
    );
  }
  return {
    host: result.data.API_HOST,
    port: result.data.API_PORT,
    logLevel: result.data.LOG_LEVEL,
  };
}

/**
 * Human-readable, redacted description of a startup error for stderr.
 * Lists field names and codes only; never values.
 */
export function formatConfigError(error: unknown): string {
  if (!(error instanceof ConfigError)) return 'Invalid configuration.';
  const lines = error.fields.map((field) => `  - ${field}`);
  return ['Invalid configuration. Check these environment variables:', ...lines].join('\n');
}
