import { z } from 'zod';
import {
  PublicAuthorSchema,
  PublicBuildSchema,
  PublicSourceSchema,
  PublicTierListSchema,
  TierEntrySchema,
  publicFilter,
} from '@gd/domain';

export class InvalidContentError extends Error {
  constructor() {
    super('invalid_content');
    this.name = 'InvalidContentError';
  }
}
function valid<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new InvalidContentError();
  return result.data;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidContentError();
  return value as Record<string, unknown>;
}
const StateSchema = z
  .object({
    review_state: PublicBuildSchema.shape.review_state,
    rights_status: PublicBuildSchema.shape.rights_status,
  })
  .strict();
const SlugStateSchema = StateSchema.extend({ slug: PublicBuildSchema.shape.slug });
const visible = publicFilter(false);
function state(value: Record<string, unknown>) {
  return valid(StateSchema, {
    review_state: value['review_state'],
    rights_status: value['rights_status'],
  });
}

export function mapBuild(value: unknown) {
  const raw = record(value);
  const flags = state(raw);
  if (!visible(flags) || flags.rights_status === 'link_only') return null;
  return valid(PublicBuildSchema, raw);
}
export function mapAuthor(value: unknown) {
  const raw = record(value);
  if (raw['slug'] === 'por-confirmar') return null;
  return valid(PublicAuthorSchema, raw);
}
export function mapSlugs(rows: readonly unknown[]): string[] {
  const entries = rows.map((row) => valid(SlugStateSchema, row));
  return [
    ...new Set(
      entries
        .filter((row) => visible(row) && row.rights_status !== 'link_only')
        .map((row) => row.slug),
    ),
  ].sort();
}
export function mapTierList(value: unknown, visibleSlugs: readonly string[]) {
  const raw = record(value);
  if (valid(PublicTierListSchema.shape.review_state, raw['review_state']) !== 'publicado')
    return null;
  const guides = new Set(valid(z.array(PublicBuildSchema.shape.slug), visibleSlugs));
  if (!Array.isArray(raw['entries']) || !Array.isArray(raw['sources']))
    throw new InvalidContentError();
  const entries = raw['entries'].flatMap((value) => {
    const candidate = record(value);
    if (!visible(state(candidate))) return [];
    const entry = valid(TierEntrySchema, candidate);
    return entry.build_slug === null || guides.has(entry.build_slug) ? [entry] : [];
  });
  const used = new Set(entries.map((entry) => entry.source_slug));
  const sources = raw['sources']
    .map((source) => valid(PublicSourceSchema, source))
    .filter((source) => used.has(source.slug));
  return valid(PublicTierListSchema, { ...raw, entries, sources });
}
