import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import type { MasteryCatalog } from '../src/app/core/content/masteries.ts';
import { FixtureMasteryCatalog } from '../src/app/core/content/masteries.server.ts';
import { emitMasteryTrees, MASTERY_TREES_DIR, MASTERY_TREES_INDEX } from './emit-mastery-trees.mts';

const CONTENT = resolve(import.meta.dirname, '..', '..', '..', 'fixtures', 'content');

async function artifact(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'emit-trees-'));
  await mkdir(join(root, 'browser'), { recursive: true });
  return root;
}

test('emite un JSON por maestría y el índice id→slug, válidos contra MasteryTree', async () => {
  const root = await artifact();
  try {
    const catalog = new FixtureMasteryCatalog(CONTENT);
    const slugs = await catalog.listSlugs();
    await emitMasteryTrees(catalog, root);
    const folder = join(root, 'browser', MASTERY_TREES_DIR);
    const files = (await readdir(folder)).sort();
    assert.deepEqual(files, [...slugs.map((slug) => `${slug}.json`), MASTERY_TREES_INDEX].sort());
    const index = JSON.parse(await readFile(join(folder, MASTERY_TREES_INDEX), 'utf8')) as Record<
      string,
      string
    >;
    assert.equal(Object.keys(index).length, slugs.length);
    for (const slug of slugs) {
      const tree = MasteryTreeSchema.parse(
        JSON.parse(await readFile(join(folder, `${slug}.json`), 'utf8')),
      );
      assert.equal(tree.mastery.slug, slug);
      assert.equal(index[tree.mastery.id], slug);
    }
    assert.equal(index['class06'], 'shaman');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('falla cerrado si la fuente falla y no deja ficheros a medias', async () => {
  const root = await artifact();
  try {
    const catalog: MasteryCatalog = {
      listSlugs: async () => ['shaman', 'demolition'],
      listSummaries: async () => [],
      get: async (slug) => {
        if (slug === 'demolition') throw new Error('Catálogo de maestrías no disponible.');
        return new FixtureMasteryCatalog(CONTENT).get(slug);
      },
    };
    await assert.rejects(emitMasteryTrees(catalog, root), /mastery-trees/);
    await assert.rejects(readdir(join(root, 'browser', MASTERY_TREES_DIR)), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('falla si un slug del catálogo no existe o el catálogo está vacío', async () => {
  const root = await artifact();
  try {
    const missing: MasteryCatalog = {
      listSlugs: async () => ['shaman'],
      listSummaries: async () => [],
      get: async () => null,
    };
    await assert.rejects(emitMasteryTrees(missing, root), /mastery-trees/);
    const empty: MasteryCatalog = { ...missing, listSlugs: async () => [] };
    await assert.rejects(emitMasteryTrees(empty, root), /mastery-trees/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('es idempotente y reemplaza ficheros obsoletos de una maestría retirada', async () => {
  const root = await artifact();
  try {
    const catalog = new FixtureMasteryCatalog(CONTENT);
    await emitMasteryTrees(catalog, root);
    const folder = join(root, 'browser', MASTERY_TREES_DIR);
    const before = await readFile(join(folder, 'shaman.json'), 'utf8');
    await emitMasteryTrees(catalog, root);
    assert.equal(await readFile(join(folder, 'shaman.json'), 'utf8'), before);
    const tree: MasteryTree = JSON.parse(before);
    assert.ok(tree.nodes.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
