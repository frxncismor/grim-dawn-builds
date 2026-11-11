import { ApiContentRepository } from './api.repository';
import { createFixtureRepository } from './fixture-source.server';
import type { ContentRepository } from './repository';

export function createContentSource(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
  request: typeof fetch = fetch,
): {
  repository: ContentRepository<boolean>;
  metadata: { source: 'fixture' | 'api'; includeDrafts: boolean };
  initialize(): Promise<void>;
} {
  const mode = env['BUILD_MODE'] ?? 'local';
  const source = env['CONTENT_SOURCE'] ?? (mode === 'local' ? 'fixture' : undefined);
  if (!['local', 'release'].includes(mode)) throw new Error('BUILD_MODE inválido.');
  if (source !== 'fixture' && source !== 'api')
    throw new Error('CONTENT_SOURCE debe ser fixture o api explícito.');
  if (mode === 'release' && source !== 'api')
    throw new Error('Release requiere CONTENT_SOURCE=api explícito.');
  if (env['INCLUDE_DRAFTS'] && !['true', 'false'].includes(env['INCLUDE_DRAFTS']))
    throw new Error('INCLUDE_DRAFTS debe ser true o false.');
  const includeDrafts = env['INCLUDE_DRAFTS'] === 'true';
  if (source === 'api') {
    if (includeDrafts) throw new Error('La API pública no admite INCLUDE_DRAFTS.');
    const repository = new ApiContentRepository(
      env['API_BASE_URL'] ?? 'http://127.0.0.1:3000',
      request,
    );
    return {
      repository,
      metadata: { source, includeDrafts: false },
      initialize: async () => {
        await repository.ready();
        await repository.listSlugs();
      },
    };
  }
  const repository = createFixtureRepository(root, env);
  return {
    repository,
    metadata: { source, includeDrafts },
    initialize: async () => {
      await repository.listSlugs();
    },
  };
}
