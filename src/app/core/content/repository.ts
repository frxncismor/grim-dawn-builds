import type { Build } from './schema';

/** Port: how the app reads content. Adapters: file (default), Supabase (deferred T-011). */
export interface ContentRepository {
  listBuilds(): Promise<readonly Build[]>;
  findBuild(slug: string): Promise<Build | null>;
}
