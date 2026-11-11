import { test, expect, type Page, type TestInfo } from '@playwright/test';
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
const surfaces = [
  {
    name: 'habilidades',
    origin: 'http://127.0.0.1:4310',
    component: 'gd-skill-tree',
    nodes: 'svg [data-skill-id]',
    id: 'data-skill-id',
    target: '.skill-tree__shape',
    list: 'details.skill-tree__list',
    canvas: '.skill-tree__canvas',
    step: '[data-preview-step="later"]',
  },
  {
    name: 'devociones',
    origin: 'http://127.0.0.1:4311',
    component: 'gd-devotion-map',
    nodes: 'svg [data-constellation-id]',
    id: 'data-constellation-id',
    target: '[data-group-target]',
    list: 'details.devotion-map__list',
    canvas: '.devotion-map__canvas',
    step: '[data-preview-step="unbound"]',
  },
] as const;
type Surface = (typeof surfaces)[number];

async function open(page: Page, surface: Surface) {
  await page.goto(surface.origin + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const component = page.locator(surface.component).first();
  await expect(component.locator(surface.nodes).first()).toBeVisible();
  return component;
}

async function geometry(page: Page, surface: Surface) {
  const component = page.locator(surface.component).first();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const targets = await component
    .locator(surface.nodes)
    .locator(surface.target)
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
  for (const target of targets) {
    expect(target.width).toBeGreaterThanOrEqual(24);
    expect(target.height).toBeGreaterThanOrEqual(24);
  }
  const fonts = await component.locator('svg text').evaluateAll((nodes) =>
    nodes
      .filter((n) => n.textContent?.trim())
      .map((node) => {
        const svg = node as SVGTextElement,
          matrix = svg.getScreenCTM()!;
        return (
          parseFloat(getComputedStyle(node).fontSize) *
          Math.min(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d))
        );
      }),
  );
  expect(Math.min(...fonts)).toBeGreaterThanOrEqual(11.99);
  if (surface.name === 'devociones') {
    const bounded = await component.locator('.devotion-map__constellation').evaluateAll((groups) =>
      groups.every((group) => {
        const frame = group.querySelector('[data-group-target]')!.getBoundingClientRect();
        return [...group.querySelectorAll('text')].every((node) => {
          const box = node.getBoundingClientRect();
          return box.left >= frame.left - 0.5 && box.right <= frame.right + 0.5;
        });
      }),
    );
    expect(bounded).toBe(true);
  }
}

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      })
    ).violations.map((result) => ({
      id: result.id,
      impact: result.impact,
      targets: result.nodes.map((node) => node.target),
    })),
  );
  expect(violations).toEqual([]);
}

async function focused(page: Page, attribute: string) {
  return page.evaluate((name) => document.activeElement?.getAttribute(name) ?? null, attribute);
}

for (const surface of surfaces) {
  test(`${surface.name}: teclado, foco, paso independiente, axe y captura`, async ({
    page,
  }, info) => {
    const errors: string[] = [],
      requests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', (request) => requests.push(request.url()));
    const component = await open(page, surface),
      nodes = component.locator(surface.nodes);
    await geometry(page, surface);
    const ids = await nodes.evaluateAll(
      (elements, attribute) => elements.map((node) => node.getAttribute(attribute)),
      surface.id,
    );
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.every(Boolean)).toBe(true);
    await expect(component.locator(surface.nodes + '[tabindex="0"]')).toHaveCount(1);
    await nodes.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => focused(page, surface.id)).toBe(ids[1]);
    await page.keyboard.press('Enter');
    await expect(nodes.nth(1)).toHaveAttribute('aria-pressed', 'true');
    const before = await nodes.evaluateAll((elements) =>
      elements.filter((node) => node.hasAttribute('data-active-step')).map((node) => node.id),
    );
    await page.locator(surface.step).click();
    await expect
      .poll(() =>
        nodes.evaluateAll((elements) =>
          elements.filter((node) => node.hasAttribute('data-active-step')).map((node) => node.id),
        ),
      )
      .not.toEqual(before);
    await expect(nodes.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await component.locator('[data-close-detail]').focus();
    await page.keyboard.press('Escape');
    await expect(component.locator(surface.nodes + '[aria-pressed="true"]')).toHaveCount(0);
    await expect.poll(() => focused(page, surface.id)).toBe(ids[1]);
    await page.keyboard.press('Home');
    await expect.poll(() => focused(page, surface.id)).toBe(ids[0]);
    await page.keyboard.press('End');
    await expect.poll(() => focused(page, surface.id)).toBe(ids.at(-1));
    await page.keyboard.press('Space');
    await expect(nodes.last()).toHaveAttribute('aria-pressed', 'true');
    await component.locator('[data-close-detail]').click();
    await expect.poll(() => focused(page, surface.id)).toBe(ids.at(-1));
    await nodes
      .first()
      .locator(surface.target)
      .hover({ position: { x: 8, y: 8 } });
    await expect.poll(() => focused(page, surface.id)).toBe(ids.at(-1));
    await nodes.first().focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    const feedback = await nodes
      .first()
      .locator(surface.target)
      .evaluate((node) => ({
        width: parseFloat(getComputedStyle(node).strokeWidth),
        duration: getComputedStyle(node).transitionDuration,
      }));
    expect(feedback.width).toBeGreaterThanOrEqual(2);
    expect(feedback.duration).toBe('0s');
    const allIds = await page
      .locator('[id]')
      .evaluateAll((elements) => elements.map((node) => node.id));
    expect(new Set(allIds).size).toBe(allIds.length);
    await axe(page);
    expect(errors).toEqual([]);
    expect(requests.every((url) => url.startsWith(surface.origin + '/'))).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await info.attach(`${surface.name}-${info.project.name}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test(`${surface.name}: HTML y lista nativa sin JavaScript`, async ({
    browser,
  }, info: TestInfo) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: info.project.use.viewport ?? { width: 1280, height: 900 },
    });
    try {
      const page = await context.newPage(),
        component = await open(page, surface);
      await geometry(page, surface);
      const list = component.locator(surface.list);
      await expect(list).toHaveAttribute('open', '');
      await expect(list.locator('li').first()).toBeVisible();
      await list.locator('summary').click();
      await expect(list).not.toHaveAttribute('open', '');
      await list.locator('summary').click();
      await expect(list).toHaveAttribute('open', '');
    } finally {
      await context.close();
    }
  });

  test(`${surface.name}: axe sobre HTML con bootstrap bloqueado`, async ({ page }) => {
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    );
    await open(page, surface);
    await axe(page);
  });

  test(`${surface.name}: toque y desplazamiento interno`, async ({ page, context }) => {
    const component = await open(page, surface);
    await component
      .locator(surface.nodes)
      .first()
      .locator(surface.target)
      .tap({ position: { x: 8, y: 8 } });
    await expect(component.locator(surface.nodes).first()).toHaveAttribute('aria-pressed', 'true');
    const canvas = component.locator(surface.canvas);
    await canvas.scrollIntoViewIfNeeded();
    await canvas.evaluate((element) => {
      element.scrollLeft = 0;
    });
    const dimensions = await canvas.evaluate((element) => ({
      width: element.scrollWidth,
      visible: element.clientWidth,
    }));
    if (dimensions.width > dimensions.visible) {
      const box = (await canvas.boundingBox())!,
        session = await context.newCDPSession(page);
      const y = box.y + 20;
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 300, y }],
      });
      for (let x = 280; x >= 80; x -= 40) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y }],
        });
        await page.waitForTimeout(25);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => canvas.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
