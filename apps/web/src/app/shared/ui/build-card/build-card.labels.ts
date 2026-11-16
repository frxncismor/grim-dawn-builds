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
  const noGuide = input.href === null && input.status === 'placeholder';
  const statusLabel = noGuide
    ? $localize`:@@buildCard.noGuide:No guide`
    : {
        verificado: $localize`:@@catalog.verified:Verified`,
        sin_verificar: $localize`:@@catalog.unverified:Unverified`,
        placeholder: $localize`:@@catalog.placeholder:Placeholder`,
      }[input.status];
  const review = input.reviewState
    ? (
        {
          publicado: $localize`:@@buildCard.review.published:Published`,
          en_revision: $localize`:@@buildCard.review.inReview:In review`,
          borrador: $localize`:@@buildCard.review.draft:Draft`,
        } as Record<string, string>
      )[input.reviewState]
    : undefined;
  const facts = [
    input.status === 'placeholder' ? undefined : input.tierLabel,
    review,
    ...input.damage,
    input.author,
    input.gameVersion,
  ].filter((fact): fact is string => !!fact);
  return {
    variant: input.variant,
    title: input.title,
    masteries: input.masteries.map((m) => ({ portrait: m.portrait ?? FALLBACK_PORTRAIT })),
    status: input.status,
    statusLabel,
    accessibleName: `${input.title}. ${statusLabel}`,
    facts,
    href: input.href,
  };
}
