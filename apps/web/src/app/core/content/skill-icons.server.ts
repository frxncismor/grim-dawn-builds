import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifySkillIconEntry, ICON_ID_PATTERN } from '@gd/domain';
import { parseAssetSource } from './portraits';
import type { SkillIconSource } from './skill-icons';

const closed = (why: string) => new Error(`Icono de habilidad inválido: ${why}.`);

/**
 * Decides, for the icons the catalog references, which ones the game art may serve, with the one
 * shared rule `classifySkillIconEntry` (`@gd/domain`, also used by the emitter and the release
 * gate). Every id needs an entry: `approved` is served; `withdrawn` keeps the own symbol. A missing,
 * pending, rejected or invalid entry fails closed (FR-018, FR-019, section VII): the build stops
 * instead of publishing an icon without a manifest entry.
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
    );
    if (!raw) throw closed(`${id} sin entrada en el manifiesto`);
    const verdict = classifySkillIconEntry(raw);
    if (verdict.kind === 'withdrawn') withdrawn.push(id);
    else if (verdict.kind === 'invalid') throw closed(verdict.reason);
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
