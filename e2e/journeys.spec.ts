import { expect, test, type Page, type Response } from '@playwright/test';

/**
 * T-040 - recorridos E2E sobre el artefacto prerenderizado (plan §17.52).
 *
 * Se mide lo que se publica, no `ng serve`. El artefacto público lo sirve
 * `playwright.config.ts` en `E2E_PORT` (4321 por defecto). Los casos de guía
 * usan además el artefacto local de borradores, que debe construirse aparte en
 * un directorio aislado; desde T-067 el CLI de Angular vive en `apps/web`:
 *
 *   $env:INCLUDE_DRAFTS='true'; pnpm --filter @gd/web exec ng build --output-path ../../dist/e2e-drafts
 *
 * y se sirve en `E2E_DRAFTS_PORT` (4322) con `E2E_DRAFTS_ARTIFACT_DIR` opcional.
 * Sin ese artefacto los casos de guía fallan con el comando exacto: no se
 * saltan, para que nadie confunda una ausencia con un verde.
 *
 * Límite conocido y medido: la guía del MVP se publica como contenido propio
 * (`rights_status=own_original`, T-044), así que el artefacto público incluye
 * `/builds/:slug` y el catálogo enlaza la guía. El recorrido comprueba la guía
 * real y conserva un 404 genuino para un slug inexistente.
 */
const PUBLIC_BASE_URL = (
  process.env['E2E_BASE_URL'] ??
  process.env['A11Y_BASE_URL'] ??
  'http://127.0.0.1:4321'
).replace(/\/+$/, '');
const DRAFTS_BASE_URL = (process.env['E2E_DRAFTS_BASE_URL'] ?? 'http://127.0.0.1:4322').replace(
  /\/+$/,
  '',
);
const DRAFTS_BUILD_COMMAND =
  "$env:INCLUDE_DRAFTS='true'; pnpm --filter @gd/web exec ng build --output-path ../../dist/e2e-drafts";
const GUIDE_PATH = '/builds/chaman-demoledor-golpe-primigenio';
const GUIDE_TITLE = /Chamán \+ Demoledor/i;
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});

/** Abre una URL y falla con un mensaje accionable si no hay respuesta. */
async function open(page: Page, url: string): Promise<Response> {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  if (!response) throw new Error(`Sin respuesta al abrir ${url}.`);
  return response;
}

/** Exige un `h1` único con el texto indicado: cada paso del recorrido lo comprueba. */
async function expectSingleHeading(page: Page, expected: string | RegExp, scope: string) {
  const heading = page.locator('h1');
  await expect(heading, `${scope}: se esperaba un único h1`).toHaveCount(1);
  await expect(heading, `${scope}: h1 inesperado`).toHaveText(expected);
}

/** Estabiliza el render: fuentes resueltas y dos frames pintados (como T-036/T-041). */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}

/**
 * Con `javaScriptEnabled: false` los temporizadores y `requestAnimationFrame`
 * del documento no se ejecutan, así que `settle` nunca resolvería: la espera se
 * hace desde el runner y las mediciones siguen siendo `evaluate` síncronos.
 */
async function settleWithoutScripts(page: Page): Promise<void> {
  await page.waitForTimeout(200);
  await page.evaluate(() => document.fonts.ready);
}

interface AnchorProbe {
  found: boolean;
  /** Distancia del destino al borde superior del viewport. */
  top: number;
  /** Borde inferior de la cabecera (negativo si ya se desplazó fuera). */
  headerBottom: number;
  /** El punto del destino bajo el borde superior pertenece a otra capa. */
  covered: boolean;
  /** El TOC fijo se solapa con el destino (criterio de T-036). */
  tocOverlaps: boolean;
}

/**
 * Mide el destino de un ancla con el criterio de T-036: el punto del elemento
 * situado bajo el borde superior del viewport debe pertenecer al destino, y el
 * TOC fijo no puede solaparlo. `headerBottom` se informa para distinguir una
 * cabecera fija de una que ya salió de pantalla.
 */
