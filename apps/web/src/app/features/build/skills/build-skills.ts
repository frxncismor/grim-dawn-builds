import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { MasteryTree } from '@gd/domain';
import {
  assignmentMasteryId,
  MASTERY_TREE_ASSETS,
} from '../../../core/content/mastery-tree-assets';
import { SkillTree } from '../../../shared/svg/skill-tree/skill-tree';
import type { SkillTreeSlot } from '../build.page';

type Phase = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Skills of a guide (T017). When every node of a mastery references the catalog (`skill_node_id`)
 * the full canonical tree is drawn with the guide's nodes marked on it (assignment mode); the trees
 * come from the site's own static files (plan 003, decision 9), requested only here, when the
 * deferred block enters the viewport. Without references, or if the files cannot be read, each
 * mastery keeps the guide mode (editorial layout), so no existing guide breaks (FR-015, SC-007).
 */
@Component({
  selector: 'gd-build-skills',
  standalone: true,
  imports: [SkillTree],
  templateUrl: './build-skills.html',
  styleUrl: './build-skills.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildSkills {
  private readonly assets = inject(MASTERY_TREE_ASSETS);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly slots = input.required<readonly SkillTreeSlot[]>();
  readonly activeIds = input<readonly string[]>([]);

  private readonly loaded = signal<ReadonlyMap<string, MasteryTree>>(new Map());
  private readonly phase = signal<Phase>('idle');

  /** Mastery id of each slot that can use the canonical tree, in slot order. */
  readonly masteryIds = computed(() => this.slots().map((slot) => assignmentMasteryId(slot.nodes)));
  readonly loading = computed(() => this.phase() === 'loading');

  /** Canonical tree for a slot once loaded; `null` keeps the guide mode. */
  treeFor(index: number): MasteryTree | null {
    const id = this.masteryIds()[index];
    return id && this.phase() === 'ready' ? (this.loaded().get(id) ?? null) : null;
  }

  constructor() {
    effect((onCleanup) => {
      const ids = [...new Set(this.masteryIds().filter((id): id is string => id !== null))];
      if (!this.browser || ids.length === 0) return;
      let current = true;
      onCleanup(() => (current = false));
      this.phase.set('loading');
      this.assets.load(ids).then(
        (trees) => {
          if (!current) return;
          this.loaded.set(trees);
          this.phase.set('ready');
        },
        () => current && this.phase.set('failed'),
      );
    });
  }
}
