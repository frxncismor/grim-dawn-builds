import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMasteryCatalog } from '../src/app/core/content/masteries.server.ts';
import { emitDeferredStyles } from './emit-deferred-styles.mts';
import { emitMasteryTrees, MASTERY_TREES_DIR } from './emit-mastery-trees.mts';

const WEB_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');

/**
 * Own static files generated after the Angular build (T017, T033): the canonical mastery trees and
 * the stylesheet of the deferred components. One entry so `build` and `runRelease` run both, with
 * the same environment (release: API source, no fallback) and the same fail-closed behaviour.
 */
async function main(argv: string[]): Promise<number> {
  try {
    if (argv.length && (argv.length !== 2 || argv[0] !== '--dir')) throw new Error();
    const output = argv[1] ?? join('dist', 'grim-dawn-builds');
    const catalog = createMasteryCatalog(join(REPO_ROOT, 'fixtures', 'content'), process.env);
    const trees = await emitMasteryTrees(catalog, output);
    const styles = await emitDeferredStyles(WEB_ROOT, output);
    console.log(
      `emit-static-assets OK (${trees.length} ficheros en ${MASTERY_TREES_DIR} y ${styles}).`,
    );
    return 0;
  } catch {
    console.error('emit-static-assets FALLÓ: árboles de maestría o hoja de estilos diferidos.');
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
