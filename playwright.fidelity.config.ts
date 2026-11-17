import { defineConfig } from '@playwright/test';
import { join, resolve } from 'node:path';

/**
 * spec005 T016: solo captura para la revisión de fidelidad visual. Sirve el artefacto `own` de
 * `pnpm build` (`ASSET_SOURCE=own` por defecto, `CONTENT_SOURCE=fixture` en modo local) con el mismo
 * servidor estático que las demás puertas; no compara ni falla por diferencias visuales.
 */
const PORT = Number(process.env['E2E_PORT'] ?? 4321);
const ARTIFACT_ROOT = process.env['E2E_ARTIFACT_DIR']
  ? resolve(process.env['E2E_ARTIFACT_DIR'])
  : join(process.cwd(), 'dist', 'grim-dawn-builds', 'browser');
const BASE_URL = process.env['E2E_BASE_URL'] ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['fidelity-capture.spec.ts'],
  globalSetup: './e2e/fidelity-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120000,
  outputDir: 'test-results/fidelity-run',
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    headless: true,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    timezoneId: 'UTC',
  },
  projects: [375, 768, 1280].map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: 900 } },
  })),
  webServer: [
    {
      command: `node --import tsx "${join(process.cwd(), 'scripts', 'serve-artifact.mts')}" "${ARTIFACT_ROOT}" ${PORT}`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: false,
      timeout: 20000,
    },
  ],
});
