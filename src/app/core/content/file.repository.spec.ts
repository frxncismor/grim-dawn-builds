import { describe, expect, it } from 'vitest';
import { runContentRepositoryContract } from '@gd/domain/testing';
import { FileContentRepository, type RawContentSource } from './file.repository';

const draft = (slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  locale: 'es',
  title: `Build ${slug}`,
  author_slug: 'por-confirmar',
  source_slugs: ['guia-original'],
  game_version: '1.2.x',
  review_state: 'borrador',
  rights_status: 'pending',
  rights_confirmed_by: null,
  rights_confirmed_on: null,
  content_status: 'sin_verificar',
  reviewed_by: null,
  published_at: null,
  skill_nodes: [{ slug: 'golpe-primigenio', bar_required: 5, parent_slug: null }],
  ...overrides,
});

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
  (docs, options) => new FileContentRepository(new CountingSource(docs), options),
);

describe('FileContentRepository loading (adapter-specific)', () => {
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
