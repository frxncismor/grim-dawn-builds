import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkAssetManifest, classifySkillIconEntry, type AssetIssue } from '@gd/domain';

const WEB_PUBLIC_DIR = 'apps/web/public';
const OFFICIAL_SUBDIR = 'assets';
/** Our own art (frames, textures, fallback icons): not game art, so it needs no manifest entry. */
const OWN_ART_PREFIX = 'public/assets/ui/';
const MANIFEST = 'fixtures/content/assets/manifest.json';

/** Lists every file under the official-art folder, as repo-relative POSIX paths. */
function listOfficialFiles(root: string): string[] {
  const publicRoot = join(root, WEB_PUBLIC_DIR);
  const dir = join(publicRoot, OFFICIAL_SUBDIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(
      (entry) =>
        `public/${relative(publicRoot, join(entry.parentPath, entry.name)).split('\\').join('/')}`,
    )
    .filter((file) => !file.startsWith(OWN_ART_PREFIX));
}

/** sha256 of every official file, keyed by the same repo-relative path the manifest uses. */
function hashFiles(root: string, files: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    files.map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(join(root, 'apps/web', file)))
        .digest('hex'),
    ]),
  );
}

/** Pure of console output: returns the manifest size and every problem found. */
export function checkAssets(root: string): { count: number; issues: AssetIssue[] } {
  let manifest: { assets: unknown[] };
  try {
    manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8')) as { assets: unknown[] };
    if (!Array.isArray(manifest.assets)) throw new Error();
  } catch {
    return { count: 0, issues: [{ file: MANIFEST, message: 'manifiesto ilegible o inválido' }] };
  }
  const files = listOfficialFiles(root);
  return {
    count: manifest.assets.length,
    issues: checkAssetManifest(manifest, files, hashFiles(root, files)),
  };
}

/**
 * Gate for `ASSET_SOURCE=game` (release, CI): the manifest must pass `checkAssets` and every
 * mastery of the catalog must have an `approved` portrait under `tolerancia_de_facto_sin_permiso`.
 * Throws with the reasons; never reads the game.
 */
export function assertGameAssets(root: string): void {
  const { issues } = checkAssets(root);
  const problems = issues.map((i) => `${i.file ?? MANIFEST}: ${i.message}`);
  const trees = join(root, 'fixtures/content/mastery-trees');
  const slugs = existsSync(trees)
    ? readdirSync(trees)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.slice(0, -'.json'.length))
    : [];
  if (slugs.length === 0) problems.push('sin maestrías en el catálogo');
  let entries: { slug?: unknown; status?: unknown; license_or_permission?: unknown }[] = [];
  try {
    const manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8'));
    if (Array.isArray(manifest.assets)) entries = manifest.assets;
  } catch {
    // checkAssets already reported the unreadable manifest.
  }
  for (const slug of slugs) {
    const entry = entries.find((item) => item?.slug === `mastery-${slug}`);
    if (
      entry?.status !== 'approved' ||
      entry.license_or_permission !== 'tolerancia_de_facto_sin_permiso'
    )
      problems.push(`mastery-${slug}: sin retrato aprobado (tolerancia_de_facto_sin_permiso)`);
  }
  // spec004 T028 / T050: every skill icon the catalog references needs an entry that the shared
  // rule `classifySkillIconEntry` (the same as the prerender and the emitter) classifies as
  // `approved` or `withdrawn` (the own symbol is shown); anything else fails closed.
  const iconIds = new Set<string>();
  for (const name of existsSync(trees)
    ? readdirSync(trees).filter((n) => n.endsWith('.json'))
    : []) {
    try {
      const tree = JSON.parse(readFileSync(join(trees, name), 'utf8')) as {
        nodes?: { icon_id?: unknown }[];
      };
      for (const node of tree.nodes ?? [])
        if (typeof node.icon_id === 'string') iconIds.add(node.icon_id);
    } catch {
      problems.push(`${name}: árbol ilegible`);
    }
  }
  for (const id of [...iconIds].sort()) {
    const entry = entries.find((item) => item?.slug === id);
    if (classifySkillIconEntry(entry).kind === 'invalid')
      problems.push(`${id}: sin icono aprobado ni retirado (tolerancia_de_facto_sin_permiso)`);
  }
  if (problems.length > 0)
    throw new Error(`ASSET_SOURCE=game no permitido: ${problems.join('; ')}`);
}

