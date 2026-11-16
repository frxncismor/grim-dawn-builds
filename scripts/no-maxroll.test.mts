import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * spec004 T031 (FR-030, SC-010): the product never carries Maxroll's brand, images or texts. The
 * reference is cited only in planning documents, never in `apps/web/src` or `apps/web/public`.
 * The scan reads every file as bytes (text, SVG and binaries alike) and checks file names too, so a
 * logo is caught by its name or by any embedded metadata/text, case-insensitively.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = /maxroll|max-roll|max_roll|maxroll\.gg/i;

/** Every offending path (by name or by content) under `dir`, relative to it. */
export function maxrollFindings(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      const label = relative(dir, path).split(sep).join('/');
      if (BRAND.test(name)) found.push(`${label} (name)`);
      if (statSync(path).isDirectory()) walk(path);
      else if (BRAND.test(readFileSync(path).toString('latin1'))) found.push(`${label} (content)`);
    }
  };
  walk(dir);
  return found;
}

for (const folder of [join('apps', 'web', 'src'), join('apps', 'web', 'public')]) {
  test(`${folder} carries no Maxroll name, logo or text`, () => {
    assert.deepEqual(maxrollFindings(join(ROOT, folder)), []);
  });
}

test('the scan fails on a name, a text, an SVG logo and a binary that mention Maxroll', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gd-maxroll-'));
  try {
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'ok.txt'), 'Grim Dawn guides');
    writeFileSync(join(dir, 'assets', 'MAXROLL-logo.svg'), '<svg/>');
    writeFileSync(join(dir, 'copy.html'), '<p>Powered by Maxroll</p>');
    writeFileSync(join(dir, 'logo.svg'), '<svg><title>maxroll.gg</title></svg>');
    writeFileSync(
      join(dir, 'art.png'),
      Buffer.concat([Buffer.from([137, 80]), Buffer.from('mAxRoLl')]),
    );
    assert.deepEqual(
      maxrollFindings(dir).sort(),
      [
        'art.png (content)',
        'assets/MAXROLL-logo.svg (name)',
        'copy.html (content)',
        'logo.svg (content)',
      ].sort(),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
