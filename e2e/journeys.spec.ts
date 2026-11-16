import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

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

/** A <768 px la navegación vive en el menú `details` de la cabecera (T044): se abre si hace falta. */
async function openHeaderMenu(page: Page): Promise<void> {
  const summary = page.locator('.site-header summary');
  if (await summary.isVisible()) {
    if ((await page.locator('.site-header details[open]').count()) === 0) await summary.click();
  }
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

    const cards = page.locator('gd-build-card');
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
      const pending = await page.getByText('No guide').count();
      expect(
        pending,
        'sin guías publicadas el catálogo debe marcar las ranuras como pendientes, no enlazarlas',
      ).toBeGreaterThan(0);
      console.log('[journeys] catálogo: 0 enlaces a /builds (guía pendiente de derechos, T-044).');
    }

    await openHeaderMenu(page);
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
    await openHeaderMenu(page);
    await page.getByRole('link', { name: 'Español', exact: true }).click();
    await page.waitForURL(/\/es\/tier-list\?m=arcanista$/);
    expect(await page.locator('html').getAttribute('lang')).toBe('es');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/es\/tier-list$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/tier-list$/,
    );
    // The first card may sit in the folded "no guide" section: it is in the HTML, not necessarily visible.
    expect(await page.locator('gd-build-card').count()).toBeGreaterThan(0);

    await openHeaderMenu(page);
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
      await page.locator('gd-build-card').count(),
      'el catálogo completo debe estar en el HTML, sin depender de hidratación',
    ).toBeGreaterThan(0);
    await expect(page.getByText(/The full catalog can be read without JavaScript/)).toBeVisible();
    await openHeaderMenu(page);
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

/**
 * T013 (spec 003, SC-003): el árbol de maestría se lee sin JavaScript. El HTML prerenderizado
 * ya contiene el h1, los 33 nodos de Demoledor y la lista textual completa y abierta.
 */
test.describe('@journeys árbol de maestría sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const [path, heading, listHint] of [
    ['/maestrias/demolition', 'Demolitionist', /No requirement/],
    ['/es/maestrias/demolition', 'Demoledor', /Sin requisito/],
  ] as const) {
    test(`${path}: h1, 33 nodos y lista textual completa en el HTML`, async ({ page }) => {
      const response = await open(page, `${PUBLIC_BASE_URL}${path}`);
      expect(response.status(), `${path} debe existir en el artefacto prerenderizado`).toBe(200);
      await expectSingleHeading(page, heading, `${path} sin JavaScript`);
      await expect(page.locator('[data-skill-id]')).toHaveCount(33);
      const items = page.locator('details.skill-tree__list li');
      await expect(items, 'la lista textual debe incluir todos los nodos').toHaveCount(33);
      await expect(page.locator('details.skill-tree__list')).toHaveAttribute('open', '');
      await expect(items.first()).toBeVisible();
      // T030: the list is `content-visibility: auto`, so the browser only renders it (and only then
      // `innerText` returns it) once it nears the viewport. The text is in the HTML regardless.
      const list = page.locator('details.skill-tree__list');
      expect(await list.textContent(), 'el texto está en el HTML sin desplazarse').toMatch(
        listHint,
      );
      await list.scrollIntoViewIfNeeded();
      await expect(items.first()).toBeVisible();
      await expect
        .poll(() => list.innerText(), { message: 'al llegar a la lista se renderiza completa' })
        .toMatch(listHint);
    });
  }
});

/**
 * T027 (spec 003, US2): el índice `/maestrias` se lee sin JavaScript. El HTML prerenderizado ya
 * contiene las seis filas con su nombre, su recuento real y su enlace a `/maestrias/<slug>`.
 */
test.describe('@journeys índice de maestrías sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const [path, heading, prefix, names] of [
    [
      '/maestrias',
      'Mastery skill trees',
      '',
      ['Arcanist', 'Demolitionist', 'Nightblade', 'Occultist', 'Shaman', 'Soldier'],
    ],
    [
      '/es/maestrias',
      'Árboles de habilidades de las maestrías',
      '/es',
      ['Arcanista', 'Demoledor', 'Hoja de la Noche', 'Ocultista', 'Chamán', 'Soldado'],
    ],
  ] as const) {
    test(`${path}: seis filas con nombre, recuento y enlace en el HTML`, async ({ page }) => {
      const response = await open(page, `${PUBLIC_BASE_URL}${path}`);
      expect(response.status(), `${path} debe existir en el artefacto prerenderizado`).toBe(200);
      await expectSingleHeading(page, heading, `${path} sin JavaScript`);
      const rows = page.locator('[data-mastery]');
      await expect(rows).toHaveCount(6);
      const slugs = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'];
      const counts = [30, 33, 31, 30, 30, 32];
      for (const [index, slug] of slugs.entries()) {
        const row = rows.nth(index);
        await expect(row).toHaveAttribute('data-mastery', slug);
        await expect(row.locator('a')).toHaveText(names[index]!);
        await expect(row.locator('a')).toHaveAttribute('href', `${prefix}/maestrias/${slug}`);
        await expect(row.locator('[data-count]')).toContainText(String(counts[index]));
      }
      await expect(page.locator('[data-empty]')).toHaveCount(0);
    });
  }
});

