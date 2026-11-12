import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';

/** Fixed window, monotonic time, and bounded storage. Forwarded headers are never keys. */
export function createLimiter(limit: number, windowMs = 60000, capacity = 1024) {
  const buckets = new Map<string, { start: number; count: number }>();
  let lastSweep = 0;
  return (ip: string, now: number): { allowed: boolean; retryAfter: number } => {
    if (now - lastSweep >= windowMs || buckets.size >= capacity) {
      for (const [key, bucket] of buckets) if (now - bucket.start >= windowMs) buckets.delete(key);
      lastSweep = now;
    }
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.start >= windowMs) {
      if (!bucket && buckets.size >= capacity)
        return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
      bucket = { start: now, count: 0 };
      buckets.set(ip, bucket);
    }
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000));
    if (bucket.count >= limit) return { allowed: false, retryAfter };
    bucket.count += 1;
    return { allowed: true, retryAfter: 0 };
  };
}

const HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-resource-policy': 'same-site',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
};
const METHODS = ['GET', 'HEAD', 'OPTIONS'];
const REQUEST_HEADERS = new Set(['accept', 'content-type']);

export function installHttpSecurity(app: FastifyInstance, config: AppConfig): void {
  const consume = createLimiter(config.rateLimit);
  app.addHook('onSend', async (request, reply, payload) => {
    for (const [key, value] of Object.entries(HEADERS)) reply.header(key, value);
    reply.header('vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    if (request.headers.origin === config.corsOrigin) {
      reply.header('access-control-allow-origin', config.corsOrigin);
      reply.header('access-control-expose-headers', 'Retry-After');
    }
    return payload;
  });
  app.addHook('onRequest', async (request, reply) => {
    const result = consume(request.ip, performance.now());
    if (!result.allowed)
      return reply
        .header('retry-after', String(result.retryAfter))
        .code(429)
        .send({ error: 'rate_limited' });
    const declared = request.headers['content-length'];
    if (
      declared !== undefined &&
      (!/^\d+$/.test(declared) || Number(declared) > config.bodyLimit)
    ) {
      return reply
        .header('connection', 'close')
        .code(/^\d+$/.test(declared) ? 413 : 400)
        .send({ error: /^\d+$/.test(declared) ? 'payload_too_large' : 'bad_request' });
    }
    if (!METHODS.includes(request.method))
      return reply.header('connection', 'close').code(404).send({ error: 'not_found' });
    if (request.headers.origin !== undefined && request.headers.origin !== config.corsOrigin)
      return reply.code(403).send({ error: 'origin_forbidden' });
    if (Number(declared ?? 0) > 0 || request.headers['transfer-encoding'] !== undefined)
      return reply.header('connection', 'close').code(400).send({ error: 'unexpected_body' });
    if (request.method === 'OPTIONS') {
      if (request.headers.origin !== undefined) {
        const method = request.headers['access-control-request-method'];
        const headers = request.headers['access-control-request-headers'];
        const names =
          typeof headers === 'string'
            ? headers
                .split(',')
                .map((name) => name.trim().toLowerCase())
                .filter(Boolean)
            : [];
        if (
          typeof method !== 'string' ||
          !METHODS.includes(method) ||
          names.some((name) => !REQUEST_HEADERS.has(name))
        )
          return reply.code(403).send({ error: 'preflight_forbidden' });
        reply.header('access-control-allow-methods', 'GET, HEAD, OPTIONS');
        reply.header('access-control-allow-headers', 'Accept, Content-Type');
      }
      return reply.header('allow', 'GET, HEAD, OPTIONS').code(204).send();
    }
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found' }));
  app.setErrorHandler((error, _request, reply) => {
    const failure =
      error && typeof error === 'object' ? (error as { code?: unknown; statusCode?: unknown }) : {};
    const code =
      failure.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
        ? 413
        : typeof failure.statusCode === 'number' &&
            failure.statusCode >= 400 &&
            failure.statusCode < 500
          ? 400
          : 500;
    return reply.code(code).send({
      error: code === 413 ? 'payload_too_large' : code === 400 ? 'bad_request' : 'internal_error',
    });
  });
}
