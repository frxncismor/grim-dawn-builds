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
  INITIAL_JS_LIMIT,
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
    assert.equal(budgets[1].limitBytes, 110000);
    assert.ok(budgets[1].files.some((f) => f.file === 'tier.js'));
    assert.ok(budgets[1].files.some((f) => f.file === 'inline-script-1' && f.gzipBytes > 0));
    await writeFile(join(root, 'browser/shared.js'), randomBytes(160000));
    budgets = await measureInitialRoutes(root);
    assert.ok(budgets[1].totalGzipBytes > 110000);
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