/**
 * T005 (A-03): the repository manifest is the single source of truth for an asset's status and the
 * `assets` table must agree with it. The public view (`/api/v1/assets`) only lists `approved` rows,
 * so "public in the table" means approved there. Any slug that is public on one side and not
 * `approved` on the other (including present on one side only) is a discrepancy: throws, naming the
 * asset and both states. An asset non-approved in the manifest and unpublished in the table agrees.
 */
export function assertAssetStatusParity(
  root: string,
  published: readonly { readonly slug: string }[],
): void {
  const states = new Map<string, string>();
  try {
    const manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8'));
    if (!Array.isArray(manifest.assets)) throw new Error();
    for (const item of manifest.assets as { slug?: unknown; status?: unknown }[])
      if (typeof item?.slug === 'string') states.set(item.slug, String(item.status));
  } catch {
    throw new Error(`estado de activos: ${MANIFEST} ilegible o inválido`);
  }
  const table = new Set(published.map((item) => item.slug));
  const problems: string[] = [];
  for (const slug of [...new Set([...states.keys(), ...table])].sort()) {
    const manifestState = states.get(slug);
    const inTable = table.has(slug);
    if (inTable && manifestState !== 'approved')
      problems.push(`${slug} (tabla assets: approved; manifiesto: ${manifestState ?? 'ausente'})`);
    else if (!inTable && manifestState === 'approved')
      problems.push(`${slug} (tabla assets: no publicado; manifiesto: approved)`);
  }
  if (problems.length > 0)
    throw new Error(
      `El estado de los activos discrepa entre la tabla assets y el manifiesto (manda el manifiesto): ${problems.join('; ')}`,
    );
}

/**
 * Gate of the artifact (S-001, spec004 T028/SC-009): with `ASSET_SOURCE=own` no file of `assets/portraits/`
 * or `assets/skill-icons/` may be in the
 * staging, in the default locale or in any other (`browser/assets/portraits`, `browser/es/…`).
 * The PNGs are the game's art; `own` is the withdrawal path. With `game` there is nothing to check
 * here: `assertGameAssets` already vouches for the manifest and the copy is the emitter's job.
 */
export function assertNoGamePortraits(artifact: string, source: string): void {
  if (source !== 'own') return;
  const found = existsSync(artifact)
    ? readdirSync(artifact, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name).split('\\').join('/'))
        .filter((path) => /\/assets\/(?:portraits|skill-icons)\//.test(path))
    : [];
  if (found.length > 0)
    throw new Error(
      `ASSET_SOURCE=own: el artefacto no puede llevar retratos ni iconos de habilidad del juego (${found.length} ficheros).`,
    );
}

/**
 * Gate of the artifact (T047, F-001/S-001, constitution §VII): the credit to Crate must appear on
 * every prerendered page that draws a game portrait, and only then. With `game`, a page that
 * references `assets/portraits/*.png` without `[data-credit]` fails; with `own`, no page may carry
 * `[data-credit]` (the credit is tied to the game's art).
 */
export function assertPortraitCredit(artifact: string, source: string): void {
  if (source !== 'game' && source !== 'own') return;
  const browser = join(artifact, 'browser');
  if (!existsSync(browser)) return;
  const pages = readdirSync(browser, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
  const problems: string[] = [];
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const rel = relative(browser, page).split(sep).join('/');
    const credited = html.includes('data-credit');
    if (source === 'game' && /assets\/portraits\/[^"'\s]+\.png/.test(html) && !credited)
      problems.push(`${rel} lleva retratos del juego sin [data-credit]`);
    if (source === 'own' && credited)
      problems.push(`${rel} lleva crédito [data-credit] con ASSET_SOURCE=own`);
  }
  if (problems.length > 0)
    throw new Error(`ASSET_SOURCE=${source}: crédito a Crate incoherente: ${problems.join('; ')}.`);
}

function main(root: string): number {
  const { count, issues } = checkAssets(root);
  if (issues.length === 0) {
    console.log(`assets:check OK (${count} entradas)`);
    return 0;
  }
  for (const i of issues) {
    console.error(`${i.file ?? MANIFEST}${i.path ? `: ${i.path}` : ''}: ${i.message}`);
  }
  console.error(`assets:check FALLÓ (${issues.length} problemas)`);
  return 1;
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  process.exitCode = main(resolve('.'));
}
