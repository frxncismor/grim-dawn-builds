import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PublicBuild, PublicSource, TierEntry } from '@gd/domain';
import type { ContentStatus } from '@gd/domain/vocabulary';
import { EMPTY_FILTER, type TierFilter } from './filter';

@Component({
  selector: 'gd-content-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge"
    ><img
      class="badge-icon"
      [src]="iconSrc()"
      alt=""
      aria-hidden="true"
      (error)="imageFailed()"
    /><span>{{ label() }}</span></span
  >`,
  styleUrl: './tier-components.css',
})
export class ContentBadge {
  readonly status = input.required<ContentStatus>();
  private readonly failed = signal(false);
  imageFailed(): void {
    this.failed.set(true);
  }
  readonly iconSrc = computed(() => {
    if (this.failed()) return 'assets/icons/generic.svg';
    return `assets/icons/status-${this.status().replace('_', '-')}.svg`;
  });
  readonly label = computed(
    () =>
      ({
        verificado: $localize`:@@catalog.verified:Verified`,
        sin_verificar: $localize`:@@catalog.unverified:Unverified`,
        placeholder: $localize`:@@catalog.placeholder:Placeholder`,
      })[this.status()],
  );
}

@Component({
  selector: 'gd-external-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="attribution">
    <p><span i18n="@@catalog.externalAuthor">Original author:</span> {{ author() }}</p>
    @if (source(); as source) {
      <p>{{ source.title }} · {{ source.license_note }}</p>
    }
    @if (safeUrl(); as href) {
      <a [href]="href" target="_blank" rel="noopener noreferrer" i18n="@@catalog.externalLink"
        >View external source (new tab)</a
      >
    }
    <p class="notice" i18n="@@catalog.externalWarning">
      Link to a third-party site. The content remains at its original source.
    </p>
  </div>`,
  styleUrl: './tier-components.css',
})
export class ExternalAttribution {
  readonly url = input<string | null>(null);
  readonly author = input.required<string>();
  readonly source = input<Pick<PublicSource, 'title' | 'license_note'> | null>(null);
  readonly safeUrl = computed(() => {
    try {
      const raw = this.url();
      if (!raw || !/^https?:\/\//i.test(raw)) return null;
      const url = new URL(raw);
      return url.username || url.password ? null : url.href;
    } catch {
      return null;
    }
  });
}

@Component({
  selector: 'gd-tier-card',
  imports: [ContentBadge, ExternalAttribution, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article>
    <gd-content-badge [status]="entry().content_status" />
    <h3>
      @if (publicGuide(); as guide) {
        <a [routerLink]="['/builds', guide.slug]">{{ guide.title }}</a>
      } @else {
        {{ entry().display_name || combinationName() }}
      }
    </h3>
    @if (
      (publicGuide()?.title || entry().display_name || combinationName()) !== combinationName()
    ) {
      <p class="combination">{{ combinationName() }}</p>
    }
    @if (gameVersion()) {
      <p><span i18n="@@catalog.cardVersion">Version:</span> {{ gameVersion() }}</p>
      @if (entry().entry_kind !== 'enlace_externo') {
        <p>{{ tierLabel() }}</p>
      }
      <p>
        @if (entry().evaluated_on; as date) {
          <span i18n="@@catalog.reviewDate">Last reviewed:</span>
          <time [attr.datetime]="date">{{ date }}</time>
        } @else {
          <span i18n="@@catalog.noReviewDate">Review date not reported</span>
        }
      </p>
    }
    @if (entry().entry_kind === 'enlace_externo') {
      <gd-external-attribution
        [url]="entry().external_url"
        [author]="entry().external_author || ''"
        [source]="source()"
      />
    } @else if (!publicGuide()) {
      <p class="notice" i18n="@@catalog.comingSoon">Guide coming soon</p>
    }
  </article>`,
  styleUrl: './tier-components.css',
})
export class TierCard {
  readonly gameVersion = input<string | null>(null);
  readonly tierLabel = computed(() =>
    this.entry().tier === 'sin_clasificar'
      ? $localize`:@@catalog.unranked:Unranked`
      : $localize`:@@catalog.tier:Tier ${this.entry().tier}`,
  );
  readonly entry = input.required<TierEntry>();
  readonly combinationName = input.required<string>();
  readonly guide = input<Pick<
    PublicBuild,
    'slug' | 'title' | 'review_state' | 'rights_status'
  > | null>(null);
  readonly source = input<Pick<PublicSource, 'title' | 'license_note'> | null>(null);
  readonly publicGuide = computed(() => {
    const entry = this.entry(),
      guide = this.guide();
    if (
      entry.entry_kind !== 'build_propia' ||
      entry.review_state !== 'publicado' ||
      !guide ||
      guide.slug !== entry.build_slug ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug) ||
      guide.review_state !== 'publicado' ||
      !['own_original', 'licensed', 'permission_granted'].includes(guide.rights_status) ||
      !['own_original', 'licensed', 'permission_granted'].includes(entry.rights_status)
    )
      return null;
    return guide;
  });
}

@Component({
  selector: 'gd-tier-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section [attr.aria-label]="label()">
    <h2>{{ label() }}</h2>
    <div class="catalog-grid"><ng-content /></div>
  </section>`,
  styleUrl: './tier-components.css',
})
export class TierRow {
  readonly label = input.required<string>();
}

@Component({
  selector: 'gd-filter-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    type="button"
    class="chip"
    [attr.aria-pressed]="selected()"
    [disabled]="disabled()"
    (click)="selectionToggle.emit()"
  >
    {{ label() }}
  </button>`,
  styleUrl: './tier-components.css',
})
export class FilterChip {
  readonly label = input.required<string>();
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly selectionToggle = output<void>();
}
export type FilterGroupKey = Exclude<keyof TierFilter, 'text'>;
export interface FilterGroup {
  readonly key: FilterGroupKey;
  readonly label: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
  }[];
}
@Component({
  selector: 'gd-filter-bar',
  imports: [FilterChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="filters">
    <label class="search"
      ><span i18n="@@catalog.search">Search builds</span
      ><input type="search" [value]="value().text" [disabled]="disabled()" (input)="search($event)"
    /></label>
    @for (group of groups(); track group.key) {
      <fieldset [disabled]="disabled()">
        <legend>{{ group.label }}</legend>
        <div class="chips">
          @for (option of group.options; track option.value) {
            <gd-filter-chip
              [label]="option.label"
              [selected]="isSelected(group.key, option.value)"
              [disabled]="disabled() || !!option.disabled"
              (selectionToggle)="toggle(group.key, option.value)"
            />
          }
        </div>
      </fieldset>
    }
    <button type="button" [disabled]="disabled()" (click)="clear()" i18n="@@catalog.clear">
      Clear filters
    </button>
  </div>`,
  styleUrl: './tier-components.css',
})
export class FilterBar {
  readonly value = input<TierFilter>(EMPTY_FILTER);
  readonly groups = input<readonly FilterGroup[]>([]);
  readonly disabled = input(false);
  readonly valueChange = output<TierFilter>();
  isSelected(key: FilterGroupKey, option: string): boolean {
    const current: readonly string[] = this.value()[key];
    return current.includes(option);
  }
  toggle(key: FilterGroupKey, option: string): void {
    const current: readonly string[] = this.value()[key];
    this.valueChange.emit({
      ...this.value(),
      [key]: current.includes(option) ? current.filter((v) => v !== option) : [...current, option],
    });
  }
  search(event: Event): void {
    this.valueChange.emit({ ...this.value(), text: (event.target as HTMLInputElement).value });
  }
  clear(): void {
    this.valueChange.emit({
      ...EMPTY_FILTER,
      masteries: [],
      damageTypes: [],
      contentTags: [],
      playstyles: [],
      contentStatuses: [],
    });
  }
}

@Component({
  selector: 'gd-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="empty">
    <h2 i18n="@@catalog.emptyTitle">No results</h2>
    <p i18n="@@catalog.emptyDescription">
      No build matches these filters. Try another combination or clear the selection.
    </p>
    <button type="button" (click)="filtersReset.emit()" i18n="@@catalog.clear">
      Clear filters
    </button>
  </section>`,
  styleUrl: './tier-components.css',
})
export class EmptyState {
  readonly filtersReset = output<void>();
}
