import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isSecretName, scanFiles } from './check-secrets.mts';
import { createPublicBuildEnv } from './public-build-env.mts';
import { finalizeStaticHome } from './static-home.mts';

type Environment = Readonly<Record<string, string | undefined>>;
class PublicBuildError extends Error {
  constructor(
    readonly code: 'sensitive-value' | 'secret-pattern' | 'unsafe-artifact' | 'build-failed',
  ) {
    super(`public-build: ${code}`);
    this.name = 'PublicBuildError';
  }
}
export function createCanaryEnvironment(env: Environment): Record<string, string | undefined> {
  const canaries = Object.fromEntries(
    [
      'POSTGRES_PASSWORD',
      'DB_PASSWORD_MIGRATOR',
      'DB_PASSWORD_IMPORTER',
      'DB_PASSWORD_EDITOR',
      'DB_PASSWORD_API_RO',
      'CI_TOKEN',
      'DEPLOY_TOKEN',
      'SIGNING_KEY',
      'UNLISTED_APPLICATION_SECRET',
    ].map((name) => [name, `gd-canary-${randomBytes(24).toString('hex')}`]),
  );
  return { ...env, ...canaries };
}
export function sensitiveValues(env: Environment): string[] {
  return [
    ...new Set(
      Object.entries(env)
        .filter(
          ([key, value]) =>
            value !== undefined &&
            value !== '' &&
            (isSecretName(key) || key.toUpperCase().endsWith('_FILE')),
        )
        .map(([, value]) => value!),
    ),
  ];
}

/** No extension/path exclusions: scan every generated name and byte, including binary files. */
export async function assertPublicBuild(
  folder: string,
  values: readonly string[],
  extraText: readonly string[] = [],
): Promise<{ files: number }> {
  try {
    const needles = [
      ...new Set(
        values
          .filter(Boolean)
          .flatMap((value) => [
            value,
            JSON.stringify(value).slice(1, -1),
            encodeURIComponent(value),
            Buffer.from(value).toString('base64'),
            Buffer.from(value).toString('base64url'),
          ]),
      ),
    ].map((value) => Buffer.from(value));
    needles.push(...values.filter(Boolean).map((value) => Buffer.from(value, 'utf16le')));
    let files = 0;
    const check = (bytes: Buffer): void => {
      if (needles.some((needle) => bytes.includes(needle)))
        throw new PublicBuildError('sensitive-value');
      if (scanFiles(['artifact.txt'], () => bytes.toString('utf8')).length)
        throw new PublicBuildError('secret-pattern');
    };
    const walk = async (path: string, name: string): Promise<void> => {
      check(Buffer.from(name));
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new PublicBuildError('unsafe-artifact');
      if (stat.isDirectory()) {
        for (const entry of (await readdir(path)).sort())
          await walk(join(path, entry), name ? `${name}/${entry}` : entry);
      } else if (stat.isFile()) {
        check(await readFile(path));
        files++;
      } else throw new PublicBuildError('unsafe-artifact');
    };
    await walk(folder, '');
    if (!files) throw new PublicBuildError('unsafe-artifact');
    for (const text of extraText) check(Buffer.from(text));
    return { files };
  } catch (error) {
    if (error instanceof PublicBuildError) throw error;
    // Filesystem errors may contain a filename carrying the very value being detected.
    throw new PublicBuildError('unsafe-artifact');
  }
}

interface Dependencies {
  build?(output: string, env: Record<string, string>): Promise<void>;
}
export async function runPublicBuildCheck(
  root: string,
  input: Environment,
  dependencies: Dependencies = {},
): Promise<{ files: number }> {
  const dist = resolve(root, 'dist');
  await mkdir(dist, { recursive: true });
  if ((await lstat(dist)).isSymbolicLink()) throw new PublicBuildError('unsafe-artifact');
  const output = await mkdtemp(join(dist, '.public-check-'));
  try {
    const source = createCanaryEnvironment(input);
    const watched = [...sensitiveValues(input), ...sensitiveValues(source)];
    const environment = createPublicBuildEnv(source, 'fixture');
    const webRoot = join(root, 'apps', 'web');
    const build =
      dependencies.build ??
      (async (directory: string, env: Record<string, string>) => {
        await new Promise<void>((done, reject) => {
          const child = spawn(
            process.execPath,
            [
              join(webRoot, 'node_modules/@angular/cli/bin/ng.js'),
              'build',
              '--output-path',
              directory,
            ],
            { cwd: webRoot, env, stdio: 'ignore', windowsHide: true, shell: false },
          );
          child.once('error', () => reject(new PublicBuildError('build-failed')));
          child.once('exit', (code) =>
            code === 0 ? done() : reject(new PublicBuildError('build-failed')),
          );
        });
        await assertPublicBuild(directory, watched);
        await finalizeStaticHome(directory);
      });
    try {
      await build(output, environment);
    } catch {
      throw new PublicBuildError('build-failed');
    }
    const report = join(dist, 'build-info.json');
    const extra: string[] = [];
    try {
      const stat = await lstat(report);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new PublicBuildError('unsafe-artifact');
      extra.push(await readFile(report, 'utf8'));
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
        throw new PublicBuildError('unsafe-artifact');
    }
    await assertPublicBuild(output, watched, extra);
    return await assertPublicBuild(dist, watched);
  } finally {
    if (dirname(output) !== dist || !basename(output).startsWith('.public-check-'))
      throw new PublicBuildError('unsafe-artifact');
    try {
      await rm(output, { recursive: true, force: true });
    } catch {
      throw new PublicBuildError('unsafe-artifact');
    }
  }
}
async function main(): Promise<number> {
  try {
    if (process.argv.length !== 2) throw new PublicBuildError('build-failed');
    const result = await runPublicBuildCheck(resolve(import.meta.dirname, '..'), process.env);
    console.log(`check:public-build OK (${result.files} archivos; valores y patrones ausentes).`);
    return 0;
  } catch (error) {
    console.error(
      `check:public-build FALLÓ (${error instanceof PublicBuildError ? error.code : 'invalid-environment'}).`,
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
