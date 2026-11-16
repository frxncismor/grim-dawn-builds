import type { PublicBuild, TierEntry } from '@gd/domain';

const PUBLISHABLE = ['own_original', 'licensed', 'permission_granted'];

type GuideRef = Pick<PublicBuild, 'slug' | 'title' | 'review_state' | 'rights_status'>;

/**
 * A catalog entry links its guide only when both are public and agree (constitution I, III):
 * an own build, published, with a matching slug and publishable rights on both sides. Anything
 * else is not a link. Shared by the home and the catalog; mirrors the former `gd-tier-card` rule.
 */
export function publicGuideOf<G extends GuideRef>(entry: TierEntry, guide: G | null): G | null {
  if (
    entry.entry_kind !== 'build_propia' ||
    entry.review_state !== 'publicado' ||
    !guide ||
    guide.slug !== entry.build_slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug) ||
    guide.review_state !== 'publicado' ||
    !PUBLISHABLE.includes(guide.rights_status) ||
    !PUBLISHABLE.includes(entry.rights_status)
  )
    return null;
  return guide;
}
