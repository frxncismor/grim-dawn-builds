import assert from 'node:assert/strict';
import fs, { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { mock, test } from 'node:test';
import {
  assertRegularArtifact,
  entriesUnder,
  htmlPagesOf,
  prerenderedPages,
  readArtifactEntries,
} from './artifact-pages.mts';

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

test('prerenderedPages: a file or a symlink instead of a folder is invalid', (t) =>
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
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EACCES') throw error;
      t.skip(`la plataforma no permite crear enlaces (${code})`);
      return;
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

test('prerenderedPages: a linked folder under browser/ is invalid, junction included (spec007 T001, FR-001)', (t) =>
  withDir((dir) => {
    mkdirSync(join(dir, 'real'));
    page(join(dir, 'real'), 'index.html');
    page(join(dir, 'browser'), 'index.html');
    try {
      symlinkSync(join(dir, 'real'), join(dir, 'browser', 'es'), 'junction');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EACCES') throw error;
      t.skip(`la plataforma no permite crear enlaces (${code})`);
      return;
    }
    assert.throws(
      () => prerenderedPages(join(dir, 'browser'), { gate: 'puerta-x' }),
      /puerta-x: el artefacto es inválido \(enlace o entrada no regular: browser\/es\)/,
    );
  }));

test('prerenderedPages: a linked .html page under browser/ is invalid (spec007 T001, FR-001)', (t) =>
  withDir((dir) => {
    page(join(dir, 'real'), 'x.html');
    page(join(dir, 'browser'), 'index.html');
    try {
      symlinkSync(join(dir, 'real', 'x.html'), join(dir, 'browser', 'linked.html'), 'file');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES') {
        t.skip(`la plataforma no permite enlaces simbólicos de archivo (${code})`);
        return;
      }
      throw error;
    }
    assert.throws(
      () => prerenderedPages(join(dir, 'browser'), { gate: 'puerta-x' }),
      /puerta-x: el artefacto es inválido \(enlace o entrada no regular: browser\/linked\.html\)/,
    );
  }));

/** Counts the `readdirSync` calls `run` makes (spec008 T002, FR-001, SC-001); restores the module on exit. */
function countDirReads(run: () => void): number {
  const spy = mock.method(fs, 'readdirSync');
  syncBuiltinESMExports();
  try {
    run();
    return spy.mock.callCount();
  } finally {
    spy.mock.restore();
    syncBuiltinESMExports();
  }
}

test('prerenderedPages: reads the artifact directory once per call (spec008 T002, FR-001, SC-001)', () =>
  withDir((dir) => {
    page(join(dir, 'browser'), 'index.html');
    page(join(dir, 'browser'), 'es/index.html');
    let pages: string[] = [];
    const reads = countDirReads(() => {
      pages = prerenderedPages(join(dir, 'browser'), { gate: 'g', minPages: 2 });
    });
    assert.equal(pages.length, 2);
    assert.equal(reads, 1);
  }));

test('prerenderedPages: exact messages for a linked folder and an empty browser/ (spec008 T002, FR-003)', (t) =>
  withDir((dir) => {
    mkdirSync(join(dir, 'browser'));
    assert.throws(() => prerenderedPages(join(dir, 'browser'), { gate: 'puerta-x' }), {
      message: 'puerta-x: el artefacto está vacío (ninguna página .html en browser/).',
    });
    page(join(dir, 'real'), 'index.html');
    try {
      symlinkSync(join(dir, 'real'), join(dir, 'browser', 'es'), 'junction');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EACCES') throw error;
      t.skip(`la plataforma no permite crear enlaces (${code})`);
      return;
    }
    assert.throws(() => prerenderedPages(join(dir, 'browser'), { gate: 'puerta-x' }), {
      message: 'puerta-x: el artefacto es inválido (enlace o entrada no regular: browser/es).',
    });
  }));

test('only the validation yields entries the derived functions accept (spec008 T005, A-001, FR-001)', () =>
  withDir((dir) => {
    page(join(dir, 'browser'), 'index.html');
    const raw = readArtifactEntries(dir);
    // Type-level: a raw read cannot be listed or searched without validating it first.
    // @ts-expect-error htmlPagesOf only accepts the entries `assertRegularArtifact` returns.
    const unchecked = (): string[] => htmlPagesOf(raw, { gate: 'g' });
    assert.equal(typeof unchecked, 'function');
    const validated = assertRegularArtifact(
      entriesUnder(raw, 'browser'),
      join(dir, 'browser'),
      'g',
    );
    assert.deepEqual(
      htmlPagesOf(validated, { gate: 'g' }).map((file) =>
        file.slice(dir.length + 1).replaceAll(sep, '/'),
      ),
      ['browser/index.html'],
    );
  }));
