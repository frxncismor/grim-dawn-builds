import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * spec004 T008: the frames and textures under `public/assets/ui/` are our own SVG
 * (constitution VII, Q12 = A). They must be few, self-contained, same-origin and never
 * coincide with a file of the game's art manifest.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UI = resolve(ROOT, 'apps', 'web', 'public', 'assets', 'ui');
const MANIFEST = resolve(ROOT, 'fixtures', 'content', 'assets', 'manifest.json');
const STYLES = resolve(ROOT, 'apps', 'web', 'src', 'styles');

const files = readdirSync(UI).filter((name) => !name.startsWith('.'));
const read = (name: string) => readFileSync(resolve(UI, name));

test('at most five files, all SVG', () => {
  assert.ok(files.length >= 1 && files.length <= 5, `found ${files.length} files`);
  for (const name of files) assert.match(name, /\.svg$/, name);
});

test('every file is self-contained: no data: URI, no embedded or external image, no script', () => {
  for (const name of files) {
    const text = read(name).toString('utf8');
    assert.doesNotMatch(text, /data:/i, `${name}: data: URI`);
    assert.doesNotMatch(
      text,
      /<image\b|<script\b|<foreignObject\b|href\s*=|url\(\s*['"]?https?:/i,
      name,
    );
    assert.doesNotMatch(text, /maxroll|crate entertainment/i, `${name}: brand text`);
  }
});

test('no file matches the manifest of the game art by hash or by path', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    assets: { file_path: string; provenance?: { sha256?: string; source_path?: string } }[];
  };
  const gameHashes = new Set(manifest.assets.map((a) => a.provenance?.sha256).filter(Boolean));
  const gamePaths = manifest.assets.map((a) => a.file_path);
  for (const name of files) {
    const hash = createHash('sha256').update(read(name)).digest('hex');
    assert.ok(!gameHashes.has(hash), `${name} has the hash of a game asset`);
    assert.ok(
      !gamePaths.some((p) => p.includes('assets/ui/') && p.endsWith(name)),
      `${name} is in the manifest`,
    );
  }
});

test('every /assets/ui/ file referenced by the styles exists and uses same origin', () => {
  const css = readdirSync(STYLES)
    .filter((n) => n.endsWith('.css'))
    .map((n) => readFileSync(resolve(STYLES, n), 'utf8'))
    .join('\n');
  const refs = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]!);
  assert.doesNotMatch(css, /url\(\s*['"]?data:/i, 'data: URI in the styles');
  for (const ref of refs.filter((r) => r.includes('/assets/ui/'))) {
    assert.match(ref, /^\/assets\/ui\/[\w-]+\.svg$/, ref);
    assert.ok(files.includes(ref.split('/').pop()!), `${ref} does not exist`);
  }
  assert.ok(
    refs.some((r) => r.includes('/assets/ui/')),
    'styles reference no frame',
  );
});
