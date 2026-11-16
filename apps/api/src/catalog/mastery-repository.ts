import type { PublicMasteryTree } from '@gd/domain';
import type { ContentQuery } from '../content/repository.js';
import {
  InvalidCatalogError,
  MasterySummarySchema,
  mapMasterySummary,
  mapMasteryTree,
  type MasterySummary,
  type MasteryTreeRow,
  type SkillNodeRow,
} from './map-mastery.js';

export interface MasteryCatalogRepository {
  /** One entry per mastery, ordered by slug. Empty when the catalog is not loaded. */
  listTrees(): Promise<MasterySummary[]>;
  /** Full tree by slug, or `null` when it does not exist. Never falls back to fixtures. */
  findTree(slug: string): Promise<PublicMasteryTree | null>;
}

export class CatalogUnavailableError extends Error {
  constructor() {
    super('catalog_unavailable');
    this.name = 'CatalogUnavailableError';
  }
}

// All SQL targets the public views; parameters never form identifiers. Ordering matches the
// extractor: column, row, id (bytewise collation keeps it independent of the DB locale).
const TREE_COLUMNS = 'id, slug, name_en, name_es, game_version, source_sha256';
const LIST_SQL = `SELECT ${TREE_COLUMNS},
  (SELECT count(*)::int FROM v_public_skill_nodes n WHERE n.mastery_id = t.id) AS node_count
  FROM v_public_mastery_trees t ORDER BY slug COLLATE "C"`;
const TREE_SQL = `SELECT ${TREE_COLUMNS} FROM v_public_mastery_trees WHERE slug = $1`;
const NODES_SQL = `SELECT id, mastery_id, name_en, name_es, kind, circular, tier, bar_required,
  grid_col, grid_row, max_points, ultimate_points, parent_id, icon_id
  FROM v_public_skill_nodes WHERE mastery_id = $1
  ORDER BY grid_col, grid_row, id COLLATE "C"`;

export class PostgresMasteryRepository implements MasteryCatalogRepository {
  constructor(private readonly database: ContentQuery) {}

  private async read<T>(sql: string, values: readonly unknown[] = []): Promise<T[]> {
    try {
      return (await this.database.query(sql, values)).rows as T[];
    } catch {
      throw new CatalogUnavailableError();
    }
  }

  async listTrees(): Promise<MasterySummary[]> {
    return (await this.read<MasteryTreeRow & { node_count: number }>(LIST_SQL)).map(
      mapMasterySummary,
    );
  }

  async findTree(slug: string): Promise<PublicMasteryTree | null> {
    // An invalid slug cannot exist in the catalog; same answer as a missing one.
    if (!MasterySummarySchema.shape.slug.safeParse(slug).success) return null;
    const tree = (await this.read<MasteryTreeRow>(TREE_SQL, [slug]))[0];
    if (!tree) return null;
    const nodes = await this.read<SkillNodeRow>(NODES_SQL, [tree.id]);
    return mapMasteryTree(tree, nodes);
  }
}

export { InvalidCatalogError };
