/**
 * Prueba de equivalencia de builds (AC-17, T-068).
 *
 * Construye el artefacto prerenderizado dos veces con la misma base de datos
 * sembrada: una con `CONTENT_SOURCE=fixture` y otra con `CONTENT_SOURCE=api`.
 * Cada build va a un directorio aislado (por defecto `dist/compare/fixture` y
 * `dist/compare/api`), recibe los mismos finalizadores que `pnpm build`
 * (`static-home`, `emit-404` y `sitemap`) y después se comparan:
 *
 * - todas las páginas HTML del artefacto, archivo por archivo;
 * - cada `sitemap.xml` de cada configuración regional;
 * - cada bloque JSON-LD (`application/ld+json`) como JSON canónico.
 *
 * Normalizaciones aplicadas, todas de datos volátiles y no de contenido: el
 * valor `source` del estado `gd-content-source` (`fixture` | `api`, procedencia
 * del build) y los ids internos de hidratación `tN` de `__nghData__`, que
 * Angular numera con un contador que puede arrancar desplazado entre builds;
 * se reindexan por orden de aparición conservando la topología. Los bloques
 * JSON-LD se comparan como JSON canónico (el orden de claves no es contenido).
 * El resto del HTML y el sitemap se comparan byte a byte. La ruta temporal del
 * artefacto no aparece en la salida porque los enlaces son absolutos con
 * `BASE_URL`.
 *
 * Uso: `node --import tsx scripts/compare-builds.mts [--help]`.
 */
import { spawn } from 'node:child_process';
import { lstat, readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emit404 } from './emit-404.mts';
import { generateSeoFiles, TEMPLATE_PATH } from './gen-sitemap.mts';
import { readArtifactLocales } from './locales.mts';
import { createPublicBuildEnv } from './public-build-env.mts';
import { assertCompleteStaticRoutes, finalizeStaticHome } from './static-home.mts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FIXTURE = join(REPO_ROOT, 'dist', 'compare', 'fixture');
const DEFAULT_API = join(REPO_ROOT, 'dist', 'compare', 'api');
const DEFAULT_BASE_URL = 'https://compare.invalid/';
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000';
const READY_TIMEOUT_MS = 5000;
const MAX_DETAIL = 160;

const USAGE = `Uso: node --import tsx scripts/compare-builds.mts [opciones]

Construye dos artefactos prerenderizados aislados —mismo contenido sembrado en
la BD— con CONTENT_SOURCE=fixture y CONTENT_SOURCE=api, aplica los finalizadores
del build (static-home, emit-404, sitemap) y compara HTML, sitemap.xml y JSON-LD.
Termina con 0 solo si la equivalencia es total.

Opciones:
  --fixture <dir>        Salida del artefacto fixture (por defecto ${DEFAULT_FIXTURE}).
  --api <dir>            Salida del artefacto API (por defecto ${DEFAULT_API}).
  --base-url <url>       BASE_URL público idéntico para ambos builds (por defecto
                         ${DEFAULT_BASE_URL}).
  --api-base-url <url>   API de contenido ya arrancada y lista (por defecto
                         ${DEFAULT_API_BASE_URL} o API_BASE_URL).
  --seed                 Siembra la BD con \`pnpm db:seed\` antes del build de API.
                         Es opt-in: el lanzador del repo exige Docker y no
                         sobreescribe contenido con origen editorial.
  --keep                 Conserva los artefactos comparados al terminar.
  --help                 Muestra esta ayuda.

Códigos de salida: 0 equivalencia total; 1 diferencias; 2 artefacto, BD o API
no disponibles o argumentos inválidos.`;

export type ComparisonStatus = 0 | 1 | 2;
export type DifferenceKind = 'html' | 'sitemap' | 'jsonld' | 'missing';

export interface BuildDifference {
  /** Ruta relativa a `browser/` (o el bloque JSON-LD dentro de una página). */
  readonly file: string;
  readonly kind: DifferenceKind;
  /** Primera línea diferente, 1-based, cuando aplica. */
  readonly line?: number;
  readonly detail: string;
}

