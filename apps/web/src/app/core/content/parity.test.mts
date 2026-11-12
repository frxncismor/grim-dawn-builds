import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { BuildSchema, type Build } from '@gd/domain';
import { createFixtureRepository } from './fixture-source.server.ts';

const root = resolve(import.meta.dirname, '../../../../../../');
// Golden data comes from the original local prototype. Only factual game data
// is compared: the published guide must not reuse its editorial prose.
const golden = JSON.parse(
  await readFile(resolve(root, 'e2e/fixtures/original-guide.json'), 'utf8'),
) as {
  schemaVersion: number;
  source: { path: string; sha256: string; rights_status: string; normalization: string };
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
    callout_title: string;
    callout_body: string[];
  };
  mastery_roles: { name: string; role: string }[];
  skills: {
    mastery: string;
    name_es: string;
    name_en: string;
    bar: string;
    rationale: string;
    tag: string | null;
  }[];
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
const guideJson = JSON.stringify(guide);

const factualConstellations = [
  'eel',
  'empty-throne',
  'lizard',
  'tempest',
  'scholars-light',
  'rhowans-crown',
  'ghoul',
  'kraken',
  'ultos',
  null,
  null,
];

/** Factual parity: the same game data the local prototype recorded, nothing editorial. */
function assertFactualParity(build: Build): void {
  assert.equal(build.title, golden.header.title);
  assert.deepEqual(
    build.masteries.map((mastery) => ({ name: mastery.name_es, slug: mastery.slug })),
    [
      { name: golden.mastery_roles[0]!.name, slug: 'chaman' },
      { name: golden.mastery_roles[1]!.name, slug: 'demoledor' },
    ],
  );
  assert.equal(build.skill_nodes.length, golden.skills.length);
  for (const [index, expected] of golden.skills.entries()) {
    const actual = build.skill_nodes[index]!;
    assert.equal(actual.name_es, expected.name_es);
    assert.equal(actual.name_en, expected.name_en);
    assert.equal(actual.bar_required, Number(expected.bar.replace('barra ', '')));
    assert.equal(actual.tag, expected.tag);
    assert.equal(
      build.masteries.find((mastery) => mastery.slug === actual.mastery_slug)?.name_es,
      expected.mastery,
    );
  }
  assert.equal(build.priorities.length, golden.priorities.length);
  assert.deepEqual(
    build.priorities.map((priority) => priority.rank),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, null, null],
  );
  assert.equal(build.purchase_steps.length, golden.purchase_steps.length);
  assert.deepEqual(
    build.purchase_steps.map((step) => step.threshold_label),
    golden.purchase_steps.map((step) => step.label),
  );
  assert.equal(build.loot_filter_columns.length, golden.loot_columns.length);
  assert.deepEqual(
    build.loot_filter_columns.map((column) => column.rules.map((rule) => rule.action)),
    [
      ['desmarcar', 'marcar'],
      ['marcar', 'desmarcar'],
      ['marcar', 'desmarcar', 'aviso'],
      ['marcar'],
    ],
  );
  assert.deepEqual(
    build.loot_filter_columns.map((column) => column.rules.length),
    golden.loot_columns.map((column) => column.rules.length),
  );
  assert.equal(build.guide_npcs.length, 4);
  for (const [index, row] of golden.guide_rows.slice(0, 4).entries()) {
    const npc = build.guide_npcs[index]!;
    assert.equal(npc.group_label, row.label);
    assert.equal(`${npc.name} — ${npc.location}`, row.headline);
  }
  assert.deepEqual(
    build.devotion_steps.map((step) => step.constellation_slug),
    factualConstellations,
  );
  assert.equal(build.constellations.length, 13);
  assert.deepEqual(
    build.devotion_steps.flatMap((step) => step.bindings.map((binding) => binding.power_en)).sort(),
    ['Ghoul', 'Behemoth', 'Elemental Storm', 'Hand of Ultos', 'Reckless Tempest'].sort(),
  );
}

