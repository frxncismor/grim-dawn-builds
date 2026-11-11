import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'svg-responsive.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30000,
  outputDir: 'test-results/svg',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/svg', open: 'never' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    hasTouch: true,
    locale: 'es-419',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [375, 768, 1280].map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: 900 } },
  })),
  webServer: [
    {
      command: 'node --import tsx scripts/serve-svg-preview.mts skill',
      url: 'http://127.0.0.1:4310/',
      reuseExistingServer: false,
      timeout: 15000,
    },
    {
      command: 'node --import tsx scripts/serve-svg-preview.mts devotion',
      url: 'http://127.0.0.1:4311/',
      reuseExistingServer: false,
      timeout: 15000,
    },
  ],
});
