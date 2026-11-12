/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, type ActivatedRouteSnapshot } from '@angular/router';
import { contractDoc } from '@gd/domain/testing';
import type { Build } from '@gd/domain';
import { afterEach, describe, expect, it } from 'vitest';
import draftFixture from '../../../../content/builds/chaman-demoledor-golpe-primigenio.json';
import type { BuildPageContent } from '../../features/build/build.page';
import { BUILD_PAGE_STATE, CONTENT_SOURCE_STATE, resolveBuildPage } from './content.resolvers';
import { FileContentRepository, type RawContentSource } from './file.repository';
import { CONTENT_REPOSITORY, type ContentRepository } from './repository';

const migratedSlug = 'chaman-demoledor-golpe-primigenio';

/** A draft derived from the published fixture, used to exercise the banner and AC-09. */
const pendingDraft = () => ({
  ...draftFixture,
  review_state: 'borrador',
  rights_status: 'pending',
  rights_confirmed_by: null,
  rights_confirmed_on: null,
  reviewed_by: null,
  reviewed_at: null,
  published_at: null,
  author_slug: 'por-confirmar',
  author: {
    slug: 'por-confirmar',
    display_name: 'Autor por confirmar',
    bio: null,
    url: null,
    is_placeholder: true,
  },
  sources: draftFixture.sources.map((source) => ({ ...source, author_name: 'Por confirmar' })),
});

class StaticSource implements RawContentSource {
  constructor(private readonly docs: readonly unknown[]) {}
  async readBuilds(): Promise<unknown[]> {
    return [...this.docs];
  }
}

function fixtureRepository(includeDrafts: boolean, docs: readonly unknown[] = [draftFixture]) {
  return new FileContentRepository(new StaticSource(docs), { includeDrafts });
}

function stubRepository(
  findBuild: ContentRepository['findBuild'],
  slugs: readonly string[] = [],
): ContentRepository {
  return {
    findBuild,
    listBuilds: async () => [],
    listSlugs: async () => slugs,
    getTierList: async () => null,
    getAuthor: async () => null,
  };
}

function routeFor(slug: string): ActivatedRouteSnapshot {
  return { paramMap: convertToParamMap({ slug }) } as unknown as ActivatedRouteSnapshot;
}

interface SetupOptions {
  platform?: 'server' | 'browser';
  repository?: ContentRepository;
  includeDrafts?: boolean;
  snapshot?: BuildPageContent | null;
}

function setup(options: SetupOptions = {}): TransferState {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: options.platform ?? 'server' },
      ...(options.repository
        ? [{ provide: CONTENT_REPOSITORY, useValue: options.repository }]
        : []),
    ],
  });
  const state = TestBed.inject(TransferState);
  if (options.includeDrafts !== undefined)
    state.set(CONTENT_SOURCE_STATE, { source: 'fixture', includeDrafts: options.includeDrafts });
  if (options.snapshot !== undefined) state.set(BUILD_PAGE_STATE, options.snapshot);
  return state;
}

const publishedDoc = () =>
  contractDoc('guia-publica', {
    review_state: 'publicado',
    rights_status: 'licensed',
    rights_confirmed_by: 'titular',
    rights_confirmed_on: '2026-11-08',
    reviewed_by: 'editor-local',
    published_at: '2026-11-08',
    content_status: 'verificado',
  });

const resolve = (slug: string) =>
  TestBed.runInInjectionContext(() => resolveBuildPage(routeFor(slug)));

