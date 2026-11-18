import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { MasterySummarySchema, PublicMasteryTreeSchema } from '@gd/domain';
import type { MasteryCatalogRepository } from '../catalog/mastery-repository.js';

/**
 * Read-only catalog routes (spec 003 T023). Same fail-closed behavior as the content routes:
 * missing repository, failed readiness, database errors and schema violations all collapse into
 * one opaque 503. Headers (including `no-store`) come from `installHttpSecurity`.
 */
export function registerMasteryRoutes(
  app: FastifyInstance,
  repository: MasteryCatalogRepository | undefined,
  readiness: (() => Promise<boolean>) | undefined,
): void {
  const unavailable = { error: 'content_unavailable' };
  const route = (
    path: string,
    schema: { safeParse(value: unknown): { success: boolean; data?: unknown } },
    read: (repository: MasteryCatalogRepository, slug: string) => Promise<unknown>,
    hasSlug = false,
  ) => {
    app.get(path, async (request, reply) => {
      let slug = '';
      if (hasSlug) {
        // A malformed slug cannot exist in the catalog: same answer as a missing one.
        const result = MasterySummarySchema.shape.slug.safeParse(
          (request.params as { slug?: unknown }).slug,
        );
        if (!result.success) return reply.code(404).send({ error: 'not_found' });
        slug = result.data;
      }
      try {
        if (!repository || !(await readiness?.())) return reply.code(503).send(unavailable);
        const value = await read(repository, slug);
        if (value === null) return reply.code(404).send({ error: 'not_found' });
        const validated = schema.safeParse(value);
        if (!validated.success) return reply.code(503).send(unavailable);
        return validated.data;
      } catch {
        return reply.code(503).send(unavailable);
      }
    });
  };
  route('/api/v1/masteries', z.array(MasterySummarySchema), (repo) => repo.listTrees());
  route(
    '/api/v1/masteries/:slug',
    PublicMasteryTreeSchema,
    (repo, slug) => repo.findTree(slug),
    true,
  );
}
