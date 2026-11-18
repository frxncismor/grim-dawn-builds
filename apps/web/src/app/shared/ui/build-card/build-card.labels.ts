import type { BuildCardData, BuildCardInput, BuildCardPortrait } from './build-card.model';

/** Value of `game_version` while the guide does not confirm any (content is written in Spanish). */
const UNCONFIRMED_VERSION = 'Sin confirmar';

const FALLBACK_PORTRAIT: BuildCardPortrait = {
  src: 'assets/icons/mastery-generic.svg',
  width: 32,
  height: 32,
};

/**
 * Resolves a page's build into the localized, ready-to-draw card data. A combination with no
 * guide says "No guide" and never carries a tier or a recommendation (constitution I); a tier is
 * shown only on a real build.
 */
export function buildCardData(input: BuildCardInput): BuildCardData {
  const external = input.external ?? null;
  const noGuide = input.href === null && !external;
  const statusLabel = noGuide
    ? $localize`:@@buildCard.noGuide:No guide`
    : {
        verificado: $localize`:@@catalog.verified:Verified`,
        sin_verificar: $localize`:@@catalog.unverified:Unverified`,
        placeholder: $localize`:@@catalog.placeholder:Placeholder`,
      }[input.status];
  // Only a published guide reaches a card with a review state; other states are never listed.
  const review =
    input.reviewState === 'publicado'
      ? $localize`:@@buildCard.review.published:Published`
      : undefined;
  // The content stores the unconfirmed version as Spanish text; the card speaks the UI language.
  const gameVersion =
    input.gameVersion === UNCONFIRMED_VERSION
      ? $localize`:@@buildCard.versionUnconfirmed:Version unconfirmed`
      : input.gameVersion;
  const facts = (
    external
      ? [
          external.author &&
            $localize`:@@buildCard.externalAuthor:Original author:` + ' ' + external.author,
          external.note,
          $localize`:@@buildCard.externalNotice:Link to a third-party site. The content remains at its original source.`,
          gameVersion,
        ]
      : [
          input.status === 'placeholder' ? undefined : input.tierLabel,
          review,
          ...input.damage,
          input.author,
          gameVersion,
        ]
  ).filter((fact): fact is string => !!fact);
  const newTab = external?.url
    ? $localize`:@@buildCard.externalLink:External source (new tab)`
    : null;
  return {
    key: input.key,
    variant: input.variant,
    title: input.title,
    titleLang: input.titleLang,
    combination: input.combination ?? null,
    combinationLang: input.combinationLang ?? null,
    masteries: input.masteries.map((m) => ({ portrait: m.portrait ?? FALLBACK_PORTRAIT })),
    status: input.status,
    statusLabel,
    // A combination in the content language stays out of the link text: the link is described by the
    // visible `.build-card__combination` line (`aria-describedby`, own `lang`), see `build-card.ts`.
    srCombination: input.combinationLang && input.combination ? '. ' + input.combination : null,
    srText: [input.combinationLang ? null : input.combination, statusLabel, newTab]
      .map((part) => (part ? '. ' + part : ''))
      .join(''),
    facts,
    href: input.href,
    externalHref: external?.url ?? null,
  };
}
