import { describe, expect, it } from 'vitest';
import { contractDoc, runContentRepositoryContract } from '@gd/domain/testing';
import { PublicBuildSchema, PublicTierListSchema } from '@gd/domain';
import { FileContentRepository, type RawContentSource } from './file.repository';

const draft = (slug: string, overrides: Record<string, unknown> = {}) =>
  contractDoc(slug, { author_slug: 'por-confirmar', ...overrides });

const published = (slug: string) =>
  draft(slug, {
    review_state: 'publicado',
    rights_status: 'own_original',
    rights_confirmed_by: 'titular',
    rights_confirmed_on: '2026-11-08',
    reviewed_by: 'editor-local',
    published_at: '2026-11-08',
    author_slug: 'autor-real',
  });

class CountingSource implements RawContentSource {
  reads = 0;
  constructor(private readonly docs: readonly unknown[]) {}
  async readBuilds(): Promise<unknown[]> {
    this.reads++;
    return [...this.docs];
  }
}

runContentRepositoryContract(
  'FileContentRepository',
  (docs, options, collections) =>
    new FileContentRepository(
      Object.assign(new CountingSource(docs), {
        readAuthors: async () => [...(collections?.authors ?? [])],
        readTierLists: async () => [...(collections?.tierLists ?? [])],
      }),
      options,
    ),
  { localDrafts: true },
);

describe('FileContentRepository loading (adapter-specific)', () => {
  it('projects complete public guides and nested attribution without editorial fields', async () => {
    const doc = published('alfa');
    doc.rights_notes = 'PRIVATE-NOTE';
    doc.sources[0].permission_ref = 'PRIVATE-PROOF';
    doc.sources[0].notes = 'PRIVATE-SOURCE';
    const repo = new FileContentRepository(new CountingSource([doc]), { includeDrafts: false });
    const build = await repo.findBuild('alfa');
    expect(PublicBuildSchema.safeParse(build).success).toBe(true);
    expect(build?.skill_nodes).toEqual(doc.skill_nodes);
    expect(build?.purchase_steps).toEqual(doc.purchase_steps);
    const json = JSON.stringify(build);
    for (const field of [
      'reviewed_by',
      'rights_confirmed',
      'rights_notes',
      'permission_ref',
      'is_placeholder',
      'PRIVATE-',
    ]) {
      expect(json).not.toContain(field);
    }
    const author = await repo.getAuthor('autor-real');
    expect(author?.display_name).toBe('Autor de fixture');
    expect(author).not.toHaveProperty('is_placeholder');
    expect(await repo.getAuthor('no-existe')).toBeNull();
  });

  it('preserves the entire document only in explicit local draft mode', async () => {
    const doc = draft('local');
    const repo = new FileContentRepository(new CountingSource([doc]), { includeDrafts: true });
    expect(await repo.findBuild('local')).toEqual(doc);
    expect(await repo.getAuthor('por-confirmar')).toEqual(doc.author);
  });

  it('never returns a full link_only body in public mode', async () => {
    const doc = { ...published('enlace'), rights_status: 'link_only' };
    const repo = new FileContentRepository(new CountingSource([doc]), { includeDrafts: false });
    expect(await repo.listSlugs()).toEqual([]);
    expect(await repo.findBuild('enlace')).toBeNull();
    expect(await repo.getAuthor('autor-real')).toBeNull();
  });

  it('rejects fixture use in release, including when drafts are off', () => {
    for (const includeDrafts of [true, false]) {
      expect(
        () =>
          new FileContentRepository(new CountingSource([]), {
            includeDrafts,
            buildMode: 'release',
          }),
      ).toThrow(/release/);
    }
  });

  it('rejects duplicate slugs instead of returning ambiguous content', async () => {
    const repo = new FileContentRepository(new CountingSource([draft('igual'), draft('igual')]), {
      includeDrafts: true,
    });
    await expect(repo.listBuilds()).rejects.toThrow(/duplicado.*igual/);
  });

  it('filters tier entries and projects their sources without leaking hidden guide references', async () => {
    const visible = published('visible');
    const hidden = draft('oculta');
    const baseEntry = {
      entry_kind: 'build_propia',
      combination_slug: 'chaman',
      display_name: 'Fixture',
      build_slug: 'visible',
      tier: 'sin_clasificar',
      content_status: 'sin_verificar',
      rights_status: 'own_original',
      review_state: 'publicado',
      external_url: null,
      external_author: null,
      source_slug: 'guia-fuente',
      evaluated_on: null,
    };
    const tier = {
      slug: 'principal',
      title: 'Catálogo sintético',
      game_version: 'test',
      review_state: 'publicado',
      author_slug: 'autor-real',
      masteries: [
        {
          slug: 'chaman',
          name_es: 'Chamán',
          name_en: 'Shaman',
          accent_token: 'storm',
          fallback_icon: 'chaman',
          asset_slug: null,
        },
      ],
      combinations: [{ slug: 'chaman', mastery_a_slug: 'chaman', mastery_b_slug: null }],
      entries: [baseEntry, { ...baseEntry, build_slug: 'oculta' }],
      sources: visible.sources,
    };
    const source = Object.assign(new CountingSource([visible, hidden]), {
      readTierLists: async () => [tier],
      readAuthors: async () => [visible.author, hidden.author],
    });
    const repo = new FileContentRepository(source, { includeDrafts: false });
    const result = await repo.getTierList('principal');
    expect(PublicTierListSchema.safeParse(result).success).toBe(true);
    expect(result?.entries.map((entry) => entry.build_slug)).toEqual(['visible']);
    expect(JSON.stringify(result)).not.toContain('permission_ref');
    expect(await repo.getTierList('ausente')).toBeNull();
    expect(await repo.getAuthor('por-confirmar')).toBeNull();
    const local = new FileContentRepository(source, { includeDrafts: true });
    expect(await local.getTierList('principal')).toEqual(tier);
  });

  it('fails fast with the slug when a document is invalid', async () => {
    const repo = new FileContentRepository(
      new CountingSource([draft('roto', { rights_status: 'unknown' })]),
      { includeDrafts: true },
    );
    await expect(repo.listBuilds()).rejects.toThrow(/roto.*rights_status/);
  });

  it('rejects a publicado build with pending rights at load time', async () => {
    const repo = new FileContentRepository(
      new CountingSource([draft('ilegal', { review_state: 'publicado' })]),
      { includeDrafts: false },
    );
    await expect(repo.listBuilds()).rejects.toThrow(/ilegal/);
  });

  it('reads and validates the source only once across calls', async () => {
    const source = new CountingSource([published('alfa')]);
    const repo = new FileContentRepository(source, { includeDrafts: false });
    await repo.listBuilds();
    await repo.findBuild('alfa');
    await repo.listBuilds();
    expect(source.reads).toBe(1);
  });
});
