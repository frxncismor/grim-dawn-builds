import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveIcon, resolvePublicAssets } from './resolve-icon.server.ts';
import { ICONS } from './registry.ts';
const approved = {
  slug: 'rayo-oficial',
  status: 'approved',
  file_path: 'public/assets/official/rayo.svg',
  origin_url: 'https://example.test/fixture',
  rights_holder: 'Fixture propio',
  license_or_permission: 'Solo prueba',
  proof_ref: 'PRIVATE-EVIDENCE-CANARY',
  recorded_on: '2026-11-09',
  fallback_svg: 'src/assets/icons/damage-rayo.svg',
};
test('all registry SVGs are own passive files with fixed intrinsic geometry and the approved palette', async () => {
  const root = join(import.meta.dirname, '../../../../../');
  const folder = join(root, 'src/assets/icons');
  assert.deepEqual(
    (await readdir(folder)).sort(),
    Object.keys(ICONS)
      .map((id) => `${id}.svg`)
      .sort(),
  );
  const tokens = await readFile(join(root, 'src/styles/tokens.css'), 'utf8');
  const bone = /--color-bone:\s*(#[a-f0-9]+)/i.exec(tokens)![1];
  const soot = /--color-soot:\s*(#[a-f0-9]+)/i.exec(tokens)![1];
  assert.equal(bone, '#eadfca');
  assert.equal(soot, '#0c0a08');
  for (const id of Object.keys(ICONS)) {
    const svg = await readFile(join(folder, `${id}.svg`), 'utf8');
    assert.match(svg, /width="24" height="24" viewBox="0 0 24 24"/);
    assert.ok(svg.includes(`stroke="${bone}"`));
    assert.doesNotMatch(
      svg,
      /<(?:script|foreignObject|image|filter|animate)\b|\bon\w+=|(?:href|src)=/i,
    );
  }
});
test('pending, rejected and unknown identifiers use only registered own SVG paths', () => {
  for (const id of Object.keys(ICONS)) assert.equal(resolveIcon(id).src, `assets/icons/${id}.svg`);
  for (const status of ['pending', 'rejected'])
    assert.equal(
      resolveIcon('damage-rayo', { ...approved, status, file_path: null }).src,
      'assets/icons/damage-rayo.svg',
    );
  assert.equal(resolveIcon('../private').src, 'assets/icons/generic.svg');
});
test('approved canonical fixture produces only a public descriptor without its evidence', () => {
  assert.deepEqual(resolveIcon('damage-rayo', approved), {
    id: 'damage-rayo',
    src: 'assets/official/rayo.svg',
    fallbackSrc: 'assets/icons/damage-rayo.svg',
  });
  assert.doesNotMatch(
    JSON.stringify(resolveIcon('damage-rayo', approved)),
    /proof_ref|PRIVATE-EVIDENCE|license_or_permission|rights_holder/,
  );
});
const publicDescriptor = {
  slug: 'rayo-oficial',
  file_path: 'public/assets/official/rayo.svg',
  fallback_svg: 'src/assets/icons/damage-rayo.svg',
};
test('FR-16: the public descriptor of an approved asset resolves without private evidence', () => {
  assert.deepEqual(resolveIcon('damage-rayo', publicDescriptor), {
    id: 'damage-rayo',
    src: 'assets/official/rayo.svg',
    fallbackSrc: 'assets/icons/damage-rayo.svg',
  });
  assert.deepEqual(resolvePublicAssets([publicDescriptor]), [
    { slug: 'rayo-oficial', icon: resolveIcon('damage-rayo', publicDescriptor) },
  ]);
  assert.doesNotMatch(
    JSON.stringify(resolvePublicAssets([publicDescriptor])),
    /proof_ref|origin_url|rights_holder|license_or_permission|public\//,
  );
});
test('FR-16: pending or rejected descriptors always fall back and never use the official file', () => {
  for (const status of ['pending', 'rejected']) {
    const descriptor = { ...publicDescriptor, status, file_path: null };
    assert.deepEqual(resolveIcon('damage-rayo', descriptor), {
      id: 'damage-rayo',
      src: 'assets/icons/damage-rayo.svg',
      fallbackSrc: 'assets/icons/damage-rayo.svg',
    });
    assert.deepEqual(resolvePublicAssets([descriptor]), [
      { slug: 'rayo-oficial', icon: resolveIcon('damage-rayo') },
    ]);
  }
});
test('FR-16: descriptors for another icon or with private evidence never become official art', () => {
  assert.throws(
    () =>
      resolveIcon('damage-rayo', {
        ...publicDescriptor,
        fallback_svg: 'src/assets/icons/damage-fuego.svg',
      }),
    (error: Error) => error.message === 'Icono aprobado inválido.' && error.cause === undefined,
  );
  for (const file_path of [
    'assets/official/rayo.svg',
    'public/assets/official/../private.svg',
    'public/assets/official/rayo.svg?key=private',
    'https://example.test/rayo.svg',
  ])
    assert.throws(
      () => resolveIcon('damage-rayo', { ...publicDescriptor, file_path }),
      (error: Error) => error.message === 'Icono aprobado inválido.' && error.cause === undefined,
    );
});
test('incomplete approval and hostile paths fail without retaining private details', () => {
  for (const change of [
    { proof_ref: null },
    { status: 'approved', rights_holder: '' },
    ...[
      'https://example.test/rayo.svg',
      'public/assets/official/../private.svg',
      'public/assets/official/%2e%2e/private.svg',
      'public/assets/official/icon.svg?key=private',
      'public/assets/official/icon.svg#private',
      'public\\assets\\official\\icon.svg',
    ].map((file_path) => ({ file_path })),
  ])
    assert.throws(
      () => resolveIcon('damage-rayo', { ...approved, ...change }),
      (error: Error) => error.message === 'Icono aprobado inválido.' && error.cause === undefined,
    );
});
