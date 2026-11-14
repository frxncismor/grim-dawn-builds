CREATE UNIQUE INDEX "build_skill_nodes_build_skill_node_uq" ON "build_skill_nodes" USING btree ("build_id","skill_node_id") WHERE "build_skill_nodes"."skill_node_id" IS NOT NULL;
--> statement-breakpoint
-- Spec 003 T035. 0010 checks "same mastery" when a build_skill_nodes row is written; this also checks it
-- when the other side changes. The rule joins a guide skill's mastery (masteries.slug / name_en) with the
-- catalog node's tree (mastery_trees.slug / name_en), so renaming a mastery or a tree, or moving a skill
-- or a catalog node to another mastery, can invalidate rows that were valid. Deferred constraint triggers
-- (row level, only when a compared column really changes) re-run the check at COMMIT, so a seed that
-- rewrites both sides in one transaction passes in any order and a change that leaves a guide node pointing
-- at another mastery rolls the whole transaction back (fail closed, 23514). DELETEs need no trigger: skills
-- -> masteries, catalog nodes -> mastery_trees and build_skill_nodes -> catalog nodes are all FKs without
-- cascade. SECURITY DEFINER so `importer` and
-- any other writer run the same check; no new grants.
CREATE FUNCTION build_skill_nodes_revalidate_catalog_mastery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.build_skill_nodes n
    JOIN public.catalog_skill_nodes c ON c.id = n.skill_node_id
    JOIN public.mastery_trees t ON t.id = c.mastery_id
    JOIN public.skills s ON s.id = n.skill_id
    JOIN public.masteries m ON m.id = s.mastery_id
    WHERE NOT (t.slug = m.slug OR lower(btrim(t.name_en)) = lower(btrim(m.name_en)))
  ) THEN
    RAISE EXCEPTION 'a guide skill_node_id would belong to another mastery than the guide skill' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION build_skill_nodes_revalidate_catalog_mastery() FROM PUBLIC;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER masteries_revalidate_skill_node_mastery AFTER UPDATE OF slug, name_en ON masteries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.slug IS DISTINCT FROM NEW.slug OR OLD.name_en IS DISTINCT FROM NEW.name_en) EXECUTE FUNCTION build_skill_nodes_revalidate_catalog_mastery();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER mastery_trees_revalidate_skill_node_mastery AFTER UPDATE OF slug, name_en ON mastery_trees DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.slug IS DISTINCT FROM NEW.slug OR OLD.name_en IS DISTINCT FROM NEW.name_en) EXECUTE FUNCTION build_skill_nodes_revalidate_catalog_mastery();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER catalog_skill_nodes_revalidate_skill_node_mastery AFTER UPDATE OF mastery_id ON catalog_skill_nodes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.mastery_id IS DISTINCT FROM NEW.mastery_id) EXECUTE FUNCTION build_skill_nodes_revalidate_catalog_mastery();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER skills_revalidate_skill_node_mastery AFTER UPDATE OF mastery_id ON skills DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.mastery_id IS DISTINCT FROM NEW.mastery_id) EXECUTE FUNCTION build_skill_nodes_revalidate_catalog_mastery();
