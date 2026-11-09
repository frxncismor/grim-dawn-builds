import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Verificación automatizada de lint:md (FR-46, AC-26, T-123).
// Los fixtures viven en un directorio temporal fuera del repositorio y se usa una
// configuración temporal sin "globs", para que nunca entren en el alcance del lint real.

// Binario de markdownlint-cli2 instalado como devDependency (pnpm, versión exacta).
const bin = fileURLToPath(
  new URL('../node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs', import.meta.url),
);

let dir;
let config;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'lint-md-'));
  config = join(dir, 'markdownlint-cli2.jsonc');
  writeFileSync(config, JSON.stringify({ config: { default: true } }));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** @param {string[]} args */
function runCli(args) {
  return spawnSync(process.execPath, [bin, '--config', config, ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
}

test('lint fails for a skipped heading level (MD001)', () => {
  const file = join(dir, 'skipped-heading.md');
  writeFileSync(file, '# Título\n\n### Subsección salteada\n\nTexto.\n');

  const result = runCli([file]);
  const output = `${result.stdout}${result.stderr}`;

  assert.notEqual(result.status, 0, 'lint must fail on a skipped heading level');
  assert.match(output, /MD001/);
});

test('safe fixer corrects an autocorrectable fixture (MD022)', () => {
  const file = join(dir, 'autofix.md');
  writeFileSync(file, '# Título\nTexto sin línea en blanco.\n');

  const lintBefore = runCli([file]);
  assert.notEqual(lintBefore.status, 0, 'fixture must fail before --fix');
  assert.match(`${lintBefore.stdout}${lintBefore.stderr}`, /MD022/);

  const fixed = runCli(['--fix', file]);
  assert.equal(fixed.status, 0, `--fix should leave no remaining issues: ${fixed.stderr}`);
  assert.equal(readFileSync(file, 'utf8'), '# Título\n\nTexto sin línea en blanco.\n');

  const lintAfter = runCli([file]);
  assert.equal(lintAfter.status, 0, 'fixed fixture must pass lint');
});
