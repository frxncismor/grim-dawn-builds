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

const httpUrl = z.url().refine((value) => /^https?:\/\//.test(value), 'URL HTTP(S) requerida');
const position = z.number().int().positive();
const nonnegative = z.number().int().nonnegative();
const text = z.string().trim().min(1);

export const AuthorSchema = z
  .object({
    slug,
    display_name: text,
    bio: nullableText,
    url: httpUrl.nullable(),
    is_placeholder: z.boolean(),
  })
  .strict();
export const PublicAuthorSchema = AuthorSchema.omit({ is_placeholder: true }).strict();

export const SourceSchema = z
  .object({
    slug,
    kind: z.enum(['original', 'comunidad', 'oficial', 'video', 'externa_enlace']),
    title: text,
    url: httpUrl.nullable(),
    author_name: text,
    license_note: text,
    permission_ref: nullableText,
    retrieved_on: isoDate,
    notes: z.string(),
  })
  .strict();
export const PublicSourceSchema = SourceSchema.omit({ permission_ref: true, notes: true }).strict();

export const MasterySchema = z
  .object({
    slug,
    name_es: text,
    name_en: text,
    accent_token: slug,
    fallback_icon: slug,
    asset_slug: slug.nullable(),
  })
  .strict();
export const MasteryCombinationSchema = z
  .object({
    slug,
    mastery_a_slug: slug,
    mastery_b_slug: slug.nullable(),
  })
  .strict()
  .superRefine((combination, ctx) => {
    if (combination.mastery_a_slug === combination.mastery_b_slug) {
      fail(ctx, ['mastery_b_slug'], 'una combinación requiere maestrías distintas');
    }
  });

const BuildMasterySchema = MasterySchema.pick({ slug: true, name_es: true, name_en: true })
  .extend({ role_text: text })
  .strict();
const SkillNodeSchema = z
  .object({
    slug,
    mastery_slug: slug,
    name_es: text,
    name_en: text,
    bar_required: nonnegative,
    parent_slug: slug.nullable(),
    status: z.enum(['recomendada', 'meta', 'omitir']),
    tag: nullableText,
    rationale: text,
    max_points_hint: z.number().int().positive().nullable(),
    points_label: nullableText,
    layout: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
  })
  .strict();
const PrioritySchema = z
  .object({
    rank: position.nullable(),
    group_label: text,
    headline: text,
    note: z.string(),
    skill_node_slugs: z.array(slug),
  })
  .strict();
const PurchaseStepSchema = z
  .object({
    position,
    threshold_label: text,
    mastery_slug: slug.nullable(),
    title: text,
    body: text,
    highlights: z.array(
      z.object({ skill_node_slug: slug, points: nonnegative.nullable() }).strict(),
    ),
  })
  .strict();
const NoteSchema = z
  .object({
    kind: z.enum([
      'devociones',
      'nombres',
      'atributos',
      'arma',
      'mas_adelante',
      'rotacion',
      'general',
    ]),
    label: text,
    headline: text,
    detail: text,
    position,
  })
  .strict();
const LootColumnSchema = z
  .object({
    position,
    name: text,
    subtitle: text,
    rules: z.array(
      z
        .object({
          action: z.enum(['marcar', 'desmarcar', 'aviso']),
          label: text,
          detail: text,
          position,
        })
        .strict(),
    ),
  })
  .strict();
const NpcSchema = z
  .object({ position, group_label: text, name: text, location: text, detail: text })
  .strict();
const ConstellationSchema = z
  .object({
    slug,
    name_en: text,
    name_es: nullableText,
    tier_level: z.number().int().min(1).max(3).nullable(),
    affinity_required: z.record(slug, nonnegative).nullable(),
    affinity_granted: z.record(slug, nonnegative).nullable(),
    layout: z
      .object({
        nodes: z.array(
          z.object({ id: slug, x: z.number().finite(), y: z.number().finite() }).strict(),
        ),
        edges: z.array(z.object({ from: slug, to: slug }).strict()),
      })
      .strict(),
  })
  .strict();
const DevotionStepSchema = z
  .object({
    position,
    label: text,
    constellation_slug: slug.nullable(),
    title_override: nullableText,
    body: text,
    bindings: z.array(
      z.union([
        z.object({ power_en: text, skill_node_slug: slug }).strict(),
        z.object({ power_en: text, skill_node_slug: z.null(), skill_name_es: text }).strict(),
      ]),
    ),
    accent: z.enum(['storm', 'ember']),
    verification: z.enum(['verificado', 'sin_verificar']),
    kind: z.enum(['ruta', 'verificacion', 'limpieza']),
  })
  .strict()
  .superRefine((step, ctx) => {
    if (
      step.verification === 'verificado' &&
      step.bindings.some((binding) => binding.skill_node_slug === null)
    ) {
      fail(ctx, ['bindings'], 'una mención fuera del árbol requiere paso sin_verificar');
    }
  });

const BuildContentSchema = z
  .object({
    slug,
    locale: z.literal('es'),
    title: text,
    eyebrow: text,
    subtitle: text,
    summary: text,
    title_a_mastery_slug: slug,
    title_b_mastery_slug: slug.nullable(),
    damage_types: z.array(
      z.enum([
        'fisico',
        'fuego',
        'frio',
        'rayo',
        'acido',
        'vitalidad',
        'caos',
        'eter',
        'elemental',
        'sangrado',
        'mascotas',
      ]),
    ),
    playstyle: z.enum(['melee', 'rango', 'mascotas', 'hibrido']),
    content_tags: z.array(z.enum(['campana', 'shattered_realm', 'crucible', 'jefes', 'farmeo'])),
    author_slug: slug,
    source_slugs: z.array(slug),
    game_version: text,
    review_state: z.enum(REVIEW_STATES),
    rights_status: z.enum(RIGHTS_STATUSES),
    content_status: z.enum(CONTENT_STATUSES),
    published_at: isoDate.nullable(),
    video_url: httpUrl.nullable(),
    footer_disclaimer: text,
    hero_callout_title: text,
    hero_callout_body: z.array(text),
    masteries: z.array(BuildMasterySchema).min(1).max(2),
    priorities: z.array(PrioritySchema),
    skill_nodes: z.array(SkillNodeSchema),
    purchase_steps: z.array(PurchaseStepSchema),
    notes: z.array(NoteSchema),
    loot_filter_columns: z.array(LootColumnSchema),
    guide_npcs: z.array(NpcSchema),
    constellations: z.array(ConstellationSchema),
    devotion_steps: z.array(DevotionStepSchema),
    sections_meta: z.array(
      z.object({ section_key: slug, position, visible: z.boolean() }).strict(),
    ),
  })
  .strict();

type GuideReferences = z.infer<typeof BuildContentSchema> & {
  author: Pick<z.infer<typeof AuthorSchema>, 'slug'>;
  sources: Pick<z.infer<typeof SourceSchema>, 'slug'>[];
};

function validateGuide(build: GuideReferences, ctx: Ctx): void {
  for (const field of ['masteries', 'skill_nodes', 'constellations', 'sources'] as const) {
    const ids = build[field].map((entry) => entry.slug);
    if (new Set(ids).size !== ids.length) fail(ctx, [field], 'slugs duplicados');
  }
  const masterySlugs = new Set(build.masteries.map((mastery) => mastery.slug));
  for (const field of ['title_a_mastery_slug', 'title_b_mastery_slug'] as const) {
    const value = build[field];
    if (value && !masterySlugs.has(value)) fail(ctx, [field], 'maestría desconocida');
  }
  if (build.title_a_mastery_slug === build.title_b_mastery_slug) {
    fail(ctx, ['title_b_mastery_slug'], 'las maestrías deben ser distintas');
  }
  if (build.author.slug !== build.author_slug) fail(ctx, ['author_slug'], 'autor incoherente');
  const sourceSlugs = new Set(build.sources.map((source) => source.slug));
  if (
    new Set(build.source_slugs).size !== build.source_slugs.length ||
    build.source_slugs.length !== sourceSlugs.size ||
    build.source_slugs.some((value) => !sourceSlugs.has(value))
  ) {
    fail(ctx, ['source_slugs'], 'referencias de fuentes incoherentes');
  }
  const cycle = findParentCycle(build.skill_nodes);
  if (cycle) fail(ctx, ['skill_nodes'], `ciclo de padres en el árbol: ${cycle.join(', ')}`);
  const nodeSlugs = new Set(build.skill_nodes.map((node) => node.slug));
  const checkNode = (value: string, path: (string | number)[]) => {
    if (!nodeSlugs.has(value)) fail(ctx, path, 'nodo de guía desconocido');
  };
  build.skill_nodes.forEach((node, index) => {
    if (!masterySlugs.has(node.mastery_slug))
      fail(ctx, ['skill_nodes', index, 'mastery_slug'], 'maestría desconocida');
    if (node.parent_slug) checkNode(node.parent_slug, ['skill_nodes', index, 'parent_slug']);
  });
  build.priorities.forEach((priority, index) =>
    priority.skill_node_slugs.forEach((value) =>
      checkNode(value, ['priorities', index, 'skill_node_slugs']),
    ),
  );
  build.purchase_steps.forEach((step, index) => {
    if (step.mastery_slug && !masterySlugs.has(step.mastery_slug))
      fail(ctx, ['purchase_steps', index, 'mastery_slug'], 'maestría desconocida');
    step.highlights.forEach((highlight) =>
      checkNode(highlight.skill_node_slug, ['purchase_steps', index, 'highlights']),
    );
  });
  const constellations = new Set(build.constellations.map((constellation) => constellation.slug));
  build.devotion_steps.forEach((step, index) => {
    if (step.constellation_slug && !constellations.has(step.constellation_slug))
      fail(ctx, ['devotion_steps', index, 'constellation_slug'], 'constelación desconocida');
    step.bindings.forEach((binding) => {
      if (binding.skill_node_slug !== null)
        checkNode(binding.skill_node_slug, ['devotion_steps', index, 'bindings']);
    });
  });
}

export const BuildDocumentSchema = BuildContentSchema.extend({
  author: AuthorSchema,
  sources: z.array(SourceSchema),
  rights_confirmed_by: nullableText,
  rights_confirmed_on: isoDate.nullable(),
  reviewed_by: nullableText,
  reviewed_at: isoDate.nullable(),
  rights_notes: nullableText,
}).superRefine((build, ctx) => {
  validateGuide(build, ctx);
  if (build.review_state !== 'publicado') return;

  if (build.author_slug === PLACEHOLDER_AUTHOR_SLUG || build.author.is_placeholder) {
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

/** Existing consumers retain the editorial document name; public responses use the derived DTO. */
export const BuildSchema = BuildDocumentSchema;
export const PublicBuildSchema = BuildContentSchema.extend({
  author: PublicAuthorSchema,
  sources: z.array(PublicSourceSchema),
}).superRefine((build, ctx) => {
  validateGuide(build, ctx);
  if (build.review_state !== 'publicado')
    fail(ctx, ['review_state'], 'DTO público requiere publicado');
  if (!APPROVED_RIGHTS.includes(build.rights_status) || build.rights_status === 'link_only')
    fail(ctx, ['rights_status'], 'una guía pública requiere derechos sobre su contenido');
  if (!build.published_at) fail(ctx, ['published_at'], 'DTO público requiere fecha de publicación');
  if (build.author_slug === PLACEHOLDER_AUTHOR_SLUG)
    fail(ctx, ['author_slug'], 'autor no confirmado');
  if (build.source_slugs.length === 0) fail(ctx, ['source_slugs'], 'fuente requerida');
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
    external_url: httpUrl.nullable(),
    external_author: nullableText,
    source_slug: slug.nullable(),
    evaluated_on: isoDate.nullable(),
  })
  .strict()
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

const TierListContentSchema = z
  .object({
    slug,
    title: text,
    game_version: text,
    review_state: z.enum(REVIEW_STATES),
    author_slug: slug,
    masteries: z.array(MasterySchema),
    combinations: z.array(MasteryCombinationSchema),
    entries: z.array(TierEntrySchema),
  })
  .strict();

type TierListReferences = z.infer<typeof TierListContentSchema> & { sources: { slug: string }[] };
function validateTierList(list: TierListReferences, ctx: Ctx): void {
  const masteries = new Set(list.masteries.map((mastery) => mastery.slug));
  const combinations = new Set(list.combinations.map((combination) => combination.slug));
  const sources = new Set(list.sources.map((source) => source.slug));
  if (masteries.size !== list.masteries.length) fail(ctx, ['masteries'], 'maestrías duplicadas');
  if (combinations.size !== list.combinations.length)
    fail(ctx, ['combinations'], 'combinaciones duplicadas');
  if (sources.size !== list.sources.length) fail(ctx, ['sources'], 'fuentes duplicadas');
  list.combinations.forEach((combination, index) => {
    if (
      !masteries.has(combination.mastery_a_slug) ||
      (combination.mastery_b_slug && !masteries.has(combination.mastery_b_slug))
    ) {
      fail(ctx, ['combinations', index], 'maestría desconocida en combinación');
    }
  });
  list.entries.forEach((entry, index) => {
    if (!combinations.has(entry.combination_slug))
      fail(ctx, ['entries', index, 'combination_slug'], 'combinación desconocida');
    if (entry.source_slug && !sources.has(entry.source_slug))
      fail(ctx, ['entries', index, 'source_slug'], 'fuente desconocida');
  });
}

export const TierListSchema = TierListContentSchema.extend({
  sources: z.array(SourceSchema),
}).superRefine(validateTierList);
export const PublicTierListSchema = TierListContentSchema.extend({
  sources: z.array(PublicSourceSchema),
}).superRefine((list, ctx) => {
  validateTierList(list, ctx);
  if (list.review_state !== 'publicado')
    fail(ctx, ['review_state'], 'lista pública requiere publicado');
  list.entries.forEach((entry, index) => {
    if (entry.review_state !== 'publicado' || !APPROVED_RIGHTS.includes(entry.rights_status)) {
      fail(ctx, ['entries', index], 'entrada no publicable');
    }
  });
});

export const AssetSchema = z
  .object({
    slug,
    status: z.enum(ASSET_STATUSES),
    file_path: nullableText,
    origin_url: httpUrl.nullable(),
    rights_holder: nullableText,
    license_or_permission: nullableText,
    proof_ref: nullableText,
    recorded_on: isoDate,
    fallback_svg: z.string().min(1),
  })
  .superRefine((asset, ctx) => {
    if (asset.file_path && asset.status !== 'approved')
      fail(ctx, ['file_path'], 'archivo requiere activo aprobado');
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
export type BuildDocument = z.infer<typeof BuildDocumentSchema>;
export type PublicBuild = z.infer<typeof PublicBuildSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type PublicAuthor = z.infer<typeof PublicAuthorSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type PublicSource = z.infer<typeof PublicSourceSchema>;
export type Mastery = z.infer<typeof MasterySchema>;
export type MasteryCombination = z.infer<typeof MasteryCombinationSchema>;
export type TierList = z.infer<typeof TierListSchema>;
export type PublicTierList = z.infer<typeof PublicTierListSchema>;
export type TierEntry = z.infer<typeof TierEntrySchema>;
export type Asset = z.infer<typeof AssetSchema>;