describe('public build resolver', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('returns the normalized public guide from the server repository and stores it in TransferState', async () => {
    const state = setup({
      repository: fixtureRepository(false, [publishedDoc()]),
      includeDrafts: false,
    });

    const page = await resolve('guia-publica');

    expect(page).not.toBeNull();
    expect(page?.slug).toBe('guia-publica');
    expect(page?.title).toBe('Build guia-publica');
    expect(page?.draft).toBe(false);
    expect(page?.authorIsPlaceholder).toBe(false);
    expect(state.get(BUILD_PAGE_STATE, null)).toEqual(page);
  });

  it('projects only public fields and never copies private evidence to the client snapshot', async () => {
    const doc = publishedDoc();
    doc.rights_notes = 'PRIVATE-NOTE';
    doc.sources[0]!.permission_ref = 'PRIVATE-PROOF';
    doc.sources[0]!.notes = 'PRIVATE-SOURCE';
    setup({ repository: fixtureRepository(false, [doc]), includeDrafts: false });

    const page = await resolve('guia-publica');
    const serialized = JSON.stringify(page);

    expect(page).not.toBeNull();
    for (const field of [
      'rights_notes',
      'rights_confirmed',
      'reviewed_by',
      'permission_ref',
      'is_placeholder',
      'PRIVATE-',
    ])
      expect(serialized).not.toContain(field);
  });

  it('serves the published migrated guide in the public build', async () => {
    const repository = fixtureRepository(false);
    setup({ repository, includeDrafts: false });

    expect(await repository.listSlugs()).toEqual([migratedSlug]);
    const page = await resolve(migratedSlug);
    expect(page).not.toBeNull();
    expect(page?.draft).toBe(false);
    expect(page?.authorIsPlaceholder).toBe(false);
    expect(page?.title).toBe('Chamán + Demoledor');
  });

  it('renders a pending draft as a local draft with banner data when INCLUDE_DRAFTS is enabled', async () => {
    setup({ repository: fixtureRepository(true, [pendingDraft()]), includeDrafts: true });

    const page = await resolve(migratedSlug);

    expect(page).not.toBeNull();
    expect(page?.slug).toBe(migratedSlug);
    expect(page?.draft).toBe(true);
    expect(page?.authorIsPlaceholder).toBe(true);
    expect(page?.title).toBe('Chamán + Demoledor');
    expect(JSON.stringify(page)).not.toContain('rights_notes');
  });

  it('defends AC-09 even if a repository leaks a non-approved guide without local drafts', async () => {
    setup({
      repository: stubRepository(async () => pendingDraft() as unknown as Build),
      includeDrafts: false,
    });

    expect(await resolve(migratedSlug)).toBeNull();
  });

  it('returns null for invalid, incoherent and unknown slugs without touching the repository', async () => {
    let calls = 0;
    setup({
      repository: stubRepository(async () => {
        calls++;
        return null;
      }),
      includeDrafts: false,
    });

    for (const slug of ['Upper', 'with space', '../escape', '', 'guia/otra', 'ñandú'])
      expect(await resolve(slug)).toBeNull();
    expect(calls).toBe(0);

    expect(await resolve('no-existe')).toBeNull();
    expect(calls).toBe(1);
  });

  it('rejects a repository document whose author does not match author_slug', async () => {
    const doc = { ...draftFixture, author: { ...draftFixture.author, slug: 'otro-autor' } };
    setup({
      repository: stubRepository(async () => doc as unknown as Build),
      includeDrafts: true,
    });

    expect(await resolve(migratedSlug)).toBeNull();
  });

  it('reads only TransferState in the browser: no repository, no fetch and no storage', async () => {
    const snapshot = {
      ...draftFixture,
      draft: false,
      authorIsPlaceholder: false,
    } as BuildPageContent;
    setup({ platform: 'browser', snapshot });

    expect(await resolve(migratedSlug)).toEqual(snapshot);
  });

  it('returns null in the browser when the snapshot is missing or belongs to another guide', async () => {
    setup({
      platform: 'browser',
      repository: stubRepository(async () => {
        throw new Error('el navegador no debe consultar el repositorio');
      }),
    });

    expect(await resolve(migratedSlug)).toBeNull();

    setup({
      platform: 'browser',
      repository: stubRepository(async () => {
        throw new Error('el navegador no debe consultar el repositorio');
      }),
      snapshot: { ...draftFixture, slug: 'otra-guia' } as unknown as BuildPageContent,
    });

    expect(await resolve(migratedSlug)).toBeNull();
  });

  it('loads the repository and the domain only on the server, never as static browser imports', async () => {
    const source = await readFile('src/app/core/content/content.resolvers.ts', 'utf8');
    const staticSpecifiers = [
      ...source.matchAll(/(?:^|\n)import\s+(?!type\b)[^;]*?from\s+'([^']+)';/g),
    ].map((match) => match[1]);

    expect(staticSpecifiers).not.toContain('./repository');
    expect(staticSpecifiers).not.toContain('@gd/domain');
    expect(source).toContain("await import('./repository')");
    expect(source).toContain("await import('@gd/domain')");
  });
});
