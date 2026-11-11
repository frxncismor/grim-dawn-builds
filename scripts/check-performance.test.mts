import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { CATALOG_JS_LIMIT, INITIAL_JS_LIMIT, measureInitialRoutes } from './check-initial-js.mts';
import {
  BUDGETS,
  aggregateRouteRuns,
  budgetDrift,
  collectRouteRuns,
  evaluateJsBudgets,
  evaluateLighthouseReport,
  lhciRunOptions,
  measureCriticalCss,
  measureHtml,
  median,
  normalizeRoute,
  readLighthouseBudgets,
  readLighthouseConfig,
  routeFilePath,
} from './check-performance.mts';

interface ReportOptions {
  lcp?: number;
  cls?: number;
  tbt?: number;
  performance?: number;
  accessibility?: number;
  seo?: number;
  bestPractices?: number;
}

/** Informe Lighthouse sintético: sin navegador ni red, forma real del LHR. */
function lighthouseReport(options: ReportOptions = {}) {
  return {
    lighthouseVersion: '13.6.0',
    requestedUrl: 'http://localhost/index.html',
    runtimeEnvironment: { browserUserAgent: 'Mozilla/5.0 Chrome/157.0.0.0' },
    configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate' },
    categories: {
      performance: { score: options.performance ?? 1 },
      accessibility: { score: options.accessibility ?? 1 },
      seo: { score: options.seo ?? 1 },
      'best-practices': { score: options.bestPractices ?? 1 },
    },
    audits: {
      'largest-contentful-paint': { numericValue: options.lcp ?? 700 },
      'cumulative-layout-shift': { numericValue: options.cls ?? 0 },
      'total-blocking-time': { numericValue: options.tbt ?? 140 },
    },
  };
}

function metricById(report: unknown, id: string) {
  const result = evaluateLighthouseReport(report).find((entry) => entry.id === id);
  assert.ok(result, `El informe no produjo la métrica ${id}.`);
  return result;
}

/** Relleno incompresible cuyo gzip nivel 6 mide exactamente `target` bytes. */
function fillToGzip(target: number): Buffer {
  let size = target;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (size <= 0) break;
    const candidate = randomBytes(size);
    const bytes = gzipSync(candidate, { level: 6 }).length;
    if (bytes === target) return candidate;
    size += target - bytes;
  }
  throw new Error(`No se pudo construir un CSS de ${target} B gzip nivel 6.`);
}

test('las rutas del artefacto se normalizan a su archivo servido', () => {
  assert.equal(routeFilePath('artifact', '/'), join('artifact', 'browser', 'index.html'));
  assert.equal(
    routeFilePath('artifact', 'http://localhost/tier-list'),
    join('artifact', 'browser', 'tier-list', 'index.html'),
  );
  assert.equal(
    routeFilePath('artifact', '/autores/grim-dawn-builds/index.html'),
    join('artifact', 'browser', 'autores', 'grim-dawn-builds', 'index.html'),
  );
  assert.equal(normalizeRoute('http://localhost/index.html'), '/');
  assert.equal(normalizeRoute('/'), '/');
  assert.equal(normalizeRoute('/tier-list/'), '/tier-list');
  assert.throws(() => routeFilePath('artifact', ''));
  assert.throws(() => routeFilePath('artifact', '/..%2Fsecreto.html'));
});

test('T-042: el TBT de 173 ms incumple el presupuesto y 140 ms cumple', () => {
  const failing = metricById(lighthouseReport({ tbt: 173 }), 'tbt');
  assert.equal(failing.value, 173);
  assert.equal(failing.limit, BUDGETS.tbtMs);
  assert.equal(failing.pass, false);
  assert.ok(evaluateLighthouseReport(lighthouseReport({ tbt: 173 })).some((r) => !r.pass));

  const passing = evaluateLighthouseReport(lighthouseReport({ tbt: 140 }));
  assert.equal(passing.length, 7);
  assert.ok(passing.every((result) => result.measured && result.pass));
});

