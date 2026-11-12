import type { PublicBuild } from '@gd/domain';

type PurchaseStep = PublicBuild['purchase_steps'][number];

export interface PurchaseProgress {
  version: 1;
  revision: string;
  completed: number[];
}

export function progressKey(slug: string): string {
  return `gd:purchase-progress:${encodeURIComponent(slug)}`;
}

export function progressRevision(gameVersion: string, steps: readonly PurchaseStep[]): string {
  const canonical = JSON.stringify([
    gameVersion,
    [...steps]
      .sort((a, b) => a.position - b.position)
      .map((step) => [
        step.position,
        step.threshold_label,
        step.mastery_slug,
        step.title,
        step.body,
        step.highlights.map((highlight) => [highlight.skill_node_slug, highlight.points]),
      ]),
  ]);

  // FNV-1a over UTF-16 code units: a deterministic revision marker, not a security hash.
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index++) {
    hash = Math.imul(hash ^ canonical.charCodeAt(index), 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function validateProgress(
  raw: string | null,
  expectedRevision: string,
  steps: readonly PurchaseStep[],
): PurchaseProgress | null {
  if (typeof raw !== 'string' || raw.length > 16 * 1024) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }

  const keys = Object.keys(value);
  if (
    keys.length !== 3 ||
    !keys.every((key) => key === 'version' || key === 'revision' || key === 'completed')
  ) {
    return null;
  }
  const payload = value as Record<string, unknown>;
  if (
    payload['version'] !== 1 ||
    payload['revision'] !== expectedRevision ||
    !Array.isArray(payload['completed']) ||
    payload['completed'].length > steps.length
  ) {
    return null;
  }

  const positions = new Set(steps.map((step) => step.position));
  if (
    positions.size !== steps.length ||
    [...positions].some((position) => !Number.isSafeInteger(position) || position <= 0)
  ) {
    return null;
  }
  const completed = new Set<number>();
  for (const position of payload['completed']) {
    if (
      typeof position !== 'number' ||
      !Number.isSafeInteger(position) ||
      !positions.has(position) ||
      completed.has(position)
    ) {
      return null;
    }
    completed.add(position);
  }

  return {
    version: 1,
    revision: expectedRevision,
    completed: [...positions].filter((position) => completed.has(position)).sort((a, b) => a - b),
  };
}
