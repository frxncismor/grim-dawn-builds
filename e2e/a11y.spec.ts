import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

declare global {
  interface Window {
    axe: typeof import('axe-core');
  }
}

const resolvePackage = createRequire(join(process.cwd(), 'package.json'));
const axeSource = readFileSync(resolvePackage.resolve('axe-core/axe.min.js'), 'utf8');

/** Mismo valor por defecto que `playwright.config.ts` (`webServer` del artefacto). */
const BASE_URL = process.env['A11Y_BASE_URL'] ?? 'http://127.0.0.1:4321';
/** Etiquetas WCAG 2.1 A/AA y 2.2 AA usadas en el resto de las puertas del proyecto. */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** Solo estos impactos bloquean; moderate/minor se registran sin romper la puerta. */
const BLOCKING_IMPACTS = ['critical', 'serious'];

const ROUTES = [
  { name: 'portada', path: '/' },
  { name: 'catálogo', path: '/tier-list' },
  { name: 'guía', path: '/builds/chaman-demoledor-golpe-primigenio' },
  { name: 'acerca', path: '/acerca' },
  { name: 'legal', path: '/legal' },
  { name: 'portada es', path: '/es' },
  { name: 'catálogo es', path: '/es/tier-list' },
  { name: 'guía es', path: '/es/builds/chaman-demoledor-golpe-primigenio' },
  { name: 'acerca es', path: '/es/acerca' },
  { name: 'legal es', path: '/es/legal' },
  { name: 'índice de maestrías', path: '/maestrias' },
  { name: 'índice de maestrías es', path: '/es/maestrias' },
  { name: 'árbol soldier', path: '/maestrias/soldier' },
  { name: 'árbol demolition', path: '/maestrias/demolition' },
  { name: 'árbol soldier es', path: '/es/maestrias/soldier' },
  { name: 'árbol demolition es', path: '/es/maestrias/demolition' },
] as const;
type RouteDefinition = (typeof ROUTES)[number];

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  targets: string[][];
}

interface AuditResult {
  violations: Violation[];
  /** Reglas WCAG que sí se evaluaron y pasaron: evidencia de que axe trabajó. */
  passedRules: number;
  /** Reglas que axe no pudo resolver; se registran por su id para no leerlas como verde. */
  incompleteRules: string[];
}

function isBlocking(impact: string | null): boolean {
  return impact !== null && BLOCKING_IMPACTS.includes(impact);
}

/**
 * Inyecta axe y aplica las reglas WCAG del proyecto.
 *
 * Se usa `page.evaluate(axeSource)` en vez de `page.addScriptTag` porque el
 * segundo pase audita el HTML sin scripts: `addScriptTag` se registra en el
 * mundo de la página, mientras que `evaluate` corre en el mundo aislado de
 * Playwright sobre el mismo DOM sin ejecutar los scripts del sitio.
 */
async function audit(page: Page): Promise<AuditResult> {
  await page.evaluate(axeSource);
  return page.evaluate(async (tags: string[]) => {
    const results = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return {
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        help: violation.help,
        targets: violation.nodes.map((node) => node.target.map(String)),
      })),
      passedRules: results.passes.length,
      incompleteRules: results.incomplete.map((rule) => rule.id),
    };
  }, AXE_TAGS);
}

/** Devuelve el mensaje de fallo si hay violaciones bloqueantes, o `null` si no hay. */
function blockingReport(scope: string, violations: Violation[]): string | null {
  const blocking = violations.filter((violation) => isBlocking(violation.impact));
  if (blocking.length === 0) return null;
  return (
    `${scope}: ${blocking.length} violación(es) axe de impacto critical/serious → ` +
    blocking
      .map(
        (violation) =>
          `${violation.id} (${violation.impact}) en ${violation.targets
            .map((target) => target.join(' '))
            .join(' | ')}`,
      )
      .join('; ')
  );
}

/** Imprime las violaciones moderate/minor con su impacto y selector; no fallan. */
function reportNonBlocking(scope: string, result: AuditResult): void {
  const rest = result.violations.filter((violation) => !isBlocking(violation.impact));
  const summary =
    `${result.passedRules} regla(s) WCAG en verde, ` +
    `${result.incompleteRules.length} incompleta(s)` +
    (result.incompleteRules.length > 0 ? ` [${result.incompleteRules.join(', ')}]` : '');
  if (rest.length === 0) {
    console.log(
      `[a11y] ${scope}: 0 violaciones axe (ninguna crítica, seria, moderada ni menor); ${summary}.`,
    );
    return;
  }
  console.log(
    `[a11y] ${scope}: ${rest.length} violación(es) NO bloqueante(s) registradas; ${summary}:`,
  );
  for (const violation of rest) {
    const targets = violation.targets.map((target) => target.join(' ')).join(' | ');
    console.log(
      `[a11y]   · ${violation.id} (${violation.impact ?? 'sin impacto'}) ${violation.help} → ${targets}`,
    );
  }
}

