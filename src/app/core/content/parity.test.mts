import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { BuildSchema, type Build } from '@gd/domain';
import { createFixtureRepository } from './fixture-source.server.ts';

const root = resolve(import.meta.dirname, '../../../..');
// Golden data comes from the original HTML, independently of the imported build.
const golden = JSON.parse(await readFile(resolve(root, 'e2e/fixtures/original-guide.json'), 'utf8')) as {
  schemaVersion: number;
  source: { path: string; sha256: string; rights_status: string; normalization: string };
  header: { eyebrow: string; title: string; subtitle: string; callout_title: string; callout_body: string[] };
  mastery_roles: { name: string; role: string }[];
  skills: { mastery: string; name_es: string; name_en: string; bar: string; rationale: string; tag: string | null }[];
  omitted: { mastery: string; title: string; detail: string }[];
  skill_legend: string;
  priorities: { label: string; headline: string; detail: string }[];
  purchase_steps: { label: string; title: string; body: string }[];
  note_rows: { label: string; headline: string; detail: string }[];
  loot_columns: { name: string; subtitle: string; rules: { label: string; detail: string }[] }[];
  loot_final: { title: string; body: string };
  guide_rows: { label: string; headline: string; detail: string }[];
  devotion_steps: { label: string; title: string; body: string }[];
  introductions: { section: string; text: string }[];
  footer: string;
};
const slug = 'chaman-demoledor-golpe-primigenio';
const local = createFixtureRepository(resolve(root, 'content'), { INCLUDE_DRAFTS: 'true' });
const guide = BuildSchema.parse(await local.findBuild(slug));

function assertSourceParity(build: Build): void {
  assert.equal(build.eyebrow, golden.header.eyebrow);
  assert.equal(build.title, golden.header.title);
  assert.equal(build.subtitle, golden.header.subtitle);
  assert.equal(build.hero_callout_title, golden.header.callout_title);
  assert.deepEqual(build.hero_callout_body, golden.header.callout_body);
  assert.deepEqual(build.masteries.map((mastery) => ({ name: mastery.name_es, role: mastery.role_text })), golden.mastery_roles);
  assert.equal(build.skill_nodes.length, 14);
  assert.equal(golden.skills.length, 14);
  for (const [index, expected] of golden.skills.entries()) {
    const actual = build.skill_nodes[index]!;
    assert.equal(actual.name_es, expected.name_es);
    assert.equal(actual.name_en, expected.name_en);
    assert.equal(actual.bar_required, Number(expected.bar.replace('barra ', '')));
    assert.equal(actual.rationale, expected.rationale);
    assert.equal(actual.tag, expected.tag);
    assert.equal(build.masteries.find((mastery) => mastery.slug === actual.mastery_slug)?.name_es, expected.mastery);
  }
  for (const group of golden.omitted) {
    assert.ok(build.notes.some((note) => note.label === `Omitir · ${group.mastery}` && note.headline === group.title && note.detail === group.detail));
  }
  assert.ok(build.notes.some((note) => note.detail === golden.skill_legend));
  assert.deepEqual(build.priorities.map((priority) => ({ label: priority.group_label, headline: priority.headline, detail: priority.note })), golden.priorities);
  assert.equal(build.priorities.length, 11);
  assert.deepEqual(build.purchase_steps.map((step) => ({ label: step.threshold_label, title: step.title, body: step.body })), golden.purchase_steps);
  assert.equal(build.purchase_steps.length, 6);
  for (const row of golden.note_rows) {
    assert.ok(build.notes.some((note) => note.label === row.label && note.headline === row.headline && note.detail === row.detail));
  }
  assert.deepEqual(build.loot_filter_columns.map((column) => ({ name: column.name, subtitle: column.subtitle, rules: column.rules.map((rule) => ({ label: rule.label, detail: rule.detail })) })), golden.loot_columns);
  assert.equal(build.loot_filter_columns.length, 4);
  assert.ok(build.notes.some((note) => note.headline === golden.loot_final.title && note.detail === golden.loot_final.body));
  assert.equal(build.guide_npcs.length, 4);
  for (const [index, row] of golden.guide_rows.entries()) {
    if (index < 4) {
      const npc = build.guide_npcs[index]!;
      assert.equal(npc.group_label, row.label);
      assert.equal(`${npc.name} — ${npc.location}`, row.headline);
      assert.equal(npc.detail, row.detail);
    } else {
      assert.ok(build.notes.some((note) => note.label === `Guía Espiritual · ${row.label}` && note.headline === row.headline && note.detail === row.detail));
    }
  }
  assert.deepEqual(build.devotion_steps.map((step) => ({ label: step.label, title: step.title_override, body: step.body })), golden.devotion_steps);
  assert.equal(build.devotion_steps.length, 11);
  for (const intro of golden.introductions) {
    assert.ok(build.notes.some((note) => note.label === intro.section && note.detail === intro.text));
  }
  assert.equal(build.footer_disclaimer, golden.footer);
}

