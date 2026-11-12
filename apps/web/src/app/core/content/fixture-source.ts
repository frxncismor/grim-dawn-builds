import { AuthorSchema, SourceSchema, type Author, type Source } from '@gd/domain';
import type { RawContentSource } from './file.repository';

export type FixtureCollection = 'builds' | 'tier-lists' | 'authors' | 'sources';
export type FixtureReader = (collection: FixtureCollection) => Promise<unknown[]>;
interface Snapshot {
  builds: unknown[];
  tiers: unknown[];
  authors: Author[];
}

/** Resolves normalized resources once. File I/O is supplied exclusively by the server adapter. */
export class FixtureContentSource implements RawContentSource {
  private snapshot: Promise<Snapshot> | undefined;
  constructor(private readonly read: FixtureReader) {}

  async readBuilds(): Promise<unknown[]> {
    return (await this.load()).builds;
  }
  async readTierLists(): Promise<unknown[]> {
    return (await this.load()).tiers;
  }
  async readAuthors(): Promise<unknown[]> {
    return (await this.load()).authors;
  }

  private load(): Promise<Snapshot> {
    this.snapshot ??= Promise.all([
      this.read('builds'),
      this.read('tier-lists'),
      this.read('authors'),
      this.read('sources'),
    ]).then(([builds, tiers, rawAuthors, rawSources]) => {
      const authors = resources(rawAuthors, AuthorSchema, 'autor');
      const sources = resources(rawSources, SourceSchema, 'fuente');
      return {
        authors: [...authors.values()],
        builds: builds.map((raw) => {
          const doc = object(raw);
          const label = safeSlug(doc['slug']);
          const author = authors.get(String(doc['author_slug']));
          const nested = doc['author'];
          if (!author && !nested) throw new Error(`Falta autor (${label}).`);
          if (
            author &&
            nested &&
            JSON.stringify(author) !== JSON.stringify(validResource(nested, AuthorSchema))
          ) {
            throw new Error(`Autor incoherente (${label}).`);
          }
          return { ...doc, author: author ?? nested, sources: resolveSources(doc, sources) };
        }),
        tiers: tiers.map((raw) => {
          const doc = object(raw);
          return { ...doc, sources: resolveSources(doc, sources) };
        }),
      };
    });
    return this.snapshot;
  }
}

interface ResourceValidator<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}
function validResource<T>(value: unknown, schema: ResourceValidator<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Recurso de atribución inválido.');
  return result.data;
}
function resources<T extends { slug: string }>(
  docs: unknown[],
  schema: ResourceValidator<T>,
  kind: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const raw of docs) {
    const doc = validResource(raw, schema);
    if (result.has(doc.slug)) throw new Error(`Slug de ${kind} duplicado (${doc.slug}).`);
    result.set(doc.slug, doc);
  }
  return result;
}
function resolveSources(doc: Record<string, unknown>, sources: Map<string, Source>): unknown[] {
  const nested = Array.isArray(doc['sources'])
    ? doc['sources'].map((source) => validResource(source, SourceSchema))
    : [];
  const refs = Array.isArray(doc['source_slugs'])
    ? doc['source_slugs']
    : nested.map((source) => source.slug);
  if (
    nested.length &&
    (new Set(nested.map((source) => source.slug)).size !== nested.length ||
      nested.length !== refs.length ||
      nested.some((source) => !refs.includes(source.slug)))
  ) {
    throw new Error(`Fuentes anidadas incoherentes (${safeSlug(doc['slug'])}).`);
  }
  return refs.map((ref) => {
    const external = sources.get(String(ref));
    const embedded = nested.find((source) => source.slug === ref);
    if (!external && !embedded) throw new Error(`Falta fuente (${safeSlug(doc['slug'])}).`);
    if (external && embedded && JSON.stringify(external) !== JSON.stringify(embedded)) {
      throw new Error(`Fuente incoherente (${safeSlug(doc['slug'])}).`);
    }
    return external ?? embedded;
  });
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Documento de contenido inválido.');
  return value as Record<string, unknown>;
}
function safeSlug(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? value
    : 'sin slug válido';
}
