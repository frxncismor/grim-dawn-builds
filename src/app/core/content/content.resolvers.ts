import { isPlatformServer } from '@angular/common';
import { inject, Injector, makeStateKey, PLATFORM_ID, TransferState } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';
import type { Build, PublicBuild } from '@gd/domain';
import type { BuildPageContent } from '../../features/build/build.page';

/** Route snapshot consumed by `BuildPage`; never contains editorial evidence. */
export const BUILD_PAGE_STATE = makeStateKey<BuildPageContent | null>('gd-public-build');
/** Metadata written by the server app initializer; the resolver reads it defensively. */
export const CONTENT_SOURCE_STATE = makeStateKey<{
  readonly source?: 'fixture' | 'api';
  readonly includeDrafts?: boolean;
} | null>('gd-content-source');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLACEHOLDER_AUTHOR_SLUG = 'por-confirmar';

/**
 * Public build resolver. On the server it reads the active `ContentRepository` (fixture or
 * API) and stores a normalized snapshot in `TransferState`. In the browser it only reads that
 * snapshot: no repository, fetch, API or storage access ever happens in the client.
 *
 * The repository and the domain are loaded with dynamic imports so neither enters the
 * static browser graph: `app.routes.ts` imports this module eagerly, and a static import
 * would drag the repository, the domain and Zod into the initial bundle (plan §17.47).
 */
export async function resolveBuildPage(
  route: ActivatedRouteSnapshot,
): Promise<BuildPageContent | null> {
  const state = inject(TransferState);
  // Captured before any `await`: `inject()` is only valid inside the synchronous injection
  // context the router provides when it starts the resolver.
  const injector = inject(Injector);
  const slug = route.paramMap.get('slug') ?? '';
  if (!SLUG_PATTERN.test(slug)) return null;

  if (!isPlatformServer(inject(PLATFORM_ID))) {
    const snapshot = state.get(BUILD_PAGE_STATE, null);
    return snapshot && snapshot.slug === slug ? snapshot : null;
  }

  const includeDrafts = state.get(CONTENT_SOURCE_STATE, null)?.includeDrafts === true;
  const { CONTENT_REPOSITORY } = await import('./repository');
  const build = await injector.get(CONTENT_REPOSITORY).findBuild(slug);
  const page = build ? await normalizeBuildPage(build, includeDrafts) : null;
  state.set(BUILD_PAGE_STATE, page);
  return page;
}

/**
 * Projects an editorial or public document onto the public view shape. Non-approved rights,
 * link-only bodies and incoherent authors never reach the page outside local draft mode.
 */
async function normalizeBuildPage(
  build: Build | PublicBuild,
  includeDrafts: boolean,
): Promise<BuildPageContent | null> {
  const { PublicAuthorSchema, PublicBuildSchema, PublicSourceSchema, publicFilter } =
    await import('@gd/domain');

  if (build.author?.slug !== build.author_slug) return null;
  if (!includeDrafts && (!publicFilter(false)(build) || build.rights_status === 'link_only'))
    return null;

  const draft = build.review_state !== 'publicado';
  const authorIsPlaceholder =
    build.author_slug === PLACEHOLDER_AUTHOR_SLUG ||
    (build.author as { is_placeholder?: boolean }).is_placeholder === true;

  return {
    ...pick(build, PublicBuildSchema.shape),
    author: pick(build.author, PublicAuthorSchema.shape),
    sources: build.sources.map((source) => pick(source, PublicSourceSchema.shape)),
    authorIsPlaceholder,
    draft,
  } as unknown as BuildPageContent;
}

/** Allowlist projection: private editorial fields never leave the server. */
function pick(source: object, shape: Record<string, unknown>): Record<string, unknown> {
  const value = source as Record<string, unknown>;
  return Object.fromEntries(Object.keys(shape).map((key) => [key, value[key]]));
}
