import { readMigrationFiles } from 'drizzle-orm/migrator';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * T-057: expected vs applied Drizzle migration state, compared by content hash in journal order.
 * Pure comparison plus the expected list read from the migrations folder. Nothing here connects to
 * a database. Results carry counts and reason codes only, never hashes or SQL.
 */

/** Folder with the drizzle-kit output: `drizzle/meta/_journal.json` and `*.sql`. Same depth in src/ and dist/. */
export const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../../drizzle/', import.meta.url));

export type MigrationReason = 'match' | 'pending' | 'mismatch';

export interface MigrationComparison {
  readonly ready: boolean;
  readonly reason: MigrationReason;
  readonly expected: number;
  readonly applied: number;
}

/**
 * `match`: applied equals expected (same hashes, same order).
 * `pending`: applied is a strict prefix of expected (migrations still to run).
 * `mismatch`: anything else (unknown, reordered or edited migrations).
 */
export function compareMigrations(
  expected: readonly string[],
  applied: readonly string[],
): MigrationComparison {
  const isPrefix = applied.every((hash, index) => hash === expected[index]);
  const counts = { expected: expected.length, applied: applied.length };
  if (isPrefix && applied.length === expected.length) {
    return { ready: true, reason: 'match', ...counts };
  }
  if (isPrefix) {
    return { ready: false, reason: 'pending', ...counts };
  }
  return { ready: false, reason: 'mismatch', ...counts };
}

/** Content hashes of the migrations shipped in `folder`, in journal order. */
export function readExpectedHashes(folder: string = MIGRATIONS_FOLDER): string[] {
  return readMigrationFiles({ migrationsFolder: folder }).map((migration) => migration.hash);
}

/** Public identity v1: SHA256 of JSON ordered Drizzle SQL hashes, without SQL details. */
export function migrationFingerprint(hashes: readonly string[] = readExpectedHashes()): string {
  if (!hashes.length || hashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash)))
    throw new Error('Migration identity unavailable');
  return createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
}
