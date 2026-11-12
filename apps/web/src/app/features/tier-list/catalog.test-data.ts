import type { TierEntry } from '@gd/domain';
export const entry: TierEntry = {
  entry_kind: 'build_propia',
  combination_slug: 'chaman-soldado',
  display_name: 'Tormenta propia',
  build_slug: 'tormenta',
  tier: 'A',
  content_status: 'verificado',
  rights_status: 'own_original',
  review_state: 'publicado',
  external_url: null,
  external_author: null,
  source_slug: 'own',
  evaluated_on: '2026-11-09',
};
export const input = {
  locale: 'es',
  title: 'Catálogo propio',
  gameVersion: 'test-version',
  masteries: [
    { slug: 'chaman', name_es: 'Chamán', name_en: 'Shaman' },
    { slug: 'soldado', name_es: 'Soldado', name_en: 'Soldier' },
    { slug: 'arcanista', name_es: 'Arcanista', name_en: 'Arcanist' },
  ],
  combinations: [
    { slug: 'chaman-soldado', mastery_a_slug: 'chaman', mastery_b_slug: 'soldado' },
    { slug: 'chaman-arcanista', mastery_a_slug: 'chaman', mastery_b_slug: 'arcanista' },
  ],
  entries: [entry],
  guides: [
    {
      slug: 'tormenta',
      title: 'Tormenta propia',
      review_state: 'publicado',
      rights_status: 'own_original',
      damage_types: ['rayo'],
      playstyle: 'melee',
      content_tags: ['campana'],
      game_version: 'test-version',
      published_at: '2026-11-09',
    },
  ],
  sources: [
    { slug: 'own', title: 'Fuente propia', license_note: 'Original', author_name: 'Autora' },
  ],
} as const;
