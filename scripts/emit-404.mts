import { lstat, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readArtifactLocales } from './locales.mts';

export const NOT_FOUND_ARTIFACT = '404.html';
export const NOT_FOUND_SOURCE = join('404', 'index.html');
const FAILURE = `404.html inválido: falta la página 404 prerenderizada en el artefacto.`;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(): never {
  throw new Error(FAILURE);
}

/**
 * Angular 21.2.29 skips the catch-all in the prerender, so `404.html` never reaches the
 * artifact. The same static page is prerendered at `/404` and this guard copies it verbatim:
 * a 200 page, a page without `noindex` or a missing route are rejected instead of faked.
 *
 * The title is not matched textually because each configuration regional renders it in its
 * own language: the contract is a non-empty `h1` inside the `data-not-found` section plus the
 * `noindex` and `base` markers that make the page safe at any URL of its locale.
 */
export function assertNotFoundPage(html: string, baseHref = '/'): void {
  if (!/data-not-found/.test(html)) fail();
  if (!/<h1\b[^>]*>[^<]*\S[^<]*<\/h1>/i.test(html)) fail();
  if (!/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']noindex[, ]/i.test(html)) fail();
  if (/<meta\b[^>]*\bname=["']gd-static-home["']/i.test(html)) fail();
  const base = /<base\b[^>]*\bhref=["']([^"']*)["']/i.exec(html);
  if (!base || base[1] !== baseHref) fail();
}

/** Copia la página 404 prerenderizada de cada configuración regional a su `<root>/404.html`. */
export async function emit404(
  output: string,
  locales: readonly (readonly string[])[] = [[]],
): Promise<void> {
  if (locales.length === 0) fail();
  for (const segments of locales) {
    await emitLocale404(output, segments);
  }
}

async function emitLocale404(output: string, segments: readonly string[]): Promise<void> {
  const root = resolve(output);
  const browser = join(root, 'browser');
  const localeRoot = join(browser, ...segments);
  const source = join(localeRoot, NOT_FOUND_SOURCE);
  const target = join(localeRoot, NOT_FOUND_ARTIFACT);
  const pending = join(localeRoot, `.emit-404-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`);
  const baseHref = segments.length === 0 ? '/' : `/${segments.join('/')}/`;
  try {
    for (const path of [root, browser]) {
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail();
    }
    let current = browser;
    for (const segment of segments) {
      current = join(current, segment);
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail();
    }
    const stat = await lstat(source);
    if (stat.isSymbolicLink() || !stat.isFile()) fail();
    const html = await readFile(source, 'utf8');
    assertNotFoundPage(html, baseHref);
    await writeFile(pending, html, { flag: 'wx' });
    if (dirname(pending) !== localeRoot) fail();
    await rename(pending, target);
  } catch (error) {
    if (error instanceof Error && error.message === FAILURE) throw error;
    fail();
  } finally {
    await rm(pending, { force: true });
  }
}

async function main(argv: string[]): Promise<number> {
  try {
    if (argv.length && (argv.length !== 2 || argv[0] !== '--dir')) throw new Error();
    const locales = await readArtifactLocales(REPO_ROOT);
    await emit404(
      resolve(argv[1] ?? 'dist/grim-dawn-builds'),
      locales.map((locale) => locale.segments),
    );
    console.log(
      `emit-404 OK (${NOT_FOUND_ARTIFACT} copiado en ${locales.map((locale) => locale.code).join(', ')}).`,
    );
    return 0;
  } catch {
    console.error(FAILURE);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
