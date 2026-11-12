import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import type { LinkOnlyMetadata } from '@gd/domain';

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

/**
 * Prominent «this build was adapted from» block (FR-29, T-105).
 *
 * It renders exactly the factual metadata a link-only projection may expose
 * (`LinkOnlyMetadata` from the domain, T-107): the attribution text, the
 * original title, author and site, the retrieval date and, only when it is a
 * plain HTTP(S) URL, a link to the original. No body, image, ranking or other
 * derived field from the source can reach this component. The input is fed by
 * `BuildPageContent.adaptation`; T-108 will populate it from the public
 * database views.
 */
@Component({
  selector: 'gd-source-attribution',
  standalone: true,
  templateUrl: './source-attribution.html',
  styleUrl: './source-attribution.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceAttribution {
  private readonly dateFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  readonly attribution = input.required<LinkOnlyMetadata>();

  protected readonly originalLink = computed(() => parseHttpUrl(this.attribution().source_url));

  protected readonly retrievedLabel = computed(() =>
    formatDate(this.dateFormatter, this.attribution().retrieved_on),
  );
}
