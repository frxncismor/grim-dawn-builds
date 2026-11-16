import { describe, expect, it } from 'vitest';
import * as domain from './index.js';
import {
  SEED_ERROR_CODES,
  bootstrapCompleteLine,
  failurePattern,
  isSeedErrorCode,
  seedCompleteLine,
  successPattern,
} from './seed-contract.js';

describe('seed contract', () => {
  it('enumerates exactly the codes of contracts/seed-contract.md', () => {
    expect([...SEED_ERROR_CODES].sort()).toEqual(
      [
        'already',
        'bootstrapped',
        'column',
        'conflicting-resource',
        'configuration-or-database',
        'credentials',
        'database-failed',
        'database-result',
        'duplicate',
        'environment',
        'fixture-read',
        'invalid-content',
        'migration',
        'not-empty',
        'owned-content',
        'reference',
        'role',
        'table',
      ].sort(),
    );
    expect(new Set(SEED_ERROR_CODES).size).toBe(SEED_ERROR_CODES.length);
  });

  it('recognises every code and nothing else', () => {
    for (const code of SEED_ERROR_CODES) expect(isSeedErrorCode(code)).toBe(true);
    for (const other of ['local-container', 'Invalid-Content', '', 'x', 3, null, undefined])
      expect(isSeedErrorCode(other)).toBe(false);
  });

  it('accepts its own success lines and rejects truncated or foreign ones', () => {
    const seed = seedCompleteLine({ builds: 3, tierLists: 2, masteries: 12, nodes: 140 });
    const boot = bootstrapCompleteLine({ builds: 3, tierLists: 2 });
    expect(successPattern('seed').test(seed)).toBe(true);
    expect(successPattern('seed').test(`${seed}\n`)).toBe(true);
    expect(successPattern('bootstrap').test(boot)).toBe(true);
    expect(successPattern('seed').test(boot)).toBe(false);
    expect(successPattern('bootstrap').test(seed)).toBe(false);
    expect(successPattern('seed').test(seed.slice(0, -2))).toBe(false);
    expect(successPattern('seed').test('seed complete: 3 builds')).toBe(false);
    expect(successPattern('bootstrap').test(boot.replace('2 tier', 'x tier'))).toBe(false);
    expect(successPattern('seed').test(`noise\n${seed}`)).toBe(false);
  });

  it('matches a failure line for each code and operation, capturing the code', () => {
    for (const operation of ['seed', 'bootstrap'] as const)
      for (const code of SEED_ERROR_CODES)
        expect(failurePattern(operation).exec(`${operation} failed: ${code}\n`)?.[1]).toBe(code);
  });

  it('does not match unknown codes, prefixes or the other operation', () => {
    expect(failurePattern('seed').test('seed failed: mystery')).toBe(false);
    expect(failurePattern('seed').test('seed failed: role-x')).toBe(false);
    expect(failurePattern('seed').test('bootstrap failed: role')).toBe(false);
    expect(failurePattern('seed').test('seed failed: ')).toBe(false);
  });

  it('is exported from the package entry', () => {
    expect(domain.SEED_ERROR_CODES).toBe(SEED_ERROR_CODES);
    expect(domain.CONTENT_MOUNT).toBe('/content');
    expect(domain.successPattern).toBe(successPattern);
  });
});
