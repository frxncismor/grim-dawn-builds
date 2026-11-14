-- Spec 003 T036 (S-004). `icon` is the game's internal texture path (`skillUpBitmapName`): it stays in
-- the base table `catalog_skill_nodes` (the extractor and the importer still write it) but it is not
-- part of the public read boundary any more. CREATE OR REPLACE VIEW cannot drop a column, so the view
-- is dropped and recreated without `icon`, and its single grant (0009) is repeated: `api_ro` keeps
-- reading the views only, never the base table. Nothing else depends on the view.
DROP VIEW v_public_skill_nodes;
--> statement-breakpoint
CREATE VIEW v_public_skill_nodes AS
SELECT id, mastery_id, name_en, name_es, kind, circular, tier, bar_required, grid_col, grid_row,
  max_points, ultimate_points, parent_id FROM catalog_skill_nodes;
--> statement-breakpoint
GRANT SELECT ON v_public_skill_nodes TO api_ro;
