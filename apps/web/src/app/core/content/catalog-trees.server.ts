/**
 * Server only. Which catalog masteries have a tree in the data (spec005 T033, FR-040; split out of
 * `portraits.server.ts` by T037, A-03).
 *
 * Coupling: the home and the catalog (`PUBLIC_SITE_DATA`) now wait for `MASTERY_CATALOG` (its
 * `listSummaries()`, see `app.config.server.ts`) to know which trees exist. With
 * `CONTENT_SOURCE=api` an unavailable or invalid `/api/v1/masteries` therefore also fails the
 * prerender of the home and `/tier-list`, closed, instead of linking a tree that does not open.
 * The decision lives here, not in the portraits module, which only draws portraits.
 */

/** Catalog mastery slug (Spanish) to the slug of its tree and portrait (English). */
export const TREE_SLUG: Readonly<Record<string, string>> = {
  arcanista: 'arcanist',
  demoledor: 'demolition',
  'filo-nocturno': 'nightblade',
  ocultista: 'occult',
  chaman: 'shaman',
  soldado: 'soldier',
};

/**
 * Server only (spec005 T033, FR-040): flags `noTree` on every catalog mastery whose tree is not in
 * the data (`treeSlugs`, the slugs of the mastery catalog), so no page links a tree that does not
 * open. A mastery with no `TREE_SLUG` entry has no tree either. The others stay untouched.
 */
export function withCatalogTrees<T extends { readonly masteries: readonly { slug: string }[] }>(
  catalog: T,
  treeSlugs: ReadonlySet<string>,
): T {
  return {
    ...catalog,
    masteries: catalog.masteries.map((m) => {
      const tree = Object.hasOwn(TREE_SLUG, m.slug) ? TREE_SLUG[m.slug] : undefined;
      return tree && treeSlugs.has(tree) ? m : { ...m, noTree: true };
    }),
  } as T;
}
