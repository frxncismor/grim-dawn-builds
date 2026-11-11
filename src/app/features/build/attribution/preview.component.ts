import { Component, inject } from '@angular/core';
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
import { BuildAttribution, type BuildAttributionContent } from './build-attribution';
import { BuildToc, type BuildTocContent } from '../toc/build-toc';

type PreviewContent = BuildAttributionContent & BuildTocContent;

interface SampleSection {
  id: string;
  title: string;
  body: string;
}

const sampleSections: readonly SampleSection[] = [
  {
    id: 'resumen',
    title: $localize`:@@buildMetaPreview.resumen:Resumen`,
    body: $localize`:@@buildMetaPreview.resumenBody:Ancla sintética del resumen de la guía de muestra.`,
  },
  {
    id: 'prioridades',
    title: $localize`:@@buildMetaPreview.prioridades:Prioridades`,
    body: $localize`:@@buildMetaPreview.prioridadesBody:Ancla sintética de prioridades.`,
  },
  {
    id: 'habilidades',
    title: $localize`:@@buildMetaPreview.habilidades:Habilidades`,
    body: $localize`:@@buildMetaPreview.habilidadesBody:Ancla sintética de los árboles de habilidades.`,
  },
  {
    id: 'orden',
    title: $localize`:@@buildMetaPreview.orden:Orden de compra`,
    body: $localize`:@@buildMetaPreview.ordenBody:Ancla sintética del orden de compra.`,
  },
  {
    id: 'notas',
    title: $localize`:@@buildMetaPreview.notas:Notas`,
    body: $localize`:@@buildMetaPreview.notasBody:Ancla sintética de notas.`,
  },
  {
    id: 'filtro-de-botin',
    title: $localize`:@@buildMetaPreview.filtro:Filtro de botín`,
    body: $localize`:@@buildMetaPreview.filtroBody:Ancla sintética del filtro de botín.`,
  },
  {
    id: 'guia-espiritual',
    title: $localize`:@@buildMetaPreview.guiaEspiritual:Guía Espiritual`,
    body: $localize`:@@buildMetaPreview.guiaEspiritualBody:Ancla sintética de la Guía Espiritual.`,
  },
  {
    id: 'devociones',
    title: $localize`:@@buildMetaPreview.devociones:Devociones`,
    body: $localize`:@@buildMetaPreview.devocionesBody:Ancla sintética de devociones.`,
  },
  {
    id: 'video',
    title: $localize`:@@buildMetaPreview.video:Video`,
    body: $localize`:@@buildMetaPreview.videoBody:Ancla sintética del video de muestra.`,
  },
];

const note = (
  label: string,
  headline: string,
  detail: string,
  position: number,
): PreviewContent['notes'][number] => ({ kind: 'general', label, headline, detail, position });

