import { describe, expect, it } from 'vitest';
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
  constructor(private readonly docs: unknown[]) {}
  async readBuilds(): Promise<unknown[]> {
    this.reads++;
    return this.docs;
  }
}

describe('FileContentRepository public visibility', () => {
  it('lists only publicado builds with approved rights by default', async () => {
    const repo = new FileContentRepository(
      new CountingSource([draft('borrador-a'), published('publica-b')]),
      { includeDrafts: false },
    );
    const slugs = (await repo.listBuilds()).map((b) => b.slug);
    expect(slugs).toEqual(['publica-b']);
  });

  it('never returns a pending build from findBuild in public mode', async () => {
    const repo = new FileContentRepository(new CountingSource([draft('guia')]), {
      includeDrafts: false,
    });
    expect(await repo.findBuild('guia')).toBeNull();
  });

  it('returns drafts, including pending rights, when includeDrafts is set', async () => {
    const repo = new FileContentRepository(new CountingSource([draft('guia')]), {
      includeDrafts: true,
    });
    expect((await repo.findBuild('guia'))?.rights_status).toBe('pending');
    expect((await repo.listBuilds()).map((b) => b.slug)).toEqual(['guia']);
  });
});

describe('FileContentRepository loading', () => {
  it('fails fast with the slug when a document is invalid', async () => {
    const repo = new FileContentRepository(
      new CountingSource([draft('roto', { rights_status: 'unknown' })]),
      { includeDrafts: true },
    );
    await expect(repo.listBuilds()).rejects.toThrow(/roto.*rights_status/);
  });

  it('returns builds sorted by slug for deterministic output', async () => {
    const repo = new FileContentRepository(
      new CountingSource([published('zeta'), published('alfa')]),
      { includeDrafts: false },
    );
    expect((await repo.listBuilds()).map((b) => b.slug)).toEqual(['alfa', 'zeta']);
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
