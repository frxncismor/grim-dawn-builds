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
import {
  catalogGroups,
  catalogItemList,
  type CatalogCard,
  type CatalogSnapshot,
} from './catalog.model';
import { applyFilter, EMPTY_FILTER, parseFilter, serializeFilter, type TierFilter } from './filter';
import { EmptyState, FilterBar, TierRow } from './tier-components';
import { BuildCard } from '../../shared/ui/build-card/build-card';
import { buildCardData, showsGameArt } from '../../shared/ui/build-card/build-card.labels';
import { catalogCardContext, catalogCardInput, isRealBuild } from './card-data';

@Component({
  selector: 'gd-tier-list-page',
  imports: [FilterBar, TierRow, BuildCard, EmptyState],
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
  /** Game art on a card: Crate is credited and non-affiliation stated (§VII). */
  readonly showsGameArt = showsGameArt(this.catalog.masteries.map((m) => m.portrait ?? null));
  readonly visible = computed(() => applyFilter(this.catalog.cards, this.filter()));
  private readonly cardContext = catalogCardContext(this.catalog);
  private readonly cardOf = (card: CatalogCard) => ({
    id: card.id,
    data: buildCardData(catalogCardInput(card, this.cardContext)),
  });
  /** Real builds (public guides and third-party links), grouped by documented tier. */
  readonly rows = computed(() =>
    TIERS.map((tier) => ({
      tier,
      label:
        tier === 'sin_clasificar'
          ? $localize`:@@catalog.unranked:Unranked`
          : $localize`:@@catalog.tier:Tier ${tier}`,
      cards: this.visible()
        .filter((card) => card.tier === tier && isRealBuild(card))
        .map(this.cardOf),
    })).filter((row) => row.cards.length),
  );
  /** Combinations with no guide: a separate, folded section (spec004 FR-006); one slot each. */
  readonly unguided = computed(() =>
    this.visible()
      .filter((card) => !isRealBuild(card))
      .map(this.cardOf),
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
