import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, statSync } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GITLEAKS_VERSION = '8.30.1';
interface Asset {
  url: string;
  sha256: string;
  binary: string;
}
const origin = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/`;
export function selectGitleaksAsset(
  platform: string = process.platform,
  arch: string = process.arch,
): Asset {
  if (arch !== 'x64') throw new Error('setup:gitleaks unsupported-platform');
  if (platform === 'win32')
    return {
      url: `${origin}gitleaks_8.30.1_windows_x64.zip`,
      sha256: 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e',
      binary: 'gitleaks.exe',
    };
  if (platform === 'linux')
    return {
      url: `${origin}gitleaks_8.30.1_linux_x64.tar.gz`,
      sha256: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
      binary: 'gitleaks',
    };
  throw new Error('setup:gitleaks unsupported-platform');
}
export function verifyGitleaksArchive(bytes: Buffer, expected: string): void {
  if (
    !/^[a-f0-9]{64}$/.test(expected) ||
    createHash('sha256').update(bytes).digest('hex') !== expected
  )
    throw new Error('setup:gitleaks checksum-mismatch');
}
interface Operations {
  download?(url: string): Promise<Buffer>;
  extract?(archive: string, folder: string, binary: string): Promise<void>;
  version?(binary: string): string;
}
const nativeVersion = (binary: string): string => {
  const result = spawnSync(binary, ['version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
  });
  return result.status === 0 ? result.stdout.trim() : '';
};

/** Fixed official asset in the CLI; a parameter permits offline installer verification. */
export async function installGitleaksAsset(
  repo: string,
  asset: Asset,
  operations: Operations = {},
): Promise<string> {
  if (!asset.url.startsWith(origin) || !['gitleaks', 'gitleaks.exe'].includes(asset.binary))
    throw new Error('setup:gitleaks invalid-asset');
  const root = await realpath(resolve(repo));
  let folder = root;
  for (const part of ['.tools', 'gitleaks', GITLEAKS_VERSION]) {
    folder = join(folder, part);
    try {
      await mkdir(folder);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
        throw new Error('setup:gitleaks invalid-path');
    }
    const stat = await lstat(folder);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error('setup:gitleaks invalid-path');
  }
  const stage = await mkdtemp(join(folder, '.install-'));
  try {
    const download =
      operations.download ??
      (async (url: string): Promise<Buffer> => {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (
          !response.ok ||
          !response.body ||
          Number(response.headers.get('content-length')) > 64 * 1024 * 1024
        )
          throw new Error('setup:gitleaks download-failed');
        const chunks: Uint8Array[] = [];
        let length = 0;
        for await (const chunk of response.body) {
          length += chunk.length;
          if (length > 64 * 1024 * 1024) throw new Error('setup:gitleaks archive-too-large');
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      });
    const bytes = await download(asset.url);
    verifyGitleaksArchive(bytes, asset.sha256);
    const archive = join(stage, basename(new URL(asset.url).pathname));
    await writeFile(archive, bytes, { flag: 'wx' });
    const extracted = join(stage, 'native');
    await mkdir(extracted);
    const extract =
      operations.extract ??
      (async (file: string, target: string, binary: string) => {
        const result = spawnSync('tar', ['-xf', file, '-C', target, binary], {
          stdio: 'ignore',
          windowsHide: true,
          timeout: 30000,
        });
        if (result.status !== 0) throw new Error('setup:gitleaks extraction-failed');
      });
    await extract(archive, extracted, asset.binary);
    const candidate = join(extracted, asset.binary);
    const stat = await lstat(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('setup:gitleaks invalid-binary');
    await chmod(candidate, 0o755);
    if ((operations.version ?? nativeVersion)(candidate) !== GITLEAKS_VERSION)
      throw new Error('setup:gitleaks version-mismatch');
    const target = join(folder, asset.binary);
    if (existsSync(target)) {
      const old = await lstat(target);
      if (!old.isFile() || old.isSymbolicLink()) throw new Error('setup:gitleaks invalid-path');
    }
    await rename(candidate, target);
    return target;
  } finally {
    if (dirname(stage) !== folder || !basename(stage).startsWith('.install-'))
      throw new Error('setup:gitleaks invalid-cleanup');
    await rm(stage, { recursive: true, force: true });
  }
}

/** Same resolution order as the hook: local native binary, then PATH, exact version. */
export function findGitleaks(
  root: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  const binary = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
  const local = resolve(root, '.tools/gitleaks', GITLEAKS_VERSION, binary);
  if (existsSync(local))
    return !lstatSync(local).isSymbolicLink() && nativeVersion(local) === GITLEAKS_VERSION
      ? local
      : undefined;
  const path = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  for (const entry of path.split(delimiter).filter(Boolean)) {
    const file = resolve(entry, binary);
    try {
      if (statSync(file).isFile() && nativeVersion(file) === GITLEAKS_VERSION) return file;
    } catch {
      /* Continue PATH lookup without exposing filesystem details. */
    }
  }
  return undefined;
}
async function main(): Promise<number> {
  try {
    if (process.argv.length !== 2) throw new Error();
    await installGitleaksAsset(resolve(import.meta.dirname, '..'), selectGitleaksAsset());
    console.log(`setup:gitleaks OK (${GITLEAKS_VERSION}; SHA-256 verificado; instalación local).`);
    return 0;
  } catch {
    console.error(
      'setup:gitleaks FALLÓ: revisar plataforma, descarga HTTPS, SHA-256 y herramienta tar.',
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