/** Every editorial string of the prototype must have been replaced by own text. */
function assertOwnEditorialText(build: Build): void {
  const replacements: [string, string][] = [
    [build.eyebrow, golden.header.eyebrow],
    [build.subtitle, golden.header.subtitle],
    [build.hero_callout_title, golden.header.callout_title],
    [build.footer_disclaimer, golden.footer],
  ];
  for (const [actual, original] of replacements) assert.notEqual(actual, original);
  for (const [index, expected] of golden.skills.entries()) {
    assert.notEqual(build.skill_nodes[index]!.rationale, expected.rationale);
  }
  for (const [index, expected] of golden.priorities.entries()) {
    // Headlines may be the factual skill name; the editorial note must be own text.
    assert.notEqual(build.priorities[index]!.note, expected.detail);
  }
  for (const [index, expected] of golden.purchase_steps.entries()) {
    assert.notEqual(build.purchase_steps[index]!.title, expected.title);
    assert.notEqual(build.purchase_steps[index]!.body, expected.body);
  }
  for (const [index, expected] of golden.devotion_steps.entries()) {
    assert.notEqual(build.devotion_steps[index]!.body, expected.body);
  }
  for (const [index, expected] of golden.loot_columns.entries()) {
    const column = build.loot_filter_columns[index]!;
    assert.notEqual(column.subtitle, expected.subtitle);
    for (const [ruleIndex, rule] of expected.rules.entries()) {
      assert.notEqual(column.rules[ruleIndex]!.detail, rule.detail);
    }
  }
  for (const [index, expected] of golden.guide_rows.slice(0, 4).entries()) {
    assert.notEqual(build.guide_npcs[index]!.detail, expected.detail);
  }
  assert.equal(build.hero_callout_body.length, golden.header.callout_body.length);
  assert.notDeepEqual(build.hero_callout_body, golden.header.callout_body);
  for (const row of golden.note_rows) assert.ok(!guideJson.includes(row.detail));
  for (const intro of golden.introductions) assert.ok(!guideJson.includes(intro.text));
  assert.ok(!guideJson.includes(golden.loot_final.body));
}

test('golden snapshot identifies the unchanged original local prototype', async () => {
  assert.equal(golden.schemaVersion, 1);
  assert.equal(golden.source.rights_status, 'pending');
  assert.equal(golden.source.path, 'docs/prototipos/elementalista-golpe-primigenio.html');
  assert.equal(golden.source.normalization, 'LF');
  const html = await readFile(resolve(root, golden.source.path), 'utf8');
  assert.equal(
    createHash('sha256').update(html.replace(/\r\n/g, '\n')).digest('hex'),
    golden.source.sha256,
  );
});

test('published guide keeps every factual data point of the local prototype', () => {
  assertFactualParity(guide);
});

test('published guide replaces every editorial string with own text', () => {
  assertOwnEditorialText(guide);
});

test('factual parity detects missing or changed skills, priorities, steps, NPCs and devotions', () => {
  const changes: ((doc: Build) => void)[] = [
    (doc) => {
      doc.skill_nodes.pop();
    },
    (doc) => {
      doc.skill_nodes[0]!.name_en = 'Lost translation';
    },
    (doc) => {
      doc.skill_nodes[1]!.bar_required = 11;
    },
    (doc) => {
      doc.priorities.pop();
    },
    (doc) => {
      doc.priorities[0]!.rank = 2;
    },
    (doc) => {
      doc.purchase_steps.pop();
    },
    (doc) => {
      doc.purchase_steps[0]!.threshold_label = 'Otra barra';
    },
    (doc) => {
      doc.devotion_steps.pop();
    },
    (doc) => {
      doc.devotion_steps[0]!.constellation_slug = 'lizard';
    },
    (doc) => {
      doc.guide_npcs[0]!.location = 'Otro sitio';
    },
    (doc) => {
      doc.constellations.pop();
    },
  ];
  for (const mutate of changes) {
    const changed = structuredClone(guide);
    mutate(changed);
    assert.throws(() => assertFactualParity(changed));
  }
});

test('guide is published as own content with internal provenance and no third-party source', async () => {
  assert.equal(guide.review_state, 'publicado');
  assert.equal(guide.rights_status, 'own_original');
  assert.equal(guide.content_status, 'sin_verificar');
  assert.equal(guide.author_slug, 'grim-dawn-builds');
  assert.equal(guide.author.is_placeholder, false);
  assert.equal(guide.published_at, '2026-11-12');
  assert.equal(guide.rights_confirmed_by, 'Paco');
  assert.equal(guide.rights_confirmed_on, '2026-11-12');
  assert.ok(guide.rights_notes?.includes('Contenido propio'));
  assert.equal(guide.sources.length, 1);
  const source = guide.sources[0]!;
  assert.equal(source.slug, 'guia-original');
  assert.equal(source.kind, 'original');
  assert.equal(source.url, null);
  assert.equal(source.author_name, 'Grim Dawn Builds');
  assert.equal(source.permission_ref, null);
  assert.match(source.notes, /Claude Code/);
  assert.equal(BuildSchema.safeParse({ ...guide, rights_status: 'pending' }).success, false);

  const publicRepo = createFixtureRepository(resolve(root, 'content'), {});
  const publicGuide = await publicRepo.findBuild(slug);
  assert.ok(publicGuide);
  assert.ok((await publicRepo.listSlugs()).includes(slug));
  assert.equal((await publicRepo.getAuthor('grim-dawn-builds'))?.slug, 'grim-dawn-builds');
  assert.equal(await publicRepo.getAuthor('por-confirmar'), null);
  assert.doesNotMatch(
    JSON.stringify(publicGuide),
    /rights_notes|rights_confirmed|reviewed_by|permission_ref|is_placeholder/,
  );
});
