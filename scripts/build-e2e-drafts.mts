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

export function runDraftsBuild(): Promise<number> {
  const ng = createRequire(resolve(webRoot, 'package.json')).resolve('@angular/cli/bin/ng.js');
  return new Promise((done) => {
    const child = spawn(process.execPath, [ng, 'build', '--output-path', '../../dist/e2e-drafts'], {
      cwd: webRoot,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
      env: { ...process.env, INCLUDE_DRAFTS: 'true' },
    });
    child.once('error', () => done(1));
    child.once('exit', (code) => done(code ?? 1));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runDraftsBuild().then((code) => {
    process.exitCode = code;
  });
}
