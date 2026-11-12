CREATE TABLE "build_constellations" (
	"build_id" uuid NOT NULL,
	"constellation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "build_constellations_build_id_constellation_id_pk" PRIMARY KEY("build_id","constellation_id")
);
--> statement-breakpoint
ALTER TABLE "constellations" ALTER COLUMN "tier_level" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "build_priorities" ADD COLUMN "position" integer;
--> statement-breakpoint
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY build_id ORDER BY rank NULLS LAST, id) AS position
  FROM build_priorities
) UPDATE build_priorities p SET position = ordered.position FROM ordered WHERE p.id = ordered.id;
--> statement-breakpoint
ALTER TABLE build_priorities ALTER COLUMN position SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "slug" text;
--> statement-breakpoint
-- Schema maintenance by the owner must also upgrade already-bootstrapped rows.
-- Re-enable this specific fixture-import guard before exposing the new schema.
ALTER TABLE sources DISABLE TRIGGER gates_sources_fixture;
--> statement-breakpoint
UPDATE sources SET slug = 'legacy-' || id::text;
--> statement-breakpoint
ALTER TABLE sources ENABLE TRIGGER gates_sources_fixture;
--> statement-breakpoint
ALTER TABLE sources ALTER COLUMN slug SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "build_constellations" ADD CONSTRAINT "build_constellations_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_constellations" ADD CONSTRAINT "build_constellations_constellation_id_constellations_id_fk" FOREIGN KEY ("constellation_id") REFERENCES "public"."constellations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_slug_unique" UNIQUE("slug");
--> statement-breakpoint
INSERT INTO build_constellations (build_id, constellation_id, position)
SELECT build_id, constellation_id, min(position) FROM build_devotion_steps
WHERE constellation_id IS NOT NULL GROUP BY build_id, constellation_id;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_constellations TO importer;
--> statement-breakpoint
-- Preserve existing view columns in place; append safe public states.
CREATE OR REPLACE VIEW v_public_builds AS
SELECT id, slug, locale, title, title_a_mastery_id, title_b_mastery_id, eyebrow,
  subtitle, summary, damage_types, playstyle, content_tags, game_version, author_id,
  content_status, published_at, video_url, footer_disclaimer, hero_callout_title,
  hero_callout_body, review_state, rights_status
FROM builds WHERE review_state = 'publicado'
  AND rights_status IN ('own_original', 'licensed', 'permission_granted');
--> statement-breakpoint
CREATE OR REPLACE VIEW v_public_tier_lists AS
SELECT id, slug, title, game_version, author_id, created_at, updated_at, review_state
FROM tier_lists tl WHERE review_state = 'publicado'
  AND EXISTS (SELECT 1 FROM authors a WHERE a.id = tl.author_id AND NOT a.is_placeholder AND a.slug <> 'por-confirmar');
--> statement-breakpoint
CREATE OR REPLACE VIEW v_public_tier_entries AS
SELECT e.id, e.tier_list_id, e.combination_id, e.build_id, e.display_name, e.entry_kind,
  e.tier, e.mastery_ids, e.damage_types, e.playstyle, e.content_tags, e.note,
  e.content_status, e.external_url, e.external_author, e.source_id, e.evaluated_on,
  e.position, e.review_state, e.rights_status, c.slug AS combination_slug,
  b.slug AS build_slug, s.slug AS source_slug
FROM tier_entries e JOIN v_public_tier_lists tl ON tl.id = e.tier_list_id
JOIN mastery_combinations c ON c.id = e.combination_id
LEFT JOIN v_public_builds b ON b.id = e.build_id
LEFT JOIN sources s ON s.id = e.source_id
WHERE e.review_state = 'publicado'
  AND e.rights_status IN ('own_original', 'licensed', 'permission_granted', 'link_only')
  AND (e.build_id IS NULL OR b.id IS NOT NULL);
--> statement-breakpoint
CREATE OR REPLACE VIEW v_public_authors AS
SELECT a.id, a.slug, a.display_name, a.bio, a.url FROM authors a
WHERE NOT a.is_placeholder AND a.slug <> 'por-confirmar'
  AND (EXISTS (SELECT 1 FROM v_public_builds b WHERE b.author_id = a.id)
    OR EXISTS (SELECT 1 FROM v_public_tier_lists t WHERE t.author_id = a.id));
--> statement-breakpoint
CREATE OR REPLACE VIEW v_public_assets AS
SELECT id, slug, file_path, origin_url, rights_holder, license_or_permission,
  NULL::text AS proof_ref, fallback_svg FROM assets WHERE status = 'approved';
--> statement-breakpoint
CREATE VIEW v_public_sources AS
SELECT s.id, s.slug, s.kind, s.title, s.url, s.author_name, s.license_note, s.retrieved_on
FROM sources s WHERE EXISTS (
  SELECT 1 FROM build_sources bs JOIN v_public_builds b ON b.id = bs.build_id WHERE bs.source_id = s.id
) OR EXISTS (SELECT 1 FROM v_public_tier_entries e WHERE e.source_id = s.id);
--> statement-breakpoint
CREATE VIEW v_public_masteries AS
SELECT m.id, m.slug, m.name_es, m.name_en, m.accent_token, m.fallback_icon,
  a.slug AS asset_slug FROM masteries m LEFT JOIN assets a ON a.id = m.asset_id;
--> statement-breakpoint
CREATE VIEW v_public_mastery_combinations AS
SELECT c.id, c.slug, a.slug AS mastery_a_slug, b.slug AS mastery_b_slug
FROM mastery_combinations c JOIN masteries a ON a.id = c.mastery_a_id
LEFT JOIN masteries b ON b.id = c.mastery_b_id;
--> statement-breakpoint
-- Every collection is correlated to this public root. Composite rows below are
-- explicitly projected records, never complete editorial table rows.
CREATE VIEW v_public_build_documents AS
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
--> statement-breakpoint
GRANT SELECT ON v_public_sources, v_public_masteries, v_public_mastery_combinations, v_public_build_documents TO api_ro;
