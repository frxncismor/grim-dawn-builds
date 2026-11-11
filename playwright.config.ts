import { defineConfig } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * T-041 - puerta axe sobre el artefacto prerenderizado (plan §17.52).
 *
 * El artefacto se sirve con un servidor estático mínimo, nunca con `ng serve`:
 * la medición debe hacerse sobre lo que se publica. Playwright exige un proceso
 * para `webServer`, así que el servidor se escribe en el directorio temporal en
 * lugar de añadir otro archivo al repositorio.
 *
 * T-040 - recorridos E2E: este mismo servidor sirve el artefacto público y, si
 * existe, el artefacto local de borradores (`INCLUDE_DRAFTS=true`) en otro
 * puerto y otro directorio, para no duplicar configuración ni sobrescribir
 * `dist/grim-dawn-builds`. Los dos puertos y directorios son configurables por
 * entorno; los valores por defecto son los de la puerta axe.
 */
const PORT = Number(process.env['E2E_PORT'] ?? 4321);
const ARTIFACT_ROOT = process.env['E2E_ARTIFACT_DIR']
  ? resolve(process.env['E2E_ARTIFACT_DIR'])
  : join(process.cwd(), 'dist', 'grim-dawn-builds', 'browser');

const DRAFTS_PORT = Number(process.env['E2E_DRAFTS_PORT'] ?? 4322);
const DRAFTS_ARTIFACT_ROOT = process.env['E2E_DRAFTS_ARTIFACT_DIR']
  ? resolve(process.env['E2E_DRAFTS_ARTIFACT_DIR'])
  : join(process.cwd(), 'dist', 'e2e-drafts', 'browser');

const SERVER_PATH = join(tmpdir(), 'gd-e2e-serve-artifact.mjs');

/** Puerto por defecto del artefacto; `A11Y_BASE_URL` permite apuntar a un fixture. */
export const A11Y_BASE_URL = process.env['A11Y_BASE_URL'] ?? `http://127.0.0.1:${PORT}`;
/** Los recorridos usan rutas absolutas; `E2E_BASE_URL` permite otro artefacto público. */
export const JOURNEYS_BASE_URL = process.env['E2E_BASE_URL'] ?? A11Y_BASE_URL;
/** Artefacto local de borradores; lo consume `e2e/journeys.spec.ts`. */
export const JOURNEYS_DRAFTS_BASE_URL =
  process.env['E2E_DRAFTS_BASE_URL'] ?? `http://127.0.0.1:${DRAFTS_PORT}`;

/**
 * Solo se inicia el servidor de borradores cuando su artefacto existe: así
 * `pnpm e2e:a11y` no depende de un build de borradores. Cuando falte, las
 * pruebas de recorrido fallan con el comando exacto para construirlo.
 */
const DRAFTS_AVAILABLE = existsSync(join(DRAFTS_ARTIFACT_ROOT, 'index.html'));

const STATIC_SERVER = String.raw`import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const port = Number(process.argv[3] ?? 4321);
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};

function send(response, head, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Allow: 'GET, HEAD',
  });
  response.end(head ? undefined : body);
}

const server = createServer(async (request, response) => {
  const head = request.method === 'HEAD';
  if (request.method !== 'GET' && !head) return send(response, head, 405, 'method_not_allowed');
  let pathname;
  try {
    pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
  } catch {
    return send(response, head, 400, 'bad_request');
  }
  const segments = pathname.split('/');
  if (!pathname.startsWith('/') || segments.some((segment) => segment === '..' || segment === '.')) {
    return send(response, head, 403, 'forbidden');
  }
  try {
    const target = join(root, pathname);
    const file = (await stat(target)).isDirectory() ? join(target, 'index.html') : target;
    const outside = relative(root, file);
    if (outside.startsWith('..') || isAbsolute(outside)) return send(response, head, 403, 'forbidden');
    const body = await readFile(file);
    return send(response, head, 200, body, MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
  } catch {
    try {
      return send(response, head, 404, await readFile(join(root, '404.html')), 'text/html; charset=utf-8');
    } catch {
      return send(response, head, 404, 'not_found');
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('artefacto servido en http://127.0.0.1:' + port + ' desde ' + root);
});
process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
`;

writeFileSync(SERVER_PATH, STATIC_SERVER, 'utf8');

const webServers = [
  {
    command: `node "${SERVER_PATH}" "${ARTIFACT_ROOT}" ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 20000,
  },
];

if (DRAFTS_AVAILABLE) {
  webServers.push({
    command: `node "${SERVER_PATH}" "${DRAFTS_ARTIFACT_ROOT}" ${DRAFTS_PORT}`,
    url: `http://127.0.0.1:${DRAFTS_PORT}/`,
    reuseExistingServer: false,
    timeout: 20000,
  });
}

export default defineConfig({
  testDir: './e2e',
  // Solo estas specs: `playwright.svg.config.ts` conserva su propio runner y
  // `svg-responsive.spec.ts` pertenece a otro artefacto.
  testMatch: ['a11y.spec.ts', 'journeys.spec.ts'],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60000,
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/e2e', open: 'never' }]],
  use: {
    baseURL: JOURNEYS_BASE_URL,
    browserName: 'chromium',
    headless: true,
    locale: 'es-419',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [375, 768, 1280].map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: 900 } },
  })),
  webServer: webServers,
});
