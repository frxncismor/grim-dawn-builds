ALTER TABLE "build_skill_nodes" ADD COLUMN "skill_node_id" text;--> statement-breakpoint
ALTER TABLE "build_skill_nodes" ADD CONSTRAINT "build_skill_nodes_skill_node_id_catalog_skill_nodes_id_fk" FOREIGN KEY ("skill_node_id") REFERENCES "public"."catalog_skill_nodes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Spec 003 T031. A guide node may point at the catalog node it describes. The FK above guarantees
-- the node exists; this trigger guarantees it belongs to the same mastery as the guide's skill. Guide
-- mastery slugs are editorial (`chaman`) and catalog slugs follow the game (`shaman`), so, like
-- `validateSkillNodeRefs` in @gd/domain, they match by slug or by English name. SECURITY DEFINER so
-- `editor` (no grant on the catalog) is checked with the same rule as `importer`.
CREATE FUNCTION build_skill_nodes_check_catalog_mastery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.skill_node_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_skill_nodes WHERE id = NEW.skill_node_id) THEN
    RAISE EXCEPTION 'skill_node_id is not in the mastery catalog' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.skills s
    JOIN public.masteries m ON m.id = s.mastery_id
    JOIN public.catalog_skill_nodes c ON c.id = NEW.skill_node_id
    JOIN public.mastery_trees t ON t.id = c.mastery_id
    WHERE s.id = NEW.skill_id
      AND (t.slug = m.slug OR lower(btrim(t.name_en)) = lower(btrim(m.name_en)))
  ) THEN
    RAISE EXCEPTION 'skill_node_id belongs to another mastery than the guide skill' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION build_skill_nodes_check_catalog_mastery() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER build_skill_nodes_catalog_mastery BEFORE INSERT OR UPDATE OF skill_id, skill_node_id ON build_skill_nodes FOR EACH ROW EXECUTE FUNCTION build_skill_nodes_check_catalog_mastery();
--> statement-breakpoint
-- The public guide document now serves `skill_node_id` (omitted when the node has no reference).
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
