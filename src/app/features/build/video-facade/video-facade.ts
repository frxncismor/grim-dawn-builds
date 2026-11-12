import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { PublicBuild } from '@gd/domain';

export type VideoFacadeContent = Pick<
  PublicBuild,
  'slug' | 'title' | 'video_url' | 'sections_meta'
>;

const embedOrigin = 'https://www.youtube-nocookie.com';
const youtubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);
const videoId = /^[A-Za-z0-9_-]{11}$/;

export function normalizeYouTubeEmbedUrl(value: string): string | null {
  const parts = /^https:\/\/([a-z.-]+)(\/[^?#]*)(?:\?[^#]*)?(?:#.*)?$/.exec(value);
  if (!parts || /[\s\\]/.test(value) || !youtubeHosts.has(parts[1])) return null;

  const [, host, path] = parts;
  const url = new URL(value);
  if (url.hostname !== host || url.pathname !== path) return null;

  let id: string | undefined;
  if (host === 'youtu.be') {
    id = path.slice(1);
  } else if (path === '/watch') {
    const ids = url.searchParams.getAll('v');
    if (ids.length === 1) id = ids[0];
  } else if (path.startsWith('/embed/')) {
    id = path.slice('/embed/'.length);
  }

  return id && videoId.test(id) ? `${embedOrigin}/embed/${id}` : null;
}

type PlaybackState = 'idle' | 'loading' | 'loaded' | 'error';

@Component({
  selector: 'gd-video-facade',
  templateUrl: './video-facade.html',
  styleUrl: './video-facade.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:securitypolicyviolation)': 'onPolicyViolation($event)' },
})
export class VideoFacade {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly content = input.required<VideoFacadeContent>();
  readonly sectionId = input<string>('video');

  readonly isVisible = computed(
    () =>
      !this.content().sections_meta.some(
        (section) => section.section_key === 'video' && section.visible === false,
      ),
  );
  protected readonly originalUrl = computed(() => this.content().video_url ?? '');
  private readonly embedUrl = computed(() => normalizeYouTubeEmbedUrl(this.originalUrl()));
  private readonly slug = computed(() => this.content().slug);
  readonly hasRenderableVideo = computed(() => this.isVisible() && this.embedUrl() !== null);

  protected readonly ready = signal(false);
  protected readonly state = linkedSignal({
    source: () => [this.slug(), this.originalUrl(), this.isVisible()] as const,
    computation: (): PlaybackState => 'idle',
  });
  protected readonly frameTitle = computed(
    () =>
      $localize`:@@videoFacade.playerTitle:Reproductor de video de ${this.content().title}:title:`,
  );
  private readonly trustedEmbedUrl = computed(() => {
    const url = this.embedUrl();
    // Angular requires a trusted resource URL. Only the reconstructed, allowlisted URL reaches it.
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  protected readonly frameSource = computed(() => {
    const state = this.state();
    return state === 'loading' || state === 'loaded' ? this.trustedEmbedUrl() : null;
  });

  constructor() {
    afterNextRender(() => this.ready.set(this.browser));
  }

  protected activate(): void {
    if (this.ready() && this.hasRenderableVideo() && this.state() === 'idle') {
      this.state.set('loading');
    }
  }

  protected onFrameLoad(): void {
    if (this.state() === 'loading') this.state.set('loaded');
  }

  protected onPolicyViolation(event: SecurityPolicyViolationEvent): void {
    if (
      this.frameSource() &&
      event.disposition === 'enforce' &&
      event.effectiveDirective === 'frame-src' &&
      (event.blockedURI === embedOrigin || event.blockedURI === this.embedUrl())
    ) {
      this.state.set('error');
    }
  }
}
