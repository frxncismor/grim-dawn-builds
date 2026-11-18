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
  'arguments',
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

/**
 * Optional detail after the code: an identifier (for example the retired mastery a guide still uses,
 * FR-012). Closed pattern so a failure line can never carry SQL, row values or free text.
 */
const DETAIL_SOURCE = '[a-z0-9][a-z0-9_-]{0,63}';
const DETAIL_PATTERN = new RegExp(`^${DETAIL_SOURCE}$`);

/** The one failure line a seeder prints and the launcher forwards: `<op> failed: <code>[ (<detail>)]`. */
export const failureLine = (
  operation: SeedOperation,
  code: SeedErrorCode,
  detail?: string,
): string =>
  `${operation} failed: ${code}${detail !== undefined && DETAIL_PATTERN.test(detail) ? ` (${detail})` : ''}`;

/**
 * Pattern matching `<operation> failed: <code>[ (<detail>)]`; capture 1 is the code and capture 2 the
 * optional detail. Derived from the union.
 */
export const failurePattern = (operation: SeedOperation): RegExp =>
  new RegExp(
    `^${operation} failed: (${SEED_ERROR_CODES.join('|')})(?: \\((${DETAIL_SOURCE})\\))?\\s*$`,
  );
