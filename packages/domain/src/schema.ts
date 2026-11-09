import { z } from 'zod';
import { CONTENT_STATUSES, TIERS } from './vocabulary.js';

export { CONTENT_STATUSES, TIERS } from './vocabulary.js';
export type { ContentStatus, Tier } from './vocabulary.js';

/**
 * Content contract for `content/` JSON files.
 * Framework-independent: no Angular imports, so the same rules run in scripts and in the app.
 * Shapes and enums follow specs/001-mvp-guias-builds/data-model.md.
 */

/** Author slug used while the real author is unconfirmed. Never publishable. */
export const PLACEHOLDER_AUTHOR_SLUG = 'por-confirmar';

export const REVIEW_STATES = ['borrador', 'en_revision', 'publicado'] as const;
export const RIGHTS_STATUSES = [
  'pending',
  'own_original',
  'licensed',
  'permission_granted',
  'link_only',
] as const;
export const APPROVED_RIGHTS: readonly RightsStatus[] = [
  'own_original',
  'licensed',
  'permission_granted',
  'link_only',
];
export const ENTRY_KINDS = ['placeholder', 'enlace_externo', 'build_propia'] as const;
export const ASSET_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug en minúsculas ASCII');
const isoDate = z.iso.date();
const nullableText = z.string().min(1).nullable();

/** Adds a custom issue at `path` with a message in Spanish. */
type Ctx = z.RefinementCtx;
const fail = (ctx: Ctx, path: (string | number)[], message: string) =>
  ctx.addIssue({ code: 'custom', path, message });

/** Returns the slugs that take part in a parent cycle, or null if the forest is acyclic. */
export function findParentCycle(
  nodes: readonly { slug: string; parent_slug: string | null }[],
): string[] | null {
  const parentOf = new Map(nodes.map((n) => [n.slug, n.parent_slug]));
  const onCycle = new Set<string>();
  for (const start of parentOf.keys()) {
    const seen = new Set<string>();
    let current: string | null | undefined = start;
    while (current && parentOf.has(current)) {
      if (seen.has(current)) {
        // Walk again from the repeated node to collect exactly the loop members.
        let member: string | null = current;
        do {
          onCycle.add(member as string);
          member = parentOf.get(member as string) ?? null;
        } while (member && member !== current);
        onCycle.add(current);
        return [...onCycle];
      }
      seen.add(current);
      current = parentOf.get(current);
    }
  }
  return null;
}

const SkillNodeSchema = z.object({
  slug,
  bar_required: z.number().int().nonnegative(),
  parent_slug: slug.nullable(),
});

export const BuildSchema = z
  .object({
    slug,
    locale: z.literal('es'),
    title: z.string().min(1),
    author_slug: slug,
    source_slugs: z.array(slug),
    game_version: z.string().min(1),
    review_state: z.enum(REVIEW_STATES),
    rights_status: z.enum(RIGHTS_STATUSES),
    rights_confirmed_by: nullableText,
    rights_confirmed_on: isoDate.nullable(),
    content_status: z.enum(CONTENT_STATUSES),
    reviewed_by: nullableText,
    published_at: isoDate.nullable(),
    skill_nodes: z.array(SkillNodeSchema),
  })
  .superRefine((build, ctx) => {
    const cycle = findParentCycle(build.skill_nodes);
    if (cycle) fail(ctx, ['skill_nodes'], `ciclo de padres en el árbol: ${cycle.join(', ')}`);

    const knownSlugs = new Set(build.skill_nodes.map((n) => n.slug));
    build.skill_nodes.forEach((n, i) => {
      if (n.parent_slug && !knownSlugs.has(n.parent_slug)) {
        fail(ctx, ['skill_nodes', i, 'parent_slug'], `padre desconocido: ${n.parent_slug}`);
      }
    });

    if (build.review_state !== 'publicado') return;

    if (build.author_slug === PLACEHOLDER_AUTHOR_SLUG) {
      fail(ctx, ['author_slug'], 'publicado requiere un autor confirmado');
    }
    if (build.source_slugs.length === 0) {
      fail(ctx, ['source_slugs'], 'publicado requiere al menos una fuente');
    }
    if (!APPROVED_RIGHTS.includes(build.rights_status)) {
      fail(ctx, ['rights_status'], `publicado no admite rights_status=${build.rights_status}`);
    }
    if (!build.rights_confirmed_by || !build.rights_confirmed_on) {
      fail(ctx, ['rights_confirmed_by'], 'publicado requiere confirmación de derechos');
    }
    if (!build.reviewed_by) fail(ctx, ['reviewed_by'], 'publicado requiere revisor');
    if (!build.published_at) fail(ctx, ['published_at'], 'publicado requiere fecha de publicación');
  });

