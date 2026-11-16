import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMasteryCatalog } from '../src/app/core/content/masteries.server.ts';
import { emitDeferredStyles } from './emit-deferred-styles.mts';
import { emitMasteryTrees, MASTERY_TREES_DIR } from './emit-mastery-trees.mts';
import { emitPortraits } from './emit-portraits.mts';
import { emitSkillIcons } from './emit-skill-icons.mts';

const WEB_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');

/**
 * Own static files generated after the Angular build (T017, T033, T036): the canonical mastery trees,
 * the stylesheet of the deferred components and, only with `ASSET_SOURCE=game`, the game's mastery
 * buttons and skill icons (S-001, spec004 T028: `angular.json` does not copy them; the default source is `own`, §VII). One entry so `build` and `runRelease` run both, with
 * the same environment (release: API source, no fallback) and the same fail-closed behaviour.
 */
async function main(argv: string[]): Promise<number> {
  try {
    if (argv.length && (argv.length !== 2 || argv[0] !== '--dir')) throw new Error();
    const output = argv[1] ?? join('dist', 'grim-dawn-builds');
    const catalog = createMasteryCatalog(join(REPO_ROOT, 'fixtures', 'content'), process.env);
    const trees = await emitMasteryTrees(catalog, output);
    const styles = await emitDeferredStyles(WEB_ROOT, output);
    const source = process.env['ASSET_SOURCE'] ?? 'own';
    if (source !== 'own' && source !== 'game') throw new Error();
    const portraits = await emitPortraits(WEB_ROOT, output, source);
    const skillIcons = await emitSkillIcons(
      WEB_ROOT,
      output,
      source,
      join(REPO_ROOT, 'fixtures', 'content', 'assets', 'manifest.json'),
    );
    console.log(
      `emit-static-assets OK (${trees.length} ficheros en ${MASTERY_TREES_DIR}, ${styles}, ${portraits.length} retratos y ${skillIcons.length} iconos de habilidad con ASSET_SOURCE=${source}).`,
    );
    return 0;
  } catch {
    console.error(
      'emit-static-assets FALLÓ: árboles de maestría, hoja de estilos diferidos, retratos o iconos de habilidad.',
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
