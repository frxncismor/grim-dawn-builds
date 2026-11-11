import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

type Locale = 'en' | 'es';

@Component({
  selector: 'gd-language-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcher {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly current: Locale = inject(LOCALE_ID).startsWith('es') ? 'es' : 'en';
  private readonly route = signal(this.router.url.split('#')[0]);

  constructor() {
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.route.set(event.urlAfterRedirects.split('#')[0]);
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  englishHref(): string {
    return this.href('en');
  }

  spanishHref(): string {
    return this.href('es');
  }

  private href(locale: Locale): string {
    const base = this.location.prepareExternalUrl('/');
    const root = this.current === 'en' ? base : base.slice(0, -(this.current.length + 1));
    return `${root}${locale === 'en' ? '' : 'es/'}${this.route().slice(1)}`;
  }
}
