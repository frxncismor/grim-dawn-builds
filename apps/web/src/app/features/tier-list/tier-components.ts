import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EMPTY_FILTER, type TierFilter } from './filter';

@Component({
  selector: 'gd-tier-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section [attr.aria-label]="label()">
    <h2>{{ label() }}</h2>
    <div class="catalog-grid"><ng-content /></div>
  </section>`,
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
})
export class EmptyState {
  readonly filtersReset = output<void>();
}
