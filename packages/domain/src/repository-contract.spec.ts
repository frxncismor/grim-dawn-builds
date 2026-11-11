import {
  BuildSchema,
  PublicBuildSchema,
  PublicAuthorSchema,
  PublicSourceSchema,
  PublicTierListSchema,
  publicFilter,
  type Build,
  type BuildInput,
  type PublicBuild,
} from './index.js';
import {
  runContentRepositoryContract,
  type ContentRepositoryPort,
  type ContractOptions,
  type ContractCollections,
} from '../testing/repository-contract.js';

/**
 * Pure in-memory reference adapter. Runs the shared ContentRepository contract (T-063)
 * without Angular, file system or HTTP, so the domain test command covers the contract
 * on its own. The web's FileContentRepository runs the same suite in src/app/core/content.
 */
class InMemoryContentRepository implements ContentRepositoryPort {
  private readonly builds: readonly Build[];
  private readonly visible: (build: Build) => boolean;

  constructor(
    docs: readonly BuildInput[],
    private readonly options: ContractOptions,
    private readonly collections?: ContractCollections,
  ) {
    const filter = publicFilter(options.includeDrafts);
    this.visible = (build) =>
      filter(build) && (options.includeDrafts || build.rights_status !== 'link_only');
    this.builds = docs
      .map((doc) => BuildSchema.parse(doc))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async listBuilds(): Promise<readonly (Build | PublicBuild)[]> {
    return this.builds.filter(this.visible).map((build) => this.result(build));
  }

  async findBuild(slug: string): Promise<Build | PublicBuild | null> {
    const build = this.builds.find((b) => b.slug === slug && this.visible(b));
    return build ? this.result(build) : null;
  }

  async listSlugs(): Promise<readonly string[]> {
    return (await this.listBuilds()).map((b) => b.slug);
  }

  async getAuthor(slug: string) {
    const author =
      this.collections?.authors.find((item) => item.slug === slug) ??
      this.builds.find((build) => build.author_slug === slug)?.author;
    if (!author) return null;
    if (this.options.includeDrafts) return structuredClone(author);
    const visibleContent =
      this.builds.some((build) => build.author_slug === slug && this.visible(build)) ||
      this.collections?.tierLists.some(
        (tier) => tier.author_slug === slug && tier.review_state === 'publicado',
      );
    return !author.is_placeholder && visibleContent
      ? PublicAuthorSchema.parse(select(author, PublicAuthorSchema))
      : null;
  }

  async getTierList(slug: string) {
    const tier = this.collections?.tierLists.find((tier) => tier.slug === slug);
    if (!tier) return null;
    if (this.options.includeDrafts) return structuredClone(tier);
    if (tier.review_state !== 'publicado') return null;
    const visibleBuilds = new Set(this.builds.filter(this.visible).map((build) => build.slug));
    const entries = tier.entries.filter(
      (entry) =>
        publicFilter(false)(entry) && (!entry.build_slug || visibleBuilds.has(entry.build_slug)),
    );
    const sourceSlugs = new Set(entries.map((entry) => entry.source_slug));
    return PublicTierListSchema.parse({
      ...select(tier, PublicTierListSchema),
      entries,
      sources: tier.sources
        .filter((source) => sourceSlugs.has(source.slug))
        .map((source) => select(source, PublicSourceSchema)),
    });
  }

  private result(build: Build): Build | PublicBuild {
    if (this.options.includeDrafts) return structuredClone(build);
    return PublicBuildSchema.parse({
      ...select(build, PublicBuildSchema),
      author: select(build.author, PublicAuthorSchema),
      sources: build.sources.map((source) => select(source, PublicSourceSchema)),
    });
  }
}

function select(value: object, schema: { shape: object }): object {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => Object.hasOwn(schema.shape, key)),
  );
}

runContentRepositoryContract(
  'in-memory reference',
  (docs, options, collections) => new InMemoryContentRepository(docs, options, collections),
  { localDrafts: true },
);
