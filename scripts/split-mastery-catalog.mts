// T007 (spec 003): reparte la salida de `pnpm catalog:extract` (array de árboles) en un JSON
// por maestría, `<dir>/<slug>.json`, para el catálogo versionado en fixtures/content/mastery-trees.
// No toca el extractor. Regenerar:
//   pnpm catalog:extract --game-dir <ruta> --out tmp/all.json
//   pnpm exec tsx scripts/split-mastery-catalog.mts tmp/all.json fixtures/content/mastery-trees
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Escribe un archivo por árbol y devuelve los nombres escritos, ordenados. */
export function splitCatalog(json: string, outDir: string): string[] {
  const trees = JSON.parse(json) as { mastery: { slug: string } }[];
  if (!Array.isArray(trees)) throw new Error('se esperaba un array de árboles de maestría');
  mkdirSync(outDir, { recursive: true });
  const written = trees.map((t) => {
    const name = `${t.mastery.slug}.json`;
    writeFileSync(join(outDir, name), `${JSON.stringify(t, null, 2)}\n`);
    return name;
  });
  return written.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) {
    console.error('uso: split-mastery-catalog.mts <catalogo.json> <carpeta-salida>');
    process.exit(2);
  }
  for (const f of splitCatalog(readFileSync(src, 'utf8'), out)) console.log(`${out}/${f}`);
}
