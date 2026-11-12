CREATE TYPE "public"."adaptation_state" AS ENUM('borrador', 'en_revision', 'publicado', 'revision_pendiente', 'retirada');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('vigente', 'caducada', 'revocada');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('licencia_explicita', 'permiso_escrito');--> statement-breakpoint
CREATE TYPE "public"."permission_request_status" AS ENUM('enviada', 'concedida', 'denegada', 'limitada', 'sin_respuesta');--> statement-breakpoint
CREATE TYPE "public"."source_change_outcome" AS ENUM('sin_accion', 'revision_abierta', 'retirada');--> statement-breakpoint
CREATE TYPE "public"."source_change_type" AS ENUM('edicion', 'licencia', 'eliminacion', 'bloqueo', 'sin_cambios');--> statement-breakpoint
CREATE TYPE "public"."takedown_action" AS ENUM('link_only', 'retirada_total', 'rechazada');--> statement-breakpoint
ALTER TYPE "public"."entry_kind" ADD VALUE 'build_adaptada';--> statement-breakpoint
CREATE TABLE "build_adaptations" (
	"build_id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"original_title" text NOT NULL,
	"original_author" text NOT NULL,
	"original_site" text NOT NULL,
	"retrieved_on" date NOT NULL,
	"adaptation_editor" text NOT NULL,
	"transformation_scope" text[] NOT NULL,
	"transformation_notes" text NOT NULL,
	"adaptation_version" integer NOT NULL,
	"source_revision_ref" text,
	"last_reviewed_on" date NOT NULL,
	"reviewed_by" text NOT NULL,
	"change_log" jsonb NOT NULL,
	"attribution_text" text NOT NULL,
	"adaptation_state" "adaptation_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"author_contact_ref" text NOT NULL,
	"requested_on" date NOT NULL,
	"scope_requested" text NOT NULL,
	"status" "permission_request_status" NOT NULL,
	"response_ref" text,
	"responded_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"build_id" uuid,
	"observed_on" date NOT NULL,
	"change_type" "source_change_type" NOT NULL,
	"fingerprint" text,
	"reviewed_by" text,
	"outcome" "source_change_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_rights_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"evidence_type" "evidence_type" NOT NULL,
	"evidence_ref" text NOT NULL,
	"license_name" text,
	"license_url" text,
	"covers_adaptation" boolean NOT NULL,
	"covers_translation" boolean NOT NULL,
	"covers_images" boolean DEFAULT false NOT NULL,
	"scope_notes" text NOT NULL,
	"granted_by" text NOT NULL,
	"recorded_on" date NOT NULL,
	"valid_until" date,
	"status" "evidence_status" NOT NULL,
	"verified_by" text NOT NULL,
	"verified_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takedown_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid,
	"tier_entry_id" uuid,
	"requested_by" text NOT NULL,
	"received_on" date NOT NULL,
	"action" "takedown_action" NOT NULL,
	"executed_on" date,
	"executed_by" text,
	"notes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "build_adaptations" ADD CONSTRAINT "build_adaptations_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_adaptations" ADD CONSTRAINT "build_adaptations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_adaptations" ADD CONSTRAINT "build_adaptations_evidence_id_source_rights_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."source_rights_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_change_events" ADD CONSTRAINT "source_change_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_change_events" ADD CONSTRAINT "source_change_events_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rights_evidence" ADD CONSTRAINT "source_rights_evidence_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takedown_events" ADD CONSTRAINT "takedown_events_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takedown_events" ADD CONSTRAINT "takedown_events_tier_entry_id_tier_entries_id_fk" FOREIGN KEY ("tier_entry_id") REFERENCES "public"."tier_entries"("id") ON DELETE no action ON UPDATE no action;
-- ---------------------------------------------------------------------------
-- T-108: publication gates, link-only/adaptation CHECKs, public view and roles.
-- Structural DDL above is generated by drizzle-kit; this section is custom SQL
-- (plan 15.2, data-model rev. 6, AC-20).
-- ---------------------------------------------------------------------------
ALTER TABLE tier_entries DROP CONSTRAINT tier_entries_link_only_ck;
--> statement-breakpoint
ALTER TABLE tier_entries ADD CONSTRAINT tier_entries_link_only_ck CHECK (
  entry_kind <> 'enlace_externo' OR (
    external_url IS NOT NULL AND btrim(external_url) <> '' AND
    external_author IS NOT NULL AND btrim(external_author) <> '' AND
    source_id IS NOT NULL AND rights_status = 'link_only' AND
    tier = 'sin_clasificar'
  )
);
--> statement-breakpoint
-- `::text` avoids PostgreSQL 55P04: the new enum value cannot be used as an enum
-- literal inside the same transaction that runs `ALTER TYPE ... ADD VALUE`.
ALTER TABLE tier_entries ADD CONSTRAINT tier_entries_adaptation_ck CHECK (
  entry_kind::text <> 'build_adaptada' OR build_id IS NOT NULL
);
--> statement-breakpoint
ALTER TABLE source_rights_evidence ADD CONSTRAINT source_rights_evidence_identity_ck CHECK (
  btrim(evidence_ref) <> '' AND btrim(scope_notes) <> '' AND
  btrim(granted_by) <> '' AND btrim(verified_by) <> ''
);
--> statement-breakpoint
ALTER TABLE source_rights_evidence ADD CONSTRAINT source_rights_evidence_license_ck CHECK (
  (evidence_type = 'licencia_explicita' AND license_name IS NOT NULL AND btrim(license_name) <> ''
    AND license_url IS NOT NULL AND btrim(license_url) <> '') OR
  (evidence_type = 'permiso_escrito' AND license_name IS NULL AND license_url IS NULL)
);
--> statement-breakpoint
ALTER TABLE source_rights_evidence ADD CONSTRAINT source_rights_evidence_validity_ck CHECK (
  (status <> 'caducada' OR valid_until IS NOT NULL) AND
  (status <> 'vigente' OR valid_until IS NULL OR valid_until >= recorded_on)
);
--> statement-breakpoint
ALTER TABLE build_adaptations ADD CONSTRAINT build_adaptations_provenance_ck CHECK (
  btrim(source_url) <> '' AND btrim(original_title) <> '' AND btrim(original_author) <> '' AND
  btrim(original_site) <> '' AND btrim(adaptation_editor) <> '' AND btrim(transformation_notes) <> '' AND
  btrim(reviewed_by) <> '' AND btrim(attribution_text) <> '' AND
  cardinality(transformation_scope) > 0 AND adaptation_version > 0 AND
  jsonb_typeof(change_log) = 'array' AND jsonb_array_length(change_log) > 0 AND
  retrieved_on <= last_reviewed_on
);
--> statement-breakpoint
ALTER TABLE permission_requests ADD CONSTRAINT permission_requests_response_ck CHECK (
  (status <> 'concedida' OR (response_ref IS NOT NULL AND responded_on IS NOT NULL)) AND
  (status NOT IN ('denegada', 'limitada') OR response_ref IS NOT NULL) AND
  (status <> 'sin_respuesta' OR (response_ref IS NULL AND responded_on IS NULL)) AND
  (responded_on IS NULL OR responded_on >= requested_on)
);
--> statement-breakpoint
ALTER TABLE takedown_events ADD CONSTRAINT takedown_events_target_ck CHECK (
  num_nonnulls(build_id, tier_entry_id) = 1
);
--> statement-breakpoint
ALTER TABLE takedown_events ADD CONSTRAINT takedown_events_execution_ck CHECK (
  (action = 'rechazada' AND executed_on IS NULL AND executed_by IS NULL) OR
  (action <> 'rechazada' AND executed_on IS NOT NULL AND executed_on >= received_on AND
    executed_by IS NOT NULL AND btrim(executed_by) <> '')
);
--> statement-breakpoint
ALTER TABLE source_change_events ADD CONSTRAINT source_change_events_outcome_ck CHECK (
  (outcome = 'sin_accion' AND change_type = 'sin_cambios') OR
  (outcome <> 'sin_accion' AND change_type <> 'sin_cambios')
);
--> statement-breakpoint
-- Publication gate: evidence that covers the adaptation and is valid at the last review,
-- publishable build rights, image/translation coverage and an editor distinct from the
-- rights verifier (plan 15.2 checkpoints 1-3, AC-20). `imagenes` is the reserved image
-- scope token; @gd/domain TRANSFORMATION_SCOPES does not include it yet.
CREATE OR REPLACE FUNCTION gates_check_build_adaptation(p_build_id uuid) RETURNS void
SET search_path = public, pg_temp AS $$
DECLARE
  adaptation build_adaptations%ROWTYPE;
  evidence source_rights_evidence%ROWTYPE;
  build_rights rights_status;
BEGIN
  SELECT * INTO adaptation FROM build_adaptations WHERE build_id = p_build_id;
  IF NOT FOUND OR adaptation.adaptation_state <> 'publicado' THEN RETURN; END IF;
  SELECT rights_status INTO build_rights FROM builds WHERE id = p_build_id;
  IF build_rights NOT IN ('licensed', 'permission_granted') THEN
    RAISE EXCEPTION 'published adaptation requires licensed or permission_granted rights'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO evidence FROM source_rights_evidence WHERE id = adaptation.evidence_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'published adaptation requires registered evidence'
      USING ERRCODE = 'check_violation';
  END IF;
  IF evidence.source_id <> adaptation.source_id THEN
    RAISE EXCEPTION 'adaptation evidence must belong to the same source'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT evidence.covers_adaptation THEN
    RAISE EXCEPTION 'adaptation evidence must cover the adaptation'
      USING ERRCODE = 'check_violation';
  END IF;
  IF evidence.status <> 'vigente' THEN
    RAISE EXCEPTION 'published adaptation requires vigente evidence'
      USING ERRCODE = 'check_violation';
  END IF;
  IF evidence.valid_until IS NOT NULL AND evidence.valid_until < adaptation.last_reviewed_on THEN
    RAISE EXCEPTION 'evidence expired before the last review' USING ERRCODE = 'check_violation';
  END IF;
  IF adaptation.adaptation_editor = evidence.verified_by THEN
    RAISE EXCEPTION 'adaptation editor cannot verify the rights evidence'
      USING ERRCODE = 'check_violation';
  END IF;
  IF 'imagenes' = ANY(adaptation.transformation_scope) AND NOT evidence.covers_images THEN
    RAISE EXCEPTION 'image scope requires image rights evidence' USING ERRCODE = 'check_violation';
  END IF;
  IF 'traduccion' = ANY(adaptation.transformation_scope) AND NOT evidence.covers_translation THEN
    RAISE EXCEPTION 'translation scope requires translation rights evidence'
      USING ERRCODE = 'check_violation';
  END IF;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_trg_build_adaptations() RETURNS trigger
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM gates_check_build_adaptation(NEW.build_id);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION gates_trg_builds_adaptation() RETURNS trigger
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM gates_check_build_adaptation(NEW.id);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER gates_build_adaptations_publication
  AFTER INSERT OR UPDATE ON build_adaptations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gates_trg_build_adaptations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER gates_builds_adaptation_publication
  AFTER UPDATE ON builds
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gates_trg_builds_adaptation();
--> statement-breakpoint
-- Public projection: no evidence_ref, scope notes, change log, verifier or editor.
-- Withdrawn, review-pending, revoked or expired evidence simply disappear.
CREATE VIEW v_public_build_adaptations AS
SELECT a.build_id, a.source_url, a.original_title, a.original_author, a.original_site,
  a.attribution_text, a.retrieved_on, e.license_name, e.license_url
FROM build_adaptations a
JOIN v_public_builds b ON b.id = a.build_id
JOIN source_rights_evidence e ON e.id = a.evidence_id AND e.source_id = a.source_id
WHERE a.adaptation_state = 'publicado' AND e.status = 'vigente' AND e.covers_adaptation;
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_build_adaptations BEFORE INSERT OR UPDATE OR DELETE ON build_adaptations FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_permission_requests BEFORE INSERT OR UPDATE OR DELETE ON permission_requests FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_source_change_events BEFORE INSERT OR UPDATE OR DELETE ON source_change_events FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_source_rights_evidence BEFORE INSERT OR UPDATE OR DELETE ON source_rights_evidence FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
CREATE TRIGGER gates_importer_cutover_takedown_events BEFORE INSERT OR UPDATE OR DELETE ON takedown_events FOR EACH STATEMENT EXECUTE FUNCTION gates_block_importer_after_bootstrap();
--> statement-breakpoint
GRANT SELECT ON v_public_build_adaptations TO api_ro;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_adaptations, permission_requests, source_change_events, source_rights_evidence, takedown_events TO importer;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON build_adaptations, permission_requests, source_change_events, source_rights_evidence, takedown_events TO editor;
