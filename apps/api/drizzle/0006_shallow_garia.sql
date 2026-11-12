ALTER TABLE "tier_lists" ADD COLUMN "locale" text DEFAULT 'es' NOT NULL;--> statement-breakpoint
CREATE OR REPLACE VIEW v_public_tier_lists AS
  SELECT id, slug, title, game_version, author_id, created_at, updated_at, review_state, locale
  FROM tier_lists tl WHERE review_state = 'publicado'
    AND EXISTS (SELECT 1 FROM authors a WHERE a.id = tl.author_id AND NOT a.is_placeholder AND a.slug <> 'por-confirmar');
