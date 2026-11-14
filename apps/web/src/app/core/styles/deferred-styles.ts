import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/** Emitted by `apps/web/tools/emit-deferred-styles.mts` into the artifact (T033). */
export const DEFERRED_STYLES_HREF = '/assets/deferred.css';

/**
 * Components inside `@defer` blocks are created in the browser; their inline `<style>` would be
 * blocked by the CSP (`style-src 'self'` plus hashes). Their CSS is therefore a stylesheet of the
 * site itself, linked from the head by the pages that use those components. It is idempotent and
 * also runs on the server, so the prerendered HTML already carries the link.
 */
@Injectable({ providedIn: 'root' })
export class DeferredStyles {
  private readonly document = inject(DOCUMENT);

  ensure(): void {
    const head = this.document.head;
    if (head.querySelector('link[data-gd-deferred-styles]')) return;
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', DEFERRED_STYLES_HREF);
    link.setAttribute('data-gd-deferred-styles', '');
    head.appendChild(link);
  }
}
