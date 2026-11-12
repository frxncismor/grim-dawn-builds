import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PublicBuild } from '@gd/domain';
import { progressKey, progressRevision, validateProgress } from './progress';

export type PurchaseStepperContent = Pick<
  PublicBuild,
  | 'slug'
  | 'game_version'
  | 'purchase_steps'
  | 'skill_nodes'
  | 'masteries'
  | 'notes'
  | 'sections_meta'
>;

export interface PurchaseStepSelection {
  position: number | null;
  activeIds: string[];
}

const EMPTY_MESSAGE = $localize`:@@purchaseStepper.empty:No information available`;
const NO_NUMBER_MESSAGE = $localize`:@@purchaseStepper.noNumber:No point value`;
const UNSUPPORTED_STORAGE_MESSAGE = $localize`:@@purchaseStepper.storageUnavailable:Saving is not available in this browser. The checklist will keep working in this view.`;
const REMOVE_FAILED_MESSAGE = $localize`:@@purchaseStepper.removeFailed:Saved progress could not be deleted; it was only cleared in this view.`;
const OPT_OUT_REMOVE_FAILED_MESSAGE = $localize`:@@purchaseStepper.optOutRemoveFailed:Saving was turned off in this view, but the record could not be removed from the browser.`;
const CLEARED_MESSAGE = $localize`:@@purchaseStepper.cleared:Progress cleared in this view and in this browser.`;

