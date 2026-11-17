import { describe, expect, it } from 'vitest';
import { placeTooltip, type PlaceTooltipInput, type Rect } from './place-tooltip';

const viewport: Rect = { left: 0, top: 0, width: 1280, height: 800 };
const tip = { width: 200, height: 100 };
const node = (left: number, top: number, size = 40): Rect => ({
  left,
  top,
  width: size,
  height: size,
});

const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;

/** Rect of the placed tooltip, for geometric assertions. */
const box = (p: { left: number; top: number }, size = tip): Rect => ({
  left: p.left,
  top: p.top,
  width: size.width,
  height: size.height,
});

const inside = (inner: Rect, outer: Rect) =>
  inner.left >= outer.left &&
  inner.top >= outer.top &&
  right(inner) <= right(outer) &&
  bottom(inner) <= bottom(outer);

const overlaps = (a: Rect, b: Rect) =>
  a.left < right(b) && right(a) > b.left && a.top < bottom(b) && bottom(a) > b.top;

/** Edge-to-edge distance between two rects (0 when they touch or overlap). */
const distance = (a: Rect, b: Rect) =>
  Math.hypot(
    Math.max(0, a.left - right(b), b.left - right(a)),
    Math.max(0, a.top - bottom(b), b.top - bottom(a)),
  );

