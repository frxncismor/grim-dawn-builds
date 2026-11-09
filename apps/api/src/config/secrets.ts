import { z } from 'zod';
import { ConfigError, type ConfigIssue } from './errors.js';
import {
  RedactedSecret,
  fsSecretIO,
  resolveSecret,
  SecretResolutionError,
} from './secret-source.js';
import type { SecretIO, SecretSpec } from './secret-source.js';

/**
 * Values that are never accepted as real secrets (placeholders from examples and
 * docs). Compared case-insensitively after trimming.
 */
export const PROHIBITED_SECRET_VALUES: ReadonlySet<string> = new Set([
  'changeme',
  'change_me',
  'change-me',
  'password',
  'passwd',
  'secret',
  'postgres',
  'example',
  'placeholder',
  'replace_me',
  'replace-me',
  'todo',
  'null',
  'undefined',
]);

/**
 * Zod rule for a secret value. Issue messages are stable codes (`empty`, `blank`,
 * `prohibited`), never the value, so ZodError output stays redacted.
 */
export const SecretValueSchema = z.string().superRefine((value, ctx) => {
  if (value.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'empty' });
    return;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    ctx.addIssue({ code: 'custom', message: 'blank' });
    return;
  }
  if (PROHIBITED_SECRET_VALUES.has(trimmed.toLowerCase())) {
    ctx.addIssue({ code: 'custom', message: 'prohibited' });
  }
});

/** Validated secrets keyed by SecretSpec.key. Optional secrets that are unset are absent. */
export type SecretConfig = Readonly<Record<string, RedactedSecret>>;

/**
 * Resolves and validates every declared secret. Collects all problems before throwing
 * one ConfigError that names each field (no values). Returns redacted secrets only.
 */
export function loadSecrets(
  specs: readonly SecretSpec[],
  env: Readonly<Record<string, string | undefined>>,
  io: SecretIO = fsSecretIO,
): SecretConfig {
  const issues: ConfigIssue[] = [];
  const secrets: Record<string, RedactedSecret> = {};

  for (const spec of specs) {
    let resolved: ReturnType<typeof resolveSecret>;
    try {
      resolved = resolveSecret(spec, env, io);
    } catch (error) {
      if (error instanceof SecretResolutionError) {
        issues.push({ field: error.field, code: error.code });
        continue;
      }
      throw error;
    }

    if (resolved === undefined) {
      if (spec.required) issues.push({ field: spec.env, code: 'required' });
      continue;
    }

    const parsed = SecretValueSchema.safeParse(resolved.raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({ field: spec.env, code: issue.message });
      }
      continue;
    }
    secrets[spec.key] = new RedactedSecret(parsed.data);
  }

  if (issues.length > 0) throw new ConfigError(issues);
  return secrets;
}
