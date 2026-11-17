import { expect, test, type Page } from '@playwright/test';

/**
 * spec005 T017 (US8, FR-033 a FR-036): regresión visual de página completa. Cinco rutas × 375/768/1280
 * × EN/ES = 30 `toHaveScreenshot`. El entorno (artefacto `own`, fuentes locales, viewport ancho × 900,
 * escala 1, `reducedMotion`, UTC, sin animaciones ni cursor) y la tolerancia están en
 * `playwright.visual.config.ts`. Las referencias (`e2e/visual-baselines/`) las genera solo el flujo de
 * Linux; un cambio de CSS deseado se acepta regenerándolas (ver `CONTRIBUTING.md`).
 *
 * El nombre de cada captura dice ruta, ancho e idioma: `<ruta>-<idioma>-<ancho>.png`.
 */
const ROUTES = [
  { name: 'portada', path: '/' },
  { name: 'tier-list', path: '/tier-list' },
  { name: 'build', path: '/builds/chaman-demoledor-golpe-primigenio' },
  { name: 'maestrias', path: '/maestrias' },
  { name: 'maestria-soldier', path: '/maestrias/soldier' },
] as const;
const LOCALES = [
  { name: 'en', prefix: '', locale: 'en-US' },
  { name: 'es', prefix: '/es', locale: 'es-419' },
] as const;

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  // `content-visibility: auto` salta lo que queda fuera de pantalla y la captura de página completa no
  // desplaza: se fuerza el pintado para que la lista de habilidades salga entera (T022, F-04).
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLElement>('.skill-tree__list')
      .forEach((list) => (list.style.contentVisibility = 'visible')),
  );
}

for (const lang of LOCALES) {
  test.describe(`@visual páginas (${lang.name})`, () => {
    test.use({ locale: lang.locale });
    for (const route of ROUTES) {
      test(`${route.name} ${lang.name}`, async ({ page }) => {
        await page.goto(`${lang.prefix}${route.path}`, { waitUntil: 'networkidle' });
        await settle(page);
        const ancho = page.viewportSize()!.width;
        await expect(page).toHaveScreenshot(`${route.name}-${lang.name}-${ancho}.png`, {
          fullPage: true,
        });
      });
    }
  });
}
