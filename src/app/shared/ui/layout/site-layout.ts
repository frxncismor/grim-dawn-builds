import { Component, DestroyRef, inject, LOCALE_ID, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';

type Locale = 'en' | 'es';

@Component({
  selector: 'gd-site-layout',
  imports: [RouterLink],
  templateUrl: './site-layout.html',
  styleUrl: './site-layout.css',
})
export class SiteLayout {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly currentLocale: Locale = inject(LOCALE_ID).startsWith('es') ? 'es' : 'en';
  readonly currentPath = signal(this.router.url.split(/[?#]/)[0]);
  readonly route = signal(this.router.url.split('#')[0]);
  readonly skipHref = signal(
    this.location.prepareExternalUrl(this.router.url.split('#')[0]) + '#main',
  );

  constructor() {
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentPath.set(event.urlAfterRedirects.split(/[?#]/)[0]);
        this.route.set(event.urlAfterRedirects.split('#')[0]);
        this.skipHref.set(
          this.location.prepareExternalUrl(event.urlAfterRedirects.split('#')[0]) + '#main',
        );
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  isCurrent(path: string): boolean {
    const current = this.currentPath() ?? '/';
    return current === path || (path !== '/' && current.startsWith(path + '/'));
  }

  localeHref(locale: Locale): string {
    const base = this.location.prepareExternalUrl('/');
    const root =
      this.currentLocale === 'en' ? base : base.slice(0, -(this.currentLocale.length + 1));
    return `${root}${locale === 'en' ? '' : 'es/'}${this.route().slice(1)}`;
  }
}
