import { describe, expect, it } from 'vitest';
import { ConfigError, formatConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses safe defaults when no variables are set', () => {
    expect(loadConfig({})).toEqual({
      host: '127.0.0.1',
      port: 3000,
      logLevel: 'info',
      corsOrigin: 'http://localhost:4200',
      bodyLimit: 16384,
      rateLimit: 120,
    });
  });

  it('parses a valid port and log level', () => {
    const config = loadConfig({ API_PORT: '8080', LOG_LEVEL: 'debug', API_HOST: '0.0.0.0' });
    expect(config).toEqual({
      host: '0.0.0.0',
      port: 8080,
      logLevel: 'debug',
      corsOrigin: 'http://localhost:4200',
      bodyLimit: 16384,
      rateLimit: 120,
    });
  });
  it('accepts only the approved CORS origin and bounded integer HTTP limits', () => {
    for (const value of [
      '*',
      '',
      'null',
      'http://127.0.0.1:4200',
      'http://localhost:4200,https://other.example',
    ]) {
      expect(() => loadConfig({ CORS_ORIGINS: value })).toThrow(ConfigError);
    }
    for (const value of ['0', '1023', '65537', '1.5', 'unbounded'])
      expect(() => loadConfig({ API_BODY_LIMIT_BYTES: value })).toThrow(ConfigError);
    for (const value of ['0', '-1', '10001', 'NaN'])
      expect(() => loadConfig({ API_RATE_LIMIT: value })).toThrow(ConfigError);
    expect(loadConfig({ API_BODY_LIMIT_BYTES: '1024', API_RATE_LIMIT: '2' })).toMatchObject({
      bodyLimit: 1024,
      rateLimit: 2,
    });
  });

  it('does not require any database variable', () => {
    expect(() => loadConfig({})).not.toThrow();
  });

  it('fails fast naming the invalid field, without echoing the input value', () => {
    const secret = 'super-secret-port-value';
    let caught: unknown;
    try {
      loadConfig({ API_PORT: secret });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const error = caught as ConfigError;
    expect(error.fields).toEqual(['API_PORT']);
    expect(error.message).toContain('API_PORT');
    expect(error.message).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
  });

  it('rejects out-of-range ports', () => {
    expect(() => loadConfig({ API_PORT: '70000' })).toThrow(ConfigError);
    expect(() => loadConfig({ API_PORT: '0' })).toThrow(ConfigError);
  });

  it('rejects unknown log levels without echoing them', () => {
    const value = 'verbose-but-secret-looking';
    expect(() => loadConfig({ LOG_LEVEL: value })).toThrow(ConfigError);
    try {
      loadConfig({ LOG_LEVEL: value });
    } catch (error) {
      expect(String(error)).toContain('LOG_LEVEL');
      expect(String(error)).not.toContain(value);
    }
  });

  it('rejects hosts with unsafe characters', () => {
    expect(() => loadConfig({ API_HOST: 'bad host;rm' })).toThrow(ConfigError);
  });
});

describe('formatConfigError', () => {
  it('lists field names and issue codes only', () => {
    const value = 'leak-me-please';
    try {
      loadConfig({ API_PORT: value, LOG_LEVEL: value });
    } catch (error) {
      const text = formatConfigError(error);
      expect(text).toContain('API_PORT');
      expect(text).toContain('LOG_LEVEL');
      expect(text).not.toContain(value);
    }
  });

  it('describes non-config errors generically', () => {
    expect(formatConfigError(new Error('boom'))).toBe('Invalid configuration.');
  });
});
