import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import type { PublicBuild } from '@gd/domain';
import { DevotionMap } from '../../../shared/svg/devotion-map/devotion-map';

type DevotionStep = PublicBuild['devotion_steps'][number];
export type DevotionSectionContent = Pick<
  PublicBuild,
  'slug' | 'constellations' | 'devotion_steps' | 'skill_nodes' | 'notes' | 'sections_meta'
>;

@Component({
  selector: 'gd-devotion-section',
  standalone: true,
  imports: [DevotionMap],
  templateUrl: './devotion-section.html',
  styleUrl: './devotion-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevotionSection {
  readonly content = input.required<DevotionSectionContent>();
  readonly mapId = input.required<string>();
  readonly sectionId = input<string>('devociones');
  readonly activeStepPosition = input<number | undefined>(undefined);
  readonly activeStepPositionChange = output<number>();

  readonly browserReady = signal(false);
  readonly text = {
    duplicatePositions: $localize`:@@devotionSection.duplicatePositions:Los datos de esta guía son inconsistentes porque contienen posiciones repetidas. No se puede seleccionar un paso.`,
    empty: $localize`:@@devotionSection.empty:Sin información disponible`,
    javascriptRequired: $localize`:@@devotionSection.javascriptRequired:Seleccionar un paso requiere JavaScript; la ruta completa se puede leer más abajo en esta página.`,
  };

  readonly isVisible = computed(
    () =>
      this.content().sections_meta.find((meta) => meta.section_key === 'devociones')?.visible !==
      false,
  );
  readonly orderedSteps = computed(() =>
    [...this.content().devotion_steps].sort((left, right) => left.position - right.position),
  );
  readonly hasDuplicatePositions = computed(
    () =>
      new Set(this.orderedSteps().map((step) => step.position)).size !== this.orderedSteps().length,
  );
  readonly effectiveActiveStepPosition = computed(() => {
    if (this.hasDuplicatePositions()) return undefined;
    const active = this.activeStepPosition();
    return this.orderedSteps().some((step) => step.position === active) ? active : undefined;
  });
  readonly controlsEnabled = computed(
    () => this.browserReady() && !this.hasDuplicatePositions() && this.orderedSteps().length > 0,
  );
  readonly introductions = computed(() =>
    this.content()
      .notes.filter((note) => note.kind === 'general' && note.label === 'Ruta de devoción')
      .sort((left, right) => left.position - right.position),
  );
  readonly devotionNotes = computed(() =>
    this.content()
      .notes.filter(
        (note) =>
          note.label === 'Esquemas de habilidades y devociones' ||
          note.label === 'Referencias de devoción',
      )
      .sort((left, right) => left.position - right.position),
  );

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.browserReady.set(true));
    }
  }

  selectStep(step: DevotionStep): void {
    this.activeStepPositionChange.emit(step.position);
  }
}
