import { Component } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import { BuildSections, type BuildSectionsContent } from './build-sections';

const previewContent = {
  eyebrow: 'Vista de muestra · contenido sintético',
  title: 'Guía de ejemplo para una combinación extensa',
  subtitle:
    'Texto de muestra para comprobar una descripción larga, su ajuste en pantalla y la lectura de cada bloque.',
  hero_callout_title: 'Antes de empezar',
  hero_callout_body: [
    'Este ejemplo no describe una build real ni recomienda una configuración.',
    'Las etiquetas, prioridades y ubicaciones de esta página se escribieron únicamente para la prueba visual.',
  ],
  priorities: [
    {
      rank: 1,
      group_label: '1 · Primera categoría',
      headline: 'Ejemplo de prioridad principal',
      note: 'Texto ilustrativo que permite observar cómo se envuelve una explicación extensa en pantallas estrechas.',
      skill_node_slugs: [],
    },
    {
      rank: null,
      group_label: 'Sin orden numérico',
      headline: 'Prioridad adicional sin rango',
      note: 'Las entradas sin rango mantienen su etiqueta y posición editorial.',
      skill_node_slugs: [],
    },
  ],
  notes: [
    {
      kind: 'general' as const,
      label: 'Qué subir ya mismo',
      headline: 'Introducción de muestra',
      detail: 'Texto sintético que introduce una lista editorial de demostración.',
      position: 1,
    },
    {
      kind: 'general' as const,
      label: 'El Guía Espiritual',
      headline: 'Introducción de muestra',
      detail: 'Texto sintético que presenta una lista ilustrativa de personas y lugares.',
      position: 2,
    },
    {
      kind: 'general' as const,
      label: 'Guía Espiritual · Coste',
      headline: 'Dato de coste de muestra',
      detail: 'Texto demostrativo, sin describir precios del juego.',
      position: 3,
    },
    {
      kind: 'general' as const,
      label: 'Guía Espiritual · Aviso',
      headline: 'Aviso de muestra',
      detail: 'Texto demostrativo para comprobar un aviso dentro de la sección.',
      position: 4,
    },
    {
      kind: 'general' as const,
      label: 'Nota de muestra',
      headline: 'Texto de interfaz de ejemplo',
      detail: 'Contenido breve para comprobar el diseño de las notas.',
      position: 5,
    },
  ],
  guide_npcs: [
    {
      position: 1,
      group_label: 'Ejemplo de ubicación',
      name: 'Personaje de muestra',
      location: 'Lugar ilustrativo',
      detail: 'Descripción de muestra para revisar nombre, ubicación y detalle por separado.',
    },
  ],
  sections_meta: [
    { section_key: 'resumen', position: 1, visible: true },
    { section_key: 'prioridades', position: 2, visible: true },
    { section_key: 'notas', position: 3, visible: true },
    { section_key: 'guia-espiritual', position: 4, visible: true },
  ],
} satisfies BuildSectionsContent;

@Component({
  selector: 'gd-build-sections-preview',
  imports: [BuildSections],
  template: `<main>
    <p class="preview-notice" i18n="@@buildSectionsPreview.notice">
      Prueba visual aislada. Todos los datos de esta página son sintéticos y se escribieron para
      verificar componentes.
    </p>
    <gd-build-sections [content]="content" section="resumen" />
    <gd-build-sections [content]="content" section="prioridades" />
    <gd-build-sections [content]="content" section="notas" />
    <gd-build-sections [content]="content" section="guia-espiritual" />
  </main>`,
  styles: `
    main {
      max-inline-size: var(--page-max);
      margin-inline: auto;
      padding: var(--space-4);
    }
    .preview-notice {
      max-inline-size: var(--reading-measure);
      margin-block: var(--space-4) var(--space-6);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-line);
      background: var(--color-panel);
      color: var(--color-ash);
    }
    @media (min-width: 48rem) {
      main {
        padding: var(--space-6);
      }
    }
  `,
})
export class BuildSectionsPreview {
  readonly content = previewContent;
}

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class BuildSectionsPreviewRoot {}

export const buildSectionsPreviewProviders = [
  provideRouter([{ path: '', component: BuildSectionsPreview }]),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
