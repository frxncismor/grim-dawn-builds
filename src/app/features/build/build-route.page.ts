import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BuildPage, type BuildPageContent } from './build.page';
import { NotFoundPage } from '../static-pages/not-found.page';

/**
 * Route shell for `/builds/:slug`. It binds the resolver snapshot to the controlled
 * `BuildPage` and renders the static 404 when the guide is not public. Both components stay in
 * this lazy chunk: the initial bundle never imports the build page.
 */
@Component({
  selector: 'gd-build-route',
  standalone: true,
  imports: [BuildPage, NotFoundPage],
  template: `
    @if (content; as page) {
      <gd-build-page [content]="page" />
    } @else {
      <gd-not-found-page />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildRoutePage {
  private readonly route = inject(ActivatedRoute);
  readonly content = this.route.snapshot.data['content'] as BuildPageContent | null;
}
