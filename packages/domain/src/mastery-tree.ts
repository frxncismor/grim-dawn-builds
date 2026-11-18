import { z } from 'zod';

/**
 * Canonical mastery-tree catalog (spec 003). Derived from the game's database, never edited
 * by hand; editorial fields (status, rationale, points_label) live in the guide document.
 * Field map and tier table: specs/003-catalogo-arboles-maestria/research.md (T002).
 */

/** Engine thresholds `skillMasteryTierLevel`: index i is the bar points required for tier i + 1. */
export const TIER_BAR_REQUIRED = [1, 5, 10, 15, 20, 25, 32, 40, 50] as const;

export const SKILL_KINDS = ['active', 'passive', 'modifier', 'transmuter'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

/**
 * Public icon identifier (spec004 T025): opaque and stable, derived from the texture by the extractor
 * (`ic-` + first 16 hex of the SHA-256 of the texture path). It is not the game's texture path
 * (S-004) and is the only handle the public contract has to an icon: file name and manifest slug.
 */
export const ICON_ID_PATTERN = /^ic-[0-9a-f]{16}$/;
export const iconIdSchema = z.string().regex(ICON_ID_PATTERN, 'icon_id con forma ic-<16 hex>');

const masteryId = z.string().regex(/^class\d{2}$/, 'id de maestría classNN');
export const skillNodeIdSchema = z
  .string()
  .regex(
    /^class\d{2}\/[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
    'id de nodo classNN/<registro> en minúsculas',
  );
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug kebab-case en minúsculas ASCII');
const text = z.string().min(1);
const localizedName = z.object({ en: text, es: text }).strict();
const positiveInt = z.number().int().positive();

const tierSchema = z.number().int().min(1).max(TIER_BAR_REQUIRED.length);

/** Returns the ids that take part in a dependency cycle, or null if the forest is acyclic. */
export function findDependencyCycle(
  nodes: readonly { id: string; parent_id: string | null }[],
): string[] | null {
  const parentOf = new Map(nodes.map((n) => [n.id, n.parent_id]));
  const done = new Set<string>();
  for (const start of parentOf.keys()) {
    if (done.has(start)) continue;
    const path: string[] = [];
    const inPath = new Set<string>();
    let current: string | null | undefined = start;
    while (current && parentOf.has(current) && !done.has(current)) {
      if (inPath.has(current)) return path.slice(path.indexOf(current));
      inPath.add(current);
      path.push(current);
      current = parentOf.get(current);
    }
    path.forEach((p) => done.add(p));
  }
  return null;
}

const skillNodeShape = {
  id: skillNodeIdSchema,
  name: localizedName,
  kind: z.enum(SKILL_KINDS),
  /** Circular UI marker (`isCircular`); false when absent in the game data. */
  circular: z.boolean(),
  /** Skill tier 1-9; equals the grid column. */
  tier: tierSchema,
  /** Mastery bar points needed to unlock the tier (TIER_BAR_REQUIRED[tier - 1]). */
  bar_required: z.number().int().positive(),
  max_points: positiveInt,
  /** Rank cap with item bonuses; absent when the game data does not provide it. */
  ultimate_points: positiveInt.optional(),
  /** Column = tier; row = raw UI vertical position (non-uniform spacing, research T002 §2). */
  grid: z
    .object({
      col: tierSchema,
      row: z.number().int().nonnegative(),
    })
    .strict(),
  parent_id: skillNodeIdSchema.nullable(),
  /** Public icon handle; absent when the game data has no icon for the node. */
  icon_id: iconIdSchema.optional(),
};

interface NodeFacts {
  id: string;
  tier: number;
  bar_required: number;
  max_points: number;
  ultimate_points?: number | undefined;
  grid: { col: number; row: number };
  parent_id: string | null;
}

function refineNode(n: NodeFacts, ctx: z.RefinementCtx): void {
  const expected = TIER_BAR_REQUIRED[n.tier - 1];
  if (n.bar_required !== expected)
    ctx.addIssue({
      code: 'custom',
      path: ['bar_required'],
      message: `bar_required debe ser ${expected} para el tier ${n.tier}`,
    });
  if (n.grid.col !== n.tier)
    ctx.addIssue({
      code: 'custom',
      path: ['grid', 'col'],
      message: 'la columna de la rejilla debe coincidir con el tier',
    });
  if (n.ultimate_points !== undefined && n.ultimate_points < n.max_points)
    ctx.addIssue({
      code: 'custom',
      path: ['ultimate_points'],
      message: 'ultimate_points no puede ser menor que max_points',
    });
  if (n.parent_id === n.id)
    ctx.addIssue({
      code: 'custom',
      path: ['parent_id'],
      message: 'un nodo no puede ser su propio padre',
    });
}

/**
 * Source node (fixtures, extractor, database write): carries `icon`, the game's internal texture
 * path. It is never public (S-004): the public contract is `PublicSkillNodeSchema`.
 */
export const CatalogSkillNodeSchema = z
  .object({
    ...skillNodeShape,
    /** Texture name only; art is never versioned (FR-014). Never exposed publicly (S-004). */
    icon: text.optional(),
  })
  .strict()
  .superRefine((n, ctx) => {
    refineNode(n, ctx);
    if (n.icon !== undefined && n.icon_id === undefined)
      ctx.addIssue({
        code: 'custom',
        path: ['icon_id'],
        message: 'un nodo con textura debe declarar su icon_id público',
      });
  });

/** Public node (API, emitted JSON): same node without `icon`; `.strict()` rejects it. */
export const PublicSkillNodeSchema = z.object(skillNodeShape).strict().superRefine(refineNode);

function masteryTreeSchema<N extends z.ZodType<NodeFacts>>(node: N) {
  return z
    .object({
      mastery: z.object({ id: masteryId, slug, name: localizedName }).strict(),
      game_version: text,
      source: z
        .object({
          game_version: text,
          sha256: z
            .array(z.string().regex(/^[0-9a-f]{64}$/, 'sha256 hexadecimal en minúsculas'))
            .min(1),
        })
        .strict(),
      nodes: z.array(node).min(1),
    })
    .strict()
    .superRefine((tree, ctx) => {
      const fail = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message });

      if (tree.source.game_version !== tree.game_version)
        fail(['source', 'game_version'], 'source.game_version debe coincidir con game_version');

      const byId = new Map<string, NodeFacts & { tier: number }>();
      const cells = new Map<string, string>();
      tree.nodes.forEach((n, i) => {
        if (byId.has(n.id)) fail(['nodes', i, 'id'], `id duplicado: ${n.id}`);
        else byId.set(n.id, n);
        const cell = `${n.grid.col}:${n.grid.row}`;
        const other = cells.get(cell);
        if (other !== undefined)
          fail(['nodes', i, 'grid'], `colisión de rejilla en ${cell} con ${other}`);
        else cells.set(cell, n.id);
      });

      tree.nodes.forEach((n, i) => {
        if (n.parent_id === null) return;
        const parent = byId.get(n.parent_id);
        if (!parent) fail(['nodes', i, 'parent_id'], `padre inexistente: ${n.parent_id}`);
        else if (parent.tier >= n.tier)
          fail(['nodes', i, 'tier'], `el tier de ${n.id} debe ser mayor que el de su padre`);
      });

      const cycle = findDependencyCycle(tree.nodes);
      if (cycle) fail(['nodes'], `ciclo de dependencias: ${cycle.join(', ')}`);
    });
}

/** Source tree (fixtures, extractor, seed): nodes may carry `icon`. */
export const MasteryTreeSchema = masteryTreeSchema(CatalogSkillNodeSchema);
/** Public tree (`GET /api/v1/masteries/:slug`, `assets/mastery-trees/*.json`): no `icon` (S-004). */
export const PublicMasteryTreeSchema = masteryTreeSchema(PublicSkillNodeSchema);

export type CatalogSkillNode = z.infer<typeof CatalogSkillNodeSchema>;
export type MasteryTree = z.infer<typeof MasteryTreeSchema>;
export type PublicSkillNode = z.infer<typeof PublicSkillNodeSchema>;
export type PublicMasteryTree = z.infer<typeof PublicMasteryTreeSchema>;
