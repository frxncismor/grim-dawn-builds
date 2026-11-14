import { DOCUMENT, isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID, TransferState } from '@angular/core';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { MASTERY_INDEX_STATE, MASTERY_TREE_STATE } from './masteries';

/**
 * The mastery pages are prerendered and their data travels in `TransferState` of that document:
 * the browser never opens the catalog. A client-side navigation from another page (the index to a
 * mastery, or back) therefore finds no snapshot and would render a false 404 or an empty list.
 * When the running document does not carry what the target needs, the target is a full document
 * navigation to its prerendered HTML. The initial navigation never redirects, so a missing
 * snapshot cannot cause a reload loop; the page keeps raising its own 404.
 */
function loadDocument(state: RouterStateSnapshot): false {
  const document = inject(DOCUMENT);
  document.location.assign(new URL(state.url.replace(/^\//, ''), document.baseURI).href);
  return false;
}

/** Guard of `/maestrias/:slug`: needs the snapshot of that same mastery. */
export function ensureMasteryTree(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  const snapshot = inject(TransferState).get(MASTERY_TREE_STATE, null);
  if (snapshot && snapshot.mastery.slug === route.paramMap.get('slug')) return true;
  if (!inject(Router).getCurrentNavigation()?.previousNavigation) return true;
  return loadDocument(state);
}

/** Guard of `/maestrias`: needs the index snapshot. */
export function ensureMasteryIndex(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  if (inject(TransferState).hasKey(MASTERY_INDEX_STATE)) return true;
  if (!inject(Router).getCurrentNavigation()?.previousNavigation) return true;
  return loadDocument(state);
}
