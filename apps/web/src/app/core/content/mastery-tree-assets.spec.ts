import { describe, expect, it, vi } from 'vitest';
import type { PublicBuild } from '@gd/domain';
import shamanRaw from '../../../../../../fixtures/content/mastery-trees/shaman.json';
import {
  assignmentMasteryId,
  createMasteryTreeAssets,
  MASTERY_TREES_BASE,
} from './mastery-tree-assets';

type SkillNode = PublicBuild['skill_nodes'][number];
const node = (skillNodeId?: string): SkillNode =>
  ({
    slug: 'x',
    mastery_slug: 'chaman',
    skill_node_id: skillNodeId,
  }) as SkillNode;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('assignmentMasteryId (which canonical tree a guide mastery draws on)', () => {
  it('returns the mastery id shared by every node of the slot', () => {
    expect(assignmentMasteryId([node('class06/a'), node('class06/b')])).toBe('class06');
  });

  it.each([
    ['no nodes', []],
    ['a node without reference', [node('class06/a'), node(undefined)]],
    ['ids from two masteries', [node('class06/a'), node('class02/b')]],
    ['a reference with no mastery prefix', [node('plain')]],
  ])('returns null for %s (the guide mode stays)', (_name, nodes) => {
    expect(assignmentMasteryId(nodes as SkillNode[])).toBeNull();
  });
});

describe('createMasteryTreeAssets (own static files, same origin)', () => {
  it('reads the index and the tree, validated, from /assets/mastery-trees/', async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `${MASTERY_TREES_BASE}index.json`) return response({ class06: 'shaman' });
      if (url === `${MASTERY_TREES_BASE}shaman.json`) return response(shamanRaw);
      return response({}, 404);
    });
    const assets = createMasteryTreeAssets(request as unknown as typeof fetch);
    const trees = await assets.load(['class06']);
    expect(trees.get('class06')?.mastery.slug).toBe('shaman');
    expect(trees.get('class06')?.nodes.length).toBe(shamanRaw.nodes.length);
    expect(request).toHaveBeenCalledTimes(2);
    expect(
      (request.mock.calls as unknown as [unknown, RequestInit?][]).every(
        ([, init]) => init?.credentials === 'omit',
      ),
    ).toBe(true);
    await assets.load(['class06']);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects when a file is missing, malformed or describes another mastery', async () => {
    const cases: Record<string, (url: string) => Response> = {
      'index 404': () => response({}, 404),
      'unknown id': (url) => response(url.endsWith('index.json') ? { other: 'x' } : {}),
      'tree 503': (url) =>
        url.endsWith('index.json') ? response({ class06: 'shaman' }) : response({}, 503),
      'tree of another slug': (url) =>
        url.endsWith('index.json')
          ? response({ class06: 'shaman' })
          : response({ ...shamanRaw, mastery: { ...shamanRaw.mastery, slug: 'other' } }),
      'broken tree': (url) =>
        url.endsWith('index.json')
          ? response({ class06: 'shaman' })
          : response({ mastery: shamanRaw.mastery, nodes: [{ id: 1 }] }),
    };
    for (const [name, answer] of Object.entries(cases)) {
      const assets = createMasteryTreeAssets((async (input: RequestInfo | URL) =>
        answer(String(input))) as typeof fetch);
      await expect(assets.load(['class06']), name).rejects.toThrow();
    }
  });

  it('rejects on a network error', async () => {
    const assets = createMasteryTreeAssets((async () => {
      throw new TypeError('network');
    }) as typeof fetch);
    await expect(assets.load(['class06'])).rejects.toThrow();
  });
});
