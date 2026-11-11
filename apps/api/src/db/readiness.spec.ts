import { describe, expect, it } from 'vitest';
import { ConfigError } from '../config/errors.js';
import { RedactedSecret } from '../config/secret-source.js';
import { checkDatabaseReadiness, loadReadinessConfig } from './readiness.mjs';

describe('loadReadinessConfig', () => {
  it('uses only the api_ro credential and redacts it from serialized config', () => {
    const config = loadReadinessConfig({ DB_HOST: 'db' }, () => ({
      apiRoPassword: new RedactedSecret('runtime-secret'),
    }));
    expect(config).toMatchObject({ host: 'db', port: 5432, database: 'gd_dev', user: 'api_ro' });
    expect(JSON.stringify(config)).not.toContain('runtime-secret');
    expect(String(config.password)).toBe('[REDACTED]');
    expect(config.password.reveal()).toBe('runtime-secret');
  });

  it('rejects malformed settings without disclosing their values', () => {
    expect(() => loadReadinessConfig({ DB_HOST: 'invalid host secret-value' })).toThrow(
      ConfigError,
    );
  });
});

describe('checkDatabaseReadiness', () => {
  it('fails closed when the API-only credential is unavailable', async () => {
    await expect(checkDatabaseReadiness({})).resolves.toBe(false);
  });
});
