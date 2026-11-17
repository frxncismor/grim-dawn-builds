import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