test('LCP, CLS y puntuaciones respetan el límite exacto', () => {
  assert.equal(metricById(lighthouseReport({ lcp: 2000 }), 'lcp').pass, true);
  assert.equal(metricById(lighthouseReport({ lcp: 2000.1 }), 'lcp').pass, false);
  assert.equal(metricById(lighthouseReport({ cls: 0.05 }), 'cls').pass, true);
  assert.equal(metricById(lighthouseReport({ cls: 0.051 }), 'cls').pass, false);
  assert.equal(metricById(lighthouseReport({ performance: 0.9 }), 'performance').pass, true);
  assert.equal(metricById(lighthouseReport({ performance: 0.89 }), 'performance').pass, false);
  assert.equal(metricById(lighthouseReport({ accessibility: 0.95 }), 'accessibility').pass, true);
  assert.equal(metricById(lighthouseReport({ accessibility: 0.949 }), 'accessibility').pass, false);
  assert.equal(metricById(lighthouseReport({ seo: 0.95 }), 'seo').pass, true);
  assert.equal(metricById(lighthouseReport({ seo: 0.94 }), 'seo').pass, false);
  assert.equal(metricById(lighthouseReport({ bestPractices: 0.95 }), 'best-practices').pass, true);
  assert.equal(metricById(lighthouseReport({ bestPractices: 0.94 }), 'best-practices').pass, false);
});

test('un informe incompleto nunca aprueba: lo no medible es violación', () => {
  const withoutTbt = lighthouseReport();
  delete (withoutTbt.audits as Record<string, unknown>)['total-blocking-time'];
  const tbt = metricById(withoutTbt, 'tbt');
  assert.equal(tbt.measured, false);
  assert.equal(tbt.value, null);
  assert.equal(tbt.pass, false);

  const withoutSeo = lighthouseReport();
  delete (withoutSeo.categories as Record<string, unknown>)['seo'];
  const seo = metricById(withoutSeo, 'seo');
  assert.equal(seo.measured, false);
  assert.equal(seo.pass, false);

  const notNumbers = lighthouseReport();
  (notNumbers.audits['cumulative-layout-shift'] as { numericValue: unknown }).numericValue = null;
  (notNumbers.audits['total-blocking-time'] as { numericValue: unknown }).numericValue = Number.NaN;
  const cls = metricById(notNumbers, 'cls');
  assert.equal(cls.measured, false);
  assert.equal(cls.pass, false);
  const nan = metricById(notNumbers, 'tbt');
  assert.equal(nan.measured, false);
  assert.equal(nan.pass, false);

  const missing = evaluateLighthouseReport(null);
  assert.equal(missing.length, 7);
  assert.ok(missing.every((result) => !result.measured && !result.pass));
});

test('T-042: la puerta decide sobre la mediana de tres corridas por ruta', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.throws(() => median([]));

  const tbtPass = aggregateRouteRuns(
    [253, 43, 60].map((tbt) => lighthouseReport({ tbt })),
    3,
  );
  assert.deepEqual(tbtPass.problems, []);
  const tbtMedian = tbtPass.lighthouse.find((result) => result.id === 'tbt');
  assert.equal(tbtMedian?.value, 60);
  assert.equal(tbtMedian?.pass, true);

  const tbtFail = aggregateRouteRuns(
    [200, 210, 190].map((tbt) => lighthouseReport({ tbt })),
    3,
  );
  const failing = tbtFail.lighthouse.find((result) => result.id === 'tbt');
  assert.equal(failing?.value, 200);
  assert.equal(failing?.pass, false);

  const perfPass = aggregateRouteRuns(
    [0.89, 0.99, 0.99].map((performance) => lighthouseReport({ performance })),
    3,
  );
  const perf = perfPass.lighthouse.find((result) => result.id === 'performance');
  assert.equal(perf?.value, 0.99);
  assert.equal(perf?.pass, true);

  const perfFail = aggregateRouteRuns(
    [0.89, 0.9, 0.89].map((performance) => lighthouseReport({ performance })),
    3,
  );
  const lowScore = perfFail.lighthouse.find((result) => result.id === 'performance');
  assert.equal(lowScore?.value, 0.89);
  assert.equal(lowScore?.pass, false);
});

