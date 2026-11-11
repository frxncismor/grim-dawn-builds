import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import {
  buildRobots,
  buildSitemap,
  escapeXml,
  generateSeoFiles,
  normalizeBaseUrl,
  runCli,
  TEMPLATE_PATH,
} from './gen-sitemap.mts';

const TEMPLATE = `User-agent: *
Allow: /

Sitemap: __BASE_URL__/sitemap.xml
`;

const indexable = (title: string) =>
  `<!doctype html><html lang="es"><head><meta name="robots" content="index,follow"><title>${title}</title></head><body><main>${title}</main></body></html>`;
const noindex = (title: string) =>
  `<!doctype html><html lang="es"><head><meta content="noindex,follow" name="robots"><title>${title}</title></head><body><main>${title}</main></body></html>`;

function htmlPath(route: string): string[] {
  return route === '/'
    ? ['browser', 'index.html']
    : ['browser', ...route.slice(1).split('/'), 'index.html'];
}

/** Synthetic artifact: `prerendered-routes.json` plus one HTML file per page in `pages`. */
async function artifact(
  routes: unknown,
  pages: Record<string, string>,
  template: string | null = TEMPLATE,
): Promise<{ root: string; templatePath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'gd-gen-sitemap-'));
  await writeFile(join(root, 'prerendered-routes.json'), JSON.stringify({ routes }));
  for (const [route, html] of Object.entries(pages)) {
    const file = join(root, ...htmlPath(route));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  const templatePath = join(root, 'robots.template.txt');
  if (template !== null) await writeFile(templatePath, template);
  return { root, templatePath };
}

