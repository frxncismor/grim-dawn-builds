import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { staticHomeHtml } from './static-home.mts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  collectInitialJs,
  measureInitialJs,
  measureInitialRoutes,
  CATALOG_JS_LIMIT,
  INITIAL_JS_LIMIT,
  BUILD_BUDGET_SLUGS,
  BUILD_JS_LIMIT,
  MASTERY_BUDGET_SLUGS,
  MASTERY_JS_LIMIT,
} from './check-initial-js.mts';

const stats = () => ({
  outputs: {
    'main.js': {
      entryPoint: 'src/main.ts',
      imports: [
        { path: 'shared.js', kind: 'import-statement' },
        { path: 'home.js', kind: 'dynamic-import' },
        { path: 'other.js', kind: 'dynamic-import' },
      ],
    },
    'polyfills.js': { imports: [] },
    'home.js': {
      entryPoint: 'src/app/features/home/home.page.ts',
      imports: [{ path: 'shared.js', kind: 'import-statement' }],
    },
    'shared.js': { imports: [] },
    'other.js': { entryPoint: 'src/app/features/build/build.page.ts', imports: [] },
  },
});
const html =
  '<script type="module" src="polyfills.js"></script><script type="module" src="main.js"></script>';

test('includes lazy Home and shared static imports once, excluding unrelated routes', () => {
  assert.deepEqual(collectInitialJs(stats(), html), [
    'home.js',
    'main.js',
    'polyfills.js',
    'shared.js',
  ]);
});

test('zero is accepted only for a structurally static Home; interactive routes still require scripts', async () => {
  const source = await readFile(new URL('./fixtures/static-home.html', import.meta.url), 'utf8');
  const delivered = staticHomeHtml(source);
  assert.deepEqual(collectInitialJs(stats(), delivered), []);
  assert.throws(() => collectInitialJs(stats(), delivered, 'tier-list'));
  assert.throws(() =>
    collectInitialJs(stats(), source.replace(/<script src="main.js"[^>]*><\/script>/, '')),
  );
  assert.throws(() =>
    collectInitialJs(
      stats(),
      delivered.replace('</app-home-page>', '<button>Copiar</button></app-home-page>'),
    ),
  );
});

test('incomplete metadata, absent Home and external bootstrap scripts fail closed', () => {
  assert.throws(() => collectInitialJs({}, html));
  assert.throws(() =>
    collectInitialJs(stats(), '<script src="https://external.test/a.js"></script>'),
  );
  const incomplete = stats();
  delete (incomplete.outputs as Record<string, unknown>)['shared.js'];
  assert.throws(() => collectInitialJs(incomplete, html));
  const missingHome = stats();
  delete (missingHome.outputs as Record<string, unknown>)['home.js'];
  assert.throws(() => collectInitialJs(missingHome, html));
});

