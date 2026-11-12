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
    empty: $localize`:@@lootFilter.empty:No information available`,
    duplicatePositions: $localize`:@@lootFilter.duplicatePositions:This guide's data is inconsistent because it contains repeated positions. The content remains visible, but the summary cannot be copied.`,
    javascriptRequired: $localize`:@@lootFilter.javascriptRequired:Copying requires JavaScript; the full summary is already visible on the page.`,
    copy: $localize`:@@lootFilter.copy:Copy summary`,
    copying: $localize`:@@lootFilter.copying:Copying…`,
    copySuccess: $localize`:@@lootFilter.copySuccess:Summary copied to the clipboard.`,
    clipboardUnavailable: $localize`:@@lootFilter.clipboardUnavailable:The clipboard is not available. You can select and copy the visible summary manually.`,
    copyError: $localize`:@@lootFilter.copyError:The summary could not be copied. You can select and copy the visible text manually.`,
  };

  private readonly actionLabels: Record<LootRule['action'], string> = {
    marcar: $localize`:@@lootFilter.action.mark:Mark`,
    desmarcar: $localize`:@@lootFilter.action.unmark:Unmark`,
    aviso: $localize`:@@lootFilter.action.notice:Notice`,
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
    return $localize`:@@lootFilter.heading:Loot filter`;
  }
}
