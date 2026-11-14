import { InjectionToken } from '@angular/core';
import type { MasteryTree, PublicBuild, SkillKind } from '@gd/domain';

/**
 * Own static files of the site (plan 003, decision 9; T017): `scripts/emit-mastery-trees.mts`
 * writes them into the artifact from the catalog. They are same-origin (`connect-src 'self'`);
 * the browser never calls the API or a third party for them.
 */
export const MASTERY_TREES_BASE = '/assets/mastery-trees/';
const TIMEOUT_MS = 8000;
const KINDS: readonly SkillKind[] = ['active', 'passive', 'modifier', 'transmuter'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PREFIX = /^([^/]+)\/.+$/;

type SkillNode = PublicBuild['skill_nodes'][number];

export interface MasteryTreeAssets {
  /** Trees by mastery id (`class06`). Rejects if any file is missing or invalid. */
  load(masteryIds: readonly string[]): Promise<ReadonlyMap<string, MasteryTree>>;
}

/**
 * The mastery id a guide mastery draws on: every node must reference the catalog and all
 * references must share one mastery (`class06/...`). Otherwise `null` and the guide mode stays.
 */
export function assignmentMasteryId(nodes: readonly SkillNode[]): string | null {
  if (nodes.length === 0) return null;
  const prefixes = new Set<string>();
  for (const node of nodes) {
    const prefix = node.skill_node_id ? ID_PREFIX.exec(node.skill_node_id)?.[1] : undefined;
    if (!prefix) return null;
    prefixes.add(prefix);
  }
  return prefixes.size === 1 ? [...prefixes][0] : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isName = (value: unknown): boolean =>
  isRecord(value) && typeof value['en'] === 'string' && typeof value['es'] === 'string';
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

/** Structural check of what the component reads; the build already validated the full schema. */
function isMasteryTree(value: unknown, slug: string): value is MasteryTree {
  if (!isRecord(value) || !isRecord(value['mastery']) || !Array.isArray(value['nodes']))
    return false;
  const mastery = value['mastery'];
  if (mastery['slug'] !== slug || typeof mastery['id'] !== 'string' || !isName(mastery['name']))
    return false;
  const nodes = value['nodes'] as unknown[];
  if (nodes.length === 0) return false;
  return nodes.every(
    (node) =>
      isRecord(node) &&
      typeof node['id'] === 'string' &&
      isName(node['name']) &&
      KINDS.includes(node['kind'] as SkillKind) &&
      typeof node['circular'] === 'boolean' &&
      isCount(node['tier']) &&
      isCount(node['bar_required']) &&
      isCount(node['max_points']) &&
      (node['parent_id'] === null || typeof node['parent_id'] === 'string') &&
      isRecord(node['grid']) &&
      isCount(node['grid']['col']) &&
      isCount(node['grid']['row']),
  );
}

export function createMasteryTreeAssets(request: typeof fetch): MasteryTreeAssets {
  const cache = new Map<string, Promise<unknown>>();

  async function read(name: string): Promise<unknown> {
    const response = await request(`${MASTERY_TREES_BASE}${name}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : null,
    });
    if (response.status !== 200) throw new Error('mastery-trees');
    return response.json();
  }
  const once = (name: string): Promise<unknown> => {
    let pending = cache.get(name);
    if (!pending) {
      pending = read(name);
      cache.set(name, pending);
      pending.catch(() => cache.delete(name));
    }
    return pending;
  };

  return {
    async load(masteryIds) {
      const index = await once('index.json');
      const result = new Map<string, MasteryTree>();
      await Promise.all(
        masteryIds.map(async (id) => {
          const slug = isRecord(index) ? index[id] : undefined;
          if (typeof slug !== 'string' || !SLUG.test(slug)) throw new Error('mastery-trees');
          const tree = await once(`${slug}.json`);
          if (!isMasteryTree(tree, slug) || tree.mastery.id !== id)
            throw new Error('mastery-trees');
          result.set(id, tree);
        }),
      );
      return result;
    },
  };
}

export const MASTERY_TREE_ASSETS = new InjectionToken<MasteryTreeAssets>('MASTERY_TREE_ASSETS', {
  providedIn: 'root',
  factory: () => createMasteryTreeAssets((input, init) => globalThis.fetch(input, init)),
});
