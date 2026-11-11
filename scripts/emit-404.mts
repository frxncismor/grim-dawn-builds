import { lstat, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NOT_FOUND_ARTIFACT = '404.html';
export const NOT_FOUND_SOURCE = join('404', 'index.html');
const FAILURE = `404.html inválido: falta la página 404 prerenderizada en el artefacto.`;

function fail(): never {
  throw new Error(FAILURE);
}

/**
 * Angular 21.2.29 skips the catch-all in the prerender, so `404.html` never reaches the
 * artifact. The same static page is prerendered at `/404` and this guard copies it verbatim:
 * a 200 page, a page without `noindex` or a missing route are rejected instead of faked.
 */
export function assertNotFoundPage(html: string): void {
  if (!/data-not-found/.test(html)) fail();
  if (!/<h1\b[^>]*>[^<]*no encontrada/i.test(html)) fail();
  if (!/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']noindex[, ]/i.test(html)) fail();
  if (/<meta\b[^>]*\bname=["']gd-static-home["']/i.test(html)) fail();
  if (!/<base\b[^>]*\bhref=["']\/["']/i.test(html)) fail();
}

/** Copies the prerendered 404 page to `<artifact>/browser/404.html` after validating it. */
export async function emit404(output: string): Promise<void> {
  const root = resolve(output);
  const browser = join(root, 'browser');
  const source = join(browser, NOT_FOUND_SOURCE);
  const target = join(browser, NOT_FOUND_ARTIFACT);
  const pending = join(browser, `.emit-404-${randomUUID()}.tmp`);
  try {
    for (const path of [root, browser]) {
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail();
    }
    const stat = await lstat(source);
    if (stat.isSymbolicLink() || !stat.isFile()) fail();
    const html = await readFile(source, 'utf8');
    assertNotFoundPage(html);
    await writeFile(pending, html, { flag: 'wx' });
    if (dirname(pending) !== browser) fail();
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
    await emit404(resolve(argv[1] ?? 'dist/grim-dawn-builds'));
    console.log(`emit-404 OK (${NOT_FOUND_ARTIFACT} copiado de la página 404).`);
    return 0;
  } catch {
    console.error(FAILURE);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