export const TierEntrySchema = z
  .object({
    entry_kind: z.enum(ENTRY_KINDS),
    combination_slug: slug,
    display_name: nullableText,
    build_slug: slug.nullable(),
    tier: z.enum(TIERS),
    content_status: z.enum(CONTENT_STATUSES),
    rights_status: z.enum(RIGHTS_STATUSES),
    review_state: z.enum(REVIEW_STATES),
    external_url: z.url().nullable(),
    external_author: nullableText,
    source_slug: slug.nullable(),
    evaluated_on: isoDate.nullable(),
  })
  .superRefine((entry, ctx) => {
    if (!entry.build_slug && !entry.display_name) {
      fail(ctx, ['display_name'], 'requiere build_slug o display_name');
    }
    if (entry.tier !== 'sin_clasificar' && (!entry.source_slug || !entry.evaluated_on)) {
      fail(ctx, ['tier'], 'un tier real requiere source_slug y evaluated_on');
    }

    if (entry.entry_kind === 'placeholder') {
      if (entry.tier !== 'sin_clasificar') fail(ctx, ['tier'], 'placeholder sin tier');
      if (entry.content_status !== 'placeholder') {
        fail(ctx, ['content_status'], 'placeholder requiere content_status=placeholder');
      }
      if (entry.build_slug) fail(ctx, ['build_slug'], 'placeholder no referencia build');
      if (entry.external_url) fail(ctx, ['external_url'], 'placeholder no lleva enlace');
    }

    if (entry.entry_kind === 'enlace_externo') {
      if (!entry.external_url) fail(ctx, ['external_url'], 'enlace_externo requiere URL');
      if (!entry.external_author) fail(ctx, ['external_author'], 'requiere autor externo');
      if (!entry.source_slug) fail(ctx, ['source_slug'], 'enlace_externo requiere fuente');
      if (entry.rights_status !== 'link_only') {
        fail(ctx, ['rights_status'], 'enlace_externo requiere rights_status=link_only');
      }
    }

    if (entry.entry_kind === 'build_propia' && !entry.build_slug) {
      fail(ctx, ['build_slug'], 'build_propia requiere build_slug');
    }
  });

export const AssetSchema = z
  .object({
    slug,
    status: z.enum(ASSET_STATUSES),
    file_path: nullableText,
    origin_url: z.url().nullable(),
    rights_holder: nullableText,
    license_or_permission: nullableText,
    proof_ref: nullableText,
    recorded_on: isoDate,
    fallback_svg: z.string().min(1),
  })
  .superRefine((asset, ctx) => {
    if (asset.status !== 'approved') return;
    const required = [
      'file_path',
      'origin_url',
      'rights_holder',
      'license_or_permission',
      'proof_ref',
    ] as const;
    for (const field of required) {
      if (!asset[field]) fail(ctx, [field], `asset aprobado requiere ${field}`);
    }
  });

export type BuildInput = z.input<typeof BuildSchema>;
export type Build = z.infer<typeof BuildSchema>;
export type TierEntry = z.infer<typeof TierEntrySchema>;
export type Asset = z.infer<typeof AssetSchema>;
