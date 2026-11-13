import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoFacade, type VideoFacadeContent } from './video-facade';

const embed = 'https://www.youtube-nocookie.com/embed/SampleID_01';
const content: VideoFacadeContent = {
  slug: 'muestra',
  title: 'Video de muestra',
  video_url: 'https://www.youtube.com/watch?v=SampleID_01&feature=share',
  sections_meta: [{ section_key: 'video', position: 1, visible: true }],
};

async function render(value: VideoFacadeContent = content, platform = 'browser') {
  TestBed.configureTestingModule({
    imports: [VideoFacade],
    providers: [{ provide: PLATFORM_ID, useValue: platform }],
  });
  const fixture = TestBed.createComponent(VideoFacade);
  fixture.componentRef.setInput('content', value);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('gd-video-facade', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it.each([null, '', '   '])('omits content for %j', async (video_url) => {
    const { fixture, root } = await render({ ...content, video_url });
    expect(fixture.componentInstance.hasRenderableVideo()).toBe(false);
    expect(root.children).toHaveLength(0);
    expect(root.textContent?.trim()).toBe('');
  });

  it('omits content when the section is hidden', async () => {
    const { fixture, root } = await render({
      ...content,
      sections_meta: [{ section_key: 'video', position: 1, visible: false }],
    });
    expect(fixture.componentInstance.isVisible()).toBe(false);
    expect(fixture.componentInstance.hasRenderableVideo()).toBe(false);
    expect(root.children).toHaveLength(0);
  });

  it.each([
    'https://youtube.com.evil/watch?v=SampleID_01',
    'https://evil-youtube.com/watch?v=SampleID_01',
    'http://youtube.com/watch?v=SampleID_01',
    'javascript:alert(1)',
    'data:text/html,test',
    'blob:https://youtube.com/SampleID_01',
    'https://user@youtube.com/watch?v=SampleID_01',
    'https://youtube.com:443/watch?v=SampleID_01',
    'https://youtube.com/watch?v=short',
    '/watch?v=SampleID_01',
    'https://[youtube.com/watch?v=SampleID_01',
    'https://youtube.com/watch?v=SampleID_01&v=OtherID_001',
  ])('rejects %s with an accessible error and no navigation', async (video_url) => {
    const { fixture, root } = await render({ ...content, video_url });
    expect(fixture.componentInstance.hasRenderableVideo()).toBe(false);
    expect(root.querySelector('[role="alert"]')?.textContent?.trim()).toBeTruthy();
    expect(root.querySelector('iframe, a, button, lite-youtube')).toBeNull();
  });

  async function mounted(value: VideoFacadeContent = content) {
    const result = await render(value);
    await vi.waitFor(() => {
      result.fixture.detectChanges();
      if (!result.root.querySelector('lite-youtube')) throw new Error('player not mounted');
    });
    return result;
  }

  it.each([
    content.video_url!,
    'https://m.youtube.com/watch?v=SampleID_01',
    'https://youtu.be/SampleID_01?si=example',
    'https://youtube.com/embed/SampleID_01',
    embed,
  ])('normalizes %s and adds the iframe only after activation', async (video_url) => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const storage = vi.spyOn(Storage.prototype, 'getItem');
    const writeStorage = vi.spyOn(Storage.prototype, 'setItem');
    const { fixture, root } = await mounted({ ...content, video_url });
    const player = root.querySelector('lite-youtube')!;
    expect(player.getAttribute('videoid')).toBe('SampleID_01');
    expect((player as HTMLElement).style.backgroundImage).not.toContain('ytimg');
    expect(root.querySelector('iframe')).toBeNull();
    const link = root.querySelector('a')!;
    expect(link.href).toBe(video_url);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    root.querySelector<HTMLButtonElement>('lite-youtube button')!.click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(root.querySelectorAll('iframe')).toHaveLength(1));
    expect(root.querySelector('iframe')!.src).toContain(`${embed}?`);
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBeTruthy();
    root.querySelector('iframe')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBeFalsy();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(writeStorage).not.toHaveBeenCalled();
  });

  it('renders no player on the server and exposes the fallback', async () => {
    const { root } = await render(content, 'server');
    expect(root.querySelector('button, iframe, lite-youtube')).toBeNull();
    expect(root.textContent).toContain('JavaScript');
    expect(root.querySelector('a')?.href).toBe(content.video_url);
  });

  it('announces a detected frame block, preserving the fallback', async () => {
    const { fixture, root } = await mounted();
    root.querySelector<HTMLButtonElement>('lite-youtube button')!.click();
    fixture.detectChanges();
    document.dispatchEvent(
      Object.assign(new Event('securitypolicyviolation'), {
        effectiveDirective: 'frame-src',
        blockedURI: 'https://www.youtube-nocookie.com',
        disposition: 'enforce',
      }),
    );
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent?.trim()).toBeTruthy();
    expect(root.querySelector('iframe, lite-youtube')).toBeNull();
    expect(root.querySelector('a')?.href).toBe(content.video_url);
  });

  it('falls back with an error when the frame never loads', async () => {
    const { fixture, root } = await mounted();
    vi.useFakeTimers();
    try {
      root.querySelector<HTMLButtonElement>('lite-youtube button')!.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(10_000);
      fixture.detectChanges();
    } finally {
      vi.useRealTimers();
    }
    expect(root.querySelector('[role="alert"]')?.textContent?.trim()).toBeTruthy();
    expect(root.querySelector('iframe, lite-youtube')).toBeNull();
    expect(root.querySelector('a')?.href).toBe(content.video_url);
  });

  it('names the iframe after the video, never loads the YouTube API and skips preconnects', async () => {
    const { fixture, root } = await mounted();
    const player = root.querySelector('lite-youtube')!;
    expect(Reflect.get(player, 'needsYTApi')).toBe(false);
    player.dispatchEvent(new Event('pointerover'));
    expect(document.head.querySelector('link[rel="preconnect"]')).toBeNull();
    root.querySelector<HTMLButtonElement>('lite-youtube button')!.click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(root.querySelector('iframe')!.title).toContain(content.title));
    expect(document.querySelector('script[src*="youtube"]')).toBeNull();
  });

  it('does not let a stale timeout fail the next video after a slug change', async () => {
    const { fixture, root } = await mounted();
    vi.useFakeTimers();
    try {
      root.querySelector<HTMLButtonElement>('lite-youtube button')!.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(5_000);
      fixture.componentRef.setInput('content', { ...content, slug: 'otra' });
      fixture.detectChanges();
      vi.advanceTimersByTime(6_000);
      fixture.detectChanges();
    } finally {
      vi.useRealTimers();
    }
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('resets on a different slug and renders hostile titles as text', async () => {
    const { fixture, root } = await mounted();
    root.querySelector<HTMLButtonElement>('lite-youtube button')!.click();
    fixture.detectChanges();
    const title = '<img src=x onerror=alert(1)>';
    fixture.componentRef.setInput('content', { ...content, slug: 'otra', title });
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('iframe')).toBeNull();
      expect(root.querySelector('lite-youtube')).not.toBeNull();
    });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain(title);
    expect(root.querySelector('lite-youtube')!.getAttribute('title')).toBe(title);
  });
});
