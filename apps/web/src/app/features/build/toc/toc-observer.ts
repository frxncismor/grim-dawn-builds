import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  effect,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';

/**
 * Reports which guide section is being read (spec004 T021). It renders nothing and only runs in
 * the browser; the index mounts it inside a `@defer` block, so the `IntersectionObserver` code is
 * a separate chunk that never weighs on the first paint, and the anchors work without it.
 */
@Component({
  selector: 'gd-toc-observer',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TocObserver {
  readonly ids = input.required<readonly string[]>();
  readonly activeChange = output<string>();

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly rendered = signal(false);

  constructor() {
    afterNextRender(() => this.rendered.set(true));
    // Rebuilds the observer whenever the sections change (navigating to another guide).
    effect((onCleanup) => {
      const order = this.ids();
      if (!this.rendered()) return;
      const stop = this.observe(order);
      if (stop) onCleanup(stop);
    });
  }

  private observe(order: readonly string[]): (() => void) | null {
    if (!this.browser || typeof IntersectionObserver !== 'function') return null;
    const inside = new Set<string>();
    let current: string | null = null;
    // The upper half of the viewport: an anchored section lands below the sticky header, inside it.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inside.add(entry.target.id);
          else inside.delete(entry.target.id);
        }
        // Two sections share the band while one ends and the next begins: the later one is the
        // section being read.
        const next = [...order].reverse().find((id) => inside.has(id));
        if (next !== undefined && next !== current) {
          current = next;
          this.activeChange.emit(next);
        }
      },
      { rootMargin: '0px 0px -50% 0px' },
    );
    // Deferred blocks swap a placeholder section for the real one under the same id: keep the
    // observed elements in step with the page.
    const tracked = new Map<string, Element>();
    const sync = () => {
      for (const id of order) {
        const element = document.getElementById(id);
        const previous = tracked.get(id);
        if (element === previous) continue;
        if (previous) {
          observer.unobserve(previous);
          inside.delete(id);
        }
        if (element) {
          observer.observe(element);
          tracked.set(id, element);
        } else tracked.delete(id);
      }
    };
    sync();
    const mutations = typeof MutationObserver === 'function' ? new MutationObserver(sync) : null;
    mutations?.observe(document.querySelector('main') ?? document.body, {
      childList: true,
      subtree: true,
    });
    return () => {
      mutations?.disconnect();
      observer.disconnect();
    };
  }
}