describe('placeTooltip', () => {
  describe('preferred side and flipping', () => {
    it('places above the node, centred, when there is room', () => {
      const anchor = node(600, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'top', gap: 8 });
      expect(p.side).toBe('top');
      expect(p.top).toBe(400 - 8 - 100);
      expect(p.left).toBe(600 + 20 - 100);
      expect(p.clamped).toBe(false);
      expect(p.overlapsAnchor).toBe(false);
    });

    it('places below the node when asked', () => {
      const anchor = node(600, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'bottom', gap: 8 });
      expect(p.side).toBe('bottom');
      expect(p.top).toBe(bottom(anchor) + 8);
      expect(p.left).toBe(520);
    });

    it('places left of the node, vertically centred, when asked', () => {
      const anchor = node(600, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'left', gap: 8 });
      expect(p.side).toBe('left');
      expect(p.left).toBe(600 - 8 - 200);
      expect(p.top).toBe(400 + 20 - 50);
    });

    it('places right of the node, vertically centred, when asked', () => {
      const anchor = node(600, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'right', gap: 8 });
      expect(p.side).toBe('right');
      expect(p.left).toBe(right(anchor) + 8);
      expect(p.top).toBe(370);
    });

    it('defaults to the top side with a gap of at most 16 px', () => {
      const p = placeTooltip({ anchor: node(600, 400), tip, viewport });
      expect(p.side).toBe('top');
      expect(p.gap).toBeGreaterThan(0);
      expect(p.gap).toBeLessThanOrEqual(16);
    });

    it.each([
      ['top', node(600, 30), 'bottom'],
      ['bottom', node(600, 730), 'top'],
      ['left', node(30, 400), 'right'],
      ['right', node(1210, 400), 'left'],
    ] as const)(
      'flips %s to the opposite side when it does not fit',
      (prefer, anchor, expected) => {
        const p = placeTooltip({ anchor, tip, viewport, prefer, gap: 8 });
        expect(p.side).toBe(expected);
        expect(p.clamped).toBe(false);
        expect(overlaps(box(p), anchor)).toBe(false);
        expect(inside(box(p), viewport)).toBe(true);
      },
    );

    it('falls back to a perpendicular side when neither vertical side fits', () => {
      const short: Rect = { left: 0, top: 0, width: 1280, height: 130 };
      const anchor = node(600, 45);
      const p = placeTooltip({ anchor, tip, viewport: short, prefer: 'top', gap: 8 });
      expect(['left', 'right']).toContain(p.side);
      expect(overlaps(box(p), anchor)).toBe(false);
      expect(inside(box(p), short)).toBe(true);
    });
  });

  describe('clamping to the viewport on the four edges', () => {
    it('clamps to the left edge, keeping the node uncovered', () => {
      const anchor = node(0, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'top', gap: 8 });
      expect(p.left).toBe(0);
      expect(p.clamped).toBe(true);
      expect(inside(box(p), viewport)).toBe(true);
      expect(overlaps(box(p), anchor)).toBe(false);
    });

    it('clamps to the right edge, keeping the node uncovered', () => {
      const anchor = node(1240, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'top', gap: 8 });
      expect(right(box(p))).toBe(1280);
      expect(p.clamped).toBe(true);
      expect(inside(box(p), viewport)).toBe(true);
      expect(overlaps(box(p), anchor)).toBe(false);
    });

    it('clamps to the top edge when a horizontal side is centred above the edge', () => {
      const anchor = node(600, 0);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'right', gap: 8 });
      expect(p.top).toBe(0);
      expect(p.clamped).toBe(true);
      expect(inside(box(p), viewport)).toBe(true);
      expect(overlaps(box(p), anchor)).toBe(false);
    });

    it('clamps to the bottom edge when a horizontal side is centred below the edge', () => {
      const anchor = node(600, 760);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'left', gap: 8 });
      expect(bottom(box(p))).toBe(800);
      expect(p.clamped).toBe(true);
      expect(inside(box(p), viewport)).toBe(true);
      expect(overlaps(box(p), anchor)).toBe(false);
    });

    it.each([
      ['top-left', node(0, 0)],
      ['top-right', node(1240, 0)],
      ['bottom-left', node(0, 760)],
      ['bottom-right', node(1240, 760)],
    ] as const)('stays complete inside the viewport in the %s corner', (_name, anchor) => {
      const p = placeTooltip({ anchor, tip, viewport, gap: 8 });
      expect(inside(box(p), viewport)).toBe(true);
      expect(overlaps(box(p), anchor)).toBe(false);
    });
  });

  describe('scrolled and offset containers', () => {
    it('keeps the tooltip inside the visible part of a container offset in the page', () => {
      const container: Rect = { left: 300, top: 120, width: 600, height: 400 };
      const anchor = node(310, 130);
      const p = placeTooltip({ anchor, tip, viewport, container, prefer: 'top', gap: 8 });
      expect(inside(box(p), container)).toBe(true);
      expect(overlaps(box(p), anchor)).toBe(false);
      expect(p.side).toBe('bottom');
    });

    it('uses only the visible intersection of a container scrolled partly off the viewport', () => {
      const container: Rect = { left: 900, top: 500, width: 600, height: 600 };
      const anchor = node(1000, 560);
      const visible: Rect = { left: 900, top: 500, width: 380, height: 300 };
      const p = placeTooltip({ anchor, tip, viewport, container, gap: 8 });
      expect(inside(box(p), visible)).toBe(true);
      expect(overlaps(box(p), anchor)).toBe(false);
    });

    it('is independent of the absolute position of the container', () => {
      const base = placeTooltip({
        anchor: node(100, 100),
        tip,
        viewport: { left: 0, top: 0, width: 600, height: 400 },
        prefer: 'top',
        gap: 8,
      });
      const moved = placeTooltip({
        anchor: node(1100, 2100),
        tip,
        viewport: { left: 1000, top: 2000, width: 600, height: 400 },
        prefer: 'top',
        gap: 8,
      });
      expect(moved.side).toBe(base.side);
      expect(moved.left - 1000).toBe(base.left);
      expect(moved.top - 2000).toBe(base.top);
    });
  });

  describe('zoom 200 %', () => {
    // At 200 % the CSS viewport halves while nodes and tooltip keep their CSS size.
    const zoomed: Rect = { left: 0, top: 0, width: 640, height: 400 };

    it.each([node(0, 0), node(600, 0), node(300, 180), node(0, 360), node(600, 360)])(
      'keeps the tooltip inside the zoomed viewport for a node at %o',
      (anchor) => {
        const p = placeTooltip({ anchor, tip, viewport: zoomed });
        expect(inside(box(p), zoomed)).toBe(true);
        expect(overlaps(box(p), anchor)).toBe(false);
        expect(distance(box(p), anchor)).toBeLessThanOrEqual(16);
      },
    );
  });

  describe('tooltip larger than the free space', () => {
    it('pins to the origin of the bounds when the tooltip is wider than the viewport', () => {
      const narrow: Rect = { left: 0, top: 0, width: 150, height: 800 };
      const p = placeTooltip({ anchor: node(55, 400), tip, viewport: narrow, gap: 8 });
      expect(p.left).toBe(0);
      expect(p.clamped).toBe(true);
    });

    it('pins to the origin of the bounds when the tooltip is taller than the viewport', () => {
      const flat: Rect = { left: 0, top: 0, width: 1280, height: 80 };
      const p = placeTooltip({
        anchor: node(600, 20),
        tip,
        viewport: flat,
        prefer: 'right',
        gap: 8,
      });
      expect(p.top).toBe(0);
      expect(p.clamped).toBe(true);
    });

    it('picks the side with most room and flags the overlap when nothing fits', () => {
      const tiny: Rect = { left: 0, top: 0, width: 150, height: 90 };
      const anchor = node(55, 25);
      const p = placeTooltip({ anchor, tip, viewport: tiny, gap: 8 });
      expect(p.left).toBe(0);
      expect(p.top).toBe(0);
      expect(p.overlapsAnchor).toBe(overlaps(box(p), anchor));
      expect(p.overlapsAnchor).toBe(true);
    });

    it('never returns non-finite numbers for degenerate input', () => {
      const p = placeTooltip({
        anchor: { left: 0, top: 0, width: 0, height: 0 },
        tip: { width: 0, height: 0 },
        viewport: { left: 0, top: 0, width: 0, height: 0 },
      });
      expect(Number.isFinite(p.left)).toBe(true);
      expect(Number.isFinite(p.top)).toBe(true);
    });
  });

  describe('gap', () => {
    it.each([0, 4, 8, 16])('leaves exactly %i px between node and tooltip', (gap) => {
      const anchor = node(600, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'top', gap });
      expect(distance(box(p), anchor)).toBe(gap);
      expect(p.gap).toBe(gap);
    });

    it('caps a larger requested gap at 16 px (FR-010)', () => {
      const anchor = node(600, 400);
      const p = placeTooltip({ anchor, tip, viewport, prefer: 'top', gap: 40 });
      expect(p.gap).toBe(16);
      expect(distance(box(p), anchor)).toBe(16);
    });

    it('treats a negative gap as zero', () => {
      const p = placeTooltip({ anchor: node(600, 400), tip, viewport, gap: -5 });
      expect(p.gap).toBe(0);
    });

    it('stays within 16 px of the node on every side, also after flipping or clamping', () => {
      const anchors = [node(0, 0), node(1240, 0), node(0, 760), node(1240, 760), node(600, 400)];
      for (const anchor of anchors) {
        for (const prefer of ['top', 'bottom', 'left', 'right'] as const) {
          const input: PlaceTooltipInput = { anchor, tip, viewport, prefer, gap: 16 };
          const p = placeTooltip(input);
          expect(distance(box(p), anchor)).toBeLessThanOrEqual(16);
          expect(inside(box(p), viewport)).toBe(true);
        }
      }
    });
  });

  it('does not mutate its input', () => {
    const input = Object.freeze({
      anchor: Object.freeze(node(600, 400)),
      tip: Object.freeze({ ...tip }),
      viewport: Object.freeze({ ...viewport }),
      prefer: 'top' as const,
      gap: 8,
    });
    expect(() => placeTooltip(input)).not.toThrow();
  });
});

