import { createPublicBuildEnv } from './public-build-env.mts';
import { assertPublicBuild, sensitiveValues } from './check-public-build.mts';
import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  contentFingerprint,
  expectedMigration,
  probeReleaseApi,
  publicApiUrl,
  verifyRelease,
  type ReleaseInfo,
} from './check-release.mts';
import { measureInitialRoutes } from './check-initial-js.mts';
import { finalizeStaticHome } from './static-home.mts';

type Environment = Readonly<Record<string, string | undefined>>;
export function publicBuildEnv(input: Environment): Record<string, string> {
  return createPublicBuildEnv(input, 'release');
}

interface BuildDependencies {
  request?: typeof fetch;
  build?: (output: string, env: Record<string, string>) => Promise<void>;
}

export async function runRelease(
  root: string,
  env: Environment,
  dependencies: BuildDependencies = {},
): Promise<ReleaseInfo> {
  const dist = resolve(root, 'dist');
  await mkdir(dist, { recursive: true });
  if ((await lstat(dist)).isSymbolicLink()) throw new Error('Directorio de release inválido.');
  const report = join(dist, 'build-info.json');
  await rm(report, { force: true });
  if (
    env['CONTENT_SOURCE'] !== 'api' ||
    (env['INCLUDE_DRAFTS'] !== undefined && env['INCLUDE_DRAFTS'] !== 'false')
  )
    throw new Error('Release exige CONTENT_SOURCE=api explícito y sin borradores.');
  const migration = await expectedMigration(root);
  const base = publicApiUrl(env['API_BASE_URL'] ?? 'http://127.0.0.1:3000').href;
  await probeReleaseApi(base, migration, dependencies.request);
  const staging = await mkdtemp(join(dist, '.release-'));
  try {
    const childEnv = publicBuildEnv({ ...env, API_BASE_URL: base });
    const build =
      dependencies.build ??
      (async (output: string, environment: Record<string, string>) => {
        await new Promise<void>((resolveBuild, reject) => {
          const child = spawn(
            process.execPath,
            [join(root, 'node_modules/@angular/cli/bin/ng.js'), 'build', '--output-path', output],
            { cwd: root, env: environment, stdio: 'inherit', windowsHide: true, shell: false },
          );
          child.once('error', () => reject(new Error('Build de release falló.')));
          child.once('exit', (code) =>
            code === 0 ? resolveBuild() : reject(new Error('Build de release falló.')),
          );
        });
      });
    await build(staging, childEnv);
    await assertPublicBuild(staging, sensitiveValues(env));
    await finalizeStaticHome(staging);
    const budgets = await measureInitialRoutes(staging);
    if (budgets.some((budget) => budget.totalGzipBytes > budget.limitBytes))
      throw new Error('Presupuesto JavaScript excedido.');
    const browser = join(staging, 'browser');
    const info: ReleaseInfo = {
      source: 'api',
      migration,
      builtAt: new Date().toISOString(),
      contentHash: await contentFingerprint(browser),
    };
    const reportText = `${JSON.stringify(info, null, 2)}\n`;
    await verifyRelease(info, browser, migration);
    await assertPublicBuild(dist, sensitiveValues(env), [reportText]);
    await probeReleaseApi(base, migration, dependencies.request);
    const target = join(dist, 'grim-dawn-builds');
    // Both recursive operations are bounded to this run's verified dist directory.
    if (
      dirname(target) !== dist ||
      dirname(staging) !== dist ||
      !basename(staging).startsWith('.release-')
    )
      throw new Error('Destino de release inválido.');
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
    const pending = join(dist, `.build-info-${basename(staging)}.tmp`);
    await writeFile(pending, reportText, { flag: 'wx' });
    await rename(pending, report);
    return info;
  } finally {
    if (dirname(staging) !== dist || !basename(staging).startsWith('.release-'))
      throw new Error('Limpieza de release inválida.');
    await rm(staging, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  try {
    if (process.argv.length !== 2) throw new Error();
    await runRelease(resolve(import.meta.dirname, '..'), process.env);
    console.log('build:release OK (API, migración y artefacto verificados).');
    return 0;
  } catch {
    console.error(
      'build:release FALLÓ: se requiere API ready, migración esperada y build público válido.',
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
