import { describe, expect, it } from 'vitest';
import { DatabaseUrlError, resolveDrizzleCredentials } from './credentials.js';

const SENTINEL = 'sentinel-value-never-printed';

describe('resolveDrizzleCredentials', () => {
  it('needs no database credentials for generate or check', () => {
    expect(resolveDrizzleCredentials(['generate'], {})).toBeUndefined();
    expect(resolveDrizzleCredentials(['check'], {})).toBeUndefined();
  });

  it('reads DATABASE_URL only for commands that touch a database', () => {
    expect(resolveDrizzleCredentials(['migrate'], { DATABASE_URL: SENTINEL })).toEqual({
      url: SENTINEL,
    });
    expect(
      resolveDrizzleCredentials(['--config', 'drizzle.config.ts', 'push'], {
        DATABASE_URL: SENTINEL,
      }),
    ).toEqual({ url: SENTINEL });
  });

  it('fails for a database command without DATABASE_URL, naming the field but never its value', () => {
    let caught: unknown;
    try {
      resolveDrizzleCredentials(['migrate'], { DATABASE_URL: '' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DatabaseUrlError);
    const message = (caught as Error).message;
    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain(SENTINEL);
  });

  it('does not treat a flag value as a command', () => {
    expect(
      resolveDrizzleCredentials(['--config', 'migrate.config.ts', 'generate'], {}),
    ).toBeUndefined();
  });
});
