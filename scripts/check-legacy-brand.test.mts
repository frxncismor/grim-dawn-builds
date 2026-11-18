import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { assertNoLegacyBrand, hasLegacyBrand } from './check-legacy-brand.mts';

/** Synthetic artifact built by the test itself: it never reads the real `dist/` (T034). */
async function artifact(pages: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gd-brand-'));
  for (const [name, html] of Object.entries(pages)) {
    const file = join(root, name);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, html);
  }
  return root;
}
const pages = (extra: Record<string, string> = {}): Record<string, string> => ({
  'index.html': '<title>Grim Builds</title>',
  'en/index.html': '<h1>Grim Builds</h1> Grim Dawn builds',
  'es/index.html': '<h1>Grim Builds</h1>',
  'en/builds/index.html': '<p>Grim Dawn</p>',
  'es/builds/index.html': '<p>Grim Dawn</p>',
  'en/about/index.html': '<p>About</p>',
  ...extra,
});
const using = async (files: Record<string, string>, check: (dir: string) => Promise<void>) => {
  const dir = await artifact(files);
  try {
    await check(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

describe('post-build brand gate (T034, FR-027)', () => {
  it('detects the old brand, also split by markup', () => {
    assert.equal(hasLegacyBrand('Grim Dawn <span>Builds</span>'), true);
    assert.equal(hasLegacyBrand('Grim Builds'), false);
  });

  it('passes on a clean artifact and counts its pages', () =>
    using(pages(), async (dir) => {
      assert.deepEqual(await assertNoLegacyBrand(dir), { pages: 6 });
    }));

  it('fails, naming the page, when one still carries the old brand', () =>
    using(pages({ 'en/old/index.html': '<h1>Grim Dawn <b>Builds</b></h1>' }), (dir) =>
      assert.rejects(assertNoLegacyBrand(dir), /marca antigua.*en.old.index\.html/),
    ));

  it('fails (never skips) when the artifact is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gd-brand-'));
    await rm(dir, { recursive: true, force: true });
    await assert.rejects(
      assertNoLegacyBrand(dir),
      /puerta de marca antigua.*pnpm build.*sin carpeta browser/,
    );
  });

  it('fails when the artifact is empty or has 5 pages or fewer', async () => {
    await using({}, (dir) => assert.rejects(assertNoLegacyBrand(dir), /ninguna página \.html/));
    await using(
      { 'index.html': 'x', 'a.html': 'x', 'b.html': 'x', 'c.html': 'x', 'd.html': 'x' },
      (dir) => assert.rejects(assertNoLegacyBrand(dir), /5 páginas \.html.*al menos 6/),
    );
  });
});

describe('detector parity with apps/web/src/brand.test.mts (T034)', () => {
  // `check:boundaries` forbids web → scripts imports, so both files carry the rule; this keeps them equal.
  it('uses the same pattern and markup stripping', async () => {
    const web = await readFile(
      join(import.meta.dirname, '..', 'apps', 'web', 'src', 'brand.test.mts'),
      'utf8',
    );
    const mine = await readFile(join(import.meta.dirname, 'check-legacy-brand.mts'), 'utf8');
    const rule = (raw: string) => {
      const text = raw.replace(/\r\n/g, '\n');
      return {
        pattern: /const OLD_BRAND = (\/.*\/);/.exec(text)?.[1],
        body: /export function visibleText[\s\S]*?\n}\n/.exec(text)?.[0],
        check: /export function hasLegacyBrand[\s\S]*?\n}\n/.exec(text)?.[0],
      };
    };
    assert.ok(rule(web).pattern && rule(web).body && rule(web).check);
    assert.deepEqual(rule(mine), rule(web));
  });
});
