import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import {
  staticHomeHtml,
  assertStaticHome,
  assertStaticPage,
  staticPageHtml,
  finalizeStaticHome,
  assertCompleteStaticRoutes,
} from './static-home.mts';
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

test('content pages are emitted without client bootstrap and keep the static contract', () => {
  for (const selector of ['gd-about-page', 'gd-legal-page', 'gd-author-page']) {
    const result = staticPageHtml(html.replaceAll('app-home-page', selector), selector);
    assertStaticPage(result, selector);
    for (const text of [
      '<h1>Grim Dawn Builds</h1>',
      'href="/tier-list"',
      'href="#main"',
      'application/ld+json',
      '"source":"api"',
      '<meta name="gd-static-page" content="1">',
    ])
      assert.ok(result.includes(text));
    for (const text of ['<script src', 'modulepreload', 'gd-public-catalog', 'gd-static-home'])
      assert.ok(!result.includes(text));
    assert.equal(staticPageHtml(result, selector), result);
  }
});

test('content page contract rejects wrong selectors, executable scripts and interactive controls', () => {
  const page = html.replaceAll('app-home-page', 'gd-about-page');
  const about = staticPageHtml(page, 'gd-about-page');
  assert.throws(() => assertStaticPage(about, 'gd-legal-page'), {
    message: 'Portada estática inválida.',
  });
  assert.throws(() => assertStaticHome(about));
  assert.throws(() => staticPageHtml(html, 'app-home-page'));
  assert.throws(() => staticPageHtml(page, 'gd-legal-page'));
  assert.throws(() =>
    assertStaticPage(
      about.replace('</head>', '<script src="main.js"></script></head>'),
      'gd-about-page',
    ),
  );
  assert.throws(() =>
    assertStaticPage(
      about.replace('</head>', '<script>window.customHandler=true</script></head>'),
      'gd-about-page',
    ),
  );
  for (const snippet of [
    '<button>Copiar</button>',
    '<div role="button">Activar</div>',
    '<input>',
    '<a href="/tier-list" onclick="run()">Catálogo</a>',
    '<gd-stepper></gd-stepper>',
  ]) {
    assert.throws(
      () =>
        staticPageHtml(
          page.replace('</gd-about-page>', snippet + '</gd-about-page>'),
          'gd-about-page',
        ),
      { message: 'Portada estática inválida.' },
    );
  }
});

test('content page replay removes only the exact Angular contract and static click initializer', async () => {
  const contract = await readFile(
    new URL(import.meta.resolve('@angular/core/event-dispatch-contract.min.js')),
    'utf8',
  );
  const scripts = `<script id="ng-event-dispatch-contract" type="text/javascript">${contract}</script><script>window.__jsaction_bootstrap(document.body,"ng",["click"],[]);</script>`;
  const source = html
    .replaceAll('app-home-page', 'gd-legal-page')
    .replace('</body>', scripts + '</body>');
  assertStaticPage(staticPageHtml(source, 'gd-legal-page'), 'gd-legal-page');
  assert.throws(() =>
    staticPageHtml(
      source.replace(contract, contract + 'window.customHandler=true;'),
      'gd-legal-page',
    ),
  );
  assert.throws(() =>
    staticPageHtml(source.replace('["click"]', '["click","input"]'), 'gd-legal-page'),
  );
});

test('finalization transforms every present content page and leaves the 404 untouched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-static-home-pages-'));
  try {
    const browser = join(root, 'browser');
    const pages = {
      'acerca/index.html': 'gd-about-page',
      'legal/index.html': 'gd-legal-page',
      'autores/grim-dawn-builds/index.html': 'gd-author-page',
    } as const;
    await mkdir(browser);
    await writeFile(join(browser, 'index.html'), html);
    for (const [file, selector] of Object.entries(pages)) {
      await mkdir(dirname(join(browser, file)), { recursive: true });
      await writeFile(join(browser, file), html.replaceAll('app-home-page', selector));
    }
    await mkdir(join(browser, '404'));
    const notFound = '<script src="main.js"></script><p>No encontrada</p>';
    await writeFile(join(browser, '404/index.html'), notFound);
    assert.deepEqual(await finalizeStaticHome(root), [
      '/',
      '/acerca',
      '/legal',
      '/autores/grim-dawn-builds',
    ]);
    assertStaticHome(await readFile(join(browser, 'index.html'), 'utf8'));
    for (const [file, selector] of Object.entries(pages))
      assertStaticPage(await readFile(join(browser, file), 'utf8'), selector);
    assert.equal(await readFile(join(browser, '404/index.html'), 'utf8'), notFound);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-static-home-pages-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('finalization tolerates absent content pages but rejects a present page that breaks the contract', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-static-home-absent-'));
  try {
    const browser = join(root, 'browser');
    await mkdir(browser);
    await writeFile(join(browser, 'index.html'), html);
    assert.deepEqual(await finalizeStaticHome(root), ['/']);
    await mkdir(join(browser, 'legal'));
    const legal = html
      .replaceAll('app-home-page', 'gd-legal-page')
      .replace('</gd-legal-page>', '<button>Copiar</button></gd-legal-page>');
    await writeFile(join(browser, 'legal/index.html'), legal);
    await assert.rejects(finalizeStaticHome(root));
    assert.equal(await readFile(join(browser, 'legal/index.html'), 'utf8'), legal);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('gd-static-home-absent-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('release completeness requires about, legal and at least one author page', () => {
  assert.throws(() => assertCompleteStaticRoutes(['/', '/legal', '/autores/grim-dawn-builds']));
  assert.throws(() => assertCompleteStaticRoutes(['/', '/acerca', '/autores/grim-dawn-builds']));
  assert.throws(() => assertCompleteStaticRoutes(['/', '/acerca', '/legal']));
  assert.doesNotThrow(() =>
    assertCompleteStaticRoutes(['/', '/acerca', '/legal', '/autores/grim-dawn-builds']),
  );
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
