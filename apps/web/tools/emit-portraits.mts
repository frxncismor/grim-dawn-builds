import { copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const PORTRAITS = join('assets', 'portraits');
const FAILURE = 'portraits inválido: los botones de maestría no se pudieron emitir.';

function fail(): never {
  throw new Error(FAILURE);
}

/** `<output>/browser` and each locale folder next to it (`browser/es`): the app serves `assets/…` under its own base. */
export async function assetRoots(browser: string): Promise<string[]> {
  const roots = [browser];
  for (const entry of await readdir(browser, { withFileTypes: true }))
    if (entry.isDirectory() && entry.name !== 'assets') {
      try {
        if ((await lstat(join(browser, entry.name, 'assets'))).isDirectory())
          roots.push(join(browser, entry.name));
      } catch {
        // Not a locale folder.
      }
    }
  return roots;
}

/**
 * S-001 (spec 003 T036): the game's mastery buttons (`apps/web/public/assets/portraits/*.png`) are
 * not in the Angular asset glob (`angular.json` ignores them), so no build carries them by default.
 * Only `ASSET_SOURCE=game` copies them here, into the artifact of every locale. With `own` the
 * folder is removed if a stale artifact had it, so an `own` artifact never contains game art.
 */
export async function emitPortraits(
  webRoot: string,
  output: string,
  source: 'own' | 'game',
): Promise<string[]> {
  try {
    if (source !== 'own' && source !== 'game') fail();
    const browser = join(resolve(output), 'browser');
    const stat = await lstat(browser);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail();
    const roots = await assetRoots(browser);
    for (const root of roots) await rm(join(root, PORTRAITS), { recursive: true, force: true });
    if (source === 'own') return [];
    const from = join(resolve(webRoot), 'public', PORTRAITS);
    const files = (await readdir(from, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
      .map((entry) => entry.name)
      .sort();
    if (files.length === 0) fail();
    for (const root of roots) {
      await mkdir(join(root, PORTRAITS), { recursive: true });
      for (const name of files) await copyFile(join(from, name), join(root, PORTRAITS, name));
    }
    return files;
  } catch {
    return fail();
  }
}
