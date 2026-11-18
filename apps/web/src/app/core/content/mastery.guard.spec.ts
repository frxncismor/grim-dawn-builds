import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  convertToParamMap,
  Router,
  type ActivatedRouteSnapshot,
  type Navigation,
  type RouterStateSnapshot,
} from '@angular/router';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import demolitionRaw from '../../../../../../fixtures/content/mastery-trees/demolition.json';
import { MASTERY_INDEX_STATE, MASTERY_TREE_STATE, type MasterySummary } from './masteries';
import { ensureMasteryIndex, ensureMasteryTree } from './mastery.guard';

const demolition: MasteryTree = MasteryTreeSchema.parse(demolitionRaw);
const summaries: MasterySummary[] = [
  { slug: 'demolition', name: { en: 'Demolitionist', es: 'Demoledor' }, nodeCount: 33 },
];
const route = (slug?: string) =>
  ({ paramMap: convertToParamMap(slug ? { slug } : {}) }) as ActivatedRouteSnapshot;
const target = (url: string) => ({ url }) as RouterStateSnapshot;
const tree = (slug: string, url = `/maestrias/${slug}`) =>
  TestBed.runInInjectionContext(() => ensureMasteryTree(route(slug), target(url)));
const index = (url = '/maestrias') =>
  TestBed.runInInjectionContext(() => ensureMasteryIndex(route(), target(url)));

describe('mastery guards (SPA navigation needs the prerendered document)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function configure(options: {
    server?: boolean;
    previous?: boolean;
    assign?: (url: string) => void;
  }) {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: options.server ? 'server' : 'browser' },
        {
          provide: DOCUMENT,
          useValue: new Proxy(document, {
            get(base, key) {
              if (key === 'baseURI') return 'https://example.test/es/';
              if (key === 'location') return { assign: options.assign ?? (() => undefined) };
              const value = Reflect.get(base, key) as unknown;
              return typeof value === 'function' ? value.bind(base) : value;
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

  it('lets the server through: it reads the catalog in the resolver', () => {
    configure({ server: true, previous: true });
    expect(tree('demolition')).toBe(true);
    expect(index()).toBe(true);
  });

  it('tree: a document that carries that mastery lets the navigation through', () => {
    const assign = vi.fn();
    configure({ assign, previous: true });
    TestBed.inject(TransferState).set(MASTERY_TREE_STATE, demolition);
    expect(tree('demolition')).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('tree: SPA navigation to a mastery the running document does not carry loads its prerendered page', () => {
    const assign = vi.fn();
    configure({ assign, previous: true });
    expect(tree('demolition', '/maestrias/demolition')).toBe(false);
    expect(assign).toHaveBeenCalledWith('https://example.test/es/maestrias/demolition');
    // The snapshot of another mastery does not count either.
    assign.mockClear();
    TestBed.inject(TransferState).set(MASTERY_TREE_STATE, demolition);
    expect(tree('soldier', '/maestrias/soldier')).toBe(false);
    expect(assign).toHaveBeenCalledWith('https://example.test/es/maestrias/soldier');
  });

  it('index: SPA navigation without the index snapshot loads the prerendered page', () => {
    const assign = vi.fn();
    configure({ assign, previous: true });
    expect(index()).toBe(false);
    expect(assign).toHaveBeenCalledWith('https://example.test/es/maestrias');
  });

  it('index: a document that carries the index lets the navigation through', () => {
    const assign = vi.fn();
    configure({ assign, previous: true });
    TestBed.inject(TransferState).set(MASTERY_INDEX_STATE, summaries);
    expect(index()).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('never reloads on the initial navigation (no loop); the page keeps its own 404', () => {
    const assign = vi.fn();
    configure({ assign, previous: false });
    expect(tree('missing')).toBe(true);
    expect(index()).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });
});
