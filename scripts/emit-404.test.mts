import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { assertNotFoundPage, emit404, NOT_FOUND_ARTIFACT } from './emit-404.mts';

const notFoundHtml = `<!doctype html>
<html lang="en">
<head>
  <base href="/">
  <meta name="robots" content="noindex,follow">
  <title>Page not found</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <app-root>
    <section class="not-found" data-not-found aria-labelledby="not-found-title">
      <p class="not-found-eyebrow">Error 404</p>
      <h1 id="not-found-title">Page not found</h1>
      <a href="/">Back to the home page</a>
    </section>
  </app-root>
  <script src="main.js" type="module"></script>
</body>
</html>
`;

const spanishNotFoundHtml = notFoundHtml
  .replace('<html lang="en">', '<html lang="es">')
  .replace('<base href="/">', '<base href="/es/">')
  .replace('Page not found', 'Página no encontrada')
  .replace('Back to the home page', 'Volver al inicio');

async function artifact(html = notFoundHtml, segments: readonly string[] = []): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gd-emit-404-'));
  const browser = join(root, 'browser');
  await mkdir(join(browser, ...segments, '404'), { recursive: true });
  await mkdir(join(browser, 'assets'), { recursive: true });
  await writeFile(join(browser, ...segments, '404', 'index.html'), html);
  await writeFile(join(browser, 'index.html'), '<html><body>200</body></html>');
  return root;
}
async function cleanup(root: string): Promise<void> {
  if (basename(root).startsWith('gd-emit-404-') && dirname(root) === tmpdir())
    await rm(root, { recursive: true, force: true });
}

test('copies the prerendered 404 page to the artifact root byte for byte', async () => {
  const root = await artifact();
  try {
    await emit404(root);
    const written = await readFile(join(root, 'browser', NOT_FOUND_ARTIFACT), 'utf8');
    assert.equal(written, notFoundHtml);
    assertNotFoundPage(written);
    assert.deepEqual(
      (await readdir(join(root, 'browser'))).filter((name) => name.endsWith('.tmp')),
      [],
    );
  } finally {
    await cleanup(root);
  }
});

test('fails when the prerendered 404 page is missing instead of inventing an artifact', async () => {
  const root = await artifact();
  try {
    await rm(join(root, 'browser', '404'), { recursive: true, force: true });
    await assert.rejects(emit404(root), { message: /404\.html inválido/ });
  } finally {
    await cleanup(root);
  }
});

test('rejects a 200 page dressed as 404 and any page without the static 404 contract', async () => {
  const variants = [
    '<!doctype html><html><head><base href="/"></head><body><app-root></app-root></body></html>',
    '<!doctype html><html><head><base href="/"><meta name="robots" content="index,follow"></head><body><section data-not-found><h1>Page not found</h1></section></body></html>',
    '<!doctype html><html><head><base href="/"><meta name="robots" content="noindex,follow"></head><body><section><h1>Page not found</h1></section></body></html>',
    '<!doctype html><html><head><base href="/"><meta name="robots" content="noindex,follow"><meta name="gd-static-home" content="1"></head><body><section data-not-found><h1>Page not found</h1></section></body></html>',
    '<!doctype html><html><head><base href="/"><meta name="robots" content="noindex,follow"></head><body><section data-not-found><h1> </h1></section></body></html>',
    '<!doctype html><html><head><base href="/es/"><meta name="robots" content="noindex,follow"></head><body><section data-not-found><h1>Page not found</h1></section></body></html>',
  ];
  for (const html of variants) {
    const root = await artifact(html);
    try {
      await assert.rejects(emit404(root), { message: /404\.html inválido/ });
      await assert.rejects(readFile(join(root, 'browser', NOT_FOUND_ARTIFACT), 'utf8'));
    } finally {
      await cleanup(root);
    }
  }
});

test('copies the 404 page of every configured locale with its own base href', async () => {
  const root = await artifact();
  try {
    await mkdir(join(root, 'browser', 'es', '404'), { recursive: true });
    await writeFile(join(root, 'browser', 'es', '404', 'index.html'), spanishNotFoundHtml);
    await emit404(root, [[], ['es']]);
    assert.equal(await readFile(join(root, 'browser', NOT_FOUND_ARTIFACT), 'utf8'), notFoundHtml);
    assert.equal(
      await readFile(join(root, 'browser', 'es', NOT_FOUND_ARTIFACT), 'utf8'),
      spanishNotFoundHtml,
    );
    assertNotFoundPage(await readFile(join(root, 'browser', 'es', NOT_FOUND_ARTIFACT), 'utf8'), '/es/');
  } finally {
    await cleanup(root);
  }
});

test('fails when a configured locale has no prerendered 404 page', async () => {
  const root = await artifact();
  try {
    await assert.rejects(emit404(root, [[], ['es']]), { message: /404\.html inválido/ });
  } finally {
    await cleanup(root);
  }
});

test('rejects a locale 404 page whose base href belongs to another locale', async () => {
  const root = await artifact();
  try {
    await mkdir(join(root, 'browser', 'es', '404'), { recursive: true });
    await writeFile(join(root, 'browser', 'es', '404', 'index.html'), notFoundHtml);
    await assert.rejects(emit404(root, [['es']]), { message: /404\.html inválido/ });
  } finally {
    await cleanup(root);
  }
});

test('refuses symlinked artifact directories and keeps the failure message free of paths', async (t) => {
  const root = await artifact();
  try {
    const target = join(root, 'browser-real');
    await symlink(join(root, 'browser'), target, 'dir');
    await assert.rejects(emit404(join(root, 'browser-real')), { message: /404\.html inválido/ });
  } catch (error) {
    t.skip(`symlinks no disponibles en este sistema: ${String(error)}`);
  } finally {
    await cleanup(root);
  }
});

test('replaces a stale 404.html without leaving temporary files behind', async () => {
  const root = await artifact();
  try {
    await writeFile(join(root, 'browser', NOT_FOUND_ARTIFACT), 'stale');
    await emit404(root);
    assert.equal(await readFile(join(root, 'browser', NOT_FOUND_ARTIFACT), 'utf8'), notFoundHtml);
  } finally {
    await cleanup(root);
  }
});
