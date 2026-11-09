/**
 * Database credentials for drizzle-kit. Read lazily: only commands that connect to PostgreSQL need
 * DATABASE_URL, so `generate` and `check` run without any connection string. The value is never
 * printed; errors name the field only.
 */

/** drizzle-kit commands that connect to a database. */
const CONNECTING_COMMANDS: ReadonlySet<string> = new Set(['migrate', 'push', 'pull', 'studio']);
/** Every drizzle-kit command, so a flag value (e.g. `--config x`) is never mistaken for one. */
const KNOWN_COMMANDS: ReadonlySet<string> = new Set([
  'generate',
  'check',
  'up',
  'drop',
  ...CONNECTING_COMMANDS,
]);

export class DatabaseUrlError extends Error {
  constructor(command: string) {
    super(`DATABASE_URL is required for "${command}" and is missing or empty`);
    this.name = 'DatabaseUrlError';
  }
}

export interface DrizzleCredentials {
  url: string;
}

/**
 * Returns credentials only when the command connects to a database.
 * Throws DatabaseUrlError (without the value) when such a command has no DATABASE_URL.
 */
export function resolveDrizzleCredentials(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): DrizzleCredentials | undefined {
  const command = argv.find((arg) => KNOWN_COMMANDS.has(arg));
  if (!command || !CONNECTING_COMMANDS.has(command)) return undefined;

  const url = env['DATABASE_URL'];
  if (!url) throw new DatabaseUrlError(command);
  return { url };
}
