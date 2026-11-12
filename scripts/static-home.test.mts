import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { staticHomeHtml, assertStaticHome, finalizeStaticHome } from './static-home.mts';
const html = await readFile(new URL('./fixtures/static-home.html', import.meta.url), 'utf8');
test('static delivery preserves native content and SEO while removing every JavaScript request', () => {
  const result = staticHomeHtml(html);
  assertStaticHome(result);
  for (const text of [
    '<h1>Grim Dawn Builds</h1>',
    'Contenido propio.',
    'href="/tier-list"',
    'href="#main"',
    'rel="canonical"',
    'rel="stylesheet"',
    'application/ld+json',
    '"source":"api"',
  ])
    assert.ok(result.includes(text));
  for (const text of ['src="main.js"', 'modulepreload', 'gd-public-catalog'])
    assert.ok(!result.includes(text));
  assert.equal(staticHomeHtml(result), result);
});

test('known Angular critical CSS activation becomes a native stylesheet; arbitrary onload stays forbidden', () => {
  const critical = html.replace(
    '<link rel="stylesheet" href="styles.css">',
    '<link rel="stylesheet" href="styles.css" media="print" onload="this.media=\'all\'">',
  );
  const result = staticHomeHtml(critical);
  assert.ok(result.includes('href="styles.css" media="all"'));
  assert.ok(!result.includes('onload='));
  assert.throws(() =>
    staticHomeHtml(critical.replace("this.media='all'", 'window.customHandler()')),
  );
});
test('unsafe or JavaScript-dependent Home cannot be silently made static', () => {
  for (const snippet of [
    '<button>Copiar</button>',
    '<SCRIPT>window.customHandler=true</SCRIPT>',
    '<svg><script>window.customHandler=true</script></svg>',
    '<meta http-equiv="refresh" content="0;url=https://example.org">',
    '<input>',
    '<form></form>',
    '<canvas></canvas>',
    '<iframe></iframe>',
    '<gd-stepper></gd-stepper>',
    '<div role="button">Activar</div>',
    '<p contenteditable="true">Editar</p>',
    '<a>Sin destino</a>',
    '<a href="javascript:alert(1)">Activar</a>',
    '<a href="/tier-list" onclick="run()">Catálogo</a>',
    '<script>window.customHandler=true</script>',
    '<script src="https://example.org/remote.js"></script>',
  ]) {
    assert.throws(
      () => staticHomeHtml(html.replace('</app-home-page>', snippet + '</app-home-page>')),
      { message: 'Portada estática inválida.' },
    );
  }
  assert.throws(() => staticHomeHtml(html.replace('<h1>', '<h1 attr="broken')));
  assert.throws(() => assertStaticHome(html.replace(/<script src="main.js"[^>]*><\/script>/, '')));
});
test('marker alone cannot excuse executable scripts or an interactive route', () => {
  const result = staticHomeHtml(html);
  assert.throws(() =>
    assertStaticHome(result.replace('</head>', '<script src="main.js"></script></head>')),
  );
  assert.throws(() => assertStaticHome(result.replaceAll('app-home-page', 'gd-tier-list-page')));
});

test('only the exact installed Angular replay contract and static click initializer can be removed', async () => {
  const contract = await readFile(
    new URL(import.meta.resolve('@angular/core/event-dispatch-contract.min.js')),
    'utf8',
  );
  const scripts = `<script id="ng-event-dispatch-contract" type="text/javascript">${contract}</script><script>window.__jsaction_bootstrap(document.body,"ng",["click"],[]);</script>`;
  const source = html.replace('</body>', scripts + '</body>');
  assertStaticHome(staticHomeHtml(source));
  assert.throws(() =>
    staticHomeHtml(source.replace(contract, contract + 'window.customHandler=true;')),
  );
  assert.throws(() => staticHomeHtml(source.replace('["click"]', '["click","input"]')));
});
test('finalization changes only regular Home and refuses symlink output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-static-home-'));
  try {
    const browser = join(root, 'browser');
    await mkdir(browser);
    await writeFile(join(browser, 'index.html'), html);
    await mkdir(join(browser, 'tier-list'));
    await writeFile(
      join(browser, 'tier-list/index.html'),
      '<script src="main.js"></script><p>Interactive</p>',
    );
    await finalizeStaticHome(root);
    assertStaticHome(await readFile(join(browser, 'index.html'), 'utf8'));
    assert.equal(
      await readFile(join(browser, 'tier-list/index.html'), 'utf8'),
      '<script src="main.js"></script><p>Interactive</p>',
    );
    await rm(join(browser, 'index.html'));
    await assert.rejects(finalizeStaticHome(root));
    if (process.platform !== 'win32') {
      await writeFile(join(root, 'other.html'), html);
      await symlink(join(root, 'other.html'), join(browser, 'index.html'));
      await assert.rejects(finalizeStaticHome(root));
    }
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-static-home-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('directory symlink or Windows junction cannot redirect finalization outside its output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-static-home-link-'));
  try {
    const target = join(root, 'target'),
      output = join(root, 'output');
    await mkdir(target);
    await mkdir(output);
    await writeFile(join(target, 'index.html'), html);
    await symlink(
      target,
      join(output, 'browser'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await assert.rejects(finalizeStaticHome(output));
    assert.equal(await readFile(join(target, 'index.html'), 'utf8'), html);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-static-home-link-'));
    await rm(root, { recursive: true, force: true });
  }
});
