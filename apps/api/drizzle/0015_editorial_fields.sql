-- Spec 009 T006 (data-model.md). Editorial fields of a guide: `intro`, `stage`, `changelog`, `pros`,
-- `cons`, `hotbar`, `key_devotions`. Existing rows take the defaults (no intro, stage 'ambas', empty
-- lists), which is the neutral value the guide page hides. The CHECKs mirror the *shape* rules of
-- `BuildContentSchema`; the referential rules (hotbar inside `skill_nodes`, key_devotions inside
-- `constellations`) are enforced by the domain and by the write path, as for every internal reference.
-- The helpers are pure and immutable so a CHECK may call them.
CREATE FUNCTION build_texts_valid(items text[], max_items integer, max_length integer) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT cardinality(items) <= max_items AND NOT EXISTS (
    SELECT 1 FROM unnest(items) AS t(value)
    WHERE value IS NULL OR char_length(value) NOT BETWEEN 1 AND max_length)
$$;
--> statement-breakpoint
CREATE FUNCTION build_slugs_valid(items text[], max_items integer) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT cardinality(items) <= max_items
    AND (SELECT count(DISTINCT value) FROM unnest(items) AS t(value)) = cardinality(items)
    AND NOT EXISTS (SELECT 1 FROM unnest(items) AS t(value)
      WHERE value IS NULL OR value !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
$$;
--> statement-breakpoint
-- Entries are `{ date, text }` objects with an ISO date and a text of at most 200 characters; dates
-- strictly descending (so unique) and none before `published_at` when it is set.
CREATE FUNCTION build_changelog_valid(entries jsonb, published text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT jsonb_typeof(entries) = 'array' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(entries) WITH ORDINALITY AS e(value, position)
    WHERE jsonb_typeof(e.value) <> 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(e.value)) <> 2
      OR jsonb_typeof(e.value -> 'date') IS DISTINCT FROM 'string'
      OR jsonb_typeof(e.value -> 'text') IS DISTINCT FROM 'string'
      OR (e.value ->> 'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR char_length(e.value ->> 'text') NOT BETWEEN 1 AND 200
      OR (published IS NOT NULL AND (e.value ->> 'date') < published)
  ) AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(entries) WITH ORDINALITY AS a(value, position)
    JOIN jsonb_array_elements(entries) WITH ORDINALITY AS b(value, position) ON a.position < b.position
    WHERE (a.value ->> 'date') <= (b.value ->> 'date')
  )
$$;
--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "intro" text;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "stage" text DEFAULT 'ambas' NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "changelog" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "pros" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "cons" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "hotbar" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD COLUMN "key_devotions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_intro_ck" CHECK ("builds"."intro" IS NULL OR char_length("builds"."intro") BETWEEN 1 AND 400);--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_stage_ck" CHECK ("builds"."stage" IN ('subida', 'final', 'ambas'));--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_changelog_ck" CHECK (build_changelog_valid("builds"."changelog", to_char("builds"."published_at", 'YYYY-MM-DD')));--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_pros_ck" CHECK (build_texts_valid("builds"."pros", 5, 120));--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_cons_ck" CHECK (build_texts_valid("builds"."cons", 5, 120));--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_hotbar_ck" CHECK (build_slugs_valid("builds"."hotbar", 10));--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_key_devotions_ck" CHECK (build_slugs_valid("builds"."key_devotions", 6));
--> statement-breakpoint
-- The public view keeps its columns in place and appends the editorial ones; the guide document
-- serves the seven fields (CREATE OR REPLACE keeps the grants).
CREATE OR REPLACE VIEW v_public_builds AS
SELECT id, slug, locale, title, title_a_mastery_id, title_b_mastery_id, eyebrow,
  subtitle, summary, damage_types, playstyle, content_tags, game_version, author_id,
  content_status, published_at, video_url, footer_disclaimer, hero_callout_title,
  hero_callout_body, review_state, rights_status,
  intro, stage, changelog, pros, cons, hotbar, key_devotions
