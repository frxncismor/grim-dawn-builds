import { Component, inject } from '@angular/core';
import {
  Meta,
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { VideoFacade, type VideoFacadeContent } from './video-facade';

const sample: VideoFacadeContent = {
  slug: 'video-de-muestra',
  title: $localize`:@@videoFacadePreview.sample:Video de muestra`,
  video_url: 'https://youtu.be/SampleID_01',
  sections_meta: [{ section_key: 'video', position: 1, visible: true }],
};

@Component({
  selector: 'gd-video-facade-preview',
  imports: [VideoFacade],
  template: `
    <main>
      <h1 i18n="@@videoFacadePreview.title">Fachada de video de muestra</h1>
      <p i18n="@@videoFacadePreview.notice">
        Vista de prueba con datos sintéticos. El video de muestra no representa contenido real.
      </p>
      <gd-video-facade sectionId="video-de-muestra" [content]="sample" />
      <gd-video-facade sectionId="video-invalido" [content]="invalid" />
    </main>
  `,
  styles: `
    main {
      max-inline-size: var(--reading-measure);
      margin-inline: auto;
      padding: var(--space-4);
    }

    gd-video-facade {
      margin-block-start: var(--space-6);
    }
  `,
})
export class VideoFacadePreview {
  readonly sample = sample;
  readonly invalid: VideoFacadeContent = {
    ...sample,
    slug: 'video-invalido',
    video_url: 'https://example.invalid/watch?v=SampleID_01',
  };

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex,nofollow' });
  }
}

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class VideoFacadePreviewRoot {}

export const videoFacadePreviewProviders = [
  provideRouter([{ path: '', component: VideoFacadePreview }]),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
