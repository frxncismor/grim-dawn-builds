import { BuildSchema, publicFilter, type Build } from '@gd/domain';
import type { ContentRepository } from './repository';

/** Source of raw (unvalidated) build documents: a file loader, a fixture, or a test double. */
export interface RawContentSource {
  readBuilds(): Promise<unknown[]>;
}

export interface FileContentOptions {
  includeDrafts: boolean;
}

/**
 * File-backed adapter. Validates once at the boundary (fail fast, naming the document),
 * caches the parsed set, and applies the public filter on read.
 */
export class FileContentRepository implements ContentRepository {
  private loaded: Promise<readonly Build[]> | null = null;
  private readonly visible: (build: Build) => boolean;

  constructor(
    private readonly source: RawContentSource,
    options: FileContentOptions,
  ) {
    this.visible = publicFilter(options.includeDrafts);
  }

  async listBuilds(): Promise<readonly Build[]> {
    const all = await this.load();
    return all.filter(this.visible);
  }

  async findBuild(slug: string): Promise<Build | null> {
    const all = await this.load();
    return all.find((b) => b.slug === slug && this.visible(b)) ?? null;
  }

  private load(): Promise<readonly Build[]> {
    this.loaded ??= this.source.readBuilds().then(parseAll);
    return this.loaded;
  }
}

function parseAll(docs: unknown[]): Build[] {
  return docs
    .map((doc, index) => {
      const result = BuildSchema.safeParse(doc);
      if (result.success) return result.data;
      const label = slugOf(doc) ?? `documento #${index + 1}`;
      const first = result.error.issues[0];
      const path = first.path.length ? first.path.join('.') : '(raíz)';
      throw new Error(`Contenido inválido (${label}): ${path}: ${first.message}`);
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function slugOf(doc: unknown): string | undefined {
  if (doc && typeof doc === 'object' && 'slug' in doc && typeof doc.slug === 'string') {
    return doc.slug;
  }
  return undefined;
}
