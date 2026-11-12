import { AssetSchema } from '@gd/domain';
import { fallbackIcon, isPublicAssetPath, type ResolvedIcon } from './registry';

/** Server-only: resolve provenance before handing the public descriptor to a view. */
export function resolveIcon(name: string, raw?: unknown): ResolvedIcon {
  const fallback = fallbackIcon(name);
  if (!raw || typeof raw !== 'object' || !('status' in raw) || raw.status !== 'approved')
    return fallback;
  try {
    const asset = AssetSchema.safeParse(raw);
    if (!asset.success || !asset.data.file_path?.startsWith('public/')) throw new Error();
    const src = asset.data.file_path.slice('public/'.length);
    if (!isPublicAssetPath(src)) throw new Error();
    return { id: fallback.id, src, fallbackSrc: fallback.src };
  } catch {
    // Schema errors can contain private proof paths; do not preserve their cause.
    throw new Error('Icono aprobado inválido.');
  }
}