test('golden snapshot identifies the unchanged original local HTML', async () => {
  assert.equal(golden.schemaVersion, 1);
  assert.equal(golden.source.rights_status, 'pending');
  assert.equal(golden.source.path, 'docs/prototipos/elementalista-golpe-primigenio.html');
  assert.equal(golden.source.normalization, 'LF');
  const html = await readFile(resolve(root, golden.source.path), 'utf8');
  assert.equal(createHash('sha256').update(html.replace(/\r\n/g, '\n')).digest('hex'), golden.source.sha256);
});

test('imported guide preserves every source block without inventing two extra NPCs', () => {
  assertSourceParity(guide);
});

test('parity detects missing or changed skills, purchase/devotion steps, notes and source text', () => {
  const changes: ((doc: Build) => void)[] = [
    (doc) => { doc.skill_nodes.pop(); },
    (doc) => { doc.skill_nodes[0]!.name_en = 'Lost translation'; },
    (doc) => { doc.priorities.pop(); },
    (doc) => { doc.purchase_steps.pop(); },
    (doc) => { doc.devotion_steps.pop(); },
    (doc) => { doc.loot_filter_columns[0]!.rules.pop(); },
    (doc) => { doc.guide_npcs[0]!.detail = 'Lost location instructions'; },
    (doc) => { doc.notes = doc.notes.filter((note) => !note.label.startsWith('Omitir')); },
    (doc) => { doc.notes = doc.notes.filter((note) => note.label !== 'Guía Espiritual · Coste'); },
    (doc) => { doc.notes = doc.notes.filter((note) => note.detail !== golden.introductions[0]!.text); },
    (doc) => { doc.hero_callout_body.pop(); },
    (doc) => { doc.footer_disclaimer = 'Lost disclaimer'; },
  ];
  for (const mutate of changes) {
    const changed = structuredClone(guide);
    mutate(changed);
    assert.throws(() => assertSourceParity(changed));
  }
});

test('source remains an unpublishable draft and cannot enter public build or author routes', async () => {
  assert.equal(guide.review_state, 'borrador');
  assert.equal(guide.rights_status, 'pending');
  assert.equal(guide.author.is_placeholder, true);
  assert.equal(guide.game_version, 'Sin confirmar');
  assert.equal(guide.published_at, null);
  assert.equal(BuildSchema.safeParse({ ...guide, review_state: 'publicado' }).success, false);
  assert.ok(guide.devotion_steps.every((step) => step.verification === 'sin_verificar'));
  assert.equal(guide.devotion_steps[5]!.bindings[0]!.skill_node_slug, null);
  assert.equal(guide.purchase_steps[1]!.highlights[0]!.points, null);
  const publicRepo = createFixtureRepository(resolve(root, 'content'), {});
  assert.equal(await publicRepo.findBuild(slug), null);
  assert.equal(await publicRepo.getAuthor('por-confirmar'), null);
  assert.ok(!(await publicRepo.listSlugs()).includes(slug));
});
