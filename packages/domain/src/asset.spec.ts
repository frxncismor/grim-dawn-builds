import { describe, expect, it } from 'vitest';
import { checkAssetManifest } from './asset.js';

const asset = (overrides: Record<string, unknown> = {}) => ({
  slug: 'icono-rayo',
  status: 'pending',
  file_path: null,
  origin_url: null,
  rights_holder: null,
  license_or_permission: null,
  proof_ref: null,
  recorded_on: '2026-11-08',
  fallback_svg: 'src/assets/icons/rayo.svg',
  ...overrides,
});

const approved = (overrides: Record<string, unknown> = {}) =>
  asset({
    status: 'approved',
    file_path: 'public/assets/official/rayo.png',
    origin_url: 'https://example.org/rayo.png',
    rights_holder: 'Titular',
    license_or_permission: 'Permiso escrito',
    proof_ref: 'proofs/rayo.pdf',
    ...overrides,
  });

describe('checkAssetManifest', () => {
  it('accepts a manifest with no approved assets', () => {
    expect(checkAssetManifest({ assets: [asset()] }, [])).toEqual([]);
  });

  it('accepts an empty manifest', () => {
    expect(checkAssetManifest({ assets: [] }, [])).toEqual([]);
  });

  it('rejects an approved asset that is missing its provenance', () => {
    const issues = checkAssetManifest({ assets: [approved({ license_or_permission: null })] }, [
      'public/assets/official/rayo.png',
    ]);
    expect(issues.some((i) => i.path === 'license_or_permission')).toBe(true);
  });

  it('rejects an official art file that has no approved manifest entry', () => {
    const issues = checkAssetManifest({ assets: [] }, ['public/assets/official/rayo.png']);
    expect(issues).toEqual([expect.objectContaining({ file: 'public/assets/official/rayo.png' })]);
  });

  it('accepts an official art file that matches an approved entry', () => {
    const issues = checkAssetManifest({ assets: [approved()] }, [
      'public/assets/official/rayo.png',
    ]);
    expect(issues).toEqual([]);
  });

  it('rejects duplicate asset slugs', () => {
    const issues = checkAssetManifest({ assets: [asset(), asset()] }, []);
    expect(issues.some((i) => i.message.includes('duplicado'))).toBe(true);
  });
});
