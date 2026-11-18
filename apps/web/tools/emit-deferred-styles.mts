import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export const DEFERRED_STYLES_FILE = 'deferred.css';
const SOURCE = join('src', 'styles', 'deferred.css');
const FAILURE = 'deferred-styles inválido: no se pudo emitir la hoja de los componentes diferidos.';
const IMPORT = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g;

function fail(): never {
  throw new Error(FAILURE);
}

/** Inlines the `@import`s of the sheet (one level, relative paths only). */
async function bundle(file: string): Promise<string> {
  const source = await readFile(file, 'utf8');
  const parts: string[] = [];
  let last = 0;
  for (const match of source.matchAll(IMPORT)) {
    const target = match[1] ?? '';
    if (!target.startsWith('.')) fail();
    parts.push(source.slice(last, match.index));
    parts.push(await readFile(resolve(dirname(file), target), 'utf8'));
    last = match.index + match[0].length;
  }
  parts.push(source.slice(last));
  return parts.join('\n');
}

/** Conservative minification: no comments, collapsed whitespace, no space around `{ } ; ,`. */
function minify(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .trim();
}

/**
 * T033: the components rendered inside `@defer` blocks have no component styles (the CSP blocks
 * runtime `<style>`); their CSS is emitted as `assets/deferred.css`, a 'self' stylesheet linked by
 * the pages that use them. Written aside and renamed; any failure fails the build.
 */
export async function emitDeferredStyles(webRoot: string, output: string): Promise<string> {
  try {
    const browser = join(resolve(output), 'browser');
    const stat = await lstat(browser);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail();
    const css = minify(await bundle(join(resolve(webRoot), SOURCE)));
    if (css.length === 0 || /@import|:host|::ng-deep/.test(css)) fail();
    const relative = join('assets', DEFERRED_STYLES_FILE);
    const target = join(browser, relative);
    const pending = `${target}.${process.pid}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(pending, `${css}\n`);
      await rename(pending, target);
    } finally {
      await rm(pending, { force: true });
    }
    return relative;
  } catch {
    return fail();
  }
}
