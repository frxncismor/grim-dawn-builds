import { spawn } from 'node:child_process';
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

/** Rutas medidas, directorio de informes y configuración de recogida declaradas. */
export function readLighthouseConfig(config: unknown): LighthouseConfigInfo {
  const urls = at(config, 'ci', 'collect', 'url');
  if (!Array.isArray(urls) || !urls.length || urls.some((url) => typeof url !== 'string'))
    throw new Error('lighthouserc.json no declara ci.collect.url como lista de URLs.');
  const outputDir = textAt(config, 'ci', 'upload', 'outputDir');
  if (!outputDir)
    throw new Error('lighthouserc.json no declara ci.upload.outputDir para publicar el informe.');
  return {
    staticDistDir: textAt(config, 'ci', 'collect', 'staticDistDir'),
    urls: urls as string[],
    outputDir,
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

function limitLabel(limit: number, direction: 'max' | 'min', unit: MetricUnit): string {
  const symbol = direction === 'max' ? '≤' : '≥';
  if (unit === 'score' || unit === 'ratio') return `${symbol} ${limit}`;
  if (unit === 'ms') return `${symbol} ${limit} ms`;
  return `${symbol} ${limit} B`;
}

function cell(result: MetricResult): string {
  return result.measured
    ? `${formatValue(result.value, result.unit)} ${result.pass ? 'OK' : 'FALLA'}`
    : 'no medible';
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

interface RouteGate {
  route: string;
  meta: ReportMeta | null;
  lighthouse: MetricResult[];
  html: ByteBudget | null;
  css: CssBudget | null;
  unmeasurable: string[];
}

async function measureRoutes(
  dir: string,
  reportsDir: string,
  budgets: LighthouseBudgets,
  routeOrder: string[],
): Promise<RouteGate[]> {
  const gates: RouteGate[] = [];
  const reportFiles = (await readdir(reportsDir))
    .filter((name) => name.endsWith('.report.json'))
    .sort();
  for (const file of reportFiles) {
    let report: unknown;
    try {
      report = JSON.parse(await readFile(join(reportsDir, file), 'utf8')) as unknown;
    } catch {
      gates.push({
        route: `informe ${file}`,
        meta: null,
        lighthouse: evaluateLighthouseReport(null, budgets),
        html: null,
        css: null,
        unmeasurable: ['el informe es ilegible o no es JSON válido'],
      });
      continue;
    }
    const meta = reportMeta(report);
    if (!meta.url) {
      gates.push({
        route: `informe ${file}`,
        meta,
        lighthouse: evaluateLighthouseReport(report, budgets),
        html: null,
        css: null,
        unmeasurable: ['el informe no declara la URL medida'],
      });
      continue;
    }
    const route = normalizeRoute(meta.url);
    if (gates.some((gate) => gate.route === route)) continue; // un informe por ruta
    const gate: RouteGate = {
      route,
      meta,
      lighthouse: evaluateLighthouseReport(report, budgets),
      html: null,
      css: null,
      unmeasurable: [],
    };
    try {
      const html = await readFile(routeFilePath(dir, meta.url), 'utf8');
      gate.html = measureHtml(html, route);
      gate.css = await measureCriticalCss(
        html,
        (relative) => readFile(join(dir, 'browser', relative)),
        route,
      );
    } catch (error) {
      gate.unmeasurable.push(describeError(error));
    }
    gates.push(gate);
  }
  const position = (route: string) => {
    const index = routeOrder.indexOf(route);
    return index === -1 ? routeOrder.length : index;
  };
  return gates.sort((left, right) => position(left.route) - position(right.route));
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
 * Argumentos, directorio de trabajo y entorno de `lhci autorun`.
 *
 * LHCI guarda su sesión en `<cwd>/.lighthouseci`: por eso el proceso corre en un
 * directorio temporal propio y nunca en la raíz del repositorio, donde otra
 * ejecución concurrente (u otro agente del mismo worktree) podría borrarla y
 * hacer que `collect` muera con ENOENT. Todo lo que LHCI necesita se pasa como
 * ruta absoluta por argumento para no depender del cwd: `--config` (soportado por
 * `autorun` en @lhci/cli 0.16.0 y propagado a sus subcomandos con
 * `defaultFlags`; ver `node_modules/@lhci/cli/src/autorun/autorun.js`),
 * `--collect.staticDistDir` y `--upload.outputDir`.
 */
export function lhciRunOptions(input: LhciInvocationInput): LhciInvocation {
  const workDir = resolve(input.workDir);
  if (!input.workDir.trim() || workDir === resolve(input.repoRoot))
    throw new Error(
      'El directorio de trabajo de LHCI debe ser propio y distinto de la raíz del repositorio.',
    );
  return {
    command: 'pnpm',
    args: [
      'exec',
      'lhci',
      'autorun',
      `--config=${resolve(input.configPath)}`,
      `--collect.staticDistDir=${resolve(input.artifactDir, 'browser')}`,
      `--upload.outputDir=${resolve(input.reportsDir)}`,
    ],
    cwd: workDir,
    env: { CI: 'true', CHROME_PATH: input.chromePath },
  };
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

function parseDir(argv: string[]): string {
  if (!argv.length) return DEFAULT_ARTIFACT_DIR;
  if (argv.length !== 2 || argv[0] !== '--dir' || !argv[1]?.trim())
    throw new Error('argumentos inválidos');
  return resolve(argv[1]);
}

async function main(argv: string[]): Promise<number> {
  let dir: string;
  try {
    dir = parseDir(argv);
  } catch (error) {
    console.error(`check:performance FALLÓ: ${describeError(error)}.`);
    console.error('Uso: tsx scripts/check-performance.mts [--dir <ruta del artefacto>]');
    return 1;
  }

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
    config = JSON.parse(await readFile(join(REPO_ROOT, 'lighthouserc.json'), 'utf8')) as unknown;
  } catch {
    console.error('check:performance FALLÓ: no se pudo leer lighthouserc.json.');
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

  const reportsDir = resolve(REPO_ROOT, info.outputDir);
  // Un informe de la ejecución anterior no puede aprobar la puerta actual.
  await rm(reportsDir, { recursive: true, force: true });

  const run = await withLighthouseTempDir(async (workDir) => {
    const invocation = lhciRunOptions({
      repoRoot: REPO_ROOT,
      artifactDir: dir,
      reportsDir,
      configPath: join(REPO_ROOT, 'lighthouserc.json'),
      workDir,
      chromePath: chrome,
    });
    console.log(
      `check:performance: ${invocation.command} ${invocation.args.join(' ')} (cwd=${invocation.cwd}, CI=true, CHROME_PATH=${chrome})`,
    );
    return runCommand(invocation);
  });
  const reportOutput = run.output;
  console.log(
    `check:performance: lhci autorun terminó con código ${run.exitCode}; el resultado se decide evaluando los informes.`,
  );

  let gates: RouteGate[];
  try {
    gates = await measureRoutes(
      dir,
      reportsDir,
      budgets,
      info.urls.map((url) => normalizeRoute(url)),
    );
  } catch {
    gates = [];
  }
  if (!gates.length) {
    console.error(
      `check:performance FALLÓ: lhci no publicó informes *.report.json en ${reportsDir}.`,
    );
    const tail = reportOutput.split(/\r?\n/).slice(-20).join('\n');
    if (tail.trim()) console.error(`Últimas líneas de lhci:\n${tail}`);
    return 1;
  }

  let jsMetrics: MetricResult[] = [];
  let jsError: string | null = null;
  try {
    jsMetrics = evaluateJsBudgets(await measureInitialRoutes(dir));
  } catch (error) {
    jsError = describeError(error);
  }

  console.log('\nLighthouse: presupuestos por ruta (móvil, 4G lento simulado)');
  printTable(
    ['Ruta', 'Rendimiento', 'A11y', 'SEO', 'Buenas prácticas', 'LCP', 'CLS', 'TBT'],
    gates.map((gate) => {
      const byId = new Map(gate.lighthouse.map((result) => [result.id, result]));
      const value = (id: string) => {
        const result = byId.get(id);
        return result ? cell(result) : 'no medible';
      };
      return [
        gate.route,
        value('performance'),
        value('accessibility'),
        value('seo'),
        value('best-practices'),
        value('lcp'),
        value('cls'),
        value('tbt'),
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
    `  Configuración: formFactor=${info.formFactor ?? 'ausente'}, throttlingMethod=${info.throttlingMethod ?? 'ausente'} (lighthouserc.json)`,
  );

  const failures: string[] = [];
  for (const gate of gates) {
    for (const result of gate.lighthouse)
      if (!result.pass)
        failures.push(
          `${gate.route} · ${result.label}: ${formatValue(result.value, result.unit)} (límite ${limitLabel(result.limit, result.direction, result.unit)})`,
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
    ...gates.flatMap((gate) => gate.lighthouse.map((result) => result.pass)),
    ...gates.map((gate) => gate.html?.pass ?? false),
    ...gates.map((gate) => gate.css?.pass ?? false),
    ...(jsError ? [false] : jsMetrics.map((result) => result.pass)),
  ];
  const failed = checks.filter((pass) => !pass).length;
  console.log(
    `\ncheck:performance ${failed === 0 ? 'OK' : 'FALLÓ'} (${checks.length - failed}/${checks.length} comprobaciones)`,
  );
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