async function cleanup(root: string): Promise<void> {
  if (basename(root).startsWith('gd-gen-sitemap-') && dirname(root) === tmpdir())
    await rm(root, { recursive: true, force: true });
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const BASE = 'https://example.test/';

function fullSite(): { routes: Record<string, object>; pages: Record<string, string> } {
  const routes = {
    '/': {},
    '/404': {},
    '/acerca': {},
    '/legal': {},
    '/tier-list': {},
    '/builds/chaman-demoledor-golpe-primigenio': {},
    '/builds/borrador-preview': {},
    '/builds/borrador': {},
    '/builds/en-revision': {},
    '/autores/placeholder': {},
  };
  const pages: Record<string, string> = {
    '/': indexable('Inicio'),
    '/404': noindex('No encontrada'),
    '/acerca': indexable('Acerca'),
    '/legal': indexable('Legal'),
    '/tier-list': indexable('Tier list'),
    '/builds/chaman-demoledor-golpe-primigenio': indexable('Chamán'),
    '/builds/borrador-preview': indexable('Preview sin meta'),
    '/builds/borrador': noindex('Borrador'),
    '/builds/en-revision': noindex('En revisión'),
    '/autores/placeholder': noindex('Autor placeholder'),
  };
  return { routes, pages };
}

function locs(sitemap: string): string[] {
  return [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
}

test('includes published prerendered routes and excludes 404, previews, noindex pages and absent routes', async () => {
  const site = fullSite();
  const { root, templatePath } = await artifact(site.routes, site.pages);
  try {
    const { sitemap } = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    assert.deepEqual(locs(sitemap), [
      'https://example.test/',
      'https://example.test/acerca',
      'https://example.test/builds/chaman-demoledor-golpe-primigenio',
      'https://example.test/legal',
      'https://example.test/tier-list',
    ]);
    assert.doesNotMatch(sitemap, /\/404/);
    assert.doesNotMatch(sitemap, /-preview/);
    assert.doesNotMatch(sitemap, /\/builds\/borrador</);
    assert.doesNotMatch(sitemap, /en-revision/);
    assert.doesNotMatch(sitemap, /placeholder/);
    assert.doesNotMatch(sitemap, /derechos-/);
    assert.doesNotMatch(sitemap, /link-only/);
  } finally {
    await cleanup(root);
  }
});

test('non-publishable states (draft, review, rights not approved, link_only) never reach the sitemap', async () => {
  // Real public builds do not prerender these routes. They are absent from prerendered-routes.json.
  const site = fullSite();
  const absent = [
    '/builds/derechos-pendientes',
    '/builds/derechos-denegados',
    '/builds/derechos-revocados',
    '/builds/link-only-sin-cuerpo',
  ];
  for (const route of absent) assert.equal(site.routes[route], undefined);
  const { root, templatePath } = await artifact(site.routes, site.pages);
  try {
    const { sitemap, routes } = await generateSeoFiles({
      distRoot: root,
      baseUrl: BASE,
      templatePath,
    });
    for (const route of absent) assert.ok(!routes.includes(route));
    assert.deepEqual(
      routes.filter((route) => route.startsWith('/builds/')),
      ['/builds/chaman-demoledor-golpe-primigenio'],
    );
    assert.doesNotMatch(sitemap, /derechos-/);
    assert.doesNotMatch(sitemap, /link-only/);
    assert.doesNotMatch(sitemap, /\/builds\/borrador</);
  } finally {
    await cleanup(root);
  }
});

test('a rights-blocked route that leaks into the artifact is still excluded when its HTML is noindex', async () => {
  const routes = { '/': {}, '/builds/derechos-denegados': {}, '/builds/derechos-revocados': {} };
  const pages = {
    '/': indexable('Inicio'),
    '/builds/derechos-denegados': noindex('Denegado'),
    '/builds/derechos-revocados': noindex('Revocado'),
  };
  const { root, templatePath } = await artifact(routes, pages);
  try {
    const { sitemap } = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    assert.deepEqual(locs(sitemap), ['https://example.test/']);
    assert.doesNotMatch(sitemap, /derechos-/);
  } finally {
    await cleanup(root);
  }
});

test('excludes any route with a -preview segment even when its HTML is indexable', async () => {
  const routes = { '/': {}, '/builds/x-preview/detalle': {}, '/builds/x-previewer': {} };
  const pages = {
    '/': indexable('Inicio'),
    '/builds/x-preview/detalle': indexable('Preview'),
    '/builds/x-previewer': indexable('Otra'),
  };
  const { root, templatePath } = await artifact(routes, pages);
  try {
    const { sitemap } = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    assert.deepEqual(locs(sitemap), [
      'https://example.test/',
      'https://example.test/builds/x-previewer',
    ]);
  } finally {
    await cleanup(root);
  }
});

test('never adds /builds/ entries when no build is prerendered', async () => {
  const routes = { '/': {}, '/tier-list': {} };
  const pages = { '/': indexable('Inicio'), '/tier-list': indexable('Tier list') };
  const { root, templatePath } = await artifact(routes, pages);
  try {
    const { sitemap } = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    assert.deepEqual(locs(sitemap), ['https://example.test/', 'https://example.test/tier-list']);
    assert.doesNotMatch(sitemap, /\/builds\//);
  } finally {
    await cleanup(root);
  }
});

test('fails when a listed route has no HTML in the artifact', async () => {
  const { root, templatePath } = await artifact(
    { '/': {}, '/fantasma': {} },
    { '/': indexable('Inicio') },
  );
  try {
    await assert.rejects(generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath }), {
      message: /fantasma/,
    });
  } finally {
    await cleanup(root);
  }
});

test('fails when prerendered-routes.json is missing, invalid or lists no routes', async () => {
  const missing = await mkdtemp(join(tmpdir(), 'gd-gen-sitemap-'));
  const invalid = await mkdtemp(join(tmpdir(), 'gd-gen-sitemap-'));
  const empty = await artifact({}, { '/': indexable('Inicio') });
  const onlyExcluded = await artifact({ '/404': {} }, { '/404': noindex('No encontrada') });
  try {
    await mkdir(join(missing, 'browser'), { recursive: true });
    await assert.rejects(
      generateSeoFiles({ distRoot: missing, baseUrl: BASE, templatePath: TEMPLATE_PATH }),
      {
        message: /prerendered-routes\.json/,
      },
    );
    await writeFile(join(invalid, 'prerendered-routes.json'), '{"routes":');
    await assert.rejects(
      generateSeoFiles({ distRoot: invalid, baseUrl: BASE, templatePath: TEMPLATE_PATH }),
      {
        message: /prerendered-routes\.json/,
      },
    );
    await assert.rejects(
      generateSeoFiles({ distRoot: empty.root, baseUrl: BASE, templatePath: empty.templatePath }),
      { message: /sin rutas publicables/ },
    );
    await assert.rejects(
      generateSeoFiles({
        distRoot: onlyExcluded.root,
        baseUrl: BASE,
        templatePath: onlyExcluded.templatePath,
      }),
      { message: /sin rutas publicables/ },
    );
  } finally {
    await cleanup(missing);
    await cleanup(invalid);
    await cleanup(empty.root);
    await cleanup(onlyExcluded.root);
  }
});

test('rejects unsafe route keys before touching the filesystem', async () => {
  const unsafe = [
    'acerca',
    '//evil.test/',
    '/a/../b',
    '/a?x=1',
    '/a#x',
    '\\\\server\\x',
    'https://evil.test/',
    '/a%2e%2e/b',
    '/a b',
  ];
  for (const route of unsafe) {
    const { root, templatePath } = await artifact(
      { '/': {}, [route]: {} },
      { '/': indexable('Inicio') },
    );
    try {
      await assert.rejects(generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath }), {
        message: /ruta no segura/,
      });
    } finally {
      await cleanup(root);
    }
  }
});

