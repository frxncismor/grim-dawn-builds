import { describe, expect, it } from 'vitest';
import { AssetSchema, BuildSchema, TierEntrySchema, findParentCycle } from './schema';

// Shapes follow specs/001-mvp-guias-builds/data-model.md (tables builds, tier_entries, assets).
const draftBuild = () => ({
  slug: 'chaman-demoledor-golpe-primigenio',
  locale: 'es',
  title: 'Chamán + Demoledor',
  author_slug: 'por-confirmar',
  source_slugs: ['guia-original'],
  game_version: '1.2.x',
  review_state: 'borrador',
  rights_status: 'pending',
  rights_confirmed_by: null,
  rights_confirmed_on: null,
  content_status: 'sin_verificar',
  reviewed_by: null,
  published_at: null,
  skill_nodes: [
    { slug: 'golpe-primigenio', bar_required: 5, parent_slug: null },
    { slug: 'golpe-atronador', bar_required: 10, parent_slug: 'golpe-primigenio' },
  ],
});

const publishableBuild = () => ({
  ...draftBuild(),
  review_state: 'publicado',
  rights_status: 'own_original',
  rights_confirmed_by: 'titular',
  rights_confirmed_on: '2026-11-08',
  reviewed_by: 'editor-local',
  published_at: '2026-11-08',
  author_slug: 'autor-real',
});

describe('BuildSchema', () => {
  it('accepts a draft build with pending rights', () => {
    expect(BuildSchema.safeParse(draftBuild()).success).toBe(true);
  });

  it('rejects a skill tree whose parents form a cycle', () => {
    const result = BuildSchema.safeParse({
      ...draftBuild(),
      skill_nodes: [
        { slug: 'a', bar_required: 0, parent_slug: 'b' },
        { slug: 'b', bar_required: 0, parent_slug: 'a' },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('ciclo'))).toBe(true);
  });

  it('rejects a negative bar requirement', () => {
    const result = BuildSchema.safeParse({
      ...draftBuild(),
      skill_nodes: [{ slug: 'a', bar_required: -1, parent_slug: null }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts publicado when rights are approved and confirmed', () => {
    expect(BuildSchema.safeParse(publishableBuild()).success).toBe(true);
  });

  it('blocks publicado while rights_status is pending', () => {
    const result = BuildSchema.safeParse({ ...publishableBuild(), rights_status: 'pending' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('rights_status'))).toBe(true);
  });

  it('rejects a rights_status outside the enum', () => {
    expect(BuildSchema.safeParse({ ...draftBuild(), rights_status: 'unknown' }).success).toBe(
      false,
    );
  });

  it('blocks publicado without rights confirmation', () => {
    const result = BuildSchema.safeParse({ ...publishableBuild(), rights_confirmed_by: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('rights_confirmed_by'))).toBe(true);
  });

  it('blocks publicado without reviewer or publication date', () => {
    expect(
      BuildSchema.safeParse({ ...publishableBuild(), reviewed_by: null, published_at: null })
        .success,
    ).toBe(false);
  });

  it('blocks publicado when the author is still the placeholder', () => {
    expect(
      BuildSchema.safeParse({ ...publishableBuild(), author_slug: 'por-confirmar' }).success,
    ).toBe(false);
  });

  it('blocks publicado without at least one source', () => {
    expect(BuildSchema.safeParse({ ...publishableBuild(), source_slugs: [] }).success).toBe(false);
  });
});

describe('findParentCycle', () => {
  it('returns null for an acyclic forest', () => {
    expect(
      findParentCycle([
        { slug: 'a', parent_slug: null },
        { slug: 'b', parent_slug: 'a' },
        { slug: 'c', parent_slug: 'b' },
      ]),
    ).toBeNull();
  });

  it('returns the slugs that take part in a cycle', () => {
    const cycle = findParentCycle([
      { slug: 'x', parent_slug: null },
      { slug: 'a', parent_slug: 'b' },
      { slug: 'b', parent_slug: 'a' },
    ]);
    expect(cycle?.sort()).toEqual(['a', 'b']);
  });
});

describe('TierEntrySchema', () => {
  const placeholder = () => ({
    entry_kind: 'placeholder',
    combination_slug: 'rayo-chaman',
    display_name: 'Rayo + Chamán',
    build_slug: null,
    tier: 'sin_clasificar',
    content_status: 'placeholder',
    rights_status: 'own_original',
    review_state: 'publicado',
    external_url: null,
    external_author: null,
    source_slug: null,
    evaluated_on: null,
  });

  it('accepts a placeholder slot with no tier, guide or link', () => {
    expect(TierEntrySchema.safeParse(placeholder()).success).toBe(true);
  });

  it('rejects a placeholder that carries a tier', () => {
    expect(TierEntrySchema.safeParse({ ...placeholder(), tier: 'S' }).success).toBe(false);
  });

  it('rejects a placeholder that carries an external link', () => {
    expect(
      TierEntrySchema.safeParse({ ...placeholder(), external_url: 'https://example.org/g' })
        .success,
    ).toBe(false);
  });

  it('requires source and evaluation date for any real tier', () => {
    const result = TierEntrySchema.safeParse({
      ...placeholder(),
      entry_kind: 'build_propia',
      build_slug: 'chaman-demoledor-golpe-primigenio',
      tier: 'A',
      content_status: 'sin_verificar',
      rights_status: 'own_original',
      source_slug: null,
      evaluated_on: null,
    });
    expect(result.success).toBe(false);
  });

  it('requires link_only rights, url and author for enlace_externo', () => {
    const base = {
      ...placeholder(),
      entry_kind: 'enlace_externo',
      tier: 'sin_clasificar',
      content_status: 'sin_verificar',
      source_slug: 'fuente-externa',
    };
    expect(TierEntrySchema.safeParse(base).success).toBe(false);
    expect(
      TierEntrySchema.safeParse({
        ...base,
        rights_status: 'link_only',
        external_url: 'https://example.org/guia',
        external_author: 'Autor externo',
      }).success,
    ).toBe(true);
  });
});

describe('AssetSchema', () => {
  const pending = () => ({
    slug: 'icono-rayo',
    status: 'pending',
    file_path: null,
    origin_url: null,
    rights_holder: null,
    license_or_permission: null,
    proof_ref: null,
    recorded_on: '2026-11-08',
    fallback_svg: 'src/assets/icons/rayo.svg',
  });

  it('accepts a pending asset without provenance', () => {
    expect(AssetSchema.safeParse(pending()).success).toBe(true);
  });

  it('rejects an approved asset missing license_or_permission', () => {
    const result = AssetSchema.safeParse({
      ...pending(),
      status: 'approved',
      file_path: 'public/assets/rayo.png',
      origin_url: 'https://example.org/rayo.png',
      rights_holder: 'Titular',
      license_or_permission: null,
      proof_ref: 'proofs/rayo.pdf',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('license_or_permission'))).toBe(true);
  });

  it('accepts an approved asset with every provenance field', () => {
    expect(
      AssetSchema.safeParse({
        ...pending(),
        status: 'approved',
        file_path: 'public/assets/rayo.png',
        origin_url: 'https://example.org/rayo.png',
        rights_holder: 'Titular',
        license_or_permission: 'Permiso escrito',
        proof_ref: 'proofs/rayo.pdf',
      }).success,
    ).toBe(true);
  });
});
