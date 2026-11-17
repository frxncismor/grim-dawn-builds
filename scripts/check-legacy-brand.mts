import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * spec005 T034 (FR-023, FR-026, FR-027): «Grim Dawn Builds» is not the public brand any more. The
 * detector for the post-build gate (`pnpm check:public-build`, prerendered HTML) lives here, outside
 * `apps/web`. `check:boundaries` forbids `apps/web` from importing `scripts`, so `brand.test.mts`
 * (sources, in `test:scripts`) keeps its own copy; `check-legacy-brand.test.mts` keeps both equal.
 */
const OLD_BRAND = /Grim\s+Dawn\s+Builds/;
/** An artifact with this many pages or fewer is not a real prerender (the app has far more routes). */
export const MIN_PRERENDERED_PAGES = 5;

/** Text with markup removed, so «Grim Dawn <span>Builds</span>» or two SVG `<text>` lines are seen as one phrase. */
export function visibleText(source: string): string {
  return source
    .replace(/<x\b[^>]*\/>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

export function hasLegacyBrand(source: string): boolean {
  return OLD_BRAND.test(source) || OLD_BRAND.test(visibleText(source));
}

async function* htmlFiles(dir: string): AsyncGenerator<string> {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield path;
  }
}

/**
 * Fails (never skips) when the built artifact is missing, has {@link MIN_PRERENDERED_PAGES} pages or
 * fewer, or any page still carries the old brand. Returns the number of pages checked.
 */
export async function assertNoLegacyBrand(browserDir: string): Promise<{ pages: number }> {
  const isDir = await stat(browserDir).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (!isDir)
    throw new Error(
      `no hay artefacto compilado en ${browserDir}: ejecuta «pnpm build» antes de esta puerta`,
    );
  const pages: string[] = [];
  for await (const file of htmlFiles(browserDir)) pages.push(file);
  if (pages.length <= MIN_PRERENDERED_PAGES)
    throw new Error(
      `artefacto vacío o incompleto en ${browserDir}: ${pages.length} páginas HTML (se esperan más de ${MIN_PRERENDERED_PAGES})`,
    );
  const offenders: string[] = [];
  for (const file of pages)
    if (hasLegacyBrand(await readFile(file, 'utf8'))) offenders.push(relative(browserDir, file));
  if (offenders.length)
    throw new Error(
      `la marca antigua «Grim Dawn Builds» sigue en el HTML prerrenderizado (${offenders.length}): ${offenders.slice(0, 10).join(', ')}`,
    );
  return { pages: pages.length };
}
