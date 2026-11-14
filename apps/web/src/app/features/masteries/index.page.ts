import { ChangeDetectionStrategy, Component, inject, LOCALE_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { MasterySummary } from '../../core/content/masteries';
import { ownPortrait, type MasteryPortrait } from '../../core/content/portraits';
import { SeoService, siteLocale } from '../../core/seo/seo.service';

interface MasteryRow {
  readonly slug: string;
  readonly name: string;
  readonly nodeCount: number;
  /** A mastery without skills (or whose tree does not load) is listed but not linked. */
  readonly hasData: boolean;
  /** Art of the row: the game button (`ASSET_SOURCE=game`) or the project's own icon. */
  readonly portrait: MasteryPortrait;
}

/** The first rows sit above the fold on a phone: they load eagerly, the rest lazily. */
const EAGER_ROWS = 3;

/**
 * `/maestrias`: index of the mastery skill trees (spec 003, US2). The rows come from the catalog
 * through the route resolver, never from a hand-written list, so the prerendered HTML already
 * carries the real skill counts. A mastery without data is shown as such, without a broken link.
 */
@Component({
  selector: 'gd-mastery-index-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './index.page.html',
  styleUrl: './index.page.css',
})
export class MasteryIndexPage {
  readonly rows: readonly MasteryRow[];
  readonly eagerRows = EAGER_ROWS;
  /** Game art on screen: Crate is credited and non-affiliation stated next to it (§VII). */
  readonly showsGameArt: boolean;

  constructor() {
    const locale = siteLocale(inject(LOCALE_ID));
    const masteries = (inject(ActivatedRoute).snapshot.data['masteries'] ??
      []) as readonly MasterySummary[];
    this.rows = masteries.map((item) => ({
      slug: item.slug,
      name: item.name?.[locale] ?? item.slug,
      nodeCount: item.nodeCount,
      hasData: item.nodeCount > 0,
      portrait: item.portrait ?? ownPortrait(item.slug),
    }));
    this.showsGameArt = this.rows.some((row) => row.portrait.source === 'game');
    const count = this.rows.length;
    inject(SeoService).setPage({
      title: $localize`:@@masteryIndex.seoTitle:Mastery skill trees`,
      description: $localize`:@@masteryIndex.seoDescription:All ${count}:count: Grim Dawn masteries with the real number of skills in each tree. Pick one to see every skill, its requirements and ranks.`,
      path: '/maestrias',
    });
  }
}
