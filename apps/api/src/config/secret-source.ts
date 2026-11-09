import { readFileSync } from 'node:fs';

/** Placeholder printed instead of any secret value. */
export const REDACTED = '[REDACTED]';

/**
 * Holds a sensitive value. The raw value is only reachable through `reveal()`;
 * every implicit serialization (template strings, `String()`, `JSON.stringify`,
 * `util.inspect`, pino logs) yields REDACTED instead.
 */
export class RedactedSecret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** The only way to read the raw value. Never pass the result to logs, JSON or errors. */
  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED;
  }
}

/** Where a resolved secret came from, in precedence order. Never the value. */
export type SecretSourceKind = 'file' | 'run-secret' | 'env';

export interface ResolvedSecret {
  readonly source: SecretSourceKind;
  readonly raw: string;
}

/** Declares one secret: its config key, env variable and Docker secret file name. */
export interface SecretSpec {
  /** Key in the resulting secret config object, e.g. `dbPassword`. */
  readonly key: string;
  /** Environment variable name, e.g. `DB_PASSWORD`. `${env}_FILE` may point to a file. */
  readonly env: string;
  /** File name under `/run/secrets/`, e.g. `db_password`. */
  readonly secretName: string;
  readonly required: boolean;
}

/** Filesystem access, injectable so tests need no real /run/secrets. */
export interface SecretIO {
  /** File contents, or undefined when the file does not exist. Throws on other errors. */
  readFile(path: string): string | undefined;
}

export const fsSecretIO: SecretIO = {
  readFile(path) {
    try {
      return readFileSync(path, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
  },
};

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/**
 * Thrown by resolveSecret for a source problem. Carries the field and a code
 * only; the message never includes the path contents or any value.
 */
export class SecretResolutionError extends Error {
  readonly field: string;
  readonly code: string;

  constructor(field: string, code: string) {
    super(`Secret source problem: ${field} (${code})`);
    this.name = 'SecretResolutionError';
    this.field = field;
    this.code = code;
  }
}

/** Removes exactly one trailing line break, as written by most editors and Docker secrets. */
function stripTrailingNewline(content: string): string {
  return content.replace(/\r?\n$/, '');
}

function readRequired(io: SecretIO, path: string, field: string): string {
  let content: string | undefined;
  try {
    content = io.readFile(path);
  } catch {
    throw new SecretResolutionError(field, 'file_unreadable');
  }
  if (content === undefined) throw new SecretResolutionError(field, 'file_unreadable');
  return content;
}

/**
 * Resolves one secret. Precedence (first match wins, no silent fallback after a file problem):
 *   1. `${env}_FILE` names a file whose contents are the value;
 *   2. `/run/secrets/${secretName}` exists (Docker/Compose secret);
 *   3. `${env}` environment variable.
 * Returns undefined when no source is set. Throws SecretResolutionError on file problems.
 */
export function resolveSecret(
  spec: SecretSpec,
  env: Readonly<Record<string, string | undefined>>,
  io: SecretIO = fsSecretIO,
): ResolvedSecret | undefined {
  const fileVar = `${spec.env}_FILE`;
  const filePath = env[fileVar];
  if (filePath !== undefined) {
    if (filePath.trim() === '') throw new SecretResolutionError(fileVar, 'empty_path');
    const content = readRequired(io, filePath, fileVar);
    return { source: 'file', raw: stripTrailingNewline(content) };
  }

  const runSecretPath = `/run/secrets/${spec.secretName}`;
  let runSecret: string | undefined;
  try {
    runSecret = io.readFile(runSecretPath);
  } catch {
    throw new SecretResolutionError(spec.env, 'file_unreadable');
  }
  if (runSecret !== undefined) {
    return { source: 'run-secret', raw: stripTrailingNewline(runSecret) };
  }

  const value = env[spec.env];
  if (value !== undefined) return { source: 'env', raw: value };
  return undefined;
}