/** T027: índice → una maestría → vuelta, en inglés y en español. */
test.describe('@journeys índice → maestría → vuelta', () => {
  for (const [path, prefix, name] of [
    ['/maestrias', '', 'Demolitionist'],
    ['/es/maestrias', '/es', 'Demoledor'],
  ] as const)
    test(`${path}: abre Demoledor y vuelve al índice con el historial`, async ({ page }) => {
      await open(page, `${PUBLIC_BASE_URL}${path}`);
      await page.locator('[data-mastery="demolition"] a').click();
      await page.waitForURL(`**${prefix}/maestrias/demolition`);
      await expectSingleHeading(page, name, `${path} → maestría`);
      await expect(page.locator('[data-skill-id]')).toHaveCount(33);
      await page.goBack();
      await page.waitForURL(`**${path}`);
      await expect(page.locator('[data-mastery]')).toHaveCount(6);
      await expect(page.locator('h1')).toHaveCount(1);
    });
});

/**
 * spec004 T034 (US6, FR-025): el selector de maestrías de `/maestrias/<slug>` lleva a otra
 * maestría conservando el idioma, sin errores de CSP ni violaciones axe críticas o serias.
 */
test.describe('@journeys selector de maestrías', () => {
  const axeSource = readFileSync(
    createRequire(join(process.cwd(), 'package.json')).resolve('axe-core/axe.min.js'),
    'utf8',
  );
  const SIX = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'];

  for (const [prefix, from, to, toName, label] of [
    ['', 'demolition', 'shaman', 'Shaman', 'inglés'],
    ['/es', 'demolition', 'shaman', 'Chamán', 'español'],
  ] as const)
    test(`${label}: de ${from} a ${to} desde el selector, sin CSP ni axe`, async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (
          message.type() === 'error' ||
          /content security policy|refused to/i.test(message.text())
        )
          problems.push(`${message.type()}: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

      await open(page, `${PUBLIC_BASE_URL}${prefix}/maestrias/${from}`);
      const switcher = page.locator('nav[data-mastery-switcher]');
      await expect(switcher).toHaveCount(1);
      // The six masteries, each linking to its own route in the same language.
      const hrefs = await switcher
        .locator('a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(hrefs).toEqual(SIX.map((slug) => `${prefix}/maestrias/${slug}`));
      await expect(switcher.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(switcher.locator('[aria-current="page"]')).toHaveAttribute(
        'href',
        `${prefix}/maestrias/${from}`,
      );

      await switcher.locator(`a[href$="/maestrias/${to}"]`).click();
      await page.waitForURL(`**${prefix}/maestrias/${to}`);
      await expectSingleHeading(page, toName, `selector → ${to}`);
      await expect(page.locator('[data-skill-id]').first()).toBeAttached();
      await expect(
        page.locator('nav[data-mastery-switcher] [aria-current="page"]'),
      ).toHaveAttribute('href', `${prefix}/maestrias/${to}`);

      await page.evaluate(axeSource);
      const violations = await page.evaluate(async () => {
        const results = await (
          window as unknown as {
            axe: {
              run: (
                c: Document,
              ) => Promise<{ violations: { id: string; impact: string | null }[] }>;
            };
          }
        ).axe.run(document);
        return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      });
      expect(
        violations,
        'axe: sin violaciones críticas ni serias en la maestría de destino',
      ).toEqual([]);
      expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
    });
});

/**
 * T026 (spec 003): el snapshot global de catálogo y autores solo viaja en las páginas que lo
 * leen. Las de maestría no lo llevan en `ng-state` (presupuesto de HTML) y, al navegar desde ellas
 * al catálogo, el guard carga el documento prerenderizado en vez de fallar.
 */
test.describe('@journeys snapshot de catálogo solo donde se lee', () => {
  const SNAPSHOT_KEYS = ['gd-public-catalog', 'gd-public-authors'];
  const transferKeys = async (page: Page, path: string): Promise<string[]> => {
    const response = await page.request.get(`${PUBLIC_BASE_URL}${path}`);
    expect(response.status(), `${path} debe existir`).toBe(200);
    const match = (await response.text()).match(
      /<script[^>]*id=["']ng-state["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    return match ? Object.keys(JSON.parse(match[1]!) as Record<string, unknown>) : [];
  };

  for (const path of [
    '/maestrias/soldier',
    '/maestrias/demolition',
    '/es/maestrias/soldier',
    '/es/maestrias/demolition',
  ])
    test(`${path}: sin snapshot de catálogo ni autores en ng-state`, async ({ page }) => {
      const keys = await transferKeys(page, path);
      for (const key of SNAPSHOT_KEYS)
        expect(keys, `${path} no debe llevar ${key}`).not.toContain(key);
    });

  for (const path of ['/tier-list', '/es/tier-list'])
    test(`${path}: conserva el snapshot completo (catálogo y autores) en ng-state`, async ({
      page,
    }) => {
      const keys = await transferKeys(page, path);
      for (const key of SNAPSHOT_KEYS) expect(keys, `${path} debe llevar ${key}`).toContain(key);
    });

  for (const [path, link, listUrl] of [
    ['/maestrias/demolition', 'Browse the build catalog', /\/tier-list$/],
    ['/es/maestrias/demolition', 'Explorar el catálogo de builds', /\/es\/tier-list$/],
  ] as const)
    test(`${path}: el enlace al catálogo funciona sin snapshot en la página de origen`, async ({
      page,
    }) => {
      await open(page, `${PUBLIC_BASE_URL}${path}`);
      await page.getByRole('link', { name: link, exact: true }).click();
      await page.waitForURL(listUrl);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(/Catálogo de combinaciones de maestrías/i);
      expect(await page.locator('gd-build-card').count()).toBeGreaterThan(0);
    });
});

/**
 * T-167 - fachada de video bajo la CSP real del servidor de artefacto
 * (plan §17.59). Se sirve la vista previa sintética `video-facade-preview`:
 * ninguna guía publicada tiene video. YouTube se intercepta con `page.route`,
 * así que la prueba no depende de la red externa.
 */
const VIDEO_PREVIEW_BASE_URL = (
  process.env['E2E_VIDEO_PREVIEW_BASE_URL'] ?? 'http://127.0.0.1:4323'
).replace(/\/+$/, '');
const VIDEO_PREVIEW_BUILD_COMMAND =
  'pnpm --filter @gd/web exec ng build --configuration video-facade-preview';

interface CspProbe {
  violations: string[];
  external: string[];
}

async function openVideoPreview(page: Page): Promise<CspProbe> {
  const probe: CspProbe = { violations: [], external: [] };
  await page.exposeFunction('gdReportViolation', (directive: string, blocked: string) => {
    probe.violations.push(`${directive} ${blocked}`);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (
        window as unknown as { gdReportViolation: (d: string, b: string) => void }
      ).gdReportViolation(event.effectiveDirective, event.blockedURI);
    });
  });
  page.on('request', (request) => {
    if (!request.url().startsWith(VIDEO_PREVIEW_BASE_URL)) probe.external.push(request.url());
  });
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) probe.violations.push(message.text());
  });
  const response = await open(page, `${VIDEO_PREVIEW_BASE_URL}/`);
  if (response.status() !== 200) {
    throw new Error(
      `El artefacto de la fachada no sirve / en ${VIDEO_PREVIEW_BASE_URL} ` +
        `(HTTP ${response.status()}). Constrúyelo con: ${VIDEO_PREVIEW_BUILD_COMMAND}`,
    );
  }
  return probe;
}

test.describe('@journeys fachada de video bajo la CSP', () => {
  test('activar crea el iframe de youtube-nocookie sin violaciones de CSP', async ({ page }) => {
    await page.route('https://www.youtube-nocookie.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
    );
    const probe = await openVideoPreview(page);
    const csp = (await page.request.get(`${VIDEO_PREVIEW_BASE_URL}/`)).headers()[
      'content-security-policy'
    ];
    expect(csp, 'el servidor debe declarar frame-src para YouTube').toContain(
      'frame-src https://www.youtube-nocookie.com',
    );

    const section = page.locator('#video-de-muestra');
    await expect(section.locator('lite-youtube')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(probe.external, 'ninguna petición externa antes de activar').toEqual([]);

    await section.locator('lite-youtube button').click();
    await expect(section.locator('lite-youtube iframe')).toHaveAttribute(
      'src',
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/SampleID_01\?/,
    );
    await page.waitForTimeout(500);
    expect(probe.violations, 'la CSP no debe bloquear nada').toEqual([]);
    expect(
      probe.external.every((url) => url.startsWith('https://www.youtube-nocookie.com/')),
      `solo se contacta youtube-nocookie.com: ${probe.external.join(', ')}`,
    ).toBe(true);
  });

  test('un iframe que nunca carga termina en alerta y conserva el enlace', async ({ page }) => {
    await page.route('https://www.youtube-nocookie.com/**', () => undefined);
    await openVideoPreview(page);
    const section = page.locator('#video-de-muestra');
    await section.locator('lite-youtube button').click();
    await expect(section.locator('[role="alert"]')).toBeVisible({ timeout: 14000 });
    await expect(section.locator('lite-youtube')).toHaveCount(0);
    await expect(section.locator('a[href="https://youtu.be/SampleID_01"]')).toBeVisible();
  });
});

/**
 * spec004 T023 (US2): la guía se lee sin JavaScript (resumen e índice en el HTML), el índice marca
 * la sección actual al desplazarse, el paso a paso resalta el árbol y se anuncia, y nada rompe
 * la CSP ni axe (críticas/serias) en inglés y español a 375/768/1280.
 */
const GUIDE_SECTION_IDS = [
  'resumen',
  'prioridades',
  'habilidades',
  'orden',
  'notas',
  'filtro-de-botin',
  'guia-espiritual',
  'devociones',
  'video',
  'fuentes',
] as const;
const STEP_LOCALES = [
  { prefix: '', cleared: /cleared/i, announced: /Step 1/ },
  { prefix: '/es', cleared: /quitado/i, announced: /Paso 1/ },
] as const;
const axeCore = readFileSync(
  createRequire(join(process.cwd(), 'package.json')).resolve('axe-core/axe.min.js'),
  'utf8',
);

test.describe('@journeys guía sin JavaScript: resumen e índice', () => {
  test.use({ javaScriptEnabled: false });
  for (const locale of STEP_LOCALES)
    test(`${locale.prefix || '/'}: el HTML trae el resumen y enlaza el 100 % de las secciones`, async ({
      page,
    }) => {
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      await settleWithoutScripts(page);
      const summary = page.locator('[data-build-summary]');
      await expect(summary).toHaveCount(1);
      await expect(summary.locator('[data-summary-mastery]')).toHaveCount(2);
      for (const sel of [
        '[data-game-version]',
        '[data-published]',
        '[data-summary-author]',
        '[data-summary-source]',
      ])
        await expect(summary.locator(sel)).toHaveCount(1);
      // Summary before the first content block.
      const order = await page.evaluate(() => {
        const s = document.querySelector('[data-build-summary]')!;
        const p = document.getElementById('prioridades')!;
        return Boolean(s.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(order, 'el resumen va antes de prioridades').toBe(true);
      // Every section of the page has its link in the index and every link has its target.
      const report = await page.evaluate(
        (ids) => {
          const links = [...document.querySelectorAll<HTMLAnchorElement>('gd-build-toc nav a')];
          const linked = links.map((a) => (a.getAttribute('href') ?? '').split('#')[1]);
          const present = ids.filter((id) => document.getElementById(id));
          return {
            missingLinks: present.filter((id) => !linked.includes(id)),
            missingTargets: linked.filter((id) => !document.getElementById(id)),
            count: links.length,
          };
        },
        [...GUIDE_SECTION_IDS],
      );
      expect(report.count).toBeGreaterThanOrEqual(6);
      expect(report.missingLinks, 'secciones sin enlace en el índice').toEqual([]);
      expect(report.missingTargets, 'enlaces del índice sin destino').toEqual([]);
    });
});

test.describe('@journeys guía con JavaScript: sección actual, paso a paso, CSP y axe', () => {
  for (const locale of STEP_LOCALES)
    test(`${locale.prefix || '/'}: la sección actual cambia al desplazarse`, async ({ page }) => {
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      const current = page.locator('gd-build-toc nav a[aria-current="location"]');
      for (const id of ['prioridades', 'orden', 'fuentes']) {
        await page.evaluate((target) => document.getElementById(target)!.scrollIntoView(), id);
        await expect(current, `sección actual tras ir a #${id}`).toHaveAttribute(
          'data-section',
          id,
        );
        await expect(current.locator('[data-toc-current]')).toHaveCount(1);
      }
    });

  for (const locale of STEP_LOCALES)
    test(`${locale.prefix || '/'}: el paso a paso resalta el árbol, se anuncia y se opera con teclado`, async ({
      page,
    }) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (
          message.type() === 'error' ||
          /content security policy|refused to/i.test(message.text())
        )
          problems.push(`${message.type()}: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()}`));

      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      await page.locator('#habilidades').scrollIntoViewIfNeeded();
      await expect(page.locator(SKILL_TREES)).toHaveCount(2);
      await expect(page.locator('[data-active-step]')).toHaveCount(0);

      const first = page.locator('[data-select-step]').first();
      await first.scrollIntoViewIfNeeded();
      await first.focus();
      await page.keyboard.press('Enter');
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      const region = page.locator('[data-step-announcement]');
      await expect(region).toHaveText(locale.announced);
      await expect(region).toHaveAttribute('aria-live', 'polite');
      expect(await page.locator('[data-active-step]').count()).toBeGreaterThan(0);

      await page.evaluate(axeCore);
      const violations = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (
                c: Document,
              ) => Promise<{ violations: { id: string; impact: string | null }[] }>;
            };
          }
        ).axe;
        return (await axe.run(document)).violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        );
      });
      expect(violations, 'axe con el paso a paso activo').toEqual([]);

      await first.focus();
      await page.keyboard.press('Space');
      await expect(first).toHaveAttribute('aria-pressed', 'false');
      await expect(region).toHaveText(locale.cleared);
      await expect(page.locator('[data-active-step]')).toHaveCount(0);
      expect(problems, 'sin errores de consola, CSP ni peticiones fallidas').toEqual([]);
    });
});

