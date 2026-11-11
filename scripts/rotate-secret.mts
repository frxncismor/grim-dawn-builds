import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROLES = ['migrator', 'api_ro', 'importer', 'editor'] as const;
type Role = (typeof ROLES)[number];
type Version = 'old' | 'new';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
class RotationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'RotationError';
  }
}
function roleOf(value: string): Role {
  if (!ROLES.includes(value as Role)) throw new RotationError('role');
  return value as Role;
}
export interface RotationOps {
  preflight(): Promise<{ wasLogin: boolean }>;
  begin(): Promise<void>;
  password(version: Version): Promise<void>;
  login(enabled: boolean): Promise<void>;
  persist(version: Version): Promise<void>;
  restartApi(): Promise<void>;
  verify(version: Version, accepted: boolean): Promise<void>;
  finish(): Promise<void>;
}

/** Protocol independent of Docker/filesystem; errors never retain child output or secret causes. */
export async function rotateCredential(
  value: string,
  activate: boolean,
  ops: RotationOps,
): Promise<void> {
  const role = roleOf(value);
  let wasLogin: boolean;
  try {
    ({ wasLogin } = await ops.preflight());
  } catch {
    throw new RotationError('preflight');
  }
  if (!wasLogin && !activate) throw new RotationError('activation-required');
  try {
    await ops.begin();
  } catch {
    throw new RotationError('journal');
  }
  let phase = 'password';
  try {
    await ops.password('new');
    phase = 'login';
    if (!wasLogin) await ops.login(true);
    phase = 'persist';
    await ops.persist('new');
    phase = 'consumer';
    if (role === 'api_ro') await ops.restartApi();
    phase = 'new-authentication';
    await ops.verify('new', true);
    phase = 'old-authentication';
    await ops.verify('old', false);
  } catch {
    try {
      await ops.password('old');
      await ops.login(wasLogin);
      await ops.persist('old');
      if (role === 'api_ro' && wasLogin) await ops.restartApi();
      await ops.verify('old', wasLogin);
      await ops.finish();
    } catch {
      throw new RotationError('recovery-required');
    }
    throw new RotationError(`rotation-failed:${phase}`);
  }
  try {
    await ops.finish();
  } catch {
    throw new RotationError('cleanup-required');
  }
}

export async function recoverCredential(value: string, ops: RotationOps): Promise<void> {
  const role = roleOf(value);
  try {
    const { wasLogin } = await ops.preflight();
    await ops.begin();
    await ops.password('old');
    await ops.login(wasLogin);
    await ops.persist('old');
    if (role === 'api_ro' && wasLogin) await ops.restartApi();
    await ops.verify('old', wasLogin);
    await ops.finish();
  } catch {
    throw new RotationError('recovery-required');
  }
}

