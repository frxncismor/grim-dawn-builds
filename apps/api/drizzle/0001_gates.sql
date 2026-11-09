-- T-055: publication, provenance and public-read gates.
ALTER TABLE builds ADD CONSTRAINT builds_publication_ck CHECK (
  review_state <> 'publicado' OR (
    published_at IS NOT NULL AND reviewed_by IS NOT NULL AND
    rights_confirmed_by IS NOT NULL AND rights_confirmed_on IS NOT NULL AND
    rights_status IN ('own_original', 'licensed', 'permission_granted', 'link_only')
  )
);
--> statement-breakpoint
ALTER TABLE tier_entries ADD CONSTRAINT tier_entries_identity_ck CHECK (build_id IS NOT NULL OR display_name IS NOT NULL);
--> statement-breakpoint
ALTER TABLE tier_entries ADD CONSTRAINT tier_entries_placeholder_ck CHECK (
  entry_kind <> 'placeholder' OR (tier = 'sin_clasificar' AND build_id IS NULL AND external_url IS NULL AND content_status = 'placeholder')
);
--> statement-breakpoint
ALTER TABLE tier_entries ADD CONSTRAINT tier_entries_link_only_ck CHECK (
  entry_kind <> 'enlace_externo' OR (external_url IS NOT NULL AND btrim(external_url) <> '' AND external_author IS NOT NULL AND btrim(external_author) <> '' AND source_id IS NOT NULL AND rights_status = 'link_only')
);
--> statement-breakpoint
ALTER TABLE tier_entries ADD CONSTRAINT tier_entries_build_ck CHECK (entry_kind <> 'build_propia' OR build_id IS NOT NULL);
--> statement-breakpoint
ALTER TABLE tier_entries ADD CONSTRAINT tier_entries_real_tier_ck CHECK (tier = 'sin_clasificar' OR (source_id IS NOT NULL AND evaluated_on IS NOT NULL));
--> statement-breakpoint
ALTER TABLE assets ADD CONSTRAINT assets_approved_provenance_ck CHECK (
  status <> 'approved' OR (
    file_path IS NOT NULL AND btrim(file_path) <> '' AND origin_url IS NOT NULL AND btrim(origin_url) <> '' AND
    rights_holder IS NOT NULL AND btrim(rights_holder) <> '' AND license_or_permission IS NOT NULL AND btrim(license_or_permission) <> '' AND
    proof_ref IS NOT NULL AND btrim(proof_ref) <> ''
  )
);
--> statement-breakpoint
ALTER TABLE assets ADD CONSTRAINT assets_file_path_approved_ck CHECK (file_path IS NULL OR status = 'approved');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_check_build(p_build_id uuid) RETURNS void
SET search_path = public, pg_temp AS $$
DECLARE author_placeholder boolean; author_slug text; build_review_state review_state;
BEGIN
  SELECT review_state INTO build_review_state FROM builds WHERE id = p_build_id;
  IF build_review_state <> 'publicado' THEN RETURN; END IF;
  SELECT a.is_placeholder, a.slug INTO author_placeholder, author_slug FROM builds b JOIN authors a ON a.id = b.author_id WHERE b.id = p_build_id;
  IF author_placeholder OR author_slug = 'por-confirmar' THEN RAISE EXCEPTION 'published build requires a confirmed author' USING ERRCODE = 'check_violation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM build_sources WHERE build_id = p_build_id) THEN RAISE EXCEPTION 'published build requires a source' USING ERRCODE = 'check_violation'; END IF;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_trg_builds() RETURNS trigger SET search_path = public, pg_temp AS $$ BEGIN PERFORM gates_check_build(NEW.id); RETURN NEW; END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_trg_build_sources() RETURNS trigger SET search_path = public, pg_temp AS $$ BEGIN PERFORM gates_check_build(CASE WHEN TG_OP = 'DELETE' THEN OLD.build_id ELSE NEW.build_id END); RETURN COALESCE(NEW, OLD); END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_trg_authors() RETURNS trigger SET search_path = public, pg_temp AS $$ DECLARE b record; BEGIN FOR b IN SELECT id FROM builds WHERE author_id = NEW.id LOOP PERFORM gates_check_build(b.id); END LOOP; RETURN NEW; END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER gates_builds_publication AFTER INSERT OR UPDATE ON builds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gates_trg_builds();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER gates_build_sources_publication AFTER INSERT OR UPDATE OR DELETE ON build_sources DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gates_trg_build_sources();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER gates_authors_publication AFTER UPDATE ON authors DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gates_trg_authors();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_block_fixture_reimport() RETURNS trigger SET search_path = public, pg_temp AS $$ BEGIN IF EXISTS (SELECT 1 FROM content_origin) AND to_jsonb(NEW) ->> 'origin' = 'fixture' THEN RAISE EXCEPTION 'fixture imports are blocked after bootstrap' USING ERRCODE = 'check_violation'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_block_content_origin_change() RETURNS trigger SET search_path = public, pg_temp AS $$ BEGIN RAISE EXCEPTION 'content_origin is append-only' USING ERRCODE = 'check_violation'; END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE UNIQUE INDEX content_origin_singleton_uq ON content_origin ((true));
