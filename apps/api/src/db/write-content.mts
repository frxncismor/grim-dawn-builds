import { randomUUID } from 'node:crypto';
import type { BuildDocument, MasteryTree, SeedErrorCode } from '@gd/domain';
import type { SeedData } from './seed.mjs';

export class SeedError extends Error {
  /**
   * `detail` is a plain identifier (a mastery id or slug); never SQL text or row values. The seeder
   * prints it through `failureLine`, which drops anything that is not an identifier.
   */
  constructor(
    readonly code: SeedErrorCode,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SeedError';
  }
}
export interface SeedClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
export type Table =
  | 'authors'
  | 'sources'
  | 'assets'
  | 'masteries'
  | 'mastery_combinations'
  | 'skills'
  | 'constellations'
  | 'builds'
  | 'tier_lists';
/** Table and column names are internal constants. All editorial values use pg parameters. */
async function upsert(
  client: SeedClient,
  table: Table,
  fields: Record<string, unknown>,
  conflict = ['slug'],
  fixtureOnly = false,
): Promise<string> {
  const columns = Object.keys(fields);
  const quoted = (name: string) => {
    if (!/^[a-z_]+$/.test(name)) throw new SeedError('column');
    return `"${name}"`;
  };
  const result = await client.query(
    `INSERT INTO "${table}" (${columns.map(quoted).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})
    ON CONFLICT (${conflict.map(quoted).join(',')}) DO UPDATE SET ${columns
      .filter((c) => !conflict.includes(c))
      .map((c) => `${quoted(c)}=EXCLUDED.${quoted(c)}`)
      .join(',')}
    ${fixtureOnly ? `WHERE "${table}".origin = 'fixture'` : ''}
    RETURNING id`,
    columns.map((c) => fields[c]),
  );
  const id = result.rows[0]?.['id'];
  if (typeof id !== 'string')
    throw new SeedError(fixtureOnly ? 'owned-content' : 'database-result');
  return id;
}
async function fixtureRoot(
  client: SeedClient,
  table: 'authors' | 'sources' | 'builds' | 'tier_lists',
  fields: Record<string, unknown>,
): Promise<string> {
  const old = await client.query(`SELECT origin FROM "${table}" WHERE slug=$1 FOR UPDATE`, [
    fields['slug'],
  ]);
  if (old.rows.some((row) => row['origin'] !== 'fixture')) throw new SeedError('owned-content');
  return upsert(client, table, { ...fields, origin: 'fixture' }, ['slug'], true);
}
async function insert(
  client: SeedClient,
  table: string,
  fields: Record<string, unknown>,
): Promise<void> {
  if (!/^[a-z_]+$/.test(table)) throw new SeedError('table');
  const columns = Object.keys(fields);
  if (columns.some((column) => !/^[a-z_]+$/.test(column))) throw new SeedError('column');
  await client.query(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`,
    columns.map((c) => fields[c]),
  );
}
function ref(map: Map<string, string>, slug: string): string {
  const id = map.get(slug);
  if (!id) throw new SeedError('reference');
  return id;
}

export interface ContentWritePolicy {
  origin: 'editor';
  root(
    table: 'authors' | 'sources' | 'builds' | 'tier_lists',
    fields: Record<string, unknown>,
  ): Promise<string>;
  resource(table: Table, fields: Record<string, unknown>, conflict?: string[]): Promise<string>;
  skillParent(id: string, parent: string | null): Promise<void>;
  references?: Partial<Record<'authors' | 'assets' | 'masteries' | 'builds', Map<string, string>>>;
  externalBuilds?: Map<string, Pick<BuildDocument, 'damage_types' | 'playstyle' | 'content_tags'>>;
}

/** Complete relational mapping. Callers own transaction, role and import/editor policy. */
export async function writeContentRows(
  client: SeedClient,
  data: SeedData,
  policy?: ContentWritePolicy,
): Promise<void> {
  const root = policy?.root ?? ((table, fields) => fixtureRoot(client, table, fields));
  const resource =
    policy?.resource ?? ((table, fields, conflict) => upsert(client, table, fields, conflict));
  const skillParent =
    policy?.skillParent ??
    (async (id, parent) => {
      await client.query('UPDATE skills SET parent_skill_id=$1 WHERE id=$2', [parent, id]);
    });
  const authors = new Map<string, string>(policy?.references?.authors);
  const sources = new Map<string, string>();
  const assets = new Map<string, string>(policy?.references?.assets);
  const masteries = new Map<string, string>(policy?.references?.masteries);
  const builds = new Map<string, string>(policy?.references?.builds);
  const combinations = new Map<string, string>();
  for (const author of data.authors) authors.set(author.slug, await root('authors', { ...author }));
  for (const source of data.sources) sources.set(source.slug, await root('sources', { ...source }));
  // `provenance` (game version, source path, sha256) lives only in the repo manifest, where
  // `assets:check` verifies it against the files; the table has no column for it (T015).
  for (const asset of data.assets) {
    const row: Record<string, unknown> = { ...asset };
    delete row['provenance'];
    assets.set(asset.slug, await resource('assets', row));
  }
  for (const mastery of data.masteries) {
    const { asset_slug, ...fields } = mastery;
    masteries.set(
      mastery.slug,
      await resource('masteries', {
        ...fields,
        asset_id: asset_slug ? ref(assets, asset_slug) : null,
      }),
    );
  }
  for (const tier of data.tierLists)
    for (const combo of tier.combinations) {
      if (combinations.has(combo.slug)) continue;
      const a = ref(masteries, combo.mastery_a_slug);
      const b = combo.mastery_b_slug ? ref(masteries, combo.mastery_b_slug) : null;
      const pair = b && b < a ? [b, a] : [a, b];
      combinations.set(
        combo.slug,
        await resource('mastery_combinations', {
          slug: combo.slug,
          mastery_a_id: pair[0],
          mastery_b_id: pair[1],
        }),
      );
    }
  // Resolve all roots first, so tier references can point at any build in this batch.
  for (const build of data.builds) {
    const fields = {
      slug: build.slug,
      locale: build.locale,
      title: build.title,
      title_a_mastery_id: ref(masteries, build.title_a_mastery_slug),
      title_b_mastery_id: build.title_b_mastery_slug
        ? ref(masteries, build.title_b_mastery_slug)
        : null,
      eyebrow: build.eyebrow,
      subtitle: build.subtitle,
      summary: build.summary,
      damage_types: build.damage_types,
      playstyle: build.playstyle,
      content_tags: build.content_tags,
      game_version: build.game_version,
      author_id: ref(authors, build.author_slug),
      review_state: build.review_state,
      rights_status: build.rights_status,
      rights_notes: build.rights_notes,
      rights_confirmed_by: build.rights_confirmed_by,
      rights_confirmed_on: build.rights_confirmed_on,
      content_status: build.content_status,
      reviewed_by: build.reviewed_by,
      reviewed_at: build.reviewed_at,
      published_at: build.published_at,
      video_url: build.video_url,
      footer_disclaimer: build.footer_disclaimer,
      hero_callout_title: build.hero_callout_title,
      hero_callout_body: build.hero_callout_body,
    };
    builds.set(build.slug, await root('builds', fields));
  }
  for (const build of data.builds) {
    const build_id = ref(builds, build.slug);
    for (const table of [
      'build_priorities',
      'build_purchase_steps',
      'build_devotion_steps',
      'build_constellations',
      'build_notes',
      'loot_filter_columns',
      'build_guides_npcs',
      'build_sections_meta',
      'build_masteries',
      'build_skill_nodes',
      'build_sources',
    ]) {
      await client.query(`DELETE FROM "${table}" WHERE build_id=$1`, [build_id]);
    }
    for (const [index, source] of build.sources.entries())
      await insert(client, 'build_sources', {
        build_id,
        source_id: ref(sources, source.slug),
        role: index === 0 ? 'principal' : 'referencia',
      });
    for (const [index, mastery] of build.masteries.entries())
      await insert(client, 'build_masteries', {
        build_id,
        mastery_id: ref(masteries, mastery.slug),
        position: index + 1,
        role_text: mastery.role_text,
      });
    const skills = new Map<string, string>();
    for (const node of build.skill_nodes)
      skills.set(
        node.slug,
        await resource(
          'skills',
          {
            mastery_id: ref(masteries, node.mastery_slug),
            slug: node.slug,
            name_es: node.name_es,
            name_en: node.name_en,
            bar_required: node.bar_required,
          },
          ['mastery_id', 'slug'],
        ),
      );
    for (const node of build.skill_nodes)
      await skillParent(
        ref(skills, node.slug),
        node.parent_slug ? ref(skills, node.parent_slug) : null,
      );
    const nodes = new Map<string, string>();
    for (const [index, node] of build.skill_nodes.entries()) {
      const id = randomUUID();
      nodes.set(node.slug, id);
      await insert(client, 'build_skill_nodes', {
        id,
        build_id,
        skill_id: ref(skills, node.slug),
        skill_node_id: node.skill_node_id ?? null,
        status: node.status,
        tag: node.tag,
        rationale: node.rationale,
        max_points_hint: node.max_points_hint,
        points_label: node.points_label,
        layout_x: node.layout.x,
        layout_y: node.layout.y,
        display_order: index + 1,
      });
    }
    for (const [index, priority] of build.priorities.entries()) {
      const { skill_node_slugs, ...fields } = priority;
      await insert(client, 'build_priorities', {
        ...fields,
        build_id,
        position: index + 1,
        skill_node_ids: skill_node_slugs.map((slug) => ref(nodes, slug)),
      });
    }
    for (const step of build.purchase_steps) {
      const { mastery_slug, highlights, ...fields } = step;
      await insert(client, 'build_purchase_steps', {
        ...fields,
        build_id,
        mastery_id: mastery_slug ? ref(masteries, mastery_slug) : null,
        highlights: JSON.stringify(highlights),
      });
    }
    for (const note of build.notes) await insert(client, 'build_notes', { ...note, build_id });
    for (const column of build.loot_filter_columns) {
      const { rules, ...fields } = column;
      const id = randomUUID();
      await insert(client, 'loot_filter_columns', { ...fields, id, build_id });
      for (const rule of rules)
        await insert(client, 'loot_filter_rules', { ...rule, column_id: id });
    }
    for (const npc of build.guide_npcs)
      await insert(client, 'build_guides_npcs', { ...npc, build_id });
    const constellations = new Map<string, string>();
    for (const [index, constellation] of build.constellations.entries()) {
      const id = await resource('constellations', {
        ...constellation,
        affinity_required:
          constellation.affinity_required === null
            ? null
            : JSON.stringify(constellation.affinity_required),
        affinity_granted:
          constellation.affinity_granted === null
            ? null
            : JSON.stringify(constellation.affinity_granted),
        layout: JSON.stringify(constellation.layout),
      });
      constellations.set(constellation.slug, id);
      await insert(client, 'build_constellations', {
        build_id,
        constellation_id: id,
        position: index + 1,
      });
    }
    for (const step of build.devotion_steps) {
      const { constellation_slug, bindings, ...fields } = step;
      await insert(client, 'build_devotion_steps', {
        ...fields,
        build_id,
        constellation_id: constellation_slug ? ref(constellations, constellation_slug) : null,
        bindings: JSON.stringify(bindings),
      });
    }
    for (const section of build.sections_meta)
      await insert(client, 'build_sections_meta', { ...section, build_id });
  }
  for (const tier of data.tierLists) {
    const tier_list_id = await root('tier_lists', {
      slug: tier.slug,
      title: tier.title,
      game_version: tier.game_version,
      review_state: tier.review_state,
      author_id: ref(authors, tier.author_slug),
    });
    await client.query('DELETE FROM tier_entries WHERE tier_list_id=$1', [tier_list_id]);
    for (const [index, entry] of tier.entries.entries()) {
      const { combination_slug, build_slug, source_slug, ...fields } = entry;
      const combo = tier.combinations.find((c) => c.slug === combination_slug);
      if (!combo) throw new SeedError('reference');
      const build = build_slug
        ? (data.builds.find((b) => b.slug === build_slug) ??
          policy?.externalBuilds?.get(build_slug))
        : undefined;
      await insert(client, 'tier_entries', {
        ...fields,
        tier_list_id,
        combination_id: ref(combinations, combination_slug),
        build_id: build_slug ? ref(builds, build_slug) : null,
        source_id: source_slug ? ref(sources, source_slug) : null,
        mastery_ids: [combo.mastery_a_slug, combo.mastery_b_slug]
          .filter((slug): slug is string => slug !== null)
          .map((slug) => ref(masteries, slug)),
        damage_types: build?.damage_types ?? [],
        playstyle: build?.playstyle ?? null,
        content_tags: build?.content_tags ?? [],
        note: '',
        position: index + 1,
        origin: policy?.origin ?? 'fixture',
      });
    }
  }
}

/**
 * A mastery absent from the catalog is retired (spec 005 T007, Q-A = A): its nodes and row are deleted
 * in the caller's transaction. `build_skill_nodes.skill_node_id` is `ON DELETE RESTRICT`, so a guide
 * that still uses one of its nodes makes the delete fail; that aborts the seed and names the mastery
 * (FR-012: the id travels as `SeedError.detail` to the operator's output).
 *
 * Callers that also rewrite guides run this AFTER `writeContentRows`: a guide that stops using a
 * retired mastery in the same seed has already dropped its nodes by then (T036, C-003). An empty
 * catalog retires nothing (T036, C-002): it is a missing fixture, not a request to delete them all.
 */
export async function retireMasteries(client: SeedClient, keep: readonly string[]): Promise<void> {
  if (!keep.length) return;
  const retired = await client.query(
    'SELECT id FROM mastery_trees WHERE id <> ALL($1::text[]) ORDER BY id',
    [keep],
  );
  for (const row of retired.rows) {
    const id = row['id'];
    if (typeof id !== 'string') throw new SeedError('database-result');
    try {
      await client.query('UPDATE catalog_skill_nodes SET parent_id = NULL WHERE mastery_id = $1', [
        id,
      ]);
      await client.query('DELETE FROM catalog_skill_nodes WHERE mastery_id = $1', [id]);
      await client.query('DELETE FROM mastery_trees WHERE id = $1', [id]);
    } catch (error) {
      // 23503 = foreign_key_violation: a guide still references this mastery's nodes.
      if ((error as { code?: unknown } | null)?.code === '23503')
        throw new SeedError('reference', id);
      throw error;
    }
  }
}

/**
 * Second half of the node pruning (spec006 T005, F-002): once the guides were rewritten, delete the
 * nodes the catalog no longer lists. A node some guide still uses fails with 23503 (`ON DELETE
 * RESTRICT`); it becomes `SeedError('reference', <mastery id>)` and the caller's transaction rolls
 * back, so nothing is left half-pruned. Callers run it after `writeContentRows`, next to
 * `retireMasteries`.
 */
export async function pruneCatalogNodes(
  client: SeedClient,
  catalog: readonly MasteryTree[],
): Promise<void> {
  for (const tree of catalog) {
    try {
      await client.query(
        'DELETE FROM catalog_skill_nodes WHERE mastery_id = $1 AND id <> ALL($2::text[])',
        [tree.mastery.id, tree.nodes.map((n) => n.id)],
      );
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code === '23503')
        throw new SeedError('reference', tree.mastery.id);
      throw error;
    }
  }
}

/**
 * Game-derived mastery catalog (spec 003). Idempotent refresh per mastery: upsert by id, then drop the
 * nodes no longer in the fixture. Parent links are cleared first so stale parents can be deleted and
 * re-pointed without tripping the composite FK; nodes are then upserted parents-first (tier order).
 * Retiring masteries missing from the catalog is a separate step (`retireMasteries`, T007/T036).
 * All values go through pg parameters; table/column names are constants.
 */
export async function writeCatalogRows(
  client: SeedClient,
  catalog: readonly MasteryTree[],
): Promise<void> {
  // `mastery_trees.slug` is UNIQUE and the upsert below only resolves conflicts by id. Retirement runs
  // after the upsert (T036, C-003), so a mastery that disappears (or keeps its id but trades slugs)
  // would still hold a slug an incoming tree claims. Park those slugs under a throwaway one first; a
  // kept mastery gets its real slug back from the upsert, a retired one is deleted afterwards, and a
  // retired mastery still used by guides still aborts with `reference (<id>)` (T041, C-101/F-001).
  if (catalog.length)
    await client.query(
      `UPDATE mastery_trees SET slug = 'released-' || id
       WHERE slug = ANY($2::text[])
         AND (id, slug) NOT IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
      [catalog.map((t) => t.mastery.id), catalog.map((t) => t.mastery.slug)],
    );
  for (const tree of catalog) {
    const m = tree.mastery;
    await client.query(
      `INSERT INTO mastery_trees (id, slug, name_en, name_es, game_version, source_sha256)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name_en=EXCLUDED.name_en,
         name_es=EXCLUDED.name_es, game_version=EXCLUDED.game_version,
         source_sha256=EXCLUDED.source_sha256, updated_at=now()`,
      [m.id, m.slug, m.name.en, m.name.es, tree.game_version, tree.source.sha256],
    );
    await client.query(
      'UPDATE catalog_skill_nodes SET parent_id = NULL WHERE mastery_id = $1 AND parent_id IS NOT NULL',
      [m.id],
    );
    // Only the absent nodes no guide references go now: it frees their grid cells for the upsert
    // below. An absent node a guide still uses stays until `pruneCatalogNodes`, which runs after the
    // guides were rewritten (spec006 T005, F-002).
    const incoming = tree.nodes.map((n) => n.id);
    await client.query(
      `DELETE FROM catalog_skill_nodes c
       WHERE c.mastery_id = $1 AND c.id <> ALL($2::text[])
         AND NOT EXISTS (SELECT 1 FROM build_skill_nodes b WHERE b.skill_node_id = c.id)`,
      [m.id, incoming],
    );
    // A still-referenced absent node that holds the cell of an incoming node would make the upsert
    // fail with 23505; name the mastery instead (the guide still uses a node the catalog removed).
    const blocked = await client.query(
      `SELECT 1 FROM catalog_skill_nodes c
       WHERE c.mastery_id = $1 AND c.id <> ALL($2::text[])
         AND (c.grid_col, c.grid_row) IN (SELECT * FROM unnest($3::int[], $4::int[]))
       LIMIT 1`,
      [m.id, incoming, tree.nodes.map((n) => n.grid.col), tree.nodes.map((n) => n.grid.row)],
    );
    if (blocked.rows.length) throw new SeedError('reference', m.id);
    for (const n of [...tree.nodes].sort((a, b) => a.tier - b.tier)) {
      await client.query(
        `INSERT INTO catalog_skill_nodes (id, mastery_id, name_en, name_es, kind, circular, tier,
           bar_required, grid_col, grid_row, max_points, ultimate_points, parent_id, icon, icon_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET name_en=EXCLUDED.name_en, name_es=EXCLUDED.name_es,
           kind=EXCLUDED.kind, circular=EXCLUDED.circular, tier=EXCLUDED.tier,
           bar_required=EXCLUDED.bar_required, grid_col=EXCLUDED.grid_col, grid_row=EXCLUDED.grid_row,
           max_points=EXCLUDED.max_points, ultimate_points=EXCLUDED.ultimate_points,
           parent_id=EXCLUDED.parent_id, icon=EXCLUDED.icon, icon_id=EXCLUDED.icon_id,
           updated_at=now()`,
        [
          n.id,
          m.id,
          n.name.en,
          n.name.es,
          n.kind,
          n.circular,
          n.tier,
          n.bar_required,
          n.grid.col,
          n.grid.row,
          n.max_points,
          n.ultimate_points ?? null,
          n.parent_id,
          n.icon ?? null,
          n.icon_id ?? null,
        ],
      );
    }
  }
}