async function probeAnchor(page: Page, anchorId: string): Promise<AnchorProbe> {
  return page.evaluate((id) => {
    const target = document.getElementById(id);
    if (!target)
      return { found: false, top: -1, headerBottom: 0, covered: true, tocOverlaps: true };
    const box = target.getBoundingClientRect();
    const headerBottom =
      document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    const point = document.elementFromPoint(Math.max(box.left, 0) + 8, box.top + 8);
    const tocBox = document.querySelector('gd-build-toc')?.getBoundingClientRect();
    const tocOverlaps = tocBox
      ? !(
          box.right <= tocBox.left ||
          box.left >= tocBox.right ||
          box.bottom <= tocBox.top ||
          box.top >= tocBox.bottom
        )
      : false;
    return {
      found: true,
      top: box.top,
      headerBottom,
      covered: !point || !target.contains(point),
      tocOverlaps,
    };
  }, anchorId);
}

/** Comprueba que `#id` quedó visible y sin tapar tras navegar con el ancla. */
async function expectAnchorVisible(page: Page, anchorId: string, scope: string): Promise<void> {
  await expect
    .poll(async () => (await probeAnchor(page, anchorId)).covered, {
      message: `${scope}: el destino #${anchorId} quedó tapado por la cabecera o el TOC`,
      timeout: 10000,
    })
    .toBe(false);
  const probe = await probeAnchor(page, anchorId);
  expect(probe.found, `${scope}: no existe el destino #${anchorId}`).toBe(true);
  expect(
    probe.top,
    `${scope}: #${anchorId} quedó fuera de pantalla (top ${probe.top.toFixed(1)}px)`,
  ).toBeGreaterThanOrEqual(-1);
  expect(
    probe.top,
    `${scope}: #${anchorId} empezó bajo la cabecera (top ${probe.top.toFixed(1)}px, cabecera ${probe.headerBottom.toFixed(1)}px)`,
  ).toBeGreaterThanOrEqual(probe.headerBottom - 1);
  expect(probe.tocOverlaps, `${scope}: el TOC fijo tapa el destino #${anchorId}`).toBe(false);
}

/** Recuento del catálogo desde el `role="status"` que anuncia los resultados. */
async function resultCount(page: Page): Promise<{ visible: number; total: number }> {
  const text = (await page.locator('.result-count').innerText()).trim();
  const match = /^(\d+)\s+of\s+(\d+)/.exec(text);
  if (!match) throw new Error(`Recuento del catálogo ilegible: «${text}».`);
  return { visible: Number(match[1]), total: Number(match[2]) };
}

