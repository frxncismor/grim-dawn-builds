import { describe, expect, it } from 'vitest';
import { contractDoc } from '@gd/domain/testing';
import { FixtureContentSource } from './fixture-source';
import { FileContentRepository } from './file.repository';

describe('FixtureContentSource', () => {
  it('resolves separate author/source collections and caches one coherent snapshot', async () => {
    const doc = contractDoc('fixture');
    const { author, sources, ...separate } = doc;
    const collections: Record<string, unknown[]> = {
      builds: [separate],
      authors: [author],
      sources,
      'tier-lists': [],
    };
    const reads: string[] = [];
    const source = new FixtureContentSource(async (name) => {
      reads.push(name);
      return collections[name];
    });
    const repo = new FileContentRepository(source, { includeDrafts: true });
    expect(await repo.findBuild('fixture')).toEqual(doc);
    expect(await source.readAuthors()).toEqual([author]);
    expect(await source.readTierLists()).toEqual([]);
    expect(reads.sort()).toEqual(['authors', 'builds', 'sources', 'tier-lists']);
  });

  it('rejects missing resources instead of fabricating attribution', async () => {
    const doc: Record<string, unknown> = { ...contractDoc('fixture') };
    delete doc['author'];
    delete doc['sources'];
    const source = new FixtureContentSource(async (name) => (name === 'builds' ? [doc] : []));
    await expect(source.readBuilds()).rejects.toThrow(/autor.*fixture/i);
  });

  it('does not discard embedded sources to hide an incoherent reference list', async () => {
    const doc = { ...contractDoc('fixture'), source_slugs: [] };
    const source = new FixtureContentSource(async (name) => (name === 'builds' ? [doc] : []));
    await expect(source.readBuilds()).rejects.toThrow(/fuentes.*incoherentes/i);
  });

  it('rejects conflicting nested attribution and duplicate resource slugs', async () => {
    const doc = contractDoc('fixture');
    const source = new FixtureContentSource(async (name) =>
      name === 'builds'
        ? [doc]
        : name === 'authors'
          ? [{ ...doc.author, display_name: 'Otro' }]
          : [],
    );
    await expect(source.readBuilds()).rejects.toThrow(/incoherente/i);
    const duplicates = new FixtureContentSource(async (name) =>
      name === 'sources' ? [doc.sources[0], doc.sources[0]] : [],
    );
    await expect(duplicates.readBuilds()).rejects.toThrow(/duplicado/i);
  });
});
