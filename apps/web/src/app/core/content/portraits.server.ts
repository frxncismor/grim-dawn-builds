import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AssetSchema, type Asset } from '@gd/domain';
import {
  iconFromFallback,
  ownPortrait,
  parseAssetSource,
  type AssetSource,
  type MasteryPortrait,
} from './portraits';

const PERMISSION = 'tolerancia_de_facto_sin_permiso';
const PORTRAIT_PREFIX = 'public/assets/portraits/';
const closed = (why: string) => new Error(`Retrato de maestría inválido: ${why}.`);

/**
 * Picks the portrait of one mastery. `own` never looks at game art. With `game`, only an
 * `approved` entry under `tolerancia_de_facto_sin_permiso` yields the PNG; a missing, pending,
 * rejected or `withdrawn` entry serves the own icon. An approved entry that cannot be served
 * (bad shape, file outside `portraits/`, no usable `fallback_svg`) fails closed (FR-014, §VII).
 */
export function resolveMasteryPortrait(
  slug: string,
  source: AssetSource,
  entries: readonly unknown[],
): MasteryPortrait {
  if (source === 'own') return ownPortrait(slug);
  const raw = entries.find(
    (item) => item && typeof item === 'object' && (item as Asset).slug === `mastery-${slug}`,
  ) as { status?: unknown; license_or_permission?: unknown } | undefined;
  if (!raw || raw.status !== 'approved') return ownPortrait(slug);
  const parsed = AssetSchema.safeParse(raw);
  if (!parsed.success) throw closed(`entrada de ${slug} no válida`);
  const asset = parsed.data;
  if (asset.license_or_permission !== PERMISSION) return ownPortrait(slug);
  const icon = iconFromFallback(asset.fallback_svg);
  if (!icon) throw closed(`${slug} sin fallback propio válido`);
  const file = asset.file_path ?? '';
  if (!file.startsWith(PORTRAIT_PREFIX) || !asset.provenance)
    throw closed(`${slug} sin archivo de retrato con medidas`);
  return {
    source: 'game',
    src: file.slice('public/'.length),
    width: asset.provenance.width,
    height: asset.provenance.height,
  };
}

/**
 * Server only. Reads `ASSET_SOURCE` and, when it is `game`, the committed manifest; the build
 * fails if either is invalid. With `own` a missing manifest is not an error.
 */
export async function createPortraitResolver(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
): Promise<(slug: string) => MasteryPortrait> {
  const source = parseAssetSource(env['ASSET_SOURCE']);
  if (source === 'own') return (slug) => ownPortrait(slug);
  let entries: unknown[];
  try {
    const manifest = JSON.parse(await readFile(join(root, 'assets', 'manifest.json'), 'utf8'));
    if (!Array.isArray(manifest?.assets)) throw new Error();
    entries = manifest.assets;
  } catch {
    throw new Error('ASSET_SOURCE=game requiere un manifiesto de activos legible.');
  }
  return (slug) => resolveMasteryPortrait(slug, source, entries);
}

/** Catalog mastery slug (Spanish) to the slug of its tree and portrait (English). */
const TREE_SLUG: Readonly<Record<string, string>> = {
  arcanista: 'arcanist',
  demoledor: 'demolition',
  'filo-nocturno': 'nightblade',
  ocultista: 'occult',
  chaman: 'shaman',
  soldado: 'soldier',
};

/**
 * Server only (spec004 T042): puts the portrait of its tree on every catalog mastery that has one,
 * so the home and the catalog cards draw it in the prerendered HTML. The others stay without it.
 */
export function withCatalogPortraits<T extends { readonly masteries: readonly { slug: string }[] }>(
  catalog: T,
  portraitOf: (treeSlug: string) => MasteryPortrait,
): T {
  return {
    ...catalog,
    masteries: catalog.masteries.map((m) => {
      const tree = Object.hasOwn(TREE_SLUG, m.slug) ? TREE_SLUG[m.slug] : undefined;
      if (!tree) return m;
      const { src, width, height } = portraitOf(tree);
      return { ...m, portrait: { src, width, height } };
    }),
  } as T;
}
