import { PublicAuthorSchema, PublicBuildSchema, PublicTierListSchema } from '@gd/domain';
import {
  resolvePublicAssets,
  type PublicAssetDescriptor,
  type ResolvedAssetIcon,
} from '../../shared/ui/icon/resolve-icon.server';
import type { ContentRepository } from './repository';

interface Schema<T> {
  safeParse(value: unknown): { success: boolean; data?: T };
}
const unavailable = () => new Error('API de contenido no disponible o respuesta inválida.');

const DESCRIPTOR_KEYS = new Set(['slug', 'file_path', 'fallback_svg', 'status']);
const ASSET_STATUSES = ['pending', 'approved', 'rejected'];
/**
 * Public descriptor contract of `GET /api/v1/assets`. Unknown keys are rejected on purpose:
 * a payload that tries to include private provenance fails closed instead of being ignored.
 */
const PublicAssetDescriptorList: Schema<PublicAssetDescriptor[]> = {
  safeParse(value) {
    if (!Array.isArray(value)) return { success: false };
    const assets: PublicAssetDescriptor[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return { success: false };
      const raw = item as Record<string, unknown>;
      if (Object.keys(raw).some((key) => !DESCRIPTOR_KEYS.has(key))) return { success: false };
      const { slug, file_path: filePath, fallback_svg: fallbackSvg, status } = raw;
      if (typeof slug !== 'string' || !PublicBuildSchema.shape.slug.safeParse(slug).success)
        return { success: false };
      if (filePath !== null && (typeof filePath !== 'string' || !filePath.startsWith('public/')))
        return { success: false };
      if (typeof fallbackSvg !== 'string') return { success: false };
      if (status !== undefined && !ASSET_STATUSES.includes(status as string))
        return { success: false };
      if (seen.has(slug)) return { success: false };
      seen.add(slug);
      assets.push({
        slug,
        file_path: (filePath as string | null) ?? null,
        fallback_svg: fallbackSvg,
        ...(status === undefined ? {} : { status: status as PublicAssetDescriptor['status'] }),
      });
    }
    return { success: true, data: assets };
  },
};

/** Server-only adapter. Import from server configuration, never browser providers. */
export class ApiContentRepository implements ContentRepository {
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

  private slug(value: string): string {
    if (!PublicBuildSchema.shape.slug.safeParse(value).success) throw new Error('slug inválido.');
    return value;
  }

  private async read<T>(path: string, schema: Schema<T>, nullable = false): Promise<T | null> {
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
        throw unavailable();
      }
      const parsed = schema.safeParse(await response.json());
      if (!parsed.success || parsed.data === undefined) throw unavailable();
      return parsed.data;
    } catch {
      // Do not retain fetch/JSON/schema causes: these may contain private values.
      throw unavailable();
    }
  }

  async ready(): Promise<void> {
    await this.read('ready', {
      safeParse: (value) => ({
        success:
          value !== null &&
          typeof value === 'object' &&
          'status' in value &&
          value.status === 'ready',
        data: true,
      }),
    });
  }

  async listBuilds() {
    return (await this.read('api/v1/builds', PublicBuildSchema.array()))!;
  }

  async findBuild(slug: string) {
    return this.read(`api/v1/builds/${this.slug(slug)}`, PublicBuildSchema, true);
  }

  async getTierList(slug: string) {
    return this.read(`api/v1/tier-lists/${this.slug(slug)}`, PublicTierListSchema, true);
  }

  async getAuthor(slug: string) {
    return this.read(`api/v1/authors/${this.slug(slug)}`, PublicAuthorSchema, true);
  }

  async listSlugs(): Promise<string[]> {
    const slugs = (await this.read('api/v1/slugs', PublicBuildSchema.shape.slug.array()))!;
    if (new Set(slugs).size !== slugs.length) throw unavailable();
    return slugs.sort();
  }

  /**
   * FR-16 consumer: fetches the public descriptors of approved assets and resolves them with
   * `resolveIcon`, so a page only ever receives a validated, evidence-free icon.
   */
  async listAssets(): Promise<ResolvedAssetIcon[]> {
    const descriptors = (await this.read('api/v1/assets', PublicAssetDescriptorList))!;
    try {
      return resolvePublicAssets(descriptors);
    } catch {
      // A hostile path or an inconsistent descriptor never reaches a view.
      throw unavailable();
    }
  }
}