const sharedContent = {
  slug: 'guia-de-muestra',
  title: $localize`:@@buildMetaPreview.buildTitle:Guía de muestra con metadatos`,
  game_version: '1.2.0.5',
  review_state: 'publicado' as const,
  content_status: 'verificado' as const,
  published_at: '2026-03-05',
  footer_disclaimer: $localize`:@@buildMetaPreview.footer:Aviso sintético de no afiliación incluido para la vista de pruebas.`,
  priorities: [
    {
      rank: 1,
      group_label: $localize`:@@buildMetaPreview.priorityGroup:Grupo de muestra`,
      headline: $localize`:@@buildMetaPreview.priorityHeadline:Sube esta habilidad primero`,
      note: $localize`:@@buildMetaPreview.priorityNote:Nota sintética de prioridad.`,
      skill_node_slugs: ['nodo-de-muestra'],
    },
  ],
  skill_nodes: [
    {
      slug: 'nodo-de-muestra',
      mastery_slug: 'maestria-de-muestra',
      name_es: 'Nodo de muestra',
      name_en: 'Sample node',
      bar_required: 0,
      parent_slug: null,
      status: 'recomendada' as const,
      tag: null,
      rationale: $localize`:@@buildMetaPreview.nodeRationale:Razón sintética del nodo.`,
      max_points_hint: null,
      points_label: null,
      layout: { x: 0, y: 0 },
    },
  ],
  purchase_steps: [
    {
      position: 1,
      threshold_label: $localize`:@@buildMetaPreview.threshold:Nivel 1`,
      mastery_slug: 'maestria-de-muestra',
      title: $localize`:@@buildMetaPreview.stepTitle:Paso sintético`,
      body: $localize`:@@buildMetaPreview.stepBody:Cuerpo sintético del paso.`,
      highlights: [],
    },
  ],
  loot_filter_columns: [
    {
      position: 1,
      name: $localize`:@@buildMetaPreview.columnName:Columna sintética`,
      subtitle: $localize`:@@buildMetaPreview.columnSubtitle:Subtítulo sintético`,
      rules: [],
    },
  ],
  devotion_steps: [
    {
      position: 1,
      label: $localize`:@@buildMetaPreview.devotionLabel:Paso de devoción sintético`,
      constellation_slug: null,
      title_override: null,
      body: $localize`:@@buildMetaPreview.devotionBody:Cuerpo sintético de devoción.`,
      bindings: [],
      accent: 'storm' as const,
      verification: 'sin_verificar' as const,
      kind: 'ruta' as const,
    },
  ],
  guide_npcs: [
    {
      position: 1,
      group_label: $localize`:@@buildMetaPreview.npcGroup:Grupo sintético`,
      name: $localize`:@@buildMetaPreview.npcName:PNJ de muestra`,
      location: $localize`:@@buildMetaPreview.npcLocation:Lugar de muestra`,
      detail: $localize`:@@buildMetaPreview.npcDetail:Detalle sintético del PNJ.`,
    },
  ],
  sources: [
    {
      slug: 'fuente-valida',
      kind: 'comunidad' as const,
      title: $localize`:@@buildMetaPreview.validSource:Hilo sintético con enlace válido`,
      url: 'https://foro.example.com/hilo-de-muestra',
      author_name: $localize`:@@buildMetaPreview.validAuthor:Autora de la fuente`,
      license_note: $localize`:@@buildMetaPreview.validLicense:Permiso sintético registrado para la vista de pruebas.`,
      retrieved_on: '2026-02-03',
    },
    {
      slug: 'fuente-invalida',
      kind: 'oficial' as const,
      title: $localize`:@@buildMetaPreview.invalidSource:Documento sintético con enlace inválido`,
      url: 'https://usuario:clave@example.com/documento',
      author_name: $localize`:@@buildMetaPreview.invalidAuthor:Equipo de muestra`,
      license_note: $localize`:@@buildMetaPreview.invalidLicense:Sin enlace seguro: se muestra solo el texto.`,
      retrieved_on: '2026-01-02',
    },
  ],
};

