import { describe, expect, it } from 'vitest';
import { AdaptationPublicationSchema, BuildAdaptationSchema } from './adaptation.js';
import {
  AuthorSchema,
  BuildSchema,
  PublicBuildSchema,
  TierEntrySchema,
  findParentCycle,
} from './schema.js';

/*
 * Pruebas adversariales del dominio (T-141, plan §17.49). Cada clase de ataque
 * debe fallar cerrado: rechazo explícito del esquema (success: false) o valor
 * seguro (el texto se conserva tal cual, sin interpretarse). Todo objeto se
 * construye de nuevo en cada llamada para que ningún caso comparta estado.
 */

interface Parsed {
  success: boolean;
  error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
}

function issuesOf(result: Parsed): { path: string; message: string }[] {
  if (result.success) return [];
  return (result.error?.issues ?? []).map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

function omitKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

const PRIVATE_BUILD_FIELDS = [
  'reviewed_by',
  'reviewed_at',
  'rights_confirmed_by',
  'rights_confirmed_on',
  'rights_notes',
];

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
  hero_callout_body: ['La barra de maestría no son puntos invertidos.'],
  masteries: [
    { slug: 'chaman', name_es: 'Chamán', name_en: 'Shaman', role_text: 'Daño principal' },
    { slug: 'demoledor', name_es: 'Demoledor', name_en: 'Demolitionist', role_text: 'Soporte' },
  ],
  priorities: [],
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
  purchase_steps: [],
  notes: [],
  loot_filter_columns: [],
  guide_npcs: [],
  constellations: [],
  devotion_steps: [],
  sections_meta: [],
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

/** DTO público derivado: sin campos editoriales privados ni `is_placeholder`. */
const publicBuild = () => {
  const doc = publishableBuild();
  return {
    ...omitKeys(doc, PRIVATE_BUILD_FIELDS),
    author: omitKeys(doc.author, ['is_placeholder']),
    sources: doc.sources.map((source) => omitKeys(source, ['permission_ref', 'notes'])),
  };
};

const skillNode = (slug: string, parent_slug: string | null) => ({
  slug,
  mastery_slug: 'chaman',
  name_es: slug,
  name_en: slug,
  bar_required: 5,
  parent_slug,
  status: 'recomendada',
  tag: null,
  rationale: 'Nodo de prueba.',
  max_points_hint: 4,
  points_label: null,
  layout: { x: 10, y: 10 },
});

const tierEntryBase = () => ({
  entry_kind: 'enlace_externo',
  combination_slug: 'chaman-demoledor',
  display_name: 'Guía externa',
  build_slug: null,
  tier: 'A',
  content_status: 'sin_verificar',
  rights_status: 'link_only',
  review_state: 'publicado',
  external_url: 'https://example.invalid/guia',
  external_author: 'Autor externo',
  source_slug: 'guia-original',
  evaluated_on: '2026-11-08',
});

const buildPropiaEntry = () => ({
  ...tierEntryBase(),
  entry_kind: 'build_propia',
  display_name: null,
  build_slug: 'chaman-demoledor-golpe-primigenio',
  content_status: 'verificado',
  rights_status: 'own_original',
  external_url: null,
  external_author: null,
});

const evidenceBase = () => ({
  id: 'evidencia-licencia',
  source_slug: 'guia-original',
  evidence_type: 'licencia_explicita',
  evidence_ref: 'archivo-privado-1',
  license_name: 'CC BY 4.0',
  license_url: 'https://example.invalid/license',
  covers_adaptation: true,
  covers_translation: true,
  covers_images: false,
  scope_notes: 'Cubre adaptación y traducción.',
  granted_by: 'titular',
  recorded_on: '2026-11-08',
  valid_until: null,
  status: 'vigente',
  verified_by: 'editor-b',
  verified_on: '2026-11-08',
});

const adaptationBase = () => ({
  build_slug: 'chaman-demoledor-golpe-primigenio',
  entry_kind: 'build_adaptada',
  source_slug: 'guia-original',
  evidence_id: 'evidencia-licencia',
  rights_status: 'licensed',
  source_url: 'https://example.invalid/source',
  original_title: 'Guía original',
  original_author: 'Autor de la guía',
  original_site: 'example.invalid',
  retrieved_on: '2026-11-08',
  adaptation_editor: 'editor-a',
  rights_verified_by: 'editor-b',
  transformation_scope: ['traduccion'],
  transformation_notes: 'Traducción íntegra.',
  adaptation_version: 1,
  source_revision_ref: null,
  last_reviewed_on: '2026-11-08',
  reviewed_by: 'editor-c',
  change_log: [{ adaptation_version: 1, changed_on: '2026-11-08', summary: 'Versión inicial.' }],
  attribution_text: 'Adaptado de Guía original (example.invalid).',
  adaptation_state: 'publicado',
});

describe('adversarial: base válida (controles)', () => {
  it('el build borrador, el build publicado, su DTO público y la entrada de tier base son válidos', () => {
    expect(BuildSchema.safeParse(draftBuild()).success).toBe(true);
    expect(BuildSchema.safeParse(publishableBuild()).success).toBe(true);
    expect(PublicBuildSchema.safeParse(publicBuild()).success).toBe(true);
    expect(TierEntrySchema.safeParse(tierEntryBase()).success).toBe(true);
    expect(TierEntrySchema.safeParse(buildPropiaEntry()).success).toBe(true);
    expect(BuildAdaptationSchema.safeParse(adaptationBase()).success).toBe(true);
  });
});

describe('adversarial: campos de más y de menos', () => {
  it('1. campos de más: rechaza un build con una propiedad extra en la raíz o anidada', () => {
    expect(BuildSchema.safeParse({ ...draftBuild(), campo_inyectado: 'x' }).success).toBe(false);
    expect(
      BuildSchema.safeParse({
        ...draftBuild(),
        author: { ...draftBuild().author, rol_admin: true },
      }).success,
    ).toBe(false);
    expect(BuildAdaptationSchema.safeParse({ ...adaptationBase(), es_publico: true }).success).toBe(
      false,
    );
  });

  it('1. campos de más: el DTO público rechaza los campos privados (sin filtración)', () => {
    expect(
      PublicBuildSchema.safeParse({ ...publicBuild(), reviewed_by: 'editor-local' }).success,
    ).toBe(false);
    expect(
      PublicBuildSchema.safeParse({
        ...publicBuild(),
        sources: publicBuild().sources.map((source) => ({ ...source, permission_ref: 'x' })),
      }).success,
    ).toBe(false);
    expect(
      PublicBuildSchema.safeParse({
        ...publicBuild(),
        author: { ...publicBuild().author, is_placeholder: false },
      }).success,
    ).toBe(false);
  });

  it('2. campos de menos: rechaza un build sin rights_status, sin autor ni nombre de nodo', () => {
    expect(BuildSchema.safeParse(omitKeys(draftBuild(), ['rights_status'])).success).toBe(false);
    expect(BuildSchema.safeParse(omitKeys(draftBuild(), ['author'])).success).toBe(false);
    const [primero, ...resto] = draftBuild().skill_nodes;
    const sinNombre = omitKeys(primero ?? skillNode('x', null), ['name_es']);
    expect(
      BuildSchema.safeParse({ ...draftBuild(), skill_nodes: [sinNombre, ...resto] }).success,
    ).toBe(false);
    expect(
      BuildAdaptationSchema.safeParse(omitKeys(adaptationBase(), ['source_url'])).success,
    ).toBe(false);
  });
});

describe('adversarial: tipos cambiados', () => {
  it('3. tipos cambiados: número donde va texto, booleano donde va fecha, array donde va texto', () => {
    expect(BuildSchema.safeParse({ ...draftBuild(), title: 42 }).success).toBe(false);
    expect(BuildSchema.safeParse({ ...draftBuild(), published_at: true }).success).toBe(false);
    expect(BuildSchema.safeParse({ ...draftBuild(), summary: ['Resumen'] }).success).toBe(false);
    expect(BuildSchema.safeParse({ ...draftBuild(), hero_callout_body: 'texto' }).success).toBe(
      false,
    );
    expect(
      BuildAdaptationSchema.safeParse({ ...adaptationBase(), retrieved_on: true }).success,
    ).toBe(false);
  });
});

describe('adversarial: rights_status falsificado', () => {
  it('4. publicado con rights_status pending: BuildSchema y PublicBuildSchema rechazan', () => {
    const publicado = { ...publishableBuild(), rights_status: 'pending' };
    const issues = issuesOf(BuildSchema.safeParse(publicado));
    expect(issues.some((issue) => issue.path === 'rights_status')).toBe(true);
    expect(
      PublicBuildSchema.safeParse({ ...publicBuild(), rights_status: 'pending' }).success,
    ).toBe(false);
  });

  it('4. publicado con rights_status link_only: el DTO público rechaza', () => {
    const dto = { ...publicBuild(), rights_status: 'link_only' };
    const issues = issuesOf(PublicBuildSchema.safeParse(dto));
    expect(issues.some((issue) => issue.path === 'rights_status')).toBe(true);
  });

  it.fails(
    'hallazgo: BuildSchema (gate editorial) no debe aceptar un build publicado con rights_status=link_only',
    () => {
      const publicado = { ...publishableBuild(), rights_status: 'link_only' };
      expect(BuildSchema.safeParse(publicado).success).toBe(false);
    },
  );

  it('4. DTO público con author_slug por-confirmar: rechazo', () => {
    const base = publicBuild();
    const dto = {
      ...base,
      author_slug: 'por-confirmar',
      author: { ...base.author, slug: 'por-confirmar' },
    };
    const issues = issuesOf(PublicBuildSchema.safeParse(dto));
    expect(issues.some((issue) => issue.path === 'author_slug')).toBe(true);
  });

  it('4. autor marcado como placeholder bajo un slug real: rechazo en publicado', () => {
    const doc = publishableBuild();
    const falsificado = { ...doc, author: { ...doc.author, is_placeholder: true } };
    expect(BuildSchema.safeParse(falsificado).success).toBe(false);
  });

  it('4. adaptación publicada con rights_status pending o link_only: el gate de publicación rechaza', () => {
    for (const rights of ['pending', 'link_only']) {
      const publication = {
        adaptation: { ...adaptationBase(), rights_status: rights },
        evidence: evidenceBase(),
      };
      const issues = issuesOf(AdaptationPublicationSchema.safeParse(publication));
      expect(issues.some((issue) => issue.path === 'adaptation.rights_status')).toBe(true);
    }
  });
});

describe('adversarial: referencias cruzadas rotas', () => {
  it('5. DTO público con source_slugs vacío: rechazo', () => {
    const dto = { ...publicBuild(), source_slugs: [], sources: [] };
    const issues = issuesOf(PublicBuildSchema.safeParse(dto));
    expect(issues.some((issue) => issue.path === 'source_slugs')).toBe(true);
  });

  it('5. DTO público con una fuente que no existe en sources: rechazo', () => {
    const dto = { ...publicBuild(), source_slugs: ['fuente-fantasma'] };
    expect(PublicBuildSchema.safeParse(dto).success).toBe(false);
  });

  it('5. tier_entries build_propia con build_slug null: rechazo', () => {
    const entry = { ...buildPropiaEntry(), build_slug: null };
    const issues = issuesOf(TierEntrySchema.safeParse(entry));
    expect(issues.some((issue) => issue.path === 'build_slug')).toBe(true);
  });

  it('5. tier_entries enlace_externo con rights_status distinto de link_only: rechazo', () => {
    const entry = { ...tierEntryBase(), rights_status: 'own_original' };
    const issues = issuesOf(TierEntrySchema.safeParse(entry));
    expect(issues.some((issue) => issue.path === 'rights_status')).toBe(true);
  });
});

describe('adversarial: ciclos de parent', () => {
  const withNodes = (nodes: ReturnType<typeof skillNode>[]) => ({
    ...draftBuild(),
    skill_nodes: nodes,
  });
  const cycleMessage = (result: Parsed) =>
    issuesOf(result).some((issue) => issue.message.includes('ciclo de padres'));

  it('6. autociclo (nodo-a con parent nodo-a): rechazo', () => {
    expect(cycleMessage(BuildSchema.safeParse(withNodes([skillNode('nodo-a', 'nodo-a')])))).toBe(
      true,
    );
  });

  it('6. ciclo de dos (nodo-a ↔ nodo-b): rechazo', () => {
    const nodes = [skillNode('nodo-a', 'nodo-b'), skillNode('nodo-b', 'nodo-a')];
    expect(cycleMessage(BuildSchema.safeParse(withNodes(nodes)))).toBe(true);
  });

  it('6. ciclo de tres (a → b → c → a): rechazo', () => {
    const nodes = [
      skillNode('nodo-a', 'nodo-b'),
      skillNode('nodo-b', 'nodo-c'),
      skillNode('nodo-c', 'nodo-a'),
    ];
    expect(cycleMessage(BuildSchema.safeParse(withNodes(nodes)))).toBe(true);
  });

  it('6. control positivo: bosque acíclico con dos raíces y dos hijos se acepta', () => {
    const nodes = [
      skillNode('raiz-a', null),
      skillNode('raiz-b', null),
      skillNode('hijo-a', 'raiz-a'),
      skillNode('hijo-b', 'raiz-b'),
    ];
    expect(BuildSchema.safeParse(withNodes(nodes)).success).toBe(true);
    expect(
      findParentCycle(nodes.map((node) => ({ slug: node.slug, parent_slug: node.parent_slug }))),
    ).toBeNull();
  });

  it('6. findParentCycle señala solo los miembros del ciclo, no el nodo colgado', () => {
    const cycle = findParentCycle([
      { slug: 'nodo-a', parent_slug: 'nodo-b' },
      { slug: 'nodo-b', parent_slug: 'nodo-a' },
      { slug: 'nodo-c', parent_slug: 'nodo-a' },
    ]);
    expect(cycle).toEqual(expect.arrayContaining(['nodo-a', 'nodo-b']));
    expect(cycle).not.toContain('nodo-c');
  });
});

describe('adversarial: textos con HTML y JavaScript', () => {
  const PAYLOADS = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    'javascript:alert(1)',
  ];

  it('7. payloads en campos de texto se aceptan como texto inerte, idénticos al original', () => {
    for (const payload of PAYLOADS) {
      const doc = {
        ...draftBuild(),
        title: payload,
        summary: payload,
        hero_callout_title: payload,
      };
      const result = BuildSchema.safeParse(doc);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(payload);
        expect(result.data.summary).toBe(payload);
        expect(result.data.hero_callout_title).toBe(payload);
      }
    }
  });

  it('7. el nombre visible del autor con HTML se conserva literal', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const doc = publishableBuild();
    const result = BuildSchema.safeParse({
      ...doc,
      author: { ...doc.author, display_name: payload },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.author.display_name).toBe(payload);
  });

  it('7. javascript: no pasa como URL HTTP en ningún campo de enlace', () => {
    const result = AuthorSchema.safeParse({
      slug: 'autor-real',
      display_name: 'Autor real',
      bio: null,
      url: 'javascript:alert(1)',
      is_placeholder: false,
    });
    expect(result.success).toBe(false);
    expect(issuesOf(result).some((issue) => issue.message === 'URL HTTP(S) requerida')).toBe(true);
    expect(
      BuildSchema.safeParse({ ...draftBuild(), video_url: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('7. payloads HTML en campos de identificador (slug) se rechazan', () => {
    const doc = { ...draftBuild(), slug: '<script>alert(1)</script>' };
    expect(BuildSchema.safeParse(doc).success).toBe(false);
  });
});

describe('adversarial: URLs con credenciales', () => {
  it.fails(
    'hallazgo: una URL con usuario y clave embebidos (https://usuario:clave@…) debe rechazarse',
    () => {
      const result = AuthorSchema.safeParse({
        slug: 'autor-real',
        display_name: 'Autor real',
        bio: null,
        url: 'https://usuario:clave@ejemplo.invalid/x',
        is_placeholder: false,
      });
      expect(result.success).toBe(false);
    },
  );
});

describe('adversarial: Unicode RTL, homoglifos y combinantes', () => {
  it('9. U+202E en display_name se conserva literal como valor seguro', () => {
    const rtl = 'Autor \u202Egnp.exe';
    const doc = publishableBuild();
    const result = BuildSchema.safeParse({
      ...doc,
      author: { ...doc.author, display_name: rtl },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.author.display_name).toBe(rtl);
  });

  it('9. slug con homoglifo cirílico (сhaman) se rechaza por el patrón de slug', () => {
    const homoglifo = '\u0441haman';
    const doc = draftBuild();
    const result = BuildSchema.safeParse({
      ...doc,
      title_a_mastery_slug: homoglifo,
      masteries: [{ ...doc.masteries[0], slug: homoglifo }, doc.masteries[1]],
    });
    expect(result.success).toBe(false);
    expect(issuesOf(result).some((issue) => issue.path === 'masteries.0.slug')).toBe(true);
  });

  it('9. texto con combinantes (NFD) se valida y se conserva sin normalizar', () => {
    const combinante = 'Cham\u0061\u0301n + Demoledor';
    const result = BuildSchema.safeParse({ ...draftBuild(), title: combinante });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe(combinante);
  });
});

describe('adversarial: entrada desmesurada', () => {
  it('10. cadena de 100 000 caracteres: rechazo o gestión sin excepción', () => {
    const enorme = 'a'.repeat(100_000);
    expect(() => BuildSchema.safeParse({ ...draftBuild(), title: enorme })).not.toThrow();
    const slugEnorme = `${enorme}!`;
    expect(() => BuildSchema.safeParse({ ...draftBuild(), slug: slugEnorme })).not.toThrow();
    expect(BuildSchema.safeParse({ ...draftBuild(), slug: slugEnorme }).success).toBe(false);
  });

  it('10. objeto con 1 000 claves extra: rechazo sin excepción', () => {
    const extra = Object.fromEntries(Array.from({ length: 1_000 }, (_, i) => [`extra_${i}`, i]));
    expect(() => BuildSchema.safeParse({ ...draftBuild(), ...extra })).not.toThrow();
    expect(BuildSchema.safeParse({ ...draftBuild(), ...extra }).success).toBe(false);
  });

  it('10. array de 10 000 elementos: rechazo cuando excede el máximo, sin excepción', () => {
    const muchos = Array.from({ length: 10_000 }, (_, i) => ({
      ...draftBuild().masteries[0],
      slug: `m-${i}`,
    }));
    expect(() => BuildSchema.safeParse({ ...draftBuild(), masteries: muchos })).not.toThrow();
    expect(BuildSchema.safeParse({ ...draftBuild(), masteries: muchos }).success).toBe(false);
    const lineas = Array.from({ length: 10_000 }, (_, i) => `línea ${i}`);
    expect(() =>
      BuildSchema.safeParse({ ...draftBuild(), hero_callout_body: lineas }),
    ).not.toThrow();
  });
});
