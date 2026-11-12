/** Input node of a parent-linked forest (e.g. one mastery tree of a build). */
export interface GraphNode {
  id: string;
  parentId: string | null;
  /** Sibling order; ties fall back to id so the result is deterministic. */
  order: number;
}

export interface PlacedNode {
  id: string;
  parentId: string | null;
  level: number;
  /** Position in preorder; rows never overlap. */
  row: number;
  x: number;
  y: number;
}

export interface Edge {
  from: string;
  to: string;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: Edge[];
}

export const LEVEL_WIDTH = 48;
export const ROW_HEIGHT = 40;

/**
 * Lays a forest out as an indented, top-to-bottom tree: depth maps to x, preorder maps to y.
 * Pure and deterministic. Throws on unknown parents, duplicated ids and cycles.
 */
export function layoutForest(nodes: readonly GraphNode[]): Layout {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`id duplicado: ${node.id}`);
    ids.add(node.id);
  }

  const childrenOf = new Map<string | null, GraphNode[]>();
  for (const node of nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) {
      throw new Error(`padre desconocido: ${node.parentId}`);
    }
    const siblings = childrenOf.get(node.parentId) ?? [];
    siblings.push(node);
    childrenOf.set(node.parentId, siblings);
  }
  for (const siblings of childrenOf.values()) {
    siblings.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  const placed: PlacedNode[] = [];
  const edges: Edge[] = [];
  const visit = (node: GraphNode, level: number): void => {
    const row = placed.length;
    placed.push({
      id: node.id,
      parentId: node.parentId,
      level,
      row,
      x: level * LEVEL_WIDTH,
      y: row * ROW_HEIGHT,
    });
    for (const child of childrenOf.get(node.id) ?? []) {
      edges.push({ from: node.id, to: child.id });
      visit(child, level + 1);
    }
  };
  for (const root of childrenOf.get(null) ?? []) visit(root, 0);

  if (placed.length !== nodes.length) {
    throw new Error('ciclo de padres: hay nodos no alcanzables desde una raíz');
  }
  return { nodes: placed, edges };
}
