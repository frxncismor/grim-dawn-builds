import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createLimiter } from './http.js';

const origin = 'http://localhost:4200';
const config = (env: Record<string, string> = {}) => loadConfig({ LOG_LEVEL: 'silent', ...env });
describe('local HTTP security', () => {
  it('allows the exact origin and rejects others before database readiness', async () => {
    const readiness = vi.fn(async () => true);
    const app = buildApp(config(), { readiness });
    try {
      for (const denied of [
        'http://127.0.0.1:4200',
        'https://evil.example',
        'null',
        'http://localhost:4200.evil.example',
      ]) {
        const response = await app.inject({ url: '/ready', headers: { origin: denied } });
        expect(response.statusCode).toBe(403);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
      expect(readiness).not.toHaveBeenCalled();
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/ready',
            headers: { 'transfer-encoding': 'chunked' },
          })
        ).statusCode,
      ).toBe(400);
      expect(readiness).not.toHaveBeenCalled();
      const allowed = await app.inject({ url: '/ready', headers: { origin } });
      expect(allowed.statusCode).toBe(200);
      expect(allowed.headers['access-control-allow-origin']).toBe(origin);
      expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
      expect((await app.inject('/health')).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
  it('validates preflight methods and requested headers without calling readiness', async () => {
    const readiness = vi.fn(async () => true);
    const app = buildApp(config(), { readiness });
    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/ready',
        headers: {
          origin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'content-type, accept',
        },
      });
      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBe('GET, HEAD, OPTIONS');
      for (const headers of [
        { origin, 'access-control-request-method': 'POST' },
        {
          origin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      ]) {
        expect((await app.inject({ method: 'OPTIONS', url: '/ready', headers })).statusCode).toBe(
          403,
        );
      }
      expect(readiness).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('sets security headers on success, denial, unknown routes and readiness failures', async () => {
    const app = buildApp(config());
    try {
      for (const url of ['/health', '/ready', '/missing']) {
        const response = await app.inject(url);
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['referrer-policy']).toBe('no-referrer');
        expect(response.headers['content-security-policy']).toContain("default-src 'none'");
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['strict-transport-security']).toBeUndefined();
      }
    } finally {
      await app.close();
    }
  });
  it('rejects bodies and write methods before database access', async () => {
    const readiness = vi.fn(async () => true);
    const app = buildApp(config({ API_BODY_LIMIT_BYTES: '1024' }), { readiness });
    try {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const)
        expect((await app.inject({ method, url: '/ready' })).statusCode).toBe(404);
      expect(
        (await app.inject({ method: 'GET', url: '/ready', payload: 'x'.repeat(1025) })).statusCode,
      ).toBe(413);
      expect((await app.inject({ method: 'GET', url: '/ready', payload: 'x' })).statusCode).toBe(
        400,
      );
      expect(readiness).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('ignores forged forwarding headers and returns Retry-After before readiness', async () => {
    const readiness = vi.fn(async () => true);
    const app = buildApp(config({ API_RATE_LIMIT: '2' }), { readiness });
    try {
      for (const spoof of ['10.0.0.1', '10.0.0.2'])
        expect(
          (await app.inject({ url: '/ready', headers: { 'x-forwarded-for': spoof } })).statusCode,
        ).toBe(200);
      const denied = await app.inject({
        url: '/ready',
        headers: { origin, 'x-forwarded-for': '10.0.0.3' },
      });
      expect(denied.statusCode).toBe(429);
      expect(Number(denied.headers['retry-after'])).toBeGreaterThan(0);
      expect(denied.headers['access-control-allow-origin']).toBe(origin);
      expect(readiness).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });
  it('keeps HEAD read-only with an empty body and protects CORS denial responses', async () => {
    const app = buildApp(config());
    try {
      const head = await app.inject({ method: 'HEAD', url: '/health', headers: { origin } });
      expect(head.statusCode).toBe(200);
      expect(head.body).toBe('');
      const denied = await app.inject({
        url: '/health',
        headers: { origin: 'http://127.0.0.1:4200' },
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.headers['x-content-type-options']).toBe('nosniff');
      expect(denied.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    } finally {
      await app.close();
    }
  });
  it('resets windows and bounds distinct-IP storage without evicting active clients', () => {
    const allow = createLimiter(2, 60000, 2);
    expect(allow('one', 0).allowed).toBe(true);
    expect(allow('one', 1).allowed).toBe(true);
    expect(allow('one', 2).allowed).toBe(false);
    expect(allow('two', 2).allowed).toBe(true);
    expect(allow('three', 3).allowed).toBe(false);
    expect(allow('two', 4).allowed).toBe(true);
    expect(allow('three', 60002).allowed).toBe(true);
  });
  it('does not log or echo raw URLs, query strings or error messages', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const app = buildApp(config({ LOG_LEVEL: 'info' }), { logStream: stream });
    app.get('/throw', async () => {
      throw new Error('PRIVATE-ERROR-CANARY');
    });
    try {
      const unknown = await app.inject({
        url: '/missing/PRIVATE-PATH-CANARY?token=PRIVATE-QUERY-CANARY',
        headers: { 'request-id': 'PRIVATE-HEADER-CANARY', 'x-request-id': 'PRIVATE-HEADER-CANARY' },
      });
      const failed = await app.inject('/throw');
      expect(unknown.statusCode).toBe(404);
      expect(failed.statusCode).toBe(500);
      expect(unknown.body + failed.body).not.toContain('PRIVATE-');
    } finally {
      await app.close();
    }
    expect(lines.join('')).not.toContain('PRIVATE-');
  });
});