FROM builds WHERE review_state = 'publicado'
  AND rights_status IN ('own_original', 'licensed', 'permission_granted');
--> statement-breakpoint
CREATE OR REPLACE VIEW v_public_build_documents AS
SELECT b.id, b.slug, jsonb_build_object(
  'slug', b.slug, 'locale', b.locale, 'title', b.title,
  'title_a_mastery_slug', ma.slug, 'title_b_mastery_slug', mb.slug,
  'eyebrow', b.eyebrow, 'subtitle', b.subtitle, 'summary', b.summary,
  'damage_types', b.damage_types, 'playstyle', b.playstyle, 'content_tags', b.content_tags,
  'author_slug', a.slug, 'game_version', b.game_version,
  'review_state', b.review_state, 'rights_status', b.rights_status,
  'content_status', b.content_status, 'published_at', b.published_at,
  'video_url', b.video_url, 'footer_disclaimer', b.footer_disclaimer,
  'hero_callout_title', b.hero_callout_title, 'hero_callout_body', b.hero_callout_body,
  'intro', b.intro, 'stage', b.stage, 'changelog', b.changelog, 'pros', b.pros, 'cons', b.cons,
  'hotbar', b.hotbar, 'key_devotions', b.key_devotions,
  'author', jsonb_build_object('slug', a.slug, 'display_name', a.display_name, 'bio', a.bio, 'url', a.url),
  'source_slugs', COALESCE((SELECT jsonb_agg(s.slug ORDER BY s.slug)
    FROM build_sources bs JOIN v_public_sources s ON s.id = bs.source_id WHERE bs.build_id = b.id), '[]'),
  'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug', s.slug, 'kind', s.kind, 'title', s.title, 'url', s.url,
    'author_name', s.author_name, 'license_note', s.license_note, 'retrieved_on', s.retrieved_on) ORDER BY s.slug)
    FROM build_sources bs JOIN v_public_sources s ON s.id = bs.source_id WHERE bs.build_id = b.id), '[]'),
  'masteries', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug', m.slug, 'name_es', m.name_es, 'name_en', m.name_en, 'role_text', bm.role_text)
    ORDER BY bm.position, m.slug) FROM build_masteries bm JOIN masteries m ON m.id = bm.mastery_id
    WHERE bm.build_id = b.id), '[]'),
  'skill_nodes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug', s.slug, 'mastery_slug', m.slug, 'name_es', s.name_es, 'name_en', s.name_en,
    'bar_required', s.bar_required, 'parent_slug', parent.slug, 'status', n.status,
    'tag', n.tag, 'rationale', n.rationale, 'max_points_hint', n.max_points_hint,
    'points_label', n.points_label, 'layout', jsonb_build_object('x', n.layout_x, 'y', n.layout_y))
    || CASE WHEN n.skill_node_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('skill_node_id', n.skill_node_id) END
    ORDER BY n.display_order, s.slug) FROM build_skill_nodes n JOIN skills s ON s.id = n.skill_id
    JOIN masteries m ON m.id = s.mastery_id LEFT JOIN skills parent ON parent.id = s.parent_skill_id
    WHERE n.build_id = b.id), '[]'),
  'priorities', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'rank', p.rank, 'group_label', p.group_label, 'headline', p.headline, 'note', p.note,
    'skill_node_slugs', COALESCE((SELECT jsonb_agg(s.slug ORDER BY ref.ord)
      FROM unnest(p.skill_node_ids) WITH ORDINALITY ref(id, ord)
      JOIN build_skill_nodes n ON n.id = ref.id AND n.build_id = b.id JOIN skills s ON s.id = n.skill_id), '[]'))
    ORDER BY p.position, p.id) FROM build_priorities p WHERE p.build_id = b.id), '[]'),
  'purchase_steps', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'position', p.position, 'threshold_label', p.threshold_label, 'mastery_slug', m.slug,
    'title', p.title, 'body', p.body, 'highlights', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'skill_node_slug', h.value->'skill_node_slug', 'points', h.value->'points') ORDER BY h.ord)
      FROM jsonb_array_elements(p.highlights) WITH ORDINALITY h(value, ord)), '[]'))
    ORDER BY p.position, p.id) FROM build_purchase_steps p LEFT JOIN masteries m ON m.id = p.mastery_id
    WHERE p.build_id = b.id), '[]'),
  'notes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'kind', n.kind, 'label', n.label, 'headline', n.headline, 'detail', n.detail, 'position', n.position)
    ORDER BY n.position, n.id) FROM build_notes n WHERE n.build_id = b.id), '[]'),
  'loot_filter_columns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'position', c.position, 'name', c.name, 'subtitle', c.subtitle,
    'rules', COALESCE((SELECT jsonb_agg(jsonb_build_object('action', r.action,
      'label', r.label, 'detail', r.detail, 'position', r.position) ORDER BY r.position, r.id)
      FROM loot_filter_rules r WHERE r.column_id = c.id), '[]')) ORDER BY c.position, c.id)
    FROM loot_filter_columns c WHERE c.build_id = b.id), '[]'),
  'guide_npcs', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'position', n.position, 'group_label', n.group_label, 'name', n.name, 'location', n.location, 'detail', n.detail)
    ORDER BY n.position, n.id) FROM build_guides_npcs n WHERE n.build_id = b.id), '[]'),
  'constellations', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'slug', c.slug, 'name_en', c.name_en, 'name_es', c.name_es, 'tier_level', c.tier_level,
    'affinity_required', c.affinity_required, 'affinity_granted', c.affinity_granted,
    'layout', jsonb_build_object(
      'nodes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', n.value->'id',
        'x', n.value->'x', 'y', n.value->'y') ORDER BY n.ord)
        FROM jsonb_array_elements(c.layout->'nodes') WITH ORDINALITY n(value, ord)), '[]'),
      'edges', COALESCE((SELECT jsonb_agg(jsonb_build_object('from', e.value->'from',
        'to', e.value->'to') ORDER BY e.ord)
        FROM jsonb_array_elements(c.layout->'edges') WITH ORDINALITY e(value, ord)), '[]')))
    ORDER BY bc.position, c.slug)
    FROM build_constellations bc JOIN constellations c ON c.id = bc.constellation_id WHERE bc.build_id = b.id), '[]'),
  'devotion_steps', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'position', d.position, 'label', d.label, 'constellation_slug', c.slug,
    'title_override', d.title_override, 'body', d.body, 'accent', d.accent,
    'verification', d.verification, 'kind', d.kind,
    'bindings', COALESCE((SELECT jsonb_agg((jsonb_build_object(
      'power_en', v.value->'power_en', 'skill_node_slug', v.value->'skill_node_slug') ||
      CASE WHEN v.value->'skill_node_slug' = 'null'::jsonb
        THEN jsonb_build_object('skill_name_es', v.value->'skill_name_es') ELSE '{}'::jsonb END) ORDER BY v.ord)
      FROM jsonb_array_elements(d.bindings) WITH ORDINALITY v(value, ord)), '[]')) ORDER BY d.position, d.id)
    FROM build_devotion_steps d LEFT JOIN constellations c ON c.id = d.constellation_id WHERE d.build_id = b.id), '[]'),
  'sections_meta', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'section_key', m.section_key, 'position', m.position, 'visible', m.visible) ORDER BY m.position, m.section_key)
    FROM build_sections_meta m WHERE m.build_id = b.id), '[]')
) AS document
FROM v_public_builds b JOIN v_public_authors a ON a.id = b.author_id
JOIN masteries ma ON ma.id = b.title_a_mastery_id LEFT JOIN masteries mb ON mb.id = b.title_b_mastery_id;
