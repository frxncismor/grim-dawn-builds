import { lstat, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readArtifactLocales } from './locales.mts';

export const SITEMAP_ARTIFACT = 'sitemap.xml';
export const ROBOTS_ARTIFACT = 'robots.txt';
export const TEMPLATE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  ROBOTS_ARTIFACT,
);
const ROUTES_ARTIFACT = 'prerendered-routes.json';
const DEFAULT_DIST = join('dist', 'grim-dawn-builds');
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_BASE_URL = 'http://localhost:4200/';
const BASE_TOKEN = '__BASE_URL__';
const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;
const USAGE = 'Uso: tsx scripts/gen-sitemap.mts [--dist <ruta>]. BASE_URL se lee del entorno.';
const BASE_URL_FAILURE =
  'BASE_URL pública inválida: debe ser una URL absoluta http(s) sin credenciales, query ni fragmento.';

export interface SeoFiles {
  sitemap: string;
  robots: string;
  routes: string[];
}

function fail(message: string): never {
  throw new Error(message);
}

/** Same rules as `normalizeSiteUrl` in src/app/core/seo/site-url.ts, duplicated because scripts cannot import web. */
export function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(BASE_URL_FAILURE);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href.includes('?') ||
    url.href.includes('#')
  )
    return fail(BASE_URL_FAILURE);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * robots.txt is served byte for byte, so a CRLF checkout (`core.autocrlf=true`) must not change the
 * artifact. `.gitattributes` keeps it LF; this keeps the output stable in any case.
 */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function buildRobots(template: string, baseUrl: string): string {
  const origin = normalizeBaseUrl(baseUrl).replace(/\/$/, '');
  template = normalizeEol(template);
  if (template.split(BASE_TOKEN).length - 1 !== 1)
    fail('robots.txt: el token __BASE_URL__ debe aparecer exactamente una vez.');
  if (!/^User-agent: \*$/m.test(template)) fail('robots.txt: falta User-agent: *.');
  if (!/^Allow: \/$/m.test(template)) fail('robots.txt: falta Allow: /.');
  if (/^Disallow:/m.test(template)) fail('robots.txt: la plantilla no debe contener Disallow.');
  const robots = template.split(BASE_TOKEN).join(origin);
  if (robots.includes(BASE_TOKEN)) fail('robots.txt: token sin sustituir.');
  return robots;
}

export function buildSitemap(routes: string[], baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const entries = [...routes].sort().map((route) => {
    const loc = new URL(route === '/' ? '' : route.slice(1), base).href;
    return `  <url><loc>${escapeXml(loc)}</loc></url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

function assertSafeRoute(route: string): void {
  if (route === '/') return;
  if (!route.startsWith('/') || route.endsWith('/') || route.includes('//'))
    fail('ruta no segura en prerendered-routes.json.');
  if (
    !route
      .slice(1)
      .split('/')
      .every((segment) => SEGMENT.test(segment))
  )
    fail('ruta no segura en prerendered-routes.json.');
}

async function readRoutes(distRoot: string): Promise<string[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(join(distRoot, ROUTES_ARTIFACT), 'utf8'));
  } catch {
    return fail(`${ROUTES_ARTIFACT} ausente o inválido.`);
  }
  const map = isRecord(parsed) ? parsed.routes : undefined;
  if (!isRecord(map)) fail(`${ROUTES_ARTIFACT} ausente o inválido.`);
  const routes = Object.keys(map);
  for (const route of routes) {
    assertSafeRoute(route);
    if (!isRecord(map[route])) fail(`${ROUTES_ARTIFACT} ausente o inválido.`);
  }
  return routes.sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function htmlFile(browser: string, route: string): string {
  return route === '/'
    ? join(browser, 'index.html')
    : join(browser, ...route.slice(1).split('/'), 'index.html');
}

function isPreview(route: string): boolean {
  return route.split('/').some((segment) => segment.endsWith('-preview'));
}

function isNoindex(html: string): boolean {
  return (html.match(/<meta\b[^>]*>/gi) ?? []).some(
    (tag) =>
      /\bname\s*=\s*["']robots["']/i.test(tag) && /\bcontent\s*=\s*["'][^"']*noindex/i.test(tag),
  );
}

/**
 * Derives the public routes from the prerendered artifact itself. Each listed route must have its
 * HTML under `browser/`; `/404`, `*-preview` and `noindex` pages are excluded. Files are written
 * only after every check passes, and only inside each locale root of `browser/`.
 */
export async function generateSeoFiles(options: {
  distRoot: string;
  baseUrl: string;
  templatePath: string;
  locales?: readonly (readonly string[])[];
}): Promise<SeoFiles> {
  const base = normalizeBaseUrl(options.baseUrl);
  const locales = options.locales ?? [[]];
  if (locales.length === 0) fail('sin configuraciones regionales.');
  let template: string;
  try {
    template = normalizeEol(await readFile(options.templatePath, 'utf8'));
  } catch {
    return fail('robots.txt: plantilla no legible.');
  }
  const robots = buildRobots(template, base);
  const browser = join(options.distRoot, 'browser');
  const routes: string[] = [];
  for (const route of await readRoutes(options.distRoot)) {
    if (route === '/404' || isPreview(route)) continue;
    let html: string;
    try {
      html = await readFile(htmlFile(browser, route), 'utf8');
    } catch {
      return fail(`ruta sin HTML prerenderizado: ${route}`);
    }
    if (isNoindex(html)) continue;
    routes.push(route);
  }
  if (routes.length === 0) fail('sin rutas publicables en el artefacto.');
  const sitemap = buildSitemap(routes, base);
  try {
    for (const segments of locales) {
      const localeRoot = join(browser, ...segments);
      await readFile(join(localeRoot, 'index.html'));
      await writeFile(join(localeRoot, SITEMAP_ARTIFACT), sitemap);
      await writeFile(join(localeRoot, ROBOTS_ARTIFACT), robots);
    }
  } catch {
    fail('no se pudieron escribir sitemap.xml y robots.txt en browser/.');
  }
  return { sitemap, robots, routes };
}

export async function runCli(
  argv: string[],
  env: Record<string, string | undefined>,
): Promise<{ exitCode: number; message: string }> {
  if (argv.length && (argv.length !== 2 || argv[0] !== '--dist' || !argv[1]))
    return { exitCode: 1, message: USAGE };
  const distRoot = resolve(argv[1] ?? DEFAULT_DIST);
  try {
    const configured = await readArtifactLocales(REPO_ROOT);
    const locales: (readonly string[])[] = [];
    for (const locale of configured) {
      try {
        const stat = await lstat(join(distRoot, 'browser', ...locale.segments));
        if (stat.isDirectory()) locales.push(locale.segments);
      } catch {
        // Un idioma sin artefacto no tiene robots.txt que sustituir; emit-404 ya exige su 404.
      }
    }
    if (locales.length === 0) locales.push([]);
    const { routes } = await generateSeoFiles({
      distRoot,
      baseUrl: env.BASE_URL ?? LOCAL_BASE_URL,
      templatePath: TEMPLATE_PATH,
      locales,
    });
    return {
      exitCode: 0,
      message: `sitemap.xml y robots.txt generados en browser/ (${routes.length} rutas, ${locales.length} idioma(s)).`,
    };
  } catch (error) {
    return {
      exitCode: 1,
      message: error instanceof Error ? error.message : 'sitemap: fallo inesperado.',
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runCli(process.argv.slice(2), process.env);
  if (result.exitCode === 0) console.log(result.message);
  else console.error(result.message);
  process.exitCode = result.exitCode;
}