test('T-042: una corrida sin TBT deja la métrica no medible y nunca aprueba', () => {
  const incomplete = lighthouseReport();
  delete (incomplete.audits as Record<string, unknown>)['total-blocking-time'];
  const { lighthouse, problems } = aggregateRouteRuns(
    [lighthouseReport({ tbt: 10 }), incomplete, lighthouseReport({ tbt: 10 })],
    3,
  );
  assert.deepEqual(problems, []);
  const tbt = lighthouse.find((result) => result.id === 'tbt');
  assert.equal(tbt?.measured, false);
  assert.equal(tbt?.pass, false);
});

test('T-042: menos, más o ningún informe que numberOfRuns falla cerrado', () => {
  const fewer = aggregateRouteRuns([lighthouseReport(), lighthouseReport()], 3);
  assert.equal(fewer.problems.length, 1);
  assert.match(fewer.problems[0]!, /se esperaban 3 informes de Lighthouse y hay 2/);

  const more = aggregateRouteRuns(
    [1, 2, 3, 4].map(() => lighthouseReport()),
    3,
  );
  assert.match(more.problems[0]!, /se esperaban 3 informes de Lighthouse y hay 4/);

  const none = aggregateRouteRuns([], 3);
  assert.match(none.problems[0]!, /hay 0/);
  assert.ok(none.lighthouse.every((result) => !result.measured && !result.pass));
});

