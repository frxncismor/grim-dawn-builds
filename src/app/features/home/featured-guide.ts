import type { CatalogGuide } from '../tier-list/catalog.model';
export interface FeaturedGuide {
  readonly slug: string;
  readonly title: string;
  readonly gameVersion: string;
  readonly publishedAt: string;
}
/** Pure public metadata selection; no body, editorial provenance or ranking is returned. */
export function selectFeaturedGuide(guides: readonly CatalogGuide[]): FeaturedGuide | null {
  const candidates = guides.filter((guide) => {
    const date = guide.published_at;
    return (
      guide.review_state === 'publicado' &&
      ['own_original', 'licensed', 'permission_granted'].includes(guide.rights_status) &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug) &&
      !!date &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date
    );
  });
  candidates.sort((a, b) =>
    a.published_at === b.published_at
      ? a.slug < b.slug
        ? -1
        : a.slug > b.slug
          ? 1
          : 0
      : a.published_at! > b.published_at!
        ? -1
        : 1,
  );
  const guide = candidates[0];
  return guide
    ? {
        slug: guide.slug,
        title: guide.title,
        gameVersion: guide.game_version,
        publishedAt: guide.published_at!,
      }
    : null;
}
