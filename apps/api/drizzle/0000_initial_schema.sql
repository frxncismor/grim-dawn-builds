CREATE TYPE "public"."accent" AS ENUM('storm', 'ember');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."build_source_role" AS ENUM('principal', 'referencia');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('verificado', 'sin_verificar', 'placeholder');--> statement-breakpoint
CREATE TYPE "public"."content_tag" AS ENUM('campana', 'shattered_realm', 'crucible', 'jefes', 'farmeo');--> statement-breakpoint
CREATE TYPE "public"."damage_type" AS ENUM('fisico', 'fuego', 'frio', 'rayo', 'acido', 'vitalidad', 'caos', 'eter', 'elemental', 'sangrado', 'mascotas');--> statement-breakpoint
CREATE TYPE "public"."devotion_step_kind" AS ENUM('ruta', 'verificacion', 'limpieza');--> statement-breakpoint
CREATE TYPE "public"."entry_kind" AS ENUM('placeholder', 'enlace_externo', 'build_propia');--> statement-breakpoint
CREATE TYPE "public"."loot_rule_action" AS ENUM('marcar', 'desmarcar', 'aviso');--> statement-breakpoint
CREATE TYPE "public"."node_status" AS ENUM('recomendada', 'meta', 'omitir');--> statement-breakpoint
CREATE TYPE "public"."note_kind" AS ENUM('devociones', 'nombres', 'atributos', 'arma', 'mas_adelante', 'rotacion', 'general');--> statement-breakpoint
CREATE TYPE "public"."origin" AS ENUM('fixture', 'bootstrap', 'editor');--> statement-breakpoint
CREATE TYPE "public"."playstyle" AS ENUM('melee', 'rango', 'mascotas', 'hibrido');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('borrador', 'en_revision', 'publicado');--> statement-breakpoint
CREATE TYPE "public"."rights_status" AS ENUM('pending', 'own_original', 'licensed', 'permission_granted', 'link_only');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('original', 'comunidad', 'oficial', 'video', 'externa_enlace');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('S', 'A', 'B', 'C', 'D', 'sin_clasificar');--> statement-breakpoint
CREATE TYPE "public"."verification" AS ENUM('verificado', 'sin_verificar');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"file_path" text,
	"origin_url" text,
	"rights_holder" text,
	"license_or_permission" text,
	"proof_ref" text,
	"recorded_on" date NOT NULL,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"fallback_svg" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"url" text,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"origin" "origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "build_devotion_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"constellation_id" uuid,
	"title_override" text,
	"body" text NOT NULL,
	"bindings" jsonb NOT NULL,
	"accent" "accent" NOT NULL,
	"verification" "verification" NOT NULL,
	"kind" "devotion_step_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_guides_npcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"group_label" text NOT NULL,
	"name" text,
	"location" text,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_masteries" (
	"build_id" uuid NOT NULL,
	"mastery_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role_text" text NOT NULL,
	CONSTRAINT "build_masteries_build_id_mastery_id_pk" PRIMARY KEY("build_id","mastery_id")
);
--> statement-breakpoint
CREATE TABLE "build_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"kind" "note_kind" NOT NULL,
	"label" text NOT NULL,
	"headline" text NOT NULL,
	"detail" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_priorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"rank" integer,
	"group_label" text NOT NULL,
	"headline" text NOT NULL,
	"note" text NOT NULL,
	"skill_node_ids" uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_purchase_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"threshold_label" text NOT NULL,
	"mastery_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"highlights" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_sections_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"position" integer NOT NULL,
	"visible" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "build_sections_meta_key_uq" UNIQUE("build_id","section_key")
);
--> statement-breakpoint
CREATE TABLE "build_skill_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"status" "node_status" NOT NULL,
	"tag" text,
	"rationale" text NOT NULL,
	"max_points_hint" integer,
	"points_label" text,
	"layout_x" numeric NOT NULL,
	"layout_y" numeric NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_sources" (
	"build_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"role" "build_source_role" NOT NULL,
	CONSTRAINT "build_sources_build_id_source_id_pk" PRIMARY KEY("build_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"title" text NOT NULL,
	"title_a_mastery_id" uuid NOT NULL,
	"title_b_mastery_id" uuid,
	"eyebrow" text NOT NULL,
	"subtitle" text NOT NULL,
	"summary" text NOT NULL,
	"damage_types" "damage_type"[] NOT NULL,
	"playstyle" "playstyle" NOT NULL,
	"content_tags" "content_tag"[] NOT NULL,
	"game_version" text NOT NULL,
	"author_id" uuid NOT NULL,
	"review_state" "review_state" NOT NULL,
	"rights_status" "rights_status" DEFAULT 'pending' NOT NULL,
	"rights_notes" text,
	"rights_confirmed_by" text,
	"rights_confirmed_on" date,
	"content_status" "content_status" DEFAULT 'sin_verificar' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"published_at" date,
	"video_url" text,
	"footer_disclaimer" text NOT NULL,
	"hero_callout_title" text NOT NULL,
	"hero_callout_body" text[] NOT NULL,
	"origin" "origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "constellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text,
	"tier_level" integer NOT NULL,
	"affinity_required" jsonb,
	"affinity_granted" jsonb,
	"layout" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constellations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_origin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bootstrapped_at" timestamp with time zone NOT NULL,
	"payload_hash" text NOT NULL,
	"migration_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loot_filter_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"subtitle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loot_filter_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"column_id" uuid NOT NULL,
	"action" "loot_rule_action" NOT NULL,
	"label" text NOT NULL,
	"detail" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "masteries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_es" text NOT NULL,
	"name_en" text NOT NULL,
	"accent_token" text NOT NULL,
	"fallback_icon" text NOT NULL,
	"asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "masteries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "mastery_combinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"mastery_a_id" uuid NOT NULL,
	"mastery_b_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mastery_combinations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "mastery_combinations_pair_uq" UNIQUE("mastery_a_id","mastery_b_id"),
	CONSTRAINT "mastery_combinations_order_ck" CHECK ("mastery_combinations"."mastery_a_id" < "mastery_combinations"."mastery_b_id")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mastery_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_es" text NOT NULL,
	"name_en" text NOT NULL,
	"bar_required" integer NOT NULL,
	"parent_skill_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_mastery_slug_uq" UNIQUE("mastery_id","slug")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "source_kind" NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"author_name" text NOT NULL,
	"license_note" text NOT NULL,
	"permission_ref" text,
	"retrieved_on" date NOT NULL,
	"notes" text NOT NULL,
	"origin" "origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_list_id" uuid NOT NULL,
	"combination_id" uuid NOT NULL,
	"build_id" uuid,
	"display_name" text,
	"entry_kind" "entry_kind" NOT NULL,
	"tier" "tier" NOT NULL,
	"mastery_ids" uuid[] NOT NULL,
	"damage_types" "damage_type"[] NOT NULL,
	"playstyle" "playstyle" NOT NULL,
	"content_tags" "content_tag"[] NOT NULL,
	"note" text NOT NULL,
	"content_status" "content_status" NOT NULL,
	"rights_status" "rights_status" NOT NULL,
	"review_state" "review_state" NOT NULL,
	"external_url" text,
	"external_author" text,
	"source_id" uuid,
	"evaluated_on" date,
	"position" integer NOT NULL,
	"origin" "origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"game_version" text NOT NULL,
	"review_state" "review_state" NOT NULL,
	"author_id" uuid NOT NULL,
	"origin" "origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tier_lists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "build_devotion_steps" ADD CONSTRAINT "build_devotion_steps_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_devotion_steps" ADD CONSTRAINT "build_devotion_steps_constellation_id_constellations_id_fk" FOREIGN KEY ("constellation_id") REFERENCES "public"."constellations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_guides_npcs" ADD CONSTRAINT "build_guides_npcs_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_masteries" ADD CONSTRAINT "build_masteries_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_masteries" ADD CONSTRAINT "build_masteries_mastery_id_masteries_id_fk" FOREIGN KEY ("mastery_id") REFERENCES "public"."masteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_notes" ADD CONSTRAINT "build_notes_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_priorities" ADD CONSTRAINT "build_priorities_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_purchase_steps" ADD CONSTRAINT "build_purchase_steps_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_purchase_steps" ADD CONSTRAINT "build_purchase_steps_mastery_id_masteries_id_fk" FOREIGN KEY ("mastery_id") REFERENCES "public"."masteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_sections_meta" ADD CONSTRAINT "build_sections_meta_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_skill_nodes" ADD CONSTRAINT "build_skill_nodes_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_skill_nodes" ADD CONSTRAINT "build_skill_nodes_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_sources" ADD CONSTRAINT "build_sources_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_sources" ADD CONSTRAINT "build_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_title_a_mastery_id_masteries_id_fk" FOREIGN KEY ("title_a_mastery_id") REFERENCES "public"."masteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_title_b_mastery_id_masteries_id_fk" FOREIGN KEY ("title_b_mastery_id") REFERENCES "public"."masteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_filter_columns" ADD CONSTRAINT "loot_filter_columns_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_filter_rules" ADD CONSTRAINT "loot_filter_rules_column_id_loot_filter_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."loot_filter_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masteries" ADD CONSTRAINT "masteries_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_combinations" ADD CONSTRAINT "mastery_combinations_mastery_a_id_masteries_id_fk" FOREIGN KEY ("mastery_a_id") REFERENCES "public"."masteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_combinations" ADD CONSTRAINT "mastery_combinations_mastery_b_id_masteries_id_fk" FOREIGN KEY ("mastery_b_id") REFERENCES "public"."masteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_mastery_id_masteries_id_fk" FOREIGN KEY ("mastery_id") REFERENCES "public"."masteries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_skill_id_skills_id_fk" FOREIGN KEY ("parent_skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_entries" ADD CONSTRAINT "tier_entries_tier_list_id_tier_lists_id_fk" FOREIGN KEY ("tier_list_id") REFERENCES "public"."tier_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_entries" ADD CONSTRAINT "tier_entries_combination_id_mastery_combinations_id_fk" FOREIGN KEY ("combination_id") REFERENCES "public"."mastery_combinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_entries" ADD CONSTRAINT "tier_entries_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_entries" ADD CONSTRAINT "tier_entries_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "builds_damage_types_gin" ON "builds" USING gin ("damage_types");--> statement-breakpoint
CREATE INDEX "builds_content_tags_gin" ON "builds" USING gin ("content_tags");--> statement-breakpoint
CREATE INDEX "tier_entries_list_tier_position_idx" ON "tier_entries" USING btree ("tier_list_id","tier","position");--> statement-breakpoint
CREATE INDEX "tier_entries_damage_types_gin" ON "tier_entries" USING gin ("damage_types");--> statement-breakpoint
CREATE INDEX "tier_entries_content_tags_gin" ON "tier_entries" USING gin ("content_tags");