import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { contrastRatio, checkTokenContrast } from './check-contrast.mts';

const css = (foreground: string) => `:root {
  --color-bone: ${foreground}; --color-ash: ${foreground};
  --color-storm: ${foreground}; --color-ember: ${foreground};
  --color-soot: #ffffff; --color-panel: #ffffff; --color-panel-2: #ffffff;
}`;

test('WCAG luminance gives black/white 21:1, identical colors 1:1 and a symmetric ratio', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#808080', '#808080'), 1);
  assert.equal(contrastRatio('#123456', '#fedcba'), contrastRatio('#fedcba', '#123456'));
});

test('contrast decisions use the unrounded value at the 4.5 threshold', () => {
  assert.ok(contrastRatio('#777777', '#ffffff') < 4.5);
  assert.ok(contrastRatio('#767676', '#ffffff') > 4.5);
  assert.ok(checkTokenContrast(css('#767676')).every((check) => check.pass));
  assert.ok(checkTokenContrast(css('#777777')).every((check) => !check.pass));
  assert.equal(checkTokenContrast(css('#000000')).length, 12);
});

test('missing, duplicate and malformed color definitions fail instead of silently passing', () => {
  assert.throws(() => checkTokenContrast(':root {}'));
  assert.throws(() => checkTokenContrast(css('#000000') + ':root { --color-ash: #ffffff; }'));
  assert.throws(() => contrastRatio('red', '#ffffff'));
});

test('CLI rejects insufficient contrast and accepts readable tokens', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gd-contrast-'));
  try {
    const file = join(dir, 'tokens.css');
    const args = [
      '--import',
      'tsx',
      join(import.meta.dirname, 'check-contrast.mts'),
      '--file',
      file,
    ];
    await writeFile(file, css('#ffffff'));
    assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }));
    await writeFile(file, css('#000000'));
    assert.match(execFileSync(process.execPath, args, { encoding: 'utf8' }), /check:contrast OK/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