test.describe('@journeys artefacto público', () => {
  test('portada → catálogo → portada con enlaces reales', async ({ page }) => {
    const home = await open(page, `${PUBLIC_BASE_URL}/`);
    expect(home.status(), 'la portada debe servirse').toBe(200);
    await expectSingleHeading(page, /Grim Dawn guides/i, 'portada');

    await page.getByRole('link', { name: 'Browse the catalog', exact: true }).click();
    await page.waitForURL(/\/tier-list$/);
    await expectSingleHeading(page, /Catálogo de combinaciones de maestrías/i, 'catálogo');

    const cards = page.locator('gd-tier-card');
    expect(await cards.count(), 'el catálogo debe listar combinaciones').toBeGreaterThan(0);
    await expect(page.locator('.result-count')).toContainText(/of \d+ entries/);

    // La guía del MVP ya está publicada como contenido propio: el catálogo
    // debe enlazarla y el recorrido la sigue. Si algún día no hay enlace, se
    // conserva la comprobación alternativa de ranuras pendientes.
    const guideLinks = page.locator('a[href^="/builds/"]');
    const guideCount = await guideLinks.count();
    expect(guideCount, 'el catálogo debe enlazar la guía publicada').toBeGreaterThan(0);
    if (guideCount > 0) {
      const href = await guideLinks.first().getAttribute('href');
      await guideLinks.first().click();
      await page.waitForURL(new RegExp(`${href}$`));
      const heading = await page.locator('h1').innerText();
      expect(heading.trim().length, 'la guía enlazada debe tener h1').toBeGreaterThan(0);
      console.log(`[journeys] catálogo: ${guideCount} enlace(s) a guía; seguido ${href}.`);
      await page.goBack();
      await page.waitForURL(/\/tier-list$/);
    } else {
      const pending = await page.getByText('Guide coming soon').count();
      expect(
        pending,
        'sin guías publicadas el catálogo debe marcar las ranuras como pendientes, no enlazarlas',
      ).toBeGreaterThan(0);
      console.log('[journeys] catálogo: 0 enlaces a /builds (guía pendiente de derechos, T-044).');
    }

    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForURL(new RegExp(`${PUBLIC_BASE_URL.replaceAll('.', '\\.')}/$`));
    await expectSingleHeading(page, /Grim Dawn guides/i, 'vuelta a portada');
  });

  test('enlaces del pie: aviso legal y autoría', async ({ page }) => {
    await open(page, `${PUBLIC_BASE_URL}/`);

    await page.getByRole('link', { name: 'Legal notice', exact: true }).click();
    await page.waitForURL(/\/legal$/);
    await expectSingleHeading(page, 'Legal notice', 'aviso legal');
    const legalText = await page.locator('main').innerText();
    expect(legalText.length, '/legal servido con contenido real').toBeGreaterThan(200);

    await page.getByRole('link', { name: 'Editorial criteria', exact: true }).click();
    await page.waitForURL(/\/acerca$/);
    await expectSingleHeading(page, 'About the project', 'acerca');

    const authorLinks = page.locator('main a[href^="/autores/"]');
    await expect(
      authorLinks,
      '/acerca debe enlazar el perfil público del autor que posee el catálogo',
    ).not.toHaveCount(0);
    const authorName = (await authorLinks.first().innerText()).trim();
    const authorHref = await authorLinks.first().getAttribute('href');
    expect(authorHref, 'el enlace de autor debe apuntar a /autores/:slug').toMatch(
      /^\/autores\/[a-z0-9-]+$/,
    );
    await authorLinks.first().click();
    await page.waitForURL(/\/autores\/[a-z0-9-]+$/);
    await expectSingleHeading(page, authorName, 'perfil de autor');
  });

  test('filtros de /tier-list siguen la URL al recargar y en el historial', async ({ page }) => {
    await open(page, `${PUBLIC_BASE_URL}/tier-list`);
    const chip = page.getByRole('button', { name: 'Arcanist', exact: true });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    const initial = await resultCount(page);

    await chip.click();
    await expect(page).toHaveURL(/[?&]m=arcanista/);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const filtered = await resultCount(page);
    expect(filtered.total, 'el total del catálogo no cambia al filtrar').toBe(initial.total);
    expect(filtered.visible, 'el filtro debe reducir las entradas visibles').toBeLessThan(
      initial.visible,
    );

    // Recarga completa: el estado se reconstruye desde la query, no desde memoria.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/[?&]m=arcanista/);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(await resultCount(page), 'tras recargar, el filtro sigue aplicado').toEqual(filtered);

    // Historial: atrás vuelve al catálogo completo y adelante reaplica el filtro.
    await page.goBack();
    await expect(page).toHaveURL(/\/tier-list$/);
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(await resultCount(page), 'atrás debe restaurar el catálogo completo').toEqual(initial);

    await page.goForward();
    await expect(page).toHaveURL(/[?&]m=arcanista/);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(await resultCount(page), 'adelante debe reaplicar el filtro').toEqual(filtered);
  });

  test('el build público sirve la guía publicada y mantiene un 404 real', async ({ page }) => {
    const response = await open(page, `${PUBLIC_BASE_URL}${GUIDE_PATH}`);
    expect(response.status(), `GET ${GUIDE_PATH} en el artefacto público`).toBe(200);
    await expectSingleHeading(page, GUIDE_TITLE, 'guía pública');
    await expect(page.locator('gd-build-toc')).toHaveCount(1);

    const missing = await open(page, `${PUBLIC_BASE_URL}/builds/guia-inexistente`);
    expect(missing.status(), 'GET /builds/guia-inexistente en el artefacto público').toBe(404);
    await expectSingleHeading(page, 'Page not found', '404 público');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('gd-build-toc')).toHaveCount(0);
    expect(await page.getByText('Devotion path').count(), 'el 404 no debe contener la guía').toBe(
      0,
    );
  });
});