/** Puerta: cero violaciones de impacto critical o serious. */
function expectGate(scope: string, result: AuditResult): void {
  reportNonBlocking(scope, result);
  expect(blockingReport(scope, result.violations)).toBeNull();
}

/**
 * Abre una ruta del artefacto y falla con un mensaje accionable si no existe.
 * Una ruta ausente no se salta: la puerta debe romperse para que nadie la
 * confunda con un verde.
 */
async function openRoute(page: Page, route: RouteDefinition): Promise<void> {
  const response = await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' });
  if (!response) {
    throw new Error(
      `La ruta ${route.path} no devolvió respuesta en ${BASE_URL}. Construye el artefacto con ` +
        '`pnpm build` y vuelve a ejecutar `pnpm e2e:a11y`.',
    );
  }
  if (response.status() !== 200) {
    throw new Error(
      `La ruta ${route.path} NO existe en el artefacto servido en ${BASE_URL} ` +
        `(HTTP ${response.status()}). Las rutas prerenderizadas deben estar presentes: ` +
        'ejecuta `pnpm build` antes de la puerta axe.',
    );
  }
  const textLength = await page.evaluate(() => document.body.textContent?.trim().length ?? 0);
  expect(
    textLength,
    `La ruta ${route.path} se sirvió pero su DOM está prácticamente vacío (${textLength} caracteres visibles).`,
  ).toBeGreaterThan(200);
}

/**
 * Comprueba que los bundles de la aplicación llegaron al navegador. Sin esta
 * guarda, un artefacto con chunks rotos produciría un "verde" que en realidad
 * auditó solo el HTML prerenderizado.
 *
 * La portada se publica sin JavaScript (contrato estático de 0 B en
 * `scripts/check-initial-js.mts`), así que ahí no hay bundle que verificar: se
 * audita el HTML tal cual y se deja constancia en el log.
 */
async function expectAppBundles(page: Page, scope: string): Promise<void> {
  const referencesAppScript = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].some((script) =>
      (script.getAttribute('src') ?? '').endsWith('.js'),
    ),
  );
  if (!referencesAppScript) {
    console.log(`[a11y] ${scope}: la ruta no referencia bundles de la app (HTML estático sin JS).`);
    return;
  }
  const bundles = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.endsWith('.js'))
      .map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return { name: resource.name, status: resource.responseStatus ?? 0 };
      }),
  );
  expect(
    bundles.length,
    `La ruta ${scope} referencia bundles pero no solicitó ninguno: no se puede afirmar que la app esté activa.`,
  ).toBeGreaterThan(0);
  expect(
    bundles.filter((bundle) => bundle.status >= 400),
    'Algún bundle JavaScript del artefacto falló al cargar (HTTP >= 400).',
  ).toEqual([]);
}

/** Estabiliza el render antes de medir: fuentes resueltas y dos frames pintados. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}

/**
 * Quita los `<script>` del HTML recibido: es exactamente lo que renderiza un
 * navegador con JavaScript desactivado. Añade `<base>` para que CSS y fuentes
 * del artefacto se resuelvan igual que en su URL original.
 */
function withoutScripts(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<head([^>]*)>/i, `<head$1><base href="${BASE_URL}/">`);
}

