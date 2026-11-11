import {
  AuthorSchema,
  BuildSchema,
  PublicAuthorSchema,
  PublicBuildSchema,
  PublicSourceSchema,
  PublicTierListSchema,
  TierListSchema,
  publicFilter,
  type Author,
  type Build,
  type TierList,
} from '@gd/domain';
import type {
  ContentRepository,
  RepositoryAuthor,
  RepositoryBuild,
  RepositoryTierList,
} from './repository';

/** Optional collections support isolated fixtures; the disk source supplies all collections. */
export interface RawContentSource {
  readBuilds(): Promise<unknown[]>;
  readTierLists?(): Promise<unknown[]>;
  readAuthors?(): Promise<unknown[]>;
}
export interface FileContentOptions<Local extends boolean = boolean> {
  includeDrafts: Local;
  buildMode?: 'local' | 'release';
}
interface ContentSet {
  builds: Build[];
  tiers: TierList[];
  authors: Map<string, Author>;
}

/** Fixture adapter. Loading is atomic, cached and server-only when backed by disk. */
export class FileContentRepository<
  Local extends boolean = false,
> implements ContentRepository<Local> {
  private loaded: Promise<ContentSet> | null = null;
  private readonly visible: (build: Pick<Build, 'review_state' | 'rights_status'>) => boolean;

  constructor(
    private readonly source: RawContentSource,
    private readonly options: FileContentOptions<Local>,
  ) {
    if (options.buildMode === 'release') throw new Error('El modo release no admite fixtures.');
    this.visible = publicFilter(options.includeDrafts);
  }

  async listBuilds(): Promise<readonly RepositoryBuild<Local>[]> {
    const { builds } = await this.load();
    return builds
      .filter((build) => this.isGuideVisible(build))
      .map((build) => this.buildResult(build));
  }

  async findBuild(slug: string): Promise<RepositoryBuild<Local> | null> {
    const { builds } = await this.load();
    const build = builds.find((item) => item.slug === slug && this.isGuideVisible(item));
    return build ? this.buildResult(build) : null;
  }

  async listSlugs(): Promise<readonly string[]> {
    return (await this.listBuilds()).map((build) => build.slug);
  }

  async getTierList(slug: string): Promise<RepositoryTierList<Local> | null> {
    const content = await this.load();
    const tier = content.tiers.find((item) => item.slug === slug);
    if (!tier || (!this.options.includeDrafts && tier.review_state !== 'publicado')) return null;
    if (this.options.includeDrafts) return structuredClone(tier) as RepositoryTierList<Local>;
    const visibleGuides = new Set(
      content.builds.filter((build) => this.isGuideVisible(build)).map((build) => build.slug),
    );
    const entries = tier.entries.filter(
      (entry) =>
        this.visible(entry) && (entry.build_slug === null || visibleGuides.has(entry.build_slug)),
    );
    const usedSources = new Set(entries.map((entry) => entry.source_slug));
    return PublicTierListSchema.parse({
      ...project(tier, PublicTierListSchema),
      entries,
      sources: tier.sources
        .filter((source) => usedSources.has(source.slug))
        .map((source) => project(source, PublicSourceSchema)),
    }) as RepositoryTierList<Local>;
  }

  async getAuthor(slug: string): Promise<RepositoryAuthor<Local> | null> {
    const content = await this.load();
    const author = content.authors.get(slug);
    if (!author) return null;
    if (this.options.includeDrafts) return structuredClone(author) as RepositoryAuthor<Local>;
    const hasContent =
      content.builds.some((build) => build.author_slug === slug && this.isGuideVisible(build)) ||
      content.tiers.some((tier) => tier.author_slug === slug && tier.review_state === 'publicado');
    if (author.is_placeholder || !hasContent) return null;
    return PublicAuthorSchema.parse(project(author, PublicAuthorSchema)) as RepositoryAuthor<Local>;
  }

  private isGuideVisible(build: Build): boolean {
    return (
      this.visible(build) && (this.options.includeDrafts || build.rights_status !== 'link_only')
    );
  }

  private buildResult(build: Build): RepositoryBuild<Local> {
    if (this.options.includeDrafts) return structuredClone(build) as RepositoryBuild<Local>;
    return PublicBuildSchema.parse({
      ...project(build, PublicBuildSchema),
      author: project(build.author, PublicAuthorSchema),
      sources: build.sources.map((source) => project(source, PublicSourceSchema)),
    }) as RepositoryBuild<Local>;
  }

  private load(): Promise<ContentSet> {
    this.loaded ??= Promise.all([
      this.source.readBuilds(),
      this.source.readTierLists?.() ?? [],
      this.source.readAuthors?.() ?? [],
    ]).then(([rawBuilds, rawTiers, rawAuthors]) => {
      const builds = parseAll(rawBuilds, BuildSchema);
      const tiers = parseAll(rawTiers, TierListSchema);
      const authors = new Map(
        parseAll(rawAuthors, AuthorSchema).map((author) => [author.slug, author]),
      );
      for (const build of builds) {
        const previous = authors.get(build.author_slug);
        if (previous && JSON.stringify(previous) !== JSON.stringify(build.author)) {
          throw new Error(`Autor incoherente (${build.author_slug}).`);
        }
        authors.set(build.author_slug, build.author);
      }
      const slugs = new Set(builds.map((build) => build.slug));
      for (const tier of tiers) {
        if (!authors.has(tier.author_slug)) throw new Error(`Autor desconocido (${tier.slug}).`);
        if (tier.entries.some((entry) => entry.build_slug && !slugs.has(entry.build_slug))) {
          throw new Error(`Referencia de build desconocida (${tier.slug}).`);
        }
      }
      return { builds, tiers, authors };
    });
    return this.loaded;
  }
}

/** Allowlist comes from the canonical public schema; nested resources are projected separately. */
function project(
  value: object,
  schema: { shape: Record<string, unknown> },
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(schema.shape).map((key) => [key, (value as Record<string, unknown>)[key]]),
  );
}
interface Validator<T> {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { path: PropertyKey[]; message: string }[] } };
}
function parseAll<T extends { slug: string }>(docs: unknown[], schema: Validator<T>): T[] {
  const seen = new Set<string>();
  return docs
    .map((doc, index) => {
      const result = schema.safeParse(doc);
      if (!result.success) {
        const first = result.error.issues[0];
        // Schema messages may contain input values; expose only the path, never raw content.
        throw new Error(
          `Contenido inválido (${slugOf(doc) ?? `documento #${index + 1}`}): ${first.path.length ? first.path.map(String).join('.') : '(raíz)'}`,
        );
      }
      if (seen.has(result.data.slug)) throw new Error(`Slug duplicado (${result.data.slug}).`);
      seen.add(result.data.slug);
      return result.data;
    })
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}
function slugOf(doc: unknown): string | undefined {
  if (
    doc &&
    typeof doc === 'object' &&
    'slug' in doc &&
    typeof doc.slug === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug)
  )
    return doc.slug;
  return undefined;
}
