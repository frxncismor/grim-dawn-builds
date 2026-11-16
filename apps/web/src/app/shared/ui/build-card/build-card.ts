import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BuildCardData } from './build-card.model';

/**
 * Card of a build (spec004 T015). Markup and CSS only: it has no state, no computed values and
 * no client logic of its own, because `/tier-list` has ~1 kB of initial-JS margin. Every text
 * arrives localized in `data` (see `build-card.labels.ts`) and the frame, the status shape and
 * the portrait fallback live in CSS and in the data. One destination: the title link covers the
 * whole card. It never contains another card; a combination with no guide is a compact, non-link
 * card that says so and shows no tier.
 */
@Component({
  selector: 'gd-build-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './build-card.css',
  template: `@let d = data();
    <article class="build-card" [attr.data-variant]="d.variant">
      @if (d.variant !== 'compact') {
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
          <a [routerLink]="d.href" [attr.aria-label]="d.accessibleName">{{ d.title }}</a>
        } @else {
          {{ d.title }}
        }
      </h3>
      <p class="build-card__status" [attr.data-status]="d.status">{{ d.statusLabel }}</p>
      @if (d.variant !== 'compact') {
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
}
