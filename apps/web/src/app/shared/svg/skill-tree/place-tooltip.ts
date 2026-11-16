/**
 * Pure tooltip placement for the skill tree (spec004 FR-010, FR-014, FR-046).
 *
 * No DOM and no dependencies: the caller measures with `getBoundingClientRect()` and applies the
 * result. Every rect is in the same coordinate space (viewport coordinates when fed with
 * `getBoundingClientRect()`), so scrolling, a shifted container and page zoom need no special
 * handling: pass the current rects and subtract the container origin to position the tooltip
 * absolutely inside it.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface PlaceTooltipInput {
  /** Rect of the node the tooltip describes. */
  anchor: Rect;
  /** Measured size of the tooltip. */
  tip: Size;
  /** Visible viewport (e.g. `{ left: 0, top: 0, width: innerWidth, height: innerHeight }`). */
  viewport: Rect;
  /** Optional rect of the tree container; only its visible part (∩ viewport) bounds the tooltip. */
  container?: Rect;
  /** Preferred side; defaults to `top`. */
  prefer?: TooltipSide;
  /** Distance between node and tooltip edges, clamped to 0..{@link MAX_GAP}; defaults to 8. */
  gap?: number;
}

export interface TooltipPlacement {
  /** Top-left corner of the tooltip, in the same space as the input rects. */
  left: number;
  top: number;
  /** Side of the node finally used (after flipping). */
  side: TooltipSide;
  /** Effective gap applied between node and tooltip. */
  gap: number;
  /** True when the position had to be shifted to stay inside the bounds. */
  clamped: boolean;
  /** True only when no side leaves the node uncovered (tooltip larger than the free space). */
  overlapsAnchor: boolean;
}

/** FR-010: the tooltip is at most 16 px from the node. */
export const MAX_GAP = 16;
const DEFAULT_GAP = 8;

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const PERPENDICULAR: Record<TooltipSide, [TooltipSide, TooltipSide]> = {
  top: ['right', 'left'],
  bottom: ['right', 'left'],
  left: ['bottom', 'top'],
  right: ['bottom', 'top'],
};

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

function intersect(a: Rect, b: Rect): Rect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const rightEdge = Math.min(a.left + a.width, b.left + b.width);
  const bottomEdge = Math.min(a.top + a.height, b.top + b.height);
  return {
    left,
    top,
    width: Math.max(0, rightEdge - left),
    height: Math.max(0, bottomEdge - top),
  };
}

/** Keeps `[pos, pos + size]` inside `[min, max]`; pins to `min` when it cannot fit. */
function clampAxis(pos: number, size: number, min: number, max: number): number {
  if (size >= max - min) return min;
  return Math.min(Math.max(pos, min), max - size);
}

export function placeTooltip(input: PlaceTooltipInput): TooltipPlacement {
  const { anchor, viewport, container } = input;
  const tip: Size = { width: finite(input.tip.width), height: finite(input.tip.height) };
  const requested =
    input.gap === undefined || !Number.isFinite(input.gap) ? DEFAULT_GAP : input.gap;
  const gap = Math.min(MAX_GAP, Math.max(0, requested));
  const bounds = container ? intersect(viewport, container) : viewport;
  const minX = bounds.left;
  const minY = bounds.top;
  const maxX = bounds.left + bounds.width;
  const maxY = bounds.top + bounds.height;

  const anchorRight = anchor.left + anchor.width;
  const anchorBottom = anchor.top + anchor.height;

  /** Free space on the main axis for each side, after the gap. */
  const room: Record<TooltipSide, number> = {
    top: anchor.top - minY - gap,
    bottom: maxY - anchorBottom - gap,
    left: anchor.left - minX - gap,
    right: maxX - anchorRight - gap,
  };
  const need = (side: TooltipSide) =>
    side === 'top' || side === 'bottom' ? tip.height : tip.width;

  const prefer = input.prefer ?? 'top';
  const order: TooltipSide[] = [prefer, OPPOSITE[prefer], ...PERPENDICULAR[prefer]];
  const side =
    order.find((s) => room[s] >= need(s)) ??
    order.reduce((best, s) => (room[s] > room[best] ? s : best), order[0]);

  // Ideal position: adjacent to the node and centred on the cross axis.
  let left: number;
  let top: number;
  switch (side) {
    case 'top':
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      top = anchor.top - gap - tip.height;
      break;
    case 'bottom':
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      top = anchorBottom + gap;
      break;
    case 'left':
      left = anchor.left - gap - tip.width;
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      break;
    case 'right':
      left = anchorRight + gap;
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      break;
  }

  const clampedLeft = clampAxis(left, tip.width, minX, maxX);
  const clampedTop = clampAxis(top, tip.height, minY, maxY);
  const clamped = clampedLeft !== left || clampedTop !== top;

  const overlapsAnchor =
    clampedLeft < anchorRight &&
    clampedLeft + tip.width > anchor.left &&
    clampedTop < anchorBottom &&
    clampedTop + tip.height > anchor.top;

  return { left: clampedLeft, top: clampedTop, side, gap, clamped, overlapsAnchor };
}
