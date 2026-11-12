import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
interface Result {
  code: number;
  output: string;
  error?: string;
}
export interface Options {
  root?: string;
  run?: (args: string[]) => Result;
  validPath?: (path: string, kind: 'file' | 'directory') => boolean;
  write?: (line: string) => void;
}

/** Public configuration and mount paths only; never reads or transports a password value. */
export function contentContainerArguments(
  operation: 'seed' | 'bootstrap',
  root: string,
  network: string,
  database: string,
  appEnv: string,
): string[] {
  if (
    !/^[A-Za-z0-9_.-]{1,128}$/.test(network) ||
    !/^[a-z_][a-z0-9_]{0,62}$/.test(database) ||
    !['development', 'test'].includes(appEnv) ||
    !['seed', 'bootstrap'].includes(operation)
  )
    throw new Error('Invalid public seed configuration');
  const args = [
    'run',
    '--rm',
    '--pull',
    'never',
    '--network',
    network,
    '--read-only',
    '--tmpfs',
    '/tmp',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--memory',
    '256m',
    '--memory-swap',
    '256m',
    '--cpus',
    '0.5',
    '--pids-limit',
    '100',
    '--env',
    `APP_ENV=${appEnv}`,
    '--env',
    'DB_HOST=db',
    '--env',
    `POSTGRES_DB=${database}`,
    '--env',
    'DB_USER_IMPORTER=importer',
    '--env',
    'DB_PASSWORD_IMPORTER_FILE=/run/secrets/db_password_importer',
    '--mount',
    `type=bind,source=${join(root, 'content')},target=/content,readonly`,
    '--mount',
    `type=bind,source=${join(root, 'infra/docker/secrets/db_password_importer.txt')},target=/run/secrets/db_password_importer,readonly`,
    'gd-api:local',
    'node',
    `dist/db/${operation}.mjs`,
  ];
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid !== undefined && uid !== 0 && gid !== undefined)
    args.splice(1, 0, '--user', `${uid}:${gid}`);
  return args;
}

export function launchContentImport(
  operation: 'seed' | 'bootstrap',
  env: Readonly<Record<string, string | undefined>>,
  options: Options = {},
): number {
  const write = options.write ?? console.log;
  const appEnv = env['APP_ENV'];
  if (appEnv !== 'development' && appEnv !== 'test') {
    write(`${operation} failed: environment`);
    return 1;
  }
  const root = options.root ?? ROOT;
  const run =
    options.run ??
    ((args: string[]) => {
      const result = spawnSync('docker', args, {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      });
      return { code: result.status ?? 1, output: result.stdout ?? '', error: result.stderr ?? '' };
    });
  const validPath =
    options.validPath ??
    ((path, kind) => {
      try {
        const stat = lstatSync(path);
        return !stat.isSymbolicLink() && (kind === 'file' ? stat.isFile() : stat.isDirectory());
      } catch {
        return false;
      }
    });
  try {
    if (
      !validPath(join(root, 'content'), 'directory') ||
      !validPath(join(root, 'infra/docker/secrets/db_password_importer.txt'), 'file')
    )
      throw new Error('Seed input unavailable');
    const compose = ['compose', '-f', join(root, 'infra/docker/compose.yaml')];
    const id = run([...compose, 'ps', '-q', 'db']);
    if (id.code !== 0 || !/^[a-f0-9]{12,64}$/.test(id.output.trim()))
      throw new Error('Database unavailable');
    const network = run([
      'inspect',
      '--format',
      '{{json .NetworkSettings.Networks}}',
      id.output.trim(),
    ]);
    if (network.code !== 0) throw new Error('Network unavailable');
    let networks: unknown;
    try {
      networks = JSON.parse(network.output);
    } catch {
      throw new Error('Invalid metadata');
    }
    if (
      !networks ||
      typeof networks !== 'object' ||
      Array.isArray(networks) ||
      Object.keys(networks).length !== 1
    )
      throw new Error('Ambiguous network');
    const database = run([...compose, 'exec', '-T', 'db', 'printenv', 'POSTGRES_DB']);
    if (database.code !== 0) throw new Error('Database configuration unavailable');
    const result = run(
      contentContainerArguments(
        operation,
        root,
        Object.keys(networks)[0]!,
        database.output.trim(),
        appEnv,
      ),
    );
    if (
      result.code !== 0 ||
      !new RegExp('^' + operation + ' complete: \\d+ builds, \\d+ tier lists\\s*$').test(
        result.output,
      )
    ) {
      const code = new RegExp(
        '^' +
          operation +
          ' failed: (invalid-content|role|already|not-empty|migration|credentials|database-failed|bootstrapped)\\s*$',
      ).exec(result.error ?? '');
      if (code) {
        write(`${operation} failed: ${code[1]}`);
        return 1;
      }
      throw new Error('Seed failed');
    }
    write(result.output.trim());
    return 0;
  } catch {
    write(`${operation} failed: local-container`);
    return 1;
  }
}
export function seedContainerArguments(
  root: string,
  network: string,
  database: string,
  appEnv: string,
): string[] {
  return contentContainerArguments('seed', root, network, database, appEnv);
}
export function launchSeed(
  env: Readonly<Record<string, string | undefined>>,
  options: Options = {},
): number {
  return launchContentImport('seed', env, options);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.length > 2) {
    console.error('seed failed: arguments');
    process.exitCode = 1;
  } else process.exitCode = launchSeed(process.env);
}
