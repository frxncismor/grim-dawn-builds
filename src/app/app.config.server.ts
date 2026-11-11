import {
  mergeApplicationConfig,
  ApplicationConfig,
  inject,
  TransferState,
  InjectionToken,
  makeStateKey,
  provideAppInitializer,
} from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { CONTENT_REPOSITORY } from './core/content/repository';
import { createContentSource } from './core/content/content-source.server';
import { SITE_BASE_URL, transferSiteUrl } from './core/seo/site-url';
import { loadPublicSiteData } from './core/content/author-pages.server';
import {
  AUTHORS_STATE,
  PUBLIC_SITE_LOADER,
  type PublicSiteData,
} from './features/author/author.state';
import { CATALOG_STATE } from './core/content/catalog.resolver';

const CONTENT_SOURCE = new InjectionToken<ReturnType<typeof createContentSource>>(
  'SERVER_CONTENT_SOURCE',
);

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: CONTENT_SOURCE, useFactory: () => createContentSource('content', process.env) },
    {
      provide: PUBLIC_SITE_LOADER,
      useFactory: () => {
        const repository = inject(CONTENT_SOURCE).repository;
        let pending: Promise<PublicSiteData> | undefined;
        return () => (pending ??= loadPublicSiteData(repository));
      },
    },
    provideAppInitializer(async () => {
      const selected = inject(CONTENT_SOURCE);
      const state = inject(TransferState);
      const load = inject(PUBLIC_SITE_LOADER);
      await selected.initialize();
      state.set(makeStateKey<typeof selected.metadata>('gd-content-source'), selected.metadata);
      const data = await load();
      state.set(CATALOG_STATE, data.catalog);
      state.set(AUTHORS_STATE, data.authors);
    }),
    {
      provide: SITE_BASE_URL,
      useFactory: () => transferSiteUrl(inject(TransferState), process.env['BASE_URL']),
    },
    {
      provide: CONTENT_REPOSITORY,
      useFactory: () => inject(CONTENT_SOURCE).repository,
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
