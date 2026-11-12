import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { CATALOG_JS_LIMIT, INITIAL_JS_LIMIT, measureInitialRoutes } from './check-initial-js.mts';

/**
 * Puerta de rendimiento de T-042 (plan §6 y §17.52).
 *
 * Mide el artefacto real de `pnpm build` con Lighthouse CI —nunca `ng serve`— y,
 * además, los presupuestos de bytes que Lighthouse no cubre: JS inicial, CSS
 * crítico y HTML por ruta. Los umbrales de Lighthouse viven en
 * `lighthouserc.json` (fuente única); `BUDGETS` es la copia tipada de plan §6 y
 * el script falla cerrado si ambos divergen.
 *
 * Regla de decisión: la puerta evalúa la **mediana de las `numberOfRuns` corridas**
 * que declara `lighthouserc.json`, no una pasada suelta. Con el mismo artefacto y
 * la misma ruta se han medido TBT de 13 a 350 ms por ruido de carga del host, así
 * que una sola corrida oscila entre verde y rojo sin que cambie el producto. Los
 * umbrales de plan §6 siguen intactos (LCP ≤ 2000 ms, CLS ≤ 0,05, TBT ≤ 150 ms,
 * rendimiento ≥ 0,9, a11y/SEO/buenas prácticas ≥ 0,95) y se aplican a la mediana;
 * los valores de cada corrida se publican para que un pico sea visible sin
 * aprobar la puerta. Ninguna corrida se descarta ni se imputa: si a una le falta
 * una métrica medible, la ruta es «no medible».
 *
 * LHCI se ejecuta en un directorio temporal propio (`gd-lhci-*`), nunca en la raíz
 * del repositorio: su sesión `.lighthouseci/` pertenece a cada ejecución y dos
 * mediciones concurrentes no deben borrarse el estado entre sí.
 */

/** Presupuestos de plan §6. Los de JS se reutilizan de `check-initial-js.mts`. */
export const BUDGETS = {
  lcpMs: 2000,
  cls: 0.05,
  tbtMs: 150,
  scores: {
    performance: 0.9,
    accessibility: 0.95,
    seo: 0.95,
    bestPractices: 0.95,
  },
  cssGzipBytes: 20000,
  htmlBytes: 120000,
  jsBytes: {
    home: INITIAL_JS_LIMIT,
    tierList: CATALOG_JS_LIMIT,
  },
} as const;

export interface LighthouseBudgets {
  lcpMs: number;
  cls: number;
  tbtMs: number;
  scores: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
}

export type MetricUnit = 'ms' | 'score' | 'ratio' | 'bytes';

export interface MetricResult {
  id: string;
  label: string;
  /** Valor real medido, o `null` cuando el dato no existe o no es un número finito. */
  value: number | null;
  limit: number;
  direction: 'max' | 'min';
  unit: MetricUnit;
  measured: boolean;
  pass: boolean;
}

export interface ReportMeta {
  url: string | null;
  lighthouseVersion: string | null;
  browserUserAgent: string | null;
  formFactor: string | null;
  throttlingMethod: string | null;
}

export interface ByteBudget {
  route: string;
  bytes: number;
  limitBytes: number;
  pass: boolean;
}

export interface StylesheetBytes {
  href: string;
  gzipBytes: number;
}

export interface CssBudget extends ByteBudget {
  stylesheets: StylesheetBytes[];
}

export interface LighthouseConfigInfo {
  staticDistDir: string | null;
  urls: string[];
  outputDir: string;
  /** `ci.collect.numberOfRuns`; 1 si la configuración no lo declara. */
  numberOfRuns: number;
  formFactor: string | null;
  throttlingMethod: string | null;
}

export interface BudgetDrift {
  metric: string;
  expected: number | string;
  actual: number | string;
}

export interface JsMeasurement {
  route: string;
  totalGzipBytes: number;
  limitBytes: number;
}

/** Un informe Lighthouse: una corrida de una ruta. */
export interface RouteRun {
  file: string;
  metrics: MetricResult[];
}

/** Informes encontrados para una ruta frente a las corridas exigidas. */
export interface RouteManifest {
  route: string;
  expected: number;
  files: string[];
  problems: string[];
}

