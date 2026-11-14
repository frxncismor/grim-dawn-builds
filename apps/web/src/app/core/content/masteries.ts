import { InjectionToken, makeStateKey } from '@angular/core';
import type { MasteryTree } from '@gd/domain';
import type { MasteryPortrait } from './portraits';

/**
 * Read port of the mastery catalog (spec 003). Server only: the browser never opens a data
 * source and receives the tree of its page through `TransferState`.
 */
export interface MasterySummary {
  readonly slug: string;
  /** `null` when the mastery has no readable data (the page shows its slug). */
  readonly name: { readonly en: string; readonly es: string } | null;
  /** Real number of skills of the tree; `0` means "no data". */
  readonly nodeCount: number;
  /** Art for the index row; set by the route resolver on the server (T015), never by the catalog. */
  readonly portrait?: MasteryPortrait;
}

export interface MasteryCatalog {
  /** Slugs of every mastery in the catalog (sorted). */
  listSlugs(): Promise<readonly string[]>;
  /**
   * One summary per mastery for the `/maestrias` index. The local source tolerates a tree that
   * does not load (it is listed with `nodeCount: 0`); the release source reads the API list and
   * fails when it is unavailable.
   */
  listSummaries(): Promise<readonly MasterySummary[]>;
  /** The validated tree, or `null` when the slug does not exist. Failures throw. */
  get(slug: string): Promise<MasteryTree | null>;
}

export const MASTERY_CATALOG = new InjectionToken<MasteryCatalog>('MASTERY_CATALOG');

/** Snapshot of the tree rendered by the page; the browser reads it back on hydration. */
export const MASTERY_TREE_STATE = makeStateKey<MasteryTree | null>('gd-mastery-tree');

/** Snapshot of the index rendered by `/maestrias`; the browser reads it back on hydration. */
export const MASTERY_INDEX_STATE = makeStateKey<readonly MasterySummary[]>('gd-mastery-index');

/**
 * Server-only provider of the portrait of each mastery (`ASSET_SOURCE`, manifest). It is a
 * promise because reading the manifest is async; a rejection fails the prerender.
 */
export const MASTERY_PORTRAITS = new InjectionToken<Promise<(slug: string) => MasteryPortrait>>(
  'MASTERY_PORTRAITS',
);
