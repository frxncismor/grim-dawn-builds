import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { AppConfig } from './config.js';
import type { PublicContentRepository } from './content/repository.js';
import { registerContentRoutes } from './routes/content.js';
import { installHttpSecurity } from './security/http.js';

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
  /** Checks database connectivity and migration parity. A missing probe fails readiness closed. */
  readonly readiness?: () => Promise<boolean>;
  /** Public digest of shipped migrations; supplied by the executable server. */
  readonly migration?: () => string;
  readonly content?: PublicContentRepository;
}

/**
 * Composable app factory. Does not listen on a port and does not touch any
 * database. Callers own the lifecycle (`listen` / `close`).
 */
export function buildApp(config: AppConfig, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    trustProxy: false,
    bodyLimit: config.bodyLimit,
    requestTimeout: 10000,
    connectionTimeout: 10000,
    keepAliveTimeout: 5000,
    logger: {
      level: config.logLevel,
      redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' },
      serializers: {
        req: (request: FastifyRequest) => ({
          method: request.method,
          route: request.routeOptions?.url ?? '[unmatched]',
        }),
        err: () => ({ type: 'Error', message: 'request_error', stack: '' }),
      },
      ...(options.logStream ? { stream: options.logStream } : {}),
    },
  });
  installHttpSecurity(app, config);

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    let ready: boolean;
    try {
      ready = (await options.readiness?.()) ?? false;
      if (ready && options.migration) {
        const migration = options.migration();
        if (!/^[a-f0-9]{64}$/.test(migration)) throw new Error('Invalid migration identity');
        reply.header('X-Content-Migration', migration);
      }
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
    if (!ready) return reply.code(503).send({ status: 'not_ready' });
    return { status: 'ready' };
  });

  registerContentRoutes(app, options.content, options.readiness);
  return app;
}
