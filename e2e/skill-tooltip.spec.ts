import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * spec004 T013 (US3): el tooltip del árbol queda a ≤ 16 px del nodo y 100 % dentro del viewport
 * a 375/768/1280 y con zoom 200 %, en las seis maestrías, por ratón, teclado y toque; sin
 * violaciones axe ni de CSP. Las tres anchuras salen de los proyectos de `playwright.config.ts`.
 */

declare global {
  interface Window {
    axe: typeof import('axe-core');
  }
}

const BASE_URL = process.env['A11Y_BASE_URL'] ?? 'http://127.0.0.1:4321';
const MASTERIES = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'] as const;
const LOCALES = [
  { name: 'en', prefix: '' },
  { name: 'es', prefix: '/es' },
] as const;
/** FR-010 (≤ 16 px) con medio píxel de tolerancia por el redondeo del layout. */
const MAX_GAP = 16.5;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const resolvePackage = createRequire(join(process.cwd(), 'package.json'));
const axeSource = readFileSync(resolvePackage.resolve('axe-core/axe.min.js'), 'utf8');

interface Measure {
  describedBy: boolean;
  inside: boolean;
  gap: number;
  overlaps: boolean;
}

/** Errores de consola/CSP de la página; se comprueban vacíos al final de cada prueba. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /content security policy|refused to/i.test(text)) {
      problems.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

async function openTree(page: Page, prefix: string, slug: string): Promise<Locator[]> {
  await page.goto(`${BASE_URL}${prefix}/maestrias/${slug}`, { waitUntil: 'networkidle' });
  const nodes = page.locator('gd-skill-tree [data-skill-id]');
  await expect(nodes.first()).toBeAttached();
  const count = await nodes.count();
  expect(count, `${slug}: el árbol debe tener nodos`).toBeGreaterThan(5);
  return Array.from({ length: count }, (_, index) => nodes.nth(index));
}

/** Mide el tooltip abierto respecto de su nodo, en coordenadas de viewport. */
function measure(page: Page, node: Locator): Promise<Measure> {
  return node.evaluate((element) => {
    const tip = element.closest('gd-skill-tree')?.querySelector<HTMLElement>('[role="tooltip"]');
    if (!tip) return { describedBy: false, inside: false, gap: Infinity, overlaps: false };
    const t = tip.getBoundingClientRect();
    const n = element.getBoundingClientRect();
    const shape = (element.querySelector('.skill-tree__shape') ?? element).getBoundingClientRect();
    const dx = Math.max(0, t.left - n.right, n.left - t.right);
    const dy = Math.max(0, t.top - n.bottom, n.top - t.bottom);
    return {
      describedBy: element.getAttribute('aria-describedby') === tip.id && tip.id !== '',
      inside:
        t.left >= -0.5 &&
        t.top >= -0.5 &&
        t.right <= window.innerWidth + 0.5 &&
        t.bottom <= window.innerHeight + 0.5,
      gap: Math.hypot(dx, dy),
      overlaps:
        t.left < shape.right &&
        t.right > shape.left &&
        t.top < shape.bottom &&
        t.bottom > shape.top,
    };
  });
}

/** Espera a que el tooltip se coloque junto al nodo y devuelve la última medición. */
async function settled(page: Page, node: Locator, label: string, allowOverlap: boolean) {
  let last: Measure | undefined;
  try {
    await expect
      .poll(
        async () => {
          last = await measure(page, node);
          return (
            last.describedBy &&
            last.inside &&
            last.gap <= MAX_GAP &&
            (allowOverlap || !last.overlaps)
          );
        },
        { timeout: 4000 },
      )
      .toBe(true);
  } catch {
    throw new Error(
      `${label}: tooltip junto al nodo y dentro del viewport; medido ${JSON.stringify(last)}`,
    );
  }
  return last!;
}

/** El tooltip anterior puede tapar al nodo siguiente: se cierra antes de pasar a él. */
async function closeTooltip(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await expect(page.locator('gd-skill-tree [role="tooltip"]')).toHaveCount(0);
}

async function reveal(node: Locator): Promise<Locator> {
  const shape = node.locator('.skill-tree__shape').first();
  await shape.scrollIntoViewIfNeeded();
  return shape;
}

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  expect(box, 'el nodo debe tener caja').not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function audit(page: Page) {
  await page.evaluate(axeSource);
  return page.evaluate(async (tags: string[]) => {
    const results = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      targets: v.nodes.map((n) => n.target.map(String).join(' ')),
    }));
  }, AXE_TAGS);
}

