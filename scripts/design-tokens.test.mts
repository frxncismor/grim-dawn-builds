import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from './check-contrast.mts';

/**
 * spec004 T030 (FR-020, DESIGN.md): no color, font or frame lives outside the token system.
 * Every declaration in the app styles (global CSS and component CSS, including inline `styles:`
 * in `.ts`) takes colors and fonts from `tokens.css` custom properties. A literal color is only
 * tolerated as the fallback of a `var(--token, <fallback>)` (reported, not failed), because the
 * token always exists.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'apps', 'web', 'src');
/** Where literals are the definition of the system or a throwaway preview/test. */
const EXEMPT = /(?:^|[\\/])(?:tokens\.css|fonts\.css)$|\.spec\.ts$|\.test\.mts$|preview|test-data/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(css|ts)$/.test(name) && !EXEMPT.test(path) ? [path] : [];
  });
}

const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\bhwb\(|\blab\(/;
const DECLARATION = /^\s*([a-z-]+)\s*:\s*([^;{}]*);?\s*$/;

interface Finding {
  file: string;
  line: number;
  text: string;
}

/** CSS text of a file: the whole `.css`, or the inline `styles:` template literals of a `.ts`. */
function cssLines(file: string, text: string): { line: number; text: string }[] {
  const all = text.split(/\r?\n/).map((t, i) => ({ line: i + 1, text: t }));
  if (file.endsWith('.css')) return all;
  const result: typeof all = [];
  let inside = false;
  for (const entry of all) {
    if (!inside && /styles:\s*`/.test(entry.text)) inside = true;
    if (inside) result.push(entry);
    if (inside && /`,?\s*$/.test(entry.text) && !/styles:\s*`[^`]*$/.test(entry.text))
      inside = false;
  }
  return result;
}

function scan(): { colors: Finding[]; fonts: Finding[]; fallbacks: Finding[] } {
  const colors: Finding[] = [];
  const fonts: Finding[] = [];
  const fallbacks: Finding[] = [];
  for (const file of files(SRC)) {
    for (const { line, text: raw } of cssLines(file, readFileSync(file, 'utf8'))) {
      if (/^\s*(\/\*|\*|\/\/)/.test(raw)) continue;
      const at = { file: relative(ROOT, file), line, text: raw.trim() };
      // A literal inside `var(--token, <fallback>)` is a fallback, not a color of its own.
      const withoutFallbacks = raw.replace(/var\(\s*--[\w-]+\s*,[^)]*\)/g, 'var(--x)');
      if (withoutFallbacks !== raw && COLOR.test(raw)) fallbacks.push(at);
      if (COLOR.test(withoutFallbacks)) colors.push(at);
      const match = DECLARATION.exec(raw);
      if (match && match[1] === 'font-family') {
        const value = (match[2] ?? '').replace(/!important/, '').trim();
        if (!/^var\(--font-[\w-]+\)$/.test(value)) fonts.push(at);
      }
    }
  }
  return { colors, fonts, fallbacks };
}

const found = scan();
const show = (items: Finding[]) => items.map((i) => `${i.file}:${i.line}  ${i.text}`).join('\n');

test('no color literal outside tokens.css (use a --color-* or shadow token)', () => {
  assert.equal(found.colors.length, 0, `\n${show(found.colors)}`);
});

test('no font-family outside the --font-* tokens', () => {
  assert.equal(found.fonts.length, 0, `\n${show(found.fonts)}`);
});

test('fallback literals inside var() are reported for cleanup (not failed)', () => {
  if (found.fallbacks.length)
    console.log(`# var() fallbacks with a literal color:\n${show(found.fallbacks)}`);
  assert.ok(Array.isArray(found.fallbacks));
});

const tokens = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8');
const token = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)?.[1] ?? '';

test('prefers-contrast: more keeps 7:1 for text and visible lines on every surface', () => {
  const accessibility = readFileSync(join(SRC, 'styles', 'accessibility.css'), 'utf8');
  assert.match(accessibility, /@media \(prefers-contrast: more\)/);
  for (const surface of ['--color-soot', '--color-panel', '--color-panel-2'])
    assert.ok(
      contrastRatio(token('--color-ash-more'), token(surface)) >= 7,
      `ash-more sobre ${surface}`,
    );
  assert.ok(contrastRatio(token('--color-line-more'), token('--color-soot')) >= 3, 'línea visible');
});

test('prefers-reduced-motion turns animation and transition off globally', () => {
  const base = readFileSync(join(SRC, 'styles', 'base.css'), 'utf8');
  const start = base.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(start >= 0, 'falta el bloque prefers-reduced-motion en base.css');
  const block = base.slice(start, base.indexOf('@media', start + 10));
  assert.ok(block.includes('animation: none'));
  assert.ok(block.includes('transition: none'));
});

/**
 * spec005 T027 (F-08, DESIGN.md «Don't»): no `border-left`/`border-right`/`border-inline-*` thicker
 * than 1px as an accent stripe. The 2px stripe of `build-toc.css` is the state indicator of the
 * index (current section, hover, keyboard focus), not decoration, so it is the only allowed file.
 */
const STATE_INDICATOR_FILES = /build-toc\.css$/;
test('no side-stripe accent border thicker than 1px (T027)', () => {
  const offenders: Finding[] = [];
  for (const file of files(SRC)) {
    if (STATE_INDICATOR_FILES.test(file)) continue;
    for (const { line, text } of cssLines(file, readFileSync(file, 'utf8'))) {
      const m = /\bborder-(?:left|right|inline(?:-start|-end)?)\s*:\s*(\d+(?:\.\d+)?)px\b/.exec(
        text,
      );
      if (m && Number(m[1]) > 1)
        offenders.push({ file: relative(ROOT, file), line, text: text.trim() });
    }
  }
  assert.deepEqual(offenders, [], `acentos laterales > 1px:\n${show(offenders)}`);
});

/**
 * spec005 T030 (F-12): the content-status badges keep a solid border that reaches 3:1 over their
 * background ("Unverified" is the key datum of PRODUCT principle 1: same visual weight as "Published"),
 * and the microtext of the cards and the build summary is never below 12px (0.75rem).
 */
test('status badges have a solid, visible border and the microtext is at least 12px (T030)', () => {
  const summary = readFileSync(
    join(SRC, 'app', 'features', 'build', 'summary', 'build-summary.css'),
    'utf8',
  );
  const rule = (selector: string) => {
    const start = summary.indexOf(`${selector} {`);
    return start < 0 ? '' : summary.slice(start, summary.indexOf('}', start));
  };
  const unverified = rule(".badge[data-content-status='sin_verificar']");
  assert.doesNotMatch(unverified, /border-style:\s*dashed/, 'Unverified: borde sólido');
  const borderToken = /border(?:-color)?:[^;]*var\((--color-[a-z-]+)\)/.exec(unverified)?.[1];
  const base = /border:\s*1px solid var\((--color-[a-z-]+)\)/.exec(rule('.badge'))?.[1];
  const effective = borderToken ?? base ?? '';
  assert.ok(
    contrastRatio(token(effective), token('--color-panel-2')) >= 3,
    `Unverified: el borde (${effective}) debe llegar a 3:1 sobre el panel`,
  );
  for (const file of [
    join(SRC, 'styles', 'build-card.css'),
    join(SRC, 'app', 'features', 'build', 'summary', 'build-summary.css'),
  ])
    for (const m of readFileSync(file, 'utf8').matchAll(/font-size:\s*([\d.]+)(rem|px)/g)) {
      const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
      assert.ok(px >= 12, `${file}: font-size ${m[0]} < 12px`);
    }
});
