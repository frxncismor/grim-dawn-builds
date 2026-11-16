import type {
  BuildCardInput,
  BuildCardPortrait,
} from '../../shared/ui/build-card/build-card.model';
import { catalogGroups, type CatalogCard, type CatalogSnapshot } from './catalog.model';
import { publicGuideOf } from './public-guide';

/** Lookups a card needs besides its own entry: portraits and localized damage names. */
export interface CatalogCardContext {
  readonly damageLabels: ReadonlyMap<string, string>;
  /** Portrait of each mastery that has one; the rest draw the generic icon. */
  readonly portraits: ReadonlyMap<string, BuildCardPortrait>;
  /** Language of the editorial titles when it is not the page's (EN page, ES content); else null. */
  readonly titleLang: string | null;
}

export function catalogCardContext(catalog: CatalogSnapshot): CatalogCardContext {
  return {
    titleLang: catalog.locale === catalog.contentLocale ? null : catalog.contentLocale,
    portraits: new Map(
      catalog.masteries.flatMap((m) => (m.portrait ? [[m.slug, m.portrait] as const] : [])),
    ),
    damageLabels: new Map(
      (catalogGroups(catalog).find((g) => g.key === 'damageTypes')?.options ?? []).map(
        (o) => [o.value, o.label] as const,
      ),
    ),
  };
}

/** An external URL becomes a link only when it is plain http(s) without credentials. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  try {
    if (!raw || !/^https?:\/\//i.test(raw)) return null;
    const url = new URL(raw);
    return url.username || url.password ? null : url.href;
  } catch {
    return null;
  }
}

/** True for a card that is a real build: a public guide or a link to a third-party one. */
export function isRealBuild(card: CatalogCard): boolean {
  return !!publicGuideOf(card.entry, card.guide) || card.entry.entry_kind === 'enlace_externo';
}

/**
 * Presentation input of one catalog card (spec004 FR-003). A public guide is a standard linked
 * card; a third-party link is a standard card with attribution and no ranking; anything else
 * (placeholder or a guide that is not public) is a compact card with no link and no tier.
 */
export function catalogCardInput(
  card: CatalogCard,
  context: CatalogCardContext,
  variant?: BuildCardInput['variant'],
): BuildCardInput {
  const guide = publicGuideOf(card.entry, card.guide);
  const external = card.entry.entry_kind === 'enlace_externo';
  const real = !!guide || external;
  const tier = card.entry.tier;
  const title = guide?.title ?? card.entry.display_name ?? card.combinationName;
  return {
    variant: variant ?? (real ? 'standard' : 'compact'),
    title,
    // Editorial titles are content in its own language; the combination name is localized (FR-042).
    titleLang: title === card.combinationName ? null : context.titleLang,
    // A title that is not the combination (editorial) must not hide it (FR-003, FR-004).
    combination: title === card.combinationName ? null : card.combinationName,
    masteries: card.masteries.map((slug) => ({ portrait: context.portraits.get(slug) ?? null })),
    status: card.entry.content_status,
    reviewState: guide?.review_state ?? null,
    damage: card.damageTypes.map((d) => context.damageLabels.get(d) ?? d),
    author: card.author,
    gameVersion: card.gameVersion,
    href: guide ? ['/builds', guide.slug] : null,
    tierLabel: !guide || tier === 'sin_clasificar' ? null : $localize`:@@catalog.tier:Tier ${tier}`,
    external: external
      ? {
          url: safeExternalUrl(card.entry.external_url),
          author: card.entry.external_author,
          note: card.source ? `${card.source.title} · ${card.source.license_note}` : null,
        }
      : null,
  };
}
