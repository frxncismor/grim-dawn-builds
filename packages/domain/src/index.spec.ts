import { describe, expect, it } from 'vitest';
import * as domain from './index';
import * as vocabulary from './vocabulary';
import pkg from '../package.json' with { type: 'json' };

// Narrow public API of @gd/domain. Adding an export is a deliberate contract change.
const PUBLIC_RUNTIME_EXPORTS = [
  'AssetSchema',
  'BuildSchema',
  'CONTENT_STATUSES',
  'TIERS',
  'TierEntrySchema',
  'checkAssetManifest',
  'publicFilter',
];

describe('@gd/domain public API', () => {
  it('exports exactly the narrow runtime surface', () => {
    expect(Object.keys(domain).sort()).toEqual([...PUBLIC_RUNTIME_EXPORTS].sort());
  });

  it('exposes the vocabulary subpath without validation helpers', () => {
    expect(Object.keys(vocabulary).sort()).toEqual(['CONTENT_STATUSES', 'TIERS']);
    expect(domain.CONTENT_STATUSES).toBe(vocabulary.CONTENT_STATUSES);
    expect(domain.TIERS).toBe(vocabulary.TIERS);
  });
});

describe('@gd/domain boundary', () => {
  it('declares zod as its only runtime dependency (no Angular, HTTP, DB or I/O)', () => {
    expect(Object.keys(pkg.dependencies)).toEqual(['zod']);
  });
});
