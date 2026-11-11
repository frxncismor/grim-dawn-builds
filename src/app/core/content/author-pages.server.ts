import { PublicAuthorSchema, type PublicAuthor } from '@gd/domain';
import { catalogInputFromDocuments, loadPublicDocuments } from './catalog.server';
import type { ContentRepository } from './repository';
import type { AuthorSnapshot, PublicSiteData } from '../../features/author/author.state';
// No Angular browser helpers are imported into the server source adapter.
function publicProfile(raw: unknown): PublicAuthor {
  if (!raw || typeof raw !== 'object' || ('is_placeholder' in raw && raw.is_placeholder === true))
    throw new Error();
  const value = raw as Record<string, unknown>;
  const profile = PublicAuthorSchema.parse(
    Object.fromEntries(Object.keys(PublicAuthorSchema.shape).map((key) => [key, value[key]])),
  );
  if (profile.slug === 'por-confirmar') throw new Error();
  if (profile.url) {
    const url = new URL(profile.url);
    if (url.username || url.password) throw new Error();
  }
  return profile;
}
export async function loadPublicSiteData(
  repository: ContentRepository<boolean>,
): Promise<PublicSiteData> {
  try {
    const documents = await loadPublicDocuments(repository),
      profiles = new Map<string, AuthorSnapshot>();
    for (const guide of documents.builds) {
      const profile = publicProfile(guide.author),
        existing = profiles.get(profile.slug);
      if (existing && JSON.stringify(existing.profile) !== JSON.stringify(profile))
        throw new Error();
      if (existing) existing.guideSlugs = [...existing.guideSlugs, guide.slug];
      else profiles.set(profile.slug, { profile, guideSlugs: [guide.slug], ownsCatalog: false });
    }
    const ownerSlug = documents.tier.author_slug;
    if (!profiles.has(ownerSlug)) {
      const profile = publicProfile(await repository.getAuthor(ownerSlug));
      if (profile.slug !== ownerSlug) throw new Error();
      profiles.set(profile.slug, { profile, guideSlugs: [], ownsCatalog: true });
    } else profiles.get(ownerSlug)!.ownsCatalog = true;
    return {
      catalog: catalogInputFromDocuments(documents),
      authors: [...profiles.values()].sort((a, b) =>
        a.profile.slug < b.profile.slug ? -1 : a.profile.slug > b.profile.slug ? 1 : 0,
      ),
    };
  } catch {
    throw new Error('No se pudieron preparar los autores públicos.');
  }
}
