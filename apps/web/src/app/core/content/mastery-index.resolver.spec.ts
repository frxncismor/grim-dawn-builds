import { PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MASTERY_CATALOG,
  MASTERY_INDEX_STATE,
  MASTERY_PORTRAITS,
  type MasteryCatalog,
  type MasterySummary,
} from './masteries';
import { resolveMasteryIndex } from './mastery-index.resolver';

const summaries: MasterySummary[] = [
  { slug: 'shaman', name: { en: 'Shaman', es: 'Chamán' }, nodeCount: 30 },
  { slug: 'soldier', name: null, nodeCount: 0 },
];
const run = () => TestBed.runInInjectionContext(() => resolveMasteryIndex());

describe('mastery index resolver', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('on the server reads the catalog summaries and leaves them in TransferState', async () => {
    const listSummaries = vi.fn(async () => summaries);
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: MASTERY_CATALOG, useValue: { listSummaries } satisfies Partial<MasteryCatalog> },
      ],
    });
    expect(await run()).toEqual(summaries);
    expect(TestBed.inject(TransferState).get(MASTERY_INDEX_STATE, [])).toEqual(summaries);
  });

  it('on the server a catalog failure rejects so the build fails instead of an empty index', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: MASTERY_CATALOG,
          useValue: {
            listSummaries: async () => {
              throw new Error('Catálogo de maestrías no disponible o respuesta inválida.');
            },
          },
        },
      ],
    });
    await expect(run()).rejects.toThrow('no disponible');
  });

  it('in the browser only reads the transferred snapshot and needs no catalog', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    TestBed.inject(TransferState).set(MASTERY_INDEX_STATE, summaries);
    expect(await run()).toEqual(summaries);
  });

  it('on the server attaches the portrait of each mastery and transfers it with the summaries', async () => {
    const portrait = (slug: string) => ({
      source: 'game' as const,
      src: `assets/portraits/${slug}.png`,
      width: 197,
      height: 41,
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: MASTERY_PORTRAITS, useValue: Promise.resolve(portrait) },
        {
          provide: MASTERY_CATALOG,
          useValue: { listSummaries: async () => summaries } satisfies Partial<MasteryCatalog>,
        },
      ],
    });
    const expected = summaries.map((item) => ({ ...item, portrait: portrait(item.slug) }));
    expect(await run()).toEqual(expected);
    expect(TestBed.inject(TransferState).get(MASTERY_INDEX_STATE, [])).toEqual(expected);
  });

  it('on the server a portrait failure rejects so an invalid ASSET_SOURCE fails the build', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: MASTERY_PORTRAITS,
          useFactory: () => Promise.reject(new Error('Retrato de maestría inválido.')),
        },
        {
          provide: MASTERY_CATALOG,
          useValue: { listSummaries: async () => summaries } satisfies Partial<MasteryCatalog>,
        },
      ],
    });
    await expect(run()).rejects.toThrow('Retrato');
  });
});
