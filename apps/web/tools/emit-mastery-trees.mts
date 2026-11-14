import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MasteryTreeSchema } from '@gd/domain';
import type { MasteryCatalog } from '../src/app/core/content/masteries.ts';
import { createMasteryCatalog } from '../src/app/core/content/masteries.server.ts';

export const MASTERY_TREES_DIR = join('assets', 'mastery-trees');
export const MASTERY_TREES_INDEX = 'index.json';
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const FAILURE = 'mastery-trees inválido: el catálogo no se pudo emitir como estáticos del sitio.';

function fail(): never {
  throw new Error(FAILURE);
}

/**
 * T017 (plan, decisión 9): writes `assets/mastery-trees/<slug>.json` and `index.json` into the
 * artifact from the same catalog the prerender uses. The folder is built aside and swapped in, so
 * a failing source leaves no partial output (and the build fails). Never versioned: it lives in `dist`.
 */
export async function emitMasteryTrees(catalog: MasteryCatalog, output: string): Promise<string[]> {
  try {
    const slugs = await catalog.listSlugs();
    if (slugs.length === 0) fail();
    const files = new Map<string, string>();
    const index: Record<string, string> = {};
    for (const slug of slugs) {
      const tree = await catalog.get(slug);
      if (!tree) fail();
      const valid = MasteryTreeSchema.parse(tree);
      if (valid.mastery.slug !== slug || index[valid.mastery.id] !== undefined) fail();
      index[valid.mastery.id] = slug;
      files.set(`${slug}.json`, JSON.stringify(valid));
    }
    files.set(MASTERY_TREES_INDEX, JSON.stringify(index));
    const target = join(resolve(output), 'browser', MASTERY_TREES_DIR);
    const pending = `${target}.${process.pid}.tmp`;
    await rm(pending, { recursive: true, force: true });
    await mkdir(pending, { recursive: true });
    try {
      for (const [name, text] of files) await writeFile(join(pending, name), `${text}\n`);
      await rm(target, { recursive: true, force: true });
      await mkdir(dirname(target), { recursive: true });
      await rename(pending, target);
    } finally {
      await rm(pending, { recursive: true, force: true });
    }
    return [...files.keys()].sort();
  } catch {
    return fail();
  }
}

async function main(argv: string[]): Promise<number> {
  try {
    if (argv.length && (argv.length !== 2 || argv[0] !== '--dir')) throw new Error();
    const catalog = createMasteryCatalog(join(REPO_ROOT, 'fixtures', 'content'), process.env);
    const written = await emitMasteryTrees(catalog, argv[1] ?? join('dist', 'grim-dawn-builds'));
    console.log(`emit-mastery-trees OK (${written.length} ficheros en ${MASTERY_TREES_DIR}).`);
    return 0;
  } catch {
    console.error(FAILURE);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
