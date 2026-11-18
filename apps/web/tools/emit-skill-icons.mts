import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { classifySkillIconEntry, ICON_ID_PATTERN } from '@gd/domain';
import type { MasteryCatalog } from '../src/app/core/content/masteries.ts';
import { assetRoots } from './emit-portraits.mts';

const SKILL_ICONS = join('assets', 'skill-icons');
const FAILURE = 'skill-icons inválido: los iconos de habilidad no se pudieron emitir.';

function fail(): never {
  throw new Error(FAILURE);
}

/** Every `icon_id` the catalog's skill nodes reference (the same ones the prerender resolves). */
export async function catalogIconIds(catalog: MasteryCatalog): Promise<string[]> {
  const ids: string[] = [];
  for (const slug of await catalog.listSlugs())
    for (const node of (await catalog.get(slug))?.nodes ?? [])
      if (node.icon_id) ids.push(node.icon_id);
  return ids;
}

/**
 * spec004 T028 / T050: twin of `emitPortraits` for the game's skill icons
 * (`apps/web/public/assets/skill-icons/<icon_id>.png`). `angular.json` does not copy that folder
 * (T027), so no build carries it by default. Only `ASSET_SOURCE=game` copies, into the artifact of
 * every locale, the servable set: the `iconIds` the catalog references whose manifest entry
 * `classifySkillIconEntry` (`@gd/domain`, the rule the prerender and the release gate share) says
 * is `approved`, after checking that the PNG matches its manifest sha256. `withdrawn` entries are
 * never copied, so a withdrawal removes the file from the artifact in the same change, and an
 * approved icon no node references is not emitted. With `own` the folder is removed if a stale
 * artifact had it. Fails closed: a referenced icon without entry or with an invalid one, an
 * approved entry without its file or with another sha256, no servable icon at all or a bad source
 * or artifact throw (the build fails).
 */
export async function emitSkillIcons(
  webRoot: string,
  output: string,
  source: 'own' | 'game',
  manifestFile: string,
  iconIds: readonly string[],
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
    // An empty catalog (no icon_id at all) is a wiring error; all `withdrawn` is not (T053, C-001).
    if (iconIds.length === 0) fail();
    const approved: { id: string; from: string }[] = [];
    for (const id of [...new Set(iconIds)].sort()) {
      if (!ICON_ID_PATTERN.test(id)) fail();
      const raw = manifest.assets.find(
        (item) => item && typeof item === 'object' && (item as { slug?: unknown }).slug === id,
      );
      const verdict = classifySkillIconEntry(raw);
      if (verdict.kind === 'invalid') fail();
      if (verdict.kind === 'withdrawn') continue;
      const from = join(resolve(webRoot), verdict.filePath);
      if (!(await lstat(from)).isFile()) fail();
      const sha = createHash('sha256')
        .update(await readFile(from))
        .digest('hex');
      if (sha !== verdict.sha256) fail();
      approved.push({ id, from });
    }
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
