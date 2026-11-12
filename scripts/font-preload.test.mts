import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * T-161 regression guard. The font preloads in `src/index.html` must be
 * independent of the locale `<base href>` and must request the same URL as the
 * matching `@font-face` in `src/styles/fonts.css`.
 *
 * Angular i18n serves the same document per locale: `<base href="/">` in English
 * and `<base href="/es/">` in Spanish. A relative preload like `fonts/x.woff2`
 * therefore resolves to `/fonts/x.woff2` in English but `/es/fonts/x.woff2` in
 * Spanish, while the `@font-face` always asks for `/fonts/x.woff2`. The preload
 * then warms an unused locale copy, the real font arrives after first paint and
 * the `font-display: swap` reflow shifted the hero (CLS 0.0369 locally, 0.184 and
 * 0.181 in CI against a 0.05 budget).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_HTML = resolve(ROOT, 'apps', 'web', 'src', 'index.html');
const FONTS_CSS = resolve(ROOT, 'apps', 'web', 'src', 'styles', 'fonts.css');

/** Root-absolute, so the same href resolves identically under any `<base href>`. */
const BASE_INDEPENDENT = /^\/(?!\/)[\w./-]+$/;
const FONT_FACE = /@font-face\s*{[^}]*}/g;
const URL_SOURCE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

function attributes(tag: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of tag.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g))
    found.set(match[1].toLowerCase(), match[2]);
  return found;
}

/** Every `<link rel="preload" as="font">` href of a document, in order. */
function fontPreloads(html: string): string[] {
  const hrefs: string[] = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const tagAttributes = attributes(tag);
    const rel = (tagAttributes.get('rel') ?? '').toLowerCase().split(/\s+/);
    if (!rel.includes('preload') || (tagAttributes.get('as') ?? '').toLowerCase() !== 'font')
      continue;
    hrefs.push(tagAttributes.get('href') ?? '');
  }
  return hrefs;
}

/** Every `src: url(...)` declared by an `@font-face` block, in order. */
function fontFaceSources(css: string): string[] {
  const sources: string[] = [];
  for (const [block] of css.matchAll(FONT_FACE))
    for (const [, url] of block.matchAll(URL_SOURCE)) sources.push(url);
  return sources;
}

/** Empty when the contract holds; each entry explains one way it is broken. */
function preloadProblems(html: string, css: string): string[] {
  const problems: string[] = [];
  const preloads = fontPreloads(html);
  const sources = fontFaceSources(css);
  if (preloads.length === 0) problems.push('src/index.html no declara ningún preload de fuente');
  if (sources.length === 0) problems.push('src/styles/fonts.css no declara ningún @font-face');
  for (const href of preloads) {
    if (!BASE_INDEPENDENT.test(href))
      problems.push(`preload no es independiente de <base href>: ${href}`);
    if (!sources.includes(href)) problems.push(`preload sin @font-face con la misma URL: ${href}`);
  }
  return problems;
}

test('the real preloads are base-independent and request the @font-face URLs', () => {
  const problems = preloadProblems(
    readFileSync(INDEX_HTML, 'utf8'),
    readFileSync(FONTS_CSS, 'utf8'),
  );
  assert.deepEqual(problems, []);
});

test('accepts a root-absolute preload that matches its @font-face', () => {
  const html =
    '<link rel="preload" href="/fonts/karla.woff2" as="font" type="font/woff2" crossorigin>';
  const css = "@font-face { src: url('/fonts/karla.woff2') format('woff2'); }";
  assert.deepEqual(preloadProblems(html, css), []);
});

test('catches a relative preload that warms a locale copy instead of the real font', () => {
  const html =
    '<link rel="preload" href="fonts/karla.woff2" as="font" type="font/woff2" crossorigin>';
  const css = "@font-face { src: url('/fonts/karla.woff2') format('woff2'); }";
  assert.deepEqual(preloadProblems(html, css), [
    'preload no es independiente de <base href>: fonts/karla.woff2',
    'preload sin @font-face con la misma URL: fonts/karla.woff2',
  ]);
});

test('catches a preload whose URL has no matching @font-face', () => {
  const html =
    '<link rel="preload" href="/fonts/retired.woff2" as="font" type="font/woff2" crossorigin>';
  const css = "@font-face { src: url('/fonts/karla.woff2') format('woff2'); }";
  assert.deepEqual(preloadProblems(html, css), [
    'preload sin @font-face con la misma URL: /fonts/retired.woff2',
  ]);
});
