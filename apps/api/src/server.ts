import { buildApp } from './app.js';
import { formatConfigError, loadConfig } from './config.js';

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

  const app = buildApp(config);
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
