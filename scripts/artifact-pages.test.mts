import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prerenderedPages } from './artifact-pages.mts';

function withDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'gd-pages-'));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const page = (dir: string, rel: string): void => {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), '<html></html>');
};

test('prerenderedPages: a missing folder fails naming the gate and the cause (FR-001)', () =>
  withDir((dir) =>
    assert.throws(
      () => prerenderedPages(join(dir, 'browser'), { gate: 'puerta-x' }),
      /puerta-x: el artefacto está vacío \(sin carpeta browser\//,
    ),
  ));

test('prerenderedPages: a file or a symlink instead of a folder is invalid', () =>
  withDir((dir) => {
    writeFileSync(join(dir, 'browser'), 'x');
    assert.throws(
      () => prerenderedPages(join(dir, 'browser'), { gate: 'puerta-x' }),
      /puerta-x: .*carpeta browser\/ inválida/,
    );
    mkdirSync(join(dir, 'real'));
    page(join(dir, 'real'), 'index.html');
    const link = join(dir, 'link');
    try {
      symlinkSync(join(dir, 'real'), link, 'junction');
    } catch {
      return; // the platform refuses links: nothing to prove here
    }
    assert.throws(
      () => prerenderedPages(link, { gate: 'puerta-x' }),
      /puerta-x: .*carpeta browser\/ inválida/,
    );
  }));

test('prerenderedPages: fewer than minPages .html fails, ignoring other files', () =>
  withDir((dir) => {
    mkdirSync(join(dir, 'browser'));
    writeFileSync(join(dir, 'browser', 'main.js'), '1');
    assert.throws(
      () => prerenderedPages(join(dir, 'browser'), { gate: 'g' }),
      /g: el artefacto está vacío \(ninguna página \.html en browser\/\)/,
    );
    page(join(dir, 'browser'), 'index.html');
    assert.throws(
      () => prerenderedPages(join(dir, 'browser'), { gate: 'g', minPages: 2 }),
      /g: el artefacto está vacío \(1 páginas \.html en browser\/; se esperan al menos 2\)/,
    );
  }));

test('prerenderedPages: returns every .html, nested, in a stable order', () =>
  withDir((dir) => {
    const browser = join(dir, 'browser');
    for (const rel of ['es/index.html', 'index.html', 'a/b/index.html']) page(browser, rel);
    const pages = prerenderedPages(browser, { gate: 'g', minPages: 3 });
    assert.deepEqual(
      pages.map((file) => file.slice(browser.length + 1).replaceAll('\\', '/')),
      ['a/b/index.html', 'es/index.html', 'index.html'],
    );
  }));
