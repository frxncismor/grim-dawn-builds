import { Component, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
} from '@angular/platform-browser';
import type { PublicBuild } from '@gd/domain';
import { SkillTree } from './skill-tree';

type Mastery = PublicBuild['masteries'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

const sampleMastery: Mastery = {
  slug: 'maestria-prueba',
  name_es: 'Maestría de prueba',
  name_en: 'Sample mastery',
  role_text: 'Datos sintéticos para inspeccionar la presentación del árbol.',
};

const sampleNodes: readonly SkillNode[] = [
  {
    slug: 'descarga-de-prueba',
    mastery_slug: sampleMastery.slug,
    name_es: 'Descarga de prueba',
    name_en: 'Sample Discharge',
    bar_required: 1,
    parent_slug: null,
    status: 'recomendada',
    tag: null,
    rationale: 'Nodo sintético de inicio para comprobar etiquetas y selección.',
    max_points_hint: 12,
    points_label: '12 puntos de prueba',
    layout: { x: 0, y: 0 },
  },
  {
    slug: 'viento-de-muestra',
    mastery_slug: sampleMastery.slug,
    name_es: 'Viento de muestra con una etiqueta mucho más extensa',
    name_en: 'Sample Wind with a much longer secondary name',
    bar_required: 5,
    parent_slug: 'descarga-de-prueba',
    status: 'meta',
    tag: 'Etiqueta de muestra',
    rationale: 'Justificación sintética para el panel de detalle.',
    max_points_hint: null,
    points_label: null,
    layout: { x: 120, y: 80 },
  },
  {
    slug: 'escudo-de-muestra',
    mastery_slug: sampleMastery.slug,
    name_es: 'Escudo de muestra',
    name_en: 'Sample Ward',
    bar_required: 10,
    parent_slug: 'descarga-de-prueba',
    status: 'omitir',
    tag: null,
    rationale: 'Consejo de ejemplo; el estado no impide consultar su detalle.',
    max_points_hint: 1,
    points_label: '1 punto de prueba',
    layout: { x: -120, y: 80 },
  },
];

const stressNodes: readonly SkillNode[] = Array.from({ length: 120 }, (_, index): SkillNode => ({
  slug: `nodo-sintetico-${index}`,
  mastery_slug: 'maestria-estres',
  name_es: `Nodo sintético ${index + 1}`,
  name_en: `Synthetic node ${index + 1}`,
  bar_required: index + 1,
  parent_slug: index === 0 ? null : `nodo-sintetico-${index - 1}`,
  status: index % 3 === 0 ? 'recomendada' : index % 3 === 1 ? 'meta' : 'omitir',
  tag: null,
  rationale: 'Contenido sintético para medir la actualización de activeIds.',
  max_points_hint: null,
  points_label: null,
  layout: { x: (index % 8) * 112, y: Math.floor(index / 8) * 64 },
}));

const stressMastery: Mastery = {
  slug: 'maestria-estres',
  name_es: 'Maestría sintética extensa',
  name_en: 'Synthetic stress mastery',
  role_text: 'Solo para humo de rendimiento.',
};

@Component({
  selector: 'gd-skill-tree-preview',
  imports: [SkillTree],
  template: `
    <main>
      <h1 i18n="@@skillTreePreview.title">Árbol de habilidades</h1>
      <p class="preview__notice" i18n="@@skillTreePreview.notice">
        Vista de verificación aislada. Todos los nombres, estados, barras y consejos de este ejemplo
        son datos sintéticos.
      </p>
      <section aria-labelledby="preview-controls-title">
        <h2 id="preview-controls-title" i18n="@@skillTreePreview.controls">
          Controles de demostración
        </h2>
        <div class="preview__controls">
          <button
            type="button"
            data-preview-step="start"
            [attr.aria-pressed]="activeIds().includes('descarga-de-prueba')"
            (click)="setStep('start')"
            i18n="@@skillTreePreview.stepStart"
          >
            Resaltar paso inicial
          </button>
          <button
            type="button"
            data-preview-step="later"
            [attr.aria-pressed]="activeIds().includes('viento-de-muestra')"
            (click)="setStep('later')"
            i18n="@@skillTreePreview.stepLater"
          >
            Resaltar paso posterior
          </button>
          <button
            type="button"
            data-preview-bar
            [attr.aria-pressed]="currentBar() === 10"
            (click)="toggleBar()"
          >
            @if (currentBar() === 10) {
              <span i18n="@@skillTreePreview.barOne">Probar barra 1</span>
            } @else {
              <span i18n="@@skillTreePreview.barTen">Probar barra 10</span>
            }
          </button>
        </div>
      </section>
      <gd-skill-tree
        treeId="preview-primary"
        [mastery]="mastery"
        [nodes]="nodes"
        [activeIds]="activeIds()"
        [currentBar]="currentBar()"
      />
      <p class="preview__note" i18n="@@skillTreePreview.note">
        La selección del detalle es local; los botones de arriba solo cambian el resaltado del paso
        sintético.
      </p>
      <details class="preview__stress">
        <summary i18n="@@skillTreePreview.stressSummary">
          Abrir muestra de 120 nodos sintéticos
        </summary>
        <button
          type="button"
          data-preview-stress-step
          [attr.aria-pressed]="stressActiveIds().length > 0"
          (click)="toggleStressStep()"
          i18n="@@skillTreePreview.stressUpdate"
        >
          Alternar resaltado de 120 nodos
        </button>
        <gd-skill-tree
          treeId="preview-stress"
          [mastery]="stressMastery"
          [nodes]="stressNodes"
          [activeIds]="stressActiveIds()"
        />
      </details>
    </main>
  `,
  styles: `
    main {
      max-inline-size: var(--page-max);
      margin-inline: auto;
      padding: var(--space-5);
    }
    h1,
    h2 {
      color: var(--color-bone);
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      line-height: var(--line-heading);
    }
    h1 {
      font-size: var(--text-heading);
      margin: 0 0 var(--space-3);
    }
    h2 {
      font-size: var(--text-large);
      margin: var(--space-6) 0 var(--space-3);
    }
    p {
      max-inline-size: var(--reading-measure);
    }
    .preview__notice {
      color: var(--color-ash);
    }
    .preview__controls {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .preview__controls button {
      min-block-size: 44px;
      padding-inline: var(--space-4);
      border: 1px solid var(--color-ash);
      background: var(--color-panel);
      color: var(--color-bone);
      font: inherit;
      cursor: pointer;
    }
    .preview__controls button:hover,
    .preview__controls button[aria-pressed='true'] {
      border-color: var(--color-storm);
    }
    .preview__controls button:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
    .preview__note {
      margin-block: var(--space-5);
      color: var(--color-ash);
    }
    @media (min-width: 48rem) {
      main {
        padding: var(--space-6);
      }
    }
  `,
})
export class SkillTreePreview {
  readonly mastery = sampleMastery;
  readonly nodes = sampleNodes;
  readonly stressMastery = stressMastery;
  readonly stressNodes = stressNodes;
  readonly activeIds = signal<readonly string[]>(['descarga-de-prueba']);
  readonly stressActiveIds = signal<readonly string[]>([]);
  readonly currentBar = signal<number | undefined>(1);

  setStep(step: 'start' | 'later'): void {
    this.activeIds.set(
      step === 'start' ? ['descarga-de-prueba'] : ['viento-de-muestra', 'escudo-de-muestra'],
    );
  }

  toggleBar(): void {
    this.currentBar.set(this.currentBar() === 10 ? 1 : 10);
  }

  toggleStressStep(): void {
    this.stressActiveIds.set(
      this.stressActiveIds().length
        ? []
        : stressNodes.filter((_, index) => index % 3 === 0).map((node) => node.slug),
    );
  }
}

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class SkillTreePreviewRoot {}

export const skillTreePreviewProviders = [
  provideRouter([{ path: '', component: SkillTreePreview }]),
  provideClientHydration(withEventReplay(), withI18nSupport()),
];
