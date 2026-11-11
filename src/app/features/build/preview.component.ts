import { Component, computed, effect, inject, input } from '@angular/core';
import {
  Meta,
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import {
  ActivatedRoute,
  provideRouter,
  RouterOutlet,
  withComponentInputBinding,
} from '@angular/router';
import type { PublicBuild } from '@gd/domain';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { BuildPage, type BuildPageContent } from './build.page';

type SkillNode = PublicBuild['skill_nodes'][number];
type LootColumn = PublicBuild['loot_filter_columns'][number];

const note = (
  position: number,
  label: string,
  headline: string,
  detail: string,
): PublicBuild['notes'][number] => ({ kind: 'general', label, headline, detail, position });

const node = (
  slug: string,
  masterySlug: string,
  nameEs: string,
  nameEn: string,
  bar: number,
  parent: string | null,
  status: SkillNode['status'],
  x: number,
  y: number,
): SkillNode => ({
  slug,
  mastery_slug: masterySlug,
  name_es: nameEs,
  name_en: nameEn,
  bar_required: bar,
  parent_slug: parent,
  status,
  tag: null,
  rationale: $localize`:@@buildPagePreview.nodeRationale:Razón sintética de la habilidad de muestra.`,
  max_points_hint: null,
  points_label: null,
  layout: { x, y },
});

const column = (
  position: number,
  name: string,
  subtitle: string,
  rules: { action: 'marcar' | 'desmarcar' | 'aviso'; label: string; detail: string }[],
): LootColumn => ({
  position,
  name,
  subtitle,
  rules: rules.map((rule, index) => ({ ...rule, position: index + 1 })),
});

const skillNodes: readonly SkillNode[] = [
  node('alfa-raiz', 'maestria-alfa', 'Habilidad Alfa', 'Alpha Skill', 0, null, 'recomendada', 0, 0),
  node(
    'alfa-rama',
    'maestria-alfa',
    'Rama Alfa',
    'Alpha Branch',
    5,
    'alfa-raiz',
    'recomendada',
    150,
    90,
  ),
  node(
    'alfa-cumbre',
    'maestria-alfa',
    'Cumbre Alfa',
    'Alpha Peak',
    15,
    'alfa-rama',
    'meta',
    300,
    180,
  ),
  node('beta-raiz', 'maestria-beta', 'Habilidad Beta', 'Beta Skill', 0, null, 'recomendada', 0, 0),
  node('beta-rama', 'maestria-beta', 'Rama Beta', 'Beta Branch', 10, 'beta-raiz', 'meta', 150, 90),
  node(
    'beta-omision',
    'maestria-beta',
    'Beta Opcional',
    'Beta Optional',
    20,
    null,
    'omitir',
    0,
    180,
  ),
];

const sectionsMeta = [
  { section_key: 'resumen', position: 1, visible: true },
  { section_key: 'prioridades', position: 2, visible: true },
  { section_key: 'habilidades', position: 3, visible: true },
  { section_key: 'orden', position: 4, visible: true },
  { section_key: 'notas', position: 5, visible: true },
  { section_key: 'filtro-de-botin', position: 6, visible: true },
  { section_key: 'guia-espiritual', position: 7, visible: true },
  { section_key: 'devociones', position: 8, visible: true },
  { section_key: 'video', position: 9, visible: true },
  { section_key: 'fuentes', position: 10, visible: true },
];

const publicContent: BuildPageContent = {
  slug: 'guia-sintetica-completa',
  locale: 'es',
  title: $localize`:@@buildPagePreview.title:Guía sintética completa`,
  eyebrow: $localize`:@@buildPagePreview.eyebrow:Rayo · Campaña`,
  subtitle: $localize`:@@buildPagePreview.subtitle:Guía de muestra para la verificación visual de la página ensamblada.`,
  summary: $localize`:@@buildPagePreview.summary:Resumen sintético con dos maestrías, devociones, filtro de botín y video de muestra.`,
  title_a_mastery_slug: 'maestria-alfa',
  title_b_mastery_slug: 'maestria-beta',
  damage_types: ['rayo'],
  playstyle: 'rango',
  content_tags: ['campana'],
  author_slug: 'ana-forjadora',
  source_slugs: ['fuente-de-muestra'],
  game_version: '1.2.0.5',
  review_state: 'publicado',
  rights_status: 'own_original',
  content_status: 'verificado',
  published_at: '2026-05-01',
  author: {
    slug: 'ana-forjadora',
    display_name: $localize`:@@buildPagePreview.author:Ana la Forjadora`,
    bio: $localize`:@@buildPagePreview.authorBio:Autora ficticia de la vista de pruebas.`,
    url: null,
  },
  sources: [
    {
      slug: 'fuente-de-muestra',
      kind: 'original',
      title: $localize`:@@buildPagePreview.source:Fuente sintética de la vista de pruebas`,
      url: 'https://example.com/fuente-de-muestra',
      author_name: $localize`:@@buildPagePreview.sourceAuthor:Equipo de muestra`,
      license_note: $localize`:@@buildPagePreview.sourceLicense:Contenido propio, sin permisos de terceros.`,
      retrieved_on: '2026-04-20',
    },
  ],
  video_url: 'https://youtu.be/SampleID_01',
  footer_disclaimer: $localize`:@@buildPagePreview.footer:Proyecto independiente. No está afiliado a Crate Entertainment.`,
  hero_callout_title: $localize`:@@buildPagePreview.calloutTitle:Cómo usar esta vista`,
  hero_callout_body: [
    $localize`:@@buildPagePreview.calloutBody:Todo el contenido es sintético y solo sirve para verificar la página.`,
  ],
  masteries: [
    {
      slug: 'maestria-alfa',
      name_es: $localize`:@@buildPagePreview.masteryAlpha:Maestría Alfa`,
      name_en: 'Alpha Mastery',
      role_text: $localize`:@@buildPagePreview.masteryAlphaRole:Daño principal de la build de muestra.`,
    },
    {
      slug: 'maestria-beta',
      name_es: $localize`:@@buildPagePreview.masteryBeta:Maestría Beta`,
      name_en: 'Beta Mastery',
      role_text: $localize`:@@buildPagePreview.masteryBetaRole:Soporte y supervivencia de la build de muestra.`,
    },
  ],
  skill_nodes: [...skillNodes],
  priorities: [
    {
      rank: 1,
      group_label: $localize`:@@buildPagePreview.priorityGroup:Grupo de muestra`,
      headline: $localize`:@@buildPagePreview.priorityHeadline:Sube primero la habilidad Alfa`,
      note: $localize`:@@buildPagePreview.priorityNote:Nota sintética de prioridad.`,
      skill_node_slugs: ['alfa-raiz'],
    },
    {
      rank: 2,
      group_label: $localize`:@@buildPagePreview.priorityGroup:Grupo de muestra`,
      headline: $localize`:@@buildPagePreview.priorityHeadline2:Después, la rama Beta`,
      note: $localize`:@@buildPagePreview.priorityNote:Nota sintética de prioridad.`,
      skill_node_slugs: ['beta-raiz'],
    },
  ],
  purchase_steps: [
    {
      position: 1,
      threshold_label: $localize`:@@buildPagePreview.threshold:Nivel 5`,
      mastery_slug: 'maestria-alfa',
      title: $localize`:@@buildPagePreview.step1:Primer paso de muestra`,
      body: $localize`:@@buildPagePreview.step1Body:Fila sintética del orden de compra.`,
      highlights: [
        { skill_node_slug: 'alfa-raiz', points: 1 },
        { skill_node_slug: 'beta-raiz', points: 1 },
      ],
    },
    {
      position: 2,
      threshold_label: $localize`:@@buildPagePreview.threshold2:Nivel 15`,
      mastery_slug: 'maestria-beta',
      title: $localize`:@@buildPagePreview.step2:Segundo paso de muestra`,
      body: $localize`:@@buildPagePreview.step2Body:Otra fila sintética del orden de compra.`,
      highlights: [
        { skill_node_slug: 'alfa-rama', points: 5 },
        { skill_node_slug: 'beta-rama', points: null },
      ],
    },
    {
      position: 3,
      threshold_label: $localize`:@@buildPagePreview.threshold3:Nivel 32`,
      mastery_slug: null,
      title: $localize`:@@buildPagePreview.step3:Tercer paso de muestra`,
      body: $localize`:@@buildPagePreview.step3Body:Fila final sintética del orden de compra.`,
      highlights: [{ skill_node_slug: 'alfa-cumbre', points: 10 }],
    },
  ],
  notes: [
    note(
      1,
      'Qué subir ya mismo',
      $localize`:@@buildPagePreview.introPriorities:Introducción sintética`,
      $localize`:@@buildPagePreview.introPrioritiesBody:Texto sintético de introducción a prioridades.`,
    ),
    note(
      2,
      'Orden real de compra',
      $localize`:@@buildPagePreview.introOrder:Introducción al orden`,
      $localize`:@@buildPagePreview.introOrderBody:Texto sintético de introducción al orden de compra.`,
    ),
    note(
      3,
      'Filtro de botín',
      $localize`:@@buildPagePreview.introLoot:Introducción 1`,
      $localize`:@@buildPagePreview.introLootBody:Texto sintético de introducción al filtro de botín.`,
    ),
    note(
      4,
      'Filtro de botín',
      $localize`:@@buildPagePreview.lootTip:Consejo final`,
      $localize`:@@buildPagePreview.lootTipBody:Aprieta el filtro poco a poco.`,
    ),
    note(
      5,
      'Ruta de devoción',
      $localize`:@@buildPagePreview.introDevotion:Introducción a devociones`,
      $localize`:@@buildPagePreview.introDevotionBody:Texto sintético de introducción a la ruta de devoción.`,
    ),
    note(
      6,
      'Guía Espiritual · Coste',
      $localize`:@@buildPagePreview.spiritualCost:Coste sintético`,
      $localize`:@@buildPagePreview.spiritualCostBody:Texto sintético del coste de la Guía Espiritual.`,
    ),
    note(
      7,
      'Guía Espiritual · Aviso',
      $localize`:@@buildPagePreview.spiritualNotice:Aviso sintético`,
      $localize`:@@buildPagePreview.spiritualNoticeBody:Texto sintético del aviso de la Guía Espiritual.`,
    ),
    note(
      8,
      'Descargo',
      $localize`:@@buildPagePreview.disclaimerHeadline:Descargo de muestra`,
      $localize`:@@buildPagePreview.disclaimerBody:Texto sintético del descargo de la guía.`,
    ),
  ],
  loot_filter_columns: [
    column(1, $localize`:@@buildPagePreview.lootQuality:Calidad`, 'Rareza', [
      {
        action: 'marcar',
        label: $localize`:@@buildPagePreview.lootRare:Objetos raros`,
        detail: $localize`:@@buildPagePreview.lootRareDetail:Detalle sintético de la regla.`,
      },
      {
        action: 'desmarcar',
        label: $localize`:@@buildPagePreview.lootWhite:Objetos blancos`,
        detail: $localize`:@@buildPagePreview.lootWhiteDetail:Detalle sintético de la regla.`,
      },
    ]),
    column(2, $localize`:@@buildPagePreview.lootType:Tipo`, 'Armas', [
      {
        action: 'marcar',
        label: $localize`:@@buildPagePreview.lootWeapon:Armas de dos manos`,
        detail: $localize`:@@buildPagePreview.lootWeaponDetail:Detalle sintético de la regla.`,
      },
      {
        action: 'aviso',
        label: $localize`:@@buildPagePreview.lootNote:Aviso sintético`,
        detail: $localize`:@@buildPagePreview.lootNoteDetail:Detalle sintético del aviso.`,
      },
    ]),
  ],
  guide_npcs: [
    {
      position: 1,
      group_label: $localize`:@@buildPagePreview.npcGroup:Grupo sintético`,
      name: $localize`:@@buildPagePreview.npcName:PNJ de muestra`,
      location: $localize`:@@buildPagePreview.npcLocation:Lugar de muestra`,
      detail: $localize`:@@buildPagePreview.npcDetail:Detalle sintético del PNJ.`,
    },
  ],
  constellations: [
    {
      slug: 'constelacion-alfa',
      name_en: 'Alpha Constellation',
      name_es: $localize`:@@buildPagePreview.constellationAlpha:Constelación Alfa`,
      tier_level: 1,
      affinity_required: { orden: 2 },
      affinity_granted: { orden: 5 },
      layout: {
        nodes: [
          { id: 'nodo-alfa-1', x: 0, y: 0 },
          { id: 'nodo-alfa-2', x: 80, y: 60 },
        ],
        edges: [{ from: 'nodo-alfa-1', to: 'nodo-alfa-2' }],
      },
    },
    {
      slug: 'constelacion-beta',
      name_en: 'Beta Constellation',
      name_es: $localize`:@@buildPagePreview.constellationBeta:Constelación Beta`,
      tier_level: 2,
      affinity_required: { orden: 5 },
      affinity_granted: { caos: 3 },
      layout: {
        nodes: [
          { id: 'nodo-beta-1', x: 0, y: 0 },
          { id: 'nodo-beta-2', x: 90, y: 40 },
        ],
        edges: [{ from: 'nodo-beta-1', to: 'nodo-beta-2' }],
      },
    },
  ],
  devotion_steps: [
    {
      position: 1,
      label: $localize`:@@buildPagePreview.devotionLabel1:Paso 1 · constelación`,
      constellation_slug: 'constelacion-alfa',
      title_override: null,
      body: $localize`:@@buildPagePreview.devotionBody1:Cuerpo sintético del primer paso de devoción.`,
      bindings: [{ power_en: 'Alpha Power', skill_node_slug: 'alfa-raiz' }],
      accent: 'storm',
      verification: 'verificado',
      kind: 'ruta',
    },
    {
      position: 2,
      label: $localize`:@@buildPagePreview.devotionLabel2:Paso 2 · sin constelación`,
      constellation_slug: null,
      title_override: null,
      body: $localize`:@@buildPagePreview.devotionBody2:Paso sintético que no pertenece a ninguna constelación.`,
      bindings: [
        {
          power_en: 'External Power',
          skill_node_slug: null,
          skill_name_es: $localize`:@@buildPagePreview.externalSkill:Habilidad externa`,
        },
      ],
      accent: 'ember',
      verification: 'sin_verificar',
      kind: 'ruta',
    },
    {
      position: 3,
      label: $localize`:@@buildPagePreview.devotionLabel3:Verificación`,
      constellation_slug: null,
      title_override: null,
      body: $localize`:@@buildPagePreview.devotionBody3:Comprobación sintética de afinidad antes de continuar.`,
      bindings: [],
      accent: 'storm',
      verification: 'sin_verificar',
      kind: 'verificacion',
    },
    {
      position: 4,
      label: $localize`:@@buildPagePreview.devotionLabel4:Limpieza`,
      constellation_slug: null,
      title_override: null,
      body: $localize`:@@buildPagePreview.devotionBody4:Retirada sintética de puntos al terminar la ruta.`,
      bindings: [],
      accent: 'ember',
      verification: 'sin_verificar',
      kind: 'limpieza',
    },
  ],
  sections_meta: sectionsMeta,
  authorIsPlaceholder: false,
  draft: false,
};

const draftContent: BuildPageContent = {
  ...publicContent,
  slug: 'guia-sintetica-borrador',
  title: $localize`:@@buildPagePreview.draftTitle:Guía sintética en borrador`,
  review_state: 'borrador',
  rights_status: 'pending',
  content_status: 'sin_verificar',
  published_at: null,
  author: {
    slug: 'por-confirmar',
    display_name: $localize`:@@buildPagePreview.placeholderAuthor:Autor por confirmar`,
    bio: null,
    url: null,
  },
  authorIsPlaceholder: true,
  draft: true,
};

const previewStyles = `
  :host {
    display: block;
    min-block-size: 100vh;
    background: var(--color-soot);
    color: var(--color-bone);
    font-family: var(--font-body);
  }

  .site-header {
    padding: var(--space-3) var(--space-4);
    border-block-end: var(--frame-accent-border);
    background: var(--surface-sheen), var(--color-panel);
    box-shadow: var(--frame-bevel);
  }

  .notice {
    max-inline-size: var(--reading-measure);
    margin: 0 0 var(--space-5);
    color: var(--color-ash);
  }

  .preview-wrap {
    padding-block: var(--space-5) var(--space-8);
  }
`;

/** Re-applies the preview noindex after the page SEO effect so the artifact never indexes. */
@Component({ selector: 'gd-preview-noindex', template: '' })
export class PreviewNoindex {
  private readonly meta = inject(Meta);
  readonly revision = input.required<unknown>();

  constructor() {
    effect(() => {
      this.revision();
      this.meta.updateTag({ name: 'robots', content: 'noindex,nofollow' });
    });
  }
}

@Component({
  selector: 'gd-build-page-preview',
  imports: [BuildPage, PreviewNoindex],
  template: `
    <header class="site-header">
      <p i18n="@@buildPagePreview.header">Vista de prueba · página de guía ensamblada</p>
    </header>
    <main id="main" class="page-width preview-wrap">
      <p class="notice" i18n="@@buildPagePreview.notice">
        Datos sintéticos solo para verificación visual y de accesibilidad. No representan una guía
        real ni contenido editorial del proyecto.
      </p>
      <gd-build-page [content]="content()" />
      <gd-preview-noindex [revision]="content()" />
    </main>
  `,
  styles: previewStyles,
})
export class BuildPagePreview {
  private readonly route = inject(ActivatedRoute);
  protected readonly content = computed<BuildPageContent>(() =>
    this.route.snapshot.data['draft'] === true ? draftContent : publicContent,
  );
}

/** Routes render the same synthetic harness with the public or the draft instance. */
@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class BuildPagePreviewRoot {}

export const buildPagePreviewProviders = [
  provideRouter(
    [
      { path: '', component: BuildPagePreview, data: { draft: false } },
      { path: 'borrador', component: BuildPagePreview, data: { draft: true } },
    ],
    withComponentInputBinding(),
  ),
  provideClientHydration(withEventReplay(), withI18nSupport()),
  { provide: SITE_BASE_URL, useValue: 'https://preview.example.test/' },
];
