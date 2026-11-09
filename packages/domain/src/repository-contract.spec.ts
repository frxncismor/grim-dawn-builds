import { BuildSchema, publicFilter, type Build, type BuildInput } from './index';
import {
  runContentRepositoryContract,
  type ContentRepositoryPort,
  type ContractOptions,
} from '../testing/repository-contract';

/**
 * Pure in-memory reference adapter. Runs the shared ContentRepository contract (T-063)
 * without Angular, file system or HTTP, so the domain test command covers the contract
 * on its own. The web's FileContentRepository runs the same suite in src/app/core/content.
 */
class InMemoryContentRepository implements ContentRepositoryPort {
  private readonly builds: readonly Build[];
  private readonly visible: (build: Build) => boolean;

  constructor(docs: readonly BuildInput[], options: ContractOptions) {
    this.visible = publicFilter(options.includeDrafts);
    this.builds = docs
      .map((doc) => BuildSchema.parse(doc))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async listBuilds(): Promise<readonly Build[]> {
    return this.builds.filter(this.visible);
  }

  async findBuild(slug: string): Promise<Build | null> {
    return this.builds.find((b) => b.slug === slug && this.visible(b)) ?? null;
  }

  async listSlugs(): Promise<readonly string[]> {
    return (await this.listBuilds()).map((b) => b.slug);
  }
}

runContentRepositoryContract(
  'in-memory reference',
  (docs, options) => new InMemoryContentRepository(docs, options),
);
