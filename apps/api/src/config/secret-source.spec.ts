import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RedactedSecret,
  SecretResolutionError,
  fsSecretIO,
  resolveSecret,
  type SecretIO,
  type SecretSpec,
} from './secret-source.js';

const SPEC: SecretSpec = {
  key: 'dbPassword',
  env: 'DB_PASSWORD',
  secretName: 'db_password',
  required: true,
};

/** In-memory SecretIO: only the listed paths exist. */
function memoryIO(files: Record<string, string>): SecretIO {
  return {
    readFile(path) {
      return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : undefined;
    },
  };
}

const RUN_PATH = '/run/secrets/db_password';

describe('resolveSecret: file resolution', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gd-secret-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads NAME_FILE from a real file and strips exactly one trailing newline', () => {
    const path = join(dir, 'pw.txt');
    writeFileSync(path, 'real-value-from-file\n');
    const resolved = resolveSecret(SPEC, { DB_PASSWORD_FILE: path }, fsSecretIO);
    expect(resolved).toEqual({ source: 'file', raw: 'real-value-from-file' });
  });

  it('strips a CRLF line break and keeps inner content untouched', () => {
    const path = join(dir, 'crlf.txt');
    writeFileSync(path, 'a b\r\n');
    expect(resolveSecret(SPEC, { DB_PASSWORD_FILE: path }, fsSecretIO)?.raw).toBe('a b');
  });

  it('fails when NAME_FILE points to a missing file, without falling back to env', () => {
    const missing = join(dir, 'does-not-exist.txt');
    expect(() =>
      resolveSecret(SPEC, { DB_PASSWORD_FILE: missing, DB_PASSWORD: 'env-value' }, fsSecretIO),
    ).toThrow(SecretResolutionError);
    try {
      resolveSecret(SPEC, { DB_PASSWORD_FILE: missing }, fsSecretIO);
    } catch (error) {
      expect((error as SecretResolutionError).field).toBe('DB_PASSWORD_FILE');
      expect((error as SecretResolutionError).code).toBe('file_unreadable');
    }
  });

  it('rejects a blank NAME_FILE path', () => {
    try {
      resolveSecret(SPEC, { DB_PASSWORD_FILE: '   ' }, memoryIO({}));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SecretResolutionError);
      expect((error as SecretResolutionError).code).toBe('empty_path');
    }
  });

  it('reads /run/secrets/<name> when no NAME_FILE is set', () => {
    const io = memoryIO({ [RUN_PATH]: 'from-run-secret\n' });
    expect(resolveSecret(SPEC, {}, io)).toEqual({ source: 'run-secret', raw: 'from-run-secret' });
  });

  it('treats an unreadable /run/secrets file as an error, not as absent', () => {
    const io: SecretIO = {
      readFile() {
        throw Object.assign(new Error('EACCES: /run/secrets/db_password'), { code: 'EACCES' });
      },
    };
    try {
      resolveSecret(SPEC, {}, io);
      expect.unreachable();
    } catch (error) {
      expect((error as SecretResolutionError).code).toBe('file_unreadable');
      expect((error as SecretResolutionError).field).toBe('DB_PASSWORD');
      expect(String(error)).not.toContain('/run/secrets');
    }
  });
});

describe('resolveSecret: precedence', () => {
  it('prefers NAME_FILE over /run/secrets and over the env value', () => {
    const io = memoryIO({ '/tmp/x': 'from-file', [RUN_PATH]: 'from-run' });
    const env = { DB_PASSWORD_FILE: '/tmp/x', DB_PASSWORD: 'from-env' };
    expect(resolveSecret(SPEC, env, io)).toEqual({ source: 'file', raw: 'from-file' });
  });

  it('prefers /run/secrets over the env value', () => {
    const io = memoryIO({ [RUN_PATH]: 'from-run' });
    expect(resolveSecret(SPEC, { DB_PASSWORD: 'from-env' }, io)).toEqual({
      source: 'run-secret',
      raw: 'from-run',
    });
  });

  it('falls back to the env value when no file source exists', () => {
    expect(resolveSecret(SPEC, { DB_PASSWORD: 'from-env' }, memoryIO({}))).toEqual({
      source: 'env',
      raw: 'from-env',
    });
  });

  it('returns undefined when no source is set', () => {
    expect(resolveSecret(SPEC, {}, memoryIO({}))).toBeUndefined();
  });
});

describe('RedactedSecret', () => {
  it('reveals the raw value only through reveal()', () => {
    expect(new RedactedSecret('s3cr3t-value').reveal()).toBe('s3cr3t-value');
  });

  it('never exposes the value through string, template or JSON serialization', () => {
    const secret = new RedactedSecret('s3cr3t-value');
    expect(String(secret)).toBe('[REDACTED]');
    expect(`${secret}`).toBe('[REDACTED]');
    expect(JSON.stringify(secret)).toBe('"[REDACTED]"');
    expect(JSON.stringify({ nested: { secret } })).not.toContain('s3cr3t-value');
  });
});
