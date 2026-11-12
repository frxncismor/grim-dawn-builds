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