describe('placeTooltip margin (spec005 T031, F-14)', () => {
  const phone: Rect = { left: 0, top: 0, width: 375, height: 800 };
  const wide = { width: 300, height: 120 };

  it('keeps the tooltip at least `margin` px from both sides of the viewport', () => {
    for (const x of [0, 10, 100, 330, 365]) {
      const p = placeTooltip({
        anchor: node(x, 400),
        tip: wide,
        viewport: phone,
        prefer: 'top',
        gap: 8,
        margin: 16,
      });
      expect(p.left, `nodo en x=${x}`).toBeGreaterThanOrEqual(16);
      expect(right(box(p, wide)), `nodo en x=${x}`).toBeLessThanOrEqual(375 - 16);
    }
  });

  it('keeps the node within 16 px of the tooltip while the margin pushes it sideways', () => {
    const anchor = node(0, 400);
    const p = placeTooltip({
      anchor,
      tip: wide,
      viewport: phone,
      prefer: 'top',
      gap: 8,
      margin: 16,
    });
    expect(distance(box(p, wide), anchor)).toBeLessThanOrEqual(16);
  });

  it('flips to the bottom when the margin leaves no room above', () => {
    const p = placeTooltip({
      anchor: node(100, 130),
      tip: wide,
      viewport: phone,
      prefer: 'top',
      gap: 8,
      margin: 16,
    });
    expect(p.side).toBe('bottom');
    expect(p.top).toBeGreaterThanOrEqual(16);
  });

  it('defaults to no margin (the previous behaviour)', () => {
    const p = placeTooltip({ anchor: node(0, 400), tip: wide, viewport: phone, prefer: 'top' });
    expect(p.left).toBe(0);
  });
});
