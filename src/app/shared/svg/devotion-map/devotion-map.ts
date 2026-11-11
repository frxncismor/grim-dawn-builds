import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { PublicBuild } from '@gd/domain';
import { createKeyboardNav } from '../keyboard-nav';
import type { Layout } from '../layout';

type Constellation = PublicBuild['constellations'][number];
type DevotionStep = PublicBuild['devotion_steps'][number];
type SkillNode = PublicBuild['skill_nodes'][number];

interface FocusTarget {
  focus(): void;
}

interface BindingView {
  id: string;
  binding: DevotionStep['bindings'][number];
  skill: SkillNode | null;
  invalid: boolean;
}

interface StepView {
  id: string;
  listId: string;
  step: DevotionStep;
  active: boolean;
  bindings: BindingView[];
}

interface StarView {
  id: string;
  localId: string;
  x: number;
  y: number;
}

interface EdgeView {
  id: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ThresholdView {
  id: string;
  key: string;
  value: number;
  y: number;
  path: string;
}

interface BindingRowView {
  step: StepView;
  binding: BindingView;
  y: number;
}

interface GroupView {
  constellation: Constellation;
  index: number;
  id: string;
  listId: string;
  titleId: string;
  tierId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tierLabel: string;
  nameLabel: string;
  stars: StarView[];
  edges: EdgeView[];
  thresholds: ThresholdView[];
  steps: StepView[];
  positionsLabel: string;
  region: { x: number; y: number; width: number; height: number };
  bindingRows: BindingRowView[];
  active: boolean;
  selected: boolean;
  focused: boolean;
  graphicNodeCount: number;
}

interface MapView {
  groups: GroupView[];
  steps: StepView[];
  error: boolean;
  width: number;
  height: number;
  graphicNodeCount: number;
  moveFocus?: (id: string, key: string) => string | null;
}

@Component({
  selector: 'gd-devotion-map',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './devotion-map.html',
  styleUrl: './devotion-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevotionMap {
  readonly text = {
    unknown: $localize`:@@devotionMap.unknown:No data`,
    heading: $localize`:@@devotionMap.heading:Devotion map`,
    description: $localize`:@@devotionMap.description:Editorial outline, not part of the game map. Arrows: documented affinity requirements; internal lines of each constellation.`,
    invalid: $localize`:@@devotionMap.invalid:The map could not be drawn. Check the data; see the list.`,
    empty: $localize`:@@devotionMap.empty:No constellations.`,
    scrollHelp: $localize`:@@devotionMap.scrollHelp:Scroll within the diagram to see it in full.`,
    affinityRequired: $localize`:@@devotionMap.affinityRequired:Required affinity:`,
    affinityGranted: $localize`:@@devotionMap.affinityGranted:Granted affinity:`,
    closeDetail: $localize`:@@devotionMap.closeDetail:Close detail`,
    detailHint: $localize`:@@devotionMap.detailHint:Focus or hover over a constellation to see its data.`,
    listSummary: $localize`:@@devotionMap.listSummary:Constellations and route`,
    constellations: $localize`:@@devotionMap.constellations:Constellations`,
    route: $localize`:@@devotionMap.route:Devotion route`,
    emptyRoute: $localize`:@@devotionMap.emptyRoute:No devotion steps.`,
    noConstellation: $localize`:@@devotionMap.noConstellation:Step without an associated constellation.`,
    bindingError: $localize`:@@devotionMap.bindingError:Invalid reference`,
  };
  readonly requirementLabel = $localize`:@@devotionMap.requirement:Requires`;
  readonly positionsLabel = $localize`:@@devotionMap.positions:Steps`;
  readonly hasUnverified = computed(() =>
    this.steps().some((step) => step.verification === 'sin_verificar'),
  );
  readonly mapId = input.required<string>();
  readonly constellations = input.required<readonly Constellation[]>();
  readonly steps = input.required<readonly DevotionStep[]>();
  readonly skillNodes = input.required<readonly SkillNode[]>();
  readonly activeStepPosition = input<number | undefined>(undefined);

  readonly focusedSlug = signal<string | null>(null);
  readonly hoveredSlug = signal<string | null>(null);
  readonly selectedSlug = signal<string | null>(null);
  readonly detailDismissed = signal(false);
  private focusOrigin: FocusTarget | null = null;
  private restoringFocus = false;

  readonly orderedSteps = computed(() =>
    [...this.steps()].sort((left, right) => left.position - right.position),
  );
  readonly view = computed<MapView>(() => {
    const constellations = this.constellations();
    const skillBySlug = new Map(this.skillNodes().map((skill) => [skill.slug, skill]));
    let invalid = skillBySlug.size !== this.skillNodes().length;
    const steps: StepView[] = this.orderedSteps().map((step, index) => {
      if (
        step.constellation_slug !== null &&
        !constellations.some((c) => c.slug === step.constellation_slug)
      )
        invalid = true;
      return {
        step,
        id: this.id(step.position, index, 'step'),
        listId: this.id(step.position, index, 'step-listitem'),
        active: step.position === this.activeStepPosition(),
        bindings: step.bindings.map((binding, bindingIndex) => {
          const external = binding.skill_node_slug === null;
          const skill = external ? null : (skillBySlug.get(binding.skill_node_slug) ?? null);
          const broken = external ? step.verification !== 'sin_verificar' : !skill;
          invalid ||= broken;
          return {
            binding,
            skill,
            invalid: broken,
            id: this.id(
              step.constellation_slug ?? 'route',
              'step',
              step.position,
              index,
              'binding',
              bindingIndex,
            ),
          };
        }),
      };
    });
    const focus = constellations.some((c) => c.slug === this.focusedSlug())
      ? this.focusedSlug()
      : constellations[0]?.slug;
    const groups: GroupView[] = constellations.map((constellation, index) => {
      const nodes = constellation.layout.nodes;
      const xs = nodes.map((n) => n.x),
        ys = nodes.map((n) => n.y);
      const minX = xs.length ? Math.min(...xs) : 0,
        minY = ys.length ? Math.min(...ys) : 0;
      const spanX = Math.max(0, ...xs) - minX,
        spanY = Math.max(0, ...ys) - minY;
      const entries = Object.entries(constellation.affinity_required ?? {}).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      const region = { x: 24, y: 114 + entries.length * 24, width: spanX + 40, height: spanY + 36 };
      const center = region.x + region.width / 2,
        bend = Math.max(220, region.x + region.width + 20);
      const thresholds = entries.map(([key, value], i) => ({
        id: this.id(constellation.slug, 'threshold', key),
        key,
        value,
        y: 108 + i * 24,
        path: `M220 ${104 + i * 24} H${bend} V${region.y - 12} H${center} V${region.y} m-5 -7 l5 7 l5 -7`,
      }));
      const stars = nodes.map((n) => ({
        id: this.id(constellation.slug, n.id, 'star'),
        localId: n.id,
        x: n.x - minX + 44,
        y: n.y - minY + region.y + 18,
      }));
      const byId = new Map(stars.map((n) => [n.localId, n]));
      if (byId.size !== nodes.length) invalid = true;
      const edges = constellation.layout.edges.map((edge, i) => {
        const from = byId.get(edge.from),
          to = byId.get(edge.to);
        if (!from || !to) invalid = true;
        return {
          ...edge,
          id: `${this.mapId()}-${index}-edge-${i}`,
          x1: from?.x ?? 0,
          y1: from?.y ?? 0,
          x2: to?.x ?? 0,
          y2: to?.y ?? 0,
        };
      });
      const associated = steps.filter((row) => row.step.constellation_slug === constellation.slug);
      const bindings = associated.flatMap((step) =>
        step.bindings.map((binding) => ({ step, binding })),
      );
      const bottom = region.y + region.height;
      return {
        constellation,
        index,
        id: this.id(constellation.slug, 'group'),
        listId: this.id(constellation.slug, index, 'listitem'),
        titleId: this.id(constellation.slug, 'title'),
        tierId: this.id(constellation.slug, 'group') + '-tier',
        x: 0,
        y: 0,
        width: Math.max(440, spanX + 128),
        height: Math.max(300, bottom + 60 + bindings.length * 44),
        tierLabel: this.tierText(constellation),
        nameLabel: this.constellationName(constellation),
        stars,
        edges,
        thresholds,
        region,
        steps: associated,
        positionsLabel: associated.map((row) => row.step.position).join(' · '),
        bindingRows: bindings.map((row, i) => ({ ...row, y: bottom + 52 + i * 44 })),
        active: associated.some((row) => row.active),
        selected: this.selectedSlug() === constellation.slug,
        focused: focus === constellation.slug,
        graphicNodeCount: 1 + stars.length + thresholds.length + 2 * bindings.length,
      };
    });
    if (new Set(groups.map((group) => group.constellation.slug)).size !== groups.length)
      invalid = true;
    const navigation: Layout = {
      nodes: groups.map((group, row) => ({
        id: group.constellation.slug,
        parentId: null,
        level: 0,
        row,
        x: 0,
        y: row,
      })),
      edges: [],
    };
    const moveFocus = createKeyboardNav(navigation);
    const width = Math.max(440, ...groups.map((group) => group.width));
    let y = 18;
    for (let index = 0; index < groups.length; index += 2) {
      const row = groups.slice(index, index + 2);
      row.forEach((group, column) => {
        group.x = 12 + column * (width + 24);
        group.y = y;
        group.width = width;
      });
      y += Math.max(...row.map((group) => group.height)) + 24;
    }
    const graphicNodeCount = groups.reduce((sum, group) => sum + group.graphicNodeCount, 0);
    return {
      groups,
      steps,
      moveFocus,
      graphicNodeCount,
      error: invalid || graphicNodeCount > 120,
      width: groups.length ? Math.min(groups.length, 2) * (width + 24) : 0,
      height: y,
    };
  });

  readonly detailGroup = computed(() => {
    if (this.detailDismissed()) return null;
    const slug = this.selectedSlug() ?? this.hoveredSlug() ?? this.focusedSlug();
    return this.view().groups.find((group) => group.constellation.slug === slug) ?? null;
  });
  readonly mapTitleId = computed(() => `${this.mapId()}-map-title`);
  readonly svgTitleId = computed(() => `${this.mapId()}-map-svg-title`);
  readonly mapDescriptionId = computed(() => `${this.mapId()}-map-description`);

  id(...parts: (string | number)[]): string {
    return this.mapId() + '-' + parts.join('-');
  }

  stepLabel(position: number, label: string): string {
    return $localize`:@@devotionMap.stepLabel:Step ${position}:position: · ${label}:label:`;
  }

  kindLabel(kind: DevotionStep['kind']): string {
    switch (kind) {
      case 'ruta':
        return $localize`:@@devotionMap.kindRoute:Route`;
      case 'verificacion':
        return $localize`:@@devotionMap.kindVerification:Verification`;
      case 'limpieza':
        return $localize`:@@devotionMap.kindCleanup:Cleanup`;
    }
  }

  tierText(constellation: Constellation): string {
    return constellation.tier_level === null
      ? this.text.unknown
      : $localize`:@@devotionMap.tier:Tier ${constellation.tier_level}:tier:`;
  }

  constellationName(constellation: Constellation, englishSecondary = false): string {
    if (constellation.name_es === null) {
      return $localize`:@@devotionMap.englishName:English name: ${constellation.name_en}:nameEn:`;
    }
    return englishSecondary
      ? `${constellation.name_es} (${constellation.name_en})`
      : constellation.name_es;
  }

  activeStepLabel(): string {
    return $localize`:@@devotionMap.activeStep:Active step`;
  }

  affinityValueText(values: Record<string, number>): string {
    return Object.entries(values)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key} ${value}`)
      .join(' · ');
  }

  requiredAffinity(values: Record<string, number> | null): string {
    return values === null
      ? this.text.unknown
      : this.affinityValueText(values) ||
          $localize`:@@devotionMap.noAffinityRequired:No documented requirements`;
  }

  grantedAffinity(values: Record<string, number> | null): string {
    return values === null
      ? this.text.unknown
      : this.affinityValueText(values) || $localize`:@@devotionMap.noneGranted:No affinity granted`;
  }

  bindingTarget(binding: BindingView): string {
    if (binding.invalid) return this.text.bindingError;
    if (binding.binding.skill_node_slug === null) {
      return $localize`:@@devotionMap.externalTarget:External mention: ${binding.binding.skill_name_es}:name:`;
    }
    return binding.skill
      ? `${binding.skill.name_es} (${binding.skill.name_en})`
      : this.text.bindingError;
  }

  short(value: string, length = 24): string {
    return value.length > length ? value.slice(0, length - 1) + '…' : value;
  }

  stepConstellation(step: DevotionStep): string {
    const constellation = this.constellations().find((c) => c.slug === step.constellation_slug);
    return constellation ? this.constellationName(constellation, true) : this.text.noConstellation;
  }

  setFocus(slug: string): void {
    this.focusedSlug.set(slug);
    if (!this.restoringFocus) this.detailDismissed.set(false);
  }

  setHovered(slug: string): void {
    this.hoveredSlug.set(slug);
    this.detailDismissed.set(false);
  }

  clearHovered(): void {
    this.hoveredSlug.set(null);
  }

  selectGroup(slug: string, origin: EventTarget | null): void {
    const candidate = origin as (EventTarget & Partial<FocusTarget>) | null;
    this.focusOrigin = typeof candidate?.focus === 'function' ? (candidate as FocusTarget) : null;
    this.detailDismissed.set(false);
    this.selectedSlug.set(slug);
  }

  closeDetail(): void {
    this.selectedSlug.set(null);
    this.detailDismissed.set(true);
    const origin = this.focusOrigin;
    this.focusOrigin = null;
    this.restoringFocus = true;
    origin?.focus();
    this.restoringFocus = false;
  }

  onDetailKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.selectedSlug()) {
      event.preventDefault();
      this.closeDetail();
    }
  }

  onGroupKeydown(event: KeyboardEvent, slug: string, index: number): void {
    if (event.key === 'Escape' && this.selectedSlug()) {
      event.preventDefault();
      this.closeDetail();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectGroup(slug, event.currentTarget);
      return;
    }
    let next: string | null = null;
    if (event.key === 'ArrowLeft') next = this.view().groups[index - 1]?.constellation.slug ?? null;
    if (event.key === 'ArrowRight')
      next = this.view().groups[index + 1]?.constellation.slug ?? null;
    if (!next) next = this.view().moveFocus?.(slug, event.key) ?? null;
    if (next) {
      event.preventDefault();
      this.focusedSlug.set(next);
      document.getElementById(this.id(next, 'group'))?.focus();
    }
  }

  statusLabel(status: DevotionStep['verification']): string {
    return status === 'verificado'
      ? $localize`:@@devotionMap.verified:Verified`
      : $localize`:@@devotionMap.unverified:Unverified`;
  }

  warningText(): string {
    return $localize`:@@devotionMap.verifyWarning:verify in GrimTools before spending points`;
  }

  visibleNameLines(name: string): string[] {
    const maxChars = 22;
    const words = name.trim().split(/\s+/);
    const lines: string[] = [];
    while (words.length && lines.length < 2) {
      let line = '';
      while (words.length) {
        const word = this.short(words[0], maxChars);
        if (line && line.length + word.length + 1 > maxChars) break;
        line = line ? `${line} ${word}` : word;
        words.shift();
      }
      lines.push(line);
    }
    if (words.length && lines.length) lines[1] = `${lines[1].slice(0, maxChars - 1)}…`;
    return lines;
  }
}