/**
 * T017 (spec 003, US3): la guía dibuja el árbol canónico de cada maestría y marca encima los 14
 * nodos de la guía. Los árboles son estáticos propios (`/assets/mastery-trees/`), pedidos al llegar
 * a la sección; sin JavaScript se lee el texto de los 14 nodos, y si los estáticos fallan la guía
 * vuelve al modo guía (FR-015, SC-007).
 */
const GUIDE_LOCALES = [
  { prefix: '', assigned: 'Assigned', link: /full skill tree of each mastery/i },
  {
    prefix: '/es',
    skills: 'Habilidades',
    assigned: 'Asignada',
    link: /árbol de habilidades completo/i,
  },
] as const;
const SKILL_TREES = '#habilidades gd-skill-tree';

for (const locale of GUIDE_LOCALES) {
  test.describe(`@journeys guía sobre el árbol canónico (${locale.prefix || '/'})`, () => {
    test('dos árboles completos con los 14 nodos de la guía marcados y sin desbordar la página', async ({
      page,
    }) => {
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('requestfailed', (request) => failures.push(request.url()));
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      await page.locator('#habilidades').scrollIntoViewIfNeeded();
      await expect(page.locator(SKILL_TREES)).toHaveCount(2);
      await expect(page.locator(`${SKILL_TREES} [data-skill-id]`)).toHaveCount(30 + 33);
      await expect(
        page.locator(`${SKILL_TREES} [data-skill-id][data-assigned="true"]`),
      ).toHaveCount(14);
      await expect(
        page.locator(`${SKILL_TREES}:nth-of-type(1) [data-skill-id][data-assigned="true"]`),
      ).toHaveCount(9);
      await expect(page.locator('[data-assignment-legend]').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'la página no debe desbordar horizontalmente').toBeLessThanOrEqual(0);
      expect(failures, 'sin errores ni peticiones fallidas').toEqual([]);

      const first = page.locator(`${SKILL_TREES} [data-skill-id][data-assigned="true"]`).first();
      await first.scrollIntoViewIfNeeded();
      await first.focus();
      const panel = page.locator('#habilidades [role="tooltip"]').first();
      await expect(panel).toContainText(locale.assigned);
      await expect(first).toHaveAttribute('aria-label', new RegExp(locale.assigned));
    });

    test('si los estáticos fallan, la guía conserva sus 14 nodos en el modo guía', async ({
      page,
    }) => {
      await page.route('**/assets/mastery-trees/**', (route) => route.abort());
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      await page.locator('#habilidades').scrollIntoViewIfNeeded();
      await expect(page.locator(SKILL_TREES)).toHaveCount(2);
      await expect(page.locator(`${SKILL_TREES} [data-skill-id]`)).toHaveCount(14);
      await expect(page.locator('[data-assigned]')).toHaveCount(0);
    });
  });
}

