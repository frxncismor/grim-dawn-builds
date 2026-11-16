import type { ContentStatus } from '@gd/domain/vocabulary';

/** How the card is drawn: the featured guide of the home, a build, or a combination with no guide. */
export type BuildCardVariant = 'featured' | 'standard' | 'compact';

export interface BuildCardPortrait {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/** What a page knows about a build; `buildCardData` turns it into what the card draws. */
export interface BuildCardInput {
  readonly variant: BuildCardVariant;
  readonly title: string;
  /** `portrait: null` draws the own generic icon at its reserved size (no layout shift). */
  readonly masteries: readonly {
    readonly name: string;
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
  readonly variant: BuildCardVariant;
  readonly title: string;
  readonly masteries: readonly { readonly portrait: BuildCardPortrait }[];
  readonly status: ContentStatus;
  readonly statusLabel: string;
  readonly accessibleName: string;
  readonly facts: readonly string[];
  readonly href: readonly string[] | null;
  /** Safe external URL of a third-party guide; opens in a new tab. */
  readonly externalHref: string | null;
}
