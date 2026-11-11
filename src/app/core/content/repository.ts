import { InjectionToken } from '@angular/core';
import type {
  Author,
  Build,
  PublicAuthor,
  PublicBuild,
  PublicTierList,
  TierList,
} from '@gd/domain';

export type RepositoryBuild<Local extends boolean> = Local extends true ? Build : PublicBuild;
export type RepositoryAuthor<Local extends boolean> = Local extends true ? Author : PublicAuthor;
export type RepositoryTierList<Local extends boolean> = Local extends true
  ? TierList
  : PublicTierList;

/** Public DTOs by default. Only explicit local fixtures can return editorial documents. */
export interface ContentRepository<Local extends boolean = false> {
  listBuilds(): Promise<readonly RepositoryBuild<Local>[]>;
  findBuild(slug: string): Promise<RepositoryBuild<Local> | null>;
  getTierList(slug: string): Promise<RepositoryTierList<Local> | null>;
  getAuthor(slug: string): Promise<RepositoryAuthor<Local> | null>;
  /** Slugs of the builds visible under the same rules as listBuilds (sorted). */
  listSlugs(): Promise<readonly string[]>;
}

export const CONTENT_REPOSITORY = new InjectionToken<ContentRepository<boolean>>(
  'CONTENT_REPOSITORY',
);
