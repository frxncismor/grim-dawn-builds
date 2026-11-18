import { describe, expect, it } from 'vitest';
import { MasterySummarySchema } from './mastery-summary.js';
import type { MasterySummary } from './mastery-summary.js';

const valid: MasterySummary = {
  id: 'class01',
  slug: 'soldier',
  name: { en: 'Soldier', es: 'Soldado' },
  game_version: 'steam-build-25813250',
  node_count: 32,
};

describe('MasterySummarySchema', () => {
  it('accepts a public list entry and keeps every field', () => {
    expect(MasterySummarySchema.parse(valid)).toEqual(valid);
  });

  it('accepts a mastery with zero nodes', () => {
    expect(MasterySummarySchema.safeParse({ ...valid, node_count: 0 }).success).toBe(true);
  });

  it('rejects an extra field (strict)', () => {
    expect(MasterySummarySchema.safeParse({ ...valid, source_sha256: ['a'] }).success).toBe(false);
  });

  it('rejects a negative node_count', () => {
    expect(MasterySummarySchema.safeParse({ ...valid, node_count: -1 }).success).toBe(false);
  });

  it('rejects a non-integer node_count', () => {
    expect(MasterySummarySchema.safeParse({ ...valid, node_count: 1.5 }).success).toBe(false);
  });

  it('rejects an invalid slug', () => {
    expect(MasterySummarySchema.safeParse({ ...valid, slug: 'Bad Slug' }).success).toBe(false);
  });

  it('rejects a missing name translation', () => {
    expect(MasterySummarySchema.safeParse({ ...valid, name: { en: 'Soldier' } }).success).toBe(
      false,
    );
  });
});
