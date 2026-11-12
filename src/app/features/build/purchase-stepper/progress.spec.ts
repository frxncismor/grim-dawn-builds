import { describe, expect, it } from 'vitest';
import type { PublicBuild } from '@gd/domain';
import { progressKey, progressRevision, validateProgress } from './progress';

type PurchaseStep = PublicBuild['purchase_steps'][number];

const steps: PurchaseStep[] = [
  {
    position: 7,
    threshold_label: 'Objetivo libre',
    mastery_slug: null,
    title: 'Paso de prueba',
    body: 'Texto sintético',
    highlights: [{ skill_node_slug: 'nodo-a', points: null }],
  },
  {
    position: 2,
    threshold_label: 'Barra 0',
    mastery_slug: 'maestria-a',
    title: 'Otro paso',
    body: 'Otro texto',
    highlights: [{ skill_node_slug: 'nodo-b', points: 0 }],
  },
];

describe('purchase progress helpers', () => {
  it('creates a stable guide-scoped key without revision-specific storage', () => {
    expect(progressKey('guía / uno')).toBe('gd:purchase-progress:gu%C3%ADa%20%2F%20uno');
    expect(progressKey('guia-dos')).not.toBe(progressKey('guia-uno'));
  });

  it('hashes the version and every ordered step field deterministically without mutation', () => {
    const before = [...steps];
    const revision = progressRevision('1.2', steps);
    expect(progressRevision('1.2', [...steps].reverse())).toBe(revision);
    expect(progressRevision('1.3', steps)).not.toBe(revision);
    expect(progressRevision('1.2', [{ ...steps[0], body: 'Texto distinto' }, steps[1]])).not.toBe(
      revision,
    );
    expect(
      progressRevision('1.2', [
        steps[0],
        { ...steps[1], highlights: [{ skill_node_slug: 'nodo-b', points: 1 }] },
      ]),
    ).not.toBe(revision);
    expect(steps).toEqual(before);
  });

  it('accepts only bounded exact payloads and returns editorial-order positions', () => {
    const revision = progressRevision('1.2', steps);
    expect(
      validateProgress(
        JSON.stringify({ version: 1, revision, completed: [7, 2] }),
        revision,
        steps,
      ),
    ).toEqual({
      version: 1,
      revision,
      completed: [2, 7],
    });
    expect(
      validateProgress(JSON.stringify({ version: 1, revision, completed: [] }), revision, steps)
        ?.completed,
    ).toEqual([]);
  });

  it('rejects malformed, oversized, stale, duplicated, unknown and extra-key payloads as a whole', () => {
    const revision = progressRevision('1.2', steps);
    const invalid = [
      '{',
      '[]',
      'null',
      'x'.repeat(16 * 1024 + 1),
      JSON.stringify({ version: 2, revision, completed: [2] }),
      JSON.stringify({ version: 1, revision: 'stale', completed: [2] }),
      JSON.stringify({ version: 1, revision, completed: [2, 2] }),
      JSON.stringify({ version: 1, revision, completed: [99] }),
      JSON.stringify({ version: 1, revision, completed: [2], extra: 'ignored?' }),
      JSON.stringify({ version: 1, revision, completed: [0] }),
      JSON.stringify({ version: 1, revision, completed: [2.5] }),
      JSON.stringify({ version: 1, revision, completed: ['2'] }),
      JSON.stringify({ version: 1, revision, completed: [2, 7, 9] }),
      '{"version":1,"revision":"' + revision + '","completed":[],"__proto__":{}}',
    ];
    expect(validateProgress(null, revision, steps)).toBeNull();
    for (const raw of invalid) expect(validateProgress(raw, revision, steps)).toBeNull();
  });
});