export interface ComparisonResult {
  readonly status: ComparisonStatus;
  readonly differences: BuildDifference[];
  readonly htmlPages: number;
  readonly sitemaps: number;
  readonly jsonLdBlocks: number;
}

interface ArtifactFiles {
  html: string[];
  sitemaps: string[];
}

interface Options {
  fixture: string;
  api: string;
  baseUrl: string;
  apiBaseUrl: string;
  seed: boolean;
  keep: boolean;
}

const CONTENT_SOURCE_STATE =
  /("gd-content-source"\s*:\s*\{[^{}]*?"source"\s*:\s*)"(?:fixture|api)"/g;
const JSON_LD_BLOCK =
  /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
const NG_STATE_SCRIPT = /<script\b[^>]*\bid\s*=\s*["']ng-state["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
const HYDRATION_ID = /^t(\d+)$/;

/**
 * Angular asigna ids internos de hidratación (`t1`, `t2`…) con un contador que
 * puede arrancar desplazado entre builds aunque el DOM sea idéntico. Se
 * reindexan por orden de aparición, conservando la topología (qué vistas
 * comparten id); los valores del estado siguen comparándose.
 */
function normalizeTransferState(text: string): string {
  let state: unknown;
  try {
    state = JSON.parse(text) as unknown;
  } catch {
    return text;
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) return text;
  const record = state as Record<string, unknown>;
  const marker = record['gd-content-source'];
  if (marker && typeof marker === 'object' && !Array.isArray(marker)) {
    const source = marker as Record<string, unknown>;
    if (source['source'] === 'fixture' || source['source'] === 'api')
      source['source'] = '<content-source>';
  }
  if (record['__nghData__'] !== undefined) {
    const ids = new Map<string, string>();
    const rewrite = (value: unknown): unknown => {
      if (typeof value === 'string' && HYDRATION_ID.test(value)) {
        const known = ids.get(value);
        if (known) return known;
        const replacement = `t${ids.size}`;
        ids.set(value, replacement);
        return replacement;
      }
      if (Array.isArray(value)) return value.map((item) => rewrite(item));
      if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        return Object.fromEntries(
          Object.entries(object).map(([key, item]) => [key, rewrite(item)]),
        );
      }
      return value;
    };
    record['__nghData__'] = rewrite(record['__nghData__']);
  }
  return JSON.stringify(record);
}

/**
 * Neutraliza solo lo que no es contenido: la procedencia del build, el orden
 * de claves de cada bloque JSON-LD (que después se compara aparte, canónico) y
 * los ids internos de hidratación del estado de transferencia. El resto del
 * HTML queda intacto.
 */
export function normalizeHtml(html: string): string {
  const state = html.replace(NG_STATE_SCRIPT, (block: string, body: string) =>
    block.replace(body, () => normalizeTransferState(body)),
  );
  const normalized = state.replace(CONTENT_SOURCE_STATE, '$1"<content-source>"');
  return normalized.replace(JSON_LD_BLOCK, (block: string, body: string) => {
    try {
      return block.replace(body, () => canonicalJson(body));
    } catch {
      return block;
    }
  });
}

/** Extrae el cuerpo de cada `<script type="application/ld+json">` de una página. */
export function extractJsonLd(html: string): string[] {
  return [...html.matchAll(JSON_LD_BLOCK)].map((match) => match[1] ?? '');
}

/** JSON canónico: mismo valor lógico aunque cambie el orden de las claves. */
export function canonicalJson(text: string): string {
  return canonical(JSON.parse(text) as unknown);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Devuelve el par canónico cuando difiere; `undefined` si son equivalentes. */
function compareJsonLd(left: string, right: string): { left: string; right: string } | undefined {
  try {
    const canonicalLeft = canonicalJson(left);
    const canonicalRight = canonicalJson(right);
    return canonicalLeft === canonicalRight
      ? undefined
      : { left: canonicalLeft, right: canonicalRight };
  } catch {
    // Un bloque inválido no se puede normalizar: la comparación textual lo delata.
    return left === right
      ? undefined
      : { left: left || '<bloque vacío>', right: right || '<bloque vacío>' };
  }
}

function truncate(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= MAX_DETAIL ? compact : `${compact.slice(0, MAX_DETAIL)}…`;
}

function firstDifferentLine(
  left: string,
  right: string,
): { line: number; left: string; right: string } {
  const a = left.split(/\r?\n/);
  const b = right.split(/\r?\n/);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index])
      return { line: index + 1, left: a[index] ?? '', right: b[index] ?? '' };
  }
  return { line: 1, left: '', right: '' };
}

