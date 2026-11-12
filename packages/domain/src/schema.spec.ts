import { describe, expect, it } from 'vitest';
import * as DomainSchema from './schema.js';
import { AssetSchema, BuildSchema, TierEntrySchema, findParentCycle } from './schema.js';

// Shapes follow specs/001-mvp-guias-builds/data-model.md (tables builds, tier_entries, assets).
const draftBuild = () => ({
  slug: 'chaman-demoledor-golpe-primigenio',
  locale: 'es',
  title: 'Chamán + Demoledor',
  eyebrow: 'Elementalista de rayo',
  subtitle: 'Guía de progresión',
  summary: 'Resumen íntegro para metadatos y vista previa.',
  title_a_mastery_slug: 'chaman',
  title_b_mastery_slug: 'demoledor',
  damage_types: ['rayo', 'fisico'],
  playstyle: 'melee',
  content_tags: ['campana', 'jefes'],
  author_slug: 'por-confirmar',
  source_slugs: ['guia-original'],
  author: {
    slug: 'por-confirmar',
    display_name: 'Autor sin confirmar',
    bio: null,
    url: null,
    is_placeholder: true,
  },
  sources: [
    {
      slug: 'guia-original',
      kind: 'original',
      title: 'Guía original',
      url: 'https://example.invalid/source',
      author_name: 'Autor de la guía',
      license_note: 'Derechos pendientes',
      permission_ref: 'evidence-private-fixture',
      retrieved_on: '2026-11-08',
      notes: 'Nota editorial privada.',
    },
  ],
  game_version: '1.2.x',
  review_state: 'borrador',
  rights_status: 'pending',
  rights_confirmed_by: null,
  rights_confirmed_on: null,
  content_status: 'sin_verificar',
  reviewed_by: null,
  reviewed_at: null,
  published_at: null,
  rights_notes: null,
  video_url: null,
  footer_disclaimer: 'Cantidades orientativas.',
  hero_callout_title: 'Lee esto primero',
  hero_callout_body: ['La barra de maestría no son puntos invertidos.', 'Ajusta al nivel.'],
  masteries: [
    { slug: 'chaman', name_es: 'Chamán', name_en: 'Shaman', role_text: 'Daño principal' },
    { slug: 'demoledor', name_es: 'Demoledor', name_en: 'Demolitionist', role_text: 'Soporte' },
  ],
  priorities: [
    {
      rank: 1,
      group_label: '1 · Chamán',
      headline: 'Sube el ataque principal',
      note: 'Mantén el daño elemental.',
      skill_node_slugs: ['golpe-primigenio'],
    },
  ],
  skill_nodes: [
    {
      slug: 'golpe-primigenio',
      mastery_slug: 'chaman',
      name_es: 'Golpe Primigenio',
      name_en: 'Primal Strike',
      bar_required: 5,
      parent_slug: null,
      status: 'recomendada',
      tag: null,
      rationale: 'Habilidad principal de progresión.',
      max_points_hint: 16,
      points_label: 'máximo',
      layout: { x: 50, y: 20 },
    },
    {
      slug: 'golpe-atronador',
      mastery_slug: 'chaman',
      name_es: 'Golpe Atronador',
      name_en: 'Thunderous Strike',
      bar_required: 10,
      parent_slug: 'golpe-primigenio',
      status: 'recomendada',
      tag: 'Transmutador',
      rationale: 'Convierte la habilidad en ataque de área.',
      max_points_hint: 12,
      points_label: '1 ahora, 12 después',
      layout: { x: 50, y: 90 },
    },
  ],
  purchase_steps: [
    {
      position: 1,
      threshold_label: 'barra Chamán → 10',
      mastery_slug: 'chaman',
      title: 'Activa el transmutador',
      body: 'Invierte un punto al alcanzar la barra.',
      highlights: [{ skill_node_slug: 'golpe-atronador', points: 1 }],
    },
  ],
  notes: [
    {
      kind: 'rotacion',
      label: 'Rotación',
      headline: 'Mantén los tótems activos',
      detail: 'Renueva los tótems antes de avanzar.',
      position: 1,
    },
  ],
  loot_filter_columns: [
    {
      position: 1,
      name: 'Calidad',
      subtitle: 'Prioriza objetos raros.',
      rules: [
        { action: 'marcar', label: 'Épico', detail: 'Marca los objetos épicos.', position: 1 },
        { action: 'aviso', label: 'No vender', detail: 'Revisa los prefijos.', position: 2 },
      ],
    },
  ],
  guide_npcs: [
    {
      position: 1,
      group_label: 'Coste',
      name: 'Sahdina',
      location: 'Devil’s Crossing',
      detail: 'Restablece habilidades por una tarifa.',
    },
  ],
  constellations: [
    {
      slug: 'tempest',
      name_en: 'Tempest',
      name_es: null,
      tier_level: 2,
      affinity_required: { ascendente: 5 },
      affinity_granted: { ascendente: 3 },
      layout: { nodes: [], edges: [] },
    },
  ],
  devotion_steps: [
    {
      position: 1,
      label: 'Paso 1 · Tempestad',
      constellation_slug: 'tempest',
      title_override: null,
      body: 'Activa el poder antes de continuar.',
      bindings: [{ power_en: 'Reckless Tempest', skill_node_slug: 'golpe-primigenio' }],
      accent: 'storm',
      verification: 'verificado',
      kind: 'ruta',
    },
  ],
  sections_meta: [{ section_key: 'devociones', position: 1, visible: true }],
});

const publishableBuild = () => ({
  ...draftBuild(),
  review_state: 'publicado',
  rights_status: 'own_original',
  rights_confirmed_by: 'titular',
  rights_confirmed_on: '2026-11-08',
  reviewed_by: 'editor-local',
  published_at: '2026-11-08',
  author_slug: 'autor-real',
  author: {
    slug: 'autor-real',
    display_name: 'Autor real',
    bio: 'Autor de contenido sintético.',
    url: 'https://example.invalid/author',
    is_placeholder: false,
  },
});

function publicBuild() {
  const document = publishableBuild();
  const privateFields = [
    'reviewed_by',
    'reviewed_at',
    'rights_confirmed_by',
    'rights_confirmed_on',
    'rights_notes',
  ];
  const body = Object.fromEntries(
    Object.entries(document).filter(([key]) => !privateFields.includes(key)),
  );
  const author = {
    slug: document.author.slug,
    display_name: document.author.display_name,
    bio: document.author.bio,
    url: document.author.url,
  };
  const sources = document.sources.map(
    ({ slug, kind, title, url, author_name, license_note, retrieved_on }) => ({
      slug,
      kind,
      title,
      url,
      author_name,
      license_note,
      retrieved_on,
    }),
  );
  return { ...body, author, sources };
}

const placeholderEntry = () => ({
  entry_kind: 'placeholder',
  combination_slug: 'chaman-demoledor',
  display_name: 'Chamán + Demoledor',
  build_slug: null,
  tier: 'sin_clasificar',
  content_status: 'placeholder',
  rights_status: 'own_original',
  review_state: 'publicado',
  external_url: null,
  external_author: null,
  source_slug: null,
  evaluated_on: null,
});

