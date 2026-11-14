import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFERRED_STYLES_FILE, emitDeferredStyles } from './emit-deferred-styles.mts';

const WEB = resolve(import.meta.dirname, '..');

async function artifact(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'emit-styles-'));
  await mkdir(join(root, 'browser'), { recursive: true });
  return root;
}

test('emite assets/deferred.css con el CSS de cada componente diferido, sin @import ni comentarios', async () => {
  const root = await artifact();
  try {
    const file = await emitDeferredStyles(WEB, root);
    assert.equal(file, join('assets', DEFERRED_STYLES_FILE));
    const css = await readFile(join(root, 'browser', file), 'utf8');
    for (const marker of [
      'gd-skill-tree{',
      '.skill-tree__node--assigned',
      '.devotion-map__svg',
      'gd-devotion-section>section',
      'gd-build-skills{',
    ])
      assert.ok(css.includes(marker), `falta ${marker}`);
    assert.doesNotMatch(css, /@import|\/\*|:host|::ng-deep/);
    assert.ok(css.length < 40_000, 'tamaño razonable');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('falla cerrado si falta un CSS importado o el artefacto no existe', async () => {
  const root = await artifact();
  const web = await mkdtemp(join(tmpdir(), 'emit-styles-web-'));
  try {
    await mkdir(join(web, 'src/styles'), { recursive: true });
    await writeFile(join(web, 'src/styles/deferred.css'), "@import './missing.css';\n");
    await assert.rejects(emitDeferredStyles(web, root), /deferred-styles/);
    await assert.rejects(emitDeferredStyles(WEB, join(root, 'no-existe')), /deferred-styles/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(web, { recursive: true, force: true });
  }
});

test('ningún componente diferido conserva estilos de componente (la CSP los bloquearía)', async () => {
  const { readdir } = await import('node:fs/promises');
  const deferred = [
    'src/app/shared/svg/skill-tree/skill-tree.ts',
    'src/app/shared/svg/devotion-map/devotion-map.ts',
    'src/app/features/build/devotion-section/devotion-section.ts',
    'src/app/features/build/skills/build-skills.ts',
  ];
  for (const file of deferred) {
    const source = await readFile(join(WEB, file), 'utf8');
    assert.doesNotMatch(source, /styleUrl|styles:/, `${file} no debe llevar estilos de componente`);
    assert.match(source, /ViewEncapsulation\.None/, `${file} usa encapsulación global`);
  }
  assert.ok((await readdir(join(WEB, 'src/styles'))).includes('deferred.css'));
});
