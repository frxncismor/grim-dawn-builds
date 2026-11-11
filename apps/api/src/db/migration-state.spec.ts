import { describe, expect, it } from 'vitest';
import { compareMigrations, readExpectedHashes, MIGRATIONS_FOLDER } from './migration-state.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { migrationFingerprint } from './migration-state.js';

it('fingerprints ordered migration hashes with the release v1 recipe', () => {
  const hash = (sql: string) => createHash('sha256').update(sql).digest('hex');
  const input = [hash('SELECT 1;'), hash('SELECT 2;')];
  expect(migrationFingerprint(input)).toBe(
    'd49a6e2052d5cd3c1e01268560b2a6868e0bd670fa4b3ec3c5e5f7ea641b28c6',
  );
  expect(migrationFingerprint([...input].reverse())).not.toBe(migrationFingerprint(input));
  expect(migrationFingerprint([hash('SELECT 1;\n'), input[1]!])).not.toBe(
    migrationFingerprint(input),
  );
  expect(() => migrationFingerprint([])).toThrow();
});

describe('compareMigrations', () => {
  it('includes the public-content migration from the shipped journal without a duplicated hash', () => {
    const journal = JSON.parse(
      readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'),
    ) as {
      entries: { tag: string }[];
    };
    expect(journal.entries.some((entry) => entry.tag === '0002_public_content')).toBe(true);
    const hashes = readExpectedHashes();
    expect(hashes).toHaveLength(journal.entries.length);
    expect(compareMigrations(hashes, hashes.slice(0, -1))).toMatchObject({
      ready: false,
      reason: 'pending',
    });
    expect(compareMigrations(hashes, hashes)).toMatchObject({ ready: true, reason: 'match' });
  });
  it('matches the complete migration history in journal order', () => {
    expect(compareMigrations(['a', 'b'], ['a', 'b'])).toEqual({
      ready: true,
      reason: 'match',
      expected: 2,
      applied: 2,
    });
  });

  it('reports a strict prefix as pending', () => {
    expect(compareMigrations(['a', 'b'], ['a'])).toEqual({
      ready: false,
      reason: 'pending',
      expected: 2,
      applied: 1,
    });
  });

  it.each([
    ['unknown hash', ['x']],
    ['reordered', ['b', 'a']],
    ['too many', ['a', 'b', 'c']],
  ])('reports %s history as a mismatch', (_label, applied) => {
    expect(compareMigrations(['a', 'b'], applied)).toMatchObject({
      ready: false,
      reason: 'mismatch',
    });
  });

  it('matches an empty database when there are no migrations yet', () => {
    expect(compareMigrations([], [])).toMatchObject({ ready: true, reason: 'match' });
  });
});
