-- T-169 (LOW-2): `v_public_assets` is a public boundary, so it must not carry asset
-- provenance. `CREATE OR REPLACE VIEW` cannot drop columns, hence DROP + CREATE and the
-- read grant restored for `api_ro`.
DROP VIEW v_public_assets;
--> statement-breakpoint
CREATE VIEW v_public_assets AS
SELECT id, slug, file_path, status, NULL::text AS proof_ref, fallback_svg
FROM assets WHERE status = 'approved';
--> statement-breakpoint
GRANT SELECT ON v_public_assets TO api_ro;