/** Lista las páginas HTML y los sitemap de un artefacto; `null` si falta o es inseguro. */
async function collectArtifact(root: string): Promise<ArtifactFiles | null> {
  const browser = join(root, 'browser');
  try {
    const stat = await lstat(browser);
    if (stat.isSymbolicLink() || !stat.isDirectory()) return null;
  } catch {
    return null;
  }
  const files: ArtifactFiles = { html: [], sitemaps: [] };
  const walk = async (directory: string, prefix: string): Promise<boolean> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const file = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) return false;
      if (entry.isDirectory()) {
        if (!(await walk(join(directory, entry.name), file))) return false;
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.html')) files.html.push(file);
        else if (entry.name === 'sitemap.xml') files.sitemaps.push(file);
      }
    }
    return true;
  };
  if (!(await walk(browser, ''))) return null;
  files.html.sort();
  files.sitemaps.sort();
  return files;
}

function missingFiles(expected: readonly string[], actual: ReadonlySet<string>): string[] {
  return expected.filter((file) => !actual.has(file));
}

/**
 * Compara dos artefactos completos. Estado 2 si falta un artefacto, una página o
 * un sitemap; 1 si hay contenido distinto; 0 si son equivalentes.
 */
export async function compareTrees(
  fixtureRoot: string,
  apiRoot: string,
): Promise<ComparisonResult> {
  const fixture = await collectArtifact(fixtureRoot);
  const api = await collectArtifact(apiRoot);
  if (
    !fixture ||
    !api ||
    fixture.html.length === 0 ||
    api.html.length === 0 ||
    fixture.sitemaps.length === 0 ||
    api.sitemaps.length === 0
  ) {
    return {
      status: 2,
      differences: [
        {
          file: 'browser/',
          kind: 'missing',
          detail: 'falta el artefacto, sus páginas HTML o sitemap.xml en alguno de los dos lados.',
        },
      ],
      htmlPages: 0,
      sitemaps: 0,
      jsonLdBlocks: 0,
    };
  }

  const differences: BuildDifference[] = [];
  const fixtureHtml = new Set(fixture.html);
  const apiHtml = new Set(api.html);
  const fixtureSitemaps = new Set(fixture.sitemaps);
  const apiSitemaps = new Set(api.sitemaps);
  for (const file of missingFiles(fixture.html, apiHtml))
    differences.push({ file, kind: 'missing', detail: 'falta en el artefacto API.' });
  for (const file of missingFiles(api.html, fixtureHtml))
    differences.push({ file, kind: 'missing', detail: 'falta en el artefacto fixture.' });
  for (const file of missingFiles(fixture.sitemaps, apiSitemaps))
    differences.push({ file, kind: 'missing', detail: 'sitemap ausente en el artefacto API.' });
  for (const file of missingFiles(api.sitemaps, fixtureSitemaps))
    differences.push({ file, kind: 'missing', detail: 'sitemap ausente en el artefacto fixture.' });

  let jsonLdBlocks = 0;
  const commonHtml = fixture.html.filter((file) => apiHtml.has(file));
  for (const file of commonHtml) {
    const left = await readFile(join(fixtureRoot, 'browser', file), 'utf8');
    const right = await readFile(join(apiRoot, 'browser', file), 'utf8');
    const normalizedLeft = normalizeHtml(left);
    const normalizedRight = normalizeHtml(right);
    if (normalizedLeft !== normalizedRight) {
      const first = firstDifferentLine(normalizedLeft, normalizedRight);
      differences.push({
        file,
        kind: 'html',
        line: first.line,
        detail: `primera línea distinta: fixture «${truncate(first.left)}» / api «${truncate(first.right)}».`,
      });
    }
    const leftJsonLd = extractJsonLd(left);
    const rightJsonLd = extractJsonLd(right);
    if (leftJsonLd.length !== rightJsonLd.length) {
      differences.push({
        file,
        kind: 'jsonld',
        detail: `${leftJsonLd.length} bloque(s) JSON-LD en fixture y ${rightJsonLd.length} en api.`,
      });
      continue;
    }
    for (const [index, block] of leftJsonLd.entries()) {
      jsonLdBlocks++;
      const other = rightJsonLd[index]!;
      const canonical = compareJsonLd(block, other);
      if (canonical) {
        differences.push({
          file: `${file}#ld+json[${index + 1}]`,
          kind: 'jsonld',
          detail: `JSON-LD distinto: fixture «${truncate(canonical.left)}» / api «${truncate(canonical.right)}».`,
        });
      }
    }
  }

  const commonSitemaps = fixture.sitemaps.filter((file) => apiSitemaps.has(file));
  for (const file of commonSitemaps) {
    const left = await readFile(join(fixtureRoot, 'browser', file), 'utf8');
    const right = await readFile(join(apiRoot, 'browser', file), 'utf8');
    if (left === right) continue;
    const first = firstDifferentLine(left, right);
    differences.push({
      file,
      kind: 'sitemap',
      line: first.line,
      detail: `primera línea distinta: fixture «${truncate(first.left)}» / api «${truncate(first.right)}».`,
    });
  }

  const missing = differences.some((difference) => difference.kind === 'missing');
  return {
    status: missing ? 2 : differences.length ? 1 : 0,
    differences,
    htmlPages: commonHtml.length,
    sitemaps: commonSitemaps.length,
    jsonLdBlocks,
  };
}