test.describe('@journeys guía sin JavaScript: texto de las habilidades y enlace al catálogo', () => {
  test.use({ javaScriptEnabled: false });

  for (const locale of GUIDE_LOCALES) {
    test(`${locale.prefix || '/'}: 14 nodos en el HTML y enlace a /maestrias`, async ({ page }) => {
      const response = await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      expect(response.status()).toBe(200);
      await expect(page.locator('#habilidades [data-fallback-node]')).toHaveCount(14);
      const link = page.locator('#habilidades a[data-masteries-link]');
      await expect(link).toHaveText(locale.link);
      await expect(link).toHaveAttribute('href', `${locale.prefix}/maestrias`);
    });
  }
});

/**
 * T033 (spec 003): la CSP del artefacto (`style-src 'self'` más hashes, sin `unsafe-inline`) no puede
 * bloquear los estilos de los componentes diferidos (`@defer`), que se crean en el cliente. Se recorren
 * las rutas públicas en EN y ES con la CSP real (sin `bypassCSP`) y se exige cero violaciones; en la guía
 * se llega a las secciones diferidas y el árbol debe tener estilo aplicado, no el valor por defecto.
 */
const CSP_ROUTES = [
  '/',
  '/tier-list',
  '/acerca',
  '/legal',
  '/autores/grim-dawn-builds',
  '/maestrias',
  '/maestrias/demolition',
  '/maestrias/soldier',
  GUIDE_PATH,
  '/builds/guia-inexistente',
] as const;

