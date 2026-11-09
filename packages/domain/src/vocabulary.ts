/**
 * Shared content vocabularies. Kept free of runtime dependencies (no zod) so UI code
 * can import them without pulling the validation library into the client bundle.
 * Values follow specs/001-mvp-guias-builds/data-model.md.
 */
export const CONTENT_STATUSES = ['verificado', 'sin_verificar', 'placeholder'] as const;
export const TIERS = ['S', 'A', 'B', 'C', 'D', 'sin_clasificar'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type Tier = (typeof TIERS)[number];
