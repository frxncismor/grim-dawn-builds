import type { BuildCardData, BuildCardInput, BuildCardPortrait } from './build-card.model';

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
  const facts = (
    external
      ? [
          external.author &&
            $localize`:@@buildCard.externalAuthor:Original author:` + ' ' + external.author,
          external.note,
          $localize`:@@buildCard.externalNotice:Link to a third-party site. The content remains at its original source.`,
          input.gameVersion,
        ]
      : [
          input.status === 'placeholder' ? undefined : input.tierLabel,
          review,
          ...input.damage,
          input.author,
          input.gameVersion,
        ]
  ).filter((fact): fact is string => !!fact);
  const newTab = external?.url
    ? $localize`:@@buildCard.externalLink:External source (new tab)`
    : null;
  return {
    variant: input.variant,
    title: input.title,
    masteries: input.masteries.map((m) => ({ portrait: m.portrait ?? FALLBACK_PORTRAIT })),
    status: input.status,
    statusLabel,
    accessibleName: [input.title, statusLabel, newTab].filter(Boolean).join('. '),
    facts,
    href: input.href,
    externalHref: external?.url ?? null,
  };
}
