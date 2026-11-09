import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BuildSchema } from '../src/app/core/content/schema.ts';

export interface ContentFile {
  file: string;
  data: unknown;
}

export interface ContentIssue {
  file: string;
  path: string;
  message: string;
}

/** Validates build documents against BuildSchema. Pure: no I/O. */
export function validateBuildFiles(files: readonly ContentFile[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const { file, data } of files) {
    const result = BuildSchema.safeParse(data);
    if (result.success) continue;
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

function parseDirArg(argv: readonly string[]): string {
  const index = argv.indexOf('--dir');
  return index >= 0 && argv[index + 1] ? argv[index + 1] : 'content';
}

function main(argv: readonly string[]): number {
  const dir = resolve(parseDirArg(argv));
  const buildsDir = join(dir, 'builds');
  if (!existsSync(buildsDir)) {
    console.error(`content:validate FALLÓ: no existe ${buildsDir}`);
    return 1;
  }
  const files = readBuildFiles(buildsDir);
  const issues = validateBuildFiles(files);
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
