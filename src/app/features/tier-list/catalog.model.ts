import type { MasteryCombination, PublicBuild, PublicSource, TierEntry } from '@gd/domain';
import { TIERS } from '@gd/domain/vocabulary';
import { type CatalogItem, normalizeText } from './filter';
import type { FilterGroup } from './tier-components';
import type { JsonLdRecord } from '../../core/seo/seo.service';

export interface CatalogGuide extends Pick<
  PublicBuild,
  'slug' | 'title' | 'review_state' | 'rights_status' | 'game_version' | 'published_at'
> {
  readonly damage_types: readonly string[];
  readonly content_tags: readonly string[];
  readonly playstyle: string;
}
export interface CatalogInput {
  readonly title: string;
  readonly gameVersion: string;
  readonly masteries: readonly {
    readonly slug: string;
    readonly name_es: string;
    readonly name_en: string;
  }[];
  readonly combinations: readonly MasteryCombination[];
  readonly entries: readonly TierEntry[];
  readonly guides: readonly CatalogGuide[];
  readonly sources: readonly Pick<
    PublicSource,
    'slug' | 'title' | 'license_note' | 'author_name'
  >[];
}
export interface CatalogCard extends CatalogItem {
  entry: TierEntry;
  combinationName: string;
  gameVersion: string;
  guide: Pick<PublicBuild, 'slug' | 'title' | 'review_state' | 'rights_status'> | null;
  source: Pick<PublicSource, 'title' | 'license_note'> | null;
}
export interface CatalogSnapshot {
  title: string;
  gameVersion: string;
  masteries: CatalogInput['masteries'];
  cards: readonly CatalogCard[];
}
export function buildCatalog(input: CatalogInput): CatalogSnapshot {
  const masteries = new Map(input.masteries.map((m) => [m.slug, m]));
  const guides = new Map(input.guides.map((g) => [g.slug, g]));
  const sources = new Map(input.sources.map((s) => [s.slug, s]));
  const cards = input.combinations.flatMap((combination) => {
    const masterySlugs = [combination.mastery_a_slug, combination.mastery_b_slug].filter(
      (s): s is string => s !== null,
    );
    const names = masterySlugs.map((slug) => masteries.get(slug));
    if (names.some((name) => !name)) throw new Error('Combinación de catálogo inválida.');
    const combinationName = names.map((m) => m!.name_es).join(' + ');
    let entries = input.entries.filter((entry) => entry.combination_slug === combination.slug);
    const concrete = entries.filter((e) => e.entry_kind !== 'placeholder');
    if (concrete.length) entries = concrete;
    if (!entries.length)
      entries = [
        {
          entry_kind: 'placeholder',
          combination_slug: combination.slug,
          display_name: combinationName,
          build_slug: null,
          tier: 'sin_clasificar',
          content_status: 'placeholder',
          rights_status: 'own_original',
          review_state: 'publicado',
          external_url: null,
          external_author: null,
          source_slug: null,
          evaluated_on: null,
        },
      ];
    return entries.map((entry, index): CatalogCard => {
      const guide =
        entry.entry_kind === 'build_propia' && entry.build_slug
          ? guides.get(entry.build_slug)
          : undefined;
      const source = entry.source_slug ? sources.get(entry.source_slug) : undefined;
      return {
        id: `${combination.slug}:${entry.entry_kind}:${entry.build_slug ?? index}`,
        displayName: guide?.title ?? entry.display_name ?? combinationName,
        note: names.map((m) => `${m!.name_es} ${m!.name_en}`).join(' '),
        masteries: masterySlugs,
        damageTypes: [...(guide?.damage_types ?? [])],
        contentTags: [...(guide?.content_tags ?? [])],
        playstyle: guide?.playstyle ?? null,
        contentStatus: entry.content_status,
        tier: entry.tier,
        entry: { ...entry },
        combinationName,
        gameVersion: guide?.game_version ?? input.gameVersion,
        guide: guide
          ? {
              slug: guide.slug,
              title: guide.title,
              review_state: guide.review_state,
              rights_status: guide.rights_status,
            }
          : null,
        source: source ? { title: source.title, license_note: source.license_note } : null,
      };
    });
  });
  cards.sort(
    (a, b) =>
      TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) ||
      compare(normalizeText(a.displayName), normalizeText(b.displayName)) ||
      compare(a.id, b.id),
  );
  return {
    title: input.title,
    gameVersion: input.gameVersion,
    masteries: input.masteries.map((m) => ({ ...m })),
    cards,
  };
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function catalogGroups(model: CatalogSnapshot): readonly FilterGroup[] {
  const group = (
    key: FilterGroup['key'],
    label: string,
    pairs: readonly (readonly [string, string])[],
  ): FilterGroup => ({ key, label, options: pairs.map(([value, label]) => ({ value, label })) });
  return [
    group(
      'masteries',
      $localize`:@@catalog.group.masteries:Masteries`,
      model.masteries.map((m) => [m.slug, m.name_es] as const),
    ),
    group('damageTypes', $localize`:@@catalog.group.damageTypes:Damage type`, [
      ['fisico', $localize`:@@catalog.option.fisico:Physical`],
      ['fuego', $localize`:@@catalog.option.fuego:Fire`],
      ['frio', $localize`:@@catalog.option.frio:Cold`],
      ['rayo', $localize`:@@catalog.option.rayo:Lightning`],
      ['acido', $localize`:@@catalog.option.acido:Acid`],
      ['vitalidad', $localize`:@@catalog.option.vitalidad:Vitality`],
      ['caos', $localize`:@@catalog.option.caos:Chaos`],
      ['eter', $localize`:@@catalog.option.eter:Aether`],
      ['elemental', $localize`:@@catalog.option.elemental:Elemental`],
      ['sangrado', $localize`:@@catalog.option.sangrado:Bleeding`],
      ['mascotas', $localize`:@@catalog.option.mascotas:Minions`],
    ]),
    group('contentTags', $localize`:@@catalog.group.contentTags:Content`, [
      ['campana', $localize`:@@catalog.option.campana:Campaign`],
      ['shattered_realm', $localize`:@@catalog.option.shattered_realm:Shattered Realm`],
      ['crucible', $localize`:@@catalog.option.crucible:Crucible`],
      ['jefes', $localize`:@@catalog.option.jefes:Bosses`],
      ['farmeo', $localize`:@@catalog.option.farmeo:Farming`],
    ]),
    group('playstyles', $localize`:@@catalog.group.playstyles:Style`, [
      ['melee', $localize`:@@catalog.option.melee:Melee`],
      ['rango', $localize`:@@catalog.option.rango:Ranged`],
      ['mascotas', $localize`:@@catalog.option.mascotas:Minions`],
      ['hibrido', $localize`:@@catalog.option.hibrido:Hybrid`],
    ]),
    group('contentStatuses', $localize`:@@catalog.group.contentStatuses:Content status`, [
      ['verificado', $localize`:@@catalog.option.verificado:Verified`],
      ['sin_verificar', $localize`:@@catalog.option.sin_verificar:Unverified`],
      ['placeholder', $localize`:@@catalog.option.placeholder:Placeholder`],
    ]),
  ];
}
export function catalogItemList(
  model: CatalogSnapshot,
  canonical: (path: string) => string,
): JsonLdRecord {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: model.title,
    url: canonical('/tier-list'),
    numberOfItems: model.cards.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: model.cards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type':
          card.guide || card.entry.entry_kind === 'enlace_externo' ? 'CreativeWork' : 'Thing',
        name: card.displayName,
        ...(card.guide
          ? { url: canonical(`/builds/${card.guide.slug}`) }
          : card.entry.external_url
            ? {
                url: card.entry.external_url,
                author: { '@type': 'Person', name: card.entry.external_author },
              }
            : {}),
      },
    })),
  };
}
