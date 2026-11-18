import type { ContentStatus } from '@gd/domain/vocabulary';

/** How the card is drawn: the featured guide of the home, a build, or a combination with no guide. */
export type BuildCardVariant = 'featured' | 'standard' | 'compact';

export interface BuildCardPortrait {
  /** `game` when the art is the game's (Crate is credited next to it); absent for own art. */
  readonly source?: 'game' | 'own';
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/** What a page knows about a build; `buildCardData` turns it into what the card draws. */
export interface BuildCardInput {
  /** Stable identity of the card within its page (catalog `card.id`, guide slug); derives its ids. */
  readonly key: string;
  readonly variant: BuildCardVariant;
  readonly title: string;
  /** Language of `title` when it differs from the page's (FR-042); absent or `null` otherwise. */
  readonly titleLang?: string | null;
  /** Localized combination name, only when the editorial `title` is not it; absent otherwise. */
  readonly combination?: string | null;
  /** Language of `combination` when it is the editorial title kept beside a localized name (T023). */
  readonly combinationLang?: string | null;
  /** `portrait: null` draws the own generic icon at its reserved size (no layout shift). */
  readonly masteries: readonly {
    readonly portrait: BuildCardPortrait | null;
  }[];
  readonly status: ContentStatus;
  /** Review state of the guide (`publicado`, `en_revision`, `borrador`); `null` when there is none. */
  readonly reviewState: string | null;
  readonly damage: readonly string[];
  readonly author: string | null;
  readonly gameVersion: string;
  /** Router link of the guide; `null` for a combination with no guide (the card is not a link). */
  readonly href: readonly string[] | null;
  /** Documented editorial tier already localized; ignored on a placeholder (constitution I). */
  readonly tierLabel: string | null;
  /**
   * A link to a third-party guide (`enlace_externo`): attribution only, never a ranking. `url` is
   * already validated (http/https without credentials) or `null` when it must stay text.
   */
  readonly external?: {
    readonly url: string | null;
    readonly author: string | null;
    readonly note: string | null;
  } | null;
}

/**
 * Presentation view (spec004 `BuildCard`), derived from `CatalogEntry`; not a domain entity.
 * Everything is already localized and resolved so the component stays markup only.
 */
export interface BuildCardData {
  /** Same as `BuildCardInput.key`: the content-derived part of the card's DOM ids. */
  readonly key: string;
  readonly variant: BuildCardVariant;
  readonly title: string;
  readonly titleLang?: string | null;
  /** Localized combination name, drawn under a title that is not it; `null` otherwise. */
  readonly combination: string | null;
  readonly combinationLang?: string | null;
  readonly masteries: readonly { readonly portrait: BuildCardPortrait }[];
  readonly status: ContentStatus;
  readonly statusLabel: string;
  /**
   * Hidden text after the title inside the link, in the UI language: `. combination. status. new tab`.
   * The title keeps its own `lang`, so no part of the accessible name mixes languages.
   */
  readonly srText: string;
  /**
   * Set when the combination is in the content language (`combinationLang`) and the card is a link.
   * It is never drawn: it only tells the link to point `aria-describedby` at the visible
   * `.build-card__combination` line, which carries its own `lang`, so AT reads it as the link's
   * description without it entering the accessible name (spec005 T040; a card with no link never has one).
   */
  readonly srCombination?: string | null;
  readonly facts: readonly string[];
  readonly href: readonly string[] | null;
  /** Safe external URL of a third-party guide; opens in a new tab. */
  readonly externalHref: string | null;
}
