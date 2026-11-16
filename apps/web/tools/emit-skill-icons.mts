import { copyFile, lstat, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AssetSchema, ICON_ID_PATTERN } from '@gd/domain';
import { assetRoots } from './emit-portraits.mts';

const SKILL_ICONS = join('assets', 'skill-icons');
const PERMISSION = 'tolerancia_de_facto_sin_permiso';
const FAILURE = 'skill-icons inválido: los iconos de habilidad no se pudieron emitir.';

function fail(): never {
  throw new Error(FAILURE);
}

/**
 * spec004 T028 (constitution 1.11.0 §VII, research.md §R10): twin of `emitPortraits` for the game's
 * skill icons (`apps/web/public/assets/skill-icons/<icon_id>.png`). `angular.json` does not copy that
 * folder (T027), so no build carries it by default. Only `ASSET_SOURCE=game` copies the icons whose
 * manifest entry is `approved` under `tolerancia_de_facto_sin_permiso`, into the artifact of every
 * locale; `withdrawn` (or pending) entries are never copied, so a withdrawal removes the file from
 * the artifact in the same change. With `own` the folder is removed if a stale artifact had it.
 * Fails closed: an approved entry without its file, an invalid entry, no approved icon at all or a
 * bad source or artifact throw (the build fails).
 */
export async function emitSkillIcons(
  webRoot: string,
  output: string,
  source: 'own' | 'game',
  manifestFile: string,
): Promise<string[]> {
  try {
    if (source !== 'own' && source !== 'game') fail();
    const browser = join(resolve(output), 'browser');
    const stat = await lstat(browser);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail();
    const roots = await assetRoots(browser);
    for (const root of roots) await rm(join(root, SKILL_ICONS), { recursive: true, force: true });
    if (source === 'own') return [];
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { assets?: unknown };
    if (!Array.isArray(manifest.assets)) fail();
    const approved: { id: string; from: string }[] = [];
    for (const raw of manifest.assets) {
      const slug = (raw as { slug?: unknown } | null)?.slug;
      if (typeof slug !== 'string' || !ICON_ID_PATTERN.test(slug)) continue;
      if ((raw as { status?: unknown }).status !== 'approved') continue;
      const asset = AssetSchema.safeParse(raw);
      if (!asset.success || asset.data.license_or_permission !== PERMISSION) fail();
      if (asset.data.file_path !== `public/assets/skill-icons/${slug}.png`) fail();
      const from = join(resolve(webRoot), 'public', SKILL_ICONS, `${slug}.png`);
      if (!(await lstat(from)).isFile()) fail();
      approved.push({ id: slug, from });
    }
    if (approved.length === 0) fail();
    approved.sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const root of roots) {
      await mkdir(join(root, SKILL_ICONS), { recursive: true });
      for (const { id, from } of approved)
        await copyFile(from, join(root, SKILL_ICONS, `${id}.png`));
    }
    return approved.map(({ id }) => `${id}.png`);
  } catch {
    return fail();
  }
}