@Component({
  selector: 'gd-purchase-stepper',
  standalone: true,
  templateUrl: './purchase-stepper.html',
  styleUrl: './purchase-stepper.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseStepper {
  readonly content = input.required<PurchaseStepperContent>();
  readonly selectionChange = output<PurchaseStepSelection>();

  readonly browserReady = signal(false);
  readonly selectedPosition = signal<number | null>(null);
  readonly completedPositions = signal<ReadonlySet<number>>(new Set());
  readonly persistenceEnabled = signal(false);
  readonly storageMessage = signal('');

  readonly orderedSteps = computed(() =>
    [...this.content().purchase_steps].sort((a, b) => a.position - b.position),
  );
  readonly hasDuplicatePositions = computed(() => {
    const positions = this.orderedSteps().map((step) => step.position);
    return new Set(positions).size !== positions.length;
  });
  readonly revision = computed(() =>
    progressRevision(this.content().game_version, this.orderedSteps()),
  );
  readonly identity = computed(() => JSON.stringify([this.content().slug, this.revision()]));
  readonly isVisible = computed(
    () =>
      this.content().sections_meta.find((item) => item.section_key === 'orden')?.visible !== false,
  );
  readonly introductions = computed(() =>
    [...this.content().notes]
      .filter((note) => note.kind === 'general' && note.label === 'Orden real de compra')
      .sort((a, b) => a.position - b.position)
      .map((note) => note.detail),
  );
  readonly controlsEnabled = computed(
    () => this.browserReady() && !this.hasDuplicatePositions() && this.orderedSteps().length > 0,
  );
  readonly emptyMessage = EMPTY_MESSAGE;
  readonly noNumberMessage = NO_NUMBER_MESSAGE;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private previousIdentity: string | null = null;

  constructor() {
    effect(() => {
      const identity = this.identity();
      const previous = this.previousIdentity;
      this.previousIdentity = identity;
      if (previous === null || previous === identity) return;

      this.selectedPosition.set(null);
      this.completedPositions.set(new Set());
      this.persistenceEnabled.set(false);
      this.storageMessage.set('');
      this.selectionChange.emit({ position: null, activeIds: [] });
      if (this.isBrowser && this.browserReady()) this.restoreProgress();
    });

    if (this.isBrowser) {
      afterNextRender(() => {
        this.browserReady.set(true);
        this.restoreProgress();
      });
    }
  }

  stepHighlights(step: PurchaseStepperContent['purchase_steps'][number]) {
    const nodes = new Map(this.content().skill_nodes.map((node) => [node.slug, node]));
    return step.highlights.flatMap((highlight) => {
      const node = nodes.get(highlight.skill_node_slug);
      return node ? [{ node, points: highlight.points }] : [];
    });
  }

  pointsLabel(points: number | null): string {
    if (points === null) return this.noNumberMessage;
    if (points === 1) return $localize`:@@purchaseStepper.onePoint:${points}:count: point`;
    return $localize`:@@purchaseStepper.points:${points}:count: points`;
  }

  selectLabel(step: PurchaseStepperContent['purchase_steps'][number]): string {
    return $localize`:@@purchaseStepper.selectLabel:View skills for step ${step.position}:position:, ${step.title}:title:, ${step.threshold_label}:threshold:`;
  }

  completionLabel(step: PurchaseStepperContent['purchase_steps'][number]): string {
    return $localize`:@@purchaseStepper.completionLabel:Mark step ${step.position}:position:, ${step.title}:title: as completed`;
  }

  isCompleted(position: number): boolean {
    return this.completedPositions().has(position);
  }

  isSelected(position: number): boolean {
    return this.selectedPosition() === position;
  }

  selectStep(step: PurchaseStepperContent['purchase_steps'][number]): void {
    if (!this.controlsEnabled()) return;
    this.selectedPosition.set(step.position);
    const available = new Set(this.content().skill_nodes.map((node) => node.slug));
    const activeIds = [
      ...new Set(step.highlights.map((highlight) => highlight.skill_node_slug)),
    ].filter((slug) => available.has(slug));
    this.selectionChange.emit({ position: step.position, activeIds });
  }

  onCompletedChange(position: number, event: Event): void {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    if (!this.controlsEnabled()) return;
    const next = new Set(this.completedPositions());
    if (checked) next.add(position);
    else next.delete(position);
    this.completedPositions.set(next);
    if (this.persistenceEnabled()) this.saveProgress();
  }

  onPersistenceChange(event: Event): void {
    if (!this.controlsEnabled()) return;
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    if (enabled) {
      this.persistenceEnabled.set(true);
      this.saveProgress();
      return;
    }

    this.persistenceEnabled.set(false);
    const removed = this.withStorage((storage) =>
      storage.removeItem(progressKey(this.content().slug)),
    );
    this.storageMessage.set(removed ? '' : OPT_OUT_REMOVE_FAILED_MESSAGE);
  }

  clearProgress(): void {
    if (!this.controlsEnabled()) return;
    this.completedPositions.set(new Set());
    const removed = this.withStorage((storage) =>
      storage.removeItem(progressKey(this.content().slug)),
    );
    if (removed) this.storageMessage.set(CLEARED_MESSAGE);
    else {
      this.persistenceEnabled.set(false);
      this.storageMessage.set(REMOVE_FAILED_MESSAGE);
    }
  }

  private restoreProgress(): void {
    if (!this.isBrowser || this.hasDuplicatePositions()) return;
    let raw: string | null = null;
    const read = this.withStorage((storage) => {
      raw = storage.getItem(progressKey(this.content().slug));
    });
    if (!read || raw === null) return;

    const saved = validateProgress(raw, this.revision(), this.orderedSteps());
    if (!saved) return;
    this.completedPositions.set(new Set(saved.completed));
    this.persistenceEnabled.set(true);
    this.storageMessage.set('');
  }

  private saveProgress(): void {
    const payload = JSON.stringify({
      version: 1,
      revision: this.revision(),
      completed: this.orderedSteps()
        .filter((step) => this.completedPositions().has(step.position))
        .map((step) => step.position),
    });
    if (payload.length > 16 * 1024) {
      this.storageMessage.set(UNSUPPORTED_STORAGE_MESSAGE);
      return;
    }
    const saved = this.withStorage((storage) =>
      storage.setItem(progressKey(this.content().slug), payload),
    );
    this.storageMessage.set(saved ? '' : UNSUPPORTED_STORAGE_MESSAGE);
  }

  private withStorage(operation: (storage: Storage) => void): boolean {
    if (!this.isBrowser) return false;
    try {
      operation(window.localStorage);
      return true;
    } catch {
      this.storageMessage.set(UNSUPPORTED_STORAGE_MESSAGE);
      return false;
    }
  }
}
