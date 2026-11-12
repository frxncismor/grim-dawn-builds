import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const repository = fileURLToPath(new URL('../', import.meta.url));
const resolvePackage = createRequire(import.meta.url);
type Execute = (entry: string, args: readonly string[]) => Promise<number>;
const execute: Execute = (entry, args) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: repository,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
      env: { ...process.env, NG_BUILD_MAX_WORKERS: '2', CONTENT_SOURCE: 'fixture' },
    });
    child.once('error', () => done(1));
    child.once('exit', (code) => done(code ?? 1));
  });

export async function runSvgE2E(args: readonly string[], run: Execute = execute): Promise<number> {
  const tsc = resolvePackage.resolve('typescript/bin/tsc');
  const ng = resolvePackage.resolve('@angular/cli/bin/ng.js');
  const prerequisites: [string, string[]][] = [
    [tsc, ['-p', 'packages/domain/tsconfig.build.json']],
    [tsc, ['-p', 'tsconfig.e2e.json']],
    [ng, ['build', '--configuration', 'skill-tree-preview']],
    [ng, ['build', '--configuration', 'devotion-map-preview']],
  ];
  for (const [entry, command] of prerequisites) {
    const code = await run(entry, command);
    if (code !== 0) return code;
  }
  return run(resolvePackage.resolve('@playwright/test/cli'), [
    'test',
    '--config=playwright.svg.config.ts',
    ...args,
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSvgE2E(process.argv.slice(2).filter((arg, index) => index !== 0 || arg !== '--'))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.error('No se pudo verificar los SVG.');
      process.exitCode = 1;
    });
}