--> statement-breakpoint
CREATE TRIGGER gates_authors_fixture BEFORE INSERT OR UPDATE ON authors FOR EACH ROW EXECUTE FUNCTION gates_block_fixture_reimport();
--> statement-breakpoint
CREATE TRIGGER gates_sources_fixture BEFORE INSERT OR UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION gates_block_fixture_reimport();
--> statement-breakpoint
CREATE TRIGGER gates_builds_fixture BEFORE INSERT OR UPDATE ON builds FOR EACH ROW EXECUTE FUNCTION gates_block_fixture_reimport();
--> statement-breakpoint
CREATE TRIGGER gates_tier_lists_fixture BEFORE INSERT OR UPDATE ON tier_lists FOR EACH ROW EXECUTE FUNCTION gates_block_fixture_reimport();
--> statement-breakpoint
CREATE TRIGGER gates_tier_entries_fixture BEFORE INSERT OR UPDATE ON tier_entries FOR EACH ROW EXECUTE FUNCTION gates_block_fixture_reimport();
--> statement-breakpoint
CREATE TRIGGER gates_content_origin_immutable BEFORE UPDATE OR DELETE ON content_origin FOR EACH ROW EXECUTE FUNCTION gates_block_content_origin_change();
--> statement-breakpoint
CREATE VIEW v_public_assets AS SELECT id, slug, CASE WHEN status = 'approved' THEN file_path END AS file_path, CASE WHEN status = 'approved' THEN origin_url END AS origin_url, CASE WHEN status = 'approved' THEN rights_holder END AS rights_holder, CASE WHEN status = 'approved' THEN license_or_permission END AS license_or_permission, CASE WHEN status = 'approved' THEN proof_ref END AS proof_ref, fallback_svg FROM assets WHERE status = 'approved';
--> statement-breakpoint
CREATE VIEW v_public_authors AS SELECT id, slug, display_name, bio, url FROM authors WHERE is_placeholder = false;
--> statement-breakpoint
CREATE VIEW v_public_builds AS SELECT id, slug, locale, title, title_a_mastery_id, title_b_mastery_id, eyebrow, subtitle, summary, damage_types, playstyle, content_tags, game_version, author_id, content_status, published_at, video_url, footer_disclaimer, hero_callout_title, hero_callout_body FROM builds WHERE review_state = 'publicado' AND rights_status IN ('own_original', 'licensed', 'permission_granted', 'link_only');
--> statement-breakpoint
CREATE VIEW v_public_tier_lists AS SELECT id, slug, title, game_version, author_id, created_at, updated_at FROM tier_lists WHERE review_state = 'publicado';
--> statement-breakpoint
CREATE VIEW v_public_tier_entries AS SELECT id, tier_list_id, combination_id, build_id, display_name, entry_kind, tier, mastery_ids, damage_types, playstyle, content_tags, note, content_status, external_url, external_author, source_id, evaluated_on, position FROM tier_entries WHERE review_state = 'publicado' AND rights_status IN ('own_original', 'licensed', 'permission_granted', 'link_only') AND EXISTS (SELECT 1 FROM tier_lists tl WHERE tl.id = tier_list_id AND tl.review_state = 'publicado') AND (build_id IS NULL OR EXISTS (SELECT 1 FROM builds b WHERE b.id = build_id AND b.review_state = 'publicado' AND b.rights_status IN ('own_original', 'licensed', 'permission_granted', 'link_only')));
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN CREATE ROLE migrator NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'importer') THEN CREATE ROLE importer NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'editor') THEN CREATE ROLE editor NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_ro') THEN CREATE ROLE api_ro NOLOGIN; END IF; END $$;
--> statement-breakpoint
GRANT USAGE, CREATE ON SCHEMA public TO migrator;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO importer;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO api_ro;
--> statement-breakpoint
GRANT SELECT ON v_public_assets TO api_ro;
--> statement-breakpoint
GRANT SELECT ON v_public_authors TO api_ro;
--> statement-breakpoint
GRANT SELECT ON v_public_builds TO api_ro;
--> statement-breakpoint
GRANT SELECT ON v_public_tier_entries TO api_ro;
--> statement-breakpoint
GRANT SELECT ON v_public_tier_lists TO api_ro;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON assets TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON authors TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_devotion_steps TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_guides_npcs TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_masteries TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_notes TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_priorities TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_purchase_steps TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_sections_meta TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_skill_nodes TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_sources TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON builds TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON constellations TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON content_origin TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON loot_filter_columns TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON loot_filter_rules TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON masteries TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON mastery_combinations TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON skills TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sources TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON tier_entries TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON tier_lists TO importer;