for (const route of ROUTES) {
  test.describe(`@a11y ${route.name} (${route.path})`, () => {
    test.describe('JavaScript activo', () => {
      test(`${route.name}: sin violaciones critical/serious con la app activa`, async ({
        page,
      }) => {
        await openRoute(page, route);
        await expectAppBundles(page, route.path);
        await settle(page);
        expectGate(`${route.path} · JavaScript activo`, await audit(page));
      });
    });

    test.describe('HTML sin JavaScript', () => {
      test.use({ javaScriptEnabled: false });

      test(`${route.name}: sin violaciones critical/serious sin JavaScript`, async ({
        page,
        browser,
      }) => {
        await openRoute(page, route);
        // axe no puede ejecutarse con JavaScript desactivado (sus temporizadores
        // quedan bloqueados y `run()` nunca resuelve), así que se audita el mismo
        // HTML sin `<script>` en un contexto aparte con JS activo.
        const html = withoutScripts(await page.content());
        const auditContext = await browser.newContext({
          javaScriptEnabled: true,
          viewport: page.viewportSize() ?? undefined,
          locale: 'es-419',
          reducedMotion: 'reduce',
        });
        try {
          const auditPage = await auditContext.newPage();
          await auditPage.setContent(html, { waitUntil: 'networkidle' });
          await settle(auditPage);
          const styleSheets = await auditPage.evaluate(() => document.styleSheets.length);
          expect(
            styleSheets,
            `La auditoría sin JavaScript de ${route.path} no cargó el CSS del artefacto (0 hojas): ` +
              'el resultado de contraste no sería representativo.',
          ).toBeGreaterThan(0);
          expectGate(`${route.path} · sin JavaScript`, await audit(auditPage));
        } finally {
          await auditContext.close();
        }
      });
    });
  });
}

/**
 * Prueba negativa: demuestra que la puerta no es vacía. El fixture tiene una
 * imagen sin `alt`, así que axe debe reportarla y `expectGate` debe romperse.
 */
const FIXTURE_WITHOUT_ALT = [
  '<!doctype html>',
  '<html lang="es">',
  '<head><meta charset="utf-8"><title>Fixture T-041</title></head>',
  '<body><main>',
  '<h1>Fixture con imagen sin texto alternativo</h1>',
  '<p>Documento mínimo para comprobar que el detector axe no está vacío.</p>',
  '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="10" height="10">',
  '</main></body>',
  '</html>',
].join('');

test.describe('@a11y prueba negativa del detector', () => {
  test('un fixture con imagen sin alt produce violación y rompe la puerta', async ({ page }) => {
    await page.setContent(FIXTURE_WITHOUT_ALT);
    const result = await audit(page);
    const report = blockingReport('fixture sin alt', result.violations);
    console.log(
      `[a11y] fixture negativo: ${report ?? 'sin violaciones bloqueantes (puerta vacía)'}`,
    );
    expect(result.violations.map((violation) => violation.id)).toContain('image-alt');
    expect(report).toContain('image-alt');
    expect(() => expectGate('fixture sin alt', result)).toThrow(/image-alt/);
  });
});

