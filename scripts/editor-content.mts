import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Result {
  code: number;
  output: string;
  error?: string;
}
interface Options {
  root?: string;
  run?(args: string[]): Result;
  validFile?(path: string): boolean;
  write?(line: string): void;
}
export function editorContainerArguments(
  root: string,
  network: string,
  database: string,
  environment: string,
  kind: string,
  slug: string,
  input: string,
): string[] {
  if (
    !/^[A-Za-z0-9_.-]{1,128}$/.test(network) ||
    !/^[a-z_][a-z0-9_]{0,62}$/.test(database) ||
    !['development', 'test'].includes(environment) ||
    !['build', 'tier-list'].includes(kind) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    /[,\r\n\0]/.test(root + input)
  )
    throw new Error('Invalid editor configuration');
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
  ];
  // On Linux, retain the non-root host identity to read owner-only local input/secrets.
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid !== undefined && uid !== 0 && gid !== undefined) args.push('--user', `${uid}:${gid}`);
  args.push(
    '--env',
    `APP_ENV=${environment}`,
    '--env',
    'DB_HOST=db',
    '--env',
    `POSTGRES_DB=${database}`,
    '--env',
    'DB_USER_EDITOR=editor',
    '--env',
    'DB_PASSWORD_EDITOR_FILE=/run/secrets/db_password_editor',
    '--mount',
    `type=bind,source=${input},target=/run/editor/input.json,readonly`,
    '--mount',
    `type=bind,source=${join(root, 'infra/docker/secrets/db_password_editor.txt')},target=/run/secrets/db_password_editor,readonly`,
    'gd-api:local',
    'node',
    'dist/db/editor.mjs',
    '--kind',
    kind,
    '--slug',
    slug,
    '--file',
    '/run/editor/input.json',
  );
  return args;
}

export function launchEditor(
  env: Readonly<Record<string, string | undefined>>,
  args: string[],
  options: Options = {},
): number {
  const write = options.write ?? console.log;
  if (!['development', 'test'].includes(env['APP_ENV'] ?? '')) {
    write('editor failed: environment');
    return 1;
  }
  const values = new Map<string, string>();
  if (args.length !== 6) {
    write('editor failed: arguments');
    return 1;
  }
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!;
    const value = args[index + 1]!;
    if (!['--kind', '--slug', '--file'].includes(key) || !value || values.has(key)) {
      write('editor failed: arguments');
      return 1;
    }
    values.set(key, value);
  }
  const kind = values.get('--kind')!;
  const slug = values.get('--slug')!;
  if (!['build', 'tier-list'].includes(kind) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    write('editor failed: arguments');
    return 1;
  }
  const root = options.root ?? resolve(import.meta.dirname, '..');
  const input = resolve(values.get('--file')!);
  const run =
    options.run ??
    ((command: string[]) => {
      const result = spawnSync('docker', command, {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      });
      return { code: result.status ?? 1, output: result.stdout ?? '', error: result.stderr ?? '' };
    });
  const validFile =
    options.validFile ??
    ((file: string) => {
      try {
        const stat = lstatSync(file);
        return stat.isFile() && !stat.isSymbolicLink();
      } catch {
        return false;
      }
    });
  try {
    if (!validFile(input) || !validFile(join(root, 'infra/docker/secrets/db_password_editor.txt')))
      throw new Error();
    const compose = ['compose', '-f', join(root, 'infra/docker/compose.yaml')];
    const id = run([...compose, 'ps', '-q', 'db']);
    if (id.code !== 0 || !/^[a-f0-9]{12,64}$/.test(id.output.trim())) throw new Error();
    const metadata = run([
      'inspect',
      '--format',
      '{{json .NetworkSettings.Networks}}',
      id.output.trim(),
    ]);
    if (metadata.code !== 0) throw new Error();
    const networks: unknown = JSON.parse(metadata.output);
    if (
      !networks ||
      typeof networks !== 'object' ||
      Array.isArray(networks) ||
      Object.keys(networks).length !== 1
    )
      throw new Error();
    const database = run([...compose, 'exec', '-T', 'db', 'printenv', 'POSTGRES_DB']);
    if (database.code !== 0) throw new Error();
    const result = run(
      editorContainerArguments(
        root,
        Object.keys(networks)[0]!,
        database.output.trim(),
        env['APP_ENV']!,
        kind,
        slug,
        input,
      ),
    );
    if (
      result.code === 0 &&
      /^editor complete: \d+ builds, \d+ tier lists\s*$/.test(result.output)
    ) {
      write(result.output.trim());
      return 0;
    }
    const safeError =
      /^editor failed: (arguments|invalid-content|dependency-conflict|dependency-missing|role|database-failed|credentials)\s*$/.exec(
        result.error ?? '',
      );
    write(safeError ? `editor failed: ${safeError[1]}` : 'editor failed: local-container');
    return 1;
  } catch {
    write('editor failed: local-container');
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = launchEditor(process.env, process.argv.slice(2));
