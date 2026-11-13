import { PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, type ActivatedRouteSnapshot } from '@angular/router';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import demolitionRaw from '../../../../../../fixtures/content/mastery-trees/demolition.json';
import { MASTERY_CATALOG, MASTERY_TREE_STATE, type MasteryCatalog } from './masteries';
import { resolveMastery } from './mastery.resolver';

const demolition: MasteryTree = MasteryTreeSchema.parse(demolitionRaw);
const route = (slug: string) =>
  ({ paramMap: convertToParamMap({ slug }) }) as ActivatedRouteSnapshot;
const run = (slug: string) => TestBed.runInInjectionContext(() => resolveMastery(route(slug)));

describe('mastery tree resolver', () => {
  afterEach(() => TestBed.resetTestingModule());

  function server(catalog: Partial<MasteryCatalog>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: MASTERY_CATALOG, useValue: catalog },
      ],
    });
  }

  it('on the server reads the catalog and leaves the tree in TransferState', async () => {
    const get = vi.fn(async () => demolition);
    server({ get });
    expect(await run('demolition')).toEqual(demolition);
    expect(get).toHaveBeenCalledWith('demolition');
    expect(TestBed.inject(TransferState).get(MASTERY_TREE_STATE, null)).toEqual(demolition);
  });

  it('on the server a missing slug is a null page (404), not an error', async () => {
    server({ get: async () => null });
    expect(await run('missing')).toBeNull();
    expect(TestBed.inject(TransferState).get(MASTERY_TREE_STATE, undefined)).toBeNull();
  });

  it('on the server a catalog failure (503) rejects so the build fails instead of rendering an empty page', async () => {
    server({
      get: async () => {
        throw new Error('Catálogo de maestrías no disponible o respuesta inválida.');
      },
    });
    await expect(run('demolition')).rejects.toThrow('no disponible');
  });

  it('never queries the catalog for a malformed slug', async () => {
    const get = vi.fn();
    server({ get });
    for (const slug of ['../x', 'Demolition', 'a/b', '']) expect(await run(slug)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('in the browser only reads the transferred snapshot and needs no catalog', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    TestBed.inject(TransferState).set(MASTERY_TREE_STATE, demolition);
    expect(await run('demolition')).toEqual(demolition);
    expect(await run('soldier')).toBeNull();
  });
});
