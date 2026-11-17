import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BuildCardData } from './build-card.model';

/**
 * Card of a build (spec004 T015). Markup and CSS only: it has no state and no client logic of
 * its own beyond one computed id derived from `data().key`, because `/tier-list` has ~1 kB of initial-JS margin. Every text
 * arrives localized in `data` (see `build-card.labels.ts`) and the frame, the status shape and
 * the portrait fallback live in CSS and in the data. One destination: the title link covers the
 * whole card. Its CSS is global (`styles/build-card.css`): component CSS would ship inside the JS of
 * `/tier-list`, and with no encapsulation attributes the HTML is smaller too. It never contains another card; a combination with no guide is a compact, non-link
 * card that says so and shows no tier.
 */
@Component({
  selector: 'gd-build-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `@let d = data();
    @let full = d.variant !== 'compact';
    <article class="build-card" [attr.data-variant]="d.variant">
      @if (full) {
        <div class="build-card__art">
          @for (m of d.masteries; track $index) {
            <img
              [src]="m.portrait.src"
              [attr.width]="m.portrait.width"
              [attr.height]="m.portrait.height"
              alt=""
              decoding="async"
              loading="lazy"
            />
          }
        </div>
      }
      <h3 class="build-card__title">
        @if (d.href) {
          <a
            [routerLink]="d.href"
            [attr.aria-describedby]="d.srCombination ? descriptionId() : null"
            ><span [attr.lang]="d.titleLang">{{ d.title }}</span>
            <span class="build-card__sr">{{ d.srText }}</span></a
          >
        } @else if (d.externalHref) {
          <a
            [href]="d.externalHref"
            target="_blank"
            rel="noopener noreferrer"
            [attr.aria-describedby]="d.srCombination ? descriptionId() : null"
            ><span [attr.lang]="d.titleLang">{{ d.title }}</span>
            <span class="build-card__sr">{{ d.srText }}</span></a
          >
        } @else {
          <span [attr.lang]="d.titleLang">{{ d.title }}</span>
          @if (d.srCombination) {
            <span class="build-card__sr" [attr.lang]="d.combinationLang">{{
              d.srCombination
            }}</span>
          }
          <span class="build-card__sr">{{ d.srText }}</span>
        }
      </h3>
      @if (d.combination) {
        <!-- prettier-ignore -->
        <p class="build-card__combination" aria-hidden="true" [id]="descriptionId()" [attr.lang]="d.combinationLang">{{ d.combination }}</p>
      }
      <!-- prettier-ignore -->
      <p class="build-card__status" aria-hidden="true" [attr.data-status]="d.status">{{ d.statusLabel }}</p>
      @if (full) {
        <p class="build-card__facts">
          @for (fact of d.facts; track $index) {
            <span>{{ fact }}</span>
          }
        </p>
      }
    </article>`,
})
export class BuildCard {
  readonly data = input.required<BuildCardData>();
  /**
   * Id of the visible combination line; a content-language one is the link's description (T040).
   * Derived from the card's `key`, so the same card renders the same id in any order or process.
   */
  readonly descriptionId = computed(() => `build-card-combination-${this.data().key}`);
}
