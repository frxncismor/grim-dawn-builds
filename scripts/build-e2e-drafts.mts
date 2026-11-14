import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/**
 * Builds the local drafts artifact into `dist/e2e-drafts` (T-171).
 * Portable (Windows PowerShell and Linux CI): sets INCLUDE_DRAFTS without relying on
 * shell syntax and runs the Angular CLI from `apps/web`, where the workspace lives (T-067).
 */
const repository = fileURLToPath(new URL('../', import.meta.url));
const webRoot = resolve(repository, 'apps', 'web');

export interface DraftsStep {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
}

function spawnStep(step: DraftsStep): Promise<number> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [...step.args], {
      cwd: step.cwd,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
      env: step.env,
    });
    child.once('error', () => done(1));
    child.once('exit', (code) => done(code ?? 1));
  });
}

/**
 * Angular build and then `emit-static-assets` (mastery trees, `deferred.css`, portraits), the
 * same post-build step as `pnpm build` (C-002): without it the drafts shell 404s on `deferred.css`.
 * The runner is injected so the sequence can be tested without launching processes.
 */
export async function runDraftsBuild(
  run: (step: DraftsStep) => Promise<number> = spawnStep,
): Promise<number> {
  const env = { ...process.env, INCLUDE_DRAFTS: 'true' };
  const ng = createRequire(resolve(webRoot, 'package.json')).resolve('@angular/cli/bin/ng.js');
  const built = await run({
    args: [ng, 'build', '--output-path', '../../dist/e2e-drafts'],
    cwd: webRoot,
    env,
  });
  if (built !== 0) return built;
  return run({
    args: [
      '--import',
      'tsx',
      resolve(webRoot, 'tools', 'emit-static-assets.mts'),
      '--dir',
      resolve(repository, 'dist', 'e2e-drafts'),
    ],
    cwd: repository,
    env,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runDraftsBuild().then((code) => {
    process.exitCode = code;
  });
}
