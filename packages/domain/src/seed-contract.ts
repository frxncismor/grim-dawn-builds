/**
 * Launcher–seeder contract (spec 005, T002): the single source for what `scripts/seed-content.mts`
 * and `apps/api/src/db/{seed,bootstrap,write-content}.mts` agree on. Pure and dependency-free; it
 * carries no secrets or environment values.
 */

/** Where the fixtures are mounted in the container and where the seeder is told to read them. */
export const CONTENT_MOUNT = '/content';

/** Closed set of codes a seeder may report after `<operation> failed: `. */
export const SEED_ERROR_CODES = [
  'already',
  'bootstrapped',
  'column',
  'conflicting-resource',
  'configuration-or-database',
  'credentials',
  'database-failed',
  'database-result',
  'duplicate',
  'environment',
  'fixture-read',
  'invalid-content',
  'migration',
  'not-empty',
  'owned-content',
  'reference',
  'role',
  'table',
] as const;

export type SeedErrorCode = (typeof SEED_ERROR_CODES)[number];

export type SeedOperation = 'seed' | 'bootstrap';

export const isSeedErrorCode = (value: unknown): value is SeedErrorCode =>
  typeof value === 'string' && (SEED_ERROR_CODES as readonly string[]).includes(value);

export const seedCompleteLine = (r: {
  builds: number;
  tierLists: number;
  masteries: number;
  nodes: number;
}): string =>
  `seed complete: ${r.builds} builds, ${r.tierLists} tier lists, ${r.masteries} masteries, ${r.nodes} nodes`;

export const bootstrapCompleteLine = (r: { builds: number; tierLists: number }): string =>
  `bootstrap complete: ${r.builds} builds, ${r.tierLists} tier lists`;

const SUCCESS_PATTERNS: Record<SeedOperation, RegExp> = {
  seed: /^seed complete: \d+ builds, \d+ tier lists, \d+ masteries, \d+ nodes\s*$/,
  bootstrap: /^bootstrap complete: \d+ builds, \d+ tier lists\s*$/,
};

/** Pattern the launcher uses to accept a seeder's success line. */
export const successPattern = (operation: SeedOperation): RegExp => SUCCESS_PATTERNS[operation];

/** Pattern matching `<operation> failed: <code>` with the code captured; derived from the union. */
export const failurePattern = (operation: SeedOperation): RegExp =>
  new RegExp(`^${operation} failed: (${SEED_ERROR_CODES.join('|')})\\s*$`);
