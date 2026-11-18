import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  assertAssetStatusParity,
  assertGameAssets,
  assertNoGamePortraits,
  assertPortraitCredit,
  assertSkillIconCredit,
  checkAssets,
} from './check-assets.mts';

const PNG = Buffer.from('not-really-a-png');
const SHA = createHash('sha256').update(PNG).digest('hex');
const FILE = 'public/assets/portraits/soldier.png';

const entry = (over: Record<string, unknown> = {}) => ({
  slug: 'soldier',
  status: 'approved',
  file_path: FILE,
  origin_url: 'https://store.steampowered.com/app/219990/Grim_Dawn/',
  rights_holder: 'Crate Entertainment',
  license_or_permission: 'tolerancia_de_facto_sin_permiso',
  proof_ref: 'specs/003-catalogo-arboles-maestria/research.md#t029',
  recorded_on: '2026-11-13',
  fallback_svg: 'src/assets/icons/mastery-soldado.svg',
  provenance: {
    game_version: 'steam-build-1',
    source_path: 'ui/x.tex',
    sha256: SHA,
    width: 197,
    height: 41,
  },
  ...over,
});

function repo(manifest: unknown, withFile = true): string {
  const root = mkdtempSync(join(tmpdir(), 'gd-assets-'));
  const put = (path: string, data: string | Buffer) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), data);
  };
  put('fixtures/content/assets/manifest.json', JSON.stringify(manifest));
  if (withFile) put(`apps/web/${FILE}`, PNG);
  return root;
}