for (const prefix of ['', '/es']) {
  test.describe(`@journeys CSP sin violaciones de estilos (${prefix || '/'})`, () => {
    for (const route of CSP_ROUTES) {
      test(`${prefix}${route}`, async ({ page }) => {
        const violations: string[] = [];
        page.on('console', (message) => {
          if (/content security policy/i.test(message.text())) violations.push(message.text());
        });
        await page.addInitScript(() => {
          const sink: string[] = ((window as unknown as { __csp?: string[] }).__csp = []);
          document.addEventListener('securitypolicyviolation', (event) =>
            sink.push(`${event.violatedDirective} ${event.blockedURI}`),
          );
        });
        await open(page, `${PUBLIC_BASE_URL}${prefix}${route}`);
        if (route === GUIDE_PATH) {
          await page.locator('#habilidades').scrollIntoViewIfNeeded();
          await expect(
            page.locator('#habilidades [data-skill-id][data-assigned="true"]'),
          ).toHaveCount(14);
          await page.locator('#devociones').scrollIntoViewIfNeeded();
          await settle(page);
          const style = await page.evaluate(() => {
            const tree = document.querySelector('#habilidades .skill-tree') as Element;
            const shape = document.querySelector(
              '#habilidades [data-assigned="true"] .skill-tree__shape',
            ) as Element;
            return {
              border: Number.parseFloat(getComputedStyle(tree).borderTopWidth),
              background: getComputedStyle(tree).backgroundImage,
              fill: getComputedStyle(shape).fill,
              stroke: getComputedStyle(shape).strokeWidth,
            };
          });
          expect(style.border, 'el panel del árbol tiene borde (estilo aplicado)').toBeGreaterThan(
            0,
          );
          expect(style.fill, 'el nodo no usa el relleno negro por defecto').not.toBe(
            'rgb(0, 0, 0)',
          );
          expect(Number.parseFloat(style.stroke)).toBeGreaterThan(1);
        }
        await settle(page);
        const reported = await page.evaluate(
          () => (window as unknown as { __csp?: string[] }).__csp ?? [],
        );
        expect([...violations, ...reported], 'violaciones de CSP').toEqual([]);
      });
    }
  });
}

