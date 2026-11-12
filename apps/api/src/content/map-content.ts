import { z } from 'zod';
import {
  PublicAuthorSchema,
  PublicBuildSchema,
  PublicSourceSchema,
  PublicTierListSchema,
  TierEntrySchema,
  publicFilter,
} from '@gd/domain';

export class InvalidContentError extends Error {
  constructor() {
    super('invalid_content');
    this.name = 'InvalidContentError';
  }
}
function valid<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new InvalidContentError();
  return result.data;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidContentError();
  return value as Record<string, unknown>;
}
const StateSchema = z
  .object({
    review_state: PublicBuildSchema.shape.review_state,
    rights_status: PublicBuildSchema.shape.rights_status,
  })
  .strict();
const SlugStateSchema = StateSchema.extend({ slug: PublicBuildSchema.shape.slug });
/**
 * Public asset descriptor: the only asset fields a read-only client may receive. Private
 * provenance (`origin_url`, `rights_holder`, `license_or_permission`, `proof_ref`) is never
 * projected, and the strict object rejects any payload that tries to smuggle it in.
 */
const PUBLIC_ASSET_PATH =
  /^public\/assets\/official\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:svg|png|jpe?g|webp|avif)$/i;
export const PublicAssetDescriptorSchema = z
  .object({
    slug: PublicBuildSchema.shape.slug,
    // Mirrors `isPublicAssetPath` from the web registry: web→api imports are forbidden
    // (plan §12.4), so the same rule is enforced on both sides of the HTTP boundary.
    file_path: z.string().min(1).regex(PUBLIC_ASSET_PATH, 'ruta pública de activo requerida'),
    fallback_svg: z.string().min(1),
  })
  .strict();
export type PublicAssetDescriptor = z.infer<typeof PublicAssetDescriptorSchema>;
const visible = publicFilter(false);
function state(value: Record<string, unknown>) {
  return valid(StateSchema, {
    review_state: value['review_state'],
    rights_status: value['rights_status'],
  });
}

export function mapBuild(value: unknown) {
  const raw = record(value);
  const flags = state(raw);
  if (!visible(flags) || flags.rights_status === 'link_only') return null;
  return valid(PublicBuildSchema, raw);
}
export function mapAuthor(value: unknown) {
  const raw = record(value);
  if (raw['slug'] === 'por-confirmar') return null;
  return valid(PublicAuthorSchema, raw);
}
export function mapSlugs(rows: readonly unknown[]): string[] {
  const entries = rows.map((row) => valid(SlugStateSchema, row));
  return [
    ...new Set(
      entries
        .filter((row) => visible(row) && row.rights_status !== 'link_only')
        .map((row) => row.slug),
    ),
  ].sort();
}
/**
 * Projects one asset row onto the public descriptor. A non-approved status never produces a
 * descriptor, and the projection itself is the privacy boundary: only slug, file path and
 * fallback SVG leave the database layer.
 */
export function mapAsset(value: unknown): PublicAssetDescriptor | null {
  const raw = record(value);
  const status = raw['status'];
  if (status !== undefined && status !== 'approved') return null;
  return valid(PublicAssetDescriptorSchema, {
    slug: raw['slug'],
    file_path: raw['file_path'],
    fallback_svg: raw['fallback_svg'],
  });
}
/** Deterministic descriptors for the approved assets of the public view. */
export function mapAssets(rows: readonly unknown[]): PublicAssetDescriptor[] {
  const assets = rows.map(mapAsset).filter((asset) => asset !== null);
  const unique = new Map(assets.map((asset) => [asset.slug, asset]));
  return [...unique.values()].sort((left, right) =>
    left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0,
  );
}
export function mapTierList(value: unknown, visibleSlugs: readonly string[]) {
  const raw = record(value);
  if (valid(PublicTierListSchema.shape.review_state, raw['review_state']) !== 'publicado')
    return null;
  const guides = new Set(valid(z.array(PublicBuildSchema.shape.slug), visibleSlugs));
  if (!Array.isArray(raw['entries']) || !Array.isArray(raw['sources']))
    throw new InvalidContentError();
  const entries = raw['entries'].flatMap((value) => {
    const candidate = record(value);
    if (!visible(state(candidate))) return [];
    const entry = valid(TierEntrySchema, candidate);
    return entry.build_slug === null || guides.has(entry.build_slug) ? [entry] : [];
  });
  const used = new Set(entries.map((entry) => entry.source_slug));
  const sources = raw['sources']
    .map((source) => valid(PublicSourceSchema, source))
    .filter((source) => used.has(source.slug));
  return valid(PublicTierListSchema, { ...raw, entries, sources });
}
