import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalRotationOps, recoverCredential, rotateCredential } from './rotate-secret.mts';

const repo = join(import.meta.dirname, '..');
const pgImage = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(repo, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const apiImage = process.env['ROTATION_API_IMAGE'] ?? 'gd-api:t082-review';
const suite = process.env['RUN_ROTATION_TESTS'] === '1' ? describe : describe.skip;
const tempBase = realpathSync(tmpdir());
let work: string | undefined;
const secrets = new Map<string, string>();
function command(exe: string, args: string[], input?: string): number {
  return (
    spawnSync(exe, args, {
      cwd: work ?? repo,
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
    }).status ?? 1
  );
}
function compose(args: string[], input?: string): number {
  return command('docker', ['compose', '-f', 'infra/docker/compose.yaml', ...args], input);
}
function sql(text: string): string {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      'infra/docker/compose.yaml',
      'exec',
      '-T',
      'db',
      'psql',
      '--no-psqlrc',
      '-U',
      'postgres',
      '-d',
      'gd_rotation_test',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '-',
    ],
    { cwd: work!, input: text, encoding: 'utf8', windowsHide: true, timeout: 30000 },
  );
  if (result.status !== 0) throw new Error('Rotation fixture SQL failed');
  return result.stdout.trim();
}
function auth(role: string, value: string): number {
  const probe =
    'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -h db -U "$1" -d "$POSTGRES_DB" -Atqc "SELECT 1"';
  return compose(['exec', '-T', 'db', 'sh', '-c', probe, 'probe', role], `${value}\n`);
}

