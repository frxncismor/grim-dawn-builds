import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID, TransferState } from '@angular/core';
import {
  MASTERY_CATALOG,
  MASTERY_INDEX_STATE,
  MASTERY_PORTRAITS,
  type MasterySummary,
} from './masteries';

/**
 * `/maestrias` resolver. On the server it reads the active catalog (fixtures locally, the API in
 * release) and leaves the summaries in `TransferState`; in the browser it only reads that
 * snapshot. Each summary also carries its portrait (`ASSET_SOURCE`, T015). A catalog failure rejects, so the prerender fails instead of emitting an empty index.
 */
export async function resolveMasteryIndex(): Promise<readonly MasterySummary[]> {
  const state = inject(TransferState);
  const catalog = isPlatformServer(inject(PLATFORM_ID)) ? inject(MASTERY_CATALOG) : null;
  if (!catalog) return state.get(MASTERY_INDEX_STATE, []);
  const portraits = inject(MASTERY_PORTRAITS, { optional: true });
  const [listed, portraitOf] = await Promise.all([catalog.listSummaries(), portraits]);
  const summaries = portraitOf
    ? listed.map((item) => ({ ...item, portrait: portraitOf(item.slug) }))
    : listed;
  state.set(MASTERY_INDEX_STATE, summaries);
  return summaries;
}
