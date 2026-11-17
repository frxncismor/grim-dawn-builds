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
import { resolve } from 'node:path';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { MASTERY_CATALOG, MASTERY_PORTRAITS } from './core/content/masteries';
import {
  createPortraitResolver,
  withCatalogPortraits,
  withCatalogTrees,
} from './core/content/portraits.server';
import { SKILL_ICON_SOURCE, SKILL_ICONS_STATE } from './core/content/skill-icons';
import { createSkillIconSource } from './core/content/skill-icons.server';
import { createMasteryCatalog } from './core/content/masteries.server';
import { CONTENT_REPOSITORY } from './core/content/repository';
import { createContentSource } from './core/content/content-source.server';
import { SITE_BASE_URL, transferSiteUrl } from './core/seo/site-url';
import { loadPublicSiteData } from './core/content/author-pages.server';
import { PUBLIC_SITE_LOADER, type PublicSiteData } from './features/author/author.state';

const CONTENT_SOURCE = new InjectionToken<ReturnType<typeof createContentSource>>(
  'SERVER_CONTENT_SOURCE',
);

/**
 * T-067: the web app lives in `apps/web`, but the fixture content directory stays
 * at the repository root (`fixtures/content/`). The Angular build and `ng serve` run with
 * `apps/web` as their working directory, so the fixture root is two levels up.
 * `GD_CONTENT_ROOT` allows an explicit override without changing the default.
 */
const CONTENT_ROOT =
  process.env['GD_CONTENT_ROOT'] ?? resolve(process.cwd(), '..', '..', 'fixtures', 'content');

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: CONTENT_SOURCE, useFactory: () => createContentSource(CONTENT_ROOT, process.env) },
    {
      provide: MASTERY_CATALOG,
      useFactory: () => createMasteryCatalog(CONTENT_ROOT, process.env),
    },
    {
      // Fails the build when `ASSET_SOURCE` is invalid or `game` has no readable manifest.
      provide: MASTERY_PORTRAITS,
      useFactory: () => createPortraitResolver(CONTENT_ROOT, process.env),
    },
    {
      // spec004 T028: with `game`, fails the build when an icon of the catalog has no approved or
      // withdrawn manifest entry; with `own` it resolves to `null` without reading the manifest.
      provide: SKILL_ICON_SOURCE,
      useFactory: () => {
        const catalog = inject(MASTERY_CATALOG);
        return createSkillIconSource(CONTENT_ROOT, process.env, async () => {
          const trees = await Promise.all(
            (await catalog.listSlugs()).map((slug) => catalog.get(slug)),
          );
          return trees.flatMap((tree) =>
            (tree?.nodes ?? []).flatMap((node) => (node.icon_id ? [node.icon_id] : [])),
          );
        });
      },
    },
    {
      provide: PUBLIC_SITE_LOADER,
      useFactory: () => {
        const repository = inject(CONTENT_SOURCE).repository;
        const portraits = inject(MASTERY_PORTRAITS);
        const masteryCatalog = inject(MASTERY_CATALOG);
        let pending: Promise<PublicSiteData> | undefined;
        return () =>
          (pending ??= Promise.all([
            loadPublicSiteData(repository),
            portraits,
            masteryCatalog.listSummaries(),
          ]).then(([data, portraitOf, summaries]) => ({
            ...data,
            // spec004 T042: cards of the home and the catalog draw the mastery portrait.
            // spec005 T033: a mastery with no tree in the data is not linked (FR-040).
            catalog: withCatalogTrees(
              withCatalogPortraits(data.catalog, portraitOf),
              new Set(summaries.filter((s) => s.nodeCount > 0).map((s) => s.slug)),
            ),
          })));
      },
    },
    provideAppInitializer(async () => {
      const selected = inject(CONTENT_SOURCE);
      const state = inject(TransferState);
      const load = inject(PUBLIC_SITE_LOADER);
      // Injected before any `await` (an injection context is needed).
      const iconSource = inject(SKILL_ICON_SOURCE);
      await selected.initialize();
      state.set(makeStateKey<typeof selected.metadata>('gd-content-source'), selected.metadata);
      // Fail fast on invalid content. The snapshot itself is written into `TransferState` only by
      // the routes that read it (`ensurePublicSite`), so other pages do not carry it (T026).
      await load();
      // Only with `ASSET_SOURCE=game`: every tree reads it back (also after hydration) to draw the
      // game icons. With `own` nothing is written, so the pages carry no extra bytes.
      const icons = await iconSource;
      if (icons) state.set(SKILL_ICONS_STATE, icons);
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
