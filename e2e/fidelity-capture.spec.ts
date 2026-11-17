import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * spec005 T016 (US7, FR-030): captura para la revisión de fidelidad visual. SOLO captura: no compara
 * ni falla por diferencias visuales. Escribe en `test-results/fidelity/` (ignorada por git):
 * las cinco rutas × 375/768/1280 × EN/ES de página completa y los estados del tooltip del árbol.
 * Entorno de captura: artefacto `own` con fixtures, fuentes locales (`document.fonts.ready`),
 * viewport ancho × 900, escala 1, `reducedMotion`, sin animaciones ni cursor, UTC (ver la config).
 */
const OUT = join(process.cwd(), 'test-results', 'fidelity');
const INDEX = join(OUT, 'index.json');

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
type Lang = (typeof LOCALES)[number];

interface Entry {
  ruta: string;
  idioma: string;
  ancho: number;
  estado: string;
  archivo: string;
  nota?: string;
}

function record(entry: Entry): void {
  mkdirSync(OUT, { recursive: true });
  const all: Entry[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : [];
  all.push(entry);
  writeFileSync(INDEX, `${JSON.stringify(all, null, 2)}\n`);
}

function widthOf(page: Page): number {
  return page.viewportSize()!.width;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}

async function shot(
  page: Page,
  ruta: string,
  idioma: string,
  estado: string,
  fullPage: boolean,
  nota?: string,
): Promise<void> {
  const ancho = widthOf(page);
  const archivo = `${ruta}-${idioma}-${ancho}${estado ? `-${estado}` : ''}.png`;
  await page.screenshot({
    path: join(OUT, archivo),
    fullPage,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
  record({ ruta, idioma, ancho, estado: estado || 'pagina', archivo, ...(nota ? { nota } : {}) });
}

for (const lang of LOCALES) {
  test.describe(`@fidelity páginas (${lang.name})`, () => {
    test.use({ locale: lang.locale });
    for (const route of ROUTES) {
      test(`${route.name} ${lang.name}`, async ({ page }) => {
        await page.goto(`${lang.prefix}${route.path}`, { waitUntil: 'networkidle' });
        await settle(page);
        await shot(page, route.name, lang.name, '', true);
      });
    }
  });
}

const tip = (page: Page): Locator => page.locator('gd-skill-tree [role="tooltip"]');

async function shape(node: Locator): Promise<Locator> {
  const s = node.locator('.skill-tree__shape').first();
  await s.scrollIntoViewIfNeeded();
  return s;
}

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  expect(box, 'el nodo debe tener caja').not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function close(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
}

const side = (node: Locator): Promise<string | null> =>
  node.evaluate(
    (el) =>
      el.closest('gd-skill-tree')?.querySelector('[role="tooltip"]')?.getAttribute('data-side') ??
      null,
  );

async function openTree(page: Page, lang: Lang): Promise<Locator[]> {
  await page.goto(`${lang.prefix}/maestrias/soldier`, { waitUntil: 'networkidle' });
  const nodes = page.locator('gd-skill-tree [data-skill-id]');
  await expect(nodes.first()).toBeAttached();
  await settle(page);
  return Array.from({ length: await nodes.count() }, (_, i) => nodes.nth(i));
}

const MEASURED = 'maestria-soldier-tooltip';

for (const lang of LOCALES) {
  test.describe(`@fidelity tooltip del árbol (${lang.name})`, () => {
    test.use({ locale: lang.locale });

    test(`reposo, ratón, foco y volteo en el borde (${lang.name})`, async ({ page }) => {
      const nodes = await openTree(page, lang);
      const middle = nodes[Math.floor(nodes.length / 2)];

      // Reposo: el árbol sin tooltip abierto.
      await shape(middle);
      await expect(tip(page)).toHaveCount(0);
      await shot(page, MEASURED, lang.name, 'reposo', false);

      // Ratón.
      const { x, y } = await centre(await shape(middle));
      await page.mouse.move(x, y);
      await expect(tip(page)).toBeVisible();
      await shot(page, MEASURED, lang.name, 'raton', false);
      await close(page);

      // Foco de teclado (y lado de referencia del nodo central).
      await middle.focus();
      await expect(tip(page)).toBeVisible();
      const baseSide = await side(middle);
      await shot(page, MEASURED, lang.name, 'foco', false);
      await close(page);

      // Volteo en el borde: primer nodo cuyo tooltip cae en otro lado que el del nodo central.
      let flippedSide: string | null = null;
      for (const node of nodes) {
        const target = await shape(node);
        // Nodo pegado al borde superior del viewport: no cabe el tooltip arriba y debe voltearse.
        await target.evaluate((el) => {
          const top = el.getBoundingClientRect().top;
          window.scrollBy(0, top - 8);
        });
        await node.focus({ timeout: 5000 });
        await expect(tip(page)).toBeVisible();
        const s = await side(node);
        if (s !== baseSide) {
          flippedSide = s;
          await shot(
            page,
            MEASURED,
            lang.name,
            'volteo-borde',
            false,
            `data-side=${s} (el nodo central usa ${baseSide})`,
          );
          await close(page);
          break;
        }
        await close(page);
      }
      if (flippedSide === null) {
        // Sin nodo que voltee a este ancho: se deja constancia en el índice, sin captura.
        record({
          ruta: MEASURED,
          idioma: lang.name,
          ancho: widthOf(page),
          estado: 'volteo-borde',
          archivo: '',
          nota: `no capturado: ningún nodo voltea el tooltip (todos usan ${baseSide})`,
        });
      }
    });

    test.describe('toque', () => {
      test.use({ hasTouch: true });
      test(`fijado por toque (${lang.name})`, async ({ page }) => {
        const nodes = await openTree(page, lang);
        const middle = nodes[Math.floor(nodes.length / 2)];
        const { x, y } = await centre(await shape(middle));
        await page.touchscreen.tap(x, y);
        await expect(
          page.locator('gd-skill-tree [role="tooltip"] [data-close-detail]'),
        ).toHaveCount(1);
        await shot(page, MEASURED, lang.name, 'fijado-toque', false);
      });
    });
  });
}
