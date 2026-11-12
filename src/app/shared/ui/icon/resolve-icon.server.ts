import { AssetSchema } from '@gd/domain';
import { fallbackIcon, isPublicAssetPath, type ResolvedIcon } from './registry';

/** Public descriptor published by `GET /api/v1/assets`: approved art, never its evidence. */
export interface PublicAssetDescriptor {
  readonly slug: string;
  readonly file_path: string | null;
  readonly fallback_svg: string;
  /** Present only when the payload is not the public endpoint (defensive check). */
  readonly status?: 'pending' | 'approved' | 'rejected';
}

/** View-ready icon for one asset slug; the shape the templates consume. */
export interface ResolvedAssetIcon {
  readonly slug: string;
  readonly icon: ResolvedIcon;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FALLBACK_PATTERN = /^src\/assets\/icons\/([a-z0-9-]+)\.svg$/;
/** A payload carrying any of these is an editorial manifest entry, not a public descriptor. */
const PRIVATE_FIELDS = ['proof_ref', 'rights_holder', 'license_or_permission', 'origin_url'];

/**
 * Server-only: resolve provenance before handing the public descriptor to a view.
 *
 * Accepts either an editorial manifest entry (`AssetSchema`, used by internal fixtures) or the
 * public descriptor returned by the assets endpoint. Non-approved status and any descriptor
 * whose declared fallback belongs to another icon fall back to the registered own SVG.
 */
export function resolveIcon(name: string, raw?: unknown): ResolvedIcon {
  const fallback = fallbackIcon(name);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const value = raw as Record<string, unknown>;
  if (value['status'] !== undefined && value['status'] !== 'approved') return fallback;
  try {
    if (PRIVATE_FIELDS.some((field) => field in value)) {
      const asset = AssetSchema.safeParse(raw);
      if (!asset.success) throw new Error();
      return official(fallback, asset.data.file_path, asset.data.fallback_svg);
    }
    const { slug, file_path, fallback_svg } = value;
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) throw new Error();
    if (typeof file_path !== 'string') throw new Error();
    if (typeof fallback_svg !== 'string') throw new Error();
    return official(fallback, file_path, fallback_svg);
  } catch {
    // Schema errors can contain private proof paths; do not preserve their cause.
    throw new Error('Icono aprobado inválido.');
  }
}

/**
 * Server-only consumer of `GET /api/v1/assets`: validates every descriptor with `resolveIcon`
 * and returns deterministic, view-ready icons. A pending or malformed status never yields
 * official art; an approved descriptor with an unusable path fails closed.
 */
export function resolvePublicAssets(
  descriptors: readonly PublicAssetDescriptor[],
): ResolvedAssetIcon[] {
  return descriptors
    .map((descriptor) => {
      const name = FALLBACK_PATTERN.exec(descriptor.fallback_svg)?.[1] ?? 'generic';
      return { slug: descriptor.slug, icon: resolveIcon(name, descriptor) };
    })
    .sort((left, right) => (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0));
}

/** Only the exact own-SVG fallback declared by the descriptor may unlock official art. */
function official(
  fallback: ResolvedIcon,
  filePath: string | null,
  fallbackSvg: string,
): ResolvedIcon {
  if (!filePath?.startsWith('public/')) throw new Error();
  const declared = FALLBACK_PATTERN.exec(fallbackSvg);
  if (!declared || declared[1] !== fallback.id) throw new Error();
  const src = filePath.slice('public/'.length);
  if (!isPublicAssetPath(src)) throw new Error();
  return { id: fallback.id, src, fallbackSrc: fallback.src };
}
