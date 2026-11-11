-- Bootstrap verifies the applied history with its own importer credential.
-- No DDL, writes to the journal, role administration or extra credentials.
GRANT USAGE ON SCHEMA drizzle TO importer;
--> statement-breakpoint
GRANT SELECT ON drizzle.__drizzle_migrations TO importer;
