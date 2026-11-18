import { expect, test } from '@playwright/test';

/**
 * spec005 T022 (F-04): la lista textual de habilidades se pinta entera al llegar a ella, el alto de
 * página no salta más de ±5 % por la altura reservada (`content-visibility: auto`) y no mueve el
 * diseño (CLS ≤ 0,05). Diagnóstico a 375 px: la lista se pinta al desplazarse; la altura reservada
 * era mayor que la real. Los anchos salen de los proyectos de `playwright.config.ts`.
 */
const BASE_URL = process.env['A11Y_BASE_URL'] ?? 'http://127.0.0.1:4321';
const LOCALES = [
  { name: 'en', prefix: '' },
  { name: 'es', prefix: '/es' },
] as const;

for (const locale of LOCALES)
  test(`@journeys la lista de habilidades de soldier (${locale.name}) se pinta entera sin saltos de página`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(`${BASE_URL}${locale.prefix}/maestrias/soldier`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const list = page.locator('gd-skill-tree .skill-tree__list').first();
    const items = list.locator('li');
    const total = await items.count();
    expect(total, 'la lista está en el HTML con las 32 habilidades').toBe(32);
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await list.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const visible = await items.evaluateAll(
      (nodes) =>
        nodes.filter((node) => node.checkVisibility({ contentVisibilityAuto: true })).length,
    );
    expect(visible, 'los 32 elementos se pintan al llegar a la lista').toBe(32);
    const after = await page.evaluate(() => document.documentElement.scrollHeight);
    const jump = Math.abs(after - before) / before;
    expect(
      jump,
      `el alto de página salta ${(jump * 100).toFixed(1)} % (${before} → ${after} px)`,
    ).toBeLessThanOrEqual(0.05);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, 'CLS').toBeLessThanOrEqual(0.05);
  });
