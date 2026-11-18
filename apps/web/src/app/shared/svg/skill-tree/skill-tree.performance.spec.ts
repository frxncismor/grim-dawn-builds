import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * T030: the textual list sits far below the diagram. The browser must skip its style and layout
 * until it nears the viewport (about 8 ms of the first render, which is what keeps the TBT of the
 * mastery pages under budget with a loaded machine). The rule is guarded here because nothing in
 * the rendered output would fail if it were removed.
 */
const css = readFileSync('src/app/shared/svg/skill-tree/skill-tree.css', 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

function rulesFor(selector: string): string {
  const blocks = [...css.matchAll(/(?:^|\})\s*([^{}@][^{}]*)\{([^{}]*)\}/g)]
    .filter((match) => match[1]!.trim() === selector)
    .map((match) => match[2]);
  return blocks.join('\n');
}

describe('skill tree rendering cost (T030)', () => {
  it('skips rendering of the textual list until it is near the viewport', () => {
    const rules = rulesFor('.skill-tree__list');
    expect(rules).toMatch(/content-visibility:\s*auto/);
    expect(rules).toMatch(/contain-intrinsic-block-size:\s*auto\s+\d+rem/);
  });

  it('keeps an intrinsic height estimate for tablet and desktop widths so the page does not jump', () => {
    const widths = [
      ...css.matchAll(
        /@media \(min-width: (\d+)rem\)\s*\{[^{}]*\.skill-tree__list\s*\{[^{}]*contain-intrinsic-block-size:\s*auto\s+(\d+)rem/g,
      ),
    ];
    expect(widths.map((match) => Number(match[1]))).toEqual([40, 64]);
    const estimates = widths.map((match) => Number(match[2]));
    // Wider screens wrap the list less, so the estimate shrinks.
    expect(estimates[0]).toBeGreaterThan(estimates[1]!);
  });

  it('does not hide the diagram or its detail panel from the first render', () => {
    expect(css).not.toMatch(/\.skill-tree__(canvas|svg|detail)\s*\{[^}]*content-visibility/);
  });
});
