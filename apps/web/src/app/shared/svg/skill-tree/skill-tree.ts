import {
  afterNextRender,
  ChangeDetectionStrategy,
  effect,
  ElementRef,
  Injector,
  OnDestroy,
  ViewEncapsulation,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';
import type { PublicSkillNode, PublicMasteryTree, PublicBuild, SkillKind } from '@gd/domain';
import { createKeyboardNav } from '../keyboard-nav';
import { layoutForest } from '../layout';
import { placeTooltip } from './place-tooltip';
import { skillSymbolHref } from '../../ui/icon/skill-symbols';

type Mastery = PublicBuild['masteries'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

interface FocusTarget {
  focus(): void;
}

const EMPTY_MASTERY: Mastery = { slug: '', name_es: '', name_en: '', role_text: '' };

/** Catalog grid geometry (px in SVG user units). Columns are tiers; rows are compacted ranks. */
/** Column step; labels use at most `step - CATALOG_MIN_COLUMN_GAP` so neighbours never touch. */
export const CATALOG_COLUMN_STEP = 192;
export const CATALOG_MIN_COLUMN_GAP = 16;
const CATALOG_COL_WIDTH = CATALOG_COLUMN_STEP;
/**
 * Vertical step between compact rows. It must hold the tallest node: ring above the centre, then
 * the label block (two name lines, kind, "Max n (u)" and "Circular", one per line) below it, plus a margin.
 */
const CATALOG_RING_RADIUS = 28;
const CATALOG_LABEL_BOTTOM = 100; // last baseline (circular line at y=96) + descent
const CATALOG_ROW_MARGIN = 8;
export const CATALOG_MIN_ROW_STEP = CATALOG_RING_RADIUS + CATALOG_LABEL_BOTTOM + CATALOG_ROW_MARGIN;
const CATALOG_ROW_HEIGHT = CATALOG_MIN_ROW_STEP;
const CATALOG_MARGIN_X = 96;
const CATALOG_HEADER_HEIGHT = 56;
const CATALOG_MARGIN_BOTTOM = 96;
const CATALOG_MAX_NODES = 400;
/** Grace period before the tooltip hides, long enough to move the pointer onto it. */
const TOOLTIP_HIDE_DELAY_MS = 250;

interface CatalogRenderNode {
  node: PublicSkillNode;
  id: string;
  labelLines: string[];
  label: string;
  x: number;
  y: number;
  selected: boolean;
  focused: boolean;
  /** Assignment mode: the guide node that points at this catalog node, if any. */
  assignment: SkillNode | null;
  active: boolean;
}

interface CatalogModel {
  nodes: CatalogRenderNode[];
  edges: { id: string; from: string; to: string; d: string }[];
  tiers: { tier: number; barRequired: number; x: number }[];
  error: boolean;
  width: number;
  height: number;
  moveFocus?: (focusedId: string, key: string) => string | null;
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
  // Styles live in src/styles/deferred.css, served by DeferredStyles: a deferred component's inline <style> is blocked by the CSP (T033).
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Esc closes the tooltip wherever the focus is (WCAG 1.4.13 dismissible), without moving it.
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class SkillTree implements OnDestroy {
  readonly treeId = input.required<string>();
  /** Guide mode: mastery and nodes of a published build (editorial `layout`). */
  readonly mastery = input<Mastery>(EMPTY_MASTERY);
  readonly nodes = input<readonly SkillNode[]>([]);
  /** Catalog mode: a full canonical tree drawn from its `grid`; guide inputs are ignored. */
  readonly catalogTree = input<PublicMasteryTree | undefined>(undefined);
  /**
   * Assignment mode (T017): with a `catalogTree`, the guide nodes of that mastery. Each one points
   * at a catalog node through `skill_node_id` and marks it with its editorial status; the rest of
   * the tree stays drawn but subordinate. Empty keeps the plain catalog mode.
   */
  readonly assignments = input<readonly SkillNode[]>([]);
  readonly activeIds = input<readonly string[]>([]);
  readonly currentBar = input<number | undefined>(undefined);

  /** Active language: main name of every catalog label; the other one is secondary. */
  readonly nameLang: 'en' | 'es' = inject(LOCALE_ID).toLowerCase().startsWith('es') ? 'es' : 'en';
  readonly otherLang: 'en' | 'es' = this.nameLang === 'es' ? 'en' : 'es';

  readonly focusedId = signal<string | null>(null);
  readonly hoveredId = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly detailDismissed = signal(false);
  /** Node that really holds keyboard focus (the roving `focusedId` is set even when nothing is focused). */
  readonly focusActiveId = signal<string | null>(null);
  readonly tooltipDismissed = signal(false);
  private hoverClearTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private focusOrigin: FocusTarget | null = null;
  private restoringFocus = false;

  readonly assignmentById = computed(
    () =>
      new Map(
        this.assignments()
          .filter((node) => node.skill_node_id !== undefined)
          .map((node) => [node.skill_node_id!, node]),
      ),
  );
  readonly assignmentMode = computed(
    () => this.catalogTree() !== undefined && this.assignmentById().size > 0,
  );

  readonly scopeSlug = computed(() => this.catalogTree()?.mastery.slug ?? this.mastery().slug);

  readonly catalog = computed<CatalogModel | null>(() => {
    const catalogTree = this.catalogTree();
    if (!catalogTree) return null;
    const source = catalogTree.nodes;
    if (source.length > CATALOG_MAX_NODES)
      return { nodes: [], edges: [], tiers: [], error: true, width: 0, height: 0 };
    const rowRank = new Map(
      [...new Set(source.map((node) => node.grid.row))]
        .sort((a, b) => a - b)
        .map((row, rank) => [row, rank]),
    );
    const point = (node: PublicSkillNode) => ({
      x: CATALOG_MARGIN_X + (node.grid.col - 1) * CATALOG_COL_WIDTH,
      y:
        CATALOG_HEADER_HEIGHT +
        CATALOG_ROW_HEIGHT / 2 +
        rowRank.get(node.grid.row)! * CATALOG_ROW_HEIGHT,
    });
    const ordered = [...source].sort(
      (a, b) => a.grid.col - b.grid.col || a.grid.row - b.grid.row || a.id.localeCompare(b.id),
    );
    const known = new Set(source.map((node) => node.id));
    const currentFocus = this.focusedId();
    const rovingId = known.has(currentFocus ?? '') ? currentFocus! : (ordered[0]?.id ?? null);
    const selectedId = this.selectedId();
    const maxLabelChars = Math.floor((CATALOG_COL_WIDTH - CATALOG_MIN_COLUMN_GAP) / 8);
    const nameById = new Map(source.map((node) => [node.id, node.name[this.nameLang]]));
    const positions = new Map(source.map((node) => [node.id, point(node)]));
    const tierBars = new Map(source.map((node) => [node.tier, node.bar_required]));
    const maxCol = Math.max(...source.map((node) => node.grid.col));
    const maxRank = Math.max(...rowRank.values());
    const assignmentById = this.assignmentById();
    const activeSlugs = new Set(this.activeIds());
    const renderNodes = ordered.map((node): CatalogRenderNode => {
      const at = positions.get(node.id)!;
      const labelLines = this.visibleNameLines(node.name[this.nameLang], maxLabelChars);
      const assignment = assignmentById.get(node.id) ?? null;
      const active = assignment !== null && activeSlugs.has(assignment.slug);
      return {
        node,
        id: this.nodeId(node.id),
        labelLines,
        label: this.catalogNodeLabel(node, nameById, labelLines.join(' '), assignment, active),
        ...at,
        selected: selectedId === node.id,
        focused: rovingId === node.id,
        assignment,
        active,
      };
    });
    const edges = ordered
      .filter((node) => node.parent_id !== null && positions.has(node.parent_id))
      .map((node, order) => {
        const from = positions.get(node.parent_id!)!;
        const to = positions.get(node.id)!;
        const midX = (from.x + to.x) / 2;
        return {
          id: `${this.treeId()}-${catalogTree.mastery.slug}-edge-${order}`,
          from: node.parent_id!,
          to: node.id,
          d: `M${from.x} ${from.y} H${midX} V${to.y} H${to.x}`,
        };
      });
    const keyboardLayout = {
      nodes: ordered.map((node, row) => ({
        id: node.id,
        parentId: node.parent_id,
        level: node.grid.col,
        row,
        ...positions.get(node.id)!,
      })),
      edges: edges.map(({ from, to }) => ({ from, to })),
    };
    return {
      nodes: renderNodes,
      edges,
      tiers: [...tierBars.entries()]
        .sort(([a], [b]) => a - b)
        .map(([tier, barRequired]) => ({
          tier,
          barRequired,
          x: CATALOG_MARGIN_X + (tier - 1) * CATALOG_COL_WIDTH,
        })),
      error: false,
      width: CATALOG_MARGIN_X * 2 + (maxCol - 1) * CATALOG_COL_WIDTH,
      height: CATALOG_HEADER_HEIGHT + (maxRank + 1) * CATALOG_ROW_HEIGHT + CATALOG_MARGIN_BOTTOM,
      moveFocus: createKeyboardNav(keyboardLayout),
    };
  });

  /** One tooltip at a time: the focused node wins over a residual hover. */
  readonly tooltipNodeId = computed(() =>
    this.catalogTree() && !this.tooltipDismissed()
      ? (this.selectedId() ?? this.focusActiveId() ?? this.hoveredId())
      : null,
  );
  readonly tooltipNode = computed(() => {
    const id = this.tooltipNodeId();
    return this.catalogTree()?.nodes.find((node) => node.id === id) ?? null;
  });
  readonly tooltipAssignment = computed(
    () => this.assignmentById().get(this.tooltipNode()?.id ?? '') ?? null,
  );
  readonly tooltipId = computed(() => `${this.treeId()}-${this.scopeSlug()}-tooltip`);

  /** Places the open tooltip next to its node with the pure `placeTooltip` (DOM style properties: CSP-safe). */
  private readonly injector = inject(Injector);
  private readonly positionTooltip = effect(() => {
    // Signals read here re-run the placement; pinning adds the close button, so measure again.
    const id = this.tooltipNodeId();
    this.selectedId();
    if (!id) return;
    afterNextRender(() => this.placeOpenTooltip(id), { injector: this.injector });
  });

  private placeOpenTooltip(id: string): void {
    const root = this.host.nativeElement;
    const tip = root.querySelector<HTMLElement>('[role="tooltip"]');
    const stage = root.querySelector<HTMLElement>('.skill-tree__stage');
    const anchor = Array.from(root.querySelectorAll<Element>('[data-skill-id]')).find(
      (el) => el.getAttribute('data-skill-id') === id,
    );
    if (!tip || !stage || !anchor) return;
    tip.style.left = '0px';
    tip.style.top = '0px';
    const tipRect = tip.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const placed = placeTooltip({
      anchor: anchor.getBoundingClientRect(),
      tip: { width: tipRect.width, height: tipRect.height },
      viewport: { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
      prefer: 'top',
    });
    tip.style.left = `${placed.left - stageRect.left}px`;
    tip.style.top = `${placed.top - stageRect.top}px`;
    tip.style.visibility = 'visible';
    tip.setAttribute('data-side', placed.side);
  }

  /** Textual list order: assigned nodes first (the reason for the page), then the rest. */
  readonly catalogListNodes = computed(() => {
    const nodes = this.catalogTree()?.nodes ?? [];
    const assigned = this.assignmentById();
    if (assigned.size === 0) return nodes;
    return [
      ...nodes.filter((n) => assigned.has(n.id)),
      ...nodes.filter((n) => !assigned.has(n.id)),
    ];
  });

  readonly legendStatuses: readonly SkillNode['status'][] = ['recomendada', 'meta', 'omitir'];

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
          id: `${this.treeId()}-${this.scopeSlug()}-edge-${order}`,
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
  readonly headingId = computed(() => `${this.treeId()}-${this.scopeSlug()}-heading`);
  readonly svgTitleId = computed(() => `${this.treeId()}-${this.scopeSlug()}-svg-title`);
  readonly svgDescriptionId = computed(
    () => `${this.treeId()}-${this.scopeSlug()}-svg-description`,
  );
  readonly detailId = computed(() => `${this.treeId()}-${this.scopeSlug()}-detail`);
  readonly masteryName = computed(
    () => this.catalogTree()?.mastery.name[this.nameLang] ?? this.mastery().name_es,
  );
  readonly svgTitle = computed(
    () => $localize`:@@skillTree.svgTitle:Skill tree of ${this.masteryName()}:mastery:`,
  );

  nodeId(slug: string): string {
    return `${this.treeId()}-${this.scopeSlug()}-${slug}`;
  }

  setRovingFocus(slug: string): void {
    this.focusedId.set(slug);
    if (!this.restoringFocus) this.detailDismissed.set(false);
  }

  setHovered(slug: string): void {
    this.cancelHoverClear();
    this.hoveredId.set(slug);
    this.detailDismissed.set(false);
    this.tooltipDismissed.set(false);
  }

  /** Leaving the node or the tooltip hides after a short grace so the pointer can reach the tooltip (WCAG 1.4.13). */
  scheduleHoverClear(): void {
    this.cancelHoverClear();
    this.hoverClearTimer = setTimeout(() => {
      this.hoverClearTimer = null;
      this.hoveredId.set(null);
    }, TOOLTIP_HIDE_DELAY_MS);
  }

  cancelHoverClear(): void {
    if (this.hoverClearTimer !== null) clearTimeout(this.hoverClearTimer);
    this.hoverClearTimer = null;
  }

  setFocusActive(slug: string): void {
    this.focusActiveId.set(slug);
    if (!this.restoringFocus) this.tooltipDismissed.set(false);
  }

  clearFocusActive(slug: string): void {
    if (this.focusActiveId() === slug) this.focusActiveId.set(null);
  }

  dismissTooltip(): void {
    if (this.tooltipNodeId() !== null) this.tooltipDismissed.set(true);
  }

  ngOnDestroy(): void {
    this.cancelHoverClear();
  }

  clearHovered(): void {
    this.hoveredId.set(null);
  }

  selectNode(slug: string, origin: EventTarget | null): void {
    const candidate = origin as (EventTarget & Partial<FocusTarget>) | null;
    this.focusOrigin = typeof candidate?.focus === 'function' ? (candidate as FocusTarget) : null;
    this.detailDismissed.set(false);
    this.tooltipDismissed.set(false);
    this.selectedId.set(slug);
  }

  /** Unpins the tooltip; `restoreFocus` is false when the user tapped elsewhere (focus stays there). */
  closeDetail(restoreFocus = true): void {
    this.selectedId.set(null);
    this.detailDismissed.set(true);
    this.tooltipDismissed.set(true);
    const origin = this.focusOrigin;
    this.focusOrigin = null;
    if (!restoreFocus) return;
    this.restoringFocus = true;
    origin?.focus();
    this.restoringFocus = false;
  }

  /** Escape closes the pinned tooltip (returning focus to its node) or the hover/focus one, never moving focus otherwise. */
  onEscape(): void {
    if (this.selectedId()) this.closeDetail();
    else this.dismissTooltip();
  }

  /** A tap or click outside the pinned tooltip and the nodes closes it (WCAG 1.4.13 dismissible; touch). */
  onDocumentPointerDown(event: Event): void {
    if (!this.selectedId()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    const root = this.host.nativeElement;
    const tip = root.querySelector('[role="tooltip"]');
    if (tip?.contains(target)) return;
    const element = target instanceof Element ? target : target.parentElement;
    if (element?.closest('[data-skill-id]') && root.contains(element)) return;
    this.closeDetail(false);
    this.hoveredId.set(null);
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
    const next = (this.catalog() ?? this.tree()).moveFocus?.(slug, event.key) ?? null;
    if (next) {
      event.preventDefault();
      this.focusedId.set(next);
      document.getElementById(this.nodeId(next))?.focus();
    }
  }

  statusLabel(status: SkillNode['status']): string {
    switch (status) {
      case 'recomendada':
        return $localize`:@@skillTree.status.recommended:Recommended`;
      case 'meta':
        return $localize`:@@skillTree.status.meta:Meta`;
      case 'omitir':
        return $localize`:@@skillTree.status.skip:Skip`;
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
    return `${this.treeId()}-${this.scopeSlug()}-${node.slug}-listitem`;
  }

  /** Small glyph of the status badge; each status has its own shape (not only its colour). */
  badgeGlyph(status: SkillNode['status']): string {
    switch (status) {
      case 'recomendada':
        return 'M-5 0 L-1.5 3.5 L5.5 -4';
      case 'meta':
        return 'M0 -5 L5 0 L0 5 L-5 0 Z';
      case 'omitir':
        return 'M-4 -4 L4 4 M4 -4 L-4 4';
    }
  }

  assignedLabel(): string {
    return $localize`:@@skillTree.assigned:Assigned`;
  }

  notAssignedLabel(): string {
    return $localize`:@@skillTree.notAssigned:Not in this guide`;
  }

  activeStepLabel(): string {
    return $localize`:@@skillTree.activeStep:Active step`;
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

  /** Own icon of a catalog node (spec004 T024, `ASSET_SOURCE=own`); never the game's texture. */
  iconHref(node: Pick<PublicSkillNode, 'kind' | 'circular'>): string {
    return skillSymbolHref(node);
  }

  kindLabel(kind: SkillKind): string {
    switch (kind) {
      case 'active':
        return $localize`:@@skillTree.kind.active:Active`;
      case 'passive':
        return $localize`:@@skillTree.kind.passive:Passive`;
      case 'modifier':
        return $localize`:@@skillTree.kind.modifier:Modifier`;
      case 'transmuter':
        return $localize`:@@skillTree.kind.transmuter:Transmuter`;
    }
  }

  tierLabel(tier: number): string {
    return $localize`:@@skillTree.tierLabel:Tier ${tier}:tier:`;
  }

  maxPointsLabel(node: PublicSkillNode): string {
    return node.ultimate_points === undefined
      ? $localize`:@@skillTree.catalogMax:Max ${node.max_points}:max:`
      : $localize`:@@skillTree.catalogMaxUltimate:Max ${node.max_points}:max: (${node.ultimate_points}:ultimate:)`;
  }

  circularLabel(): string {
    return $localize`:@@skillTree.circular:Circular`;
  }

  /**
   * Full textual equivalent of a catalog node. It opens with the visible text in its visible order
   * (name, kind, range, "Circular") so the accessible name contains it (WCAG 2.5.3 Label in Name);
   * tier, bar and dependency follow. A name shortened on screen is repeated in full afterwards.
   */
  catalogNodeLabel(
    node: PublicSkillNode,
    nameById: ReadonlyMap<string, string>,
    visibleName: string = node.name[this.nameLang],
    assignment: SkillNode | null = null,
    active = false,
  ): string {
    const name = node.name[this.nameLang];
    const parts = [visibleName, this.kindLabel(node.kind), this.maxPointsLabel(node)];
    if (node.circular) parts.push(this.circularLabel());
    if (visibleName !== name) parts.push(name);
    if (assignment) {
      parts.push(this.assignedLabel(), this.statusLabel(assignment.status));
      if (active) parts.push(this.activeStepLabel());
    }
    parts.push(
      this.tierLabel(node.tier),
      this.barLabel(node.bar_required),
      this.dependencyLabel(node, nameById),
    );
    return parts.join('. ');
  }

  dependencyLabel(node: PublicSkillNode, nameById: ReadonlyMap<string, string>): string {
    if (node.parent_id === null) return $localize`:@@skillTree.noRequirement:No requirement`;
    const parent = nameById.get(node.parent_id) ?? node.parent_id;
    return $localize`:@@skillTree.requiresParent:Requires ${parent}:parent:`;
  }

  readonly catalogNames = computed(
    () =>
      new Map((this.catalogTree()?.nodes ?? []).map((node) => [node.id, node.name[this.nameLang]])),
  );

  catalogListItemId(node: PublicSkillNode): string {
    return `${this.treeId()}-${this.scopeSlug()}-${node.id}-listitem`;
  }

  barLabel(bar: number): string {
    return $localize`:@@skillTree.barLabel:Bar ${bar}:bar:`;
  }

  barWarning(node: SkillNode): boolean {
    const current = this.currentBar();
    return Number.isInteger(current) && current! >= 0 && current! < node.bar_required;
  }
}
