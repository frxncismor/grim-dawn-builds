import { randomUUID } from 'node:crypto';
import type { BuildDocument } from '@gd/domain';
import type { SeedData } from './seed.mjs';

export class SeedError extends Error {
  constructor(readonly code: string) {
    super(code);
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
  for (const asset of data.assets) assets.set(asset.slug, await resource('assets', { ...asset }));
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
