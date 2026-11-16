import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { emitSkillIcons } from './emit-skill-icons.mts';

const WEB_ROOT = resolve(import.meta.dirname, '..');
const MANIFEST = resolve(WEB_ROOT, '..', '..', 'fixtures', 'content', 'assets', 'manifest.json');
const A = 'ic-aaaaaaaaaaaaaaaa';
const B = 'ic-bbbbbbbbbbbbbbbb';

async function artifact(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'emit-skill-icons-'));
  for (const dir of ['browser/assets', 'browser/es/assets', 'browser/404'])
    await mkdir(join(root, dir), { recursive: true });
  return root;
}

const icons = async (root: string, locale = ''): Promise<string[]> =>
  readdir(join(root, 'browser', locale, 'assets', 'skill-icons')).then((names) => names.sort());

const entry = (slug: string, over: Record<string, unknown> = {}) => ({
  slug,
  status: 'approved',
  file_path: `public/assets/skill-icons/${slug}.png`,
  origin_url: 'https://store.steampowered.com/app/219990/Grim_Dawn/',
  rights_holder: 'Crate Entertainment',
  license_or_permission: 'tolerancia_de_facto_sin_permiso',
  proof_ref: 'specs/004-rediseno-ui-grim-dawn/research.md#r10',
  recorded_on: '2026-11-15',
  fallback_svg: 'public/assets/ui/skill-icons.svg#skill-active',
  provenance: {
    game_version: 'x',
    source_path: 'ui/x.tex',
    sha256: 'a'.repeat(64),
    width: 32,
    height: 32,
  },
  ...over,
});

/** A web root with two PNG files and a manifest listing them, plus a withdrawn third entry. */
async function fixture(entries: unknown[], files: string[] = [A, B]) {
  const web = await mkdtemp(join(tmpdir(), 'web-'));
  await mkdir(join(web, 'public', 'assets', 'skill-icons'), { recursive: true });
  for (const id of files)
    await writeFile(join(web, 'public', 'assets', 'skill-icons', `${id}.png`), 'png');
  const manifest = join(web, 'manifest.json');
  await writeFile(manifest, JSON.stringify({ assets: entries }));
  return { web, manifest };
}

test('with game only the approved icons are copied, to the artifact of every locale', async () => {
  const root = await artifact();
  const { web, manifest } = await fixture([
    entry(A),
    entry(B),
    entry('ic-cccccccccccccccc', { status: 'withdrawn', file_path: null, provenance: undefined }),
  ]);
  try {
    const written = await emitSkillIcons(web, root, 'game', manifest);
    assert.deepEqual(written, [`${A}.png`, `${B}.png`]);
    assert.deepEqual(await icons(root), written);
    assert.deepEqual(await icons(root, 'es'), written);
    await assert.rejects(readdir(join(root, 'browser', '404', 'assets')));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(web, { recursive: true, force: true });
  }
});

test('a withdrawn entry is not copied even if its file is still on disk (same-change withdrawal)', async () => {
  const root = await artifact();
  const { web, manifest } = await fixture([
    entry(A),
    entry(B, { status: 'withdrawn', file_path: null, provenance: undefined }),
  ]);
  try {
    assert.deepEqual(await emitSkillIcons(web, root, 'game', manifest), [`${A}.png`]);
    assert.deepEqual(await icons(root), [`${A}.png`]);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(web, { recursive: true, force: true });
  }
});

test('with own no icon ends up in the artifact, and a stale folder is removed', async () => {
  const root = await artifact();
  const { web, manifest } = await fixture([entry(A), entry(B)]);
  try {
    await emitSkillIcons(web, root, 'game', manifest);
    assert.deepEqual(await emitSkillIcons(web, root, 'own', manifest), []);
    for (const locale of ['', 'es'])
      await assert.rejects(readdir(join(root, 'browser', locale, 'assets', 'skill-icons')), {
        code: 'ENOENT',
      });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(web, { recursive: true, force: true });
  }
});

test('fails closed: approved entry without file, wrong permission, no icons, bad source or artifact', async () => {
  const root = await artifact();
  try {
    const missing = await fixture([entry(A), entry(B)], [A]);
    await assert.rejects(
      emitSkillIcons(missing.web, root, 'game', missing.manifest),
      /skill-icons/,
    );
    const license = await fixture([entry(A, { license_or_permission: 'libre' }), entry(B)]);
    await assert.rejects(
      emitSkillIcons(license.web, root, 'game', license.manifest),
      /skill-icons/,
    );
    const none = await fixture([]);
    await assert.rejects(emitSkillIcons(none.web, root, 'game', none.manifest), /skill-icons/);
    const ok = await fixture([entry(A)]);
    await assert.rejects(emitSkillIcons(ok.web, root, 'both' as 'own', ok.manifest), /skill-icons/);
    const empty = await mkdtemp(join(tmpdir(), 'emit-skill-icons-'));
    await assert.rejects(emitSkillIcons(ok.web, empty, 'game', ok.manifest), /skill-icons/);
    await rm(empty, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('with the repository manifest game emits the 164 icons and own none (SC-009)', async () => {
  const root = await artifact();
  try {
    const written = await emitSkillIcons(WEB_ROOT, root, 'game', MANIFEST);
    assert.equal(written.length, 164);
    assert.ok(written.every((name) => /^ic-[0-9a-f]{16}\.png$/.test(name)));
    assert.deepEqual(await icons(root, 'es'), written);
    assert.deepEqual(await emitSkillIcons(WEB_ROOT, root, 'own', MANIFEST), []);
    await assert.rejects(readdir(join(root, 'browser', 'assets', 'skill-icons')), {
      code: 'ENOENT',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