test('static Home does not exempt catalog scripts, real gzip or missing files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-initial-js-tier-'));
  try {
    await mkdir(join(root, 'browser/tier-list'), { recursive: true });
    const meta = stats();
    (meta.outputs as Record<string, unknown>)['tier.js'] = {
      entryPoint: 'src/app/features/tier-list/tier-list.page.ts',
      imports: [{ path: 'shared.js', kind: 'import-statement' }],
    };
    await writeFile(join(root, 'stats.json'), JSON.stringify(meta));
    await writeFile(
      join(root, 'browser/index.html'),
      staticHomeHtml(
        await readFile(new URL('./fixtures/static-home.html', import.meta.url), 'utf8'),
      ),
    );
    await writeFile(
      join(root, 'browser/tier-list/index.html'),
      html + '<script>console.log("inline")</script>',
    );
    for (const name of ['main.js', 'polyfills.js', 'shared.js', 'tier.js'])
      await writeFile(join(root, 'browser', name), 'console.log(1)');
    let budgets = await measureInitialRoutes(root);
    assert.equal(budgets[0].totalGzipBytes, 0);
    assert.equal(budgets[1].limitBytes, CATALOG_JS_LIMIT);
    assert.ok(budgets[1].files.some((f) => f.file === 'tier.js'));
    assert.ok(budgets[1].files.some((f) => f.file === 'inline-script-1' && f.gzipBytes > 0));
    await writeFile(join(root, 'browser/shared.js'), randomBytes(160000));
    budgets = await measureInitialRoutes(root);
    assert.ok(budgets[1].totalGzipBytes > CATALOG_JS_LIMIT);
    await rm(join(root, 'browser/tier-list/index.html'));
    await assert.rejects(measureInitialRoutes(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('measures real gzip bytes and CLI blocks above the unchanged 90000-byte limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-initial-js-'));
  try {
    await mkdir(join(root, 'browser'));
    await writeFile(join(root, 'stats.json'), JSON.stringify(stats()));
    await writeFile(join(root, 'browser/index.html'), html);
    const contents = {
      'main.js': 'console.log("main");',
      'home.js': 'console.log("home");',
      'polyfills.js': 'console.log("polyfill");',
      'shared.js': 'console.log("shared");',
    };
    for (const [file, content] of Object.entries(contents))
      await writeFile(join(root, 'browser', file), content);
    const expected = Object.values(contents).reduce(
      (sum, content) => sum + gzipSync(content, { level: 6 }).length,
      0,
    );
    assert.equal((await measureInitialJs(root)).totalGzipBytes, expected);
    const args = [
      '--import',
      'tsx',
      join(import.meta.dirname, 'check-initial-js.mts'),
      '--dir',
      root,
    ];
    assert.match(execFileSync(process.execPath, args, { encoding: 'utf8' }), /check:initial-js OK/);
    assert.equal(INITIAL_JS_LIMIT, 90000);
    await writeFile(
      join(root, 'browser/shared.js'),
      `const data = "${randomBytes(130000).toString('base64')}";`,
    );
    assert.ok((await measureInitialJs(root)).totalGzipBytes > INITIAL_JS_LIMIT);
    assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }));
    await rm(join(root, 'browser/shared.js'));
    await assert.rejects(measureInitialJs(root));
    assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('mastery tree pages (T013) are measured per slug and locale against the tree-page budget', async () => {
  assert.equal(MASTERY_JS_LIMIT, 150000);
  assert.deepEqual([...MASTERY_BUDGET_SLUGS], ['demolition', 'soldier']);
  const root = await mkdtemp(join(tmpdir(), 'gd-initial-js-mastery-'));
  try {
    const meta = stats();
    (meta.outputs as Record<string, unknown>)['tier.js'] = {
      entryPoint: 'src/app/features/tier-list/tier-list.page.ts',
      imports: [{ path: 'shared.js', kind: 'import-statement' }],
    };
    (meta.outputs as Record<string, unknown>)['mastery.js'] = {
      entryPoint: 'src/app/features/masteries/mastery.page.ts',
      imports: [{ path: 'shared.js', kind: 'import-statement' }],
    };
    await writeFile(join(root, 'stats.json'), JSON.stringify(meta));
    const pages = ['', 'es/'].flatMap((prefix) =>
      ['tier-list', ...MASTERY_BUDGET_SLUGS.map((slug) => `maestrias/${slug}`)].map(
        (page) => `${prefix}${page}`,
      ),
    );
    for (const dir of ['browser', ...['', 'es/'].map((p) => `browser/${p}`)])
      await mkdir(join(root, dir), { recursive: true });
    for (const page of pages) await mkdir(join(root, 'browser', page), { recursive: true });
    for (const prefix of ['', 'es/']) {
      await writeFile(join(root, 'browser', prefix, 'index.html'), html);
      for (const page of ['tier-list', ...MASTERY_BUDGET_SLUGS.map((s) => `maestrias/${s}`)])
        await writeFile(join(root, 'browser', prefix, page, 'index.html'), html);
    }
    for (const name of ['main.js', 'polyfills.js', 'shared.js', 'mastery.js', 'home.js', 'tier.js'])
      await writeFile(join(root, 'browser', name), 'console.log(1)');
    const results = await measureInitialRoutes(root, [[], ['es']]);
    const mastery = results.filter((r) => r.route.includes('/maestrias/'));
    assert.deepEqual(mastery.map((r) => r.route).sort(), [
      '/es/maestrias/demolition',
      '/es/maestrias/soldier',
      '/maestrias/demolition',
      '/maestrias/soldier',
    ]);
    for (const r of mastery) {
      assert.equal(r.limitBytes, MASTERY_JS_LIMIT);
      assert.ok(r.files.some((f) => f.file === 'mastery.js'));
      assert.ok(r.totalGzipBytes <= r.limitBytes);
    }
    // The existing limits are untouched.
    assert.equal(results.find((r) => r.route === '/')?.limitBytes, INITIAL_JS_LIMIT);
    assert.equal(results.find((r) => r.route === '/tier-list')?.limitBytes, CATALOG_JS_LIMIT);
    await writeFile(join(root, 'browser/shared.js'), randomBytes(260000));
    const over = await measureInitialRoutes(root, [[]]);
    assert.ok(
      over
        .filter((r) => r.route.startsWith('/maestrias/'))
        .every((r) => r.totalGzipBytes > MASTERY_JS_LIMIT),
    );
    // A configured budget page missing from the artifact fails closed instead of being skipped.
    await rm(join(root, 'browser/maestrias/soldier/index.html'));
    await assert.rejects(measureInitialRoutes(root, [[]]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the mastery index (T027) is measured at /maestrias and /es/maestrias against the existing catalog limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-initial-js-index-'));
  try {
    const meta = stats();
    (meta.outputs as Record<string, unknown>)['index.js'] = {
      entryPoint: 'src/app/features/masteries/index.page.ts',
      imports: [{ path: 'shared.js', kind: 'import-statement' }],
    };
    await writeFile(join(root, 'stats.json'), JSON.stringify(meta));
    for (const prefix of ['', 'es/']) {
      await mkdir(join(root, 'browser', prefix, 'maestrias'), { recursive: true });
      await writeFile(join(root, 'browser', prefix, 'index.html'), html);
      await writeFile(join(root, 'browser', prefix, 'maestrias', 'index.html'), html);
    }
    for (const name of ['main.js', 'polyfills.js', 'shared.js', 'index.js', 'home.js'])
      await writeFile(join(root, 'browser', name), 'console.log(1)');
    const results = await measureInitialRoutes(root, [[], ['es']]);
    const index = results.filter((r) => /\/maestrias$/.test(r.route));
    assert.deepEqual(index.map((r) => r.route).sort(), ['/es/maestrias', '/maestrias']);
    for (const r of index) {
      assert.equal(r.limitBytes, CATALOG_JS_LIMIT);
      assert.ok(r.files.some((f) => f.file === 'index.js'));
    }
    assert.equal(results.find((r) => r.route === '/')?.limitBytes, INITIAL_JS_LIMIT);
    // A budgeted index page missing from the artifact fails closed instead of being skipped.
    await rm(join(root, 'browser/es/maestrias/index.html'));
    await assert.rejects(measureInitialRoutes(root, [[], ['es']]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('guide pages (spec004 T020) are measured per slug and locale against the guide budget of plan §6', async () => {
  assert.equal(BUILD_JS_LIMIT, 150000);
  assert.deepEqual([...BUILD_BUDGET_SLUGS], ['chaman-demoledor-golpe-primigenio']);
  const root = await mkdtemp(join(tmpdir(), 'gd-initial-js-build-'));
  try {
    const meta = stats();
    (meta.outputs as Record<string, unknown>)['build.js'] = {
      entryPoint: 'src/app/features/build/build-route.page.ts',
      imports: [{ path: 'shared.js', kind: 'import-statement' }],
    };
    await writeFile(join(root, 'stats.json'), JSON.stringify(meta));
    for (const prefix of ['', 'es/']) {
      await mkdir(join(root, 'browser', prefix), { recursive: true });
      await writeFile(join(root, 'browser', prefix, 'index.html'), html);
      for (const slug of BUILD_BUDGET_SLUGS) {
        await mkdir(join(root, 'browser', prefix, 'builds', slug), { recursive: true });
        await writeFile(join(root, 'browser', prefix, 'builds', slug, 'index.html'), html);
      }
    }
    for (const name of ['main.js', 'polyfills.js', 'shared.js', 'build.js', 'home.js'])
      await writeFile(join(root, 'browser', name), 'console.log(1)');
    const results = await measureInitialRoutes(root, [[], ['es']]);
    const guides = results.filter((r) => r.route.includes('/builds/'));
    assert.deepEqual(guides.map((r) => r.route).sort(), [
      '/builds/chaman-demoledor-golpe-primigenio',
      '/es/builds/chaman-demoledor-golpe-primigenio',
    ]);
    for (const r of guides) {
      assert.equal(r.limitBytes, BUILD_JS_LIMIT);
      assert.ok(r.files.some((f) => f.file === 'build.js'));
      assert.ok(r.totalGzipBytes <= r.limitBytes);
    }
    assert.equal(results.find((r) => r.route === '/')?.limitBytes, INITIAL_JS_LIMIT);
    await writeFile(join(root, 'browser/shared.js'), randomBytes(260000));
    const over = await measureInitialRoutes(root, [[]]);
    assert.ok(
      over
        .filter((r) => r.route.startsWith('/builds/'))
        .every((r) => r.totalGzipBytes > BUILD_JS_LIMIT),
    );
    // A configured guide missing from the artifact fails closed instead of being skipped.
    await rm(join(root, 'browser/builds', BUILD_BUDGET_SLUGS[0], 'index.html'));
    await assert.rejects(measureInitialRoutes(root, [[]]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
