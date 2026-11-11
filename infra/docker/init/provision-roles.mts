/**
 * Re-applies the idempotent role provisioning hook to an existing local database volume.
 * Passwords stay in Compose secret files; this wrapper passes no secret values to Docker argv.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface ProvisionCommandResult {
  readonly code: number;
  /** Captured only to avoid leaking process output if the caller reports an error. */
  readonly output: string;
}

export interface ProvisionOptions {
  readonly run?: (command: string, args: readonly string[]) => Promise<ProvisionCommandResult>;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const COMMAND = [
  'compose',
  '-f',
  'infra/docker/compose.yaml',
  'exec',
  '-T',
  'db',
  'sh',
  '/docker-entrypoint-initdb.d/001-provision-roles.sh',
] as const;

function runDocker(command: string, args: readonly string[]): Promise<ProvisionCommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawnSync(command, [...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (child.error) reject(new Error('No se pudo ejecutar Docker Compose'));
    else
      resolveResult({
        code: child.status ?? 1,
        output: `${child.stdout ?? ''}${child.stderr ?? ''}`,
      });
  });
}

/** Runs the mounted provisioning script without surfacing its output or any secret contents. */
export async function provisionDatabaseRoles(options: ProvisionOptions = {}): Promise<void> {
  const result = await (options.run ?? runDocker)('docker', COMMAND);
  if (result.code !== 0) throw new Error(`Falló la provisión de roles (código ${result.code})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await provisionDatabaseRoles();
    process.stdout.write('Roles de base de datos aprovisionados.\n');
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Falló la provisión de roles'}\n`,
    );
    process.exitCode = 1;
  }
}
