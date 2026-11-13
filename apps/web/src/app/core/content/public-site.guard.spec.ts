import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  type ActivatedRouteSnapshot,
  type Navigation,
  type RouterStateSnapshot,
} from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTHORS_STATE,
  PUBLIC_SITE_LOADER,
  type PublicSiteData,
} from '../../features/author/author.state';
import { input } from '../../features/tier-list/catalog.test-data';
import { CATALOG_STATE } from './catalog.resolver';
import { ensurePublicSite } from './public-site.guard';

const data: PublicSiteData = {
  catalog: input,
  authors: [
    {
      profile: { slug: 'test-author', display_name: 'Autora', bio: null, url: null },
      guideSlugs: [],
      ownsCatalog: false,
    },
  ],
};
const route = {} as ActivatedRouteSnapshot;
const target = (url: string) => ({ url }) as RouterStateSnapshot;
const run = (url = '/tier-list') =>
  TestBed.runInInjectionContext(() => ensurePublicSite(route, target(url)));

describe('ensurePublicSite guard (T026)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function configure(options: {
    server?: boolean;
    loader?: () => Promise<PublicSiteData>;
    previous?: boolean;
    assign?: (url: string) => void;
  }) {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: options.server ? 'server' : 'browser' },
        ...(options.loader ? [{ provide: PUBLIC_SITE_LOADER, useValue: options.loader }] : []),
        {
          provide: DOCUMENT,
          // The real jsdom document (TransferState reads it) with only the base URI and the
          // navigation replaced.
          useValue: new Proxy(document, {
            get(target, key) {
              if (key === 'baseURI') return 'https://example.test/es/';
              if (key === 'location') return { assign: options.assign ?? (() => undefined) };
              const value = Reflect.get(target, key) as unknown;
              return typeof value === 'function' ? value.bind(target) : value;
            },
          }),
        },
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () =>
              ({ previousNavigation: options.previous ? {} : null }) as unknown as Navigation,
          },
        },
      ],
    });
  }

  it('on the server writes the catalog and authors snapshot, with the loader content', async () => {
    const loader = vi.fn(async () => data);
    configure({ server: true, loader });
    expect(await run()).toBe(true);
    const state = TestBed.inject(TransferState);
    expect(state.get(CATALOG_STATE, null)).toEqual(data.catalog);
    expect(state.get(AUTHORS_STATE, null)).toEqual(data.authors);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('lets a page that already carries the snapshot through without loading or navigating', async () => {
    const assign = vi.fn();
    const loader = vi.fn(async () => data);
    configure({ loader, assign, previous: true });
    const state = TestBed.inject(TransferState);
    state.set(CATALOG_STATE, data.catalog);
    state.set(AUTHORS_STATE, data.authors);
    expect(await run()).toBe(true);
    expect(loader).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('in the browser without the snapshot (SPA navigation from a page that lacks it) loads the prerendered document', async () => {
    const assign = vi.fn();
    configure({ assign, previous: true });
    expect(await run('/tier-list?x=1')).toBe(false);
    expect(assign).toHaveBeenCalledWith('https://example.test/es/tier-list?x=1');
  });

  it('never reloads on the initial navigation (no redirect loop); the page keeps its own error', async () => {
    const assign = vi.fn();
    configure({ assign, previous: false });
    expect(await run()).toBe(true);
    expect(assign).not.toHaveBeenCalled();
    expect(TestBed.inject(TransferState).get(CATALOG_STATE, null)).toBeNull();
  });

  it('on the server a failing loader fails the render instead of producing a page without data', async () => {
    configure({
      server: true,
      loader: async () => {
        throw new Error('No se pudieron preparar los autores públicos.');
      },
    });
    await expect(run()).rejects.toThrow('autores públicos');
  });
});
