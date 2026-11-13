import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_BAR_REQUIRED } from '@gd/domain';
import { checkCatalogDir, checkTree, MAX_POINTS_RANGE } from './check-mastery-catalog.mts';
import { splitCatalog } from './split-mastery-catalog.mts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REAL_DIR = join(REPO_ROOT, 'fixtures', 'content', 'mastery-trees');
const SCRIPT = join('scripts', 'check-mastery-catalog.mts');

const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

interface NodeIn {
  id: string;
  tier: number;
  row: number;
  parent?: string | null;
  max?: number;
}

/** Sintético mínimo; `cls` es el prefijo de maestría de los ids. */
function node(n: NodeIn, cls: string) {
  return {
    id: `${cls}/${n.id}`,
    name: { en: n.id, es: n.id },
    kind: 'active',
    circular: false,
    tier: n.tier,
    bar_required: TIER_BAR_REQUIRED[n.tier - 1],
    grid: { col: n.tier, row: n.row },
    max_points: n.max ?? 10,
    parent_id: n.parent ? `${cls}/${n.parent}` : null,
  };
}

function tree(nodes: NodeIn[], mastery = { id: 'class01', slug: 'soldier' }) {
  return {
    mastery: { ...mastery, name: { en: 'Soldier', es: 'Soldado' } },
    game_version: 'test-1',
    source: { game_version: 'test-1', sha256: ['a'.repeat(64)] },
    nodes: nodes.map((n) => node(n, mastery.id)),
  };
}

const VALID: NodeIn[] = [
  { id: 'a', tier: 1, row: 0 },
  { id: 'b', tier: 2, row: 0, parent: 'a' },
];

describe('checkTree', () => {
  it('accepts a minimal valid tree', () => {
    assert.deepEqual(checkTree(tree(VALID), 'soldier.json'), []);
  });

  it('fails a node whose parent does not exist, naming file and node', () => {
    const errors = checkTree(
      tree([...VALID, { id: 'c', tier: 3, row: 0, parent: 'zzz' }]),
      'soldier.json',
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /soldier\.json/);
    assert.match(errors[0]!, /class01\/c/);
    assert.match(errors[0]!, /padre inexistente/);
  });

  it('fails a dependency cycle', () => {
    const errors = checkTree(
      tree([
        { id: 'a', tier: 1, row: 0, parent: 'b' },
        { id: 'b', tier: 2, row: 0, parent: 'a' },
      ]),
      'soldier.json',
    );
    assert.ok(
      errors.some((e) => /ciclo/.test(e)),
      errors.join('\n'),
    );
  });

  it('fails a tier that is not monotonic from the root', () => {
    const errors = checkTree(
      tree([
        { id: 'a', tier: 3, row: 0 },
        { id: 'b', tier: 2, row: 0, parent: 'a' },
      ]),
      'soldier.json',
    );
    assert.ok(
      errors.some((e) => /class01\/b/.test(e) && /tier/.test(e)),
      errors.join('\n'),
    );
  });

  it('fails a grid collision', () => {
    const errors = checkTree(
      tree([...VALID, { id: 'c', tier: 2, row: 0, parent: 'a' }]),
      'soldier.json',
    );
    assert.ok(
      errors.some((e) => /colisión de rejilla/.test(e) && /class01\/c/.test(e)),
      errors.join('\n'),
    );
  });

  it('fails max_points outside the game range', () => {
    const over = checkTree(
      tree([{ id: 'a', tier: 1, row: 0, max: MAX_POINTS_RANGE.max + 1 }]),
      'soldier.json',
    );
    assert.ok(
      over.some((e) => /max_points/.test(e) && /class01\/a/.test(e)),
      over.join('\n'),
    );
    const under = checkTree(tree([{ id: 'a', tier: 1, row: 0, max: 0 }]), 'soldier.json');
    assert.ok(
      under.some((e) => /max_points/.test(e)),
      under.join('\n'),
    );
  });

  it('fails an empty name', () => {
    const t = tree(VALID);
    t.nodes[0]!.name.es = '';
    assert.ok(checkTree(t, 'soldier.json').some((e) => /class01\/a/.test(e)));
  });

  it('fails when the file name does not match the mastery slug', () => {
    const errors = checkTree(tree(VALID), 'occult.json');
    assert.ok(
      errors.some((e) => /slug/.test(e)),
      errors.join('\n'),
    );
  });
});

function dirWith(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mastery-catalog-'));
  tempDirs.push(dir);
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), JSON.stringify(body));
  return dir;
}

const SIX = [
  ['class01', 'soldier'],
  ['class02', 'demolition'],
  ['class03', 'occult'],
  ['class04', 'nightblade'],
  ['class05', 'arcanist'],
  ['class06', 'shaman'],
] as const;

describe('checkCatalogDir', () => {
  it('passes with the six base masteries', () => {
    const files = Object.fromEntries(
      SIX.map(([id, slug]) => [`${slug}.json`, tree(VALID, { id, slug })]),
    );
    assert.deepEqual(checkCatalogDir(dirWith(files)), []);
  });

  it('fails when fewer than six masteries are present (SC-001)', () => {
    const errors = checkCatalogDir(dirWith({ 'soldier.json': tree(VALID) }));
    assert.ok(
      errors.some((e) => /6 maestrías/.test(e)),
      errors.join('\n'),
    );
  });

  it('fails on a missing directory and on invalid JSON', () => {
    assert.ok(checkCatalogDir(join(tmpdir(), 'no-such-mastery-dir')).length > 0);
    const dir = mkdtempSync(join(tmpdir(), 'mastery-catalog-'));
    tempDirs.push(dir);
    writeFileSync(join(dir, 'soldier.json'), '{ not json');
    assert.ok(checkCatalogDir(dir).some((e) => /soldier\.json/.test(e) && /JSON/.test(e)));
  });

  it('passes with the real versioned catalog', () => {
    assert.deepEqual(checkCatalogDir(REAL_DIR), []);
  });
});

describe('splitCatalog', () => {
  it('writes one file per mastery slug', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mastery-split-'));
    tempDirs.push(dir);
    const json = JSON.stringify([tree(VALID), tree(VALID, { id: 'class02', slug: 'demolition' })]);
    assert.deepEqual(splitCatalog(json, dir), ['demolition.json', 'soldier.json']);
    assert.deepEqual(readdirSync(dir).sort(), ['demolition.json', 'soldier.json']);
  });
});

describe('pnpm catalog:nodes (CLI)', () => {
  it('exits 0 on the real catalog and non-zero on a broken copy', () => {
    const ok = spawnSync('pnpm', ['exec', 'tsx', SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: true,
    });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const dir = dirWith({
      'soldier.json': tree([{ id: 'a', tier: 1, row: 0, parent: 'nope' }]),
    });
    const bad = spawnSync('pnpm', ['exec', 'tsx', SCRIPT, '--dir', dir], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: true,
    });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stdout + bad.stderr, /padre inexistente/);
  });
});
