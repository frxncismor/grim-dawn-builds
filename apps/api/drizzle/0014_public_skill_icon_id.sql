ALTER TABLE "catalog_skill_nodes" ADD COLUMN "icon_id" text;--> statement-breakpoint
ALTER TABLE "catalog_skill_nodes" ADD CONSTRAINT "catalog_skill_nodes_icon_id_ck" CHECK ("catalog_skill_nodes"."icon_id" IS NULL OR "catalog_skill_nodes"."icon_id" ~ '^ic-[0-9a-f]{16}$');
--> statement-breakpoint
-- Spec 004 T025 (S-004). `icon_id` is the public icon handle (`ic-<16 hex>`, derived from the texture by
-- the extractor); `icon` (the game's texture path) stays out of the public read boundary. As in 0013,
-- CREATE OR REPLACE VIEW cannot reorder columns, so the view is recreated and its grant repeated:
-- `api_ro` keeps reading the views only. Nothing else depends on the view.
DROP VIEW v_public_skill_nodes;
--> statement-breakpoint
CREATE VIEW v_public_skill_nodes AS
SELECT id, mastery_id, name_en, name_es, kind, circular, tier, bar_required, grid_col, grid_row,
  max_points, ultimate_points, parent_id, icon_id FROM catalog_skill_nodes;
--> statement-breakpoint
GRANT SELECT ON v_public_skill_nodes TO api_ro;
