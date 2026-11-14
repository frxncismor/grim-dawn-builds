import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PublicMasteryTreeSchema, type PublicMasteryTree } from '@gd/domain';
import type { MasteryCatalog, MasterySummary } from './masteries';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unavailable = () => new Error('Catálogo de maestrías no disponible o respuesta inválida.');

/** Source fixtures keep `icon` for the extractor; the public view of them never does (S-004). */
function withoutIcons(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('nodes' in value) || !Array.isArray(value.nodes))
    return value;
  return {
    ...value,
    nodes: value.nodes.map((node: unknown) => {
      if (!node || typeof node !== 'object') return node;
      return Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'icon'));
    }),
  };
}

function validSlug(slug: string): boolean {
  return SLUG.test(slug);
}

/**
 * Validates a tree and its identity: the document must describe the slug that was asked for. The
 * public tree has no `icon` (the game's texture path, S-004): the API must not send it (strict
 * schema, fail closed) and the fixture source drops it before validating (`dropIcons`).
 */
function parseTree(value: unknown, slug: string, dropIcons = false): PublicMasteryTree {
  const parsed = PublicMasteryTreeSchema.safeParse(dropIcons ? withoutIcons(value) : value);
  if (!parsed.success || parsed.data.mastery.slug !== slug) throw unavailable();
  return parsed.data;
}

/** Local source: `fixtures/content/mastery-trees/<slug>.json`. Server entry only. */
export class FixtureMasteryCatalog implements MasteryCatalog {
  constructor(private readonly root: string) {}

  async listSlugs(): Promise<string[]> {
    try {
      const entries = await readdir(join(this.root, 'mastery-trees'), { withFileTypes: true });
      const slugs = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name.slice(0, -'.json'.length))
        .sort();
      if (slugs.length === 0 || !slugs.every(validSlug)) throw new Error();
      return slugs;
    } catch {
      throw unavailable();
    }
  }

  async listSummaries(): Promise<MasterySummary[]> {
    const slugs = await this.listSlugs();
    return Promise.all(
      slugs.map(async (slug): Promise<MasterySummary> => {
        try {
          const tree = await this.get(slug);
          if (!tree) throw new Error();
          return { slug, name: tree.mastery.name, nodeCount: tree.nodes.length };
        } catch {
          return { slug, name: null, nodeCount: 0 };
        }
      }),
    );
  }

  async get(slug: string): Promise<PublicMasteryTree | null> {
    if (!validSlug(slug)) return null;
    let raw: string;
    try {
      raw = await readFile(join(this.root, 'mastery-trees', `${slug}.json`), 'utf8');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
        return null;
      throw unavailable();
    }
    try {
      return parseTree(JSON.parse(raw), slug, true);
    } catch {
      // JSON.parse and the schema may quote file contents: do not retain their cause.
      throw unavailable();
    }
  }
}

/**
 * Release source: `GET /api/v1/masteries[/:slug]` (T023). There is no fallback to fixtures: a
 * 503, a network error or an invalid body fails the build instead of producing an empty page.
 */
export class ApiMasteryCatalog implements MasteryCatalog {
  private readonly base: URL;

  constructor(
    baseUrl: string,
    private readonly request: typeof fetch = fetch,
  ) {
    try {
      const base = new URL(baseUrl);
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      )
        throw new Error();
      base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
      this.base = base;
    } catch {
      throw new Error('API_BASE_URL inválida.');
    }
  }

  private async read(path: string, nullable: boolean): Promise<unknown> {
    try {
      const response = await this.request(new URL(path, this.base), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        credentials: 'omit',
        signal: AbortSignal.timeout(5000),
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        if (nullable && response.status === 404) return null;
        throw new Error();
      }
      return await response.json();
    } catch {
      throw unavailable();
    }
  }

  async listSlugs(): Promise<string[]> {
    const body = await this.read('api/v1/masteries', false);
    if (!Array.isArray(body)) throw unavailable();
    const slugs = body.map((item: unknown) => {
      const slug =
        item && typeof item === 'object' ? (item as Record<string, unknown>)['slug'] : undefined;
      if (typeof slug !== 'string' || !validSlug(slug)) throw unavailable();
      return slug;
    });
    if (slugs.length === 0 || new Set(slugs).size !== slugs.length) throw unavailable();
    return slugs.sort();
  }

  async listSummaries(): Promise<MasterySummary[]> {
    const body = await this.read('api/v1/masteries', false);
    if (!Array.isArray(body)) throw unavailable();
    const summaries = body.map((item: unknown): MasterySummary => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const { slug, name, node_count: count } = record;
      const names = name && typeof name === 'object' ? (name as Record<string, unknown>) : {};
      if (
        typeof slug !== 'string' ||
        !validSlug(slug) ||
        typeof names['en'] !== 'string' ||
        typeof names['es'] !== 'string' ||
        typeof count !== 'number' ||
        !Number.isInteger(count) ||
        count < 0
      )
        throw unavailable();
      return { slug, name: { en: names['en'], es: names['es'] }, nodeCount: count };
    });
    if (
      summaries.length === 0 ||
      new Set(summaries.map((item) => item.slug)).size !== summaries.length
    )
      throw unavailable();
    return summaries.sort((a, b) => (a.slug < b.slug ? -1 : 1));
  }

  async get(slug: string): Promise<PublicMasteryTree | null> {
    if (!validSlug(slug)) return null;
    const body = await this.read(`api/v1/masteries/${slug}`, true);
    return body === null ? null : parseTree(body, slug);
  }
}

/** Same selection rules as `createContentSource`: release requires an explicit API source. */
export function createMasteryCatalog(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
  request: typeof fetch = fetch,
): MasteryCatalog {
  const mode = env['BUILD_MODE'] ?? 'local';
  const source = env['CONTENT_SOURCE'] ?? (mode === 'local' ? 'fixture' : undefined);
  if (!['local', 'release'].includes(mode)) throw new Error('BUILD_MODE inválido.');
  if (source !== 'fixture' && source !== 'api')
    throw new Error('CONTENT_SOURCE debe ser fixture o api explícito.');
  if (mode === 'release' && source !== 'api')
    throw new Error('Release requiere CONTENT_SOURCE=api explícito.');
  return source === 'api'
    ? new ApiMasteryCatalog(env['API_BASE_URL'] ?? 'http://127.0.0.1:3000', request)
    : new FixtureMasteryCatalog(root);
}
