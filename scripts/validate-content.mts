import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BuildSchema, MasteryTreeSchema, validateSkillNodeRefs } from '@gd/domain';
import type { MasteryTree } from '@gd/domain';

export interface ContentFile {
  file: string;
  data: unknown;
}

export interface ContentIssue {
  file: string;
  path: string;
  message: string;
}

/** Internal editorial notes: never rendered, so identifiers are allowed there. */
const INTERNAL_TEXT_KEYS = new Set(['rights_notes']);
/** `clave=valor` or a snake_case identifier inside prose (a string with spaces). */
const INTERNAL_KEY_IN_TEXT = /\b[a-z]+(?:_[a-z]+)*=|\b[a-z]+(?:_[a-z]+)+\b/;

/** spec005 T032 (F-15): no visible string may carry internal keys such as `content_status=`. */
function internalKeyIssues(
  value: unknown,
  path: string[],
  key = '',
): { path: string; match: string }[] {
  if (typeof value === 'string')
    return !INTERNAL_TEXT_KEYS.has(key) && /\s/.test(value) && INTERNAL_KEY_IN_TEXT.test(value)
      ? [{ path: path.join('.'), match: INTERNAL_KEY_IN_TEXT.exec(value)![0] }]
      : [];
  if (Array.isArray(value))
    return value.flatMap((item, i) => internalKeyIssues(item, [...path, String(i)], key));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => internalKeyIssues(v, [...path, k], k));
  return [];
}

/**
 * Validates build documents against BuildSchema and, once a document is valid, cross-checks
 * each optional `skill_node_id` against the catalog (spec 003, T016). Pure: no I/O.
 */
export function validateBuildFiles(
  files: readonly ContentFile[],
  catalog: readonly MasteryTree[] = [],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const { file, data } of files) {
    const result = BuildSchema.safeParse(data);
    if (result.success) {
      for (const hit of internalKeyIssues(data, [])) {
        issues.push({
          file,
          path: hit.path,
          message: `texto visible con clave interna «${hit.match}»; usa la etiqueta visible (p. ej. «Sin verificar»)`,
        });
      }
      for (const ref of validateSkillNodeRefs(result.data, catalog)) {
        issues.push({ file, path: ref.path.join('.'), message: ref.message });
      }
      continue;
    }
    for (const issue of result.error.issues) {
      issues.push({
        file,
        path: issue.path.length ? issue.path.join('.') : '(raíz)',
        message: issue.message,
      });
    }
  }
  return issues;
}

/** Reads `<dir>/builds/*.json`. Unparseable JSON becomes a file-level issue. */
function readBuildFiles(buildsDir: string): ContentFile[] {
  return readdirSync(buildsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const file = join('builds', name);
      try {
        return { file, data: JSON.parse(readFileSync(join(buildsDir, name), 'utf8')) };
      } catch (error) {
        return { file, data: { __json_error: String(error) } };
      }
    });
}

/** Same derivation as the extractor (`iconIdOf` in extract-mastery-trees.mts); kept local so validating stays light. */
const iconIdOf = (texturePath: string): string =>
  `ic-${createHash('sha256').update(texturePath).digest('hex').slice(0, 16)}`;

/** Reads `<dir>/mastery-trees/*.json` (optional); an invalid tree is reported as an issue. */
function readCatalog(
  treesDir: string,
  esNames: ReadonlyMap<string, string> = new Map(),
): { catalog: MasteryTree[]; issues: ContentIssue[] } {
  const catalog: MasteryTree[] = [];
  const issues: ContentIssue[] = [];
  if (!existsSync(treesDir)) return { catalog, issues };
  for (const name of readdirSync(treesDir).filter((n) => n.endsWith('.json'))) {
    const file = join('mastery-trees', name);
    try {
      const parsed = MasteryTreeSchema.safeParse(
        JSON.parse(readFileSync(join(treesDir, name), 'utf8')),
      );
      if (parsed.success) {
        catalog.push(parsed.data);
        // spec005 T024 (P31): one ES name per mastery; `masteries.json` is the source, the tree only mirrors it.
        const expected = esNames.get(parsed.data.mastery.name.en);
        if (expected !== undefined && parsed.data.mastery.name.es !== expected)
          issues.push({
            file,
            path: 'mastery.name.es',
            message: `«${parsed.data.mastery.name.es}» difiere del nombre ES de masteries.json («${expected}»)`,
          });
        // spec004 T025: the public icon id is derived from the texture, never typed by hand.
        for (const node of parsed.data.nodes) {
          if (node.icon !== undefined && node.icon_id !== iconIdOf(node.icon))
            issues.push({
              file,
              path: `nodes.${node.id}.icon_id`,
              message: `icon_id de ${node.id} no es el derivado de su textura (ic-<16 hex de sha256>)`,
            });
        }
      } else
        issues.push({
          file,
          path: '(raíz)',
          message: 'árbol de catálogo inválido (ver pnpm catalog:nodes)',
        });
    } catch (error) {
      issues.push({ file, path: '(raíz)', message: String(error) });
    }
  }
  return { catalog, issues };
}

/** `name_en` → `name_es` from `<dir>/masteries.json` (optional); the single source of ES mastery names. */
function readEsNames(dir: string): Map<string, string> {
  const names = new Map<string, string>();
  const file = join(dir, 'masteries.json');
  if (!existsSync(file)) return names;
  try {
    const list: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(list))
      for (const item of list as { name_en?: unknown; name_es?: unknown }[])
        if (typeof item.name_en === 'string' && typeof item.name_es === 'string')
          names.set(item.name_en, item.name_es);
  } catch {
    // an unreadable masteries.json is reported by the catalog generator, not here
  }
  return names;
}

function parseDirArg(argv: readonly string[]): string {
  const index = argv.indexOf('--dir');
  return index >= 0 && argv[index + 1] ? argv[index + 1] : 'fixtures/content';
}

function main(argv: readonly string[]): number {
  const dir = resolve(parseDirArg(argv));
  const buildsDir = join(dir, 'builds');
  if (!existsSync(buildsDir)) {
    console.error(`content:validate FALLÓ: no existe ${buildsDir}`);
    return 1;
  }
  const files = readBuildFiles(buildsDir);
  const { catalog, issues: catalogIssues } = readCatalog(
    join(dir, 'mastery-trees'),
    readEsNames(dir),
  );
  const issues = [...catalogIssues, ...validateBuildFiles(files, catalog)];
  if (issues.length === 0) {
    console.log(`content:validate OK (${files.length} builds en ${buildsDir})`);
    return 0;
  }
  for (const i of issues) {
    console.error(`${i.file}: ${i.path}: ${i.message}`);
  }
  console.error(`content:validate FALLÓ (${issues.length} problemas)`);
  return 1;
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  process.exitCode = main(process.argv.slice(2));
}
