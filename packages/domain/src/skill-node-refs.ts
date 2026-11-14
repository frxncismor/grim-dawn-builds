import type { MasteryTree } from './mastery-tree.js';

/** A guide node whose `skill_node_id` does not agree with the catalog (spec 003, US3). */
export interface SkillNodeRefIssue {
  /** Path inside the guide document, e.g. `['skill_nodes', 3, 'skill_node_id']`. */
  path: (string | number)[];
  message: string;
}

interface GuideLike {
  masteries: readonly { slug: string; name_en: string }[];
  skill_nodes: readonly {
    slug: string;
    mastery_slug: string;
    skill_node_id?: string | undefined;
  }[];
}

const norm = (value: string): string => value.trim().toLowerCase();

/**
 * Cross-checks the optional `skill_node_id` of each guide node against the catalog.
 * A guide mastery is matched to a catalog tree by slug or English name (guide slugs are
 * editorial, e.g. `chaman`, catalog slugs follow the game, e.g. `shaman`). Nodes without
 * `skill_node_id` are never validated. Pure: no I/O.
 */
export function validateSkillNodeRefs(
  build: GuideLike,
  catalog: readonly MasteryTree[],
): SkillNodeRefIssue[] {
  const issues: SkillNodeRefIssue[] = [];
  const nodeOwner = new Map<string, string>();
  for (const tree of catalog) for (const n of tree.nodes) nodeOwner.set(n.id, tree.mastery.id);

  build.skill_nodes.forEach((node, index) => {
    const ref = node.skill_node_id;
    if (ref === undefined) return;
    const path = ['skill_nodes', index, 'skill_node_id'];
    const label = `nodo «${node.slug}» (${node.mastery_slug})`;
    const owner = nodeOwner.get(ref);
    if (owner === undefined) {
      issues.push({ path, message: `${label}: «${ref}» no existe en el catálogo` });
      return;
    }
    const mastery = build.masteries.find((m) => m.slug === node.mastery_slug);
    const tree = catalog.find(
      (t) =>
        t.mastery.slug === node.mastery_slug ||
        (mastery !== undefined && norm(t.mastery.name.en) === norm(mastery.name_en)),
    );
    if (tree === undefined) {
      issues.push({
        path,
        message: `${label}: la maestría del nodo está sin árbol en el catálogo`,
      });
    } else if (tree.mastery.id !== owner) {
      issues.push({
        path,
        message: `${label}: «${ref}» pertenece a otra maestría (${owner}), no a ${tree.mastery.id}`,
      });
    }
  });
  return issues;
}
