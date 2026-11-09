import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { ConfigError, formatConfigError } from '../config.js';
import { loadSecrets, PROHIBITED_SECRET_VALUES } from './secrets.js';
import type { SecretIO, SecretSpec } from './secret-source.js';

const REQUIRED: SecretSpec = {
  key: 'dbPassword',
  env: 'DB_PASSWORD',
  secretName: 'db_password',
  required: true,
};
const OPTIONAL: SecretSpec = {
  key: 'apiToken',
  env: 'API_TOKEN',
  secretName: 'api_token',
  required: false,
};

const noFiles: SecretIO = { readFile: () => undefined };

/** Captures the ConfigError thrown by loadSecrets, or fails the test. */
function configErrorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected loadSecrets to throw');
}

describe('loadSecrets: success and optional secrets', () => {
  it('returns redacted secrets whose raw value is available through reveal()', () => {
    const secrets = loadSecrets([REQUIRED], { DB_PASSWORD: 'correct-horse-battery' }, noFiles);
    expect(secrets['dbPassword']?.reveal()).toBe('correct-horse-battery');
  });

  it('omits an optional secret that has no source', () => {
    const secrets = loadSecrets([OPTIONAL], {}, noFiles);
    expect(secrets).toEqual({});
  });

  it('resolves each spec through its own precedence', () => {
    const io: SecretIO = {
      readFile: (p) => (p === '/run/secrets/api_token' ? 'tok-from-run' : undefined),
    };
    const secrets = loadSecrets([REQUIRED, OPTIONAL], { DB_PASSWORD: 'db-from-env' }, io);
    expect(secrets['dbPassword']?.reveal()).toBe('db-from-env');
    expect(secrets['apiToken']?.reveal()).toBe('tok-from-run');
  });
});

describe('loadSecrets: required and rejected values', () => {
  it('fails when a required secret has no source, naming the field only', () => {
    const error = configErrorOf(() => loadSecrets([REQUIRED], {}, noFiles));
    expect(error.fields).toEqual(['DB_PASSWORD']);
    expect(error.codes).toEqual(['required']);
    expect(error.message).toContain('DB_PASSWORD (required)');
  });

  it.each([
    ['empty string', '', 'empty'],
    ['whitespace only', '   \t ', 'blank'],
    ['placeholder changeme', 'changeme', 'prohibited'],
    ['placeholder in another case', 'ChangeMe', 'prohibited'],
    ['placeholder with padding', '  password  ', 'prohibited'],
  ])('rejects a %s value with code %s', (_label, value, code) => {
    const error = configErrorOf(() => loadSecrets([REQUIRED], { DB_PASSWORD: value }, noFiles));
    expect(error.fields).toEqual(['DB_PASSWORD']);
    expect(error.codes).toEqual([code]);
  });

  it('rejects an empty secret file even when it is the only source', () => {
    const io: SecretIO = { readFile: () => '\n' };
    const error = configErrorOf(() => loadSecrets([REQUIRED], {}, io));
    expect(error.codes).toEqual(['empty']);
  });

  it('rejects an empty value even for an optional secret', () => {
    const error = configErrorOf(() => loadSecrets([OPTIONAL], { API_TOKEN: '' }, noFiles));
    expect(error.codes).toEqual(['empty']);
  });

  it('reports every invalid field in one error', () => {
    const error = configErrorOf(() =>
      loadSecrets([REQUIRED, OPTIONAL], { DB_PASSWORD: 'changeme', API_TOKEN: '' }, noFiles),
    );
    expect(error.fields).toEqual(['DB_PASSWORD', 'API_TOKEN']);
    expect(error.codes).toEqual(['prohibited', 'empty']);
  });

  it('keeps every prohibited placeholder in the rejected set', () => {
    expect(PROHIBITED_SECRET_VALUES.has('changeme')).toBe(true);
    expect(PROHIBITED_SECRET_VALUES.has('postgres')).toBe(true);
  });
});

describe('loadSecrets: redaction in errors and serialization', () => {
  const LEAK = 'leak-me-not-42';

  it('never puts a rejected value in the error message, fields, codes or JSON', () => {
    const rejectedValue = '   ';
    const other = configErrorOf(() =>
      loadSecrets([REQUIRED], { DB_PASSWORD: rejectedValue }, noFiles),
    );
    expect(JSON.stringify(other)).not.toContain(rejectedValue);
    expect(formatConfigError(other)).not.toContain(rejectedValue);
  });

  it('keeps a valid-but-invalid-elsewhere secret out of the error text', () => {
    const error = configErrorOf(() =>
      loadSecrets([REQUIRED, OPTIONAL], { DB_PASSWORD: LEAK, API_TOKEN: '' }, noFiles),
    );
    expect(error.message).not.toContain(LEAK);
    expect(JSON.stringify(error)).not.toContain(LEAK);
    expect(formatConfigError(error)).toContain('API_TOKEN');
    expect(formatConfigError(error)).not.toContain('DB_PASSWORD');
    expect(formatConfigError(error)).not.toContain(LEAK);
  });

  it('serializes a loaded secret to JSON and inspect output without the value', () => {
    const secrets = loadSecrets([REQUIRED], { DB_PASSWORD: LEAK }, noFiles);
    expect(JSON.stringify(secrets)).toBe('{"dbPassword":"[REDACTED]"}');
    expect(inspect(secrets)).not.toContain(LEAK);
    expect(`${secrets['dbPassword']}`).toBe('[REDACTED]');
  });

  it('redacts secrets written to structured logs', () => {
    const secrets = loadSecrets([REQUIRED], { DB_PASSWORD: LEAK }, noFiles);
    let output = '';
    const app = buildApp(
      { host: '127.0.0.1', port: 3000, logLevel: 'info' },
      { logStream: { write: (chunk) => (output += chunk) } },
    );
    app.log.info(
      { db: { password: secrets['dbPassword'] }, secret: secrets['dbPassword'] },
      'probe',
    );
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain(LEAK);
    return app.close();
  });
});
