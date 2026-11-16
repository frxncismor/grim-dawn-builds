import { describe, expect, it } from 'vitest';
import { formatLongDateUtc } from './long-date';

describe('formatLongDateUtc (spec005 T011, S4-D5)', () => {
  it('writes the long UTC date in the UI language', () => {
    expect(formatLongDateUtc('en', '2026-11-09')).toBe('November 9, 2026');
    expect(formatLongDateUtc('es', '2026-11-09')).toBe('9 de noviembre de 2026');
    expect(formatLongDateUtc('es-419', '2026-03-05')).toBe('5 de marzo de 2026');
  });

  it('does not move the day with the time zone of the host', () => {
    expect(formatLongDateUtc('en', '2026-01-01')).toBe('January 1, 2026');
    expect(formatLongDateUtc('en', '2026-12-31')).toBe('December 31, 2026');
  });

  it('returns null, never a placeholder, for an absent or invalid date', () => {
    for (const value of [null, undefined, '', 'not-a-date', '2026-13-40', '9 de noviembre'])
      expect(formatLongDateUtc('en', value)).toBeNull();
  });
});
