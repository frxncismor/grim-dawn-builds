import { describe, expect, it } from 'vitest';
import type { Build, BuildInput } from '../src/schema.js';

/**
 * Reusable contract suite for `ContentRepository` adapters (T-063, plan §12.10/§12.11).
 *
 * Adapter-agnostic: it only needs a factory that seeds an adapter with raw documents.
 * The file adapter, the in-memory reference and the future API adapter (T-062) run the
 * same assertions. This module is test-only: it imports nothing from the web, the API,
 * the file system, Angular or HTTP (plan §12.4). `vitest` is the only runtime import.
 */

/** Structural port every adapter satisfies (the web's `ContentRepository` is a superset-compatible shape). */
export interface ContentRepositoryPort {
  listBuilds(): Promise<readonly Build[]>;
  findBuild(slug: string): Promise<Build | null>;
  listSlugs(): Promise<readonly string[]>;
}

export interface ContractOptions {
  /** Local review only (fixture/dev). Reveals borrador, en_revision and pending builds. */
  readonly includeDrafts: boolean;
}

/** Builds an adapter seeded with raw (unvalidated, possibly unsorted) documents. */
export type ContractFactory<R extends ContentRepositoryPort> = (
  docs: readonly BuildInput[],
  options: ContractOptions,
) => R | Promise<R>;

const CONFIRMED_AUTHOR = 'autor-confirmado';
const APPROVED_RIGHTS = ['own_original', 'licensed', 'permission_granted', 'link_only'];

/** Fresh, valid borrador document. Overrides keep fixtures explicit at the call site. */
export function contractDoc(slug: string, overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    slug,
    locale: 'es',
    title: `Build ${slug}`,
    author_slug: CONFIRMED_AUTHOR,
    source_slugs: ['guia-fuente'],
    game_version: '1.2.x',
    review_state: 'borrador',
    rights_status: 'pending',
    rights_confirmed_by: null,
    rights_confirmed_on: null,
    content_status: 'sin_verificar',
    reviewed_by: null,
    published_at: null,
    skill_nodes: [{ slug: 'nodo-raiz', bar_required: 0, parent_slug: null }],
    ...overrides,
  };
}

const PUBLISHED: Partial<BuildInput> = {
  review_state: 'publicado',
  rights_confirmed_by: 'titular',
  rights_confirmed_on: '2026-11-08',
  reviewed_by: 'editor-local',
  published_at: '2026-11-08',
};

/**
 * Deterministic fixture set, intentionally unsorted. Covers: published with approved rights
 * (two variants), pending rights on a placeholder draft, an en_revision build and a draft with
 * approved rights (hidden only by its review state).
 */
export function contractDocs(): BuildInput[] {
  return [
    contractDoc('zeta-publicada', {
      ...PUBLISHED,
      rights_status: 'licensed',
      content_status: 'verificado',
    }),
    contractDoc('alfa-enlace', {
      ...PUBLISHED,
      rights_status: 'link_only',
      source_slugs: ['foro-fuente'],
    }),
    contractDoc('medio-pendiente', {
      rights_status: 'pending',
      content_status: 'placeholder',
      author_slug: 'por-confirmar',
    }),
    contractDoc('omega-revision', {
      review_state: 'en_revision',
      rights_status: 'own_original',
    }),
    contractDoc('beta-borrador-aprobado', { rights_status: 'own_original' }),
  ];
}

/** Slugs visible in public mode (sorted). */
export const PUBLIC_SLUGS = ['alfa-enlace', 'zeta-publicada'];
/** Slugs visible with includeDrafts (sorted). */
export const DRAFT_SLUGS = [
  'alfa-enlace',
  'beta-borrador-aprobado',
  'medio-pendiente',
  'omega-revision',
  'zeta-publicada',
];
/** Slugs that must never leave the repository in public mode. */
export const HIDDEN_SLUGS = ['beta-borrador-aprobado', 'medio-pendiente', 'omega-revision'];

