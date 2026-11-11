import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const SECRET_TOKEN = ['tok', 'super_secret_value_123'].join('_');
const SECRET_PASSWORD = ['pw', 'super_secret_value_456'].join('_');

function captureStream(): { stream: Writable; text: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return { stream, text: () => chunks.join('') };
}

describe('GET /health', () => {
  it('returns 200 with a minimal safe body, without any database', async () => {
    const app = buildApp(loadConfig({}), { logStream: captureStream().stream });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('exposes no CORS headers and no public write routes', async () => {
    const app = buildApp(loadConfig({}), { logStream: captureStream().stream });
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();

    const write = await app.inject({ method: 'POST', url: '/health', payload: {} });
    expect(write.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /ready', () => {
  it('exposes the migration fingerprint only after successful readiness', async () => {
    const fingerprint = 'a'.repeat(64);
    for (const ready of [true, false]) {
      const app = buildApp(loadConfig({ LOG_LEVEL: 'silent' }), {
        readiness: async () => ready,
        migration: () => fingerprint,
      });
      const response = await app.inject('/ready');
      expect(response.headers['x-content-migration']).toBe(ready ? fingerprint : undefined);
      expect(response.json()).toEqual({ status: ready ? 'ready' : 'not_ready' });
      await app.close();
    }
  });

  it('fails readiness closed if the migration fingerprint cannot be calculated', async () => {
    const app = buildApp(loadConfig({ LOG_LEVEL: 'silent' }), {
      readiness: async () => true,
      migration: () => {
        throw new Error('private SQL details');
      },
    });
    const response = await app.inject('/ready');
    expect(response.statusCode).toBe(503);
    expect(response.headers['x-content-migration']).toBeUndefined();
    expect(response.json()).toEqual({ status: 'not_ready' });
    await app.close();
  });
  it('returns 200 only when the database probe reports matching migrations', async () => {
    const app = buildApp(loadConfig({}), {
      logStream: captureStream().stream,
      readiness: async () => true,
    });
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
    await app.close();
  });

  it('returns 503 if the database is down or migrations do not match', async () => {
    const app = buildApp(loadConfig({}), {
      logStream: captureStream().stream,
      readiness: async () => false,
    });
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'not_ready' });
    await app.close();
  });

  it('keeps liveness healthy when the readiness probe throws', async () => {
    const app = buildApp(loadConfig({}), {
      logStream: captureStream().stream,
      readiness: async () => {
        throw new Error('database details must not escape');
      },
    });
    const ready = await app.inject({ method: 'GET', url: '/ready' });
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(ready.statusCode).toBe(503);
    expect(health.statusCode).toBe(200);
    expect(ready.body).not.toContain('database details');
    await app.close();
  });
});

describe('structured logging and redaction', () => {
  it('emits JSON log lines and never the raw Authorization or Cookie header values', async () => {
    const { stream, text } = captureStream();
    const app = buildApp(loadConfig({ LOG_LEVEL: 'info' }), { logStream: stream });
    await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        authorization: `Bearer ${SECRET_TOKEN}`,
        cookie: `session=${SECRET_TOKEN}`,
      },
    });
    await app.close();

    const output = text();
    expect(output.trim().split('\n').length).toBeGreaterThan(0);
    for (const line of output.trim().split('\n')) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    expect(output).not.toContain(SECRET_TOKEN);
  });

  it('censors secret-like fields passed to the logger', async () => {
    const { stream, text } = captureStream();
    const app = buildApp(loadConfig({ LOG_LEVEL: 'info' }), { logStream: stream });
    app.log.info({ password: SECRET_PASSWORD, token: SECRET_TOKEN }, 'probe');
    await app.close();

    const output = text();
    expect(output).toContain('probe');
    expect(output).not.toContain(SECRET_PASSWORD);
    expect(output).not.toContain(SECRET_TOKEN);
    expect(output).toContain('[REDACTED]');
  });

  it('does not log the raw configuration object', async () => {
    const { stream, text } = captureStream();
    const app = buildApp(loadConfig({ API_HOST: '0.0.0.0', LOG_LEVEL: 'info' }), {
      logStream: stream,
    });
    await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(text()).not.toContain('"logLevel"');
    expect(text()).not.toContain('"host":"0.0.0.0"');
  });
});
