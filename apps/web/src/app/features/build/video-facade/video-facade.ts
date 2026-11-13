import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  PLATFORM_ID,
  signal,
} from '@angular/core';
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

const frameTimeoutMs = 10_000;
// A local poster stops lite-youtube from requesting i.ytimg.com before the user asks for the video.
const localPoster = 'linear-gradient(var(--color-panel), var(--color-panel))';

@Component({
  selector: 'gd-video-facade',
  templateUrl: './video-facade.html',
  styleUrl: './video-facade.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:securitypolicyviolation)': 'onPolicyViolation($event)' },
})
export class VideoFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly root: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
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
    computation: (): PlaybackState => {
      clearTimeout(this.frameTimer);
      return 'idle';
    },
  });
  private readonly failed = computed(() => this.state() === 'error');
  private frameTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    afterNextRender(async () => {
      if (!this.browser) return;
      try {
        await import('lite-youtube-embed');
        // lite-youtube preconnects to Google origins on hover/focus; keep every request behind the click.
        Reflect.set(customElements.get('lite-youtube') ?? {}, 'preconnected', true);
        this.ready.set(true);
      } catch {
        this.state.set('error');
      }
    });

    effect((onCleanup) => {
      const url = this.embedUrl();
      this.slug();
      if (!url || !this.ready() || this.failed()) return;
      let host: Element | null = null;
      let stop: (() => void) | undefined;
      // The player slot is rendered by this same pass, so it is looked up once rendering ends.
      const scheduled = afterNextRender(
        () => {
          host = this.root.querySelector('.video-player');
          if (host) stop = this.mountPlayer(host, url.slice(url.lastIndexOf('/') + 1));
        },
        { injector: this.injector },
      );
      onCleanup(() => {
        scheduled.destroy();
        stop?.();
        host?.replaceChildren();
      });
    });

    this.destroyRef.onDestroy(() => clearTimeout(this.frameTimer));
  }

  private mountPlayer(host: Element, id: string): () => void {
    const element = document.createElement('lite-youtube');
    element.setAttribute('videoid', id);
    element.setAttribute('title', this.content().title);
    element.setAttribute('playlabel', $localize`:@@videoFacade.activate:Load video`);
    element.style.backgroundImage = localPoster;
    host.append(element);
    // The YouTube IFrame API script is outside the CSP; the plain embed is used on every device.
    Reflect.set(element, 'needsYTApi', false);

    const observer = new MutationObserver(() => {
      const frame = element.querySelector('iframe');
      if (!frame || frame.dataset['gdWatched']) return;
      frame.dataset['gdWatched'] = 'true';
      frame.title = $localize`:@@videoFacade.playerTitle:Video player for ${this.content().title}:title:`;
      frame.addEventListener('load', () => this.onFrameLoad());
    });
    observer.observe(element, { childList: true });

    element.addEventListener('click', () => this.onActivate());
    return () => observer.disconnect();
  }

  private onActivate(): void {
    if (this.state() !== 'idle') return;
    this.state.set('loading');
    this.frameTimer = setTimeout(() => {
      if (this.state() === 'loading') this.state.set('error');
    }, frameTimeoutMs);
  }

  private onFrameLoad(): void {
    if (this.state() !== 'loading') return;
    clearTimeout(this.frameTimer);
    this.state.set('loaded');
  }

  protected onPolicyViolation(event: SecurityPolicyViolationEvent): void {
    if (
      this.state() === 'loading' &&
      event.disposition === 'enforce' &&
      event.effectiveDirective === 'frame-src' &&
      (event.blockedURI === embedOrigin || event.blockedURI === this.embedUrl())
    ) {
      this.state.set('error');
    }
  }
}
