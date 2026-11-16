import { describe, expect, it } from 'vitest';
import { checkAssetManifest, SkillIconAssetSchema, skillIconFilePath } from './asset.js';

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

describe('skill icon manifest entry (spec004 T025: one entry per icon)', () => {
  const ICON_ID = 'ic-0123456789abcdef';
  const SHA = 'a'.repeat(64);
  const icon = (overrides: Record<string, unknown> = {}) => ({
    slug: ICON_ID,
    status: 'approved',
    file_path: skillIconFilePath(ICON_ID),
    origin_url: 'https://store.steampowered.com/app/219990/Grim_Dawn/',
    rights_holder: 'Crate Entertainment',
    license_or_permission: 'tolerancia_de_facto_sin_permiso',
    proof_ref: 'specs/004-rediseno-ui-grim-dawn/research.md#r10',
    recorded_on: '2026-11-15',
    fallback_svg: 'src/assets/icons/skill-generic.svg',
    provenance: {
      game_version: 'steam-build-25813250',
      source_path: 'ui/skills/icons/class01/skillicon_x1up.tex',
      sha256: SHA,
      width: 32,
      height: 32,
    },
    ...overrides,
  });

  it('derives the file path from the icon id, not from a texture path', () => {
    expect(skillIconFilePath(ICON_ID)).toBe('public/assets/skill-icons/ic-0123456789abcdef.png');
  });

  it('accepts a complete approved entry and a pending one without file', () => {
    expect(SkillIconAssetSchema.safeParse(icon()).success).toBe(true);
    expect(
      SkillIconAssetSchema.safeParse(
        icon({
          status: 'pending',
          file_path: null,
          origin_url: null,
          rights_holder: null,
          license_or_permission: null,
          proof_ref: null,
          provenance: undefined,
        }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ['slug that is not an icon id', { slug: 'ui/skills/x.tex' }],
    ['file path off the icon id', { file_path: 'public/assets/skill-icons/other.png' }],
    ['another rights holder', { rights_holder: 'Otro' }],
    ['another licence', { license_or_permission: 'Permiso escrito' }],
    ['proof other than R10', { proof_ref: 'proofs/x.pdf' }],
    ['a missing provenance', { provenance: undefined }],
    [
      'a size other than 32 x 32',
      {
        provenance: { game_version: 'v', source_path: 'a.tex', sha256: SHA, width: 64, height: 64 },
      },
    ],
    ['an empty fallback', { fallback_svg: '' }],
  ])('rejects an approved entry with %s', (_name, overrides) => {
    expect(SkillIconAssetSchema.safeParse(icon(overrides)).success).toBe(false);
  });

  it('is enforced by checkAssetManifest for icon slugs and leaves other assets alone', () => {
    const file = skillIconFilePath(ICON_ID);
    const hashes = { [file]: SHA };
    expect(checkAssetManifest({ assets: [icon()] }, [file], hashes)).toEqual([]);
    const issues = checkAssetManifest(
      { assets: [icon({ rights_holder: 'Otro' })] },
      [file],
      hashes,
    );
    expect(issues.some((i) => i.file === ICON_ID && i.path === 'rights_holder')).toBe(true);
    expect(checkAssetManifest({ assets: [asset()] }, [])).toEqual([]);
  });

  it('flags a file whose sha256 differs from the entry', () => {
    const file = skillIconFilePath(ICON_ID);
    const issues = checkAssetManifest({ assets: [icon()] }, [file], { [file]: 'b'.repeat(64) });
    expect(issues.some((i) => i.path === 'provenance.sha256')).toBe(true);
  });
});
