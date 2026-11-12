import { pathToFileURL } from 'node:url';
import { launchContentImport, type Options } from './seed-content.mts';
export function launchBootstrap(
  env: Readonly<Record<string, string | undefined>>,
  options: Options = {},
): number {
  return launchContentImport('bootstrap', env, options);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) {
    console.error('bootstrap failed: arguments');
    process.exitCode = 1;
  } else process.exitCode = launchBootstrap(process.env);
}
