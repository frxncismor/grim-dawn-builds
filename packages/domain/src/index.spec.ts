import { describe, expect, it } from 'vitest';
import * as domain from './index.js';
import * as vocabulary from './vocabulary.js';
import pkg from '../package.json' with { type: 'json' };

// Narrow public API of @gd/domain. Adding an export is a deliberate contract change.
const PUBLIC_RUNTIME_EXPORTS = [
  'AuthorSchema',
  'PublicAuthorSchema',
  'SourceSchema',
  'PublicSourceSchema',
  'MasterySchema',
  'MasteryCombinationSchema',
  'BuildDocumentSchema',
  'PublicBuildSchema',
  'TierListSchema',
  'PublicTierListSchema',
  'AssetSchema',
  'BuildSchema',
  'CONTENT_STATUSES',
  'TIERS',
  'TierEntrySchema',
  'checkAssetManifest',
  'publicFilter',
  'ADAPTATION_ENTRY_KIND',
  'ADAPTATION_STATES',
  'AdaptationPublicationSchema',
  'BuildAdaptationSchema',
  'EVIDENCE_REQUIREMENT_BY_RIGHTS',
  'EVIDENCE_STATUSES',
  'EVIDENCE_TYPES',
  'PERMISSION_REQUEST_STATUSES',
  'PermissionRequestSchema',
  'SOURCE_CHANGE_OUTCOMES',
  'SOURCE_CHANGE_TYPES',
  'SourceChangeEventSchema',
  'SourceRightsEvidenceSchema',
  'TAKEDOWN_ACTIONS',
  'TakedownEventSchema',
  'TRANSFORMATION_SCOPES',
  'isPermissionGranted',
  'isPublishableRightsStatus',
  'requiredEvidenceType',
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
