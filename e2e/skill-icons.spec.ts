import { expect, test, type Page } from '@playwright/test';

/**
 * spec004 T028/T029 (US4, SC-009): the skill trees draw the game icons only when the artifact was
 * built with `ASSET_SOURCE=game`, and the own symbols otherwise. The expectations follow the
 * `ASSET_SOURCE` the runner passes (the same value the artifact was built with): `own` when unset.
 * Checks the six masteries in EN and ES and the guide (drafts artifact), with no console or CSP
 * error, a visible credit to Crate with the game art, and the number of requests and bytes of the
 * icons per tree (recorded as annotations; bounded so a regression is visible).
 */
const BASE_URL = (
  process.env['E2E_BASE_URL'] ??
  process.env['A11Y_BASE_URL'] ??
  'http://127.0.0.1:4321'
).replace(/\/+$/, '');
const DRAFTS_URL = (process.env['E2E_DRAFTS_BASE_URL'] ?? 'http://127.0.0.1:4322').replace(
  /\/+$/,
  '',
);
const MODE = process.env['ASSET_SOURCE'] === 'game' ? 'game' : 'own';
const MASTERIES = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'] as const;
const LOCALES = [
  { name: 'en', prefix: '' },
  { name: 'es', prefix: '/es' },
] as const;
const GUIDE = '/builds/chaman-demoledor-golpe-primigenio';
/** One tree has at most 33 nodes and 29 distinct icons today (measured, spec004 T029). */
const MAX_REQUESTS_PER_TREE = 33;
/** 29 icons of ~3.2 kB each; 150 kB leaves room without hiding a regression. */
const MAX_BYTES_PER_TREE = 150_000;
const ICON_URL = /\/assets\/skill-icons\/ic-[0-9a-f]{16}\.png$/;

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /content security policy|refused to/i.test(text))
      problems.push(`${message.type()}: ${text}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

/** Collects every request to a game icon with its status, type and body size. */
function watchIcons(page: Page) {
  const seen: { url: string; status: number; type: string; bytes: number }[] = [];
  const pending: Promise<void>[] = [];
  page.on('response', (response) => {
    if (!ICON_URL.test(response.url())) return;
    pending.push(
      response
        .body()
        .then((body) => {
          seen.push({
            url: response.url(),
            status: response.status(),
            type: response.headers()['content-type'] ?? '',
            bytes: body.length,
          });
        })
        .catch(() => {
          seen.push({ url: response.url(), status: response.status(), type: '', bytes: 0 });
        }),
    );
  });
  return { seen, settle: () => Promise.all(pending) };
}

async function revealTree(page: Page): Promise<void> {
  const nodes = page.locator('gd-skill-tree g[data-skill-id]');
  // The guide draws its trees in a deferred block: scroll until the first node exists.
  for (let step = 0; step < 60 && (await nodes.count()) === 0; step++) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(200);
  }
  await expect(nodes.first()).toBeAttached();
  await page.waitForLoadState('networkidle');
}

for (const { name, prefix } of LOCALES)
  for (const slug of MASTERIES)
    test(`@journeys iconos de habilidad (${MODE}) · ${slug} (${name})`, async ({ page }) => {
      const problems = watchConsole(page);
      const icons = watchIcons(page);
      await page.goto(`${BASE_URL}${prefix}/maestrias/${slug}`, { waitUntil: 'networkidle' });
      await revealTree(page);
      await icons.settle();
      const nodes = await page.locator('gd-skill-tree g[data-skill-id]').count();
      expect(nodes).toBeGreaterThan(5);
      const art = page.locator('gd-skill-tree image.skill-tree__icon-art');
      const symbols = page.locator('gd-skill-tree use.skill-tree__icon');
      const credit = page.locator('gd-skill-tree [data-game-art-credit]');
      if (MODE === 'game') {
        await expect(art).toHaveCount(nodes);
        await expect(symbols).toHaveCount(0);
        for (const image of await art.all()) {
          await expect(image).toHaveAttribute('width', '32');
          await expect(image).toHaveAttribute('height', '32');
          await expect(image).toHaveAttribute('aria-hidden', 'true');
          expect(await image.getAttribute('href')).toMatch(
            /^assets\/skill-icons\/ic-[0-9a-f]{16}\.png$/,
          );
        }
        await expect(credit).toBeVisible();
        await expect(credit).toContainText('Crate Entertainment');
        await expect(credit).toContainText(name === 'es' ? /no está afiliad/i : /not affiliated/i);
        const urls = new Set(icons.seen.map((item) => item.url));
        expect(
          icons.seen.every((item) => item.status === 200 && /image\/png/.test(item.type)),
        ).toBe(true);
        expect(urls.size, 'cada icono se pide una sola vez').toBe(icons.seen.length);
        const hrefs = new Set(
          await art.evaluateAll((all) => all.map((el) => el.getAttribute('href'))),
        );
        expect(urls.size).toBe(hrefs.size);
        const bytes = icons.seen.reduce((sum, item) => sum + item.bytes, 0);
        test.info().annotations.push({
          type: 'icon-weight',
          description: `${slug} ${name}: ${nodes} nodos, ${urls.size} peticiones, ${bytes} B`,
        });
        expect(urls.size).toBeLessThanOrEqual(MAX_REQUESTS_PER_TREE);
        expect(bytes).toBeLessThanOrEqual(MAX_BYTES_PER_TREE);
      } else {
        await expect(art).toHaveCount(0);
        await expect(symbols).toHaveCount(nodes);
        await expect(credit).toHaveCount(0);
        expect(icons.seen, 'con own no se pide ningún icono del juego').toEqual([]);
        // SC-009: the artifact does not even serve one (a missing file is the host's 404).
        const probe = await page.request.get(
          `${BASE_URL}/assets/skill-icons/ic-0000000000000000.png`,
        );
        expect(probe.status()).toBe(404);
      }
      expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
    });

for (const { name, prefix } of LOCALES)
  test(`@journeys iconos de habilidad (${MODE}) · guía con árboles (${name})`, async ({ page }) => {
    const problems = watchConsole(page);
    const icons = watchIcons(page);
    await page.goto(`${DRAFTS_URL}${prefix}${GUIDE}`, { waitUntil: 'networkidle' });
    await revealTree(page);
    await icons.settle();
    const nodes = await page.locator('gd-skill-tree g[data-skill-id]').count();
    expect(nodes).toBeGreaterThan(5);
    const art = page.locator('gd-skill-tree image.skill-tree__icon-art');
    const credits = page.locator('gd-skill-tree [data-game-art-credit]');
    if (MODE === 'game') {
      expect(await art.count()).toBeGreaterThan(0);
      expect(await credits.count()).toBeGreaterThan(0);
      await expect(credits.first()).toContainText('Crate Entertainment');
      expect(icons.seen.every((item) => item.status === 200)).toBe(true);
    } else {
      await expect(art).toHaveCount(0);
      await expect(credits).toHaveCount(0);
      expect(icons.seen).toEqual([]);
    }
    expect(problems, 'sin errores de consola ni violaciones de CSP').toEqual([]);
  });