function buildError(message: string): Error {
  return new Error(message);
}

function runNgBuild(output: string, env: Record<string, string>): Promise<void> {
  const cli = join(REPO_ROOT, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [cli, 'build', '--output-path', output], {
      cwd: REPO_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    let text = '';
    child.stdout.on('data', (chunk: Buffer) => {
      text += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      text += chunk.toString('utf8');
    });
    child.once('error', (error) =>
      fail(buildError(`no se pudo ejecutar ng build: ${error.message}`)),
    );
    child.once('exit', (code) => {
      if (code === 0) return done();
      const tail = text.trim().split(/\r?\n/).slice(-15).join('\n');
      if (tail) console.error(tail);
      fail(buildError(`ng build falló con código ${code ?? 'desconocido'}.`));
    });
  });
}

/** Build aislado + los mismos finalizadores que `pnpm build`. */
async function buildArtifact(
  output: string,
  mode: 'fixture' | 'release',
  options: Options,
): Promise<void> {
  const env = createPublicBuildEnv(
    { BASE_URL: options.baseUrl, API_BASE_URL: options.apiBaseUrl },
    mode,
  );
  await runNgBuild(output, env);
  const locales = (await readArtifactLocales(REPO_ROOT)).map((locale) => locale.segments);
  const routes = await finalizeStaticHome(output, locales);
  for (const locale of locales)
    assertCompleteStaticRoutes(routes, locale.length ? `/${locale.join('/')}` : '');
  await emit404(output, locales);
  await generateSeoFiles({
    distRoot: output,
    baseUrl: options.baseUrl,
    templatePath: TEMPLATE_PATH,
    locales,
  });
}

async function apiReady(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('ready', withTrailingSlash(baseUrl)), {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      signal: AbortSignal.timeout(READY_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return response.status === 200;
  } catch {
    return false;
  }
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function seedDatabase(): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/seed-content.mts'], {
      cwd: REPO_ROOT,
      env: { ...process.env, APP_ENV: 'development' },
      stdio: 'inherit',
      windowsHide: true,
      shell: false,
    });
    child.once('error', (error) => fail(buildError(`no se pudo sembrar la BD: ${error.message}`)));
    child.once('exit', (code) => {
      if (code === 0) return done();
      fail(buildError(`la siembra falló con código ${code ?? 'desconocido'}.`));
    });
  });
}

