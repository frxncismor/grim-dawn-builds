import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import demolitionRaw from '../../../../../../../fixtures/content/mastery-trees/demolition.json';
import shamanRaw from '../../../../../../../fixtures/content/mastery-trees/shaman.json';
import guideRaw from '../../../../../../../fixtures/content/builds/chaman-demoledor-golpe-primigenio.json';
import {
  MASTERY_TREE_ASSETS,
  type MasteryTreeAssets,
} from '../../../core/content/mastery-tree-assets';
import type { BuildPageContent, SkillTreeSlot } from '../build.page';
import { BuildSkills } from './build-skills';

const content = guideRaw as unknown as BuildPageContent;
const trees = new Map<string, MasteryTree>([
  ['class06', MasteryTreeSchema.parse(shamanRaw)],
  ['class02', MasteryTreeSchema.parse(demolitionRaw)],
]);

function slotsOf(nodes = content.skill_nodes): SkillTreeSlot[] {
  return content.masteries.map((mastery, index) => ({
    treeId: `guide-tree-${index}`,
    mastery,
    nodes: nodes.filter((node) => node.mastery_slug === mastery.slug),
  }));
}

async function render(
  slots: SkillTreeSlot[],
  load: MasteryTreeAssets['load'],
  platform: 'browser' | 'server' = 'browser',
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: platform },
      { provide: MASTERY_TREE_ASSETS, useValue: { load } },
    ],
  });
  const fixture = TestBed.createComponent(BuildSkills);
  fixture.componentRef.setInput('slots', slots);
  fixture.componentRef.setInput('activeIds', []);
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('gd-build-skills (guide on the canonical trees, T017)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows a status while the trees load', async () => {
    const { root } = await render(slotsOf(), () => new Promise(() => undefined));
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    expect(root.querySelector('gd-skill-tree')).toBeNull();
  });

  it('draws two canonical trees with the 14 assigned nodes of the guide', async () => {
    const load = vi.fn(async () => trees as ReadonlyMap<string, MasteryTree>);
    const { fixture, root } = await render(slotsOf(), load);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(load).toHaveBeenCalledTimes(1);
    expect([...(load.mock.calls[0] as unknown as [string[]])[0]].sort()).toEqual([
      'class02',
      'class06',
    ]);
    const rendered = root.querySelectorAll('gd-skill-tree');
    expect(rendered).toHaveLength(2);
    expect(root.querySelector('[role="status"]')).toBeNull();
    expect(rendered[0].querySelectorAll('[data-skill-id]')).toHaveLength(
      trees.get('class06')!.nodes.length,
    );
    expect(rendered[1].querySelectorAll('[data-skill-id]')).toHaveLength(
      trees.get('class02')!.nodes.length,
    );
    expect(root.querySelectorAll('[data-skill-id][data-assigned="true"]')).toHaveLength(14);
    expect(rendered[0].querySelectorAll('[data-assigned="true"][data-skill-id]')).toHaveLength(9);
    expect(rendered[1].querySelectorAll('[data-assigned="true"][data-skill-id]')).toHaveLength(5);
  });

  it('keeps the guide mode for a mastery with an unreferenced node and still draws the other', async () => {
    const nodes = content.skill_nodes.map((node, index) =>
      index === 0 ? { ...node, skill_node_id: undefined } : node,
    );
    const load = vi.fn(async () => trees as ReadonlyMap<string, MasteryTree>);
    const { fixture, root } = await render(slotsOf(nodes), load);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(load).toHaveBeenCalledWith(['class02']);
    const rendered = root.querySelectorAll('gd-skill-tree');
    expect(rendered).toHaveLength(2);
    expect(rendered[0].querySelectorAll('[data-assigned]')).toHaveLength(0);
    expect(rendered[0].querySelectorAll('[data-skill-id]')).toHaveLength(9);
    expect(rendered[1].querySelectorAll('[data-skill-id][data-assigned="true"]')).toHaveLength(5);
  });

  it('requests nothing and keeps the guide mode when no node has a reference', async () => {
    const nodes = content.skill_nodes.map((node) => ({ ...node, skill_node_id: undefined }));
    const load = vi.fn(async () => trees as ReadonlyMap<string, MasteryTree>);
    const { fixture, root } = await render(slotsOf(nodes), load);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(load).not.toHaveBeenCalled();
    expect(root.querySelector('[role="status"]')).toBeNull();
    expect(root.querySelectorAll('gd-skill-tree')).toHaveLength(2);
    expect(root.querySelectorAll('[data-assigned]')).toHaveLength(0);
    expect(root.querySelectorAll('[data-skill-id]')).toHaveLength(14);
  });

  it('falls back to the guide mode if the static files cannot be read', async () => {
    const { fixture, root } = await render(slotsOf(), async () => {
      throw new Error('mastery-trees');
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')).toBeNull();
    expect(root.querySelectorAll('gd-skill-tree')).toHaveLength(2);
    expect(root.querySelectorAll('[data-assigned]')).toHaveLength(0);
    expect(root.querySelectorAll('[data-skill-id]')).toHaveLength(14);
  });

  it('never requests anything on the server', async () => {
    const load = vi.fn(async () => trees as ReadonlyMap<string, MasteryTree>);
    const { root } = await render(slotsOf(), load, 'server');
    expect(load).not.toHaveBeenCalled();
    expect(root.querySelectorAll('gd-skill-tree')).toHaveLength(2);
  });
});
