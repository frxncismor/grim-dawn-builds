import { describe, expect, it } from 'vitest';
import {
  PublicBuildSchema,
  PublicTierListSchema,
  type Author,
  type Build,
  type BuildInput,
  type PublicAuthor,
  type PublicBuild,
  type PublicTierList,
  type TierEntry,
  type TierList,
} from '../src/schema.js';

/**
 * Reusable contract suite for `ContentRepository` adapters (T-063, plan §12.10/§12.11).
 *
 * Adapter-agnostic: it only needs a factory that seeds an adapter with raw documents.
 * The file adapter, the in-memory reference and the future API adapter (T-062) run the
 * same assertions. This module is test-only: it imports nothing from the web, the API,
 * the file system, Angular or HTTP (plan §12.4). Runtime imports are Vitest and canonical schemas.
 */

/** Structural port every adapter satisfies (the web's `ContentRepository` is a superset-compatible shape). */
export interface ContentRepositoryPort {
  listBuilds(): Promise<readonly (Build | PublicBuild)[]>;
  findBuild(slug: string): Promise<Build | PublicBuild | null>;
  listSlugs(): Promise<readonly string[]>;
  getAuthor(slug: string): Promise<Author | PublicAuthor | null>;
  getTierList(slug: string): Promise<TierList | PublicTierList | null>;
}

export interface ContractCollections {
  authors: readonly Author[];
  tierLists: readonly TierList[];
}

export interface ContractOptions {
  /** Local review only (fixture/dev). Reveals borrador, en_revision and pending builds. */
  readonly includeDrafts: boolean;
}

/** Builds an adapter seeded with raw (unvalidated, possibly unsorted) documents. */
export type ContractFactory<R extends ContentRepositoryPort> = (
  docs: readonly BuildInput[],
  options: ContractOptions,
  collections?: ContractCollections,
) => R | Promise<R>;

const CONFIRMED_AUTHOR = 'autor-confirmado';
const APPROVED_RIGHTS = ['own_original', 'licensed', 'permission_granted', 'link_only'];