test('T-042: un informe ilegible entre tres falla cerrado y se reporta', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-performance-runs-'));
  try {
    const reportsDir = join(root, 'reports');
    await mkdir(reportsDir);
    await writeFile(join(reportsDir, 'a-1.report.json'), JSON.stringify(lighthouseReport({ tbt: 253 })));
    await writeFile(join(reportsDir, 'a-2.report.json'), '{"lighthouseVersion": ');
    await writeFile(join(reportsDir, 'a-3.report.json'), JSON.stringify(lighthouseReport({ tbt: 60 })));

    const collected = await collectRouteRuns(reportsDir, ['http://localhost/index.html']);
    assert.equal(collected.runs.get('/')?.length, 2);
    assert.equal(collected.problems.length, 1);
    assert.match(collected.problems[0]!, /a-2\.report\.json: el informe es ilegible/);
    const aggregate = aggregateRouteRuns(collected.runs.get('/') ?? [], 3);
    assert.equal(aggregate.problems.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('T-042: informes de URL ajena, sin URL o sin directorio fallan cerrado', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-performance-foreign-'));
  try {
    const reportsDir = join(root, 'reports');
    await mkdir(reportsDir);
    await writeFile(
      join(reportsDir, 'ajena.report.json'),
      JSON.stringify({ ...lighthouseReport(), requestedUrl: 'http://localhost/otra' }),
    );
    await writeFile(join(reportsDir, 'sin-url.report.json'), '{}');

    const collected = await collectRouteRuns(reportsDir, ['http://localhost/index.html']);
    assert.equal(collected.runs.size, 0);
    assert.equal(collected.problems.length, 2);
    assert.match(collected.problems[0]!, /ajena\.report\.json: URL inesperada/);
    assert.match(collected.problems[1]!, /sin-url\.report\.json: el informe no declara la URL/);

    const missing = await collectRouteRuns(join(root, 'no-existe'), ['http://localhost/index.html']);
    assert.equal(missing.runs.size, 0);
    assert.equal(missing.problems.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('el HTML se mide en bytes UTF-8 reales contra 120000', async () => {
  assert.equal(measureHtml('x'.repeat(BUDGETS.htmlBytes), '/').pass, true);
  assert.equal(measureHtml('x'.repeat(BUDGETS.htmlBytes + 1), '/').pass, false);

  const root = await mkdtemp(join(tmpdir(), 'gd-performance-html-'));
  try {
    await mkdir(join(root, 'browser', 'tier-list'), { recursive: true });
    const html = `<p>${'á'.repeat(10)}</p>`;
    await writeFile(join(root, 'browser', 'tier-list', 'index.html'), html);
    const measured = measureHtml(
      await readFile(routeFilePath(root, 'http://localhost/tier-list/index.html'), 'utf8'),
      '/tier-list',
    );
    assert.equal(measured.route, '/tier-list');
    assert.equal(measured.bytes, Buffer.byteLength(html, 'utf8'));
    assert.equal(measured.limitBytes, BUDGETS.htmlBytes);
    assert.equal(measured.pass, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('el CSS crítico suma gzip nivel 6 y falla un byte por encima de 20000', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-performance-css-'));
  try {
    await mkdir(join(root, 'browser'), { recursive: true });
    const reader = (relative: string) => readFile(join(root, 'browser', relative));
    const html =
      '<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="styles.css">';

    const atLimit = fillToGzip(BUDGETS.cssGzipBytes);
    await writeFile(join(root, 'browser', 'styles.css'), atLimit);
    const passing = await measureCriticalCss(html, reader);
    assert.equal(passing.stylesheets.length, 1, 'el href repetido es una sola descarga');
    assert.equal(passing.bytes, BUDGETS.cssGzipBytes);
    assert.equal(passing.pass, true);

    await writeFile(join(root, 'browser', 'styles.css'), fillToGzip(BUDGETS.cssGzipBytes + 1));
    const failing = await measureCriticalCss(html, reader);
    assert.equal(failing.bytes, BUDGETS.cssGzipBytes + 1);
    assert.equal(failing.pass, false);

    const printIgnored = await measureCriticalCss(
      '<link rel="stylesheet" href="styles.css" media="print"><link rel="stylesheet" href="styles.css">',
      reader,
    );
    assert.equal(printIgnored.stylesheets.length, 1);
    assert.equal(printIgnored.pass, false);

    await assert.rejects(() =>
      measureCriticalCss('<link rel="stylesheet" href="missing.css">', reader),
    );
    await assert.rejects(() =>
      measureCriticalCss('<link rel="stylesheet" href="https://cdn.test/x.css">', reader),
    );
    await assert.rejects(() => measureCriticalCss('<p>sin CSS</p>', reader));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('LHCI corre en un directorio temporal propio con rutas absolutas', async () => {
  const repoRoot = resolve('artifact-root');
  const artifactDir = join(repoRoot, 'dist', 'grim-dawn-builds');
  const reportsDir = join(repoRoot, 'dist', 'lighthouse-performance');
  const configPath = join(repoRoot, 'lighthouserc.json');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const workDir = await mkdtemp(join(tmpdir(), 'gd-lhci-test-'));
  try {
    const options = { repoRoot, artifactDir, reportsDir, configPath, workDir, chromePath };
    const invocation = lhciRunOptions(options);

    assert.equal(invocation.command, 'pnpm');
    assert.deepEqual(invocation.args.slice(0, 3), ['exec', 'lhci', 'autorun']);
    assert.equal(invocation.cwd, resolve(workDir));
    assert.notEqual(invocation.cwd, repoRoot);
    assert.equal(invocation.env['CI'], 'true');
    assert.equal(invocation.env['CHROME_PATH'], chromePath);

    // Nada depende del cwd: cada ruta que LHCI necesita va absoluta por argumento.
    const routedArgs = invocation.args.slice(3);
    assert.equal(routedArgs.length, 3);
    for (const arg of routedArgs) {
      const value = arg.slice(arg.indexOf('=') + 1);
      assert.ok(isAbsolute(value), `${arg} no usa una ruta absoluta`);
      assert.doesNotMatch(arg, /\.lighthouseci/i);
    }
    assert.ok(invocation.args.includes(`--config=${configPath}`));
    assert.ok(invocation.args.includes(`--collect.staticDistDir=${join(artifactDir, 'browser')}`));
    assert.ok(invocation.args.includes(`--upload.outputDir=${reportsDir}`));

    // La raíz del repositorio nunca es el cwd de LHCI: allí vive el `.lighthouseci` compartido.
    assert.throws(() => lhciRunOptions({ ...options, workDir: repoRoot }));
    assert.throws(() => lhciRunOptions({ ...options, workDir: '' }));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test('sin artefacto el comando falla cerrado antes de lanzar Lighthouse', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-performance-empty-'));
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(import.meta.dirname, 'check-performance.mts'), '--dir', root],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /falta el artefacto de build/);
    assert.match(result.stderr, /pnpm build/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /lhci autorun/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lighthouserc.json es la fuente única y no deriva de BUDGETS', async () => {
  const config = JSON.parse(
    await readFile(new URL('../lighthouserc.json', import.meta.url), 'utf8'),
  ) as unknown;
  const budgets = readLighthouseBudgets(config);
  assert.deepEqual(budgetDrift(budgets), []);
  assert.equal(budgets.lcpMs, 2000);
  assert.equal(budgets.cls, 0.05);
  assert.equal(budgets.tbtMs, 150);
  assert.deepEqual(budgets.scores, {
    performance: 0.9,
    accessibility: 0.95,
    seo: 0.95,
    bestPractices: 0.95,
  });
  const info = readLighthouseConfig(config);
  assert.equal(info.formFactor, 'mobile');
  assert.equal(info.throttlingMethod, 'simulate');
  assert.equal(info.numberOfRuns, 3);
  assert.ok(info.urls.length > 0);
  assert.throws(() =>
    readLighthouseConfig({ ...config, ci: { ...(config as { ci: object }).ci, collect: { url: ['http://localhost/'], numberOfRuns: 1 }, upload: { outputDir: 'x' } } }),
  );
  assert.ok(info.outputDir.length > 0);
  assert.deepEqual(budgetDrift({ ...budgets, tbtMs: 173 }), [
    { metric: 'TBT (ms)', expected: 150, actual: 173 },
  ]);
  assert.throws(() => readLighthouseBudgets({}));
  assert.throws(() =>
    readLighthouseBudgets({
      ci: { assert: { assertions: { 'total-blocking-time': ['warn', { maxNumericValue: 150 }] } } },
    }),
  );
});

test('los presupuestos JS reutilizan los límites de check-initial-js.mts', async () => {
  assert.equal(BUDGETS.jsBytes.home, INITIAL_JS_LIMIT);
  assert.equal(BUDGETS.jsBytes.tierList, CATALOG_JS_LIMIT);

  const atLimit = evaluateJsBudgets([
    { route: '/', totalGzipBytes: INITIAL_JS_LIMIT, limitBytes: INITIAL_JS_LIMIT },
    { route: '/tier-list', totalGzipBytes: CATALOG_JS_LIMIT, limitBytes: CATALOG_JS_LIMIT },
  ]);
  assert.ok(atLimit.every((result) => result.pass));
  const over = evaluateJsBudgets([
    { route: '/tier-list', totalGzipBytes: CATALOG_JS_LIMIT + 1, limitBytes: CATALOG_JS_LIMIT },
  ]);
  assert.equal(over[0]?.pass, false);
  assert.throws(() =>
    evaluateJsBudgets([{ route: '/', totalGzipBytes: 1, limitBytes: CATALOG_JS_LIMIT }]),
  );

  const root = await mkdtemp(join(tmpdir(), 'gd-performance-js-'));
  try {
    await mkdir(join(root, 'browser'));
    await writeFile(
      join(root, 'stats.json'),
      JSON.stringify({
        outputs: {
          'main.js': {
            entryPoint: 'src/main.ts',
            imports: [{ path: 'home.js', kind: 'dynamic-import' }],
          },
          'polyfills.js': { imports: [] },
          'home.js': {
            entryPoint: 'src/app/features/home/home.page.ts',
            imports: [{ path: 'shared.js', kind: 'import-statement' }],
          },
          'shared.js': { imports: [] },
        },
      }),
    );
    await writeFile(
      join(root, 'browser/index.html'),
      '<script type="module" src="polyfills.js"></script><script type="module" src="main.js"></script>',
    );
    for (const name of ['main.js', 'polyfills.js', 'home.js'])
      await writeFile(join(root, 'browser', name), 'console.log(1)');
    await writeFile(join(root, 'browser/shared.js'), 'console.log(2)');
    const measured = await measureInitialRoutes(root);
    const results = evaluateJsBudgets(measured);
    assert.equal(results[0]?.id, 'js:/');
    assert.equal(results[0]?.limit, INITIAL_JS_LIMIT);
    assert.ok(results.every((result) => result.pass));

    await writeFile(join(root, 'browser/shared.js'), randomBytes(130000));
    const exceeded = evaluateJsBudgets(await measureInitialRoutes(root));
    assert.equal(exceeded[0]?.pass, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
