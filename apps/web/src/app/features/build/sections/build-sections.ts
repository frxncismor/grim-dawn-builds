import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PublicBuild } from '@gd/domain';

export type BuildSectionsContent = Pick<
  PublicBuild,
  | 'eyebrow'
  | 'title'
  | 'subtitle'
  | 'hero_callout_title'
  | 'hero_callout_body'
  | 'priorities'
  | 'notes'
  | 'guide_npcs'
  | 'sections_meta'
>;

export type BuildSection = 'resumen' | 'prioridades' | 'notas' | 'guia-espiritual';

const SECTION_INTRO_LABELS = {
  // The current content contract has no section discriminator for these two paragraphs.
  prioridades: 'Qué subir ya mismo',
  'guia-espiritual': 'El Guía Espiritual',
} as const;

const SPIRITUAL_GUIDE_NOTE_LABELS = ['Guía Espiritual · Coste', 'Guía Espiritual · Aviso'] as const;

const RESERVED_NOTE_LABELS = new Set([
  'Orden real de compra',
  'Filtro de botín',
  'Ruta de devoción',
  'Esquemas de habilidades y devociones',
  'Referencias de devoción',
  'Qué tocar en cada árbol',
]);

const EMPTY_MESSAGE = $localize`:@@buildSections.empty:No information available`;

@Component({
  selector: 'gd-build-sections',
  standalone: true,
  templateUrl: './build-sections.html',
  styleUrl: './build-sections.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildSections {
  readonly content = input.required<BuildSectionsContent>();
  readonly section = input.required<BuildSection>();

  readonly isVisible = computed(() => {
    const current = this.section();
    return (
      this.content().sections_meta.find((item) => item.section_key === current)?.visible !== false
    );
  });

  readonly orderedPriorities = computed(() => this.content().priorities);

  /**
   * T028 (F-10): the ranked rows repeat the same transcription phrase ("Dato transcrito: barra N,
   * nodo del árbol de X."). The shared lead clause is said once above the list and the tail that only
   * repeats the group label is dropped, so each row is a single line; unranked rows keep their note.
   */
  readonly priorityLead = computed(() => {
    const ranked = this.orderedPriorities().filter((row) => row.rank !== null);
    const leads = ranked.map((row) => /^([^:]+):\s/.exec(row.note)?.[1] ?? null);
    const first = leads[0];
    return ranked.length > 1 && first && leads.every((lead) => lead === first) ? first : null;
  });
  readonly priorityRows = computed(() => {
    const lead = this.priorityLead();
    return this.orderedPriorities().map((row) => {
      if (!lead || row.rank === null) return { ...row, detail: row.note };
      const body = row.note.slice(lead.length + 1).trim();
      const comma = body.lastIndexOf(',');
      const repeatsGroup = comma >= 0 && body.slice(comma).includes(row.group_label);
      return { ...row, detail: (repeatsGroup ? body.slice(0, comma) : body).replace(/\.$/u, '') };
    });
  });
  readonly orderedNotes = computed(() =>
    [...this.content().notes].sort((a, b) => a.position - b.position),
  );
  readonly prioritiesIntroductions = computed(() =>
    this.findIntroductions(SECTION_INTRO_LABELS.prioridades),
  );
  readonly spiritualGuideIntroductions = computed(() =>
    this.findIntroductions(SECTION_INTRO_LABELS['guia-espiritual']),
  );
  readonly notesForDisplay = computed(() =>
    this.orderedNotes().filter((note) => {
      if (note.kind !== 'general') return true;
      if (RESERVED_NOTE_LABELS.has(note.label)) return false;
      if (
        note.label === SECTION_INTRO_LABELS.prioridades ||
        note.label === SECTION_INTRO_LABELS['guia-espiritual']
      )
        return false;
      return !SPIRITUAL_GUIDE_NOTE_LABELS.includes(
        note.label as (typeof SPIRITUAL_GUIDE_NOTE_LABELS)[number],
      );
    }),
  );
  readonly orderedGuideNpcs = computed(() =>
    [...this.content().guide_npcs].sort((a, b) => a.position - b.position),
  );
  readonly spiritualGuideNotes = computed(() =>
    this.orderedNotes().filter(
      (note) =>
        note.kind === 'general' &&
        SPIRITUAL_GUIDE_NOTE_LABELS.includes(
          note.label as (typeof SPIRITUAL_GUIDE_NOTE_LABELS)[number],
        ),
    ),
  );
  readonly emptyMessage = EMPTY_MESSAGE;

  private findIntroductions(label: string) {
    return this.orderedNotes()
      .filter((note) => note.kind === 'general' && note.label === label)
      .map((note) => note.detail);
  }
}
