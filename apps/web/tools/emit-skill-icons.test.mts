import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { catalogIconIds, emitSkillIcons } from './emit-skill-icons.mts';
import { createMasteryCatalog } from '../src/app/core/content/masteries.server.ts';

const WEB_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');
const MANIFEST = resolve(WEB_ROOT, '..', '..', 'fixtures', 'content', 'assets', 'manifest.json');
const A = 'ic-aaaaaaaaaaaaaaaa';
const B = 'ic-bbbbbbbbbbbbbbbb';
const C = 'ic-cccccccccccccccc';
/** Content of every fixture PNG; the manifest records its sha256 (the emitter verifies it). */
const PNG = 'png';
const SHA = createHash('sha256').update(PNG).digest('hex');

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
    sha256: SHA,
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
    await writeFile(join(web, 'public', 'assets', 'skill-icons', `${id}.png`), PNG);
  const manifest = join(web, 'manifest.json');
  await writeFile(manifest, JSON.stringify({ assets: entries }));
  return { web, manifest };
}

const withdrawnEntry = (slug: string) =>
  entry(slug, { status: 'withdrawn', file_path: null, provenance: undefined });

test('with game only the referenced approved icons are copied, to the artifact of every locale', async () => {
  const root = await artifact();
  const { web, manifest } = await fixture([entry(A), entry(B), withdrawnEntry(C)]);
  try {
    const written = await emitSkillIcons(web, root, 'game', manifest, [A, B, C]);
    assert.deepEqual(written, [`${A}.png`, `${B}.png`]);
    assert.deepEqual(await icons(root), written);
    assert.deepEqual(await icons(root, 'es'), written);
    await assert.rejects(readdir(join(root, 'browser', '404', 'assets')));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(web, { recursive: true, force: true });
  }
});

test('an approved icon no node references is not emitted (T050)', async () => {
  const root = await artifact();
  const { web, manifest } = await fixture([entry(A), entry(B)]);
  try {
    assert.deepEqual(await emitSkillIcons(web, root, 'game', manifest, [A, A]), [`${A}.png`]);
    assert.deepEqual(await icons(root), [`${A}.png`]);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(web, { recursive: true, force: true });
  }
});

test('a withdrawn entry is not copied even if its file is still on disk (same-change withdrawal)', async () => {
  const root = await artifact();
  const { web, manifest } = await fixture([entry(A), withdrawnEntry(B)]);
  try {
    assert.deepEqual(await emitSkillIcons(web, root, 'game', manifest, [A, B]), [`${A}.png`]);
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
    await emitSkillIcons(web, root, 'game', manifest, [A, B]);
    assert.deepEqual(await emitSkillIcons(web, root, 'own', manifest, []), []);
    for (const locale of ['', 'es'])
      await assert.rejects(readdir(join(root, 'browser', locale, 'assets', 'skill-icons')), {
        code: 'ENOENT',
      });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(web, { recursive: true, force: true });
  }
});

test('fails closed: missing file, sha256 mismatch, same rule as the prerender, no entry, no icons, bad source or artifact', async () => {
  const root = await artifact();
  try {
    const missing = await fixture([entry(A), entry(B)], [A]);
    await assert.rejects(
      emitSkillIcons(missing.web, root, 'game', missing.manifest, [A, B]),
      /skill-icons/,
    );
    const tampered = await fixture([entry(A), entry(B, { provenance: undefined })]);
    await writeFile(join(tampered.web, 'public', 'assets', 'skill-icons', `${A}.png`), 'other');
    await assert.rejects(
      emitSkillIcons(tampered.web, root, 'game', tampered.manifest, [A]),
      /skill-icons/,
      'sha256 does not match the manifest',
    );
    for (const over of [
      { license_or_permission: 'libre' },
      { proof_ref: 'otro' },
      { provenance: undefined },
      { file_path: 'public/assets/skill-icons/other.png' },
      { status: 'pending', file_path: null },
    ]) {
      const bad = await fixture([entry(A, over), entry(B)]);
      await assert.rejects(
        emitSkillIcons(bad.web, root, 'game', bad.manifest, [A, B]),
        /skill-icons/,
        JSON.stringify(over),
      );
    }
    const noEntry = await fixture([entry(A)]);
    await assert.rejects(
      emitSkillIcons(noEntry.web, root, 'game', noEntry.manifest, [A, B]),
      /skill-icons/,
      'a referenced icon without manifest entry',
    );
    await assert.rejects(
      emitSkillIcons(noEntry.web, root, 'game', noEntry.manifest, ['ui/skills/x.tex']),
      /skill-icons/,
    );
    const none = await fixture([]);
    await assert.rejects(emitSkillIcons(none.web, root, 'game', none.manifest, []), /skill-icons/);
    const onlyWithdrawn = await fixture([withdrawnEntry(A)]);
    await assert.rejects(
      emitSkillIcons(onlyWithdrawn.web, root, 'game', onlyWithdrawn.manifest, [A]),
      /skill-icons/,
    );
    const ok = await fixture([entry(A)]);
    await assert.rejects(
      emitSkillIcons(ok.web, root, 'both' as 'own', ok.manifest, [A]),
      /skill-icons/,
    );
    const empty = await mkdtemp(join(tmpdir(), 'emit-skill-icons-'));
    await assert.rejects(emitSkillIcons(ok.web, empty, 'game', ok.manifest, [A]), /skill-icons/);
    await rm(empty, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('with the repository catalog the emitted set is exactly its non-withdrawn icon_id (T050, SC-009)', async () => {
  const root = await artifact();
  try {
    const catalog = createMasteryCatalog(join(REPO_ROOT, 'fixtures', 'content'), {});
    const ids = await catalogIconIds(catalog);
    const entries = (
      JSON.parse(await readFile(MANIFEST, 'utf8')) as { assets: { slug: string; status: string }[] }
    ).assets;
    const withdrawn = new Set(entries.filter((e) => e.status === 'withdrawn').map((e) => e.slug));
    const expected = [...new Set(ids)].filter((id) => !withdrawn.has(id)).sort();
    assert.ok(expected.length > 0);
    const written = await emitSkillIcons(WEB_ROOT, root, 'game', MANIFEST, ids);
    assert.deepEqual(
      written,
      expected.map((id) => `${id}.png`),
    );
    assert.ok(written.every((name) => /^ic-[0-9a-f]{16}.png$/.test(name)));
    assert.deepEqual(await icons(root, 'es'), written);
    assert.deepEqual(await emitSkillIcons(WEB_ROOT, root, 'own', MANIFEST, ids), []);
    await assert.rejects(readdir(join(root, 'browser', 'assets', 'skill-icons')), {
      code: 'ENOENT',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