for (const slug of MASTERIES) {
  test.describe(`@journeys tooltip del árbol · ${slug}`, () => {
    test(`ratón: cada nodo de ${slug} muestra su tooltip a ≤ 16 px y dentro del viewport`, async ({
      page,
    }) => {
      const problems = watchConsole(page);
      const nodes = await openTree(page, '', slug);
      for (const node of nodes) {
        const id = (await node.getAttribute('data-skill-id'))!;
        const shape = await reveal(node);
        const { x, y } = await centre(shape);
        await closeTooltip(page);
        await page.mouse.move(x, y);
        await settled(page, node, `${slug}/${id} ratón`, false);
      }
      expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
    });

    test(`teclado: el foco en cada nodo de ${slug} muestra el tooltip y Esc lo cierra sin mover el foco`, async ({
      page,
    }) => {
      const problems = watchConsole(page);
      const nodes = await openTree(page, '', slug);
      for (const node of nodes) {
        const id = (await node.getAttribute('data-skill-id'))!;
        await reveal(node);
        await node.focus();
        await settled(page, node, `${slug}/${id} teclado`, false);
      }
      const last = nodes[nodes.length - 1];
      await page.keyboard.press('Escape');
      await expect(page.locator('gd-skill-tree [role="tooltip"]')).toHaveCount(0);
      await expect(last).toBeFocused();
      expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
    });

    test(`zoom 200 %: el tooltip de cada nodo de ${slug} sigue dentro del viewport y a ≤ 16 px`, async ({
      page,
    }) => {
      const problems = watchConsole(page);
      const viewport = page.viewportSize()!;
      // Zoom 200 %: la mitad de píxeles CSS en cada eje, con los mismos nodos y tooltip.
      await page.setViewportSize({
        width: Math.max(160, Math.round(viewport.width / 2)),
        height: Math.round(viewport.height / 2),
      });
      const nodes = await openTree(page, '', slug);
      for (const node of nodes) {
        const id = (await node.getAttribute('data-skill-id'))!;
        const shape = await reveal(node);
        const { x, y } = await centre(shape);
        await closeTooltip(page);
        await page.mouse.move(x, y);
        await settled(page, node, `${slug}/${id} zoom 200 %`, true);
      }
      expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
    });

    test.describe('toque', () => {
      test.use({ hasTouch: true });

      test(`tocar un nodo de ${slug} fija el tooltip con su botón y tocar fuera lo cierra`, async ({
        page,
      }) => {
        const problems = watchConsole(page);
        const nodes = await openTree(page, '', slug);
        for (const node of nodes) {
          const id = (await node.getAttribute('data-skill-id'))!;
          const shape = await reveal(node);
          const { x, y } = await centre(shape);
          await closeTooltip(page);
          await page.touchscreen.tap(x, y);
          await settled(page, node, `${slug}/${id} toque`, false);
          await expect(
            page.locator('gd-skill-tree [role="tooltip"] [data-close-detail]'),
          ).toHaveCount(1);
        }
        const last = nodes[nodes.length - 1];
        const outside = page.locator('gd-skill-tree .skill-tree__header').first();
        await outside.scrollIntoViewIfNeeded();
        const target = await centre(outside);
        await page.touchscreen.tap(target.x, target.y);
        await expect(page.locator('gd-skill-tree [role="tooltip"]')).toHaveCount(0);
        await expect(last).toHaveAttribute('aria-pressed', 'false');
        expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
      });
    });
  });
}

for (const locale of LOCALES) {
  test.describe(`@a11y tooltip del árbol (${locale.name})`, () => {
    test('axe sin violaciones críticas ni serias con el tooltip abierto y fijado', async ({
      page,
    }) => {
      const problems = watchConsole(page);
      const nodes = await openTree(page, locale.prefix, 'demolition');
      const shape = await reveal(nodes[1]);
      const { x, y } = await centre(shape);
      await page.mouse.move(x, y);
      await expect(page.locator('gd-skill-tree [role="tooltip"]')).toBeVisible();
      const hover = await audit(page);
      await page.mouse.click(x, y);
      await expect(page.locator('gd-skill-tree [role="tooltip"] [data-close-detail]')).toHaveCount(
        1,
      );
      const pinned = await audit(page);
      for (const [state, violations] of [
        ['hover', hover],
        ['fijado', pinned],
      ] as const) {
        const blocking = violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        );
        expect(blocking, `axe con el tooltip en estado ${state}`).toEqual([]);
      }
      expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
    });
  });
}