interface Journal {
  role: Role;
  old: string;
  new: string;
  wasLogin: boolean;
}
const SAFE_SECRET = /^[A-Za-z0-9_-]{20,128}$/;
const COMPOSE = ['compose', '-f', 'infra/docker/compose.yaml'];
const PSQL = 'exec psql --no-psqlrc -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"';
function docker(
  root: string,
  args: string[],
  input?: string,
): { code: number; output: string; error: string } {
  const result = spawnSync('docker', [...COMPOSE, ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  return { code: result.status ?? 1, output: result.stdout ?? '', error: result.stderr ?? '' };
}
function writeDurable(path: string, value: string): void {
  const fd = openSync(path, 'wx', 0o600);
  try {
    writeFileSync(fd, value);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function replaceFile(path: string, value: string): void {
  const temp = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    writeDurable(temp, value);
    renameSync(temp, path);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}
function assignment(text: string, key: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.startsWith(`${key}=`));
  if (lines.length !== 1) throw new RotationError('environment-field');
  const raw = lines[0]!.slice(key.length + 1).trim();
  return /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
}
function ignoredFile(root: string, path: string, required: boolean): void {
  const result = spawnSync('git', ['check-ignore', '--quiet', path], {
    cwd: root,
    windowsHide: true,
  });
  if (result.status !== 0) throw new RotationError('not-ignored');
  if (!existsSync(path)) {
    if (required) throw new RotationError('missing-file');
    return;
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new RotationError('unsafe-file');
}

/** Local privileged credential manager. The seed itself never calls administrative commands. */
export function createLocalRotationOps(role: Role, recovery: boolean, root = ROOT): RotationOps {
  roleOf(role);
  const dir = join(root, 'infra/docker/secrets');
  const envPath = join(root, 'infra/docker/.env');
  const key = `DB_PASSWORD_${role.toUpperCase()}`;
  const secretPath = join(dir, `${key.toLowerCase()}.txt`);
  const journalPath = join(dir, `.rotation-${role}.json`);
  const lockPath = join(dir, '.rotation.lock');
  let journal: Journal;
  let locked = false;
  const sql = (command: string) => {
    const result = docker(root, [
      'exec',
      '-T',
      'db',
      'sh',
      '-c',
      `${PSQL} -Atc "$1"`,
      'rotation',
      command,
    ]);
    if (result.code !== 0) throw new RotationError('database');
    return result.output.trim();
  };
  const loginState = () => {
    const state = sql(
      `SELECT CASE WHEN rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls THEN 'privileged' WHEN rolcanlogin THEN 'login' ELSE 'nologin' END FROM pg_roles WHERE rolname='${role}'`,
    );
    if (!['login', 'nologin'].includes(state)) throw new RotationError('role-state');
    return state === 'login';
  };
  const checkPaths = () => {
    if (
      realpathSync(dir) !== resolve(dir) ||
      realpathSync(dirname(envPath)) !== resolve(dirname(envPath))
    )
      throw new RotationError('unsafe-directory');
    for (const path of [envPath, secretPath]) ignoredFile(root, path, true);
    for (const path of [journalPath, lockPath]) ignoredFile(root, path, false);
  };
  const current = () => {
    const value = readFileSync(secretPath, 'utf8').trim();
    if (!SAFE_SECRET.test(value) || assignment(readFileSync(envPath, 'utf8'), key) !== value)
      throw new RotationError('credential-mismatch');
    return value;
  };
  const verifyCredential = (value: string, accepted: boolean) => {
    const probe =
      'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql --no-psqlrc -h db -U "$1" -d "$POSTGRES_DB" -Atqc "SELECT 1"';
    const result = docker(
      root,
      ['exec', '-T', 'db', 'sh', '-c', probe, 'rotation', role],
      `${value}\n`,
    );
    if (
      accepted
        ? result.code !== 0 || result.output.trim() !== '1'
        : result.code === 0 ||
          !/password authentication failed|not permitted to log in/i.test(result.error)
    )
      throw new RotationError('authentication');
  };
  return {
    async preflight() {
      checkPaths();
      if (recovery) {
        let raw: unknown;
        try {
          raw = JSON.parse(readFileSync(journalPath, 'utf8'));
        } catch {
          throw new RotationError('journal');
        }
        const record = raw as Partial<Journal> | null;
        if (
          !record ||
          record.role !== role ||
          typeof record.old !== 'string' ||
          typeof record.new !== 'string' ||
          !SAFE_SECRET.test(record.old) ||
          !SAFE_SECRET.test(record.new) ||
          record.old === record.new ||
          typeof record.wasLogin !== 'boolean'
        )
          throw new RotationError('journal');
        journal = record as Journal;
        loginState();
      } else {
        if (ROLES.some((name) => existsSync(join(dir, `.rotation-${name}.json`))))
          throw new RotationError('pending-recovery');
        journal = {
          role,
          old: current(),
          new: randomBytes(24).toString('base64url'),
          wasLogin: loginState(),
        };
        if (journal.old === journal.new) throw new RotationError('entropy');
        if (journal.wasLogin) verifyCredential(journal.old, true);
      }
      return { wasLogin: journal.wasLogin };
    },
    async begin() {
      if (recovery && existsSync(lockPath)) {
        let holder: { pid?: unknown; role?: unknown };
        try {
          holder = JSON.parse(readFileSync(lockPath, 'utf8'));
        } catch {
          throw new RotationError('lock');
        }
        if (holder.role !== role || !Number.isInteger(holder.pid) || Number(holder.pid) <= 0)
          throw new RotationError('lock');
        try {
          process.kill(Number(holder.pid), 0);
          throw new RotationError('live-lock');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
            throw new RotationError('live-lock');
        }
        unlinkSync(lockPath);
      }
      writeDurable(lockPath, JSON.stringify({ role, pid: process.pid }));
      locked = true;
      try {
        if (!recovery) {
          if (current() !== journal.old || loginState() !== journal.wasLogin)
            throw new RotationError('preflight-changed');
          writeDurable(journalPath, JSON.stringify(journal));
        }
      } catch {
        unlinkSync(lockPath);
        locked = false;
        throw new RotationError('journal');
      }
    },
    async password(version) {
      const result = docker(
        root,
        ['exec', '-T', 'db', 'sh', '-c', `${PSQL} -c "$1"`, 'rotation', `\\password ${role}`],
        `${journal[version]}\n${journal[version]}\n`,
      );
      if (result.code !== 0) throw new RotationError('password');
    },
    async login(enabled) {
      sql(`ALTER ROLE ${role} ${enabled ? 'LOGIN' : 'NOLOGIN'}`);
    },
    async persist(version) {
      checkPaths();
      const text = readFileSync(envPath, 'utf8');
      const existing = assignment(text, key);
      if (![journal.old, journal.new].includes(existing))
        throw new RotationError('environment-changed');
      const next = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${journal[version]}`);
      const fd = openSync(secretPath, 'w', 0o600);
      try {
        writeFileSync(fd, journal[version]);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      replaceFile(envPath, next);
    },
    async restartApi() {
      if (docker(root, ['up', '-d', '--no-deps', '--force-recreate', 'api']).code !== 0)
        throw new RotationError('consumer');
      const probe =
        "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))";
      for (let i = 0; i < 20; i++) {
        if (docker(root, ['exec', '-T', 'api', 'node', '-e', probe]).code === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new RotationError('consumer');
    },
    async verify(version, accepted) {
      verifyCredential(journal[version], accepted);
    },
    async finish() {
      if (!locked) throw new RotationError('lock');
      unlinkSync(journalPath);
      unlinkSync(lockPath);
      locked = false;
    },
  };
}

export async function runRotation(
  argv: readonly string[],
  write = { out: console.log, err: console.error },
): Promise<number> {
  try {
    const role = roleOf(argv[0] ?? '');
    if (
      argv.slice(1).some((flag) => !['--activate', '--recover'].includes(flag)) ||
      (argv.includes('--activate') && argv.includes('--recover'))
    )
      throw new RotationError('arguments');
    const recover = argv.includes('--recover');
    const ops = createLocalRotationOps(role, recover);
    if (recover) await recoverCredential(role, ops);
    else await rotateCredential(role, argv.includes('--activate'), ops);
    write.out(`credential ${recover ? 'recovered' : 'rotated'}: ${role}`);
    return 0;
  } catch (error) {
    write.err(
      `credential operation failed: ${error instanceof RotationError ? error.code : 'local-operation'}`,
    );
    return 1;
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  process.exitCode = await runRotation(process.argv.slice(2));
