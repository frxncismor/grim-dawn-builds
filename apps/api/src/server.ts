import { buildApp } from './app.js';
import { formatConfigError, loadConfig } from './config.js';
import { checkDatabaseReadiness } from './db/readiness.mjs';
import { createDatabaseContentRepository } from './content/repository.js';
import { migrationFingerprint } from './db/migration-state.js';

/**
 * Executable entrypoint. Validates config first (fail fast, no values printed),
 * then listens and shuts down cleanly on SIGINT/SIGTERM.
 */
async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    process.stderr.write(`${formatConfigError(error)}\n`);
    process.exitCode = 1;
    return;
  }

  const content = createDatabaseContentRepository(process.env);
  const app = buildApp(config, {
    readiness: () => checkDatabaseReadiness(process.env),
    migration: migrationFingerprint,
    content: content.repository,
  });
  app.addHook('onClose', async () => {
    await content.close();
  });
  const shutdown = (): void => {
    void app.close().then(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch {
    app.log.error({ port: config.port }, 'failed to listen');
    process.exitCode = 1;
  }
}

await main();