test.describe('@journeys tooltip del árbol · scroll del lienzo', () => {
  test('con el tooltip fijado, desplazar el lienzo lo mantiene anclado a su nodo', async ({
    page,
  }) => {
    const problems = watchConsole(page);
    const nodes = await openTree(page, '', 'demolition');
    const node = nodes[Math.floor(nodes.length / 2)];
    const shape = await reveal(node);
    // Nodo centrado en el lienzo: el tooltip no queda recortado por el borde del viewport.
    await shape.evaluate((element) => {
      const canvas = element.closest<HTMLElement>('.skill-tree__canvas')!;
      const box = element.getBoundingClientRect();
      const view = canvas.getBoundingClientRect();
      canvas.scrollLeft += box.left + box.width / 2 - (view.left + view.width / 2);
    });
    const { x, y } = await centre(shape);
    await page.mouse.click(x, y);
    await settled(page, node, 'demolition scroll inicial', false);
    // Desplazamiento (px) del tooltip respecto del nodo: debe conservarse al mover el lienzo.
    const offset = () =>
      node.evaluate((element) => {
        const tip = element
          .closest('gd-skill-tree')!
          .querySelector<HTMLElement>('[role="tooltip"]')!
          .getBoundingClientRect();
        const n = element.getBoundingClientRect();
        return { dx: tip.left + tip.width / 2 - (n.left + n.width / 2), nodeLeft: n.left };
      });
    const before = await offset();
    // Se desplaza el lienzo 60 px hacia atrás (o adelante si no hay margen).
    const moved = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>('gd-skill-tree .skill-tree__canvas')!;
      const start = canvas.scrollLeft;
      const max = canvas.scrollWidth - canvas.clientWidth;
      canvas.scrollLeft = start > 60 ? start - 60 : Math.min(start + 60, max);
      return Math.abs(canvas.scrollLeft - start);
    });
    // A 1280 px el árbol cabe entero: sin desbordamiento no hay nada que desplazar.
    test.skip(moved === 0, 'el lienzo no desborda a esta anchura');
    await expect
      .poll(async () => Math.abs((await offset()).nodeLeft - before.nodeLeft), { timeout: 2000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => Math.abs((await offset()).dx - before.dx), {
        message: 'el tooltip debe seguir al nodo al desplazar el lienzo',
        timeout: 4000,
      })
      .toBeLessThanOrEqual(2);
    await settled(page, node, 'demolition tras desplazar el lienzo', true);
    expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
  });
});

for (const locale of LOCALES) {
  test.describe(`@journeys tooltip del árbol · resize y rotación (${locale.name})`, () => {
    test('con el tooltip fijado, cambiar el tamaño del viewport lo recoloca junto a su nodo', async ({
      page,
    }) => {
      const problems = watchConsole(page);
      const nodes = await openTree(page, locale.prefix, 'demolition');
      const node = nodes[Math.floor(nodes.length / 2)];
      const shape = await reveal(node);
      const { x, y } = await centre(shape);
      await page.mouse.click(x, y);
      await settled(page, node, 'resize inicial', true);
      const tipBox = () =>
        node.evaluate((element) => {
          const tip = element
            .closest('gd-skill-tree')!
            .querySelector<HTMLElement>('[role="tooltip"]')!;
          const r = tip.getBoundingClientRect();
          return { left: r.left, top: r.top, side: tip.getAttribute('data-side') };
        });
      const before = await tipBox();
      const viewport = page.viewportSize()!;
      // Un cambio de tamaño (y, vía el mismo oyente, un giro) debe recolocar el tooltip abierto.
      for (const size of [
        { width: Math.max(320, Math.round(viewport.width * 0.6)), height: viewport.height },
        { width: viewport.height, height: viewport.width },
      ]) {
        await page.setViewportSize(size);
        await node.scrollIntoViewIfNeeded();
        await settled(page, node, `resize a ${size.width}x${size.height}`, true);
      }
      const after = await tipBox();
      expect(
        after.left !== before.left || after.top !== before.top || after.side !== before.side,
        'el tooltip debe haberse movido o cambiado de lado con el viewport',
      ).toBe(true);
      expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
    });
  });
}

/**
 * spec005 T031 (F-16): cada línea del rótulo del nodo («Circular», tipo, máximo) queda centrada en el eje
 * del nodo (±1 px). El texto SVG usa `text-anchor: middle`; se mide la tinta (del primer al último carácter
 * que no es espacio) con un `Range`, no la caja con sus espacios de relleno.
 */
