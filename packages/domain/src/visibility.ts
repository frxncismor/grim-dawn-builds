import { APPROVED_RIGHTS, type Build } from './schema.js';

/**
 * Public visibility rule: only publicado builds with approved rights leave the repository.
 * `pending` (and any non-approved status) never passes unless drafts are explicitly included
 * for local review.
 */
export function publicFilter(includeDrafts: boolean): (build: Build) => boolean {
  if (includeDrafts) return () => true;
  return (build) =>
    build.review_state === 'publicado' && APPROVED_RIGHTS.includes(build.rights_status);
}
