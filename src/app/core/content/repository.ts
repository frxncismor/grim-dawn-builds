import type { Build } from '@gd/domain';

/** Port: how the app reads content. Adapters: file (fixtures), API (deferred T-062). */
export interface ContentRepository {
  listBuilds(): Promise<readonly Build[]>;
  findBuild(slug: string): Promise<Build | null>;
  /** Slugs of the builds visible under the same rules as listBuilds (sorted). */
  listSlugs(): Promise<readonly string[]>;
}