test.describe('@journeys conmutador de idioma', () => {
  test('el enlace a español conserva ruta y query y vuelve al inglés', async ({ page }) => {
    await open(page, `${PUBLIC_BASE_URL}/tier-list?m=arcanista`);
    await page.getByRole('link', { name: 'Español', exact: true }).click();
    await page.waitForURL(/\/es\/tier-list\?m=arcanista$/);
    expect(await page.locator('html').getAttribute('lang')).toBe('es');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/es\/tier-list$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/tier-list$/,
    );
    await expect(page.locator('gd-tier-card').first()).toBeVisible();

    await page.getByRole('link', { name: 'English', exact: true }).click();
    await page.waitForURL(/\/tier-list\?m=arcanista$/);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
  });
});

test.describe('@journeys guía en el artefacto de borradores', () => {
  test('el ancla #devociones aterriza sin quedar tapada', async ({ page }) => {
    const response = await open(page, `${DRAFTS_BASE_URL}${GUIDE_PATH}`);
    if (response.status() !== 200) {
      throw new Error(
        `El artefacto de borradores no sirve ${GUIDE_PATH} en ${DRAFTS_BASE_URL} ` +
          `(HTTP ${response.status()}). Construye el artefacto aislado con: ${DRAFTS_BUILD_COMMAND}`,
      );
    }
    await expectSingleHeading(page, GUIDE_TITLE, 'guía de borradores');

    const tocLink = page.locator('gd-build-toc a[href$="#devociones"]');
    await expect(tocLink, 'el TOC debe ofrecer el destino #devociones').toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await tocLink.click();
    await expect(page).toHaveURL(/#devociones$/);
    await settle(page);

    await expect(page.locator('#devociones')).toBeVisible();
    await expect(page.locator('#devociones h2')).toHaveText(/Devotion path/i);
    await expectAnchorVisible(page, 'devociones', 'guía de borradores');

    // Enlace compartido: recargar con el ancla debe volver a aterrizar en el destino.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/#devociones$/);
    await settle(page);
    await expectAnchorVisible(page, 'devociones', 'guía de borradores recargada');
    expect(
      await page.locator('#devociones').innerText(),
      'la sección debe conservar su alternativa textual',
    ).toMatch(/empty throne/i);
  });
});

test.describe('@journeys sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('navegación y ancla funcionan sin hidratación', async ({ page }) => {
    // Punto 1: mismo recorrido portada → catálogo → portada, sin bootstrap.
    await open(page, `${PUBLIC_BASE_URL}/`);
    await expectSingleHeading(page, /Grim Dawn guides/i, 'portada sin JavaScript');
    await page.getByRole('link', { name: 'Browse the catalog', exact: true }).click();
    await page.waitForURL(/\/tier-list$/);
    await expectSingleHeading(page, /Catálogo de combinaciones de maestrías/i, 'catálogo sin JS');
    expect(
      await page.locator('gd-tier-card').count(),
      'el catálogo completo debe estar en el HTML, sin depender de hidratación',
    ).toBeGreaterThan(0);
    await expect(page.getByText(/The full catalog can be read without JavaScript/)).toBeVisible();
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForURL(new RegExp(`${PUBLIC_BASE_URL.replaceAll('.', '\\.')}/$`));
    await expectSingleHeading(page, /Grim Dawn guides/i, 'vuelta a portada sin JS');

    // Punto 4: el ancla del TOC es un enlace HTML real y aterriza igual sin JS.
    const response = await open(page, `${DRAFTS_BASE_URL}${GUIDE_PATH}`);
    if (response.status() !== 200) {
      throw new Error(
        `El artefacto de borradores no sirve ${GUIDE_PATH} en ${DRAFTS_BASE_URL} ` +
          `(HTTP ${response.status()}). Construye el artefacto aislado con: ${DRAFTS_BUILD_COMMAND}`,
      );
    }
    await expectSingleHeading(page, GUIDE_TITLE, 'guía sin JavaScript');
    const tocLink = page.locator('gd-build-toc a[href$="#devociones"]');
    await expect(tocLink, 'el TOC debe existir en el HTML prerenderizado').toHaveCount(1);
    await tocLink.click();
    await page.waitForURL(/#devociones$/);
    await page.waitForLoadState('networkidle');
    await settleWithoutScripts(page);

    await expect(page.locator('#devociones h2')).toHaveText(/Devotion path/i);
    await expectAnchorVisible(page, 'devociones', 'guía sin JavaScript');
    expect(
      await page.locator('#devociones').innerText(),
      'la alternativa textual de devociones debe estar en el HTML',
    ).toMatch(/empty throne/i);
  });
});
