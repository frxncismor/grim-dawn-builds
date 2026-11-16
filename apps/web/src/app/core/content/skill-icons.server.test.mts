import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createSkillIconSource, resolveSkillIconSource } from './skill-icons.server.ts';

const A = 'ic-aaaaaaaaaaaaaaaa';
const B = 'ic-bbbbbbbbbbbbbbbb';
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
    game_version: 'v',
    source_path: 'ui/x.tex',
    sha256: 'a'.repeat(64),
    width: 32,
    height: 32,
  },
  ...over,
});
const withdrawn = (slug: string) =>
  entry(slug, { status: 'withdrawn', file_path: null, provenance: undefined });

test('approved icons are served from the game; a withdrawn one keeps the own symbol', () => {
  assert.deepEqual(resolveSkillIconSource([A, B, A], [entry(A), entry(B)]), {
    source: 'game',
    withdrawn: [],
  });
  assert.deepEqual(resolveSkillIconSource([A, B], [entry(A), withdrawn(B)]), {
    source: 'game',
    withdrawn: [B],
  });
});

test('fails closed: no entry, pending, rejected, other licence, invalid shape or bad id', () => {
  const cases: [string, unknown[]][] = [
    ['no entry', [entry(A)]],
    ['pending', [entry(A), entry(B, { status: 'pending' })]],
    ['rejected', [entry(A), entry(B, { status: 'rejected' })]],
    ['licence', [entry(A), entry(B, { license_or_permission: 'libre' })]],
    ['proof', [entry(A), entry(B, { proof_ref: 'otro' })]],
    ['no provenance', [entry(A), entry(B, { provenance: undefined })]],
  ];
  for (const [why, entries] of cases)
    assert.throws(
      () => resolveSkillIconSource([A, B], entries),
      /Icono de habilidad inválido/,
      why,
    );
  assert.throws(() => resolveSkillIconSource(['ui/skills/x.tex'], []), /icon_id/);
});

test('with own the manifest is never read; with game an unreadable one fails; unset means own', async () => {
  const never = async (): Promise<string[]> => assert.fail('catalog read with own');
  assert.equal(await createSkillIconSource('/nonexistent', { ASSET_SOURCE: 'own' }, never), null);
  assert.equal(await createSkillIconSource('/nonexistent', {}, never), null);
  await assert.rejects(
    createSkillIconSource('/nonexistent', { ASSET_SOURCE: 'game' }, async () => [A]),
    /manifiesto de activos legible/,
  );
  await assert.rejects(
    createSkillIconSource('/nonexistent', { ASSET_SOURCE: 'both' }, never),
    /own o game/,
  );
});

test('with the repository manifest every icon of the catalog resolves under game', async () => {
  const dir = 'fixtures/content/mastery-trees';
  const ids = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) =>
      (
        JSON.parse(readFileSync(`${dir}/${name}`, 'utf8')) as { nodes: { icon_id: string }[] }
      ).nodes.map((node) => node.icon_id),
    );
  const source = await createSkillIconSource(
    'fixtures/content',
    { ASSET_SOURCE: 'game' },
    async () => ids,
  );
  assert.deepEqual(source, { source: 'game', withdrawn: [] });
});
