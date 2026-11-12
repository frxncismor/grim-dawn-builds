import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { PublicAuthorSchema, PublicBuildSchema, PublicTierListSchema } from '@gd/domain';
import { PublicAssetDescriptorSchema } from '../content/map-content.js';
import type { PublicContentRepository } from '../content/repository.js';

export function registerContentRoutes(
  app: FastifyInstance,
  repository: PublicContentRepository | undefined,
  readiness: (() => Promise<boolean>) | undefined,
): void {
  const route = (
    path: string,
    schema: { safeParse(value: unknown): { success: boolean; data?: unknown } },
    read: (repository: PublicContentRepository, slug: string) => Promise<unknown>,
    hasSlug = false,
  ) => {
    app.get(path, async (request, reply) => {
      let slug = '';
      if (hasSlug) {
        const result = PublicBuildSchema.shape.slug.safeParse(
          (request.params as { slug?: unknown }).slug,
        );
        if (!result.success) return reply.code(400).send({ error: 'invalid_slug' });
        slug = result.data;
      }
      try {
        if (!repository || !(await readiness?.()))
          return reply.code(503).send({ error: 'content_unavailable' });
        const value = await read(repository, slug);
        if (value === null) return reply.code(404).send({ error: 'not_found' });
        const validated = schema.safeParse(value);
        if (!validated.success) return reply.code(503).send({ error: 'content_unavailable' });
        return validated.data;
      } catch {
        return reply.code(503).send({ error: 'content_unavailable' });
      }
    });
  };
  route('/api/v1/builds', z.array(PublicBuildSchema), (repo) => repo.listBuilds());
  route('/api/v1/builds/:slug', PublicBuildSchema, (repo, slug) => repo.findBuild(slug), true);
  // FR-16: read-only public descriptors of approved assets; never private provenance.
  route('/api/v1/assets', z.array(PublicAssetDescriptorSchema), (repo) => repo.listAssets());
  route(
    '/api/v1/tier-lists/:slug',
    PublicTierListSchema,
    (repo, slug) => repo.getTierList(slug),
    true,
  );
  route('/api/v1/authors/:slug', PublicAuthorSchema, (repo, slug) => repo.getAuthor(slug), true);
  route('/api/v1/slugs', z.array(PublicBuildSchema.shape.slug), (repo) => repo.listSlugs());
}