const catalogFixture = () => ({
  slug: 'principal',
  locale: 'es',
  title: 'Catálogo sintético',
  game_version: '1.2.x',
  review_state: 'publicado',
  author_slug: 'autor-real',
  sources: [],
  masteries: [
    {
      slug: 'chaman',
      name_es: 'Chamán',
      name_en: 'Shaman',
      accent_token: 'storm',
      fallback_icon: 'sword',
      asset_slug: null,
    },
    {
      slug: 'demoledor',
      name_es: 'Demoledor',
      name_en: 'Demolitionist',
      accent_token: 'ember',
      fallback_icon: 'sword',
      asset_slug: null,
    },
  ],
  combinations: [
    { slug: 'chaman-demoledor', mastery_a_slug: 'chaman', mastery_b_slug: 'demoledor' },
  ],
  entries: [placeholderEntry()],
});

describe('complete guide and catalog contracts', () => {
  it('shares the editorial alias without loosening required content', () => {
    expect(DomainSchema.BuildDocumentSchema).toBe(BuildSchema);
    const missingContent = Object.fromEntries(
      Object.entries(draftBuild()).filter(([key]) => key !== 'summary'),
    );
    expect(BuildSchema.safeParse(missingContent).success).toBe(false);
    expect(BuildSchema.safeParse({ ...draftBuild(), extra_private_field: 'unknown' }).success).toBe(
      false,
    );
  });

  it('rejects duplicate guide entities and duplicate source references', () => {
    for (const field of ['masteries', 'skill_nodes', 'sources', 'constellations'] as const) {
      const document = draftBuild();
      expect(
        BuildSchema.safeParse({ ...document, [field]: [document[field][0], document[field][0]] })
          .success,
      ).toBe(false);
    }
    const document = draftBuild();
    expect(
      BuildSchema.safeParse({
        ...document,
        source_slugs: [...document.source_slugs, ...document.source_slugs],
      }).success,
    ).toBe(false);
  });

  it('checks title, purchase and devotion catalog references', () => {
    const document = draftBuild();
    for (const change of [
      { title_a_mastery_slug: 'unknown' },
      { title_b_mastery_slug: 'unknown' },
      { title_b_mastery_slug: document.title_a_mastery_slug },
      { purchase_steps: [{ ...document.purchase_steps[0], mastery_slug: 'unknown' }] },
      { devotion_steps: [{ ...document.devotion_steps[0], constellation_slug: 'unknown' }] },
    ]) {
      expect(BuildSchema.safeParse({ ...document, ...change }).success).toBe(false);
    }
  });

  it('rejects an unconfirmed author even if its slug looks real', () => {
    const document = publishableBuild();
    expect(
      BuildSchema.safeParse({ ...document, author: { ...document.author, is_placeholder: true } })
        .success,
    ).toBe(false);
  });

  it('keeps public validation independent of private editorial signatures', () => {
    const dto = publicBuild();
    expect(DomainSchema.PublicBuildSchema.safeParse(dto).success).toBe(true);
    for (const change of [
      { review_state: 'borrador' },
      { rights_status: 'pending' },
      { rights_status: 'link_only' },
      { published_at: null },
      { author_slug: 'por-confirmar', author: { ...dto.author, slug: 'por-confirmar' } },
      { source_slugs: [], sources: [] },
    ]) {
      expect(DomainSchema.PublicBuildSchema.safeParse({ ...dto, ...change }).success).toBe(false);
    }
  });

  it('allows only web URLs and rejects private metadata in nested public resources', () => {
    const dto = publicBuild();
    expect(
      DomainSchema.PublicBuildSchema.safeParse({
        ...dto,
        author: { ...dto.author, is_placeholder: false },
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.SourceSchema.safeParse({
        ...draftBuild().sources[0],
        url: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.AuthorSchema.safeParse({ ...draftBuild().author, display_name: ' ' }).success,
    ).toBe(false);
  });

  const catalog = () => ({
    slug: 'principal',
    locale: 'es',
    title: 'Catálogo sintético',
    game_version: '1.2.x',
    review_state: 'publicado',
    author_slug: 'autor-real',
    sources: [],
    masteries: [
      {
        slug: 'chaman',
        name_es: 'Chamán',
        name_en: 'Shaman',
        accent_token: 'storm',
        fallback_icon: 'sword',
        asset_slug: null,
      },
      {
        slug: 'demoledor',
        name_es: 'Demoledor',
        name_en: 'Demolitionist',
        accent_token: 'ember',
        fallback_icon: 'sword',
        asset_slug: null,
      },
    ],
    combinations: [
      { slug: 'chaman-demoledor', mastery_a_slug: 'chaman', mastery_b_slug: 'demoledor' },
    ],
    entries: [
      {
        entry_kind: 'placeholder',
        combination_slug: 'chaman-demoledor',
        display_name: 'Elementalista',
        build_slug: null,
        tier: 'sin_clasificar',
        content_status: 'placeholder',
        rights_status: 'own_original',
        review_state: 'publicado',
        external_url: null,
        external_author: null,
        source_slug: null,
        evaluated_on: null,
      },
    ],
  });

  it('round-trips the catalog and derives a public catalog with the same content', () => {
    const list = catalog();
    expect(DomainSchema.TierListSchema.parse(list)).toEqual(list);
    expect(DomainSchema.PublicTierListSchema.parse(list)).toEqual(list);
  });

  it('rejects duplicate catalog entities and missing combination references', () => {
    const list = catalog();
    for (const field of ['masteries', 'combinations'] as const) {
      expect(
        DomainSchema.TierListSchema.safeParse({
          ...list,
          [field]: [list[field][0], list[field][0]],
        }).success,
      ).toBe(false);
    }
    expect(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        sources: [draftBuild().sources[0], draftBuild().sources[0]],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        combinations: [{ ...list.combinations[0], mastery_a_slug: 'unknown' }],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        combinations: [{ ...list.combinations[0], mastery_b_slug: 'unknown' }],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        entries: [{ ...list.entries[0], combination_slug: 'unknown' }],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.MasteryCombinationSchema.safeParse({
        ...list.combinations[0],
        mastery_b_slug: 'chaman',
      }).success,
    ).toBe(false);
  });

  it('requires source references and never publishes hidden tier entries', () => {
    const list = catalog();
    const ranked = {
      ...list.entries[0],
      entry_kind: 'build_propia',
      build_slug: 'example-build',
      content_status: 'verificado',
      tier: 'A',
      source_slug: 'guia-original',
      evaluated_on: '2026-11-08',
    };
    expect(DomainSchema.TierListSchema.safeParse({ ...list, entries: [ranked] }).success).toBe(
      false,
    );
    expect(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        entries: [ranked],
        sources: draftBuild().sources,
      }).success,
    ).toBe(true);
    expect(
      DomainSchema.PublicTierListSchema.safeParse({ ...list, review_state: 'borrador' }).success,
    ).toBe(false);
    expect(
      DomainSchema.PublicTierListSchema.safeParse({
        ...list,
        entries: [{ ...list.entries[0], review_state: 'borrador' }],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.PublicTierListSchema.safeParse({
        ...list,
        entries: [{ ...list.entries[0], rights_status: 'pending' }],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        combinations: [{ ...list.combinations[0], mastery_b_slug: null }],
      }).success,
    ).toBe(true);
  });

  it('rejects a file attached to an unapproved asset', () => {
    expect(
      AssetSchema.safeParse({
        slug: 'pending-asset',
        status: 'pending',
        file_path: 'assets/file.svg',
        origin_url: null,
        rights_holder: null,
        license_or_permission: null,
        proof_ref: null,
        recorded_on: '2026-11-08',
        fallback_svg: 'own-icon',
      }).success,
    ).toBe(false);
  });
});

describe('BuildSchema', () => {
  it('accepts a draft build with pending rights', () => {
    expect(BuildSchema.safeParse(draftBuild()).success).toBe(true);
  });

  it('round-trips every structured guide section without discarding names or metadata', () => {
    const document = draftBuild();
    expect(BuildSchema.parse(document)).toEqual(document);
  });

  it('rejects tree nodes that reference a mastery outside the build', () => {
    const result = BuildSchema.safeParse({
      ...draftBuild(),
      skill_nodes: draftBuild().skill_nodes.map((node) =>
        node.slug === 'golpe-primigenio' ? { ...node, mastery_slug: 'maestria-inexistente' } : node,
      ),
    });
    expect(result.success).toBe(false);
  });

  it('keeps nested author and source references consistent with their slugs', () => {
    const document = draftBuild();
    expect(
      BuildSchema.safeParse({ ...document, author: { ...document.author, slug: 'otro-autor' } })
        .success,
    ).toBe(false);
    expect(BuildSchema.safeParse({ ...document, source_slugs: ['otra-fuente'] }).success).toBe(
      false,
    );
  });

  it('rejects priority, purchase and devotion references to unknown guide nodes', () => {
    const document = draftBuild();
    const invalidReferences = [
      {
        ...document,
        priorities: document.priorities.map((priority) => ({
          ...priority,
          skill_node_slugs: ['nodo-inexistente'],
        })),
      },
      {
        ...document,
        purchase_steps: document.purchase_steps.map((step) => ({
          ...step,
          highlights: [{ skill_node_slug: 'nodo-inexistente', points: 1 }],
        })),
      },
      {
        ...document,
        devotion_steps: document.devotion_steps.map((step) => ({
          ...step,
          bindings: [{ power_en: 'Storm', skill_node_slug: 'nodo-inexistente' }],
        })),
      },
    ];
    for (const candidate of invalidReferences) {
      expect(BuildSchema.safeParse(candidate).success).toBe(false);
    }
  });

  it('exposes a separately derived public build schema', () => {
    const schema = Reflect.get(DomainSchema, 'PublicBuildSchema') as
      { safeParse(value: unknown): { success: boolean } } | undefined;
    expect(schema).toBeDefined();
    if (!schema) return;

    const dto = publicBuild();
    const sources = dto.sources;

    expect(schema.safeParse(dto).success).toBe(true);
    expect(schema.safeParse({ ...dto, reviewed_by: 'revisor-privado' }).success).toBe(false);
    expect(
      schema.safeParse({
        ...dto,
        sources: [{ ...sources[0], permission_ref: 'evidence-private-fixture' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a skill tree whose parents form a cycle', () => {
    const result = BuildSchema.safeParse({
      ...draftBuild(),
      skill_nodes: [
        { ...draftBuild().skill_nodes[0], slug: 'a', parent_slug: 'b' },
        { ...draftBuild().skill_nodes[1], slug: 'b', parent_slug: 'a' },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('ciclo'))).toBe(true);
  });

  it('rejects a negative bar requirement', () => {
    const result = BuildSchema.safeParse({
      ...draftBuild(),
      skill_nodes: [{ ...draftBuild().skill_nodes[0], bar_required: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts publicado when rights are approved and confirmed', () => {
    expect(BuildSchema.safeParse(publishableBuild()).success).toBe(true);
  });

  it('blocks publicado while rights_status is pending', () => {
    const result = BuildSchema.safeParse({ ...publishableBuild(), rights_status: 'pending' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('rights_status'))).toBe(true);
  });

  it('rejects a rights_status outside the enum', () => {
    expect(BuildSchema.safeParse({ ...draftBuild(), rights_status: 'unknown' }).success).toBe(
      false,
    );
  });

  it('blocks publicado without rights confirmation', () => {
    const result = BuildSchema.safeParse({ ...publishableBuild(), rights_confirmed_by: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('rights_confirmed_by'))).toBe(true);
  });

  it('blocks publicado without reviewer or publication date', () => {
    expect(
      BuildSchema.safeParse({ ...publishableBuild(), reviewed_by: null, published_at: null })
        .success,
    ).toBe(false);
  });

  it('blocks publicado when the author is still the placeholder', () => {
    expect(
      BuildSchema.safeParse({ ...publishableBuild(), author_slug: 'por-confirmar' }).success,
    ).toBe(false);
  });

  it('blocks publicado without at least one source', () => {
    expect(BuildSchema.safeParse({ ...publishableBuild(), source_slugs: [] }).success).toBe(false);
  });
});

describe('findParentCycle', () => {
  it('returns null for an acyclic forest', () => {
    expect(
      findParentCycle([
        { slug: 'a', parent_slug: null },
        { slug: 'b', parent_slug: 'a' },
        { slug: 'c', parent_slug: 'b' },
      ]),
    ).toBeNull();
  });

  it('returns the slugs that take part in a cycle', () => {
    const cycle = findParentCycle([
      { slug: 'x', parent_slug: null },
      { slug: 'a', parent_slug: 'b' },
      { slug: 'b', parent_slug: 'a' },
    ]);
    expect(cycle?.sort()).toEqual(['a', 'b']);
  });
});

describe('TierEntrySchema', () => {
  const placeholder = () => ({
    entry_kind: 'placeholder',
    combination_slug: 'rayo-chaman',
    display_name: 'Rayo + Chamán',
    build_slug: null,
    tier: 'sin_clasificar',
    content_status: 'placeholder',
    rights_status: 'own_original',
    review_state: 'publicado',
    external_url: null,
    external_author: null,
    source_slug: null,
    evaluated_on: null,
  });

  const linkEntry = (overrides: Record<string, unknown> = {}) => ({
    ...placeholder(),
    entry_kind: 'enlace_externo',
    tier: 'sin_clasificar',
    content_status: 'sin_verificar',
    rights_status: 'link_only',
    external_url: 'https://example.org/guia',
    external_author: 'Autor externo',
    source_slug: 'fuente-externa',
    evaluated_on: '2026-11-11',
    ...overrides,
  });

  it('accepts a placeholder slot with no tier, guide or link', () => {
    expect(TierEntrySchema.safeParse(placeholder()).success).toBe(true);
  });

  it('rejects a placeholder that carries a tier', () => {
    expect(TierEntrySchema.safeParse({ ...placeholder(), tier: 'S' }).success).toBe(false);
  });

  it('rejects a placeholder that carries an external link', () => {
    expect(
      TierEntrySchema.safeParse({ ...placeholder(), external_url: 'https://example.org/g' })
        .success,
    ).toBe(false);
  });

  it('requires source and evaluation date for any real tier', () => {
    const result = TierEntrySchema.safeParse({
      ...placeholder(),
      entry_kind: 'build_propia',
      build_slug: 'chaman-demoledor-golpe-primigenio',
      tier: 'A',
      content_status: 'sin_verificar',
      rights_status: 'own_original',
      source_slug: null,
      evaluated_on: null,
    });
    expect(result.success).toBe(false);
  });

  it('requires link_only rights, url and author for enlace_externo', () => {
    const base = {
      ...placeholder(),
      entry_kind: 'enlace_externo',
      tier: 'sin_clasificar',
      content_status: 'sin_verificar',
      source_slug: 'fuente-externa',
    };
    expect(TierEntrySchema.safeParse(base).success).toBe(false);
    expect(
      TierEntrySchema.safeParse({
        ...base,
        rights_status: 'link_only',
        external_url: 'https://example.org/guia',
        external_author: 'Autor externo',
      }).success,
    ).toBe(true);
  });

  it('accepts a link card classified as unranked', () => {
    expect(TierEntrySchema.safeParse(linkEntry()).success).toBe(true);
  });

  it('rejects a link card carrying a ranking derived from the source', () => {
    const result = TierEntrySchema.safeParse(linkEntry({ tier: 'S' }));
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.includes('tier'));
    expect(issue?.message).toContain('ranking derivado de la fuente');
  });

  it('keeps a real tier valid for own builds with source and date', () => {
    const result = TierEntrySchema.safeParse({
      ...placeholder(),
      entry_kind: 'build_propia',
      build_slug: 'chaman-demoledor-golpe-primigenio',
      tier: 'S',
      content_status: 'verificado',
      rights_status: 'own_original',
      source_slug: 'fuente-propia',
      evaluated_on: '2026-11-11',
    });
    expect(result.success).toBe(true);
  });

  // T-108: the SQL entry_kind enum gains build_adaptada; the domain contract mirrors it.
  it('accepts an adapted third-party build tied to a build slug', () => {
    const result = TierEntrySchema.safeParse({
      ...placeholder(),
      entry_kind: 'build_adaptada',
      build_slug: 'adaptacion-sintetica',
      display_name: null,
      tier: 'A',
      content_status: 'sin_verificar',
      rights_status: 'licensed',
      source_slug: 'fuente-externa',
      evaluated_on: '2026-11-11',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an adapted third-party build without a build_slug', () => {
    const result = TierEntrySchema.safeParse({
      ...placeholder(),
      entry_kind: 'build_adaptada',
      build_slug: null,
      display_name: 'Adaptación sin build',
      content_status: 'sin_verificar',
      rights_status: 'licensed',
      source_slug: 'fuente-externa',
      evaluated_on: '2026-11-11',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'build_adaptada requiere build_slug',
    );
  });
});

describe('AssetSchema', () => {
  const pending = () => ({
    slug: 'icono-rayo',
    status: 'pending',
    file_path: null,
    origin_url: null,
    rights_holder: null,
    license_or_permission: null,
    proof_ref: null,
    recorded_on: '2026-11-08',
    fallback_svg: 'src/assets/icons/rayo.svg',
  });

  it('accepts a pending asset without provenance', () => {
    expect(AssetSchema.safeParse(pending()).success).toBe(true);
  });

  it('rejects an approved asset missing license_or_permission', () => {
    const result = AssetSchema.safeParse({
      ...pending(),
      status: 'approved',
      file_path: 'public/assets/rayo.png',
      origin_url: 'https://example.org/rayo.png',
      rights_holder: 'Titular',
      license_or_permission: null,
      proof_ref: 'proofs/rayo.pdf',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('license_or_permission'))).toBe(true);
  });

  it('accepts an approved asset with every provenance field', () => {
    expect(
      AssetSchema.safeParse({
        ...pending(),
        status: 'approved',
        file_path: 'public/assets/rayo.png',
        origin_url: 'https://example.org/rayo.png',
        rights_holder: 'Titular',
        license_or_permission: 'Permiso escrito',
        proof_ref: 'proofs/rayo.pdf',
      }).success,
    ).toBe(true);
  });
});

describe('documented vocabularies and formats', () => {
  const assetBase = () => ({
    slug: 'icono-rayo',
    status: 'pending',
    file_path: null,
    origin_url: null,
    rights_holder: null,
    license_or_permission: null,
    proof_ref: null,
    recorded_on: '2026-11-08',
    fallback_svg: 'src/assets/icons/rayo.svg',
  });

  it('accepts every documented damage type and rejects an unknown one', () => {
    const document = draftBuild();
    for (const damageType of [
      'fisico',
      'fuego',
      'frio',
      'rayo',
      'acido',
      'vitalidad',
      'caos',
      'eter',
      'elemental',
      'sangrado',
      'mascotas',
    ]) {
      expect(BuildSchema.safeParse({ ...document, damage_types: [damageType] }).success).toBe(true);
    }
    expect(BuildSchema.safeParse({ ...document, damage_types: ['arcano'] }).success).toBe(false);
  });

  it('accepts every documented playstyle and content tag', () => {
    const document = draftBuild();
    for (const playstyle of ['melee', 'rango', 'mascotas', 'hibrido']) {
      expect(BuildSchema.safeParse({ ...document, playstyle }).success).toBe(true);
    }
    expect(BuildSchema.safeParse({ ...document, playstyle: 'magia' }).success).toBe(false);
    for (const tag of ['campana', 'shattered_realm', 'crucible', 'jefes', 'farmeo']) {
      expect(BuildSchema.safeParse({ ...document, content_tags: [tag] }).success).toBe(true);
    }
    expect(BuildSchema.safeParse({ ...document, content_tags: ['dlc'] }).success).toBe(false);
  });

  it('accepts every documented note kind and loot action', () => {
    const document = draftBuild();
    for (const kind of [
      'devociones',
      'nombres',
      'atributos',
      'arma',
      'mas_adelante',
      'rotacion',
      'general',
    ]) {
      expect(
        BuildSchema.safeParse({ ...document, notes: [{ ...document.notes[0], kind }] }).success,
      ).toBe(true);
    }
    expect(
      BuildSchema.safeParse({ ...document, notes: [{ ...document.notes[0], kind: 'otro' }] })
        .success,
    ).toBe(false);
    const column = document.loot_filter_columns[0]!;
    for (const action of ['marcar', 'desmarcar', 'aviso']) {
      const rules = [{ ...column.rules[0], action }];
      expect(
        BuildSchema.safeParse({
          ...document,
          loot_filter_columns: [{ ...column, rules }],
        }).success,
      ).toBe(true);
    }
    expect(
      BuildSchema.safeParse({
        ...document,
        loot_filter_columns: [{ ...column, rules: [{ ...column.rules[0], action: 'borrar' }] }],
      }).success,
    ).toBe(false);
  });

  it('accepts every documented source kind and skill node status', () => {
    const source = draftBuild().sources[0];
    for (const kind of ['original', 'comunidad', 'oficial', 'video', 'externa_enlace']) {
      expect(DomainSchema.SourceSchema.safeParse({ ...source, kind }).success).toBe(true);
    }
    expect(DomainSchema.SourceSchema.safeParse({ ...source, kind: 'blog' }).success).toBe(false);
    const document = draftBuild();
    const withStatus = (status: string) => [
      { ...document.skill_nodes[0], status },
      document.skill_nodes[1],
    ];
    for (const status of ['recomendada', 'meta', 'omitir']) {
      expect(BuildSchema.safeParse({ ...document, skill_nodes: withStatus(status) }).success).toBe(
        true,
      );
    }
    expect(
      BuildSchema.safeParse({ ...document, skill_nodes: withStatus('opcional') }).success,
    ).toBe(false);
  });

  it('accepts every documented devotion enum value and rejects unknown ones', () => {
    const document = draftBuild();
    const step = document.devotion_steps[0];
    for (const accent of ['storm', 'ember']) {
      expect(
        BuildSchema.safeParse({ ...document, devotion_steps: [{ ...step, accent }] }).success,
      ).toBe(true);
    }
    for (const kind of ['ruta', 'verificacion', 'limpieza']) {
      expect(
        BuildSchema.safeParse({ ...document, devotion_steps: [{ ...step, kind }] }).success,
      ).toBe(true);
    }
    for (const verification of ['verificado', 'sin_verificar']) {
      expect(
        BuildSchema.safeParse({ ...document, devotion_steps: [{ ...step, verification }] }).success,
      ).toBe(true);
    }
    expect(
      BuildSchema.safeParse({
        ...document,
        devotion_steps: [{ ...step, accent: 'frost' }],
      }).success,
    ).toBe(false);
    expect(
      BuildSchema.safeParse({
        ...document,
        devotion_steps: [{ ...step, kind: 'extra' }],
      }).success,
    ).toBe(false);
    expect(
      BuildSchema.safeParse({
        ...document,
        devotion_steps: [{ ...step, verification: 'dudoso' }],
      }).success,
    ).toBe(false);
  });

  it('accepts the documented asset statuses and rejects an unknown one', () => {
    for (const status of ['pending', 'rejected']) {
      expect(AssetSchema.safeParse({ ...assetBase(), status }).success).toBe(true);
    }
    expect(AssetSchema.safeParse({ ...assetBase(), status: 'draft' }).success).toBe(false);
  });

  it('enforces the documented slug grammar', () => {
    for (const value of ['a', 'abc', 'a1', '0', 'a-b', 'chaman-demoledor', 'a1-b2-c3']) {
      expect(AssetSchema.safeParse({ ...assetBase(), slug: value }).success).toBe(true);
    }
    for (const value of ['', 'A', 'a b', 'a_b', '-a', 'a-', 'a--b', 'á', 'a.b', ' a']) {
      expect(AssetSchema.safeParse({ ...assetBase(), slug: value }).success).toBe(false);
    }
  });

  it('accepts only http and https web links', () => {
    const source = draftBuild().sources[0];
    for (const url of ['http://example.org/a', 'https://example.org/a?b=1#c']) {
      expect(DomainSchema.SourceSchema.safeParse({ ...source, url }).success).toBe(true);
    }
    for (const url of [
      'ftp://example.org/a',
      'javascript:alert(1)',
      'HTTPS://example.org/a',
      'file:///tmp/a',
      'mailto:autor@example.org',
      'example.org/a',
    ]) {
      expect(DomainSchema.SourceSchema.safeParse({ ...source, url }).success).toBe(false);
    }
    expect(
      DomainSchema.AuthorSchema.safeParse({
        ...draftBuild().author,
        url: 'ftp://example.org/autor',
      }).success,
    ).toBe(false);
  });

  it('keeps optional mastery references truly optional', () => {
    const document = draftBuild();
    expect(BuildSchema.safeParse({ ...document, title_b_mastery_slug: null }).success).toBe(true);
    expect(
      BuildSchema.safeParse({
        ...document,
        purchase_steps: [{ ...document.purchase_steps[0], mastery_slug: null }],
      }).success,
    ).toBe(true);
    expect(
      BuildSchema.safeParse({
        ...document,
        devotion_steps: [{ ...document.devotion_steps[0], constellation_slug: null }],
      }).success,
    ).toBe(true);
  });

  it('rejects a source list that does not cover the declared source slugs', () => {
    const document = draftBuild();
    const extraSource = { ...document.sources[0], slug: 'guia-secundaria' };
    expect(
      BuildSchema.safeParse({
        ...document,
        sources: [...document.sources, extraSource],
      }).success,
    ).toBe(false);
  });

  it('requires both rights confirmation fields for publicado', () => {
    expect(
      BuildSchema.safeParse({ ...publishableBuild(), rights_confirmed_on: null }).success,
    ).toBe(false);
    expect(
      BuildSchema.safeParse({ ...publishableBuild(), rights_confirmed_by: null }).success,
    ).toBe(false);
  });

  it('accepts every documented review state, tier and permitted published rights', () => {
    for (const reviewState of ['borrador', 'en_revision']) {
      expect(BuildSchema.safeParse({ ...draftBuild(), review_state: reviewState }).success).toBe(
        true,
      );
    }
    for (const reviewState of ['borrador', 'en_revision', 'publicado']) {
      expect(
        DomainSchema.TierListSchema.safeParse({ ...catalogFixture(), review_state: reviewState })
          .success,
      ).toBe(true);
    }
    for (const rightsStatus of ['own_original', 'licensed', 'permission_granted']) {
      expect(
        BuildSchema.safeParse({ ...publishableBuild(), rights_status: rightsStatus }).success,
      ).toBe(true);
      expect(
        DomainSchema.PublicBuildSchema.safeParse({
          ...publicBuild(),
          rights_status: rightsStatus,
        }).success,
      ).toBe(true);
    }
    for (const tier of ['S', 'A', 'B', 'C', 'D', 'sin_clasificar']) {
      const sourceSlug = tier === 'sin_clasificar' ? null : 'fuente-propia';
      const evaluatedOn = tier === 'sin_clasificar' ? null : '2026-11-11';
      expect(
        TierEntrySchema.safeParse({
          ...placeholderEntry(),
          entry_kind: 'build_propia',
          build_slug: 'chaman-demoledor-golpe-primigenio',
          tier,
          source_slug: sourceSlug,
          evaluated_on: evaluatedOn,
        }).success,
      ).toBe(true);
    }
  });

  it('rejects a placeholder entry whose content status is not placeholder', () => {
    const result = TierEntrySchema.safeParse({
      ...placeholderEntry(),
      content_status: 'verificado',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'placeholder requiere content_status=placeholder',
    );
  });

  it('rejects a build_propia entry without a build slug', () => {
    const result = TierEntrySchema.safeParse({
      ...placeholderEntry(),
      entry_kind: 'build_propia',
      build_slug: null,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'build_propia requiere build_slug',
    );
  });

  it('enforces cross references in the public build and tier list DTOs', () => {
    const dto = publicBuild() as unknown as Record<string, unknown> & {
      skill_nodes: (Record<string, unknown> | undefined)[];
      priorities: Record<string, unknown>[];
    };
    expect(
      DomainSchema.PublicBuildSchema.safeParse({
        ...dto,
        skill_nodes: [dto.skill_nodes[0], dto.skill_nodes[0]],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.PublicBuildSchema.safeParse({
        ...dto,
        priorities: dto.priorities.map((priority) => ({
          ...priority,
          skill_node_slugs: ['nodo-inexistente'],
        })),
      }).success,
    ).toBe(false);
    const list = catalogFixture();
    expect(
      DomainSchema.PublicTierListSchema.safeParse({
        ...list,
        entries: [{ ...list.entries[0], combination_slug: 'combinacion-inexistente' }],
      }).success,
    ).toBe(false);
    expect(
      DomainSchema.PublicTierListSchema.safeParse({
        ...list,
        entries: [{ ...list.entries[0], source_slug: 'fuente-inexistente' }],
        sources: draftBuild().sources,
      }).success,
    ).toBe(false);
  });

  it('requires either a build slug or a display name in every tier entry', () => {
    const result = TierEntrySchema.safeParse({
      entry_kind: 'build_propia',
      combination_slug: 'rayo-chaman',
      display_name: null,
      build_slug: null,
      tier: 'sin_clasificar',
      content_status: 'sin_verificar',
      rights_status: 'own_original',
      review_state: 'publicado',
      external_url: null,
      external_author: null,
      source_slug: null,
      evaluated_on: null,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'requiere build_slug o display_name',
    );
  });
});

describe('findParentCycle edge cases', () => {
  it('finds a cycle that hangs from an acyclic root', () => {
    const cycle = findParentCycle([
      { slug: 'root', parent_slug: null },
      { slug: 'x', parent_slug: 'y' },
      { slug: 'y', parent_slug: 'x' },
    ]);
    expect(cycle?.sort()).toEqual(['x', 'y']);
  });

  it('treats a parent outside the forest and an empty forest as acyclic', () => {
    expect(findParentCycle([{ slug: 'a', parent_slug: 'fantasma' }])).toBeNull();
    expect(findParentCycle([])).toBeNull();
  });
});

describe('T-130 faithful source values', () => {
  const unknownDetails = () => {
    const original = draftBuild();
    return {
      purchase_steps: [
        {
          ...original.purchase_steps[0],
          highlights: [{ skill_node_slug: 'golpe-atronador', points: null }],
        },
      ],
      constellations: [{ ...original.constellations[0], tier_level: null }],
      devotion_steps: [
        {
          ...original.devotion_steps[0],
          verification: 'sin_verificar',
          bindings: [
            {
              power_en: 'Elemental Storm',
              skill_node_slug: null,
              skill_name_es: 'Tótem de Tormenta',
            },
          ],
        },
      ],
    };
  };

  it('round-trips unknown targets, unknown constellation level and a named external-tree binding', () => {
    const document = { ...draftBuild(), ...unknownDetails() };
    expect(BuildSchema.parse(document)).toEqual(document);
    const dto = { ...publicBuild(), ...unknownDetails() };
    expect(DomainSchema.PublicBuildSchema.parse(dto)).toEqual(dto);
  });

  it('still rejects invalid numeric targets and constellation levels', () => {
    const doc = draftBuild();
    expect(
      BuildSchema.safeParse({
        ...doc,
        purchase_steps: [
          {
            ...doc.purchase_steps[0],
            highlights: [{ skill_node_slug: 'golpe-atronador', points: -1 }],
          },
        ],
      }).success,
    ).toBe(false);
    for (const tier_level of [0, 4, 1.5]) {
      expect(
        BuildSchema.safeParse({
          ...doc,
          constellations: [{ ...doc.constellations[0], tier_level }],
        }).success,
      ).toBe(false);
    }
  });

  it('requires a nonempty external skill name and an explicitly unverified step', () => {
    const doc = { ...draftBuild(), ...unknownDetails() };
    const step = doc.devotion_steps[0]!;
    for (const binding of [
      { power_en: 'Elemental Storm', skill_node_slug: null },
      { power_en: 'Elemental Storm', skill_node_slug: null, skill_name_es: '' },
      { power_en: 'Elemental Storm', skill_node_slug: null, skill_name_es: ' ' },
      {
        power_en: 'Elemental Storm',
        skill_node_slug: 'unknown-node',
        skill_name_es: 'Tótem de Tormenta',
      },
    ]) {
      expect(
        BuildSchema.safeParse({ ...doc, devotion_steps: [{ ...step, bindings: [binding] }] })
          .success,
      ).toBe(false);
    }
    expect(
      BuildSchema.safeParse({ ...doc, devotion_steps: [{ ...step, verification: 'verificado' }] })
        .success,
    ).toBe(false);
    const dto = {
      ...publicBuild(),
      ...unknownDetails(),
      devotion_steps: [{ ...step, verification: 'verificado' }],
    };
    expect(DomainSchema.PublicBuildSchema.safeParse(dto).success).toBe(false);
  });

  it('does not turn a broken node reference into a valid named binding', () => {
    const doc = draftBuild();
    expect(
      BuildSchema.safeParse({
        ...doc,
        devotion_steps: [
          {
            ...doc.devotion_steps[0],
            verification: 'sin_verificar',
            bindings: [{ power_en: 'Reckless Tempest', skill_node_slug: 'unknown-node' }],
          },
        ],
      }).success,
    ).toBe(false);
  });
});

interface DiagnosticResult {
  success: boolean;
  error?: {
    issues: readonly { code?: string; path: readonly PropertyKey[]; message: string }[];
  };
}

const diagnostics = (result: DiagnosticResult) =>
  result.success
    ? []
    : (result.error?.issues ?? []).map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      }));

const expectDiagnostic = (result: DiagnosticResult, path: (string | number)[], message: string) =>
  expect(diagnostics(result)).toContainEqual({ path: path.map(String), message });

describe('rejection diagnostics', () => {
  const linkEntry = (overrides: Record<string, unknown> = {}) => ({
    ...placeholderEntry(),
    entry_kind: 'enlace_externo',
    content_status: 'sin_verificar',
    rights_status: 'link_only',
    external_url: 'https://example.org/guia',
    external_author: 'Autor externo',
    source_slug: 'fuente-externa',
    evaluated_on: '2026-11-11',
    ...overrides,
  });

  const rankedEntry = () => ({
    ...placeholderEntry(),
    entry_kind: 'build_propia',
    build_slug: 'guia-sintetica',
    tier: 'A',
    content_status: 'sin_verificar',
    source_slug: 'fuente-propia',
    evaluated_on: '2026-11-11',
  });

  it('reports duplicate slugs for every guide entity list', () => {
    for (const field of ['masteries', 'skill_nodes', 'constellations', 'sources'] as const) {
      const document = draftBuild();
      expectDiagnostic(
        BuildSchema.safeParse({
          ...document,
          [field]: [document[field][0], document[field][0]],
        }),
        [field],
        'slugs duplicados',
      );
    }
  });

  it('reports unknown mastery references with their field path', () => {
    const document = draftBuild();
    expectDiagnostic(
      BuildSchema.safeParse({ ...document, title_a_mastery_slug: 'desconocida' }),
      ['title_a_mastery_slug'],
      'maestría desconocida',
    );
    expectDiagnostic(
      BuildSchema.safeParse({ ...document, title_b_mastery_slug: 'desconocida' }),
      ['title_b_mastery_slug'],
      'maestría desconocida',
    );
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        skill_nodes: document.skill_nodes.map((node, index) =>
          index === 0 ? { ...node, mastery_slug: 'desconocida' } : node,
        ),
      }),
      ['skill_nodes', 0, 'mastery_slug'],
      'maestría desconocida',
    );
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        purchase_steps: [{ ...document.purchase_steps[0], mastery_slug: 'desconocida' }],
      }),
      ['purchase_steps', 0, 'mastery_slug'],
      'maestría desconocida',
    );
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        devotion_steps: [{ ...document.devotion_steps[0], constellation_slug: 'desconocida' }],
      }),
      ['devotion_steps', 0, 'constellation_slug'],
      'constelación desconocida',
    );
  });

  it('reports the first mastery cycle with its members', () => {
    const document = draftBuild();
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        skill_nodes: [
          { ...document.skill_nodes[0], slug: 'a', parent_slug: 'b' },
          { ...document.skill_nodes[1], slug: 'b', parent_slug: 'a' },
        ],
      }),
      ['skill_nodes'],
      'ciclo de padres en el árbol: a, b',
    );
  });

  it('reports every unknown node reference with its path', () => {
    const document = draftBuild();
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        priorities: document.priorities.map((priority) => ({
          ...priority,
          skill_node_slugs: ['fantasma'],
        })),
      }),
      ['priorities', 0, 'skill_node_slugs'],
      'nodo de guía desconocido',
    );
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        skill_nodes: document.skill_nodes.map((node, index) =>
          index === 0 ? { ...node, parent_slug: 'fantasma' } : node,
        ),
      }),
      ['skill_nodes', 0, 'parent_slug'],
      'nodo de guía desconocido',
    );
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        purchase_steps: document.purchase_steps.map((step) => ({
          ...step,
          highlights: [{ skill_node_slug: 'fantasma', points: 1 }],
        })),
      }),
      ['purchase_steps', 0, 'highlights'],
      'nodo de guía desconocido',
    );
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        devotion_steps: document.devotion_steps.map((step) => ({
          ...step,
          bindings: [{ power_en: 'Storm', skill_node_slug: 'fantasma' }],
        })),
      }),
      ['devotion_steps', 0, 'bindings'],
      'nodo de guía desconocido',
    );
  });

  it('reports incoherent source references for every broken shape', () => {
    const source = draftBuild().sources[0]!;
    const other = { ...source, slug: 'guia-secundaria' };
    const document = draftBuild();
    const changes = [
      { source_slugs: ['guia-original', 'guia-original'], sources: [source] },
      { source_slugs: ['guia-original'], sources: [source, other] },
      { source_slugs: ['guia-original', 'guia-fantasma'], sources: [source, other] },
      { source_slugs: ['guia-fantasma'], sources: [source] },
    ];
    for (const change of changes) {
      expectDiagnostic(
        BuildSchema.safeParse({ ...document, ...change }),
        ['source_slugs'],
        'referencias de fuentes incoherentes',
      );
    }
  });

  it('reports each publication requirement with its own path', () => {
    const published = publishableBuild();
    expectDiagnostic(
      BuildSchema.safeParse({ ...published, rights_status: 'pending' }),
      ['rights_status'],
      'publicado no admite rights_status=pending',
    );
    expectDiagnostic(
      BuildSchema.safeParse({ ...published, rights_confirmed_by: null }),
      ['rights_confirmed_by'],
      'publicado requiere confirmación de derechos',
    );
    expectDiagnostic(
      BuildSchema.safeParse({ ...published, rights_confirmed_on: null }),
      ['rights_confirmed_by'],
      'publicado requiere confirmación de derechos',
    );
    expectDiagnostic(
      BuildSchema.safeParse({ ...published, reviewed_by: null }),
      ['reviewed_by'],
      'publicado requiere revisor',
    );
    expectDiagnostic(
      BuildSchema.safeParse({ ...published, published_at: null }),
      ['published_at'],
      'publicado requiere fecha de publicación',
    );
    expectDiagnostic(
      BuildSchema.safeParse({ ...published, source_slugs: [], sources: [] }),
      ['source_slugs'],
      'publicado requiere al menos una fuente',
    );
    const placeholder = {
      ...published,
      author_slug: 'por-confirmar',
      author: { ...published.author, slug: 'por-confirmar' },
    };
    expectDiagnostic(
      BuildSchema.safeParse(placeholder),
      ['author_slug'],
      'publicado requiere un autor confirmado',
    );
  });

  it('reports each public DTO requirement with its own path', () => {
    const dto = publicBuild();
    expectDiagnostic(
      DomainSchema.PublicBuildSchema.safeParse({ ...dto, review_state: 'borrador' }),
      ['review_state'],
      'DTO público requiere publicado',
    );
    expectDiagnostic(
      DomainSchema.PublicBuildSchema.safeParse({ ...dto, rights_status: 'pending' }),
      ['rights_status'],
      'una guía pública requiere derechos sobre su contenido',
    );
    expectDiagnostic(
      DomainSchema.PublicBuildSchema.safeParse({ ...dto, published_at: null }),
      ['published_at'],
      'DTO público requiere fecha de publicación',
    );
    expectDiagnostic(
      DomainSchema.PublicBuildSchema.safeParse({
        ...dto,
        author_slug: 'por-confirmar',
        author: { ...dto.author, slug: 'por-confirmar' },
      }),
      ['author_slug'],
      'autor no confirmado',
    );
    expectDiagnostic(
      DomainSchema.PublicBuildSchema.safeParse({ ...dto, source_slugs: [], sources: [] }),
      ['source_slugs'],
      'fuente requerida',
    );
  });

  it('reports each tier entry rule with its own path', () => {
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...placeholderEntry(), tier: 'S' }),
      ['tier'],
      'placeholder sin tier',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...placeholderEntry(), content_status: 'verificado' }),
      ['content_status'],
      'placeholder requiere content_status=placeholder',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...placeholderEntry(), build_slug: 'guia-sintetica' }),
      ['build_slug'],
      'placeholder no referencia build',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({
        ...placeholderEntry(),
        external_url: 'https://example.org/guia',
      }),
      ['external_url'],
      'placeholder no lleva enlace',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...placeholderEntry(), display_name: null }),
      ['display_name'],
      'requiere build_slug o display_name',
    );
    for (const change of [{ source_slug: null }, { evaluated_on: null }]) {
      expectDiagnostic(
        TierEntrySchema.safeParse({ ...rankedEntry(), ...change }),
        ['tier'],
        'un tier real requiere source_slug y evaluated_on',
      );
    }
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...linkEntry({ external_url: null }) }),
      ['external_url'],
      'enlace_externo requiere URL',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...linkEntry({ external_author: null }) }),
      ['external_author'],
      'requiere autor externo',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...linkEntry({ source_slug: null }) }),
      ['source_slug'],
      'enlace_externo requiere fuente',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...linkEntry({ rights_status: 'own_original' }) }),
      ['rights_status'],
      'enlace_externo requiere rights_status=link_only',
    );
    expectDiagnostic(
      TierEntrySchema.safeParse({ ...linkEntry({ tier: 'A' }) }),
      ['tier'],
      'una tarjeta de enlace no lleva ranking derivado de la fuente',
    );
  });

  it('reports a verified devotion step with an unnamed external mention', () => {
    const document = draftBuild();
    expectDiagnostic(
      BuildSchema.safeParse({
        ...document,
        devotion_steps: [
          {
            ...document.devotion_steps[0],
            verification: 'verificado',
            bindings: [
              { power_en: 'Reckless Tempest', skill_node_slug: 'golpe-primigenio' },
              { power_en: 'Elemental Storm', skill_node_slug: null, skill_name_es: 'Tótem' },
            ],
          },
        ],
      }),
      ['devotion_steps', 0, 'bindings'],
      'una mención fuera del árbol requiere paso sin_verificar',
    );
  });

  it('reports catalog integrity violations with their paths', () => {
    const list = catalogFixture();
    const source = draftBuild().sources[0]!;
    expectDiagnostic(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        masteries: [list.masteries[0], list.masteries[0]],
      }),
      ['masteries'],
      'maestrías duplicadas',
    );
    expectDiagnostic(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        combinations: [list.combinations[0], list.combinations[0]],
      }),
      ['combinations'],
      'combinaciones duplicadas',
    );
    expectDiagnostic(
      DomainSchema.TierListSchema.safeParse({ ...list, sources: [source, source] }),
      ['sources'],
      'fuentes duplicadas',
    );
    expectDiagnostic(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        combinations: [{ ...list.combinations[0], mastery_a_slug: 'fantasma' }],
      }),
      ['combinations', 0],
      'maestría desconocida en combinación',
    );
    expectDiagnostic(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        entries: [{ ...list.entries[0], combination_slug: 'fantasma' }],
      }),
      ['entries', 0, 'combination_slug'],
      'combinación desconocida',
    );
    expectDiagnostic(
      DomainSchema.TierListSchema.safeParse({
        ...list,
        sources: [source],
        entries: [{ ...list.entries[0], source_slug: 'fantasma' }],
      }),
      ['entries', 0, 'source_slug'],
      'fuente desconocida',
    );
  });

  it('reports public tier list requirements with their paths', () => {
    const list = catalogFixture();
    expectDiagnostic(
      DomainSchema.PublicTierListSchema.safeParse({ ...list, review_state: 'borrador' }),
      ['review_state'],
      'lista pública requiere publicado',
    );
    expectDiagnostic(
      DomainSchema.PublicTierListSchema.safeParse({
        ...list,
        entries: [{ ...list.entries[0], review_state: 'borrador' }],
      }),
      ['entries', 0],
      'entrada no publicable',
    );
  });

  it('reports the asset manifest rules with their paths', () => {
    const pending = {
      slug: 'icono-rayo',
      status: 'pending',
      file_path: 'public/assets/rayo.png',
      origin_url: null,
      rights_holder: null,
      license_or_permission: null,
      proof_ref: null,
      recorded_on: '2026-11-08',
      fallback_svg: 'src/assets/icons/rayo.svg',
    };
    expectDiagnostic(
      AssetSchema.safeParse(pending),
      ['file_path'],
      'archivo requiere activo aprobado',
    );
    const approved = {
      ...pending,
      status: 'approved',
      origin_url: 'https://example.org/rayo.png',
      rights_holder: 'Titular',
      license_or_permission: 'Permiso escrito',
      proof_ref: 'proofs/rayo.pdf',
    };
    for (const field of [
      'file_path',
      'origin_url',
      'rights_holder',
      'license_or_permission',
      'proof_ref',
    ]) {
      expectDiagnostic(
        AssetSchema.safeParse({ ...approved, [field]: null }),
        [field],
        `asset aprobado requiere ${field}`,
      );
    }
    expectDiagnostic(
      AssetSchema.safeParse({ ...pending, slug: 'MAL', file_path: null }),
      ['slug'],
      'slug en minúsculas ASCII',
    );
  });

  it('reports a combination that repeats the same mastery', () => {
    expectDiagnostic(
      DomainSchema.MasteryCombinationSchema.safeParse({
        slug: 'combo',
        mastery_a_slug: 'chaman',
        mastery_b_slug: 'chaman',
      }),
      ['mastery_b_slug'],
      'una combinación requiere maestrías distintas',
    );
  });

  it('marks the domain diagnostics as custom issues', () => {
    const result = BuildSchema.safeParse({ ...draftBuild(), title_b_mastery_slug: 'chaman' });
    expect(result.success).toBe(false);
    const issue = result.success
      ? undefined
      : result.error.issues.find((entry) => entry.path.join('.') === 'title_b_mastery_slug');
    expect(issue?.code).toBe('custom');
  });

  it('requires node and edge geometry in a constellation layout', () => {
    const document = draftBuild();
    const constellation = document.constellations[0]!;
    expect(
      BuildSchema.safeParse({
        ...document,
        constellations: [{ ...constellation, layout: { nodes: [{}], edges: [] } }],
      }).success,
    ).toBe(false);
    expect(
      BuildSchema.safeParse({
        ...document,
        constellations: [{ ...constellation, layout: { nodes: [], edges: [{}] } }],
      }).success,
    ).toBe(false);
    expect(
      BuildSchema.safeParse({
        ...document,
        constellations: [
          {
            ...constellation,
            layout: {
              nodes: [{ id: 'nodo-a', x: 1, y: 2 }],
              edges: [{ from: 'nodo-a', to: 'nodo-a' }],
            },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('accepts a web link that carries an embedded http scheme', () => {
    const source = draftBuild().sources[0]!;
    expect(
      DomainSchema.SourceSchema.safeParse({
        ...source,
        url: 'ftp://example.org/?next=https://example.org/a',
      }).success,
    ).toBe(false);
  });
});