/** Resultado de una ruta: corridas publicadas y mediana que decide la puerta. */
export interface RouteEvaluation {
  route: string;
  expected: number;
  runs: RouteRun[];
  medians: MetricResult[];
  unmeasurable: string[];
}

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_ARTIFACT_DIR = join(REPO_ROOT, 'dist', 'grim-dawn-builds');

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Lee una ruta anidada sin confiar en la forma del JSON. */
function at(root: unknown, ...keys: (string | number)[]): unknown {
  let current: unknown = root;
  for (const key of keys) {
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
      continue;
    }
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function textAt(root: unknown, ...keys: (string | number)[]): string | null {
  const value = at(root, ...keys);
  return typeof value === 'string' && value.trim() ? value : null;
}

/** Convierte un valor crudo en una comprobación; lo ausente nunca aprueba. */
function metric(
  id: string,
  label: string,
  raw: unknown,
  limit: number,
  direction: 'max' | 'min',
  unit: MetricUnit,
): MetricResult {
  if (typeof raw !== 'number' || !Number.isFinite(raw))
    return { id, label, value: null, limit, direction, unit, measured: false, pass: false };
  return {
    id,
    label,
    value: raw,
    limit,
    direction,
    unit,
    measured: true,
    pass: direction === 'max' ? raw <= limit : raw >= limit,
  };
}

/**
 * Mediana de una serie. Con un número par promedia los dos centrales; con la
 * lista vacía falla en vez de inventar un valor, porque la puerta nunca debe
 * evaluar una ruta sin corridas.
 */
export function median(values: readonly number[]): number {
  if (!values.length) throw new Error('No hay valores para calcular la mediana.');
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Normaliza una URL o ruta del artefacto a la ruta pública que se muestra. */
export function normalizeRoute(url: string): string {
  const pathname = toPathname(url).replace(/\\/g, '/');
  const withoutIndex = pathname.replace(/\/+index\.html?$/i, '/').replace(/\/{2,}/g, '/');
  const trimmed = withoutIndex.replace(/(.)\/+$/, '$1');
  return trimmed === '' || trimmed === '/' ? '/' : trimmed;
}

/** Archivo del artefacto servido para una URL: `/` → `browser/index.html`. */
export function routeFilePath(dir: string, url: string): string {
  const pathname = toPathname(url).replace(/\\/g, '/');
  const relative = pathname.endsWith('/')
    ? `${pathname}index.html`
    : /\.[a-z0-9]+$/i.test(pathname)
      ? pathname
      : `${pathname}/index.html`;
  const segments = relative.split('/').filter(Boolean);
  if (!segments.length) throw new Error(`La ruta ${url} no apunta a ningún archivo del artefacto.`);
  for (const segment of segments)
    if (segment === '.' || segment === '..')
      throw new Error(`La ruta ${url} sale del artefacto del build.`);
  return join(dir, 'browser', ...segments);
}

function toPathname(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error('URL de ruta vacía.');
  let parsed: URL;
  try {
    parsed = new URL(value, 'https://artifact.invalid/');
  } catch {
    throw new Error(`URL de ruta no medible: ${raw}`);
  }
  if (parsed.username || parsed.password)
    throw new Error(`URL con credenciales no medible: ${raw}`);
  try {
    return decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error(`URL con escape inválido no medible: ${raw}`);
  }
}

/**
 * Bytes UTF-8 del HTML entregado, no del supuesto archivo de origen del servidor:
 * es lo que descarga el navegador y lo comparable con el presupuesto.
 */
export function measureHtml(html: string, route: string): ByteBudget {
  const bytes = Buffer.byteLength(html, 'utf8');
  return {
    route: normalizeRoute(route),
    bytes,
    limitBytes: BUDGETS.htmlBytes,
    pass: bytes <= BUDGETS.htmlBytes,
  };
}

/** `href` de las hojas de estilos que bloquean el render de la página. */
export function criticalStylesheetHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!rel.includes('stylesheet') || rel.includes('alternate')) continue;
    const media = (attributes.get('media') ?? '').toLowerCase();
    if (media.includes('print')) continue;
    const href = attributes.get('href');
    if (href === undefined) throw new Error('Enlace de hoja de estilos sin href en el HTML.');
    hrefs.push(href);
  }
  // El mismo `href` repetido es una sola descarga para el navegador.
  return [...new Set(hrefs)];
}

/** Ruta relativa dentro de `browser/`; lo externo o no resoluble falla cerrado. */
export function localStylesheetPath(href: string): string {
  const parsed = new URL(href, 'https://artifact.invalid/');
  if (parsed.origin !== 'https://artifact.invalid' || parsed.username || parsed.password)
    throw new Error(`Hoja de estilos externa no medible: ${href}`);
  if (parsed.search || parsed.hash)
    throw new Error(`Hoja de estilos con query o fragmento no medible: ${href}`);
  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error(`Hoja de estilos con escape inválido no medible: ${href}`);
  }
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) throw new Error(`Hoja de estilos sin ruta no medible: ${href}`);
  for (const segment of segments)
    if (segment === '.' || segment === '..')
      throw new Error(`Hoja de estilos fuera del artefacto no medible: ${href}`);
  return segments.join('/');
}

/** Suma de bytes gzip nivel 6 de cada hoja de estilos local que bloquea el render. */
export async function measureCriticalCss(
  html: string,
  readFileBytes: (path: string) => Promise<Uint8Array>,
  route = '/',
): Promise<CssBudget> {
  const stylesheets: StylesheetBytes[] = [];
  for (const href of criticalStylesheetHrefs(html)) {
    const file = localStylesheetPath(href);
    let bytes: Uint8Array;
    try {
      bytes = await readFileBytes(file);
    } catch {
      throw new Error(`La hoja de estilos ${file} no existe en el artefacto (${href}).`);
    }
    if (!bytes.length) throw new Error(`La hoja de estilos ${file} está vacía en el artefacto.`);
    stylesheets.push({ href: file, gzipBytes: gzipSync(bytes, { level: 6 }).length });
  }
  if (!stylesheets.length)
    throw new Error('El HTML no declara ninguna hoja de estilos local medible.');
  const bytes = stylesheets.reduce((sum, sheet) => sum + sheet.gzipBytes, 0);
  return {
    route: normalizeRoute(route),
    bytes,
    limitBytes: BUDGETS.cssGzipBytes,
    pass: bytes <= BUDGETS.cssGzipBytes,
    stylesheets,
  };
}

function parseAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
  )) {
    const name = match[1]!.toLowerCase();
    if (attributes.has(name)) continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

/** Evalúa las categorías y métricas de un informe Lighthouse; lo no medible falla. */
export function evaluateLighthouseReport(
  report: unknown,
  budgets: LighthouseBudgets = BUDGETS,
): MetricResult[] {
  const category = (id: string) => at(report, 'categories', id, 'score');
  const audit = (id: string) => at(report, 'audits', id, 'numericValue');
  return [
    metric(
      'performance',
      'Rendimiento',
      category('performance'),
      budgets.scores.performance,
      'min',
      'score',
    ),
    metric(
      'accessibility',
      'Accesibilidad',
      category('accessibility'),
      budgets.scores.accessibility,
      'min',
      'score',
    ),
    metric('seo', 'SEO', category('seo'), budgets.scores.seo, 'min', 'score'),
    metric(
      'best-practices',
      'Buenas prácticas',
      category('best-practices'),
      budgets.scores.bestPractices,
      'min',
      'score',
    ),
    metric('lcp', 'LCP', audit('largest-contentful-paint'), budgets.lcpMs, 'max', 'ms'),
    metric('cls', 'CLS', audit('cumulative-layout-shift'), budgets.cls, 'max', 'ratio'),
    metric('tbt', 'TBT', audit('total-blocking-time'), budgets.tbtMs, 'max', 'ms'),
  ];
}

/** Metadatos del informe que se publican junto a las cifras. */
export function reportMeta(report: unknown): ReportMeta {
  return {
    url:
      textAt(report, 'requestedUrl') ??
      textAt(report, 'finalDisplayedUrl') ??
      textAt(report, 'finalUrl'),
    lighthouseVersion: textAt(report, 'lighthouseVersion'),
    browserUserAgent:
      textAt(report, 'runtimeEnvironment', 'browserUserAgent') ??
      textAt(report, 'environment', 'hostUserAgent'),
    formFactor: textAt(report, 'configSettings', 'formFactor'),
    throttlingMethod: textAt(report, 'configSettings', 'throttlingMethod'),
  };
}

/**
 * Agrupa los informes por ruta y exige **exactamente** `numberOfRuns` por ruta:
 * menos informes impide la mediana y más mezclaría corridas de otra ejecución.
 * Las dos situaciones son problemas de la ruta y se publican, no se toleran.
 */
export function groupReportsByRoute(
  reports: readonly { file: string; url: string | null }[],
  routeOrder: readonly string[],
  numberOfRuns: number,
): RouteManifest[] {
  if (!Number.isInteger(numberOfRuns) || numberOfRuns < 1)
    throw new Error('ci.collect.numberOfRuns debe ser un entero ≥ 1 en lighthouserc.json.');
  const filesByRoute = new Map<string, string[]>();
  const problemsByRoute = new Map<string, string[]>();
  const addProblem = (route: string, problem: string) => {
    problemsByRoute.set(route, [...(problemsByRoute.get(route) ?? []), problem]);
  };
  for (const report of reports) {
    if (!report.url) {
      addProblem(report.file, 'el informe no declara la URL medida');
      continue;
    }
    const route = normalizeRoute(report.url);
    filesByRoute.set(route, [...(filesByRoute.get(route) ?? []), report.file]);
  }
  const manifests: RouteManifest[] = [];
  for (const route of routeOrder) {
    const files = [...(filesByRoute.get(route) ?? [])].sort();
    const problems = [...(problemsByRoute.get(route) ?? [])];
    if (files.length < numberOfRuns)
      problems.push(
        `${files.length} de ${numberOfRuns} informes: faltan ${numberOfRuns - files.length} corridas`,
      );
    else if (files.length > numberOfRuns)
      problems.push(
        `${files.length} informes para ${numberOfRuns} corridas: sobran ${files.length - numberOfRuns}`,
      );
    manifests.push({ route, expected: numberOfRuns, files, problems });
  }
  for (const [route, files] of filesByRoute)
    if (!routeOrder.includes(route))
      manifests.push({
        route,
        expected: numberOfRuns,
        files: [...files].sort(),
        problems: ['la ruta no está en ci.collect.url de lighthouserc.json'],
      });
  for (const [route, problems] of problemsByRoute)
    if (!routeOrder.includes(route) && !filesByRoute.has(route))
      manifests.push({ route, expected: numberOfRuns, files: [], problems });
  return manifests;
}

/** Mediana de cada métrica de la ruta; una corrida incompleta invalida la ruta. */
export function evaluateRouteMedians(
  route: string,
  runs: readonly RouteRun[],
  budgets: LighthouseBudgets = BUDGETS,
): { route: string; medians: MetricResult[]; unmeasurable: string[] } {
  const template = evaluateLighthouseReport(null, budgets);
  if (!runs.length)
    return {
      route,
      medians: template,
      unmeasurable: [`${route}: no hay corridas para calcular la mediana`],
    };
  const unmeasurable: string[] = [];
  const medians = template.map((entry) => {
    const values: number[] = [];
    for (const run of runs) {
      const found = run.metrics.find((metric) => metric.id === entry.id);
      if (!found || !found.measured || found.value === null) {
        unmeasurable.push(`${entry.label} sin medir en ${run.file}`);
        return { ...entry, value: null, measured: false, pass: false };
      }
      values.push(found.value);
    }
    const value = median(values);
    return {
      ...entry,
      value,
      measured: true,
      pass: entry.direction === 'max' ? value <= entry.limit : value >= entry.limit,
    };
  });
  return { route, medians, unmeasurable };
}

/** Aplica los manifiestos: solo hay mediana cuando están todas las corridas. */
export function evaluateRouteSets(
  sets: readonly RouteManifest[],
  runsByFile: ReadonlyMap<string, RouteRun>,
  budgets: LighthouseBudgets = BUDGETS,
): RouteEvaluation[] {
  return sets.map((set) => {
    const runs = set.files
      .map((file) => runsByFile.get(file))
      .filter((run): run is RouteRun => run !== undefined);
    if (set.problems.length)
      return {
        route: set.route,
        expected: set.expected,
        runs,
        medians: evaluateLighthouseReport(null, budgets),
        unmeasurable: [...set.problems],
      };
    if (runs.length !== set.expected)
      return {
        route: set.route,
        expected: set.expected,
        runs,
        medians: evaluateLighthouseReport(null, budgets),
        unmeasurable: [
          `${runs.length} de ${set.expected} corridas legibles: no se calcula la mediana`,
        ],
      };
    const evaluated = evaluateRouteMedians(set.route, runs, budgets);
    return {
      route: set.route,
      expected: set.expected,
      runs,
      medians: evaluated.medians,
      unmeasurable: evaluated.unmeasurable,
    };
  });
}

function assertionOptions(
  assertions: Record<string, unknown>,
  id: string,
): Record<string, unknown> {
  const raw = assertions[id];
  const level = Array.isArray(raw) ? raw[0] : raw;
  if (level !== 'error')
    throw new Error(`El umbral ${id} de lighthouserc.json debe ser bloqueante ("error").`);
  const options = Array.isArray(raw) ? raw[1] : raw;
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error(`El umbral ${id} de lighthouserc.json no declara límite.`);
  return options as Record<string, unknown>;
}

/** Lee los umbrales de `ci.assert.assertions`: la fuente única de la puerta. */
export function readLighthouseBudgets(config: unknown): LighthouseBudgets {
  const assertions = at(config, 'ci', 'assert', 'assertions');
  if (!assertions || typeof assertions !== 'object' || Array.isArray(assertions))
    throw new Error('lighthouserc.json no declara ci.assert.assertions.');
  const table = assertions as Record<string, unknown>;
  const maxNumericValue = (id: string): number => {
    const value = assertionOptions(table, id)['maxNumericValue'];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(`El máximo de ${id} en lighthouserc.json no es un número finito.`);
    return value;
  };
  const minScore = (id: string): number => {
    const value = assertionOptions(table, id)['minScore'];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error(`La puntuación mínima de ${id} en lighthouserc.json no es un número finito.`);
    return value;
  };
  return {
    lcpMs: maxNumericValue('largest-contentful-paint'),
    cls: maxNumericValue('cumulative-layout-shift'),
    tbtMs: maxNumericValue('total-blocking-time'),
    scores: {
      performance: minScore('categories:performance'),
      accessibility: minScore('categories:accessibility'),
      seo: minScore('categories:seo'),
      bestPractices: minScore('categories:best-practices'),
    },
  };
}

/**
 * Rutas medidas, corridas exigidas, directorio de informes y configuración de
 * recogida declaradas. `numberOfRuns` sale de la configuración, nunca del código.
 */
export function readLighthouseConfig(config: unknown): LighthouseConfigInfo {
  const urls = at(config, 'ci', 'collect', 'url');
  if (!Array.isArray(urls) || !urls.length || urls.some((url) => typeof url !== 'string'))
    throw new Error('lighthouserc.json no declara ci.collect.url como lista de URLs.');
  const outputDir = textAt(config, 'ci', 'upload', 'outputDir');
  if (!outputDir)
    throw new Error('lighthouserc.json no declara ci.upload.outputDir para publicar el informe.');
  const rawRuns = at(config, 'ci', 'collect', 'numberOfRuns');
  if (
    rawRuns !== undefined &&
    (typeof rawRuns !== 'number' || !Number.isInteger(rawRuns) || rawRuns < 1)
  )
    throw new Error('lighthouserc.json declara ci.collect.numberOfRuns inválido (entero ≥ 1).');
  return {
    staticDistDir: textAt(config, 'ci', 'collect', 'staticDistDir'),
    urls: urls as string[],
    outputDir,
    numberOfRuns: typeof rawRuns === 'number' ? rawRuns : 1,
    formFactor: textAt(config, 'ci', 'collect', 'settings', 'formFactor'),
    throttlingMethod: textAt(config, 'ci', 'collect', 'settings', 'throttlingMethod'),
  };
}

/** Deriva entre `lighthouserc.json` y plan §6 (`BUDGETS`); vacío significa acuerdo. */
export function budgetDrift(
  actual: LighthouseBudgets,
  expected: LighthouseBudgets = BUDGETS,
): BudgetDrift[] {
  const pairs = [
    { metric: 'LCP (ms)', expected: expected.lcpMs, actual: actual.lcpMs },
    { metric: 'CLS', expected: expected.cls, actual: actual.cls },
    { metric: 'TBT (ms)', expected: expected.tbtMs, actual: actual.tbtMs },
    {
      metric: 'puntuación de rendimiento',
      expected: expected.scores.performance,
      actual: actual.scores.performance,
    },
    {
      metric: 'puntuación de accesibilidad',
      expected: expected.scores.accessibility,
      actual: actual.scores.accessibility,
    },
    { metric: 'puntuación de SEO', expected: expected.scores.seo, actual: actual.scores.seo },
    {
      metric: 'puntuación de buenas prácticas',
      expected: expected.scores.bestPractices,
      actual: actual.scores.bestPractices,
    },
  ];
  return pairs.filter((pair) => pair.expected !== pair.actual);
}

/** Presupuestos JS de las rutas que ya cubre `check-initial-js.mts`. */
export function evaluateJsBudgets(results: readonly JsMeasurement[]): MetricResult[] {
  return results.map((result) => {
    const expected =
      result.route === '/'
        ? BUDGETS.jsBytes.home
        : result.route === '/tier-list'
          ? BUDGETS.jsBytes.tierList
          : null;
    if (expected !== null && expected !== result.limitBytes)
      throw new Error(
        `El límite JS de ${result.route} no coincide con plan §6 (${expected} B gzip).`,
      );
    return metric(
      `js:${result.route}`,
      `${result.route} JS inicial (gzip 6)`,
      result.totalGzipBytes,
      result.limitBytes,
      'max',
      'bytes',
    );
  });
}

/** Rutas de los navegadores que Lighthouse puede usar en esta máquina. */
export function chromeCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const candidates: string[] = [];
  const configured = env['CHROME_PATH'];
  if (configured) candidates.push(configured);
  const programFiles = env['ProgramFiles'] ?? 'C:\\Program Files';
  const programFilesX86 = env['ProgramFiles(x86)'];
  candidates.push(join(programFiles, 'Google/Chrome/Application/chrome.exe'));
  if (programFilesX86) {
    candidates.push(join(programFilesX86, 'Google/Chrome/Application/chrome.exe'));
  }
  const localAppData = env['LOCALAPPDATA'];
  if (localAppData) candidates.push(join(localAppData, 'Google/Chrome/Application/chrome.exe'));
  if (programFilesX86) {
    candidates.push(join(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'));
  }
  return candidates;
}

/** Primer navegador disponible; sin navegador la puerta no puede medir y falla. */
export function resolveChrome(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = chromeCandidates(env);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  throw new Error(
    `No se encontró Chrome ni Edge para Lighthouse. Define CHROME_PATH con la ruta del ejecutable. Rutas probadas: ${candidates.join(', ')}`,
  );
}

/** Versión deducida de la carpeta versionada del ejecutable, si la hay. */
export function chromeVersion(chromePath: string): string | null {
  const folder = basename(dirname(chromePath));
  return /^\d+(\.\d+)+$/.test(folder) ? folder : null;
}

function formatValue(value: number | null, unit: MetricUnit): string {
  if (value === null) return 'no medible';
  if (unit === 'score' || unit === 'ratio') return value.toFixed(3);
  if (unit === 'ms') return `${Math.round(value * 10) / 10} ms`;
  return `${value} B`;
}

function compactValue(value: number | null, unit: MetricUnit): string {
  if (value === null) return 'no medible';
  if (unit === 'score' || unit === 'ratio') return value.toFixed(3);
  return `${Math.round(value * 10) / 10}`;
}

function limitLabel(limit: number, direction: 'max' | 'min', unit: MetricUnit): string {
  const symbol = direction === 'max' ? '≤' : '≥';
  if (unit === 'score' || unit === 'ratio') return `${symbol} ${limit}`;
  if (unit === 'ms') return `${symbol} ${limit} ms`;
  return `${symbol} ${limit} B`;
}

function printTable(header: string[], rows: string[][]): void {
  const widths = header.map((title, index) =>
    Math.max(title.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const line = (cells: string[]) =>
    cells
      .map((value, index) => value.padEnd(widths[index]!))
      .join('  ')
      .trimEnd();
  console.log(line(header));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) console.log(line(row));
}

/** Celda de la tabla: mediana, veredicto y los valores de cada corrida. */
function cellWithRuns(entry: MetricResult | undefined, runs: readonly RouteRun[]): string {
  if (!entry || !entry.measured || entry.value === null) return 'no medible';
  const values = runs.map((run) => {
    const found = run.metrics.find((metric) => metric.id === entry.id);
    return found && found.measured ? compactValue(found.value, entry.unit) : 'no medible';
  });
  return `${formatValue(entry.value, entry.unit)} ${entry.pass ? 'OK' : 'FALLA'} [${values.join(', ')}]`;
}

export interface LhciInvocationInput {
  repoRoot: string;
  /** Directorio del artefacto; Lighthouse sirve `<artifactDir>/browser`. */
  artifactDir: string;
  reportsDir: string;
  configPath: string;
  workDir: string;
  chromePath: string;
}

export interface LhciInvocation {
  command: string;
  args: string[];
  cwd: string;
  /** Variables extra; el proceso hijo hereda además `process.env`. */
  env: Record<string, string>;
}

/**
 * Invocaciones de `lhci collect` y `lhci upload` para una ejecución de la puerta.
 *
 * Se usa `collect` + `upload` en lugar de `autorun` porque `autorun` ejecuta
 * `assert` por corrida y con `numberOfRuns > 1` falla por un pico aislado; aquí la
 * decisión es la mediana. `--config` lo procesa `@lhci/cli/src/cli.js` con
 * `yargs.config()` para todos los subcomandos (no es una opción de collect/upload,
 * pero sí se aplica a ambos y se resuelve contra `process.cwd()`), así que se pasa
 * absoluto junto con `--staticDistDir` (opción de collect) y `--outputDir`
 * (opción de upload). `reportsDir` debe ser el subdirectorio único de la ejecución
 * (ver `reportRunDir`), nunca el `ci.upload.outputDir` compartido. El `cwd` es un
 * directorio temporal propio porque LHCI guarda su sesión en `<cwd>/.lighthouseci`:
 * nunca la raíz del repositorio, compartida con otras ejecuciones.
 */
export function lhciRunOptions(input: LhciInvocationInput): LhciInvocation[] {
  const workDir = resolve(input.workDir);
  if (!input.workDir.trim() || workDir === resolve(input.repoRoot))
    throw new Error(
      'El directorio de trabajo de LHCI debe ser propio y distinto de la raíz del repositorio.',
    );
  const configPath = resolve(input.configPath);
  const env = { CI: 'true', CHROME_PATH: input.chromePath };
  return [
    {
      command: 'pnpm',
      args: [
        'exec',
        'lhci',
        'collect',
        `--config=${configPath}`,
        `--staticDistDir=${resolve(input.artifactDir, 'browser')}`,
      ],
      cwd: workDir,
      env,
    },
    {
      command: 'pnpm',
      args: [
        'exec',
        'lhci',
        'upload',
        `--config=${configPath}`,
        `--outputDir=${resolve(input.reportsDir)}`,
      ],
      cwd: workDir,
      env,
    },
  ];
}

/**
 * Directorio de informes propio de esta ejecución:
 * `<base>/run-<AAAAMMDD-HHmmss>-<sufijo>`.
 *
 * `ci.upload.outputDir` es un directorio compartido entre ejecuciones y agentes:
 * escribir siempre en un subdirectorio único —y único por llamada— evita que dos
 * mediciones mezclen informes y mantiene la publicación bajo `dist/` como
 * evidencia. El directorio padre no se borra ni se modifica nunca.
 */
export function reportRunDir(
  baseDir: string,
  now: Date = new Date(),
  suffix: string = randomBytes(3).toString('hex'),
): string {
  const clean = suffix.replace(/[^a-z0-9]/gi, '').slice(0, 12);
  if (!clean) throw new Error('El sufijo del directorio de informes no es válido.');
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return resolve(baseDir, `run-${stamp}-${clean}`);
}

/** cmd/PowerShell parten argumentos con espacios: se citan al lanzar el hijo. */
function quoteForShell(argument: string): string {
  return process.platform === 'win32' && /\s/.test(argument) ? `"${argument}"` : argument;
}

function runCommand(invocation: LhciInvocation): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(invocation.command, invocation.args.map(quoteForShell), {
      cwd: invocation.cwd,
      env: { ...process.env, ...invocation.env },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const relay = (stream: NodeJS.WriteStream) => (chunk: Buffer | string) => {
      const text = chunk.toString();
      output += text;
      stream.write(text);
    };
    child.stdout?.on('data', relay(process.stdout));
    child.stderr?.on('data', relay(process.stderr));
    child.on('error', (error) => {
      const text = `No se pudo ejecutar ${invocation.command}: ${error.message}\n`;
      output += text;
      process.stderr.write(text);
      resolvePromise({ exitCode: 1, output });
    });
    child.on('close', (code) => resolvePromise({ exitCode: code ?? 1, output }));
  });
}

/**
 * Crea un directorio de trabajo temporal y propio para una ejecución de LHCI y lo
 * elimina al terminar, también si falla. Nunca toca `.lighthouseci/` de la raíz:
 * ese directorio pertenece a la ejecución que lo creó, no a esta.
 */
async function withLighthouseTempDir<T>(run: (workDir: string) => Promise<T>): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), 'gd-lhci-'));
  try {
    return await run(workDir);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

interface ParsedReport {
  file: string;
  url: string | null;
  meta: ReportMeta | null;
  metrics: MetricResult[];
}

interface RouteGate extends RouteEvaluation {
  html: ByteBudget | null;
  css: CssBudget | null;
  meta: ReportMeta | null;
}

async function readReports(
  reportsDir: string,
  budgets: LighthouseBudgets,
): Promise<ParsedReport[]> {
  const files = (await readdir(reportsDir)).filter((name) => name.endsWith('.report.json')).sort();
  const reports: ParsedReport[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(join(reportsDir, file), 'utf8')) as unknown;
      reports.push({
        file,
        url: reportMeta(raw).url,
        meta: reportMeta(raw),
        metrics: evaluateLighthouseReport(raw, budgets),
      });
    } catch {
      reports.push({ file, url: null, meta: null, metrics: [] });
    }
  }
  return reports;
}

