import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import type { PublicBuild } from '@gd/domain';

export type BuildAttributionContent = Pick<
  PublicBuild,
  | 'slug'
  | 'title'
  | 'author'
  | 'sources'
  | 'game_version'
  | 'review_state'
  | 'content_status'
  | 'published_at'
  | 'footer_disclaimer'
  | 'notes'
  | 'sections_meta'
>;

/** Author slug reserved for unconfirmed identities; it must never produce a link. */
const PLACEHOLDER_AUTHOR_SLUG = 'por-confirmar';

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

const kindLabels: Record<PublicBuild['sources'][number]['kind'], string> = {
  original: $localize`:@@buildAttribution.kindOriginal:Original`,
  comunidad: $localize`:@@buildAttribution.kindCommunity:Community`,
  oficial: $localize`:@@buildAttribution.kindOfficial:Official`,
  video: $localize`:@@buildAttribution.kindVideo:Video`,
  externa_enlace: $localize`:@@buildAttribution.kindExternalLink:External link`,
};

interface LinkableUrl {
  href: string;
  host: string;
}

/** Only plain HTTP(S) URLs without credentials become links; everything else stays text. */
function parseHttpUrl(value: string | null | undefined): LinkableUrl | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return { href: url.href, host: url.hostname };
  } catch {
    return null;
  }
}

function formatDate(formatter: Intl.DateTimeFormat, value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}

@Component({
  selector: 'gd-build-attribution',
  standalone: true,
  templateUrl: './build-attribution.html',
  styleUrl: './build-attribution.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildAttribution {
  private readonly location = inject(Location);
  private readonly dateFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  readonly content = input.required<BuildAttributionContent>();
  readonly authorPlaceholder = input<boolean>(false);

  readonly isVisible = computed(
    () =>
      this.content().sections_meta.find((meta) => meta.section_key === 'fuentes')?.visible !==
      false,
  );

  protected readonly authorHref = computed(() => {
    const author = this.content().author;
    if (this.authorPlaceholder() || author.slug === PLACEHOLDER_AUTHOR_SLUG) return null;
    return this.location.prepareExternalUrl(`/autores/${author.slug}`);
  });

  protected readonly reviewLabel = computed(() => reviewLabels[this.content().review_state]);
  protected readonly contentStatusLabel = computed(
    () => contentLabels[this.content().content_status],
  );

  protected readonly publishedLabel = computed(() => {
    const published = this.content().published_at;
    return published
      ? formatDate(this.dateFormatter, published)
      : $localize`:@@buildAttribution.noDate:No date`;
  });

  protected readonly disclaimer = computed(() => {
    const note = [...this.content().notes]
      .sort((left, right) => left.position - right.position)
      .find((entry) => entry.kind === 'general' && entry.label === 'Descargo');
    return note
      ? { headline: note.headline, detail: note.detail }
      : { headline: null, detail: this.content().footer_disclaimer };
  });

  protected reviewState(): string {
    return this.content().review_state;
  }

  protected contentState(): string {
    return this.content().content_status;
  }

  protected kindLabel(kind: PublicBuild['sources'][number]['kind']): string {
    return kindLabels[kind];
  }

  protected sourceDate(value: string): string {
    return formatDate(this.dateFormatter, value);
  }

  protected sourceUrl(value: string | null): LinkableUrl | null {
    return parseHttpUrl(value);
  }
}
