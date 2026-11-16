import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ICON_ID_PATTERN, SkillIconAssetSchema } from '@gd/domain';
import { parseAssetSource } from './portraits';
import type { SkillIconSource } from './skill-icons';

const PERMISSION = 'tolerancia_de_facto_sin_permiso';
const closed = (why: string) => new Error(`Icono de habilidad inválido: ${why}.`);

/**
 * Decides, for the icons the catalog references, which ones the game art may serve. Every id needs
 * an entry: `approved` under `tolerancia_de_facto_sin_permiso` (valid per `SkillIconAssetSchema`) is
 * served; `withdrawn` keeps the own symbol. A missing, pending, rejected or invalid entry fails
 * closed (FR-018, FR-019, section VII): the build stops instead of publishing an icon without a
 * manifest entry.
 */
export function resolveSkillIconSource(
  iconIds: readonly string[],
  entries: readonly unknown[],
): SkillIconSource {
  const withdrawn: string[] = [];
  for (const id of [...new Set(iconIds)].sort()) {
    if (!ICON_ID_PATTERN.test(id)) throw closed(`${id} no es un icon_id`);
    const raw = entries.find(
      (item) => item && typeof item === 'object' && (item as { slug?: unknown }).slug === id,
    ) as { status?: unknown } | undefined;
    if (!raw) throw closed(`${id} sin entrada en el manifiesto`);
    if (raw.status === 'withdrawn') {
      withdrawn.push(id);
      continue;
    }
    if (raw.status !== 'approved') throw closed(`${id} sin aprobar`);
    const parsed = SkillIconAssetSchema.safeParse(raw);
    if (!parsed.success || parsed.data.license_or_permission !== PERMISSION)
      throw closed(`entrada de ${id} no válida`);
  }
  return { source: 'game', withdrawn };
}

/**
 * Server only. Reads `ASSET_SOURCE`; with `own` returns `null` and never opens the manifest. With
 * `game` it reads the committed manifest and the icons of the catalog; either failing stops the
 * build.
 */
export async function createSkillIconSource(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
  catalogIconIds: () => Promise<readonly string[]>,
): Promise<SkillIconSource | null> {
  if (parseAssetSource(env['ASSET_SOURCE']) === 'own') return null;
  let entries: unknown[];
  try {
    const manifest = JSON.parse(await readFile(join(root, 'assets', 'manifest.json'), 'utf8'));
    if (!Array.isArray(manifest?.assets)) throw new Error();
    entries = manifest.assets;
  } catch {
    throw new Error('ASSET_SOURCE=game requiere un manifiesto de activos legible.');
  }
  return resolveSkillIconSource(await catalogIconIds(), entries);
}