/** Registers the contract suite for one adapter. Each test builds a fresh adapter. */
export function runContentRepositoryContract<R extends ContentRepositoryPort>(
  adapter: string,
  factory: ContractFactory<R>,
): void {
  describe(`ContentRepository contract: ${adapter}`, () => {
    const pub: ContractOptions = { includeDrafts: false };
    const local: ContractOptions = { includeDrafts: true };

    describe('public mode (includeDrafts=false)', () => {
      it('listBuilds returns only publicado builds with approved rights, sorted by slug', async () => {
        const repo = await factory(contractDocs(), pub);
        const builds = await repo.listBuilds();
        expect(builds.map((b) => b.slug)).toEqual(PUBLIC_SLUGS);
        for (const build of builds) {
          expect(build.review_state).toBe('publicado');
          expect(APPROVED_RIGHTS).toContain(build.rights_status);
        }
      });

      it('findBuild returns a visible publicado build by slug, unchanged', async () => {
        const repo = await factory(contractDocs(), pub);
        expect(await repo.findBuild('zeta-publicada')).toMatchObject({
          slug: 'zeta-publicada',
          title: 'Build zeta-publicada',
          author_slug: CONFIRMED_AUTHOR,
          review_state: 'publicado',
          rights_status: 'licensed',
          content_status: 'verificado',
        });
      });

      it('findBuild returns null (not an error) for every hidden build and unknown slug', async () => {
        const repo = await factory(contractDocs(), pub);
        for (const slug of [...HIDDEN_SLUGS, 'no-existe']) {
          expect(await repo.findBuild(slug), slug).toBeNull();
        }
      });

      it('pending rights never leave the repository in public mode', async () => {
        const repo = await factory(contractDocs(), pub);
        expect(await repo.findBuild('medio-pendiente')).toBeNull();
        expect((await repo.listBuilds()).some((b) => b.rights_status === 'pending')).toBe(false);
        expect(await repo.listSlugs()).not.toContain('medio-pendiente');
      });

      it('listSlugs is filtered by the public rule and agrees with listBuilds', async () => {
        const repo = await factory(contractDocs(), pub);
        const slugs = await repo.listSlugs();
        expect(slugs).toEqual(PUBLIC_SLUGS);
        expect(slugs).toEqual((await repo.listBuilds()).map((b) => b.slug));
      });

      it('an empty source yields empty lists and null lookups', async () => {
        const repo = await factory([], pub);
        expect(await repo.listBuilds()).toEqual([]);
        expect(await repo.listSlugs()).toEqual([]);
        expect(await repo.findBuild('cualquiera')).toBeNull();
      });
    });

    describe('local drafts mode (includeDrafts=true)', () => {
      it('reveals every build, including borrador, en_revision and pending rights, sorted by slug', async () => {
        const repo = await factory(contractDocs(), local);
        expect((await repo.listBuilds()).map((b) => b.slug)).toEqual(DRAFT_SLUGS);
      });

      it('findBuild reveals a pending draft with its placeholder data intact', async () => {
        const repo = await factory(contractDocs(), local);
        expect(await repo.findBuild('medio-pendiente')).toMatchObject({
          slug: 'medio-pendiente',
          rights_status: 'pending',
          content_status: 'placeholder',
          author_slug: 'por-confirmar',
          review_state: 'borrador',
        });
      });

      it('listSlugs includes drafts only in this mode', async () => {
        const repo = await factory(contractDocs(), local);
        expect(await repo.listSlugs()).toEqual(DRAFT_SLUGS);
      });
    });

    describe('determinism', () => {
      it('sorts by slug regardless of the input order', async () => {
        const reversed = [...contractDocs()].reverse();
        const pubRepo = await factory(reversed, pub);
        const draftRepo = await factory(reversed, local);
        expect(await pubRepo.listSlugs()).toEqual(PUBLIC_SLUGS);
        expect(await draftRepo.listSlugs()).toEqual(DRAFT_SLUGS);
      });

      it('repeated reads return the same result', async () => {
        const repo = await factory(contractDocs(), pub);
        const first = await repo.listBuilds();
        expect(await repo.listBuilds()).toEqual(first);
        const build = await repo.findBuild('zeta-publicada');
        expect(build).not.toBeNull();
        expect(await repo.findBuild('zeta-publicada')).toEqual(build);
      });
    });
  });
}
