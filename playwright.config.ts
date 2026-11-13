import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * T-041 - puerta axe sobre el artefacto prerenderizado (plan §17.52).
 *
 * El artefacto se sirve con el servidor estático reutilizable
 * `scripts/serve-artifact.mts` (T-166), nunca con `ng serve`: la medición debe
 * hacerse sobre lo que se publica y con las mismas cabeceras de seguridad que
 * el artefacto declara para el hosting futuro.
 *
 * T-040 - recorridos E2E: el mismo servidor sirve el artefacto público y, si
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

const SERVER_SCRIPT = join(process.cwd(), 'scripts', 'serve-artifact.mts');

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

const webServers = [
  {
    command: `node --import tsx "${SERVER_SCRIPT}" "${ARTIFACT_ROOT}" ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 20000,
  },
];

/** T-167: vista previa sintética de la fachada de video, servida bajo la misma CSP. */
const VIDEO_PREVIEW_PORT = Number(process.env['E2E_VIDEO_PREVIEW_PORT'] ?? 4323);
const VIDEO_PREVIEW_ROOT = process.env['E2E_VIDEO_PREVIEW_ARTIFACT_DIR']
  ? resolve(process.env['E2E_VIDEO_PREVIEW_ARTIFACT_DIR'])
  : join(process.cwd(), 'dist', 'video-facade-preview', 'browser');
if (existsSync(join(VIDEO_PREVIEW_ROOT, 'index.html'))) {
  webServers.push({
    command: `node --import tsx "${SERVER_SCRIPT}" "${VIDEO_PREVIEW_ROOT}" ${VIDEO_PREVIEW_PORT}`,
    url: `http://127.0.0.1:${VIDEO_PREVIEW_PORT}/`,
    reuseExistingServer: false,
    timeout: 20000,
  });
}

if (DRAFTS_AVAILABLE) {
  webServers.push({
    command: `node --import tsx "${SERVER_SCRIPT}" "${DRAFTS_ARTIFACT_ROOT}" ${DRAFTS_PORT}`,
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