/**
 * spec004 T018 (SC-001, constitución I): de la portada a una build y a cualquier combinación en pocos
 * clics, y las combinaciones sin guía nunca se presentan como recomendación. EN y ES, con el artefacto
 * público; los clics se cuentan con un envoltorio, no se estiman.
 */
const T018_LOCALES = [
  {
    prefix: '',
    heading: /Grim Dawn guides/i,
    catalogLink: 'Browse the catalog',
    summary: /Combinations still without a guide/,
    noGuide: 'No guide',
  },
  {
    prefix: '/es',
    heading: /Guías de Grim Dawn/i,
    catalogLink: 'Explorar el catálogo',
    summary: /Combinaciones aún sin guía/,
    noGuide: 'Sin guía',
  },
] as const;

/** Un clic contado: toda navegación del recorrido pasa por aquí. */
function counted() {
  const clicks: string[] = [];
  return {
    clicks,
    async click(locator: Locator, label: string) {
      clicks.push(label);
      await locator.click();
    },
  };
}

/** Recuento de tarjetas del catálogo por variante. */
async function cardCounts(page: Page) {
  return {
    featured: await page.locator('gd-build-card [data-variant="featured"]').count(),
    standard: await page.locator('gd-build-card [data-variant="standard"]').count(),
    compact: await page.locator('gd-build-card [data-variant="compact"]').count(),
  };
}

/** Despliega la sección «sin guía» si está plegada; cuenta el clic. */
async function unfold(page: Page, steps: ReturnType<typeof counted>): Promise<void> {
  const folded = page.locator('details.unguided');
  if (!(await folded.count())) return;
  if (!(await folded.evaluate((el) => (el as HTMLDetailsElement).open)))
    await steps.click(folded.locator('summary'), 'desplegar sin guía');
}

