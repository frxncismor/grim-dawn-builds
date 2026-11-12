import type { Layout } from './layout';

export type NavKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Returns a pure resolver: given the focused node id and a key, returns the id to focus,
 * or null when the key does not move focus. Follows the WAI-ARIA tree pattern.
 */
export function createKeyboardNav(
  layout: Layout,
): (focusedId: string, key: string) => string | null {
  const rows = [...layout.nodes].sort((a, b) => a.row - b.row);
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const firstChildOf = new Map<string, string>();
  for (const edge of layout.edges) {
    if (!firstChildOf.has(edge.from)) firstChildOf.set(edge.from, edge.to);
  }

  return (focusedId, key) => {
    const current = byId.get(focusedId);
    if (!current) return null;
    const index = rows.indexOf(current);

    switch (key as NavKey) {
      case 'ArrowDown':
        return rows[index + 1]?.id ?? null;
      case 'ArrowUp':
        return index > 0 ? rows[index - 1].id : null;
      case 'ArrowRight':
        return firstChildOf.get(focusedId) ?? null;
      case 'ArrowLeft':
        return current.parentId;
      case 'Home':
        return rows[0]?.id ?? null;
      case 'End':
        return rows[rows.length - 1]?.id ?? null;
      default:
        return null;
    }
  };
}