test('robots.txt receives the absolute base URL and keeps a path prefix', async () => {
  const { root, templatePath } = await artifact({ '/': {} }, { '/': indexable('Inicio') });
  try {
    const plain = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    assert.equal(
      plain.robots,
      'User-agent: *\nAllow: /\n\nSitemap: https://example.test/sitemap.xml\n',
    );

    const prefixed = await generateSeoFiles({
      distRoot: root,
      baseUrl: 'https://example.test/grim',
      templatePath,
    });
    assert.match(prefixed.robots, /^Sitemap: https:\/\/example\.test\/grim\/sitemap\.xml$/m);
    assert.doesNotMatch(prefixed.robots, /__BASE_URL__/);
  } finally {
    await cleanup(root);
  }
});

test('the versioned public/robots.txt template is valid and has no Disallow', async () => {
  const template = await readFile(TEMPLATE_PATH, 'utf8');
  assert.equal(template.split('__BASE_URL__').length - 1, 1);
  assert.match(template, /^User-agent: \*$/m);
  assert.match(template, /^Allow: \/$/m);
  assert.doesNotMatch(template, /^Disallow:/m);
  assert.equal(
    buildRobots(template, BASE),
    'User-agent: *\nAllow: /\n\nSitemap: https://example.test/sitemap.xml\n',
  );
});

test('BASE_URL uses the same rules as normalizeSiteUrl', () => {
  assert.equal(normalizeBaseUrl('https://example.test'), 'https://example.test/');
  assert.equal(normalizeBaseUrl('https://example.test/grim'), 'https://example.test/grim/');
  assert.equal(normalizeBaseUrl('http://localhost:4200/'), 'http://localhost:4200/');
  const invalid = [
    '',
    '/grim/',
    'example.test',
    'not a url',
    'file:///tmp/site',
    'ftp://example.test/',
    'https://user:secret@example.test/',
    'https://example.test/?utm=1',
    'https://example.test/#top',
    'https://example.test/?',
    'https://example.test/#',
  ];
  for (const value of invalid)
    assert.throws(() => normalizeBaseUrl(value), { message: /BASE_URL/ }, value);
});

test('generation fails for invalid BASE_URL and does not echo credentials', async () => {
  const site = fullSite();
  const { root, templatePath } = await artifact(site.routes, site.pages);
  try {
    await assert.rejects(
      generateSeoFiles({
        distRoot: root,
        baseUrl: 'https://user:secret@example.test/',
        templatePath,
      }),
      (error: unknown) => error instanceof Error && !error.message.includes('secret'),
    );
  } finally {
    await cleanup(root);
  }
});

test('robots.txt fails when the token is missing, duplicated or the required rules are absent', () => {
  assert.throws(() => buildRobots('User-agent: *\nAllow: /\n', BASE), { message: /__BASE_URL__/ });
  assert.throws(
    () =>
      buildRobots(
        'User-agent: *\nAllow: /\nSitemap: __BASE_URL__/sitemap.xml\nSitemap: __BASE_URL__/sitemap.xml\n',
        BASE,
      ),
    { message: /__BASE_URL__/ },
  );
  assert.throws(() => buildRobots('Allow: /\nSitemap: __BASE_URL__/sitemap.xml\n', BASE), {
    message: /User-agent/,
  });
  assert.throws(() => buildRobots('User-agent: *\nSitemap: __BASE_URL__/sitemap.xml\n', BASE), {
    message: /Allow/,
  });
});

