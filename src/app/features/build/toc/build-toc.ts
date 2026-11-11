import { isPlatformBrowser, Location } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import type { PublicBuild } from '@gd/domain';
import { normalizeYouTubeEmbedUrl } from '../video-facade/video-facade';

export type BuildTocContent = Pick<
  PublicBuild,
  | 'title'
  | 'video_url'
  | 'sections_meta'
  | 'sources'
  | 'notes'
  | 'priorities'
  | 'skill_nodes'
  | 'purchase_steps'
  | 'loot_filter_columns'
  | 'devotion_steps'
  | 'guide_npcs'
>;

type CanonicalSection =
  | 'resumen'
  | 'prioridades'
  | 'habilidades'
  | 'orden'
  | 'notas'
  | 'filtro-de-botin'
  | 'guia-espiritual'
  | 'devociones'
  | 'video'
  | 'fuentes';

/** Legacy keys accepted from older content; emitted ids stay canonical (plan §2). */
const sectionAliases: Record<string, CanonicalSection> = {
  arboles: 'habilidades',
  filtro: 'filtro-de-botin',
  guia_espiritual: 'guia-espiritual',
};

const sectionLabels: Record<CanonicalSection, string> = {
  resumen: $localize`:@@buildToc.resumen:Overview`,
  prioridades: $localize`:@@buildToc.prioridades:Priorities`,
  habilidades: $localize`:@@buildToc.habilidades:Skills`,
  orden: $localize`:@@buildToc.orden:Purchase order`,
  notas: $localize`:@@buildToc.notas:Notes`,
  'filtro-de-botin': $localize`:@@buildToc.lootFilter:Loot filter`,
  'guia-espiritual': $localize`:@@buildToc.spiritualGuide:Spirit Guide`,
  devociones: $localize`:@@buildToc.devotions:Devotions`,
  video: $localize`:@@buildToc.video:Video`,
  fuentes: $localize`:@@buildToc.sources:Sources`,
};

function canonicalSection(key: string): CanonicalSection | null {
  if (Object.prototype.hasOwnProperty.call(sectionLabels, key)) return key as CanonicalSection;
  return sectionAliases[key] ?? null;
}

function hasBackingData(section: CanonicalSection, content: BuildTocContent): boolean {
  switch (section) {
    case 'resumen':
      return content.title.trim().length > 0;
    case 'prioridades':
      return content.priorities.length > 0;
    case 'habilidades':
      return content.skill_nodes.length > 0;
    case 'orden':
      return content.purchase_steps.length > 0;
    case 'notas':
      return content.notes.length > 0;
    case 'filtro-de-botin':
      return content.loot_filter_columns.length > 0;
    case 'guia-espiritual':
      return content.guide_npcs.length > 0;
    case 'devociones':
      return content.devotion_steps.length > 0;
    case 'video':
      return normalizeYouTubeEmbedUrl(content.video_url ?? '') !== null;
    case 'fuentes':
      return (
        content.sources.length > 0 ||
        content.notes.some((note) => note.kind === 'general' && note.label === 'Descargo')
      );
  }
}

@Component({
  selector: 'gd-build-toc',
  standalone: true,
  templateUrl: './build-toc.html',
  styleUrl: './build-toc.css',
  // Anchor destinations are siblings, including sections owned by other components.
  // Every stylesheet selector is explicitly scoped to this TOC or its guide main.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildToc {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hrefBase = signal(this.router.url.split('#')[0]);
  private scrollPaddingPrevious: { element: HTMLElement; value: string } | null = null;

  readonly content = input.required<BuildTocContent>();

  protected readonly entries = computed(() => {
    const content = this.content();
    const seen = new Set<CanonicalSection>();
    const result: { id: CanonicalSection; label: string }[] = [];
    const ordered = [...content.sections_meta].sort(
      (left, right) => left.position - right.position,
    );
    for (const meta of ordered) {
      const section = canonicalSection(meta.section_key);
      if (!section || meta.visible === false || seen.has(section)) continue;
      if (!hasBackingData(section, content)) continue;
      seen.add(section);
      result.push({ id: section, label: sectionLabels[section] });
    }
    return result;
  });

  constructor() {
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.hrefBase.set(event.urlAfterRedirects.split('#')[0]);
      }
    });
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      if (this.scrollPaddingPrevious) {
        this.scrollPaddingPrevious.element.style.scrollPaddingBlockStart =
          this.scrollPaddingPrevious.value;
      }
    });

    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.adjustScrollPadding());
    }
  }

  protected href(id: CanonicalSection): string {
    return this.location.prepareExternalUrl(this.hrefBase()) + '#' + id;
  }

  /**
   * WCAG 2.2 SC 2.4.11: anchored headings must not end up hidden under the
   * tolerance reserved for the site header or the sticky column. The value is
   * applied to the scrolling element only in the browser and restored on destroy.
   */
  private adjustScrollPadding(): void {
    const scroll = document.scrollingElement;
    if (!(scroll instanceof HTMLElement)) return;

    const style = getComputedStyle(this.host.nativeElement);
    const stickyOffset = style.position === 'sticky' ? Number.parseFloat(style.top) || 0 : 0;
    const header = document.querySelector<HTMLElement>('.site-header');
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const gap = 16;
    this.scrollPaddingPrevious = { element: scroll, value: scroll.style.scrollPaddingBlockStart };
    scroll.style.scrollPaddingBlockStart = `${Math.ceil(Math.max(headerHeight, stickyOffset) + gap)}px`;
  }
}
