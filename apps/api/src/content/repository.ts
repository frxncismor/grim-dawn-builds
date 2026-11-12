import pg from 'pg';
import type { PublicAuthor, PublicBuild, PublicTierList } from '@gd/domain';
import { PublicBuildSchema } from '@gd/domain';
import { loadReadinessConfig } from '../db/readiness.mjs';
import {
  mapAssets,
  mapAuthor,
  mapBuild,
  mapSlugs,
  mapTierList,
  type PublicAssetDescriptor,
} from './map-content.js';

export interface PublicContentRepository {
  listBuilds(): Promise<PublicBuild[]>;
  findBuild(slug: string): Promise<PublicBuild | null>;
  listSlugs(): Promise<string[]>;
  getTierList(slug: string): Promise<PublicTierList | null>;
  getAuthor(slug: string): Promise<PublicAuthor | null>;
  /** Public descriptors of approved assets; never private provenance (FR-16). */
  listAssets(): Promise<PublicAssetDescriptor[]>;
}
export interface ContentQuery {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
export class ContentUnavailableError extends Error {
  constructor() {
    super('content_unavailable');
    this.name = 'ContentUnavailableError';
  }
}
const PUBLIC_GUIDE =
  "document->>'review_state'='publicado' AND document->>'rights_status' IN ('own_original','licensed','permission_granted')";

// All SQL targets public views. Parameters never form SQL identifiers or expressions.
const TIER_QUERY = `SELECT jsonb_build_object(
  'slug', t.slug, 'locale', t.locale, 'title', t.title, 'game_version', t.game_version,
  'review_state', t.review_state, 'author_slug', a.slug,
  'masteries', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug', m.slug, 'name_es', m.name_es, 'name_en', m.name_en,
    'accent_token', m.accent_token, 'fallback_icon', m.fallback_icon, 'asset_slug', m.asset_slug)
    ORDER BY m.slug COLLATE "C") FROM v_public_masteries m), '[]'),
  'combinations', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug', c.slug,
    'mastery_a_slug', CASE WHEN c.mastery_b_slug IS NULL OR c.mastery_a_slug COLLATE "C" <= c.mastery_b_slug COLLATE "C" THEN c.mastery_a_slug ELSE c.mastery_b_slug END,
    'mastery_b_slug', CASE WHEN c.mastery_b_slug IS NULL THEN NULL WHEN c.mastery_a_slug COLLATE "C" <= c.mastery_b_slug COLLATE "C" THEN c.mastery_b_slug ELSE c.mastery_a_slug END)
    ORDER BY c.slug COLLATE "C") FROM v_public_mastery_combinations c), '[]'),
  'entries', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'entry_kind', e.entry_kind, 'combination_slug', e.combination_slug,
    'display_name', e.display_name, 'build_slug', e.build_slug, 'tier', e.tier,
    'content_status', e.content_status, 'rights_status', e.rights_status,
    'review_state', e.review_state, 'external_url', e.external_url,
    'external_author', e.external_author, 'source_slug', e.source_slug, 'evaluated_on', e.evaluated_on)
    ORDER BY e.position, e.id) FROM v_public_tier_entries e WHERE e.tier_list_id=t.id), '[]'),
  'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug', s.slug, 'kind', s.kind, 'title', s.title, 'url', s.url,
    'author_name', s.author_name, 'license_note', s.license_note, 'retrieved_on', s.retrieved_on)
    ORDER BY s.slug COLLATE "C") FROM v_public_sources s WHERE EXISTS
      (SELECT 1 FROM v_public_tier_entries e WHERE e.tier_list_id=t.id AND e.source_id=s.id)), '[]')
) AS document,
COALESCE((SELECT jsonb_agg(b.slug ORDER BY b.slug COLLATE "C") FROM v_public_builds b
  WHERE b.review_state='publicado' AND b.rights_status IN ('own_original','licensed','permission_granted')), '[]') AS visible_slugs
FROM v_public_tier_lists t JOIN v_public_authors a ON a.id=t.author_id
WHERE t.slug=$1 AND t.review_state='publicado'`;

export class PostgresContentRepository implements PublicContentRepository {
  constructor(private readonly database: ContentQuery) {}
  private async read(sql: string, values: readonly unknown[] = []) {
    try {
      return (await this.database.query(sql, values)).rows;
    } catch {
      throw new ContentUnavailableError();
    }
  }
  private validSlug(slug: string) {
    if (!PublicBuildSchema.shape.slug.safeParse(slug).success) throw new ContentUnavailableError();
  }
  async listBuilds(): Promise<PublicBuild[]> {
    const rows = await this.read(
      `SELECT document FROM v_public_build_documents WHERE ${PUBLIC_GUIDE} ORDER BY slug COLLATE "C"`,
    );
    return rows
      .map((row) => mapBuild(row['document']))
      .filter((build) => build !== null)
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  }
  async findBuild(slug: string): Promise<PublicBuild | null> {
    this.validSlug(slug);
    const row = (
      await this.read(
        `SELECT document FROM v_public_build_documents WHERE ${PUBLIC_GUIDE} AND slug=$1`,
        [slug],
      )
    )[0];
    return row ? mapBuild(row['document']) : null;
  }
  async listSlugs(): Promise<string[]> {
    return mapSlugs(
      await this.read(
        "SELECT slug, review_state, rights_status FROM v_public_builds WHERE review_state='publicado' AND rights_status IN ('own_original','licensed','permission_granted') ORDER BY slug COLLATE \"C\"",
      ),
    );
  }
  async getTierList(slug: string): Promise<PublicTierList | null> {
    this.validSlug(slug);
    const row = (await this.read(TIER_QUERY, [slug]))[0];
    if (!row) return null;
    if (!Array.isArray(row['visible_slugs'])) throw new ContentUnavailableError();
    return mapTierList(row['document'], row['visible_slugs']);
  }
  async getAuthor(slug: string): Promise<PublicAuthor | null> {
    this.validSlug(slug);
    const row = (
      await this.read('SELECT slug, display_name, bio, url FROM v_public_authors WHERE slug=$1', [
        slug,
      ])
    )[0];
    return row ? mapAuthor(row) : null;
  }
  /** `v_public_assets` already publishes approved rows only; the mapper re-checks the status. */
  async listAssets(): Promise<PublicAssetDescriptor[]> {
    return mapAssets(
      await this.read(
        'SELECT slug, status, file_path, fallback_svg FROM v_public_assets WHERE file_path IS NOT NULL ORDER BY slug COLLATE "C"',
      ),
    );
  }
}

/** Lazy pool preserves database-independent liveness; only the API credential is loaded. */
export function createDatabaseContentRepository(env: Readonly<Record<string, string | undefined>>) {
  let pool: pg.Pool | undefined;
  const database: ContentQuery = {
    async query(sql, values = []) {
      if (!pool) {
        const config = loadReadinessConfig(env);
        if (config.user !== 'api_ro') throw new ContentUnavailableError();
        pool = new pg.Pool({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password.reveal(),
          application_name: 'gd-api-content',
          max: 4,
          connectionTimeoutMillis: 1500,
          idleTimeoutMillis: 30000,
          statement_timeout: 1500,
          query_timeout: 1800,
          options: '-c default_transaction_read_only=on',
        });
        // Errors are surfaced through the failing request, never logged with SQL/config/values.
        pool.on('error', () => undefined);
      }
      const client = await pool.connect();
      try {
        const row = (
          await client.query(`SELECT current_user AS role,
          (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls) AS privileged,
          current_setting('transaction_read_only')='on' AS read_only FROM pg_roles WHERE rolname=current_user`)
        ).rows[0];
        if (row?.role !== 'api_ro' || row.privileged !== false || row.read_only !== true)
          throw new ContentUnavailableError();
        return await client.query(sql, [...values]);
      } finally {
        client.release();
      }
    },
  };
  return {
    repository: new PostgresContentRepository(database),
    close: async () => {
      await pool?.end();
    },
  };
}
