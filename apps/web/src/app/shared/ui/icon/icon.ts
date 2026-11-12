import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { fallbackIcon, isPublicAssetPath, type ResolvedIcon } from './registry';

@Component({
  selector: 'gd-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'accessibleLabel() ? "img" : null',
    '[attr.aria-label]': 'accessibleLabel()',
    '[attr.aria-hidden]': 'accessibleLabel() ? null : "true"',
    '[class.large]': 'size() === "large"',
    '[attr.data-icon-source]': 'src() === fallback().src ? "fallback" : "asset"',
  },
  template: `<img
    [src]="src()"
    [width]="size() === 'large' ? 32 : 24"
    [height]="size() === 'large' ? 32 : 24"
    alt=""
    aria-hidden="true"
    decoding="async"
    (error)="imageFailed()"
  />`,
  styles: `
    :host {
      display: inline-flex;
      inline-size: var(--space-5);
      block-size: var(--space-5);
      flex: 0 0 var(--space-5);
      vertical-align: middle;
    }
    :host(.large) {
      inline-size: var(--space-6);
      block-size: var(--space-6);
      flex-basis: var(--space-6);
    }
    img {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }
  `,
})
export class Icon {
  readonly name = input<string>('generic');
  readonly source = input<ResolvedIcon | null>(null);
  readonly label = input<string | null>(null);
  readonly size = input<'normal' | 'large'>('normal');
  readonly accessibleLabel = computed(() => this.label()?.trim() || null);
  readonly fallback = computed(() => fallbackIcon(this.name()));
  private readonly failed = signal<string | null>(null);
  readonly src = computed(() => {
    const fallback = this.fallback();
    const source = this.source();
    if (
      source &&
      source.id === fallback.id &&
      source.fallbackSrc === fallback.src &&
      isPublicAssetPath(source.src) &&
      this.failed() !== source.src
    )
      return source.src;
    return fallback.src;
  });
  imageFailed(): void {
    this.failed.set(this.source()?.src ?? this.fallback().src);
  }
}