for (const locale of LOCALES)
  test(`@journeys los rótulos de nodo de soldier (${locale.name}) están centrados en el eje del nodo`, async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}${locale.prefix}/maestrias/soldier`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const offsets = await page.evaluate(() => {
      const out: { id: string; text: string; offset: number }[] = [];
      for (const node of Array.from(document.querySelectorAll('gd-skill-tree [data-skill-id]'))) {
        const id = node.getAttribute('data-skill-id') ?? '';
        const shape = node.querySelector('.skill-tree__shape') ?? node;
        const axis = shape.getBoundingClientRect();
        const axisX = axis.left + axis.width / 2;
        for (const line of Array.from(
          node.querySelectorAll<SVGTSpanElement>(
            '.skill-tree__name tspan, .skill-tree__bar-required tspan',
          ),
        )) {
          const text = line.firstChild;
          const value = text?.textContent ?? '';
          const first = value.search(/\S/);
          if (!text || first < 0) continue;
          const range = document.createRange();
          range.setStart(text, first);
          range.setEnd(text, value.trimEnd().length);
          const box = range.getBoundingClientRect();
          out.push({ id, text: value.trim(), offset: box.left + box.width / 2 - axisX });
        }
      }
      return out;
    });
    expect(offsets.length, 'hay rótulos de nodo').toBeGreaterThan(40);
    const off = offsets.filter((line) => Math.abs(line.offset) > 1);
    expect(off, `líneas fuera del eje (>1 px): ${JSON.stringify(off.slice(0, 5))}`).toEqual([]);
  });

/** Luminancia relativa WCAG de un `rgb()`/`rgba()` computado. */
function luminance(rgb: string): number {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * spec005 T031 (F-13): el nombre secundario del tooltip va siempre en su propia línea, con interlineado
 * ≤ 1,5 y contraste ≥ 4,5:1, en el mismo orden en EN y ES (título, nombre secundario, datos).
 */
for (const locale of LOCALES)
  test(`@journeys tooltip de soldier (${locale.name}): el nombre secundario va en su propia línea, legible y con interlineado normal`, async ({
    page,
  }) => {
    const nodes = await openTree(page, locale.prefix, 'soldier');
    for (const node of nodes.slice(0, 12)) {
      const shape = await reveal(node);
      const { x, y } = await centre(shape);
      await closeTooltip(page);
      await page.mouse.move(x, y);
      await expect(page.locator('gd-skill-tree [role="tooltip"]')).toBeVisible();
      const m = await page.evaluate(() => {
        const tip = document.querySelector<HTMLElement>('gd-skill-tree [role="tooltip"]')!;
        const name = tip.querySelector<HTMLElement>('.skill-tree__tooltip-name')!;
        const second = name.querySelector<HTMLElement>('span')!;
        const text = Array.from(name.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
        )!;
        const range = document.createRange();
        range.selectNodeContents(text);
        const primary = range.getBoundingClientRect();
        const ratio = (el: HTMLElement) => {
          const style = getComputedStyle(el);
          const size = parseFloat(style.fontSize);
          return style.lineHeight === 'normal' ? 1.4 : parseFloat(style.lineHeight) / size;
        };
        return {
          secondTop: second.getBoundingClientRect().top,
          primaryBottom: primary.bottom,
          nameRatio: ratio(name),
          secondRatio: ratio(second),
          fg: getComputedStyle(second).color,
          bg: getComputedStyle(tip).backgroundColor,
          after: second.nextElementSibling?.className ?? '',
        };
      });
      const id = await node.getAttribute('data-skill-id');
      expect(
        m.secondTop,
        `${id}: el nombre secundario empieza bajo el título`,
      ).toBeGreaterThanOrEqual(m.primaryBottom - 1);
      expect(m.nameRatio, `${id}: interlineado del título`).toBeLessThanOrEqual(1.5);
      expect(m.secondRatio, `${id}: interlineado del nombre secundario`).toBeLessThanOrEqual(1.5);
      const [a, b] = [luminance(m.fg), luminance(m.bg)].sort((p, q) => q - p);
      expect(
        (a + 0.05) / (b + 0.05),
        `${id}: contraste del nombre secundario`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

/**
 * spec005 T031 (F-14): la caja del tooltip queda a ≥ 16 px de ambos bordes del viewport (ratón, foco,
 * y volteo en el borde) y a ≤ 16 px del nodo.
 */
for (const locale of LOCALES)
  for (const mode of ['ratón', 'foco'] as const)
    test(`@journeys tooltip de soldier (${locale.name}, ${mode}): a ≥ 16 px de los bordes del viewport y a ≤ 16 px del nodo`, async ({
      page,
    }) => {
      const nodes = await openTree(page, locale.prefix, 'soldier');
      const width = page.viewportSize()!.width;
      for (const node of nodes) {
        const shape = await reveal(node);
        await closeTooltip(page);
        if (mode === 'ratón') {
          const { x, y } = await centre(shape);
          await page.mouse.move(x, y);
        } else await node.focus();
        await expect(page.locator('gd-skill-tree [role="tooltip"]')).toBeVisible();
        await page.waitForTimeout(60);
        const m = await measure(page, node);
        const box = await page.evaluate(() => {
          const r = document
            .querySelector('gd-skill-tree [role="tooltip"]')!
            .getBoundingClientRect();
          return { left: r.left, right: r.right };
        });
        const id = await node.getAttribute('data-skill-id');
        expect(box.left, `${id}: margen izquierdo`).toBeGreaterThanOrEqual(15.5);
        expect(width - box.right, `${id}: margen derecho`).toBeGreaterThanOrEqual(15.5);
        expect(m.gap, `${id}: distancia al nodo`).toBeLessThanOrEqual(MAX_GAP);
      }
    });