interface CliOptions {
  dir: string;
  configPath: string;
}

/**
 * Argumentos opcionales: `--dir` (artefacto) y `--config` (lighthouserc.json).
 * Los valores por defecto son los del repositorio; `--config` permite inspecciones
 * locales con otra copia de la configuración sin editar el archivo compartido.
 */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: DEFAULT_ARTIFACT_DIR,
    configPath: join(REPO_ROOT, 'lighthouserc.json'),
  };
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      (flag !== '--dir' && flag !== '--config') ||
      value === undefined ||
      !value.trim() ||
      seen.has(flag)
    )
      throw new Error('argumentos inválidos');
    seen.add(flag);
    if (flag === '--dir') options.dir = resolve(value);
    else options.configPath = resolve(value);
  }
  return options;
}

async function main(argv: string[]): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`check:performance FALLÓ: ${describeError(error)}.`);
    console.error(
      'Uso: tsx scripts/check-performance.mts [--dir <ruta del artefacto>] [--config <lighthouserc.json>]',
    );
    return 1;
  }
  const { dir, configPath } = options;

  const browserDir = join(dir, 'browser');
  const indexPath = join(browserDir, 'index.html');
  const statsPath = join(dir, 'stats.json');
  if (!existsSync(indexPath) || !existsSync(statsPath)) {
    console.error(`check:performance FALLÓ: falta el artefacto de build en ${dir}.`);
    console.error(`Se esperaban ${indexPath} y ${statsPath}; Lighthouse nunca mide ng serve.`);
    console.error('Genera el artefacto real con: pnpm build');
    return 1;
  }

  let config: unknown;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  } catch {
    console.error(`check:performance FALLÓ: no se pudo leer ${configPath}.`);
    return 1;
  }

  let budgets: LighthouseBudgets;
  let info: LighthouseConfigInfo;
  try {
    budgets = readLighthouseBudgets(config);
    info = readLighthouseConfig(config);
  } catch (error) {
    console.error(`check:performance FALLÓ: ${describeError(error)}`);
    return 1;
  }

  const drift: BudgetDrift[] = budgetDrift(budgets);
  if (info.formFactor !== 'mobile')
    drift.push({ metric: 'formFactor', expected: 'mobile', actual: info.formFactor ?? 'ausente' });
  if (drift.length) {
    for (const finding of drift)
      console.error(
        `check:performance FALLÓ: deriva de umbrales en ${finding.metric}: lighthouserc.json=${finding.actual}, plan §6/BUDGETS=${finding.expected}.`,
      );
    return 1;
  }

  let chrome: string;
  try {
    chrome = resolveChrome();
  } catch (error) {
    console.error(`check:performance FALLÓ: ${describeError(error)}`);
    return 1;
  }

  // Directorio de informes propio: `ci.upload.outputDir` es compartido con otras
  // ejecuciones, así que se escribe en un subdirectorio único y el padre no se toca.
  const reportsBase = resolve(REPO_ROOT, info.outputDir);
  const reportsDir = reportRunDir(reportsBase);

  const lhciRuns = await withLighthouseTempDir(async (workDir) => {
    const invocations = lhciRunOptions({
      repoRoot: REPO_ROOT,
      artifactDir: dir,
      reportsDir,
      configPath,
      workDir,
      chromePath: chrome,
    });
    const results: { exitCode: number; output: string }[] = [];
    for (const invocation of invocations) {
      console.log(
        `check:performance: ${invocation.command} ${invocation.args.join(' ')} (cwd=${invocation.cwd}, CI=true, CHROME_PATH=${chrome})`,
      );
      results.push(await runCommand(invocation));
    }
    return results;
  });
  const reportOutput = lhciRuns.map((run) => run.output).join('\n');
  console.log(
    `check:performance: lhci terminó con códigos ${lhciRuns.map((run) => run.exitCode).join(', ')}; el resultado se decide evaluando los informes.`,
  );
  console.log(`check:performance: informes publicados en ${reportsDir}`);

  let reports: ParsedReport[];
  try {
    reports = await readReports(reportsDir, budgets);
  } catch {
    reports = [];
  }
  if (!reports.length) {
    console.error(
      `check:performance FALLÓ: lhci no publicó informes *.report.json en ${reportsDir}.`,
    );
    const tail = reportOutput.split(/\r?\n/).slice(-25).join('\n');
    if (tail.trim()) console.error(`Últimas líneas de lhci:\n${tail}`);
    return 1;
  }

  const runsByFile = new Map<string, RouteRun>(
    reports
      .filter((report) => report.metrics.length)
      .map((report) => [report.file, { file: report.file, metrics: report.metrics }]),
  );
  const sets = groupReportsByRoute(
    reports.map((report) => ({ file: report.file, url: report.url })),
    info.urls.map((url) => normalizeRoute(url)),
    info.numberOfRuns,
  );
  const gates: RouteGate[] = [];
  for (const evaluation of evaluateRouteSets(sets, runsByFile, budgets)) {
    const routeUrl =
      info.urls.find((url) => normalizeRoute(url) === evaluation.route) ?? evaluation.route;
    const gate: RouteGate = {
      ...evaluation,
      html: null,
      css: null,
      meta:
        reports.find((report) => report.url && normalizeRoute(report.url) === evaluation.route)
          ?.meta ?? null,
    };
    try {
      const html = await readFile(routeFilePath(dir, routeUrl), 'utf8');
      gate.html = measureHtml(html, gate.route);
      gate.css = await measureCriticalCss(
        html,
        (relative) => readFile(join(dir, 'browser', relative)),
        gate.route,
      );
    } catch (error) {
      gate.unmeasurable.push(describeError(error));
    }
    gates.push(gate);
  }

  let jsMetrics: MetricResult[] = [];
  let jsError: string | null = null;
  try {
    jsMetrics = evaluateJsBudgets(await measureInitialRoutes(dir));
  } catch (error) {
    jsError = describeError(error);
  }

  console.log(
    `\nLighthouse: mediana de ${info.numberOfRuns} corrida(s) por ruta (móvil, 4G lento simulado; umbrales de plan §6 sobre la mediana)`,
  );
  printTable(
    ['Ruta', 'Corridas', 'LCP', 'CLS', 'TBT', 'Rendimiento', 'A11y', 'SEO', 'Buenas prácticas'],
    gates.map((gate) => {
      const byId = new Map(gate.medians.map((entry) => [entry.id, entry]));
      return [
        gate.route,
        `${gate.runs.length}/${gate.expected}`,
        cellWithRuns(byId.get('lcp'), gate.runs),
        cellWithRuns(byId.get('cls'), gate.runs),
        cellWithRuns(byId.get('tbt'), gate.runs),
        cellWithRuns(byId.get('performance'), gate.runs),
        cellWithRuns(byId.get('accessibility'), gate.runs),
        cellWithRuns(byId.get('seo'), gate.runs),
        cellWithRuns(byId.get('best-practices'), gate.runs),
      ];
    }),
  );

  console.log('\nPresupuestos de bytes del artefacto');
  printTable(
    ['Ruta', `HTML (máx ${BUDGETS.htmlBytes} B)`, `CSS gzip 6 (máx ${BUDGETS.cssGzipBytes} B)`],
    gates.map((gate) => [
      gate.route,
      gate.html ? `${gate.html.bytes} B ${gate.html.pass ? 'OK' : 'FALLA'}` : 'no medible',
      gate.css ? `${gate.css.bytes} B ${gate.css.pass ? 'OK' : 'FALLA'}` : 'no medible',
    ]),
  );

  console.log('\nPresupuesto de JS inicial (gzip nivel 6)');
  if (jsError) {
    console.error(`  no medible: ${jsError}`);
  } else {
    printTable(
      ['Ruta', 'Total', 'Límite', 'Estado'],
      jsMetrics.map((result) => [
        result.label.replace(' JS inicial (gzip 6)', ''),
        `${result.value ?? 0} B`,
        `${result.limit} B`,
        result.pass ? 'OK' : 'FALLA',
      ]),
    );
  }

  const metas = gates.map((gate) => gate.meta).filter((meta): meta is ReportMeta => meta !== null);
  const lhVersion = metas.map((meta) => meta.lighthouseVersion).find((value) => value !== null);
  const userAgent = metas.map((meta) => meta.browserUserAgent).find((value) => value !== null);
  const detectedChromeVersion = chromeVersion(chrome);
  console.log('\nEntorno de la medición');
  console.log(`  Lighthouse: ${lhVersion ?? 'versión desconocida en el informe'}`);
  console.log(
    userAgent
      ? `  Navegador: ${userAgent}`
      : `  Navegador: Chrome ${detectedChromeVersion ?? 'versión desconocida'} (deducida de la ruta de Chrome; el informe no incluye el user agent)`,
  );
  console.log(
    `  Configuración: formFactor=${info.formFactor ?? 'ausente'}, throttlingMethod=${info.throttlingMethod ?? 'ausente'}, numberOfRuns=${info.numberOfRuns} (lighthouserc.json)`,
  );
  console.log(`  Informes: ${reportsDir}`);

  const failures: string[] = [];
  for (const gate of gates) {
    for (const result of gate.medians)
      if (!result.pass)
        failures.push(
          `${gate.route} · ${result.label} (mediana de ${gate.runs.length}): ${formatValue(result.value, result.unit)} (límite ${limitLabel(result.limit, result.direction, result.unit)}; corridas ${gate.runs
            .map((run) => {
              const found = run.metrics.find((metric) => metric.id === result.id);
              return found && found.measured
                ? compactValue(found.value, result.unit)
                : 'no medible';
            })
            .join(', ')})`,
        );
    if (gate.html && !gate.html.pass)
      failures.push(
        `${gate.route} · HTML: ${gate.html.bytes} B sin comprimir (límite ≤ ${gate.html.limitBytes} B)`,
      );
    if (gate.css && !gate.css.pass)
      failures.push(
        `${gate.route} · CSS gzip 6: ${gate.css.bytes} B (límite ≤ ${gate.css.limitBytes} B)`,
      );
    for (const reason of gate.unmeasurable) failures.push(`${gate.route} · no medible: ${reason}`);
  }
  if (jsError) failures.push(`JS inicial · no medible: ${jsError}`);
  for (const result of jsMetrics)
    if (!result.pass)
      failures.push(
        `${result.label}: ${result.value} B gzip 6 (límite ≤ ${result.limit} B gzip 6)`,
      );
  if (failures.length) {
    console.error('\ncheck:performance FALLÓ:');
    for (const failure of failures) console.error(`  - ${failure}`);
  }

  const checks = [
    ...gates.flatMap((gate) => gate.medians.map((result) => result.pass)),
    ...gates.map((gate) => gate.html?.pass ?? false),
    ...gates.map((gate) => gate.css?.pass ?? false),
    ...(jsError ? [false] : jsMetrics.map((result) => result.pass)),
  ];
  const failed = checks.filter((pass) => !pass).length;
  console.log(
    `\ncheck:performance ${failed === 0 ? 'OK' : 'FALLÓ'} (${checks.length - failed}/${checks.length} comprobaciones; informes en ${reportsDir})`,
  );
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
