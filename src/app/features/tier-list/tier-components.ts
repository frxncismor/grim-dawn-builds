import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PublicBuild, PublicSource, TierEntry } from '@gd/domain';
import type { ContentStatus } from '@gd/domain/vocabulary';
import { Icon } from '../../shared/ui/icon/icon';
import { EMPTY_FILTER, type TierFilter } from './filter';

@Component({
  selector: 'gd-content-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge"
    ><gd-icon [name]="icon()" /><span>{{ label() }}</span></span
  >`,
  styleUrl: './tier-components.css',
})
export class ContentBadge {
  readonly status = input.required<ContentStatus>();
  readonly icon = computed(() => `status-${this.status().replace('_', '-')}`);
  readonly label = computed(
    () =>
      ({
        verificado: $localize`:@@catalog.verified:Verificado`,
        sin_verificar: $localize`:@@catalog.unverified:Sin verificar`,
        placeholder: $localize`:@@catalog.placeholder:Placeholder`,
      })[this.status()],
  );
}

@Component({
  selector: 'gd-external-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="attribution">
    <p><span i18n="@@catalog.externalAuthor">Autoría original:</span> {{ author() }}</p>
    @if (source(); as source) {
      <p>{{ source.title }} · {{ source.license_note }}</p>
    }
    @if (safeUrl(); as href) {
      <a [href]="href" target="_blank" rel="noopener noreferrer" i18n="@@catalog.externalLink"
        >Consultar fuente externa (nueva pestaña)</a
      >
    }
    <p class="notice" i18n="@@catalog.externalWarning">
      Enlace a un sitio de terceros. El contenido permanece en su fuente original.
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
      <p><span i18n="@@catalog.cardVersion">Versión:</span> {{ gameVersion() }}</p>
      <p>{{ tierLabel() }}</p>
      <p>
        @if (entry().evaluated_on; as date) {
          <span i18n="@@catalog.reviewDate">Última revisión:</span>
          <time [attr.datetime]="date">{{ date }}</time>
        } @else {
          <span i18n="@@catalog.noReviewDate">Revisión no informada</span>
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
      <p class="notice" i18n="@@catalog.comingSoon">Guía próximamente</p>
    }
  </article>`,
  styleUrl: './tier-components.css',
})
export class TierCard {
  readonly gameVersion = input<string | null>(null);
  readonly tierLabel = computed(() =>
    this.entry().tier === 'sin_clasificar'
      ? $localize`:@@catalog.unranked:Sin clasificar`
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
      ><span i18n="@@catalog.search">Buscar builds</span
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
      Limpiar filtros
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
    <h2 i18n="@@catalog.emptyTitle">Sin resultados</h2>
    <p i18n="@@catalog.emptyDescription">
      Ninguna build coincide con estos filtros. Prueba otra combinación o limpia la selección.
    </p>
    <button type="button" (click)="filtersReset.emit()" i18n="@@catalog.clear">
      Limpiar filtros
    </button>
  </section>`,
  styleUrl: './tier-components.css',
})
export class EmptyState {
  readonly filtersReset = output<void>();
}
