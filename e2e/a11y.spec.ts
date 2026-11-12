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
