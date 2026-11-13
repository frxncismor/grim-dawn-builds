import { DOCUMENT } from '@angular/common';
import { inject, TransferState } from '@angular/core';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { AUTHORS_STATE, PUBLIC_SITE_LOADER } from '../../features/author/author.state';
import { CATALOG_STATE } from './catalog.resolver';

/**
 * `canActivate` of the routes that read the public catalog + authors snapshot (`/`, `/acerca`,
 * `/tier-list`, `/autores/:slug`). Only those pages carry it in `ng-state`: the server loader
 * writes it here, not in the global app initializer, so every other page (mastery trees, guides,
 * 404) keeps its HTML under the §6 budget.
 *
 * In the browser the snapshot is only there if the document that is running already carried it.
 * Coming from a page that does not (for example a mastery tree), the target is a full document
 * navigation to its prerendered HTML. The initial navigation never redirects, so a missing
 * snapshot cannot cause a reload loop; the page keeps raising its own error.
 */
export async function ensurePublicSite(
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Promise<boolean> {
  // Captured before any `await`: `inject()` only works in the synchronous injection context.
  const transfer = inject(TransferState);
  const load = inject(PUBLIC_SITE_LOADER, { optional: true });
  const document = inject(DOCUMENT);
  const router = inject(Router);

  if (transfer.hasKey(CATALOG_STATE) && transfer.hasKey(AUTHORS_STATE)) return true;
  if (load) {
    const data = await load();
    transfer.set(CATALOG_STATE, data.catalog);
    transfer.set(AUTHORS_STATE, data.authors);
    return true;
  }
  if (!router.getCurrentNavigation()?.previousNavigation) return true;
  document.location.assign(new URL(state.url.replace(/^\//, ''), document.baseURI).href);
  return false;
}