for (const locale of T018_LOCALES) {
  test.describe(`@journeys T018 recorrido de la portada (${locale.prefix || '/'})`, () => {
    test('portada → guía publicada en ≤ 2 clics con la tarjeta destacada', async ({ page }) => {
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/`);
      await expectSingleHeading(page, locale.heading, 'portada');
      const steps = counted();
      const featured = page.locator('gd-build-card [data-variant="featured"] a');
      await expect(featured, 'la portada destaca una única guía').toHaveCount(1);
      await steps.click(featured, 'tarjeta destacada');
      await page.waitForURL(new RegExp(`${locale.prefix}${GUIDE_PATH}$`));
      expect(steps.clicks.length, 'clics de portada a guía').toBeLessThanOrEqual(2);
      await expect(page.locator('h1')).toHaveText(GUIDE_TITLE);
    });

    test('portada → cualquier combinación en ≤ 3 clics (catálogo y accesos por maestría)', async ({
      page,
    }) => {
      // Combinaciones reales del catálogo, leídas del propio HTML (no escritas a mano).
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/tier-list`);
      // textContent, not innerText: the hidden text of the link adds a line break to innerText.
      const titles = (await page.locator('gd-build-card h3').allTextContents()).map((t) =>
        t.trim(),
      );
      expect(titles.length, 'el catálogo lista combinaciones').toBeGreaterThan(10);
      const sample = [titles[0]!, titles[Math.floor(titles.length / 2)]!, titles.at(-1)!];

      for (const title of sample) {
        await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/`);
        const steps = counted();
        await steps.click(
          page.getByRole('link', { name: locale.catalogLink, exact: true }),
          'catálogo',
        );
        await page.waitForURL(/\/tier-list$/);
        await unfold(page, steps);
        const card = page.locator('gd-build-card h3', { hasText: title }).first();
        await expect(card, `«${title}» visible`).toBeVisible();
        expect(steps.clicks.length, `clics hasta «${title}»`).toBeLessThanOrEqual(3);
      }

      // Por maestría: un clic en el acceso ya filtra el catálogo.
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/`);
      const steps = counted();
      const access = page.locator('.masteries__list a').first();
      const masteryName = (await access.innerText()).trim();
      await steps.click(access, 'acceso por maestría');
      await page.waitForURL(/\/tier-list\?m=/);
      await unfold(page, steps);
      const shown = await page.locator('gd-build-card h3:visible').allInnerTexts();
      expect(shown.length, 'hay combinaciones con esa maestría').toBeGreaterThan(0);
      for (const text of shown) expect(text).toContain(masteryName);
      expect(steps.clicks.length).toBeLessThanOrEqual(3);
    });

    test('las combinaciones sin guía no se presentan como recomendación (con y sin JavaScript)', async ({
      browser,
    }) => {
      for (const javaScriptEnabled of [true, false]) {
        const context = await browser.newContext({ javaScriptEnabled });
        const page = await context.newPage();
        await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/tier-list`);
        const compact = page.locator('gd-build-card [data-variant="compact"]');
        const n = await compact.count();
        expect(n, `con JS=${javaScriptEnabled}: combinaciones sin guía en el HTML`).toBeGreaterThan(
          0,
        );
        for (let i = 0; i < n; i++) {
          const card = compact.nth(i);
          await expect(card.locator('a'), 'una combinación sin guía no es un enlace').toHaveCount(
            0,
          );
          // textContent: the cards live in a folded <details>, where innerText is empty.
          const text = ((await card.textContent()) ?? '').trim();
          expect(text).toContain(locale.noGuide);
          expect(text, 'sin tier ni sello de recomendación').not.toMatch(
            /tier\b|unranked|sin clasificar|recommended|recomendad/i,
          );
        }
        // Una ranura por combinación (AC-04): ninguna tarjeta se pierde ni se duplica.
        const counts = await cardCounts(page);
        expect(counts.compact + counts.standard + counts.featured).toBe(
          await page.locator('gd-build-card').count(),
        );
        const folded = page.locator('details.unguided');
        expect(
          await folded.evaluate((el) => (el as HTMLDetailsElement).open),
          'plegada por defecto',
        ).toBe(false);
        await expect(folded.locator('summary')).toContainText(locale.summary);
        await context.close();
      }
    });

    test('la portada no lista combinaciones sin guía como builds', async ({ page }) => {
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/`);
      await expect(page.locator('gd-build-card [data-variant="compact"]')).toHaveCount(0);
      for (const card of await page.locator('gd-build-card').all())
        await expect(card.locator('a')).toHaveCount(1);
    });
  });
}

test.describe('@journeys T018 paridad EN/ES de portada y catálogo', () => {
  test('mismas tarjetas, accesos y recuentos en los dos idiomas', async ({ page }) => {
    const seen = [] as {
      cards: Awaited<ReturnType<typeof cardCounts>>;
      accesses: number;
      total: number;
      homeCards: number;
    }[];
    for (const locale of T018_LOCALES) {
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/tier-list`);
      const cards = await cardCounts(page);
      const text = (await page.locator('.result-count').innerText()).trim();
      const total = Number(/(\d+)\s+(?:entries|entradas)/.exec(text)?.[1]);
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/`);
      seen.push({
        cards,
        total,
        accesses: await page.locator('.masteries__list a').count(),
        homeCards: await page.locator('gd-build-card').count(),
      });
    }
    expect(seen[1], 'ES = EN').toEqual(seen[0]);
    const en = seen[0]!;
    expect(en.total).toBe(en.cards.featured + en.cards.standard + en.cards.compact);
  });
});

/**
 * spec004 T042 (defectos a, b y d de la revisión de Paco): retrato de maestría en las tarjetas,
 * versión «Sin confirmar» en el idioma de la interfaz y título de la lista del catálogo.
 */