test('two consecutive runs produce identical sitemap.xml and robots.txt bytes', async () => {
  const site = fullSite();
  const { root, templatePath } = await artifact(site.routes, site.pages);
  try {
    const first = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    const second = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    assert.equal(sha256(first.sitemap), sha256(second.sitemap));
    assert.equal(sha256(first.robots), sha256(second.robots));
  } finally {
    await cleanup(root);
  }
});

test('sitemap is well-formed, uses LF, has no lastmod and a stable ascending order', async () => {
  const site = fullSite();
  const { root, templatePath } = await artifact(site.routes, site.pages);
  try {
    const { sitemap } = await generateSeoFiles({ distRoot: root, baseUrl: BASE, templatePath });
    assert.ok(
      sitemap.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
      ),
    );
    assert.ok(sitemap.endsWith('</urlset>\n'));
    assert.doesNotMatch(sitemap, /\r/);
    assert.doesNotMatch(sitemap, /lastmod/);
    const current = locs(sitemap);
    assert.deepEqual(current, [...current].sort());
  } finally {
    await cleanup(root);
  }
});

test('escapes XML special characters and builds URLs under a path prefix', () => {
  assert.equal(escapeXml(`a&b<c>"d"'e'`), 'a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
  const sitemap = buildSitemap(['/', '/acerca'], 'https://example.test/a&b');
  assert.match(sitemap, /<loc>https:\/\/example\.test\/a&amp;b\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.test\/a&amp;b\/acerca<\/loc>/);
  assert.doesNotMatch(sitemap, /\/\/acerca/);
  const grim = buildSitemap(['/', '/acerca'], 'https://example.test/grim/');
  assert.deepEqual(locs(grim), ['https://example.test/grim/', 'https://example.test/grim/acerca']);
});

test('CLI writes sitemap.xml and robots.txt only inside browser/', async () => {
  const site = fullSite();
  const { root } = await artifact(site.routes, site.pages);
  try {
    const before = (await readdir(root, { recursive: true }))
      .map((p) => p.replace(/\\/g, '/'))
      .sort();
    const result = await runCli(['--dist', root], { BASE_URL: 'https://example.test/grim/' });
    assert.equal(result.exitCode, 0);
    const after = (await readdir(root, { recursive: true }))
      .map((p) => p.replace(/\\/g, '/'))
      .sort();
    const added = after.filter((path) => !before.includes(path));
    assert.deepEqual(added, ['browser/robots.txt', 'browser/sitemap.xml']);
    const robots = await readFile(join(root, 'browser', 'robots.txt'), 'utf8');
    assert.match(robots, /^Sitemap: https:\/\/example\.test\/grim\/sitemap\.xml$/m);
    const sitemap = await readFile(join(root, 'browser', 'sitemap.xml'), 'utf8');
    assert.match(sitemap, /<loc>https:\/\/example\.test\/grim\/acerca<\/loc>/);
  } finally {
    await cleanup(root);
  }
});

test('CLI uses the local default BASE_URL and rejects unknown or incomplete arguments', async () => {
  const site = fullSite();
  const { root } = await artifact(site.routes, site.pages);
  try {
    assert.equal((await runCli(['--dist', root], {})).exitCode, 0);
    assert.match(
      await readFile(join(root, 'browser', 'robots.txt'), 'utf8'),
      /^Sitemap: http:\/\/localhost:4200\/sitemap\.xml$/m,
    );
    for (const argv of [['--otra'], ['--dist'], ['--dist', root, 'extra']]) {
      const result = await runCli(argv, {});
      assert.equal(result.exitCode, 1);
      assert.doesNotMatch(result.message, new RegExp(root.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')));
    }
  } finally {
    await cleanup(root);
  }
});

test('CLI failure reports no BASE_URL secret and writes no files', async () => {
  const site = fullSite();
  const { root } = await artifact(site.routes, site.pages);
  try {
    const result = await runCli(['--dist', root], {
      BASE_URL: 'https://user:secret@example.test/',
    });
    assert.equal(result.exitCode, 1);
    assert.doesNotMatch(result.message, /secret/);
    await assert.rejects(readFile(join(root, 'browser', 'sitemap.xml'), 'utf8'));
    await assert.rejects(readFile(join(root, 'browser', 'robots.txt'), 'utf8'));
  } finally {
    await cleanup(root);
  }
});
