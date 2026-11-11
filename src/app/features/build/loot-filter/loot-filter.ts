import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import type { PublicBuild } from '@gd/domain';

type LootColumn = PublicBuild['loot_filter_columns'][number];
type LootRule = LootColumn['rules'][number];
export type LootFilterContent = Pick<
  PublicBuild,
  'slug' | 'title' | 'loot_filter_columns' | 'notes' | 'sections_meta'
>;

const introductionHeadline = /^Introducci[óo]n\s+\d+$/i;

@Component({
  selector: 'gd-loot-filter',
  standalone: true,
  templateUrl: './loot-filter.html',
  styleUrl: './loot-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LootFilter {
  readonly content = input.required<LootFilterContent>();
  readonly sectionId = input<string>('filtro-de-botin');

  readonly browserReady = signal(false);
  readonly copying = signal(false);
  readonly copyStatus = signal('');
  readonly text = {
    empty: $localize`:@@lootFilter.empty:Sin información disponible`,
    duplicatePositions: $localize`:@@lootFilter.duplicatePositions:Los datos de esta guía son inconsistentes porque contienen posiciones repetidas. El contenido sigue visible, pero no se puede copiar el resumen.`,
    javascriptRequired: $localize`:@@lootFilter.javascriptRequired:Copiar requiere JavaScript; el resumen completo ya está visible en la página.`,
    copy: $localize`:@@lootFilter.copy:Copiar resumen`,
    copying: $localize`:@@lootFilter.copying:Copiando…`,
    copySuccess: $localize`:@@lootFilter.copySuccess:Resumen copiado al portapapeles.`,
    clipboardUnavailable: $localize`:@@lootFilter.clipboardUnavailable:El portapapeles no está disponible. Puedes seleccionar y copiar el resumen visible manualmente.`,
    copyError: $localize`:@@lootFilter.copyError:No se pudo copiar el resumen. Puedes seleccionar y copiar el texto visible manualmente.`,
  };

  private readonly actionLabels: Record<LootRule['action'], string> = {
    marcar: $localize`:@@lootFilter.action.mark:Marcar`,
    desmarcar: $localize`:@@lootFilter.action.unmark:Desmarcar`,
    aviso: $localize`:@@lootFilter.action.notice:Aviso`,
  };

  readonly isVisible = computed(() => {
    const recognizedKeys = new Set([this.sectionId(), 'filtro-de-botin', 'filtro']);
    return this.content()
      .sections_meta.filter((meta) => recognizedKeys.has(meta.section_key))
      .every((meta) => meta.visible !== false);
  });

  readonly orderedColumns = computed(() =>
    [...this.content().loot_filter_columns]
      .map((column) => ({
        ...column,
        rules: [...column.rules].sort((left, right) => left.position - right.position),
      }))
      .sort((left, right) => left.position - right.position),
  );

  readonly hasDuplicatePositions = computed(() => {
    const columns = this.content().loot_filter_columns;
    if (new Set(columns.map((column) => column.position)).size !== columns.length) return true;
    return columns.some(
      (column) => new Set(column.rules.map((rule) => rule.position)).size !== column.rules.length,
    );
  });

  readonly introductions = computed(() =>
    this.content()
      .notes.filter(
        (note) =>
          note.kind === 'general' &&
          note.label === 'Filtro de botín' &&
          introductionHeadline.test(note.headline),
      )
      .sort((left, right) => left.position - right.position),
  );

  readonly finalNotes = computed(() =>
    this.content()
      .notes.filter(
        (note) =>
          note.kind === 'general' &&
          note.label === 'Filtro de botín' &&
          !introductionHeadline.test(note.headline),
      )
      .sort((left, right) => left.position - right.position),
  );

  readonly copyDisabled = computed(
    () =>
      !this.browserReady() ||
      this.copying() ||
      this.orderedColumns().length === 0 ||
      this.hasDuplicatePositions(),
  );

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.browserReady.set(true));
    }
  }

  actionLabel(action: LootRule['action']): string {
    return this.actionLabels[action];
  }

  buildSummaryText(): string {
    const lines = [
      this.headingText(),
      ...this.introductions().flatMap((note) => ['', note.detail]),
    ];

    for (const column of this.orderedColumns()) {
      lines.push('', `${column.name} — ${column.subtitle}`);
      for (const rule of column.rules) {
        lines.push(`- [${this.actionLabel(rule.action)}] ${rule.label}: ${rule.detail}`);
      }
    }

    for (const note of this.finalNotes()) {
      lines.push('', `${note.headline}: ${note.detail}`);
    }

    return lines.join('\n');
  }

  async copySummary(): Promise<void> {
    if (this.copyDisabled()) return;

    this.copyStatus.set('');
    this.copying.set(true);
    try {
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') {
        this.copyStatus.set(this.text.clipboardUnavailable);
        return;
      }

      await clipboard.writeText(this.buildSummaryText());
      this.copyStatus.set(this.text.copySuccess);
    } catch {
      this.copyStatus.set(this.text.copyError);
    } finally {
      this.copying.set(false);
    }
  }

  private headingText(): string {
    return $localize`:@@lootFilter.heading:Filtro de botín`;
  }
}