function check(manifest: unknown, withFile = true) {
  const root = repo(manifest, withFile);
  try {
    return checkAssets(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a valid portrait entry with a matching file passes', () => {
  assert.deepEqual(check({ assets: [entry()] }), { count: 1, issues: [] });
});

test('a file that differs from the recorded sha256 fails', () => {
  const bad = entry({ provenance: { ...entry().provenance, sha256: 'a'.repeat(64) } });
  assert.match(check({ assets: [bad] }).issues[0]?.message ?? '', /sha256/);
});

test('an approved entry without its file fails', () => {
  assert.equal(check({ assets: [entry()] }, false).issues.length, 1);
});

test('a portrait file with no manifest entry fails', () => {
  assert.equal(check({ assets: [] }).issues.length, 1);
});

test('an approved entry missing provenance fields fails', () => {
  assert.ok(check({ assets: [entry({ license_or_permission: null })] }).issues.length > 0);
});

test('an unreadable or malformed manifest fails', () => {
  assert.equal(check('nope').issues.length, 1);
  assert.equal(check({ assets: 'x' }).issues.length, 1);
});

test('a withdrawn entry with its file deleted passes; keeping the file fails', () => {
  const withdrawn = entry({ status: 'withdrawn', file_path: null });
  assert.deepEqual(check({ assets: [withdrawn] }, false).issues, []);
  assert.ok(check({ assets: [withdrawn] }, true).issues.length > 0);
});

// T005 (A-03): one source of truth for an asset's status — the repository manifest rules.
test('assertAssetStatusParity: passes when the table and the manifest agree on what is public', () => {
  const root = repo({
    assets: [
      entry({ slug: 'mastery-soldier' }),
      entry({ slug: 'mastery-oathkeeper', status: 'withdrawn' }),
    ],
  });
  try {
    assert.doesNotThrow(() => assertAssetStatusParity(root, [{ slug: 'mastery-soldier' }]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertAssetStatusParity: fails closed naming the asset and both states when they disagree', () => {
  const root = repo({
    assets: [
      entry({ slug: 'mastery-soldier', status: 'withdrawn' }),
      entry({ slug: 'mastery-shaman' }),
    ],
  });
  try {
    // Table still publishes a withdrawn asset; manifest approves one the table does not publish.
    assert.throws(
      () => assertAssetStatusParity(root, [{ slug: 'mastery-soldier' }]),
      (error: Error) =>
        /mastery-soldier/.test(error.message) &&
        /tabla assets: approved/.test(error.message) &&
        /manifiesto: withdrawn/.test(error.message) &&
        /mastery-shaman/.test(error.message) &&
        /tabla assets: no publicado/.test(error.message) &&
        /manifiesto: approved/.test(error.message),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertAssetStatusParity: an asset public in the table but absent from the manifest is a discrepancy', () => {
  const root = repo({ assets: [entry({ slug: 'mastery-soldier' })] });
  try {
    assert.throws(
      () => assertAssetStatusParity(root, [{ slug: 'mastery-soldier' }, { slug: 'mastery-ghost' }]),
      /mastery-ghost.*tabla assets: approved.*manifiesto: ausente/s,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('our own art under assets/ui/ is not game art and needs no manifest entry (spec004 T008)', () => {
  const root = repo({ assets: [] }, false);
  try {
    mkdirSync(join(root, 'apps/web/public/assets/ui'), { recursive: true });
    writeFileSync(join(root, 'apps/web/public/assets/ui/frame-panel.svg'), '<svg/>');
    assert.deepEqual(checkAssets(root), { count: 0, issues: [] });
    mkdirSync(join(root, 'apps/web/public/assets/portraits'), { recursive: true });
    writeFileSync(join(root, 'apps/web/public/assets/portraits/x.png'), PNG);
    assert.equal(checkAssets(root).issues.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- spec004 T028: skill icons (SC-009 and fail-closed `game`) -------------------------------

const ICON = 'ic-0123456789abcdef';
const iconEntry = (over: Record<string, unknown> = {}) => ({
  ...entry(),
  slug: ICON,
  file_path: `public/assets/skill-icons/${ICON}.png`,
  proof_ref: 'specs/004-rediseno-ui-grim-dawn/research.md#r10',
  fallback_svg: 'public/assets/ui/skill-icons.svg#skill-active',
  provenance: {
    game_version: 'steam-build-1',
    source_path: 'ui/x.tex',
    sha256: SHA,
    width: 32,
    height: 32,
  },
  ...over,
});

function gameRepo(entries: unknown[], iconIds: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'gd-game-'));
  const put = (path: string, data: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), data);
  };
  put('fixtures/content/assets/manifest.json', JSON.stringify({ assets: entries }));
  put(
    'fixtures/content/mastery-trees/soldier.json',
    JSON.stringify({ nodes: iconIds.map((icon_id) => ({ icon_id })) }),
  );
  put(`apps/web/${FILE}`, PNG.toString());
  for (const item of entries as { slug: string; status: string; file_path?: string | null }[])
    if (item.slug.startsWith('ic-') && item.status === 'approved' && item.file_path)
      put(`apps/web/${item.file_path}`, PNG.toString());
  return root;
}

test('assertGameAssets: every icon of the catalog needs an approved or withdrawn entry', () => {
  const portrait = entry({ slug: 'mastery-soldier' });
  const roots = {
    fine: gameRepo([portrait, iconEntry()], [ICON]),
    withdrawn: gameRepo(
      [portrait, iconEntry({ status: 'withdrawn', file_path: null, provenance: undefined })],
      [ICON],
    ),
    missing: gameRepo([portrait], [ICON]),
    pending: gameRepo([portrait, iconEntry({ status: 'pending' })], [ICON]),
    license: gameRepo([portrait, iconEntry({ license_or_permission: 'libre' })], [ICON]),
  };
  try {
    assert.doesNotThrow(() => assertGameAssets(roots.fine));
    assert.doesNotThrow(() => assertGameAssets(roots.withdrawn));
    for (const key of ['missing', 'pending', 'license'] as const)
      assert.throws(() => assertGameAssets(roots[key]), new RegExp(ICON), key);
  } finally {
    for (const root of Object.values(roots)) rmSync(root, { recursive: true, force: true });
  }
});

test('assertNoGamePortraits: with own an artifact with skill icons fails, with game it is not checked (SC-009)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gd-artifact-'));
  try {
    for (const locale of ['', 'es/']) {
      mkdirSync(join(root, 'browser', locale, 'assets', 'skill-icons'), { recursive: true });
    }
    writeFileSync(join(root, 'browser', 'index.html'), '<html></html>');
    assert.doesNotThrow(() => assertNoGamePortraits(root, 'game'));
    assert.doesNotThrow(() => assertNoGamePortraits(root, 'own'));
    writeFileSync(join(root, 'browser', 'es', 'assets', 'skill-icons', `${ICON}.png`), PNG);
    assert.throws(() => assertNoGamePortraits(root, 'own'), /iconos de habilidad|skill-icons/);
    assert.doesNotThrow(() => assertNoGamePortraits(root, 'game'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertPortraitCredit: with game every page with portraits carries [data-credit]; with own none does (T047, F-001)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gd-credit-'));
  const credit = '<p class="credit" data-credit>© Crate Entertainment</p>';
  const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;
  const img = '<img src="assets/portraits/shaman.png" alt="">';
  const write = (rel: string, html: string) => {
    mkdirSync(dirname(join(root, 'browser', rel)), { recursive: true });
    writeFileSync(join(root, 'browser', rel), page(html));
  };
  try {
    for (const rel of [
      'index.html',
      'tier-list/index.html',
      'es/index.html',
      'es/tier-list/index.html',
    ])
      write(rel, `${img}${credit}`);
    assert.doesNotThrow(() => assertPortraitCredit(root, 'game'));
    assert.throws(() => assertPortraitCredit(root, 'own'), /own.*cr[eé]dito|data-credit/);
    write('es/tier-list/index.html', img);
    assert.throws(() => assertPortraitCredit(root, 'game'), /es\/tier-list\/index\.html/);
    // A page with no game portrait needs no credit; own with no credit passes.
    for (const rel of [
      'index.html',
      'tier-list/index.html',
      'es/index.html',
      'es/tier-list/index.html',
    ])
      write(rel, '<img src="assets/icons/mastery-chaman.svg" alt="">');
    assert.doesNotThrow(() => assertPortraitCredit(root, 'game'));
    assert.doesNotThrow(() => assertPortraitCredit(root, 'own'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertSkillIconCredit: with game every page with skill icons carries [data-game-art-credit]; with own none does (T053, A-01/S-001)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gd-icon-credit-'));
  const credit = '<p class="skill-tree__credit" data-game-art-credit>© Crate Entertainment</p>';
  const img = '<img src="assets/skill-icons/soldier-a.png" alt="">';
  const write = (rel: string, body: string) => {
    mkdirSync(dirname(join(root, 'browser', rel)), { recursive: true });
    writeFileSync(join(root, 'browser', rel), `<!doctype html><html><body>${body}</body></html>`);
  };
  try {
    const pages = ['masteries/soldier/index.html', 'es/maestrias/soldado/index.html'];
    for (const rel of pages) write(rel, `${img}${credit}`);
    assert.doesNotThrow(() => assertSkillIconCredit(root, 'game'));
    assert.throws(() => assertSkillIconCredit(root, 'own'), /own.*data-game-art-credit/);
    write('es/maestrias/soldado/index.html', img);
    assert.throws(() => assertSkillIconCredit(root, 'game'), /es\/maestrias\/soldado\/index\.html/);
    // A page without game icons needs no credit; own with no credit passes.
    for (const rel of pages) write(rel, '<img src="assets/ui/skill-fallback.svg" alt="">');
    assert.doesNotThrow(() => assertSkillIconCredit(root, 'game'));
    assert.doesNotThrow(() => assertSkillIconCredit(root, 'own'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credit gates fail on an empty artifact in game and own, naming the cause (spec005 T001, S4-D1, FR-001)', () => {
  const gates = [
    ['assertPortraitCredit', assertPortraitCredit],
    ['assertSkillIconCredit', assertSkillIconCredit],
  ] as const;
  const root = mkdtempSync(join(tmpdir(), 'gd-credit-empty-'));
  try {
    for (const [name, gate] of gates)
      for (const source of ['game', 'own']) {
        // No `browser/` folder at all.
        assert.throws(() => gate(root, source), /sin carpeta browser/, `${name} ${source}`);
        // `browser/` with files but no HTML page.
        mkdirSync(join(root, 'browser'), { recursive: true });
        writeFileSync(join(root, 'browser', 'main.js'), 'console.log(1);');
        assert.throws(() => gate(root, source), /ninguna p[aá]gina \.html/, `${name} ${source}`);
        rmSync(join(root, 'browser'), { recursive: true, force: true });
      }
    // Any other source is not a credit decision: it is still ignored.
    assert.doesNotThrow(() => assertPortraitCredit(root, ''));
    assert.doesNotThrow(() => assertSkillIconCredit(root, ''));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('credit gates: the credit only goes with the game art — own fails with a credit even without art (spec005 T001, FR-003)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gd-credit-only-'));
  try {
    mkdirSync(join(root, 'browser'), { recursive: true });
    writeFileSync(
      join(root, 'browser', 'index.html'),
      '<p data-credit>© Crate</p><p data-game-art-credit>© Crate</p>',
    );
    assert.throws(() => assertPortraitCredit(root, 'own'), /index\.html.*data-credit/);
    assert.throws(() => assertSkillIconCredit(root, 'own'), /index\.html.*data-game-art-credit/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertNoGamePortraits: with own it fails closed on a missing artifact or a browser/ without pages (spec006 T001, FR-003, FR-005)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gd-portraits-empty-'));
  try {
    // No `browser/` folder at all.
    assert.throws(() => assertNoGamePortraits(root, 'own'), /sin carpeta browser/);
    assert.throws(() => assertNoGamePortraits(join(root, 'nope'), 'own'), /sin carpeta browser/);
    // `browser/` with files but no HTML page.
    mkdirSync(join(root, 'browser'), { recursive: true });
    writeFileSync(join(root, 'browser', 'main.js'), 'console.log(1);');
    assert.throws(() => assertNoGamePortraits(root, 'own'), /ninguna p[aá]gina \.html/);
    // With `game` and any other source there is nothing to check here (FR-004).
    assert.doesNotThrow(() => assertNoGamePortraits(root, 'game'));
    assert.doesNotThrow(() => assertNoGamePortraits(root, ''));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertNoGamePortraits: with own a linked assets/portraits folder fails; with game it is not checked (spec007 T001, FR-002)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gd-portraits-link-'));
  try {
    mkdirSync(join(root, 'real'));
    writeFileSync(join(root, 'real', 'soldier.png'), PNG);
    mkdirSync(join(root, 'browser', 'assets'), { recursive: true });
    writeFileSync(join(root, 'browser', 'index.html'), '<html></html>');
    try {
      symlinkSync(join(root, 'real'), join(root, 'browser', 'assets', 'portraits'), 'junction');
    } catch {
      return; // the platform refuses links: nothing to prove here
    }
    assert.throws(
      () => assertNoGamePortraits(root, 'own'),
      /el artefacto es inv[aá]lido \(enlace o entrada no regular: .*assets\/portraits\)/,
    );
    assert.doesNotThrow(() => assertNoGamePortraits(root, 'game'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