/** Luminancia relativa y razón de contraste WCAG 2.x entre dos colores `rgb()/rgba()`. */
function channels(color: string): [number, number, number] {
  const match = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!match) throw new Error(`Color no interpretable: ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function luminance(color: string): number {
  const [r, g, b] = channels(color).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** T013 (spec 003, SC-004): teclado, foco visible y axe con un nodo del árbol enfocado. */
const TREE_ROUTES = ROUTES.filter((route) => route.path.includes('/maestrias/demolition'));
for (const route of TREE_ROUTES) {
  test.describe(`@a11y árbol de maestría con teclado (${route.path})`, () => {
    const activeNode = (page: Page) =>
      page.evaluate(() => {
        const element = document.activeElement;
        return {
          id: element?.getAttribute('data-skill-id') ?? null,
          tag: element?.tagName.toLowerCase() ?? null,
          canvas: element?.classList.contains('skill-tree__canvas') ?? false,
        };
      });

    async function focusFirstNode(page: Page): Promise<void> {
      await openRoute(page, route);
      await expectAppBundles(page, route.path);
      await settle(page);
      await page
        .locator('h1')
        .focus({ timeout: 100 })
        .catch(() => undefined);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      // Tab hasta el contenedor desplazable del diagrama y una más hasta el nodo itinerante.
      let reachedCanvas = false;
      for (let presses = 0; presses < 60 && !reachedCanvas; presses++) {
        await page.keyboard.press('Tab');
        reachedCanvas = (await activeNode(page)).canvas;
      }
      expect(reachedCanvas, 'Tab debe alcanzar el diagrama del árbol').toBe(true);
      await page.keyboard.press('Tab');
      const node = await activeNode(page);
      expect(node.id, 'el siguiente Tab debe caer en un nodo del árbol').not.toBeNull();
    }

    test('Tab llega al árbol y el indicador de foco del nodo tiene contraste ≥ 3:1', async ({
      page,
    }) => {
      await focusFirstNode(page);
      const focus = await page.evaluate(() => {
        const element = document.activeElement as Element;
        const style = getComputedStyle(element);
        const canvas = document.querySelector('.skill-tree__canvas') as Element;
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          outlineColor: style.outlineColor,
          background: getComputedStyle(canvas).backgroundColor,
        };
      });
      expect(focus.outlineStyle, 'el nodo enfocado debe dibujar un contorno').not.toBe('none');
      expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
      expect(
        contrast(focus.outlineColor, focus.background),
        `contraste del indicador de foco (${focus.outlineColor} sobre ${focus.background})`,
      ).toBeGreaterThanOrEqual(3);
    });

    test('axe sin violaciones critical/serious con un nodo enfocado', async ({ page }) => {
      await focusFirstNode(page);
      expectGate(`${route.path} · nodo enfocado`, await audit(page));
    });

    test('flechas mueven el foco, Enter abre el detalle y Escape lo cierra devolviendo el foco', async ({
      page,
    }) => {
      await focusFirstNode(page);
      const first = (await activeNode(page)).id!;
      await page.keyboard.press('End');
      const last = (await activeNode(page)).id!;
      expect(last, 'End debe mover el foco al último nodo').not.toBe(first);
      await page.keyboard.press('Home');
      expect((await activeNode(page)).id, 'Home vuelve al primer nodo').toBe(first);
      let moved = false;
      for (const key of ['ArrowRight', 'ArrowDown']) {
        await page.keyboard.press(key);
        if ((await activeNode(page)).id !== first) {
          moved = true;
          break;
        }
      }
      expect(moved, 'alguna flecha debe mover el foco a otro nodo').toBe(true);
      await page.keyboard.press('Home');

      const close = page.locator('[data-close-detail]');
      await expect(close).toHaveCount(0);
      await page.keyboard.press('Enter');
      await expect(close, 'Enter abre el detalle con su botón de cierre').toHaveCount(1);
      await expect(page.locator('[data-detail-panel] h3')).not.toHaveText('');
      await page.keyboard.press('Escape');
      await expect(close, 'Escape cierra el detalle').toHaveCount(0);
      expect((await activeNode(page)).id, 'el foco vuelve al nodo').toBe(first);
    });
  });
}

/**
 * T027 (spec 003, US2): el índice `/maestrias` se recorre con teclado. Tab pasa por las seis
 * filas (un enlace por maestría) con un indicador de foco visible de contraste ≥ 3:1 y Enter
 * abre la maestría.
 */
const INDEX_ROUTES = ROUTES.filter((route) => /^(\/es)?\/maestrias$/.test(route.path));
for (const route of INDEX_ROUTES) {
  test.describe(`@a11y índice de maestrías con teclado (${route.path})`, () => {
    const focused = (page: Page) =>
      page.evaluate(() => {
        const link = document.activeElement?.closest('a');
        const row = document.activeElement?.closest('[data-mastery]');
        const target = (row ?? document.activeElement) as Element;
        const style = getComputedStyle(target);
        return {
          slug: row?.getAttribute('data-mastery') ?? null,
          href: link?.getAttribute('href') ?? null,
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          outlineColor: style.outlineColor,
          background: getComputedStyle(row ?? document.body).backgroundColor,
        };
      });

    test('Tab recorre las seis filas con foco visible y contraste ≥ 3:1', async ({ page }) => {
      await openRoute(page, route);
      await expectAppBundles(page, route.path);
      await settle(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const visited: string[] = [];
      for (let presses = 0; presses < 40 && visited.length < 6; presses++) {
        await page.keyboard.press('Tab');
        const state = await focused(page);
        if (!state.slug) continue;
        visited.push(state.slug);
        expect(
          state.outlineStyle,
          `${state.slug}: la fila enfocada debe dibujar contorno`,
        ).not.toBe('none');
        expect(state.outlineWidth).toBeGreaterThanOrEqual(2);
        expect(
          contrast(state.outlineColor, state.background),
          `contraste del foco de ${state.slug} (${state.outlineColor} sobre ${state.background})`,
        ).toBeGreaterThanOrEqual(3);
      }
      expect(visited, 'Tab debe pasar por las seis maestrías en orden').toEqual([
        'arcanist',
        'demolition',
        'nightblade',
        'occult',
        'shaman',
        'soldier',
      ]);
    });

    test('Enter sobre una fila abre la maestría', async ({ page }) => {
      await openRoute(page, route);
      await expectAppBundles(page, route.path);
      await settle(page);
      const prefix = route.path.startsWith('/es') ? '/es' : '';
      await page.locator('[data-mastery="demolition"] a').focus();
      await page.keyboard.press('Enter');
      await page.waitForURL(`**${prefix}/maestrias/demolition`);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  });
}
