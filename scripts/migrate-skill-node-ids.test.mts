import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MasteryTreeSchema, BuildSchema } from '@gd/domain';
import { addSkillNodeIds, matchSkillNodes } from './migrate-skill-node-ids.mts';

const load = (path: string): string =>
  readFileSync(new URL(`../fixtures/content/${path}`, import.meta.url), 'utf8');
const catalog = ['shaman', 'demolition'].map((s) =>
  MasteryTreeSchema.parse(JSON.parse(load(`mastery-trees/${s}.json`))),
);
const guideText = load('builds/chaman-demoledor-golpe-primigenio.json');

test('the fixture guide declares a skill_node_id on every skill_node (T018)', () => {
  const guide = BuildSchema.parse(JSON.parse(guideText));
  assert.ok(guide.skill_nodes.length > 0);
  for (const node of guide.skill_nodes)
    assert.ok(node.skill_node_id, `${node.slug} sin skill_node_id`);
});

test('matchSkillNodes maps by normalized name_en inside the same mastery', () => {
  const guide = JSON.parse(guideText);
  const { matches, problems } = matchSkillNodes(guide, catalog);
  assert.deepEqual(problems, []);
  assert.equal(matches.length, guide.skill_nodes.length);
  assert.equal(
    matches.find((m) => m.slug === 'golpe-primigenio')?.skill_node_id,
    'class06/savagestrike1',
  );
});

test('matchSkillNodes reports no-match and ambiguous nodes instead of guessing', () => {
  const guide = JSON.parse(guideText);
  guide.skill_nodes[0].name_en = 'Nope';
  const dup = structuredClone(catalog);
  dup[1]!.nodes[1] = {
    ...dup[1]!.nodes[1]!,
    name: { ...dup[1]!.nodes[1]!.name, en: dup[1]!.nodes[3]!.name.en },
  };
  const { problems } = matchSkillNodes(guide, dup);
  assert.ok(problems.some((p) => /golpe-primigenio.*sin correspondencia/.test(p)));
  assert.ok(problems.some((p) => /ambigu/.test(p)));
});

test('addSkillNodeIds only adds skill_node_id lines and is idempotent', () => {
  const guide = JSON.parse(guideText);
  const { matches } = matchSkillNodes(guide, catalog);
  const bare = guideText.replace(/^[ \t]*"skill_node_id".*\r?\n/gm, '');
  const out = addSkillNodeIds(bare, matches);
  const before = bare.split(/\r?\n/);
  const added = out.split(/\r?\n/).filter((l) => !before.includes(l) || /skill_node_id/.test(l));
  assert.equal(out.split(/\r?\n/).length - before.length, matches.length);
  assert.ok(added.every((l) => /"skill_node_id": "class\d\d\//.test(l)));
  assert.equal(addSkillNodeIds(out, matches), out);
});
