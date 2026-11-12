import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { CATALOG_JS_LIMIT, INITIAL_JS_LIMIT, measureInitialRoutes } from './check-initial-js.mts';
import {
  BACKEND_BUDGETS,
  BUDGETS,
  budgetDrift,
  evaluateBackendReport,
  evaluateJsBudgets,
  evaluateLighthouseReport,
  evaluateRouteSets,
  groupReportsByRoute,
  lhciRunOptions,
  measureCriticalCss,
  measureHtml,
  median,
  normalizeRoute,
  parseBackendReport,
  readLighthouseBudgets,
  readLighthouseConfig,
  reportRunDir,
  routeFilePath,
  type BackendMemory,
  type BackendRouteResult,
  type RouteRun,
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

/** Corrida sintética de `/tier-list` con el TBT indicado. */
function tierRun(file: string, tbt: number): RouteRun {
  const report = lighthouseReport({ tbt });
  report.requestedUrl = 'http://localhost/tier-list/index.html';
  return { file, metrics: evaluateLighthouseReport(report) };
}

function tierReports(files: readonly string[]) {
  return files.map((file) => ({ file, url: 'http://localhost/tier-list/index.html' }));
}

function evaluateTier(files: readonly string[], runs: readonly RouteRun[], numberOfRuns: number) {
  const sets = groupReportsByRoute(tierReports(files), ['/tier-list'], numberOfRuns);
  return evaluateRouteSets(sets, new Map(runs.map((run) => [run.file, run])))[0]!;
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

test('la mediana es par/impar y una lista vacía falla cerrado', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([7]), 7);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([64, 74, 117.5, 177, 350]), 117.5);
  assert.throws(() => median([]));
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

test('con numberOfRuns=5 y solo 3 informes la ruta falla cerrado', () => {
  const files = ['run-1.json', 'run-2.json', 'run-3.json'];
  const runs = files.map((file) => tierRun(file, 60));
  const sets = groupReportsByRoute(tierReports(files), ['/tier-list'], 5);
  assert.equal(sets[0]?.expected, 5);
  assert.equal(sets[0]?.files.length, 3);
  assert.deepEqual(sets[0]?.problems, ['3 de 5 informes: faltan 2 corridas']);

  const [evaluation] = evaluateRouteSets(sets, new Map(runs.map((run) => [run.file, run])));
  assert.equal(evaluation?.runs.length, 3);
  assert.ok(evaluation?.unmeasurable.some((reason) => /faltan 2 corridas/.test(reason)));
  assert.ok(evaluation?.medians.every((result) => !result.measured && !result.pass));
});

test('con numberOfRuns=5 y 6 informes sobra uno y la ruta falla cerrado', () => {
  const files = ['run-1.json', 'run-2.json', 'run-3.json', 'run-4.json', 'run-5.json'];
  const sets = groupReportsByRoute(tierReports([...files, 'run-6.json']), ['/tier-list'], 5);
  assert.deepEqual(sets[0]?.problems, ['6 informes para 5 corridas: sobran 1']);
  const runs = files.map((file) => tierRun(file, 60));
  const [evaluation] = evaluateRouteSets(sets, new Map(runs.map((run) => [run.file, run])));
  assert.ok(evaluation?.unmeasurable.some((reason) => /sobran 1/.test(reason)));
  assert.ok(evaluation?.medians.every((result) => !result.measured));
});

test('picos de TBT [64, 74, 117.5, 177, 350] dan mediana 117.5 y pasan', () => {
  const samples = [64, 74, 117.5, 177, 350];
  const files = samples.map((_, index) => `run-${index + 1}.json`);
  const runs = samples.map((tbt, index) => tierRun(files[index]!, tbt));
  const evaluation = evaluateTier(files, runs, 5);
  assert.equal(evaluation.runs.length, 5, 'la tabla publica las cinco corridas');
  assert.deepEqual(
    evaluation.runs.map((run) => run.metrics.find((metric) => metric.id === 'tbt')!.value),
    samples,
  );
  const tbt = evaluation.medians.find((metric) => metric.id === 'tbt')!;
  assert.equal(tbt.value, 117.5);
  assert.equal(tbt.limit, BUDGETS.tbtMs);
  assert.equal(tbt.pass, true);
  assert.ok(evaluation.medians.every((metric) => metric.pass));
  assert.deepEqual(evaluation.unmeasurable, []);
});

test('mediana de TBT [160, 170, 180] = 170 y falla el umbral de 150', () => {
  const samples = [160, 170, 180];
  const files = samples.map((_, index) => `run-${index + 1}.json`);
  const runs = samples.map((tbt, index) => tierRun(files[index]!, tbt));
  const evaluation = evaluateTier(files, runs, 3);
  const tbt = evaluation.medians.find((metric) => metric.id === 'tbt')!;
  assert.equal(tbt.value, 170);
  assert.equal(tbt.pass, false);
  assert.ok(evaluation.medians.some((metric) => !metric.pass));
});

test('una corrida sin TBT invalida la mediana de la ruta completa', () => {
  const files = ['run-1.json', 'run-2.json', 'run-3.json'];
  const brokenReport = lighthouseReport({ tbt: 60 });
  delete (brokenReport.audits as Record<string, unknown>)['total-blocking-time'];
  const runs: RouteRun[] = [
    tierRun(files[0]!, 60),
    { file: files[1]!, metrics: evaluateLighthouseReport(brokenReport) },
    tierRun(files[2]!, 60),
  ];
  const evaluation = evaluateTier(files, runs, 3);
  const tbt = evaluation.medians.find((metric) => metric.id === 'tbt')!;
  assert.equal(tbt.measured, false);
  assert.equal(tbt.pass, false);
  assert.ok(evaluation.unmeasurable.some((reason) => reason.includes('TBT sin medir en run-2')));
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

test('LHCI corre collect y upload en un directorio temporal propio con rutas absolutas', async () => {
  const repoRoot = resolve('artifact-root');
  const artifactDir = join(repoRoot, 'dist', 'grim-dawn-builds');
  const reportsDir = join(repoRoot, 'dist', 'lighthouse-performance');
  const configPath = join(repoRoot, 'lighthouserc.json');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const workDir = await mkdtemp(join(tmpdir(), 'gd-lhci-test-'));
  try {
    const options = { repoRoot, artifactDir, reportsDir, configPath, workDir, chromePath };
    const invocations = lhciRunOptions(options);
    assert.equal(invocations.length, 2);

    const [collect, upload] = invocations;
    assert.ok(collect && upload);
    assert.deepEqual(collect.args.slice(0, 3), ['exec', 'lhci', 'collect']);
    assert.deepEqual(upload.args.slice(0, 3), ['exec', 'lhci', 'upload']);

    for (const invocation of invocations) {
      assert.equal(invocation.command, 'pnpm');
      assert.equal(invocation.cwd, resolve(workDir));
      assert.notEqual(invocation.cwd, repoRoot);
      assert.equal(invocation.env['CI'], 'true');
      assert.equal(invocation.env['CHROME_PATH'], chromePath);
      const routedArgs = invocation.args.slice(3);
      assert.equal(routedArgs.length, 2);
      for (const arg of routedArgs) {
        const value = arg.slice(arg.indexOf('=') + 1);
        assert.ok(isAbsolute(value), `${arg} no usa una ruta absoluta`);
        assert.doesNotMatch(arg, /\.lighthouseci/i);
      }
      assert.ok(invocation.args.includes(`--config=${configPath}`));
    }
    assert.ok(collect.args.includes(`--staticDistDir=${join(artifactDir, 'browser')}`));
    assert.ok(upload.args.includes(`--outputDir=${reportsDir}`));

    // La raíz del repositorio nunca es el cwd de LHCI: allí vive el `.lighthouseci` compartido.
    assert.throws(() => lhciRunOptions({ ...options, workDir: repoRoot }));
    assert.throws(() => lhciRunOptions({ ...options, workDir: '' }));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test('cada ejecución publica sus informes en un subdirectorio único bajo el directorio base', () => {
  const base = resolve('artifact-root', 'dist', 'lighthouse-performance');
  const first = reportRunDir(base);
  const second = reportRunDir(base);
  assert.ok(isAbsolute(first));
  assert.ok(isAbsolute(second));
  assert.notEqual(first, second, 'dos llamadas con el mismo directorio base deben diferir');
  assert.ok(first.startsWith(`${base}${sep}`));
  assert.ok(second.startsWith(`${base}${sep}`));
  assert.match(first, /[\\/]run-\d{8}-\d{6}-[a-z0-9]+$/i);

  const fixed = reportRunDir(base, new Date(2026, 10, 11, 3, 45, 7), 'abc123');
  assert.equal(fixed, join(base, 'run-20261111-034507-abc123'));
  assert.throws(() => reportRunDir(base, new Date(), ''));
  assert.throws(() => reportRunDir(base, new Date(), '///'));
});

test('lhci upload escribe en el directorio único y nunca en el compartido', () => {
  const repoRoot = resolve('artifact-root');
  const base = join(repoRoot, 'dist', 'lighthouse-performance');
  const runDir = reportRunDir(base, new Date(2026, 10, 11, 4, 5, 6), 'beef01');
  const invocations = lhciRunOptions({
    repoRoot,
    artifactDir: join(repoRoot, 'dist', 'grim-dawn-builds'),
    reportsDir: runDir,
    configPath: join(repoRoot, 'lighthouserc.json'),
    workDir: join(tmpdir(), 'gd-lhci-test-subdir'),
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const [collect, upload] = invocations;
  assert.ok(collect && upload);
  assert.ok(upload.args.includes(`--outputDir=${runDir}`));
  const outputArg = upload.args.find((arg) => arg.startsWith('--outputDir='))!;
  assert.ok(outputArg.slice('--outputDir='.length).startsWith(`${base}${sep}`));
  assert.notEqual(outputArg, `--outputDir=${base}`, 'el directorio compartido queda intacto');
  assert.ok(!collect.args.some((arg) => arg.startsWith('--outputDir=')));
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
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /lhci (autorun|collect|upload)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lighthouserc.json es la fuente única de umbrales y de numberOfRuns', async () => {
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
  assert.ok(info.urls.length > 0);
  assert.ok(info.outputDir.length > 0);
  assert.ok(Number.isInteger(info.numberOfRuns) && info.numberOfRuns >= 1);
  assert.deepEqual(budgetDrift({ ...budgets, tbtMs: 173 }), [
    { metric: 'TBT (ms)', expected: 150, actual: 173 },
  ]);

  const withRuns = (numberOfRuns: unknown) => ({
    ci: {
      collect: { url: ['http://localhost/index.html'], numberOfRuns },
      upload: { outputDir: './dist/lighthouse-performance' },
      assert: { assertions: {} },
    },
  });
  assert.equal(readLighthouseConfig(withRuns(5)).numberOfRuns, 5);
  assert.equal(readLighthouseConfig(withRuns(3)).numberOfRuns, 3);
  assert.equal(readLighthouseConfig(withRuns(undefined)).numberOfRuns, 1);
  assert.throws(() => readLighthouseConfig(withRuns(0)));
  assert.throws(() => readLighthouseConfig(withRuns(2.5)));

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

/**
 * T-128: informe backend sintético con la forma exacta que escribe
 * `apps/api/test/performance.int.spec.ts`. Las rutas cubren los tres grupos.
 */
function backendRoute(overrides: Partial<BackendRouteResult> = {}): BackendRouteResult {
  const samples = 40;
  return {
    group: 'read',
    route: '/api/v1/builds',
    samples,
    p95Ms: 10,
    maxMs: 12,
    sampleMs: Array.from({ length: samples }, (_, index) => 1 + (index % 5)),
    statuses: Array.from({ length: samples }, () => 200),
    maxQueriesPerRequest: 3,
    ...overrides,
  };
}

function backendMemory(overrides: Partial<BackendMemory> = {}): BackendMemory {
  return {
    rssBytes: 120 * 1024 * 1024,
    heapUsedBytes: 30 * 1024 * 1024,
    heapTotalBytes: 40 * 1024 * 1024,
    ...overrides,
  };
}

function backendReport(
  overrides: {
    budgets?: Record<string, number>;
    coldStartMs?: number;
    memory?: BackendMemory;
    routes?: BackendRouteResult[];
  } = {},
) {
  return {
    kind: 'backend-performance',
    version: 1,
    measuredAt: '2026-11-11T10:00:00.000Z',
    environment: {
      node: 'v22.12.0',
      platform: 'linux-x64',
      postgres: 'PostgreSQL 17.11',
      image: 'postgres:17.11-trixie@sha256:' + 'a'.repeat(64),
      catalog: {
        builds: 2,
        tier_lists: 1,
        tier_entries: 45,
        masteries: 7,
        authors: 2,
        sources: 2,
        combinations: 45,
      },
      warmupRequests: 5,
    },
    budgets: { ...BACKEND_BUDGETS, ...overrides.budgets },
    results: {
      coldStartMs: overrides.coldStartMs ?? 1200,
      memory: overrides.memory ?? backendMemory(),
      routes: overrides.routes ?? [
        backendRoute({ group: 'health', route: '/health', p95Ms: 2, maxQueriesPerRequest: 0 }),
        backendRoute({ group: 'ready', route: '/ready', p95Ms: 40 }),
        backendRoute(),
      ],
    },
  };
}

const backendGate = (overrides: Parameters<typeof backendReport>[0] = {}) =>
  evaluateBackendReport(parseBackendReport(backendReport(overrides)));

test('T-128: el informe backend completo pasa y publica la memoria real', () => {
  const gate = backendGate();
  assert.deepEqual(gate.budgetDrift, []);
  assert.deepEqual(gate.problems, []);
  assert.deepEqual(gate.checks.map((check) => check.id).sort(), [
    'backend:cold-start',
    'backend:health',
    'backend:queries:/api/v1/builds',
    'backend:queries:/health',
    'backend:queries:/ready',
    'backend:read:/api/v1/builds',
    'backend:ready',
  ]);
  assert.ok(gate.checks.every((check) => check.measured && check.pass));
  assert.equal(gate.runtimeWithinTarget, true);
  assert.equal(gate.memory.rssBytes, 120 * 1024 * 1024);
  assert.equal(gate.environment.catalog['tier_entries'], 45);
});

test('T-128: p95, consultas y arranque por encima del presupuesto fallan', () => {
  const gate = backendGate({
    coldStartMs: BACKEND_BUDGETS.coldStartMs + 1,
    routes: [
      backendRoute({ group: 'health', route: '/health', p95Ms: 50.1, maxQueriesPerRequest: 0 }),
      backendRoute({ group: 'ready', route: '/ready', p95Ms: 200.1 }),
      backendRoute({ p95Ms: 150.1, maxQueriesPerRequest: 7 }),
      backendRoute({
        group: 'read',
        route: '/api/v1/tier-lists/principal',
        p95Ms: 20,
        maxQueriesPerRequest: 6,
      }),
    ],
  });
  const failed = gate.checks
    .filter((check) => !check.pass)
    .map((check) => check.id)
    .sort();
  assert.deepEqual(failed, [
    'backend:cold-start',
    'backend:health',
    'backend:queries:/api/v1/builds',
    'backend:read:/api/v1/builds',
    'backend:ready',
  ]);
});

test('T-128: un límite exacto cumple y un byte de más en memoria solo avisa', () => {
  const gate = backendGate({
    coldStartMs: BACKEND_BUDGETS.coldStartMs,
    routes: [
      backendRoute({ group: 'health', route: '/health', p95Ms: 50, maxQueriesPerRequest: 0 }),
      backendRoute({ group: 'ready', route: '/ready', p95Ms: 200 }),
      backendRoute({ p95Ms: 150, maxQueriesPerRequest: 6 }),
    ],
    memory: backendMemory({ rssBytes: BACKEND_BUDGETS.runtimeTargetBytes + 1 }),
  });
  assert.ok(gate.checks.every((check) => check.pass));
  assert.deepEqual(gate.problems, []);
  assert.equal(gate.runtimeWithinTarget, false, 'la memoria se registra frente al objetivo');
});

test('T-128: relajar un presupuesto en el informe es deriva y falla', () => {
  const gate = backendGate({ budgets: { healthP95Ms: 60 } });
  assert.deepEqual(
    gate.budgetDrift.map((drift) => drift.metric),
    ['/health p95 (ms)'],
  );
  assert.ok(gate.problems.some((problem) => /deriva/i.test(problem)));
  assert.ok(
    gate.checks.every((check) => !check.pass),
    'la deriva nunca aprueba',
  );
});

test('T-128: muestras insuficientes, códigos no 200 o rutas ausentes fallan cerrado', () => {
  const shortSamples = backendGate({
    routes: [
      backendRoute({ group: 'health', route: '/health', p95Ms: 2, maxQueriesPerRequest: 0 }),
      backendRoute({ group: 'ready', route: '/ready', p95Ms: 40 }),
      backendRoute({
        samples: 10,
        sampleMs: Array.from({ length: 10 }, () => 5),
        statuses: Array.from({ length: 10 }, () => 200),
      }),
    ],
  });
  assert.ok(shortSamples.problems.some((problem) => /m[íi]nimo de 30 muestras/.test(problem)));

  const failingStatus = backendGate({
    routes: [
      backendRoute({ group: 'health', route: '/health', p95Ms: 2, maxQueriesPerRequest: 0 }),
      backendRoute({ group: 'ready', route: '/ready', p95Ms: 40 }),
      backendRoute({
        statuses: [200, 200, 503, ...Array.from({ length: 37 }, () => 200)],
      }),
    ],
  });
  assert.ok(failingStatus.problems.some((problem) => /respondió 503/.test(problem)));

  const missingHealth = backendGate({ routes: [backendRoute()] });
  assert.ok(missingHealth.problems.some((problem) => /\/health/.test(problem)));
  assert.ok(missingHealth.problems.some((problem) => /\/ready/.test(problem)));
});

test('T-128: un informe malformado no se interpreta como aprobado', () => {
  assert.throws(() => parseBackendReport(null));
  assert.throws(() => parseBackendReport([]));
  assert.throws(() => parseBackendReport({ ...backendReport(), kind: 'lighthouse' }));
  assert.throws(() => parseBackendReport({ ...backendReport(), version: 2 }));
  assert.throws(() =>
    parseBackendReport({
      ...backendReport(),
      results: { ...backendReport().results, coldStartMs: Number.NaN },
    }),
  );
  const withoutMemory = { ...backendReport().results } as Record<string, unknown>;
  delete withoutMemory['memory'];
  assert.throws(() => parseBackendReport({ ...backendReport(), results: withoutMemory }));
  const badRoute = backendReport().results.routes.map((route, index) =>
    index === 0 ? { ...route, p95Ms: 'rápido' } : route,
  );
  assert.throws(() =>
    parseBackendReport({
      ...backendReport(),
      results: { ...backendReport().results, routes: badRoute },
    }),
  );
});

test('T-128: sin informe backend el comando falla cerrado en español', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-performance-backend-'));
  try {
    const missing = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        join(import.meta.dirname, 'check-performance.mts'),
        '--backend',
        '--report',
        join(root, 'no-existe.json'),
      ],
      { encoding: 'utf8' },
    );
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /informe/i);
    assert.match(missing.stderr, /RUN_DB_TESTS=1/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('T-128: el comando backend publica la tabla y decide con exit code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-performance-backend-'));
  try {
    const file = join(root, 'backend.json');
    await writeFile(file, JSON.stringify(backendReport()));
    const passing = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        join(import.meta.dirname, 'check-performance.mts'),
        '--backend',
        '--report',
        file,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(passing.status, 0, passing.stderr);
    assert.match(passing.stdout, /\/health/);
    assert.match(passing.stdout, /200\.0 MB/);
    assert.match(passing.stdout, /check:performance \(backend\) OK/);

    await writeFile(
      file,
      JSON.stringify(
        backendReport({
          routes: [
            backendRoute({ group: 'health', route: '/health', p95Ms: 2, maxQueriesPerRequest: 0 }),
            backendRoute({ group: 'ready', route: '/ready', p95Ms: 40 }),
            backendRoute({ maxQueriesPerRequest: 7 }),
          ],
        }),
      ),
    );
    const failing = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        join(import.meta.dirname, 'check-performance.mts'),
        '--backend',
        '--report',
        file,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(failing.status, 1);
    assert.match(failing.stderr, /check:performance \(backend\) FALLÓ/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
