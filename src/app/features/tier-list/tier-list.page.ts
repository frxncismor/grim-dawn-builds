import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TIERS } from '@gd/domain/vocabulary';
import { SeoService } from '../../core/seo/seo.service';
import { catalogGroups, catalogItemList, type CatalogSnapshot } from './catalog.model';
import { applyFilter, EMPTY_FILTER, parseFilter, serializeFilter, type TierFilter } from './filter';
import { EmptyState, FilterBar, TierCard, TierRow } from './tier-components';

@Component({
  selector: 'gd-tier-list-page',
  imports: [FilterBar, TierRow, TierCard, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tier-list.page.html',
  styleUrl: './tier-list.page.css',
})
export class TierListPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly catalog = this.route.snapshot.data['catalog'] as CatalogSnapshot;
  readonly filter = signal<TierFilter>(EMPTY_FILTER);
  readonly groups = catalogGroups(this.catalog);
  readonly visible = computed(() => applyFilter(this.catalog.cards, this.filter()));
  readonly rows = computed(() =>
    TIERS.map((tier) => ({
      tier,
      label:
        tier === 'sin_clasificar'
          ? $localize`:@@catalog.unranked:Unranked`
          : $localize`:@@catalog.tier:Tier ${tier}`,
      cards: this.visible().filter((card) => card.tier === tier),
    })).filter((row) => row.cards.length),
  );
  constructor() {
    const seo = inject(SeoService);
    seo.setPage({
      title: this.catalog.title,
      description: $localize`:@@catalog.description:Browse Grim Dawn mastery combinations. Filter by damage, style and content status, with visible attribution and review.`,
      path: '/tier-list',
      structuredData: [catalogItemList(this.catalog, (path) => seo.canonical(path))],
    });
    // Hydrate the complete SSR catalog first, then enhance it with URL filters.
    afterNextRender(() =>
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const query = new URLSearchParams(
          params.keys.flatMap((key) => params.getAll(key).map((value) => [key, value])),
        ).toString();
        const filter = parseFilter(query);
        this.filter.set(filter);
        const canonical = serializeFilter(filter);
        if (query !== canonical) void this.writeQuery(filter, true);
      }),
    );
  }
  updateFilter(next: TierFilter): void {
    const replace = this.filter().text !== next.text;
    this.filter.set(next);
    void this.writeQuery(next, replace);
  }
  clear(): void {
    this.updateFilter({ ...EMPTY_FILTER });
  }
  private writeQuery(filter: TierFilter, replaceUrl: boolean): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.fromEntries(new URLSearchParams(serializeFilter(filter))),
      replaceUrl,
      fragment: this.route.snapshot.fragment ?? undefined,
    });
  }
}
