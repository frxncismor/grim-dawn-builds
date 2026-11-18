import { lstatSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

/** One entry of an artifact walk: `rel` is POSIX and relative to the walked root. */
export interface ArtifactEntry {
  readonly rel: string;
  readonly path: string;
  readonly isFile: boolean;
  /** A real file or folder; a symlink (folder, file or junction) or anything else is not. */
  readonly regular: boolean;
}

/**
 * The single read of an artifact (spec008 T002, S-003 = A-002, FR-001): the only
 * `readdirSync(dir, { recursive: true, withFileTypes: true })` of this module. Every check of a gate
 * derives from the entries it returns, so no gate reads the directory twice nor examines what it
 * did not validate.
 */
export function readArtifactEntries(dir: string): ArtifactEntry[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true }).map((entry) => {
    const path = join(entry.parentPath, entry.name);
    return {
      rel: relative(dir, path).split(sep).join('/'),
      path,
      isFile: entry.isFile() && !entry.isSymbolicLink(),
      regular: !entry.isSymbolicLink() && (entry.isFile() || entry.isDirectory()),
    };
  });
}

/** The entries under `prefix/` (a folder of the walked root), with `rel` relative to that folder. */
export function entriesUnder(entries: readonly ArtifactEntry[], prefix: string): ArtifactEntry[] {
  return entries
    .filter((entry) => entry.rel.startsWith(`${prefix}/`))
    .map((entry) => ({ ...entry, rel: entry.rel.slice(prefix.length + 1) }));
}

/**
 * The single criterion of "valid artifact walk" (spec007 T001, S-001, FR-001/FR-002): no entry under
 * `dir` may be a symlink (folder, file or junction) or anything other than a regular file or folder,
 * because a walk that skips them in silence lets a gate pass on content it never saw. Throws
 * `«<gate>: el artefacto es inválido (enlace o entrada no regular: <dir>/<ruta>)»` on the first one.
 * The message is built here and nowhere else.
 */
export function assertRegularArtifact(
  entries: readonly ArtifactEntry[],
  dir: string,
  gate: string,
): void {
  const bad = entries.find((entry) => !entry.regular);
  if (bad)
    throw new Error(
      `${gate}: el artefacto es inválido (enlace o entrada no regular: ${basename(dir)}/${bad.rel}).`,
    );
}

/** Checks `browser/` exists and is a real directory (not a file or a symlink); fails closed (spec006). */
export function assertBrowserDir(browserDir: string, gate: string): void {
  let stats;
  try {
    stats = lstatSync(browserDir);
  } catch {
    throw new Error(`${gate}: el artefacto está vacío (sin carpeta browser/ en ${browserDir}).`);
  }
  if (!stats.isDirectory())
    throw new Error(`${gate}: el artefacto está vacío (carpeta browser/ inválida: ${browserDir}).`);
}

/** The `.html` pages of a walk, in a stable order, failing closed below `minPages` (default 1). */
export function htmlPagesOf(
  entries: readonly ArtifactEntry[],
  options: { readonly gate: string; readonly minPages?: number },
): string[] {
  const { gate, minPages = 1 } = options;
  const pages = entries
    .filter((entry) => entry.isFile && entry.rel.endsWith('.html'))
    .map((entry) => entry.path)
    .sort();
  if (pages.length < minPages)
    throw new Error(
      pages.length === 0
        ? `${gate}: el artefacto está vacío (ninguna página .html en browser/).`
        : `${gate}: el artefacto está vacío (${pages.length} páginas .html en browser/; se esperan al menos ${minPages}).`,
    );
  return pages;
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
  const { gate } = options;
  assertBrowserDir(browserDir, gate);
  const entries = readArtifactEntries(browserDir);
  assertRegularArtifact(entries, browserDir, gate);
  return htmlPagesOf(entries, options);
}
