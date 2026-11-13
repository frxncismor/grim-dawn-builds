// T007 (spec 003): validador del catálogo de árboles de maestría (`pnpm catalog:nodes`, FR-005).
// Valida cada `fixtures/content/mastery-trees/<slug>.json` con `MasteryTreeSchema` (padre
// existente, ids únicos, rejilla sin colisiones, tier creciente desde la raíz, sin ciclos,
// nombres no vacíos) y añade lo que el esquema no cubre: `max_points` dentro del rango del
// juego, nombre de archivo = slug y v1 = 6 maestrías base (SC-001).
//
// Uso: pnpm catalog:nodes [--dir <carpeta>]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MasteryTreeSchema } from '@gd/domain';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DIR = join(REPO_ROOT, 'fixtures', 'content', 'mastery-trees');

/**
 * Rango de `max_points` observado en el juego (research T002 §3): base 16/12/10/8, modificador
 * 12/10/8, transmutador 3 ó 1. Sirve de cota; ampliarla exige una decisión explícita.
 */
export const MAX_POINTS_RANGE = { min: 1, max: 16 } as const;
/** `ultimate_points` observado: `max + 10` como mucho. */
export const ULTIMATE_POINTS_MAX = MAX_POINTS_RANGE.max + 10;

/** Las 6 maestrías base de v1 (`scope_v1=6_maestrias_base`, SC-001). */
export const BASE_MASTERY_IDS = [
  'class01',
  'class02',
  'class03',
  'class04',
  'class05',
  'class06',
] as const;

/** Errores de un árbol ya parseado como JSON; cada mensaje lleva archivo y, si aplica, nodo. */
export function checkTree(data: unknown, file: string): string[] {
  const errors: string[] = [];
  const parsed = MasteryTreeSchema.safeParse(data);
  const nodes: { id?: unknown }[] =
    typeof data === 'object' && data !== null && Array.isArray((data as { nodes?: unknown }).nodes)
      ? (data as { nodes: { id?: unknown }[] }).nodes
      : [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [head, index, ...field] = issue.path;
      const where =
        head === 'nodes' && typeof index === 'number'
          ? `nodo ${String(nodes[index]?.id ?? `#${index}`)}${field.length ? ` (${field.join('.')})` : ''}`
          : issue.path.join('.') || 'árbol';
      errors.push(`${file}: ${where}: ${issue.message}`);
    }
    // Las reglas siguientes asumen la forma del esquema; con forma rota no se apilan más fallos.
    return errors;
  }

  const tree = parsed.data;
  if (basename(file) !== `${tree.mastery.slug}.json`)
    errors.push(`${file}: el nombre del archivo debe ser ${tree.mastery.slug}.json (slug)`);
  for (const n of tree.nodes) {
    if (!n.id.startsWith(`${tree.mastery.id}/`))
      errors.push(`${file}: nodo ${n.id}: el id debe empezar por ${tree.mastery.id}/`);
    if (n.max_points < MAX_POINTS_RANGE.min || n.max_points > MAX_POINTS_RANGE.max)
      errors.push(
        `${file}: nodo ${n.id}: max_points ${n.max_points} fuera del rango del juego ` +
          `${MAX_POINTS_RANGE.min}-${MAX_POINTS_RANGE.max}`,
      );
    if (n.ultimate_points !== undefined && n.ultimate_points > ULTIMATE_POINTS_MAX)
      errors.push(
        `${file}: nodo ${n.id}: ultimate_points ${n.ultimate_points} supera ${ULTIMATE_POINTS_MAX}`,
      );
  }
  return errors;
}

/** Valida todos los `*.json` de una carpeta y la regla de las 6 maestrías base. */
export function checkCatalogDir(dir: string): string[] {
  if (!existsSync(dir)) return [`${dir}: la carpeta del catálogo no existe`];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const errors: string[] = [];
  const masteries: string[] = [];
  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      errors.push(`${file}: JSON inválido: ${(e as Error).message}`);
      continue;
    }
    errors.push(...checkTree(data, file));
    const id = (data as { mastery?: { id?: unknown } } | null)?.mastery?.id;
    if (typeof id === 'string') masteries.push(id);
  }
  const sorted = [...masteries].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(BASE_MASTERY_IDS))
    errors.push(
      `${dir}: v1 exige exactamente las 6 maestrías base (${BASE_MASTERY_IDS.join(', ')}); ` +
        `encontradas: ${sorted.length ? sorted.join(', ') : 'ninguna'}`,
    );
  return errors;
}

function main(): void {
  const args = process.argv.slice(2);
  const i = args.indexOf('--dir');
  const dir = i >= 0 && args[i + 1] ? args[i + 1]! : DEFAULT_DIR;
  const errors = checkCatalogDir(dir);
  if (errors.length) {
    for (const e of errors) console.error(e);
    console.error(`catalog:nodes FALLÓ: ${errors.length} error(es)`);
    process.exit(1);
  }
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const tree = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { nodes: unknown[] };
    console.log(`${file}: ${tree.nodes.length} nodos OK`);
  }
  console.log('catalog:nodes OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
