CREATE TYPE "public"."skill_kind" AS ENUM('active', 'passive', 'modifier', 'transmuter');--> statement-breakpoint
CREATE TABLE "catalog_skill_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"mastery_id" text NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text NOT NULL,
	"kind" "skill_kind" NOT NULL,
	"circular" boolean DEFAULT false NOT NULL,
	"tier" integer NOT NULL,
	"bar_required" integer NOT NULL,
	"grid_col" integer NOT NULL,
	"grid_row" integer NOT NULL,
	"max_points" integer NOT NULL,
	"ultimate_points" integer,
	"parent_id" text,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_skill_nodes_grid_cell_uq" UNIQUE("mastery_id","grid_col","grid_row"),
	CONSTRAINT "catalog_skill_nodes_mastery_node_uq" UNIQUE("mastery_id","id"),
	CONSTRAINT "catalog_skill_nodes_id_ck" CHECK ("catalog_skill_nodes"."id" ~ '^class[0-9]{2}/[a-z0-9]+([_-][a-z0-9]+)*$' AND split_part("catalog_skill_nodes"."id", '/', 1) = "catalog_skill_nodes"."mastery_id"),
	CONSTRAINT "catalog_skill_nodes_tier_ck" CHECK ("catalog_skill_nodes"."tier" BETWEEN 1 AND 9),
	CONSTRAINT "catalog_skill_nodes_bar_required_ck" CHECK (("tier" = 1 AND "bar_required" = 1) OR ("tier" = 2 AND "bar_required" = 5) OR ("tier" = 3 AND "bar_required" = 10) OR ("tier" = 4 AND "bar_required" = 15) OR ("tier" = 5 AND "bar_required" = 20) OR ("tier" = 6 AND "bar_required" = 25) OR ("tier" = 7 AND "bar_required" = 32) OR ("tier" = 8 AND "bar_required" = 40) OR ("tier" = 9 AND "bar_required" = 50)),
	CONSTRAINT "catalog_skill_nodes_grid_col_ck" CHECK ("catalog_skill_nodes"."grid_col" = "catalog_skill_nodes"."tier"),
	CONSTRAINT "catalog_skill_nodes_grid_row_ck" CHECK ("catalog_skill_nodes"."grid_row" >= 0),
	CONSTRAINT "catalog_skill_nodes_max_points_ck" CHECK ("catalog_skill_nodes"."max_points" > 0),
	CONSTRAINT "catalog_skill_nodes_ultimate_ck" CHECK ("catalog_skill_nodes"."ultimate_points" IS NULL OR "catalog_skill_nodes"."ultimate_points" >= "catalog_skill_nodes"."max_points"),
	CONSTRAINT "catalog_skill_nodes_no_self_parent_ck" CHECK ("catalog_skill_nodes"."parent_id" IS NULL OR "catalog_skill_nodes"."parent_id" <> "catalog_skill_nodes"."id")
);
--> statement-breakpoint
CREATE TABLE "mastery_trees" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text NOT NULL,
	"game_version" text NOT NULL,
	"source_sha256" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mastery_trees_slug_unique" UNIQUE("slug"),
	CONSTRAINT "mastery_trees_id_ck" CHECK ("mastery_trees"."id" ~ '^class[0-9]{2}$'),
	CONSTRAINT "mastery_trees_slug_ck" CHECK ("mastery_trees"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "mastery_trees_source_sha256_ck" CHECK (cardinality("mastery_trees"."source_sha256") >= 1)
);
--> statement-breakpoint
ALTER TABLE "catalog_skill_nodes" ADD CONSTRAINT "catalog_skill_nodes_mastery_id_mastery_trees_id_fk" FOREIGN KEY ("mastery_id") REFERENCES "public"."mastery_trees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_skill_nodes" ADD CONSTRAINT "catalog_skill_nodes_parent_fk" FOREIGN KEY ("mastery_id","parent_id") REFERENCES "public"."catalog_skill_nodes"("mastery_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Spec 003 T008. Public read boundary of the mastery catalog: `api_ro` reads these two views only,
-- never the base tables. Audit timestamps stay private. The importer maintains the catalog (it is
-- game-derived reference data); the editor gets nothing because the catalog is never edited by
-- hand. No `gates_importer_cutover_*` trigger: that gate freezes fixture *editorial* content after
-- bootstrap, whereas a new game build must still be able to refresh the catalog through the importer.
CREATE VIEW v_public_mastery_trees AS
SELECT id, slug, name_en, name_es, game_version, source_sha256 FROM mastery_trees;
--> statement-breakpoint
CREATE VIEW v_public_skill_nodes AS
SELECT id, mastery_id, name_en, name_es, kind, circular, tier, bar_required, grid_col, grid_row,
  max_points, ultimate_points, parent_id, icon FROM catalog_skill_nodes;
--> statement-breakpoint
GRANT SELECT ON v_public_mastery_trees, v_public_skill_nodes TO api_ro;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON mastery_trees, catalog_skill_nodes TO importer;
