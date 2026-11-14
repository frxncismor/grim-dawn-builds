import { z } from 'zod';
import { PublicMasteryTreeSchema, type PublicMasteryTree } from '@gd/domain';

/** Opaque on purpose: never carries row values, SQL or schema issues (constitution §XI). */
export class InvalidCatalogError extends Error {
  constructor() {
    super('invalid_catalog');
    this.name = 'InvalidCatalogError';
  }
}

/** Columns of `v_public_mastery_trees` (no audit timestamps). */
export interface MasteryTreeRow {
  id: string;
  slug: string;
  name_en: string;
  name_es: string;
  game_version: string;
  source_sha256: string[];
}
/** Columns of `v_public_skill_nodes` (no audit timestamps). */
export interface SkillNodeRow {
  id: string;
  mastery_id: string;
  name_en: string;
  name_es: string;
  kind: string;
  circular: boolean;
  tier: number;
  bar_required: number;
  grid_col: number;
  grid_row: number;
  max_points: number;
  ultimate_points: number | null;
  parent_id: string | null;
}

const mastery = PublicMasteryTreeSchema.shape.mastery;
/** Public list entry: one mastery with its node count. */
export const MasterySummarySchema = z
  .object({
    id: mastery.shape.id,
    slug: mastery.shape.slug,
    name: mastery.shape.name,
    game_version: PublicMasteryTreeSchema.shape.game_version,
    node_count: z.number().int().nonnegative(),
  })
  .strict();
export type MasterySummary = z.infer<typeof MasterySummarySchema>;

/** Rows are projected field by field, so nothing outside the DTO can pass through. */
export function mapMasteryTree(
  tree: MasteryTreeRow,
  nodes: readonly SkillNodeRow[],
): PublicMasteryTree {
  const result = PublicMasteryTreeSchema.safeParse({
    mastery: { id: tree.id, slug: tree.slug, name: { en: tree.name_en, es: tree.name_es } },
    game_version: tree.game_version,
    source: { game_version: tree.game_version, sha256: tree.source_sha256 },
    nodes: nodes.map((n) => ({
      id: n.id,
      name: { en: n.name_en, es: n.name_es },
      kind: n.kind,
      circular: n.circular,
      tier: n.tier,
      bar_required: n.bar_required,
      max_points: n.max_points,
      ...(n.ultimate_points === null ? {} : { ultimate_points: n.ultimate_points }),
      grid: { col: n.grid_col, row: n.grid_row },
      parent_id: n.parent_id,
    })),
  });
  if (!result.success) throw new InvalidCatalogError();
  return result.data;
}

export function mapMasterySummary(row: MasteryTreeRow & { node_count: number }): MasterySummary {
  const result = MasterySummarySchema.safeParse({
    id: row.id,
    slug: row.slug,
    name: { en: row.name_en, es: row.name_es },
    game_version: row.game_version,
    node_count: row.node_count,
  });
  if (!result.success) throw new InvalidCatalogError();
  return result.data;
}