suite('local credential rotation with SCRAM and the real API image (T-082)', () => {
  beforeAll(async () => {
    if (!pgImage || !/@sha256:[a-f0-9]{64}$/.test(pgImage))
      throw new Error('Pinned PostgreSQL image required');
    for (const image of [pgImage, apiImage]) {
      if (command('docker', ['image', 'inspect', image]) !== 0)
        throw new Error('Rotation fixture images must be built/pulled before the test');
    }
    work = mkdtempSync(join(tempBase, 'gd-rotation-int-'));
    mkdirSync(join(work, 'infra/docker/secrets'), { recursive: true });
    expect(command('git', ['init', '--quiet'])).toBe(0);
    writeFileSync(join(work, '.gitignore'), 'infra/docker/.env\ninfra/docker/secrets/\n');
    const env: string[] = [];
    for (const role of ['postgres', 'migrator', 'api_ro', 'importer', 'editor']) {
      const value = randomBytes(24).toString('base64url');
      secrets.set(role, value);
      const key = role === 'postgres' ? 'POSTGRES_PASSWORD' : `DB_PASSWORD_${role.toUpperCase()}`;
      writeFileSync(join(work, `infra/docker/secrets/${key.toLowerCase()}.txt`), value);
      env.push(`${key}=${value}`);
    }
    writeFileSync(join(work, 'infra/docker/.env'), env.join('\n') + '\n');
    const secretEntries = ['postgres_password', 'db_password_migrator', 'db_password_api_ro']
      .map((name) => `  ${name}:\n    file: ./secrets/${name}.txt`)
      .join('\n');
    writeFileSync(
      join(work, 'infra/docker/compose.yaml'),
      `name: gd-rotation-${process.pid}-${randomBytes(4).toString('hex')}
services:
  db:
    image: ${pgImage}
    environment:
      POSTGRES_DB: gd_rotation_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
      POSTGRES_HOST_AUTH_METHOD: scram-sha-256
    secrets: [postgres_password, db_password_api_ro]
    tmpfs: [/var/lib/postgresql/data]
    mem_limit: 512m
  migrate:
    image: ${apiImage}
    command: [node, dist/db/migrate.mjs]
    environment:
      POSTGRES_DB: gd_rotation_test
      DB_HOST: db
      DB_USER_MIGRATOR: migrator
      DB_PASSWORD_MIGRATOR_FILE: /run/secrets/db_password_migrator
    secrets: [db_password_migrator]
    mem_limit: 256m
  api:
    image: ${apiImage}
    environment:
      POSTGRES_DB: gd_rotation_test
      DB_HOST: db
      DB_USER_API_RO: api_ro
      DB_PASSWORD_API_RO_FILE: /run/secrets/db_password_api_ro
    secrets: [db_password_api_ro]
    mem_limit: 256m
secrets:
${secretEntries}
`,
    );
    expect(compose(['up', '-d', 'db'])).toBe(0);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        compose([
          'exec',
          '-T',
          'db',
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
          '-d',
          'gd_rotation_test',
        ]) === 0
      ) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('Rotation database did not start');
    sql(`CREATE ROLE migrator LOGIN; CREATE ROLE api_ro LOGIN; CREATE ROLE importer NOLOGIN; CREATE ROLE editor NOLOGIN;
      GRANT CREATE ON DATABASE gd_rotation_test TO migrator;
      GRANT USAGE, CREATE ON SCHEMA public TO migrator;
      CREATE SCHEMA drizzle AUTHORIZATION migrator;`);
    for (const role of ['migrator', 'api_ro']) {
      expect(
        compose(
          [
            'exec',
            '-T',
            'db',
            'psql',
            '-U',
            'postgres',
            '-d',
            'gd_rotation_test',
            '-v',
            'ON_ERROR_STOP=1',
            '-c',
            `\\password ${role}`,
          ],
          `${secrets.get(role)}\n${secrets.get(role)}\n`,
        ),
      ).toBe(0);
    }
    expect(compose(['run', '--rm', '--no-deps', 'migrate'])).toBe(0);
    sql(
      "CREATE TABLE rotation_canary (value text); INSERT INTO rotation_canary VALUES ('preserve-me');",
    );
    expect(compose(['up', '-d', 'api'])).toBe(0);
  }, 180000);
  afterAll(() => {
    if (!work) return;
    expect(compose(['down', '--volumes', '--remove-orphans'])).toBe(0);
    if (dirname(work) !== tempBase || !basename(work).startsWith('gd-rotation-int-'))
      throw new Error('Unsafe fixture cleanup path');
    rmSync(work, { recursive: true, force: true });
  });

  it('rotates api_ro, rejects the old password and reloads API without losing data', async () => {
    const old = secrets.get('api_ro')!;
    expect(auth('api_ro', old)).toBe(0);
    await rotateCredential('api_ro', false, createLocalRotationOps('api_ro', false, work!));
    const next = readFileSync(join(work!, 'infra/docker/secrets/db_password_api_ro.txt'), 'utf8');
    expect(next !== old).toBe(true);
    expect(auth('api_ro', next)).toBe(0);
    expect(auth('api_ro', old)).not.toBe(0);
    expect(sql('SELECT value FROM rotation_canary')).toBe('preserve-me');
    const probe =
      "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))";
    expect(compose(['exec', '-T', 'api', 'node', '-e', probe])).toBe(0);
    expect(existsSync(join(work!, 'infra/docker/secrets/.rotation-api_ro.json'))).toBe(false);
  }, 120000);
  it('activates importer only explicitly and gives it a separate working password', async () => {
    const old = secrets.get('importer')!;
    await expect(
      rotateCredential('importer', false, createLocalRotationOps('importer', false, work!)),
    ).rejects.toThrow('activation-required');
    await rotateCredential('importer', true, createLocalRotationOps('importer', false, work!));
    const next = readFileSync(join(work!, 'infra/docker/secrets/db_password_importer.txt'), 'utf8');
    expect(auth('importer', next)).toBe(0);
    expect(auth('importer', old)).not.toBe(0);
    expect(sql('SELECT value FROM rotation_canary')).toBe('preserve-me');
  }, 120000);
  it('recovers an interrupted rotation from the ignored recovery record', async () => {
    const before = readFileSync(join(work!, 'infra/docker/secrets/db_password_api_ro.txt'), 'utf8');
    const real = createLocalRotationOps('api_ro', false, work!);
    const broken = {
      ...real,
      password: async (version: 'old' | 'new') => {
        if (version === 'old') throw new Error('Synthetic compensation failure');
        await real.password(version);
      },
      persist: async () => {
        throw new Error('Synthetic persistence failure');
      },
    };
    await expect(rotateCredential('api_ro', false, broken)).rejects.toThrow('recovery-required');
    expect(existsSync(join(work!, 'infra/docker/secrets/.rotation-api_ro.json'))).toBe(true);
    const exited = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true });
    expect(exited.status).toBe(0);
    writeFileSync(
      join(work!, 'infra/docker/secrets/.rotation.lock'),
      JSON.stringify({ role: 'api_ro', pid: exited.pid }),
    );
    await recoverCredential('api_ro', createLocalRotationOps('api_ro', true, work!));
    const restored = readFileSync(
      join(work!, 'infra/docker/secrets/db_password_api_ro.txt'),
      'utf8',
    );
    expect(restored === before).toBe(true);
    expect(auth('api_ro', restored)).toBe(0);
    expect(existsSync(join(work!, 'infra/docker/secrets/.rotation-api_ro.json'))).toBe(false);
    expect(sql('SELECT value FROM rotation_canary')).toBe('preserve-me');
  }, 120000);
});