/** Fresh, valid borrador document. Overrides keep fixtures explicit at the call site. */
export function contractDoc(slug: string, overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    slug,
    locale: 'es',
    title: `Build ${slug}`,
    eyebrow: 'Guía sintética',
    subtitle: 'Progresión de prueba',
    summary: 'Contenido sintético completo para probar adaptadores.',
    title_a_mastery_slug: 'chaman',
    title_b_mastery_slug: null,
    damage_types: ['rayo'],
    playstyle: 'melee',
    content_tags: ['campana'],
    author_slug: CONFIRMED_AUTHOR,
    source_slugs: ['guia-fuente'],
    game_version: '1.2.x',
    review_state: 'borrador',
    rights_status: 'pending',
    rights_confirmed_by: null,
    rights_confirmed_on: null,
    content_status: 'sin_verificar',
    reviewed_by: null,
    reviewed_at: null,
    rights_notes: null,
    published_at: null,
    author: {
      slug: overrides.author_slug ?? CONFIRMED_AUTHOR,
      display_name: 'Autor de fixture',
      bio: null,
      url: null,
      is_placeholder: overrides.author_slug === 'por-confirmar',
    },
    sources: (overrides.source_slugs ?? ['guia-fuente']).map((sourceSlug) => ({
      slug: sourceSlug,
      kind: 'original',
      title: 'Fuente sintética',
      url: null,
      author_name: 'Autor de fixture',
      license_note: 'Prueba local',
      permission_ref: null,
      retrieved_on: '2026-11-08',
      notes: '',
    })),
    video_url: null,
    footer_disclaimer: 'Contenido sintético; no es una recomendación de juego.',
    hero_callout_title: 'Fixture de contrato',
    hero_callout_body: ['Solo utilizado por pruebas locales.'],
    masteries: [{ slug: 'chaman', name_es: 'Chamán', name_en: 'Shaman', role_text: 'Daño' }],
    skill_nodes: [
      {
        slug: 'nodo-raiz',
        mastery_slug: 'chaman',
        name_es: 'Nodo de prueba',
        name_en: 'Test node',
        bar_required: 0,
        parent_slug: null,
        status: 'recomendada',
        tag: null,
        rationale: 'Ejemplo sintético.',
        max_points_hint: 1,
        points_label: '1',
        layout: { x: 0, y: 0 },
      },
    ],
    priorities: [
      {
        rank: 1,
        group_label: 'Daño',
        headline: 'Nodo principal',
        note: '',
        skill_node_slugs: ['nodo-raiz'],
      },
    ],
    purchase_steps: [
      {
        position: 1,
        threshold_label: 'Inicio',
        mastery_slug: 'chaman',
        title: 'Primer punto',
        body: 'Compra el nodo.',
        highlights: [{ skill_node_slug: 'nodo-raiz', points: 1 }],
      },
    ],
    notes: [
      {
        position: 1,
        kind: 'general',
        label: 'Prueba',
        headline: 'Contenido sintético',
        detail: 'No publicar como guía.',
      },
    ],
    loot_filter_columns: [],
    guide_npcs: [],
    constellations: [],
    devotion_steps: [],
    sections_meta: [{ section_key: 'habilidades', position: 1, visible: true }],
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
export const PUBLIC_SLUGS = ['zeta-publicada'];
/** Slugs visible with includeDrafts (sorted). */
export const DRAFT_SLUGS = [
  'alfa-enlace',
  'beta-borrador-aprobado',
  'medio-pendiente',
  'omega-revision',
  'zeta-publicada',
];
/** Slugs that must never leave the repository in public mode. */
export const HIDDEN_SLUGS = [
  'alfa-enlace',
  'beta-borrador-aprobado',
  'medio-pendiente',
  'omega-revision',
];

/** Synthetic catalog; its placeholder makes no game or ranking claims. */
export function contractCollections(): ContractCollections {
  const doc = contractDocs()[0]!;
  const entry = (overrides: Partial<TierEntry> = {}): TierEntry => ({
    entry_kind: 'placeholder',
    combination_slug: 'chaman',
    display_name: 'Ranura sintética',
    build_slug: null,
    tier: 'sin_clasificar',
    content_status: 'placeholder',
    rights_status: 'own_original',
    review_state: 'publicado',
    external_url: null,
    external_author: null,
    source_slug: null,
    evaluated_on: null,
    ...overrides,
  });
  const tier: TierList = {
    slug: 'principal',
    locale: 'es',
    title: 'Catálogo sintético',
    game_version: 'test',
    review_state: 'publicado',
    author_slug: CONFIRMED_AUTHOR,
    masteries: [
      {
        slug: 'chaman',
        name_es: 'Chamán',
        name_en: 'Shaman',
        accent_token: 'storm',
        fallback_icon: 'chaman',
        asset_slug: null,
      },
    ],
    combinations: [{ slug: 'chaman', mastery_a_slug: 'chaman', mastery_b_slug: null }],
    entries: [
      entry(),
      entry({
        entry_kind: 'build_propia',
        display_name: 'Build pública',
        build_slug: 'zeta-publicada',
        content_status: 'sin_verificar',
        source_slug: 'guia-fuente',
      }),
      entry({
        entry_kind: 'enlace_externo',
        display_name: 'Enlace externo',
        content_status: 'sin_verificar',
        rights_status: 'link_only',
        external_url: 'https://example.invalid/guide',
        external_author: 'Autor externo sintético',
        source_slug: 'guia-fuente',
      }),
      entry({
        entry_kind: 'build_propia',
        display_name: 'Referencia oculta',
        build_slug: 'medio-pendiente',
        content_status: 'sin_verificar',
      }),
      entry({ display_name: 'Ranura oculta', review_state: 'borrador', rights_status: 'pending' }),
      entry({
        entry_kind: 'enlace_externo',
        display_name: 'Referencia externa incoherente',
        build_slug: 'medio-pendiente',
        content_status: 'sin_verificar',
        rights_status: 'link_only',
        external_url: 'https://example.invalid/guide',
        external_author: 'Autor externo sintético',
        source_slug: 'guia-fuente',
      }),
    ],
    sources: doc.sources.map((source) => ({ ...source, permission_ref: 'PRIVATE-TIER-PROOF' })),
  };
  return {
    authors: [doc.author],
    tierLists: [tier, { ...tier, slug: 'borrador', review_state: 'borrador' }],
  };
}

/** Registers the contract suite for one adapter. Each test builds a fresh adapter. */
export function runContentRepositoryContract<R extends ContentRepositoryPort>(
  adapter: string,
  factory: ContractFactory<R>,
  capabilities: { localDrafts: boolean },
): void {
  describe(`ContentRepository contract: ${adapter}`, () => {
    const pub: ContractOptions = { includeDrafts: false };
    const local: ContractOptions = { includeDrafts: true };

    describe('public mode (includeDrafts=false)', () => {
      it('preserves complete guide sections and removes private fields recursively', async () => {
        const docs = contractDocs();
        const original = docs.find((doc) => doc.slug === 'zeta-publicada')!;
        original.rights_notes = 'PRIVATE-REVIEW';
        original.sources[0]!.permission_ref = 'PRIVATE-PROOF';
        original.sources[0]!.notes = 'PRIVATE-NOTES';
        const repo = await factory(docs, pub);
        const build = await repo.findBuild(original.slug);
        expect(PublicBuildSchema.safeParse(build).success).toBe(true);
        for (const field of [
          'skill_nodes',
          'purchase_steps',
          'priorities',
          'notes',
          'loot_filter_columns',
          'guide_npcs',
          'constellations',
          'devotion_steps',
          'sections_meta',
          'masteries',
          'hero_callout_body',
        ] as const) {
          expect(build?.[field], field).toEqual(original[field]);
        }
        for (const privateField of [
          'PRIVATE-',
          'reviewed_by',
          'rights_confirmed_by',
          'rights_notes',
          'permission_ref',
          'is_placeholder',
        ]) {
          expect(JSON.stringify(build)).not.toContain(privateField);
        }
      });

      it('returns only public authors and null for hidden, placeholder or missing authors', async () => {
        const repo = await factory(contractDocs(), pub);
        expect(await repo.getAuthor(CONFIRMED_AUTHOR)).toEqual({
          slug: CONFIRMED_AUTHOR,
          display_name: 'Autor de fixture',
          bio: null,
          url: null,
        });
        expect(await repo.getAuthor('por-confirmar')).toBeNull();
        expect(await repo.getAuthor('no-existe')).toBeNull();
        const hiddenOnly = await factory([contractDoc('oculta')], pub);
        expect(await hiddenOnly.getAuthor(CONFIRMED_AUTHOR)).toBeNull();
      });

      it('preserves the catalog and external attribution while removing hidden tier entries', async () => {
        const docs = contractDocs();
        const collections = contractCollections();
        const repo = await factory(docs, pub, collections);
        const tier = await repo.getTierList('principal');
        expect(PublicTierListSchema.safeParse(tier).success).toBe(true);
        expect(tier?.masteries).toEqual(collections.tierLists[0]!.masteries);
        expect(tier?.combinations).toEqual(collections.tierLists[0]!.combinations);
        expect(tier?.entries.map((entry) => entry.display_name)).toEqual([
          'Ranura sintética',
          'Build pública',
          'Enlace externo',
        ]);
        expect(tier?.entries[2]).toMatchObject({
          external_author: 'Autor externo sintético',
          external_url: 'https://example.invalid/guide',
          rights_status: 'link_only',
        });
        expect(JSON.stringify(tier)).not.toMatch(/permission_ref|PRIVATE-|medio-pendiente/);
        expect(await repo.getTierList('borrador')).toBeNull();
        expect(await repo.getTierList('no-existe')).toBeNull();
      });
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

    if (capabilities.localDrafts)
      describe('local drafts mode (includeDrafts=true)', () => {
        it('round-trips complete editorial documents, author and tier collections', async () => {
          const docs = contractDocs();
          const collections = contractCollections();
          const repo = await factory(docs, local, collections);
          for (const doc of docs) expect(await repo.findBuild(doc.slug)).toEqual(doc);
          expect(await repo.getTierList('principal')).toEqual(collections.tierLists[0]);
          expect(await repo.getTierList('borrador')).toEqual(collections.tierLists[1]);
          expect(await repo.getAuthor('por-confirmar')).toEqual(
            docs.find((doc) => doc.author_slug === 'por-confirmar')?.author,
          );
        });
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
    else
      it('rejects enabling drafts on a public-only adapter', async () => {
        await expect(
          Promise.resolve().then(() => factory(contractDocs(), local)),
        ).rejects.toThrow();
      });

    describe('determinism', () => {
      it('sorts by slug regardless of the input order', async () => {
        const reversed = [...contractDocs()].reverse();
        const pubRepo = await factory(reversed, pub);
        expect(await pubRepo.listSlugs()).toEqual(PUBLIC_SLUGS);
        if (capabilities.localDrafts) {
          const draftRepo = await factory(reversed, local);
          expect(await draftRepo.listSlugs()).toEqual(DRAFT_SLUGS);
        }
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
