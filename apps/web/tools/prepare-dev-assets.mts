import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMasteryCatalog } from '../src/app/core/content/masteries.server.ts';
import { emitDeferredStyles } from './emit-deferred-styles.mts';
import { emitMasteryTrees } from './emit-mastery-trees.mts';

const WEB_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');

/** Folder (relative to `apps/web`) that the `development` configuration serves as assets. Ignored by git. */
export const DEV_ASSETS_DIR = '.dev-assets';

/**
 * spec009 T001 (research D1): `ng serve` does not run `emit-static-assets`, so `/assets/deferred.css`
 * and `/assets/mastery-trees/*.json` were answered with the SPA fallback (`index.html`, 200) and the
 * skill tree and devotion map drew without styles in the guide mode. This writes the same two files
 * with the same emitters as the production build into `<output>/browser`, which `angular.json`
 * (`development`) serves. Nothing generated is versioned; the production artifact is untouched.
 * Returns the folder served as assets.
 */
export async function prepareDevAssets(
  webRoot: string,
  repoRoot: string,
  output: string,
): Promise<string> {
  const served = join(resolve(output), 'browser');
  await mkdir(served, { recursive: true });
  const catalog = createMasteryCatalog(join(repoRoot, 'fixtures', 'content'), process.env);
  await emitMasteryTrees(catalog, output);
  await emitDeferredStyles(webRoot, output);
  return served;
}

async function main(): Promise<number> {
  try {
    const served = await prepareDevAssets(WEB_ROOT, REPO_ROOT, join(WEB_ROOT, DEV_ASSETS_DIR));
    console.log(`prepare-dev-assets OK (${served}).`);
    return 0;
  } catch {
    console.error(
      'prepare-dev-assets FALLÓ: no se pudieron generar deferred.css y los árboles de maestría para el servidor de desarrollo.',
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
