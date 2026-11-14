// Spec 003, T018: adds `skill_node_id` to every `skill_nodes[]` entry of a guide by matching the
// node's `name_en` (normalized) against the catalog tree of the same mastery. Fails on any node
// without exactly one match; never guesses. Rewrites only by inserting lines (SC-007).
//   tsx scripts/migrate-skill-node-ids.mts [--dir fixtures/content] [--check]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MasteryTreeSchema } from '@gd/domain';
import type { MasteryTree } from '@gd/domain';

interface GuideLike {
  masteries: { slug: string; name_en: string }[];
  skill_nodes: { slug: string; mastery_slug: string; name_en: string }[];
}
export interface NodeMatch {
  slug: string;
  mastery_slug: string;
  skill_node_id: string;
}

const norm = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** Pure: pairs each guide node with one catalog node, or reports why it could not. */
export function matchSkillNodes(
  guide: GuideLike,
  catalog: readonly MasteryTree[],
): { matches: NodeMatch[]; problems: string[] } {
  const matches: NodeMatch[] = [];
  const problems: string[] = [];
  for (const node of guide.skill_nodes) {
    const mastery = guide.masteries.find((m) => m.slug === node.mastery_slug);
    const tree = catalog.find(
      (t) =>
        t.mastery.slug === node.mastery_slug ||
        (mastery !== undefined && norm(t.mastery.name.en) === norm(mastery.name_en)),
    );
    const label = `${node.mastery_slug}/${node.slug} («${node.name_en}»)`;
    if (!tree) {
      problems.push(`${label}: maestría sin árbol en el catálogo`);
      continue;
    }
    const found = tree.nodes.filter((n) => norm(n.name.en) === norm(node.name_en));
    if (found.length === 0) problems.push(`${label}: sin correspondencia en ${tree.mastery.id}`);
    else if (found.length > 1)
      problems.push(`${label}: ambigua, coincide con ${found.map((n) => n.id).join(', ')}`);
    else
      matches.push({
        slug: node.slug,
        mastery_slug: node.mastery_slug,
        skill_node_id: found[0]!.id,
      });
  }
  return { matches, problems };
}

/**
 * Inserts `"skill_node_id": "..."` right after the `mastery_slug` line of each matched node,
 * keeping every other byte (indent and EOL included). Idempotent.
 */
export function addSkillNodeIds(text: string, matches: readonly NodeMatch[]): string {
  let out = text;
  for (const m of matches) {
    const re = new RegExp(
      `("slug": "${m.slug}",(\r?\n)([ \t]*)"mastery_slug": "${m.mastery_slug}",)(?!\r?\n[ \t]*"skill_node_id")`,
    );
    out = out.replace(re, `$1$2$3"skill_node_id": "${m.skill_node_id}",`);
  }
  return out;
}

function main(argv: readonly string[]): number {
  const i = argv.indexOf('--dir');
  const dir = resolve(i >= 0 && argv[i + 1] ? argv[i + 1]! : 'fixtures/content');
  const check = argv.includes('--check');
  const treesDir = join(dir, 'mastery-trees');
  const catalog = readdirSync(treesDir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => MasteryTreeSchema.parse(JSON.parse(readFileSync(join(treesDir, n), 'utf8'))));
  let failed = false;
  for (const name of readdirSync(join(dir, 'builds')).filter((n) => n.endsWith('.json'))) {
    const path = join(dir, 'builds', name);
    const text = readFileSync(path, 'utf8');
    const { matches, problems } = matchSkillNodes(JSON.parse(text) as GuideLike, catalog);
    for (const m of matches)
      console.log(`${name}: ${m.mastery_slug}/${m.slug} -> ${m.skill_node_id}`);
    for (const p of problems) console.error(`${name}: ${p}`);
    if (problems.length) {
      failed = true;
      continue;
    }
    const out = addSkillNodeIds(text, matches);
    if (check) {
      if (out !== text) {
        console.error(`${name}: faltan skill_node_id (ejecuta sin --check)`);
        failed = true;
      }
    } else if (out !== text) writeFileSync(path, out);
  }
  return failed ? 1 : 0;
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) process.exitCode = main(process.argv.slice(2));
