import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { Router } from '@angular/router';
import type { PublicBuild } from '@gd/domain';
import { ICONS } from '../../../shared/ui/icon/registry';

export type BuildSummaryContent = Pick<
  PublicBuild,
  | 'slug'
  | 'title'
  | 'masteries'
  | 'damage_types'
  | 'author'
  | 'sources'
  | 'game_version'
  | 'review_state'
  | 'content_status'
  | 'published_at'
  | 'sections_meta'
>;

/** Author slug reserved for unconfirmed identities; it must never produce a link. */
const PLACEHOLDER_AUTHOR_SLUG = 'por-confirmar';
/** Reserved size of the own mastery icon, so the `<img>` never shifts the layout. */
const ICON_SIZE = 32;

type DamageType = PublicBuild['damage_types'][number];

const damageLabels: Record<DamageType, string> = {
  fisico: $localize`:@@catalog.option.fisico:Physical`,
  fuego: $localize`:@@catalog.option.fuego:Fire`,
  frio: $localize`:@@catalog.option.frio:Cold`,
  rayo: $localize`:@@catalog.option.rayo:Lightning`,
  acido: $localize`:@@catalog.option.acido:Acid`,
  vitalidad: $localize`:@@catalog.option.vitalidad:Vitality`,
  caos: $localize`:@@catalog.option.caos:Chaos`,
  eter: $localize`:@@catalog.option.eter:Aether`,
  elemental: $localize`:@@catalog.option.elemental:Elemental`,
  sangrado: $localize`:@@catalog.option.sangrado:Bleeding`,
  mascotas: $localize`:@@catalog.option.mascotas:Minions`,
};

const reviewLabels: Record<PublicBuild['review_state'], string> = {
  borrador: $localize`:@@buildAttribution.reviewDraft:Draft`,
  en_revision: $localize`:@@buildAttribution.reviewInReview:In review`,
  publicado: $localize`:@@buildAttribution.reviewPublished:Published`,
};

const contentLabels: Record<PublicBuild['content_status'], string> = {
  verificado: $localize`:@@buildAttribution.contentVerified:Verified`,
  sin_verificar: $localize`:@@buildAttribution.contentUnverified:Unverified`,
  placeholder: $localize`:@@buildAttribution.contentPlaceholder:Placeholder`,
};

/**
 * Summary of a guide (spec004 T020): masteries with their own portraits, damage, state, author,
 * version, source and a pointer to the full attribution. Server-rendered markup only: it has no
 * state and no client logic, so it reads the same without JavaScript and adds nothing to the
 * initial bundle. It replaces the facts list the attribution block used to carry.
 */
@Component({
  selector: 'gd-build-summary',
  standalone: true,
  templateUrl: './build-summary.html',
  styleUrl: './build-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildSummary {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly dateFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  /** Language of the page: it picks the primary mastery name (as `SkillTree.nameLang`). */
  protected readonly nameLang: 'en' | 'es' = inject(LOCALE_ID).toLowerCase().startsWith('es')
    ? 'es'
    : 'en';
  protected readonly otherLang: 'en' | 'es' = this.nameLang === 'es' ? 'en' : 'es';

  readonly content = input.required<BuildSummaryContent>();
  readonly authorPlaceholder = input<boolean>(false);

  protected readonly isVisible = computed(
    () =>
      this.content().sections_meta.find((meta) => meta.section_key === 'resumen')?.visible !==
      false,
  );

  protected readonly masteries = computed(() =>
    this.content().masteries.map((mastery) => {
      const icon = `mastery-${mastery.slug}`;
      return {
        mastery,
        name: this.nameLang === 'es' ? mastery.name_es : mastery.name_en,
        otherName: this.nameLang === 'es' ? mastery.name_en : mastery.name_es,
        src: `assets/icons/${Object.hasOwn(ICONS, icon) ? icon : 'mastery-generic'}.svg`,
        size: ICON_SIZE,
      };
    }),
  );

  protected readonly damage = computed(() =>
    this.content().damage_types.map((type) => damageLabels[type]),
  );

  protected readonly gameVersion = computed(() => {
    const version = this.content().game_version;
    // Same message as the cards: the content stores the unconfirmed version as Spanish text.
    return version === 'Sin confirmar'
      ? $localize`:@@buildCard.versionUnconfirmed:Version unconfirmed`
      : version;
  });

  protected readonly reviewLabel = computed(() => reviewLabels[this.content().review_state]);
  protected readonly contentStatusLabel = computed(
    () => contentLabels[this.content().content_status],
  );

  protected readonly publishedLabel = computed(() => {
    const published = this.content().published_at;
    if (!published) return $localize`:@@buildAttribution.noDate:No date`;
    const date = new Date(`${published}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? published : this.dateFormatter.format(date);
  });

  protected readonly authorHref = computed(() => {
    const author = this.content().author;
    if (this.authorPlaceholder() || author.slug === PLACEHOLDER_AUTHOR_SLUG) return null;
    return this.location.prepareExternalUrl(`/autores/${author.slug}`);
  });

  protected readonly firstSource = computed(() => this.content().sources[0] ?? null);
  protected readonly moreSources = computed(() => Math.max(0, this.content().sources.length - 1));

  /** Anchor to the full attribution; keeps the page path so `<base href>` cannot redirect it. */
  protected readonly sourcesHref = computed(
    () => this.location.prepareExternalUrl(this.router.url.split('#')[0]) + '#fuentes',
  );

  protected moreSourcesLabel(count: number): string {
    return $localize`:@@buildSummary.moreSources:+${count}:count: more`;
  }
}
