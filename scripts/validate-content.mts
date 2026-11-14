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

/** Reads `<dir>/mastery-trees/*.json` (optional); an invalid tree is reported as an issue. */
function readCatalog(treesDir: string): { catalog: MasteryTree[]; issues: ContentIssue[] } {
  const catalog: MasteryTree[] = [];
  const issues: ContentIssue[] = [];
  if (!existsSync(treesDir)) return { catalog, issues };
  for (const name of readdirSync(treesDir).filter((n) => n.endsWith('.json'))) {
    const file = join('mastery-trees', name);
    try {
      const parsed = MasteryTreeSchema.safeParse(
        JSON.parse(readFileSync(join(treesDir, name), 'utf8')),
      );
      if (parsed.success) catalog.push(parsed.data);
      else
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
  const { catalog, issues: catalogIssues } = readCatalog(join(dir, 'mastery-trees'));
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