function validUrl(value: string, flag: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw buildError(`${flag} inválida: «${value}».`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw buildError(`${flag} debe ser una URL http(s) pública sin credenciales ni fragmento.`);
  return url.href;
}

function parseArgs(argv: readonly string[]): Options | null {
  const options: Options = {
    fixture: DEFAULT_FIXTURE,
    api: DEFAULT_API,
    baseUrl: DEFAULT_BASE_URL,
    apiBaseUrl: process.env['API_BASE_URL'] ?? DEFAULT_API_BASE_URL,
    seed: false,
    keep: false,
  };
  const value = (index: number, flag: string): string => {
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw buildError(`falta el valor de ${flag}.`);
    return next;
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]!;
    switch (flag) {
      case '--help':
      case '-h':
        return null;
      case '--seed':
        options.seed = true;
        break;
      case '--keep':
        options.keep = true;
        break;
      case '--fixture':
        options.fixture = resolve(value(index, flag));
        index++;
        break;
      case '--api':
        options.api = resolve(value(index, flag));
        index++;
        break;
      case '--base-url':
        options.baseUrl = validUrl(value(index, flag), flag);
        index++;
        break;
      case '--api-base-url':
        options.apiBaseUrl = validUrl(value(index, flag), flag);
        index++;
        break;
      default:
        throw buildError(`opción desconocida: «${flag}».`);
    }
  }
  options.baseUrl = validUrl(options.baseUrl, '--base-url');
  options.apiBaseUrl = validUrl(options.apiBaseUrl, '--api-base-url');
  if (options.fixture === options.api)
    throw buildError('--fixture y --api deben ser directorios distintos.');
  return options;
}

async function cleanArtifacts(fixture: string, api: string): Promise<void> {
  const parent = join(REPO_ROOT, 'dist', 'compare');
  for (const directory of [fixture, api])
    if (dirname(directory) === parent) await rm(directory, { recursive: true, force: true });
}

async function main(argv: readonly string[]): Promise<number> {
  let options: Options | null;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(
      `compare:builds ERROR: ${error instanceof Error ? error.message : 'argumentos inválidos'}`,
    );
    console.error(USAGE);
    return 2;
  }
  if (!options) {
    console.log(USAGE);
    return 0;
  }
  try {
    if (options.seed) {
      console.log('compare:builds: sembrando la BD de desarrollo…');
      await seedDatabase();
    }
    if (!(await apiReady(options.apiBaseUrl))) {
      console.error(
        `compare:builds ERROR: la API de contenido en ${options.apiBaseUrl} no responde /ready 200.`,
      );
      console.error(
        'Prepara el entorno con `pnpm setup:env`, `docker compose -f infra/docker/compose.yaml up -d --wait`, siembra la BD con `pnpm db:seed` (o usa --seed) y vuelve a intentarlo.',
      );
      return 2;
    }
    console.log(`compare:builds: construyendo artefacto fixture en ${options.fixture}…`);
    await buildArtifact(options.fixture, 'fixture', options);
    console.log(`compare:builds: construyendo artefacto API en ${options.api}…`);
    try {
      await buildArtifact(options.api, 'release', options);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'fallo inesperado';
      throw buildError(
        `${reason} Comprueba que la BD tenga sembrados los mismos fixtures (pnpm db:seed) y que la API publique ese contenido.`,
      );
    }
    const result = await compareTrees(options.fixture, options.api);
    if (result.status === 0) {
      console.log(
        `compare:builds OK: sin diferencias (${result.htmlPages} HTML, ${result.sitemaps} sitemap, ${result.jsonLdBlocks} bloque(s) JSON-LD).`,
      );
      if (!options.keep) await cleanArtifacts(options.fixture, options.api);
      return 0;
    }
    console.error(
      `compare:builds ${result.status === 2 ? 'ERROR' : 'FALLÓ'}: ${result.differences.length} diferencia(s).`,
    );
    for (const difference of result.differences)
      console.error(
        `  - ${difference.file}${difference.line ? `:${difference.line}` : ''} [${difference.kind}]: ${difference.detail}`,
      );
    console.error(`Artefactos conservados para inspección: ${options.fixture} y ${options.api}.`);
    return result.status;
  } catch (error) {
    console.error(
      `compare:builds ERROR: ${error instanceof Error ? error.message : 'fallo inesperado'}`,
    );
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
