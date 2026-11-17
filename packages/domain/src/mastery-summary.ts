import { z } from 'zod';
import { PublicMasteryTreeSchema } from './mastery-tree.js';

const mastery = PublicMasteryTreeSchema.shape.mastery;

/** Public list entry: one mastery with its node count. Shared by the API and the web. */
export const MasterySummarySchema = z
  .object({
    id: mastery.shape.id,
    slug: mastery.shape.slug,
    name: mastery.shape.name,
    game_version: PublicMasteryTreeSchema.shape.game_version,
    node_count: z.number().int().nonnegative(),
  })
  .strict();
export type MasterySummary = z.infer<typeof MasterySummarySchema>;
