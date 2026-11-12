import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkAssetManifest } from '@gd/domain';

const WEB_PUBLIC_DIR = 'apps/web/public';
const OFFICIAL_SUBDIR = 'assets';
const MANIFEST = 'content/assets/manifest.json';

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

function main(root: string): number {
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8')) as {
    assets: unknown[];
  };
  const issues = checkAssetManifest(manifest, listOfficialFiles(root));
  if (issues.length === 0) {
    console.log(`assets:check OK (${manifest.assets.length} entradas)`);
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
