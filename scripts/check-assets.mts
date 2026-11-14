import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkAssetManifest, type AssetIssue } from '@gd/domain';

const WEB_PUBLIC_DIR = 'apps/web/public';
const OFFICIAL_SUBDIR = 'assets';
const MANIFEST = 'fixtures/content/assets/manifest.json';

/** Lists every file under the official-art folder, as repo-relative POSIX paths. */
function listOfficialFiles(root: string): string[] {
  const publicRoot = join(root, WEB_PUBLIC_DIR);
  const dir = join(publicRoot, OFFICIAL_SUBDIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(
      (entry) =>
        `public/${relative(publicRoot, join(entry.parentPath, entry.name)).split('\\').join('/')}`,
    );
}

/** sha256 of every official file, keyed by the same repo-relative path the manifest uses. */
function hashFiles(root: string, files: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    files.map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(join(root, 'apps/web', file)))
        .digest('hex'),
    ]),
  );
}

/** Pure of console output: returns the manifest size and every problem found. */
export function checkAssets(root: string): { count: number; issues: AssetIssue[] } {
  let manifest: { assets: unknown[] };
  try {
    manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8')) as { assets: unknown[] };
    if (!Array.isArray(manifest.assets)) throw new Error();
  } catch {
    return { count: 0, issues: [{ file: MANIFEST, message: 'manifiesto ilegible o inválido' }] };
  }
  const files = listOfficialFiles(root);
  return {
    count: manifest.assets.length,
    issues: checkAssetManifest(manifest, files, hashFiles(root, files)),
  };
}

function main(root: string): number {
  const { count, issues } = checkAssets(root);
  if (issues.length === 0) {
    console.log(`assets:check OK (${count} entradas)`);
    return 0;
  }
  for (const i of issues) {
    console.error(`${i.file ?? MANIFEST}${i.path ? `: ${i.path}` : ''}: ${i.message}`);
  }
  console.error(`assets:check FALLÓ (${issues.length} problemas)`);
  return 1;
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  process.exitCode = main(resolve('.'));
}
