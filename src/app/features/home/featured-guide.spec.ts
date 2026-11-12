import { describe, expect, it } from 'vitest';
import { selectFeaturedGuide } from './featured-guide';
import type { CatalogGuide } from '../tier-list/catalog.model';
const guide: CatalogGuide = {
  slug: 'own-guide',
  title: 'Guía propia',
  review_state: 'publicado',
  rights_status: 'own_original',
  game_version: 'test',
  published_at: '2026-11-09',
  damage_types: ['rayo'],
  playstyle: 'melee',
  content_tags: ['campana'],
};
describe('featured public metadata', () => {
  it('does not feature a pending, draft, link-only or invalid-date guide', () => {
    expect(selectFeaturedGuide([])).toBeNull();
    for (const change of [
      { rights_status: 'pending' },
      { rights_status: 'link_only' },
      { review_state: 'borrador' },
      { published_at: null },
      { published_at: '2026-02-30' },
      { slug: '../private' },
    ]) {
      expect(selectFeaturedGuide([{ ...guide, ...change } as CatalogGuide])).toBeNull();
    }
  });
  it('selects newest publication with stable slug tie-break and no input mutation', () => {
    const a = Object.freeze({ ...guide, slug: 'a-guide' }),
      b = Object.freeze({ ...guide, slug: 'b-guide' });
    const items = Object.freeze([b, { ...guide, slug: 'older', published_at: '2026-10-01' }, a]);
    expect(selectFeaturedGuide(items)).toEqual({
      slug: 'a-guide',
      title: guide.title,
      gameVersion: 'test',
      publishedAt: '2026-11-09',
    });
    expect(items[0]).toBe(b);
  });
});
