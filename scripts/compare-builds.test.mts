import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compareTrees, extractJsonLd, normalizeHtml } from './compare-builds.mts';

interface PageOptions {
  title?: string;
  jsonLd?: Record<string, unknown>;
  source?: 'fixture' | 'api';
}

function page(options: PageOptions = {}): string {
  const jsonLd = options.jsonLd
    ? `<script id="gd-page-jsonld" type="application/ld+json">${JSON.stringify(options.jsonLd)}</script>`
    : '';
  const state = JSON.stringify({
    'gd-content-source': { source: options.source ?? 'fixture', includeDrafts: false },
    'gd-public-catalog': { locale: 'es', entries: [{ slug: 'uno', tier: 'alta' }] },
  });
  return `<!doctype html><html><head><title>${options.title ?? 'Portada'}</title>${jsonLd}</head><body><p>Contenido</p><script id="ng-state" type="application/json">${state}</script></body></html>`;
}

const SITEMAP = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '  <url><loc>https://compare.invalid/</loc></url>',
  '</urlset>',
  '',
].join('\n');

interface TreeOptions extends PageOptions {
  sitemap?: string;
  omit?: string;
}

function writeTree(root: string, options: TreeOptions = {}): string {
  const artifact = join(root, 'browser');
  for (const file of ['index.html', join('es', 'index.html')]) {
    if (options.omit === file) continue;
    const path = join(artifact, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, page(options), 'utf8');
  }
  for (const file of ['sitemap.xml', join('es', 'sitemap.xml')]) {
    if (options.omit === file) continue;
    const path = join(artifact, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, options.sitemap ?? SITEMAP, 'utf8');
  }
  return root;
}

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'gd-compare-'));
}

test('árboles equivalentes: el marcador de fuente no cuenta como diferencia', async () => {
  const root = tempRoot();
  try {
    const fixture = writeTree(join(root, 'fixture'), { source: 'fixture' });
    const api = writeTree(join(root, 'api'), { source: 'api' });
    const result = await compareTrees(fixture, api);
    assert.equal(result.status, 0);
    assert.deepEqual(result.differences, []);
    assert.equal(result.htmlPages, 2);
    assert.equal(result.sitemaps, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('HTML distinto: estado 1 y primera línea diferente del archivo', async () => {
  const root = tempRoot();
  try {
    const fixture = writeTree(join(root, 'fixture'), { title: 'Portada' });
    const api = writeTree(join(root, 'api'), { title: 'Otra portada' });
    const result = await compareTrees(fixture, api);
    assert.equal(result.status, 1);
    assert.equal(result.differences.length, 2);
    const difference = result.differences.find((item) => item.file === 'index.html');
    assert.ok(difference);
    assert.equal(difference.kind, 'html');
    assert.equal(difference.line, 1);
    assert.match(difference.detail, /Portada/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sitemap distinto: estado 1', async () => {
  const root = tempRoot();
  try {
    const fixture = writeTree(join(root, 'fixture'));
    const api = writeTree(join(root, 'api'), {
      sitemap: SITEMAP.replace(
        '</urlset>',
        '  <url><loc>https://compare.invalid/extra</loc></url>\n</urlset>',
      ),
    });
    const result = await compareTrees(fixture, api);
    assert.equal(result.status, 1);
    assert.ok(
      result.differences.some((item) => item.kind === 'sitemap' && item.file === 'sitemap.xml'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('JSON-LD con distinto orden de claves: estado 0 porque se compara canónico', async () => {
  const root = tempRoot();
  try {
    const fixture = writeTree(join(root, 'fixture'), {
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Grim Dawn Builds' },
    });
    const api = writeTree(join(root, 'api'), {
      jsonLd: { name: 'Grim Dawn Builds', '@type': 'WebSite', '@context': 'https://schema.org' },
    });
    const result = await compareTrees(fixture, api);
    assert.equal(result.status, 0);
    assert.equal(result.jsonLdBlocks, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('JSON-LD con un valor distinto: estado 1 y bloque señalado', async () => {
  const root = tempRoot();
  try {
    const fixture = writeTree(join(root, 'fixture'), {
      jsonLd: { '@type': 'WebSite', name: 'Grim Dawn Builds' },
    });
    const api = writeTree(join(root, 'api'), {
      jsonLd: { '@type': 'WebSite', name: 'Otro sitio' },
    });
    const result = await compareTrees(fixture, api);
    assert.equal(result.status, 1);
    assert.ok(result.differences.some((item) => item.kind === 'jsonld'));
    assert.match(result.differences[0]!.detail, /Otro sitio/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('árbol incompleto: estado 2 cuando falta una página en un lado', async () => {
  const root = tempRoot();
  try {
    const fixture = writeTree(join(root, 'fixture'));
    const api = writeTree(join(root, 'api'), { omit: join('es', 'index.html') });
    const result = await compareTrees(fixture, api);
    assert.equal(result.status, 2);
    assert.ok(result.differences.some((item) => item.kind === 'missing'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('artefacto sin browser/: estado 2', async () => {
  const root = tempRoot();
  try {
    const fixture = writeTree(join(root, 'fixture'));
    const api = join(root, 'api');
    mkdirSync(api, { recursive: true });
    const result = await compareTrees(fixture, api);
    assert.equal(result.status, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('normalizeHtml solo neutraliza el valor source del estado de contenido', () => {
  const fixture = page({ source: 'fixture' });
  const api = page({ source: 'api' });
  assert.equal(normalizeHtml(fixture), normalizeHtml(api));
  assert.equal(
    normalizeHtml(fixture.replace('source":"fixture"', 'source":"otra"')),
    fixture.replace('source":"fixture"', 'source":"otra"'),
  );
});

test('normalizeHtml reindexa los ids de hidratación conservando la topología', () => {
  const state = (source: 'fixture' | 'api', first: string, second: string, score: number) =>
    `<script id="ng-state" type="application/json">${JSON.stringify({
      'gd-content-source': { source, includeDrafts: false },
      __nghData__: [
        {},
        {
          t: { 6: first },
          c: { 6: [{ i: first, t: { 5: second }, c: { 5: [{ i: second, x: score }] } }] },
        },
      ],
    })}</script>`;
  // Misma topología con el contador desplazado: equivalente.
  assert.equal(
    normalizeHtml(state('fixture', 't1', 't2', 10)),
    normalizeHtml(state('api', 't2', 't3', 10)),
  );
  // Distinta topología (dos vistas que compartían id ahora no lo comparten).
  assert.notEqual(
    normalizeHtml(state('fixture', 't1', 't1', 10)),
    normalizeHtml(state('api', 't2', 't3', 10)),
  );
  // Un valor enlazado distinto sigue siendo una diferencia.
  assert.notEqual(
    normalizeHtml(state('fixture', 't1', 't2', 10)),
    normalizeHtml(state('api', 't2', 't3', 11)),
  );
});

test('extractJsonLd devuelve cada bloque ld+json y descarta el resto', () => {
  const html = `${page({ jsonLd: { '@type': 'WebSite' } })}
<script type="application/json">{"no":"ld"}</script>
<script id="segundo" type='application/ld+json'>{"@type":"Person"}</script>`;
  const blocks = extractJsonLd(html);
  assert.equal(blocks.length, 2);
  assert.deepEqual(JSON.parse(blocks[0]!), { '@type': 'WebSite' });
  assert.deepEqual(JSON.parse(blocks[1]!), { '@type': 'Person' });
});
