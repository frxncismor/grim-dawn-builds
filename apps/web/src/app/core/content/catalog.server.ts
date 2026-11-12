import {
  publicFilter,
  PublicBuildSchema,
  PublicAuthorSchema,
  PublicSourceSchema,
  PublicTierListSchema,
  type PublicBuild,
  type PublicTierList,
} from '@gd/domain';
import {
  buildCatalog,
  type CatalogInput,
  type CatalogSnapshot,
} from '../../features/tier-list/catalog.model';
import type { ContentRepository } from './repository';

function project(raw: object, shape: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(shape).map((key) => [key, (raw as Record<string, unknown>)[key]]),
  );
}
/** Server-only: public projection remains mandatory even during local draft review. */
export async function loadCatalogSnapshot(
  repository: ContentRepository<boolean>,
  locale: 'en' | 'es' = 'en',
): Promise<CatalogSnapshot> {
  return buildCatalog(await loadCatalogData(repository), locale);
}
export async function loadCatalogData(
  repository: ContentRepository<boolean>,
): Promise<CatalogInput> {
  return catalogInputFromDocuments(await loadPublicDocuments(repository));
}
export interface PublicCatalogDocuments {
  tier: PublicTierList;
  builds: PublicBuild[];
}
export async function loadPublicDocuments(
  repository: ContentRepository<boolean>,
): Promise<PublicCatalogDocuments> {
  try {
    const [rawTier, rawBuilds] = await Promise.all([
      repository.getTierList('principal'),
      repository.listBuilds(),
    ]);
    if (!rawTier || rawTier.review_state !== 'publicado') throw new Error();
    const builds = rawBuilds
      .filter(
        (b) =>
          b.review_state === 'publicado' &&
          publicFilter(false)(b) &&
          b.rights_status !== 'link_only',
      )
      .map((build) =>
        PublicBuildSchema.parse({
          ...project(build, PublicBuildSchema.shape),
          author: project(build.author, PublicAuthorSchema.shape),
          sources: build.sources.map((s) => project(s, PublicSourceSchema.shape)),
        }),
      );
    const slugs = new Set(builds.map((b) => b.slug));
    const entries = rawTier.entries.filter(
      (e) =>
        e.review_state === 'publicado' &&
        publicFilter(false)(e) &&
        (e.build_slug === null || slugs.has(e.build_slug)),
    );
    const usedSources = new Set(entries.map((e) => e.source_slug));
    for (const entry of entries) {
      if (!entry.external_url) continue;
      const url = new URL(entry.external_url);
      if (url.username || url.password) throw new Error();
    }
    const tier = PublicTierListSchema.parse({
      ...project(rawTier, PublicTierListSchema.shape),
      entries,
      sources: rawTier.sources
        .filter((s) => usedSources.has(s.slug))
        .map((s) => project(s, PublicSourceSchema.shape)),
    });
    return { tier, builds };
  } catch {
    throw new Error('No se pudo preparar el catálogo público.');
  }
}
export function catalogInputFromDocuments({ tier, builds }: PublicCatalogDocuments): CatalogInput {
  return {
    locale: tier.locale,
    title: tier.title,
    gameVersion: tier.game_version,
    masteries: tier.masteries.map((m) => ({
      slug: m.slug,
      name_es: m.name_es,
      name_en: m.name_en,
    })),
    combinations: tier.combinations,
    entries: tier.entries,
    guides: builds.map((b) => ({
      slug: b.slug,
      title: b.title,
      review_state: b.review_state,
      rights_status: b.rights_status,
      damage_types: b.damage_types,
      playstyle: b.playstyle,
      content_tags: b.content_tags,
      game_version: b.game_version,
      published_at: b.published_at,
    })),
    sources: tier.sources.map((s) => ({
      slug: s.slug,
      title: s.title,
      license_note: s.license_note,
      author_name: s.author_name,
    })),
  };
}
