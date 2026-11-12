import { TestBed } from '@angular/core/testing';
import { TransferState } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_STATE, resolveCatalog } from './catalog.resolver';
import { buildCatalog } from '../../features/tier-list/catalog.model';
import { input } from '../../features/tier-list/catalog.test-data';
describe('public catalog transfer state resolver', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('consumes and preserves the snapshot for later SPA navigation', async () => {
    const model = buildCatalog(input);
    const state = TestBed.inject(TransferState);
    state.set(CATALOG_STATE, input);
    expect(await TestBed.runInInjectionContext(resolveCatalog)).toEqual(model);
    expect(await TestBed.runInInjectionContext(resolveCatalog)).toEqual(model);
  });
  it('fails without a snapshot instead of querying an API or files', () => {
    expect(() => TestBed.runInInjectionContext(resolveCatalog)).toThrow(
      'Falta el catálogo prerenderizado.',
    );
  });
});
