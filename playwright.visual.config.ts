import { defineConfig } from '@playwright/test';
import { join, resolve } from 'node:path';

/**
 * spec005 T017 (US8, FR-033 a FR-036): regresión visual con `toHaveScreenshot`. Sirve el artefacto
 * `own` de `pnpm build` (`ASSET_SOURCE=own`, `CONTENT_SOURCE=fixture`) con el mismo servidor estático
 * que las demás puertas y compara 5 rutas × 375/768/1280 × EN/ES = 30 capturas de página completa.
 *
 * Las referencias viven en `e2e/visual-baselines/` y se generan SOLO en Linux con el flujo
 * `.github/workflows/visual-baselines.yml` (`pnpm e2e:visual:update`); nunca en Windows. Con
 * `updateSnapshots: 'none'` una referencia que falta FALLA y no se escribe sola.
 */
const PORT = Number(process.env['E2E_PORT'] ?? 4321);
const ARTIFACT_ROOT = process.env['E2E_ARTIFACT_DIR']
  ? resolve(process.env['E2E_ARTIFACT_DIR'])
  : join(process.cwd(), 'dist', 'grim-dawn-builds', 'browser');
const BASE_URL = process.env['E2E_BASE_URL'] ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['visual.spec.ts'],
  // El nombre de cada referencia es `<ruta>-<idioma>-<ancho>.png`; no lleva proyecto ni plataforma
  // porque solo existe la referencia de Linux.
  snapshotPathTemplate: '{testDir}/visual-baselines/{arg}{ext}',
  updateSnapshots: 'none',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120000,
  outputDir: 'test-results/visual',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/visual', open: 'never' }]],
  expect: {
    toHaveScreenshot: {
      // Valores iniciales de `plan.md` («Regresión visual: diseño»); T017 fase 2 los confirma con
      // dos ejecuciones iguales en Linux.
      maxDiffPixelRatio: 0.002,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
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