const sectionsWithVideo = [
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

const contentWithVideo: PreviewContent = {
  ...sharedContent,
  author: {
    slug: 'ana-forjadora',
    display_name: $localize`:@@buildMetaPreview.realAuthor:Ana la Forjadora`,
    bio: $localize`:@@buildMetaPreview.realAuthorBio:Autora ficticia de la vista de pruebas.`,
    url: null,
  },
  notes: [
    note(
      'Descargo',
      $localize`:@@buildMetaPreview.disclaimerHeadline:Descargo de muestra`,
      $localize`:@@buildMetaPreview.disclaimerDetail:Detalle sintético del descargo de la guía de muestra.`,
      99,
    ),
  ],
  video_url: 'https://youtu.be/SampleID_01',
  sections_meta: sectionsWithVideo,
};

const contentWithoutVideo: PreviewContent = {
  ...sharedContent,
  author: {
    slug: 'por-confirmar',
    display_name: $localize`:@@buildMetaPreview.placeholderAuthor:Autor por confirmar`,
    bio: null,
    url: null,
  },
  notes: [
    note(
      'Nombres de habilidades',
      $localize`:@@buildMetaPreview.namesHeadline:Nombres sintéticos de habilidades`,
      $localize`:@@buildMetaPreview.namesDetail:Nota sintética que no es el descargo de la guía.`,
      1,
    ),
  ],
  video_url: null,
  sections_meta: sectionsWithVideo.map((section) =>
    section.section_key === 'video' ? { ...section, visible: false } : section,
  ),
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

  .site-header p {
    max-inline-size: var(--page-max);
    margin: 0 auto;
    color: var(--color-storm);
    font-family: var(--font-display);
    font-size: var(--text-large);
  }

  .preview-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'toc'
      'body';
    gap: var(--space-5);
    max-inline-size: var(--page-max);
    margin-inline: auto;
    padding: var(--space-5) var(--space-4) var(--space-8);
  }

  @media (min-width: 80rem) {
    .preview-layout {
      grid-template-columns: 16rem minmax(0, 1fr);
      grid-template-areas: 'toc body';
      align-items: start;
    }
  }

  gd-build-toc {
    grid-area: toc;
  }

  .preview-body {
    grid-area: body;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  h1 {
    margin: 0 0 var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-heading);
    line-height: var(--line-heading);
    color: var(--color-bone);
  }

  .notice {
    margin: 0 0 var(--space-5);
    color: var(--color-ash);
  }

  .sample-section {
    min-block-size: 9rem;
    margin-block-end: var(--space-5);
    padding: var(--space-4);
    border: var(--frame-border);
    background: var(--color-panel);
  }

  .sample-section h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-storm);
    font-family: var(--font-display);
  }

  .sample-section p {
    margin: 0;
    max-inline-size: var(--reading-measure);
  }

  .instance-label {
    margin: 0 0 var(--space-3);
    color: var(--color-ash);
    font-family: var(--font-mono);
    font-size: var(--text-small);
  }
`;

@Component({
  selector: 'gd-build-meta-preview',
  imports: [BuildAttribution, BuildToc],
  template: `
    <header class="site-header">
      <p i18n="@@buildMetaPreview.header">Vista de prueba · metadatos de guía</p>
    </header>
    <main class="preview-layout">
      <gd-build-toc [content]="content" />
      <div class="preview-body">
        <h1>{{ heading }}</h1>
        <p class="notice" i18n="@@buildMetaPreview.notice">
          Datos sintéticos solo para verificación visual y de accesibilidad. No representan una guía
          real ni contenido editorial del proyecto.
        </p>
        @if (placeholder) {
          <p class="instance-label" i18n="@@buildMetaPreview.placeholderInstance">
            Instancia: autor por confirmar y sin video.
          </p>
        } @else {
          <p class="instance-label" i18n="@@buildMetaPreview.realInstance">
            Instancia: autor real ficticio y con video.
          </p>
        }
        @for (section of sections; track section.id) {
          <section
            class="sample-section"
            [id]="section.id"
            [attr.aria-labelledby]="section.id + '-title'"
          >
            <h2 [id]="section.id + '-title'">{{ section.title }}</h2>
            <p>{{ section.body }}</p>
          </section>
        }
        <gd-build-attribution [content]="content" [authorPlaceholder]="placeholder" />
      </div>
    </main>
  `,
  styles: previewStyles,
})
export class BuildMetaPreview {
  private readonly route = inject(ActivatedRoute);

  protected readonly placeholder = this.route.snapshot.data['placeholder'] === true;
  protected readonly content = this.placeholder ? contentWithoutVideo : contentWithVideo;
  protected readonly sections = this.placeholder
    ? sampleSections.filter((section) => section.id !== 'video')
    : sampleSections;
  protected readonly heading = this.placeholder
    ? $localize`:@@buildMetaPreview.placeholderHeading:Atribución y contenido con autor por confirmar`
    : $localize`:@@buildMetaPreview.realHeading:Atribución y contenido con video`;

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex,nofollow' });
  }
}

/** Routes render the same harness with a different synthetic instance. */
@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class BuildMetaPreviewRoot {}

export const buildMetaPreviewProviders = [
  provideRouter(
    [
      { path: '', component: BuildMetaPreview, data: { placeholder: false } },
      { path: 'placeholder', component: BuildMetaPreview, data: { placeholder: true } },
    ],
    withComponentInputBinding(),
  ),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
