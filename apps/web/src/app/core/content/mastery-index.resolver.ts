import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID, TransferState } from '@angular/core';
import { MASTERY_CATALOG, MASTERY_INDEX_STATE, type MasterySummary } from './masteries';

/**
 * `/maestrias` resolver. On the server it reads the active catalog (fixtures locally, the API in
 * release) and leaves the summaries in `TransferState`; in the browser it only reads that
 * snapshot. A catalog failure rejects, so the prerender fails instead of emitting an empty index.
 */
export async function resolveMasteryIndex(): Promise<readonly MasterySummary[]> {
  const state = inject(TransferState);
  const catalog = isPlatformServer(inject(PLATFORM_ID)) ? inject(MASTERY_CATALOG) : null;
  if (!catalog) return state.get(MASTERY_INDEX_STATE, []);
  const summaries = await catalog.listSummaries();
  state.set(MASTERY_INDEX_STATE, summaries);
  return summaries;
}
