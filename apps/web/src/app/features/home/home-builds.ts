import type { BuildCardInput } from '../../shared/ui/build-card/build-card.model';
import { catalogCardContext, catalogCardInput } from '../tier-list/card-data';
import {
  buildCatalog,
  type CatalogCard,
  type CatalogInput,
  type CatalogLocale,
} from '../tier-list/catalog.model';
import { publicGuideOf } from '../tier-list/public-guide';

/** A `YYYY-MM-DD` that is a real calendar day (`2026-02-30` is not), or `null`. */
function calendarDate(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
    ? date
    : null;
}

/** Most builds shown after the featured one; the catalog has the rest. */
const MAX_OTHER_BUILDS = 5;

export interface HomeBuilds {
  /** Latest public guide, as the big card; `null` when no guide is public. */
  readonly featured: BuildCardInput | null;
  /** `published_at` of that same guide (`YYYY-MM-DD`); `null` when it has no valid date. */
  readonly featuredDate: string | null;
  /** Other public guides, newest first. */
  readonly others: readonly BuildCardInput[];
  /** One access per catalog mastery, opening the catalog filtered by it. */
  readonly masteries: readonly {
    readonly slug: string;
    readonly name: string;
    /** `false` when the mastery has no skill tree: the home shows it without a link (FR-040). */
    readonly hasTree: boolean;
    readonly query: Readonly<Record<string, string>>;
  }[];
  /** Combinations with no guide (not listed on the home: the catalog folds them). */
  readonly withoutGuide: number;
  readonly total: number;
}

/**
 * Presentation view of the home (spec004 FR-001): public builds as cards and one access per
 * mastery, derived from the public catalog snapshot. Pure and free of I/O; a combination with no
 * guide is only counted here (constitution I, spec001 AC-04: the catalog keeps one slot each).
 */
export function homeBuilds(input: CatalogInput, locale: CatalogLocale): HomeBuilds {
  const catalog = buildCatalog(input, locale);
  const context = catalogCardContext(catalog);

  const published = catalog.cards
    .map((card) => ({ card, guide: publicGuideOf(card.entry, card.guide) }))
    .filter((c): c is { card: CatalogCard; guide: NonNullable<CatalogCard['guide']> } => !!c.guide)
    .map(({ card, guide }) => ({
      card,
      guide,
      date: input.guides.find((g) => g.slug === guide.slug)?.published_at ?? '',
    }))
    .sort((a, b) =>
      a.date === b.date ? (a.guide.slug < b.guide.slug ? -1 : 1) : a.date < b.date ? 1 : -1,
    );

  const toCard = (
    item: (typeof published)[number],
    variant: BuildCardInput['variant'],
  ): BuildCardInput => catalogCardInput(item.card, context, variant);

  const [first, ...rest] = published;
  return {
    featured: first ? toCard(first, 'featured') : null,
    featuredDate: first ? calendarDate(first.date) : null,
    others: rest.slice(0, MAX_OTHER_BUILDS).map((item) => toCard(item, 'standard')),
    masteries: catalog.masteries.map((m) => ({
      slug: m.slug,
      name: locale === 'en' ? m.name_en : m.name_es,
      hasTree: !m.noTree,
      query: { m: m.slug },
    })),
    withoutGuide: catalog.cards.filter((c) => !publicGuideOf(c.entry, c.guide)).length,
    total: catalog.cards.length,
  };
}
