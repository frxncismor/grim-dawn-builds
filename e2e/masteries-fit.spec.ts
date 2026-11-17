import { expect, test } from '@playwright/test';

/**
 * spec005 T021 (F-03): en `/maestrias` ningún nombre de maestría se parte dentro de una palabra, ocupa
 * como mucho dos líneas y la página no desborda. Los anchos salen de los proyectos de `playwright.config.ts`.
 */
const BASE_URL = process.env['A11Y_BASE_URL'] ?? 'http://127.0.0.1:4321';
const LOCALES = [
  { name: 'en', prefix: '' },
  { name: 'es', prefix: '/es' },
] as const;

for (const locale of LOCALES)
  test(`@journeys los nombres de maestría (${locale.name}) no se parten dentro de una palabra`, async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${locale.prefix}/maestrias`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.mastery-row__name')).map((name) => {
        const style = getComputedStyle(name);
        const lineHeight = parseFloat(style.lineHeight);
        // Ancho de cada palabra sin partir, medido con la tipografía real del nombre.
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
        probe.style.font = style.font;
        probe.style.letterSpacing = style.letterSpacing;
        probe.style.textTransform = style.textTransform;
        probe.style.fontVariant = style.fontVariant;
        name.appendChild(probe);
        const words = (name.textContent ?? '').trim().split(/\s+/);
        const widest = Math.max(
          ...words.map((word) => {
            probe.textContent = word;
            return probe.getBoundingClientRect().width;
          }),
        );
        probe.remove();
        return {
          text: (name.textContent ?? '').trim(),
          available: name.getBoundingClientRect().width,
          widest,
          lines: Math.round(name.getBoundingClientRect().height / lineHeight),
        };
      }),
    );
    expect(rows.length, 'el índice lista las maestrías').toBeGreaterThan(5);
    for (const row of rows) {
      expect(row.widest, `${row.text}: la palabra más larga cabe sin partirse`).toBeLessThanOrEqual(
        row.available + 0.5,
      );
      expect(row.lines, `${row.text}: como mucho dos líneas`).toBeLessThanOrEqual(2);
    }
    const metrics = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      view: document.documentElement.clientWidth,
    }));
    expect(metrics.page, 'la página no desborda').toBeLessThanOrEqual(metrics.view);
  });
