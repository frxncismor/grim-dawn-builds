import { lstatSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

/**
 * The single criterion of "valid artifact walk" (spec007 T001, S-001, FR-001/FR-002): no entry under
 * `dir` may be a symlink (folder, file or junction) or anything other than a regular file or folder,
 * because a walk that skips them in silence lets a gate pass on content it never saw. Throws
 * `«<gate>: el artefacto es inválido (enlace o entrada no regular: <dir>/<ruta>)»` on the first one.
 */
export function assertRegularEntries(dir: string, gate: string): void {
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !(entry.isFile() || entry.isDirectory())) {
      const rel = relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/');
      throw new Error(
        `${gate}: el artefacto es inválido (enlace o entrada no regular: ${basename(dir)}/${rel}).`,
      );
    }
  }
}

/**
 * The single criterion of "empty artifact" for every gate that reads prerendered pages
 * (spec006 T001, S4-D1, FR-001/FR-002). Fails closed: a gate that cannot see a page must not pass.
 *
 * Checks that `browserDir` exists and is a real directory (not a file or a symlink), then returns
 * every `.html` under it, nested, in a stable order. Throws `«<gate>: el artefacto está vacío (…)»`
 * naming the cause when the folder is missing, is not a real directory, or holds fewer than
 * `minPages` pages (default 1).
 */
export function prerenderedPages(
  browserDir: string,
  options: { readonly gate: string; readonly minPages?: number },
): string[] {
  const { gate, minPages = 1 } = options;
  let stats;
  try {
    stats = lstatSync(browserDir);
  } catch {
    throw new Error(`${gate}: el artefacto está vacío (sin carpeta browser/ en ${browserDir}).`);
  }
  if (!stats.isDirectory())
    throw new Error(`${gate}: el artefacto está vacío (carpeta browser/ inválida: ${browserDir}).`);
  assertRegularEntries(browserDir, gate);
  const pages = readdirSync(browserDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  if (pages.length < minPages)
    throw new Error(
      pages.length === 0
        ? `${gate}: el artefacto está vacío (ninguna página .html en browser/).`
        : `${gate}: el artefacto está vacío (${pages.length} páginas .html en browser/; se esperan al menos ${minPages}).`,
    );
  return pages;
}
