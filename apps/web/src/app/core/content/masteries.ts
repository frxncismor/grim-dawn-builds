import { InjectionToken, makeStateKey } from '@angular/core';
import type { MasteryTree } from '@gd/domain';

/**
 * Read port of the mastery catalog (spec 003). Server only: the browser never opens a data
 * source and receives the tree of its page through `TransferState`.
 */
export interface MasteryCatalog {
  /** Slugs of every mastery in the catalog (sorted). */
  listSlugs(): Promise<readonly string[]>;
  /** The validated tree, or `null` when the slug does not exist. Failures throw. */
  get(slug: string): Promise<MasteryTree | null>;
}

export const MASTERY_CATALOG = new InjectionToken<MasteryCatalog>('MASTERY_CATALOG');

/** Snapshot of the tree rendered by the page; the browser reads it back on hydration. */
export const MASTERY_TREE_STATE = makeStateKey<MasteryTree | null>('gd-mastery-tree');
