import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PublicBuild } from '@gd/domain';
import { createKeyboardNav } from '../keyboard-nav';
import { layoutForest } from '../layout';

type Mastery = PublicBuild['masteries'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

interface FocusTarget {
  focus(): void;
}

interface RenderNode {
  node: SkillNode;
  labelLines: string[];
  x: number;
  y: number;
  id: string;
  active: boolean;
  selected: boolean;
  focused: boolean;
  insufficientBar: boolean;
}

interface TreeModel {
  nodes: RenderNode[];
  edges: {
    from: string;
    to: string;
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[];
  error: boolean;
  width: number;
  height: number;
  moveFocus?: (focusedId: string, key: string) => string | null;
}

@Component({
  selector: 'gd-skill-tree',
  standalone: true,
  templateUrl: './skill-tree.html',
  styleUrl: './skill-tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillTree {
  readonly treeId = input.required<string>();
  readonly mastery = input.required<Mastery>();
  readonly nodes = input.required<readonly SkillNode[]>();
  readonly activeIds = input<readonly string[]>([]);
  readonly currentBar = input<number | undefined>(undefined);

  readonly focusedId = signal<string | null>(null);
  readonly hoveredId = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly detailDismissed = signal(false);
  private focusOrigin: FocusTarget | null = null;
  private restoringFocus = false;

  readonly masteryNodes = computed(() =>
    this.nodes().filter((node) => node.mastery_slug === this.mastery().slug),
  );
  readonly orderedNodes = computed(() =>
    this.tree().error ? this.masteryNodes() : this.tree().nodes.map((item) => item.node),
  );
  readonly tree = computed<TreeModel>(() => {
    const nodes = this.masteryNodes();
    if (nodes.length > 120) return { nodes: [], edges: [], error: true, width: 0, height: 0 };
    try {
      const layout = layoutForest(
        nodes.map((node, order) => ({
          id: node.slug,
          parentId: node.parent_slug,
          order,
        })),
      );
      if (!nodes.length) return { nodes: [], edges: [], error: false, width: 0, height: 0 };

      const editorial = new Map(nodes.map((node) => [node.slug, node.layout]));
      const xs = nodes.map((node) => node.layout.x);
      const ys = nodes.map((node) => node.layout.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const uniqueX = [...new Set(xs)].sort((a, b) => a - b);
      const horizontalGaps = uniqueX.slice(1).map((x, index) => x - uniqueX[index]);
      const smallestGap = horizontalGaps.length ? Math.min(...horizontalGaps) : 0;
      const maxLabelChars =
        smallestGap > 0 ? Math.max(12, Math.min(24, Math.floor(smallestGap / 7.5))) : 24;
      const horizontalGutter = 104;
      const verticalGutter = 96;
      const width = Math.max(176, maxX - minX + horizontalGutter * 2);
      const height = Math.max(152, maxY - minY + verticalGutter * 2);
      const positions = new Map(
        [...editorial].map(([slug, point]) => [
          slug,
          { x: point.x - minX + horizontalGutter, y: point.y - minY + verticalGutter },
        ]),
      );
      const currentFocus = this.focusedId();
      const selectedId = this.selectedId();
      const currentBar = this.currentBar();
      const rovingId = nodes.some((node) => node.slug === currentFocus)
        ? currentFocus!
        : (layout.nodes[0]?.id ?? null);
      const nodeBySlug = new Map(nodes.map((node) => [node.slug, node]));
      const activeIds = new Set(this.activeIds());
      const renderNodes: RenderNode[] = layout.nodes.map((placed) => {
        const node = nodeBySlug.get(placed.id)!;
        const point = positions.get(node.slug)!;
        return {
          node,
          labelLines: this.visibleNameLines(node.name_es, maxLabelChars),
          ...point,
          id: this.nodeId(node.slug),
          active: activeIds.has(node.slug),
          selected: selectedId === node.slug,
          focused: rovingId === node.slug,
          insufficientBar:
            Number.isInteger(currentBar) && currentBar! >= 0 && currentBar! < node.bar_required,
        };
      });
      const keyboardLayout = {
        nodes: layout.nodes,
        edges: layout.edges,
      };
      return {
        nodes: renderNodes,
        edges: layout.edges.map((edge, order) => ({
          ...edge,
          id: `${this.treeId()}-${this.mastery().slug}-edge-${order}`,
          x1: positions.get(edge.from)!.x,
          y1: positions.get(edge.from)!.y,
          x2: positions.get(edge.to)!.x,
          y2: positions.get(edge.to)!.y,
        })),
        error: false,
        width,
        height,
        moveFocus: createKeyboardNav(keyboardLayout),
      };
    } catch {
      return { nodes: [], edges: [], error: true, width: 0, height: 0 };
    }
  });

  readonly detailNode = computed(() => {
    if (this.detailDismissed()) return null;
    const id = this.selectedId() ?? this.hoveredId() ?? this.focusedId();
    return this.masteryNodes().find((node) => node.slug === id) ?? null;
  });
  readonly headingId = computed(() => `${this.treeId()}-${this.mastery().slug}-heading`);
  readonly svgTitleId = computed(() => `${this.treeId()}-${this.mastery().slug}-svg-title`);
  readonly svgDescriptionId = computed(
    () => `${this.treeId()}-${this.mastery().slug}-svg-description`,
  );
  readonly detailId = computed(() => `${this.treeId()}-${this.mastery().slug}-detail`);
  readonly svgTitle = computed(
    () => $localize`:@@skillTree.svgTitle:Árbol de ${this.mastery().name_es}:mastery:`,
  );

  nodeId(slug: string): string {
    return `${this.treeId()}-${this.mastery().slug}-${slug}`;
  }

  setRovingFocus(slug: string): void {
    this.focusedId.set(slug);
    if (!this.restoringFocus) this.detailDismissed.set(false);
  }

  setHovered(slug: string): void {
    this.hoveredId.set(slug);
    this.detailDismissed.set(false);
  }

  clearHovered(): void {
    this.hoveredId.set(null);
  }

  selectNode(slug: string, origin: EventTarget | null): void {
    const candidate = origin as (EventTarget & Partial<FocusTarget>) | null;
    this.focusOrigin = typeof candidate?.focus === 'function' ? (candidate as FocusTarget) : null;
    this.detailDismissed.set(false);
    this.selectedId.set(slug);
  }

  closeDetail(): void {
    this.selectedId.set(null);
    this.detailDismissed.set(true);
    const origin = this.focusOrigin;
    this.focusOrigin = null;
    this.restoringFocus = true;
    origin?.focus();
    this.restoringFocus = false;
  }

  onDetailKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.selectedId()) {
      event.preventDefault();
      this.closeDetail();
    }
  }

  onNodeKeydown(event: KeyboardEvent, slug: string): void {
    if (event.key === 'Escape' && this.selectedId()) {
      event.preventDefault();
      this.closeDetail();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectNode(slug, event.currentTarget as HTMLElement);
      return;
    }
    const next = this.tree().moveFocus?.(slug, event.key) ?? null;
    if (next) {
      event.preventDefault();
      this.focusedId.set(next);
      document.getElementById(this.nodeId(next))?.focus();
    }
  }

  statusLabel(status: SkillNode['status']): string {
    switch (status) {
      case 'recomendada':
        return $localize`:@@skillTree.status.recommended:Recomendada`;
      case 'meta':
        return $localize`:@@skillTree.status.meta:Meta`;
      case 'omitir':
        return $localize`:@@skillTree.status.skip:Omitir`;
    }
  }

  nodeLabelIds(item: RenderNode): string {
    return [
      `${item.id}-name`,
      `${item.id}-bar`,
      ...(item.active ? [`${item.id}-active`] : []),
    ].join(' ');
  }

  listItemId(node: SkillNode): string {
    return `${this.treeId()}-${this.mastery().slug}-${node.slug}-listitem`;
  }

  activeStepLabel(): string {
    return $localize`:@@skillTree.activeStep:Paso activo`;
  }

  visibleNameLines(name: string, maxChars: number): string[] {
    const words = name.trim().split(/\s+/);
    const lines: string[] = [];
    let current = '';
    let truncated = false;
    for (const word of words) {
      const chunks = word.match(new RegExp(`.{1,${maxChars}}`, 'gu')) ?? [word];
      for (const chunk of chunks) {
        const candidate = current ? `${current} ${chunk}` : chunk;
        if (candidate.length <= maxChars) {
          current = candidate;
          continue;
        }
        if (current) lines.push(current);
        current = chunk;
        if (lines.length === 2) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }
    if (current && lines.length < 2) lines.push(current);
    if (truncated && lines.length) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
    }
    return lines.slice(0, 2);
  }

  barLabel(bar: number): string {
    return $localize`:@@skillTree.barLabel:Barra ${bar}:bar:`;
  }

  barWarning(node: SkillNode): boolean {
    const current = this.currentBar();
    return Number.isInteger(current) && current! >= 0 && current! < node.bar_required;
  }
}
