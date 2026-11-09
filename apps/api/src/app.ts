import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';

/** Object paths whose values are censored in every structured log line. */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'authorization',
  'cookie',
  'password',
  '*.password',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'apiKey',
  '*.apiKey',
];

export interface BuildAppOptions {
  /** Destination for JSON log lines. Defaults to stdout (used by tests to capture). */
  readonly logStream?: { write(chunk: string): void };
}

/**
 * Composable app factory. Does not listen on a port and does not touch any
 * database. Callers own the lifecycle (`listen` / `close`).
 */
export function buildApp(config: AppConfig, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' },
      ...(options.logStream ? { stream: options.logStream } : {}),
    },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
