-- Local editorial CLI: explicit DML, never role/DDL/bootstrap-marker privileges.
GRANT USAGE ON SCHEMA public TO editor;
--> statement-breakpoint
-- Existing invoker triggers read this marker; editorial code cannot mutate it.
GRANT SELECT ON content_origin TO editor;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON assets, authors, build_constellations, build_devotion_steps, build_guides_npcs, build_masteries, build_notes, build_priorities, build_purchase_steps, build_sections_meta, build_skill_nodes, build_sources, builds, constellations, loot_filter_columns, loot_filter_rules, masteries, mastery_combinations, skills, sources, tier_entries, tier_lists TO editor;
--> statement-breakpoint
CREATE FUNCTION gates_block_importer_after_bootstrap() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF current_user = 'importer' THEN
    IF EXISTS (SELECT 1 FROM public.content_origin) THEN
      RAISE EXCEPTION 'fixture imports are blocked after bootstrap' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_assets BEFORE INSERT OR UPDATE OR DELETE ON assets FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_authors BEFORE INSERT OR UPDATE OR DELETE ON authors FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_constellations BEFORE INSERT OR UPDATE OR DELETE ON build_constellations FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_devotion_steps BEFORE INSERT OR UPDATE OR DELETE ON build_devotion_steps FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_guides_npcs BEFORE INSERT OR UPDATE OR DELETE ON build_guides_npcs FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_masteries BEFORE INSERT OR UPDATE OR DELETE ON build_masteries FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_notes BEFORE INSERT OR UPDATE OR DELETE ON build_notes FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_priorities BEFORE INSERT OR UPDATE OR DELETE ON build_priorities FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_purchase_steps BEFORE INSERT OR UPDATE OR DELETE ON build_purchase_steps FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_sections_meta BEFORE INSERT OR UPDATE OR DELETE ON build_sections_meta FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_skill_nodes BEFORE INSERT OR UPDATE OR DELETE ON build_skill_nodes FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_sources BEFORE INSERT OR UPDATE OR DELETE ON build_sources FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_builds BEFORE INSERT OR UPDATE OR DELETE ON builds FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_constellations BEFORE INSERT OR UPDATE OR DELETE ON constellations FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_loot_filter_columns BEFORE INSERT OR UPDATE OR DELETE ON loot_filter_columns FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_loot_filter_rules BEFORE INSERT OR UPDATE OR DELETE ON loot_filter_rules FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_masteries BEFORE INSERT OR UPDATE OR DELETE ON masteries FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_mastery_combinations BEFORE INSERT OR UPDATE OR DELETE ON mastery_combinations FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_skills BEFORE INSERT OR UPDATE OR DELETE ON skills FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_sources BEFORE INSERT OR UPDATE OR DELETE ON sources FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_tier_entries BEFORE INSERT OR UPDATE OR DELETE ON tier_entries FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_tier_lists BEFORE INSERT OR UPDATE OR DELETE ON tier_lists FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
