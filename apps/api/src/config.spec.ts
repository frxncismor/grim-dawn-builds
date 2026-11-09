import { describe, expect, it } from 'vitest';
import { ConfigError, formatConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses safe defaults when no variables are set', () => {
    expect(loadConfig({})).toEqual({
      host: '127.0.0.1',
      port: 3000,
      logLevel: 'info',
    });
  });

  it('parses a valid port and log level', () => {
    const config = loadConfig({ API_PORT: '8080', LOG_LEVEL: 'debug', API_HOST: '0.0.0.0' });
    expect(config).toEqual({ host: '0.0.0.0', port: 8080, logLevel: 'debug' });
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
