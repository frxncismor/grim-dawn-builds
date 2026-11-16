import { isPlatformServer } from '@angular/common';
import { inject, Injector, PLATFORM_ID, TransferState } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';
import type { PublicMasteryTree } from '@gd/domain';
import { MASTERY_CATALOG, MASTERY_SWITCHER_STATE, MASTERY_TREE_STATE } from './masteries';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `/maestrias/:slug` resolver. On the server it reads the active catalog (fixtures locally, the
 * API in release) and leaves the validated tree in `TransferState`; in the browser it only reads
 * that snapshot. A missing slug is `null` (the page renders a 404); a catalog failure rejects, so
 * the prerender fails instead of emitting an empty page.
 */
export async function resolveMastery(
  route: ActivatedRouteSnapshot,
): Promise<PublicMasteryTree | null> {
  const state = inject(TransferState);
  // Captured before any `await`: `inject()` only works in the synchronous injection context.
  const injector = inject(Injector);
  const slug = route.paramMap.get('slug') ?? '';
  if (!SLUG_PATTERN.test(slug)) return null;

  if (!isPlatformServer(inject(PLATFORM_ID))) {
    const snapshot = state.get(MASTERY_TREE_STATE, null);
    return snapshot && snapshot.mastery.slug === slug ? snapshot : null;
  }

  const catalog = injector.get(MASTERY_CATALOG);
  const [tree, listed] = await Promise.all([catalog.get(slug), catalog.listSummaries()]);
  state.set(MASTERY_TREE_STATE, tree);
  // The selector lists the catalog's masteries (spec004 T033); portraits are not needed there.
  state.set(
    MASTERY_SWITCHER_STATE,
    listed.map(({ slug: item, name, nodeCount }) => ({ slug: item, name, nodeCount })),
  );
  return tree;
}
