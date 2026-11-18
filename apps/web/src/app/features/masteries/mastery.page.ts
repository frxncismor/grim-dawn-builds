import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
  RESPONSE_INIT,
  TransferState,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { PublicMasteryTree } from '@gd/domain';
import { MASTERY_SWITCHER_STATE } from '../../core/content/masteries';
import { SeoService, siteLocale } from '../../core/seo/seo.service';
import { DeferredStyles } from '../../core/styles/deferred-styles';
import { SkillTree } from '../../shared/svg/skill-tree/skill-tree';
import { NotFoundPage } from '../static-pages/not-found.page';

/**
 * `/maestrias/:slug`: the full canonical tree of one mastery (spec 003, US1). The tree comes from
 * the route resolver, so the prerendered HTML already contains every node. Without a tree the page
 * renders the static 404 with `noindex`. Both stay in this lazy chunk.
 */
@Component({
  selector: 'gd-mastery-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SkillTree, NotFoundPage],
  templateUrl: './mastery.page.html',
  styleUrl: './mastery.page.css',
})
export class MasteryPage {
  readonly tree = inject(ActivatedRoute).snapshot.data['mastery'] as PublicMasteryTree | null;
  readonly name = this.tree ? this.tree.mastery.name[siteLocale(inject(LOCALE_ID))] : '';
  readonly nodeCount = this.tree?.nodes.length ?? 0;
  /** Selector of masteries: the catalog's own list (route resolver), never a hand-written one. */
  readonly switcher: readonly { slug: string; name: string; linked: boolean; current: boolean }[];

  constructor() {
    const locale = siteLocale(inject(LOCALE_ID));
    const listed = inject(TransferState).get(MASTERY_SWITCHER_STATE, []);
    this.switcher = listed.map((item) => ({
      slug: item.slug,
      name: item.name?.[locale] ?? item.slug,
      // A mastery without skills is listed but not linked, as in the index.
      linked: item.nodeCount > 0,
      current: item.slug === this.tree?.mastery.slug,
    }));
    if (!this.tree) {
      const response = inject(RESPONSE_INIT, { optional: true });
      if (response) response.status = 404;
      // `NotFoundPage` sets its own title and `noindex`.
      return;
    }
    inject(DeferredStyles).ensure();
    const seo = inject(SeoService);
    const name = this.name;
    const count = this.nodeCount;
    seo.setPage({
      title: $localize`:@@mastery.seoTitle:${name}:name: skill tree`,
      description: $localize`:@@mastery.seoDescription:Every skill of the ${name}:name: mastery in Grim Dawn: ${count}:count: skills across nine tiers, with their requirements and ranks.`,
      path: `/maestrias/${this.tree.mastery.slug}`,
    });
  }
}
