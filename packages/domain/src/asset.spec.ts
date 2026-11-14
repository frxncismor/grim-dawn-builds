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

  it('reports one duplicate issue per extra entry and names the repeated slug', () => {
    const issues = checkAssetManifest({ assets: [asset(), asset(), asset()] }, []);
    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.file === 'icono-rayo')).toBe(true);
    expect(issues[0]?.message).toBe('slug duplicado: icono-rayo');
  });

  it('attributes every issue of an invalid entry to its slug and field path', () => {
    const issues = checkAssetManifest({ assets: [{ slug: 'MAL', status: 'nope' }] }, []);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.file === 'MAL')).toBe(true);
    expect(issues.map((issue) => issue.path)).toContain('status');
  });

  it('reports every missing provenance field of an approved entry', () => {
    const issues = checkAssetManifest({ assets: [{ ...asset(), status: 'approved' }] }, []);
    expect(issues.map((issue) => issue.path).sort()).toEqual([
      'file_path',
      'license_or_permission',
      'origin_url',
      'proof_ref',
      'rights_holder',
    ]);
  });

  it('falls back to a placeholder label when the invalid entry has no usable slug', () => {
    const raws: unknown[] = [null, undefined, 0, '', 'texto', {}, { slug: 7 }, { slug: null }];
    for (const raw of raws) {
      const issues = checkAssetManifest({ assets: [raw] }, []);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((issue) => issue.file === '(sin slug)')).toBe(true);
    }
  });

  it('keeps scanning after an invalid entry', () => {
    const issues = checkAssetManifest({ assets: [{ slug: 'MAL' }, approved()] }, [
      'public/assets/official/rayo.png',
    ]);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.file === 'MAL')).toBe(true);
  });

  it('names the unapproved official file in its message', () => {
    const issues = checkAssetManifest({ assets: [] }, ['public/assets/official/rayo.png']);
    expect(issues).toEqual([
      {
        file: 'public/assets/official/rayo.png',
        message: 'arte oficial sin entrada aprobada en el manifiesto',
      },
    ]);
  });

  describe('file hashes (provenance)', () => {
    const FILE = 'public/assets/official/rayo.png';
    const SHA = 'b'.repeat(64);
    const withProvenance = (sha = SHA) =>
      approved({
        provenance: {
          game_version: 'v1',
          source_path: 'ui/x.tex',
          sha256: sha,
          width: 1,
          height: 1,
        },
      });

    it('accepts a file whose hash matches the manifest', () => {
      expect(checkAssetManifest({ assets: [withProvenance()] }, [FILE], { [FILE]: SHA })).toEqual(
        [],
      );
    });

    it('reports a file that differs from the recorded sha256', () => {
      const issues = checkAssetManifest({ assets: [withProvenance()] }, [FILE], {
        [FILE]: 'c'.repeat(64),
      });
      expect(issues).toEqual([
        {
          file: 'icono-rayo',
          path: 'provenance.sha256',
          message: expect.stringContaining('sha256'),
        },
      ]);
    });

    it('reports an approved asset whose file is not on disk', () => {
      const issues = checkAssetManifest({ assets: [withProvenance()] }, [], {});
      expect(issues.map((i) => i.path)).toEqual(['file_path']);
    });

    it('does not check hashes when none are supplied', () => {
      expect(checkAssetManifest({ assets: [withProvenance()] }, [FILE])).toEqual([]);
    });

    it('lets a withdrawn entry (no file) pass', () => {
      expect(checkAssetManifest({ assets: [asset({ status: 'withdrawn' })] }, [], {})).toEqual([]);
    });
  });
});
