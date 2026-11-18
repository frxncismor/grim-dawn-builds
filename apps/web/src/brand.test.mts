import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * spec005 T015 (FR-023, FR-026, FR-027): the public brand is «Grim Builds». «Grim Dawn Builds» must
 * not come back as a brand in the code, templates, translation catalogs, metadata, the social image,
 * the product docs or the prerendered HTML, while «Grim Dawn» as the name of the game stays.
 */
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(WEB, '..', '..');
const TEXT = new Set(['.ts', '.mts', '.html', '.css', '.xlf', '.svg', '.md', '.json', '.txt']);
const OLD_BRAND = /Grim\s+Dawn\s+Builds/;

/** Text with markup removed, so «Grim Dawn <span>Builds</span>» or two SVG `<text>` lines are seen as one phrase. */
export function visibleText(source: string): string {
  return source
    .replace(/<x\b[^>]*\/>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

export function hasLegacyBrand(source: string): boolean {
  return OLD_BRAND.test(source) || OLD_BRAND.test(visibleText(source));
}

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.angular') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (TEXT.has(extname(path))) yield path;
  }
}

const SELF = fileURLToPath(import.meta.url);
const scanned = (): string[] => [
  ...walk(join(WEB, 'src')),
  ...walk(join(WEB, 'public')),
  ...readdirSync(WEB)
    .filter((n) => n.endsWith('.md'))
    .map((n) => join(WEB, n)),
];
const read = (path: string) => readFileSync(path, 'utf8');

describe('brand detector (FR-027)', () => {
  it('flags the old brand, also split by markup or lines', () => {
    for (const text of [
      'Grim Dawn Builds',
      'Grim Dawn <span>Builds</span>',
      '<text>Grim Dawn</text>\n<text>Builds</text>',
      'Grim Dawn <x id="START_TAG_SPAN" ctype="x-span" equiv-text="&lt;span&gt;"/>Builds',
    ])
      assert.equal(hasLegacyBrand(text), true, text);
  });

  it('does not flag Grim Dawn as the game or the new brand', () => {
    for (const text of [
      'Grim Builds',
      'Grim Dawn',
      'Not affiliated with Crate Entertainment or Grim Dawn.',
      'Browse Grim Dawn mastery combinations',
      'Grim Dawn builds are listed here',
      'grim-dawn-builds',
    ])
      assert.equal(hasLegacyBrand(text), false, text);
  });
});

describe('«Grim Dawn Builds» is not the brand any more (FR-023, FR-026)', () => {
  it('appears nowhere in apps/web/src, apps/web/public or apps/web/*.md', () => {
    const files = scanned().filter((f) => f !== SELF);
    assert.ok(files.length > 100, `scanned only ${files.length} files`);
    const offenders = files.filter((f) => hasLegacyBrand(read(f))).map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });
});

describe('«Grim Builds» is the brand, in both languages (FR-023, FR-024)', () => {
  const file = (p: string) => read(join(WEB, p));

  it('names the site in the title, SEO service, build page and structured data', () => {
    assert.match(file('src/index.html'), /<title>Grim Builds<\/title>/);
    assert.match(file('src/app/core/seo/seo.service.ts'), /SITE_NAME = 'Grim Builds'/);
    assert.match(file('src/app/features/build/build.page.ts'), /SITE_NAME = 'Grim Builds'/);
    const home = file('src/app/features/home/home.page.ts');
    assert.match(home, /title: 'Grim Builds'/);
    assert.match(home, /name: 'Grim Builds'/);
  });

  it('carries the brand in the social image source', () => {
    const svg = file('public/og/site.svg');
    assert.match(visibleText(svg), /Grim Builds/);
  });

  it('draws the brand in the header and replaces the footer text with the non-affiliation notice', () => {
    const layout = file('src/app/shared/ui/layout/site-layout.html');
    assert.match(visibleText(layout), /Grim Builds/);
    for (const [lang, rules] of [
      [
        'en',
        [/independent/i, /not affiliated with or endorsed by/i, /Crate Entertainment/, /Grim Dawn/],
      ],
      ['es', [/independiente/i, /ni respaldado por/i, /Crate Entertainment/, /Grim Dawn/]],
    ] as const) {
      const xlf = file(`src/locale/messages.${lang}.xlf`);
      const unit =
        /<trans-unit id="layout\.independent"[\s\S]*?<\/trans-unit>/.exec(xlf)?.[0] ?? '';
      assert.ok(unit, `${lang}: layout.independent is missing`);
      const text =
        lang === 'en'
          ? /<source>([\s\S]*?)<\/source>/.exec(unit)?.[1]
          : /<target[^>]*>([\s\S]*?)<\/target>/.exec(unit)?.[1];
      for (const rule of rules) assert.match(text ?? '', rule, `${lang}: ${rule}`);
    }
  });

  it('keeps the product docs free of the pending-brand marker (FR-025)', () => {
    for (const doc of ['PRODUCT.md', 'DESIGN.md']) {
      const text = file(doc);
      assert.match(text, /Grim Builds/, doc);
      assert.doesNotMatch(text, /nombre p[úu]blico de la marca/i, doc);
    }
  });

  it('does not publish an app manifest (FR-029)', () => {
    assert.equal(existsSync(join(WEB, 'public', 'manifest.webmanifest')), false);
    assert.equal(existsSync(join(WEB, 'public', 'manifest.json')), false);
  });
});
