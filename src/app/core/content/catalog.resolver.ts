import { inject, makeStateKey, TransferState } from '@angular/core';
import type { CatalogInput, CatalogSnapshot } from '../../features/tier-list/catalog.model';

export const CATALOG_STATE = makeStateKey<CatalogInput | null>('gd-public-catalog');
/** Every prerendered document carries this public snapshot; browser never opens a data source. */
export function resolveCatalog(): Promise<CatalogSnapshot> {
  const catalog = inject(TransferState).get(CATALOG_STATE, null);
  if (!catalog) throw new Error('Falta el catálogo prerenderizado.');
  return import('../../features/tier-list/catalog.model').then((m) => m.buildCatalog(catalog));
}