for (const locale of [
  {
    prefix: '',
    version: 'Version unconfirmed',
    list: 'Skill list',
    guideList: /and recommendations/,
  },
  {
    prefix: '/es',
    version: 'Versión sin confirmar',
    list: 'Lista de habilidades',
    guideList: /y recomendaciones/,
  },
] as const) {
  test.describe(`@journeys T042 tarjetas y lista (${locale.prefix || '/'})`, () => {
    test('la tarjeta de la portada dibuja el retrato de cada maestría y la versión en su idioma', async ({
      page,
    }) => {
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/`);
      const card = page.locator('gd-build-card [data-variant="featured"]');
      const sources = await card
        .locator('img')
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')));
      expect(sources, 'retrato propio de Chamán y de Demoledor, no el genérico').toEqual([
        'assets/icons/mastery-chaman.svg',
        'assets/icons/mastery-demoledor.svg',
      ]);
      const text = (await card.textContent()) ?? '';
      expect(text).toContain(locale.version);
      expect(text, 'el valor del contenido no se muestra tal cual').not.toMatch(
        locale.prefix ? /Version unconfirmed/ : /Sin confirmar/,
      );
    });

    test('el catálogo no promete recomendaciones y la guía las conserva', async ({ page }) => {
      await open(page, `${PUBLIC_BASE_URL}${locale.prefix}/maestrias/shaman`);
      await expect(page.locator('details.skill-tree__list > summary')).toHaveText(locale.list);
      await open(page, `${DRAFTS_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      // The trees are deferred until they reach the viewport.
      await page.locator('#habilidades').scrollIntoViewIfNeeded();
      await expect(page.locator('details.skill-tree__list > summary').first()).toHaveText(
        locale.guideList,
      );
    });
  });
}

/** spec004 T042, ronda 2: versión sin confirmar en el resumen de la guía y títulos que no parten palabras. */
for (const locale of [
  { prefix: '', version: 'Version unconfirmed' },
  { prefix: '/es', version: 'Versión sin confirmar' },
] as const) {
  test.describe(`@journeys T042 ronda 2 (${locale.prefix || '/'})`, () => {
    test('el resumen de la guía muestra la versión sin confirmar en el idioma de la interfaz', async ({
      page,
    }) => {
      await open(page, `${DRAFTS_BASE_URL}${locale.prefix}${GUIDE_PATH}`);
      await expect(page.locator('[data-game-version]')).toHaveText(locale.version);
    });

    for (const width of [320, 375]) {
      test(`ningún título de tarjeta parte una palabra a ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ['/', '/tier-list']) {
          await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${path}`);
          const broken = await page.evaluate(() => {
            const bad: string[] = [];
            for (const link of document.querySelectorAll('.build-card__title')) {
              const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
                  const range = document.createRange();
                  range.setStart(node, match.index!);
                  range.setEnd(node, match.index! + match[0].length);
                  const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
                  if (lines.size > 1) bad.push(match[0]);
                }
              }
              const box = link as HTMLElement;
              if (box.scrollWidth > box.clientWidth + 1) bad.push(`overflow: ${box.textContent}`);
            }
            return bad;
          });
          expect(broken, `${path} a ${width} px`).toEqual([]);
        }
      });
    }
  });
}

/**
 * spec004 T044 (defecto e de T032): a 320-375 px la cabecera ocupa una sola fila, sin JS, en EN y
 * ES, y el menú plegable conserva todos los enlaces accesibles (objetivos ≥ 44 px, `aria-current`).
 */
const HEADER_ROUTES = ['/', '/tier-list', '/maestrias', '/acerca', GUIDE_PATH] as const;
const HEADER_LOCALES = [
  { prefix: '', menu: /^Menu$/, home: 'Home' },
  { prefix: '/es', menu: /^Menú$/, home: 'Inicio' },
] as const;
const ONE_ROW_MAX_PX = 88;

test.describe('@journeys cabecera de una fila (T044)', () => {
  test.use({ javaScriptEnabled: false });
  for (const width of [320, 375])
    for (const locale of HEADER_LOCALES)
      for (const route of HEADER_ROUTES)
        test(`${width}px ${locale.prefix || '/'}${route}: la cabecera mide una fila`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          await open(page, `${PUBLIC_BASE_URL}${locale.prefix}${route === '/' ? '' : route}`);
          const box = await page.locator('.site-header').boundingBox();
          expect(box?.height ?? 999, 'altura de la cabecera').toBeLessThanOrEqual(ONE_ROW_MAX_PX);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            'sin desbordamiento horizontal',
          ).toBe(true);
        });

  test('375px: el menú se abre con teclado sin JS y sus enlaces miden ≥ 44 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await open(page, `${PUBLIC_BASE_URL}/tier-list`);
    const summary = page.locator('.site-header summary');
    await expect(summary).toHaveText(/^Menu$/);
    await expect(page.locator('.site-header nav a:visible')).toHaveCount(0);
    await summary.focus();
    await page.keyboard.press('Enter');
    const links = page.locator('.site-header nav a:visible');
    await expect(links).toHaveCount(5);
    for (const link of await links.all())
      expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.site-header nav a[aria-current="page"]')).toHaveText('Catalog');
    expect((await page.locator('.site-header').boundingBox())?.height ?? 999).toBeLessThanOrEqual(
      ONE_ROW_MAX_PX,
    );
  });

  test('1280px: los enlaces se ven sin menú', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, `${PUBLIC_BASE_URL}/`);
    await expect(page.locator('.site-header summary')).toBeHidden();
    await expect(page.locator('.site-header nav a:visible')).toHaveCount(5);
  });
});
