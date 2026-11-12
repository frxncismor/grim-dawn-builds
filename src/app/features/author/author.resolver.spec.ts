import { TestBed } from '@angular/core/testing';
import { TransferState } from '@angular/core';
import { convertToParamMap, type ActivatedRouteSnapshot } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { AUTHORS_STATE, resolveAuthor } from './author.state';
import { CATALOG_STATE } from '../../core/content/catalog.resolver';
import { input } from '../tier-list/catalog.test-data';
describe('public author snapshot resolver', () => {
  afterEach(() => TestBed.resetTestingModule());
  const route = (slug: string) =>
    ({ paramMap: convertToParamMap({ slug }) }) as ActivatedRouteSnapshot;
  it('joins only referenced guide metadata, preserving snapshots for SPA navigation', () => {
    const state = TestBed.inject(TransferState);
    state.set(CATALOG_STATE, input);
    state.set(AUTHORS_STATE, [
      {
        profile: { slug: 'test-author', display_name: 'Autora', bio: null, url: null },
        guideSlugs: ['tormenta'],
        ownsCatalog: false,
      },
    ]);
    const result = TestBed.runInInjectionContext(() => resolveAuthor(route('test-author')));
    expect(result?.guides.map((g) => g.slug)).toEqual(['tormenta']);
    expect(state.hasKey(AUTHORS_STATE)).toBe(true);
    expect(TestBed.runInInjectionContext(() => resolveAuthor(route('missing')))).toBeNull();
    expect(TestBed.runInInjectionContext(() => resolveAuthor(route('../private')))).toBeNull();
  });
  it('fails without required source snapshots instead of querying a browser API', () => {
    expect(() => TestBed.runInInjectionContext(() => resolveAuthor(route('test')))).toThrow(
      'Faltan los autores prerenderizados.',
    );
  });
});
