import { expect, test } from '@playwright/test';

/**
 * spec004 T043 (defecto c de T032): el árbol de cada maestría cabe en el ancho disponible a ≥ 1280 px y,
 * por debajo, sigue siendo desplazable dentro de su lienzo con ayuda visible y sin desbordar la página.
 * Los anchos salen de los proyectos de `playwright.config.ts` (375/768/1280).
 */

const BASE_URL = process.env['A11Y_BASE_URL'] ?? 'http://127.0.0.1:4321';
const MASTERIES = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'] as const;
const LOCALES = [
  { name: 'en', prefix: '' },
  { name: 'es', prefix: '/es' },
] as const;
/** `80rem`: desde ahí el contenedor del árbol (1182 px) aloja el diagrama completo. */
const FITS_FROM = 1280;

for (const locale of LOCALES)
  for (const slug of MASTERIES)
    test(`@journeys el árbol de ${slug} (${locale.name}) cabe o se desplaza sin desbordar`, async ({
      page,
    }) => {
      const width = page.viewportSize()!.width;
      await page.goto(`${BASE_URL}${locale.prefix}/maestrias/${slug}`, {
        waitUntil: 'networkidle',
      });
      const canvas = page.locator('gd-skill-tree .skill-tree__canvas').first();
      await expect(canvas).toBeVisible();
      const metrics = await canvas.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
        page: document.documentElement.scrollWidth,
        view: document.documentElement.clientWidth,
      }));
      expect(metrics.page, 'la página no desborda').toBeLessThanOrEqual(metrics.view);
      // Rótulos reales (fuente cargada): ninguna línea invade la columna vecina (paso 132 − hueco 16).
      const widest = await page.evaluate(() =>
        Math.max(
          ...Array.from(
            document.querySelectorAll<SVGTextContentElement>(
              'gd-skill-tree .skill-tree__name tspan, gd-skill-tree .skill-tree__bar-required tspan',
            ),
          ).map((line) => line.getComputedTextLength()),
        ),
      );
      expect(widest, 'la línea de rótulo más ancha cabe en su columna').toBeLessThanOrEqual(116.5);
      const help = page.locator('gd-skill-tree .skill-tree__scroll-help').first();
      if (width >= FITS_FROM) {
        expect(metrics.scroll, 'el árbol cabe: sin desplazamiento horizontal').toBeLessThanOrEqual(
          metrics.client,
        );
        await expect(help).toBeHidden();
      } else {
        expect(metrics.scroll, 'el árbol se desplaza dentro de su lienzo').toBeGreaterThan(
          metrics.client,
        );
        await expect(help).toBeVisible();
      }
    });

/** T046: DESIGN.md prohíbe el _eyebrow_ de mayúsculas espaciadas sobre el título (`impeccable`: hero-eyebrow-chip). */
for (const locale of LOCALES)
  test(`@journeys el rótulo sobre el título de la maestría (${locale.name}) no es un eyebrow en mayúsculas espaciadas`, async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${locale.prefix}/maestrias/soldier`, { waitUntil: 'networkidle' });
    const style = await page.locator('p.mastery__eyebrow').evaluate((element) => {
      const css = getComputedStyle(element);
      return { transform: css.textTransform, spacing: css.letterSpacing };
    });
    expect(style.transform).toBe('none');
    expect(style.spacing).toBe('normal');
  });
