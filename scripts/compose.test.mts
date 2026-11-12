/**
 * Static tests for infra/docker/compose.yaml and compose.debug.yaml (T-056).
 *
 * No YAML dependency: the Compose files are checked as text with a small indentation-based
 * block reader (services are two-space indented keys under `services:`). They pin the security
 * rules of plan §12.7/§12.8: pinned db image, no db ports by default, loopback-only publishing,
 * hardening, resource limits, healthchecks, no literal secrets, no env_file, no Redis/queues.
 * Runtime behaviour (`docker compose up`, health) is verified with Docker, not here.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { provisionDatabaseRoles } from '../infra/docker/init/provision-roles.mts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = readFileSync(join(ROOT, 'infra', 'docker', 'compose.yaml'), 'utf8');
const DEBUG = readFileSync(join(ROOT, 'infra', 'docker', 'compose.debug.yaml'), 'utf8');
const INIT = readFileSync(join(ROOT, 'infra', 'docker', 'init', '001-provision-roles.sh'), 'utf8');

/** Lines of one top-level section (e.g. `services`) without its header. */
function section(text: string, name: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l === `${name}:` || l.startsWith(`${name}: `));
  if (start === -1) return [];
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    body.push(line);
  }
  return body;
}

/** Map of service name to its block lines (two-space keys inside `services:`). */
function services(text: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let current: string | undefined;
  for (const line of section(text, 'services')) {
    const header = /^ {2}([a-z][a-z0-9_-]*):\s*$/.exec(line);
    if (header) {
      current = header[1];
      result.set(current, []);
    } else if (current !== undefined) {
      result.get(current)?.push(line);
    }
  }
  return result;
}

const svc = services(BASE);
const debugSvc = services(DEBUG);
/** Compose text without comment lines, so comments cannot satisfy or violate a rule. */
const code = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
const BASE_CODE = code(BASE);
const DEBUG_CODE = code(DEBUG);
const block = (name: string) => svc.get(name) ?? [];
const has = (lines: string[], pattern: RegExp) => lines.some((l) => pattern.test(l));

/** Published port entries (`- "..."`) of a service block. */
function portsOf(lines: string[]): string[] {
  const idx = lines.findIndex((l) => /^ {4}ports:\s*$/.test(l));
  if (idx === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(idx + 1)) {
    const m = /^ {6}- "?([^"]+)"?\s*$/.exec(line);
    if (!m) break;
    out.push(m[1]);
  }
  return out;
}

describe('compose.yaml services (T-056)', () => {
  it('declares exactly db, migrate and api', () => {
    assert.deepEqual([...svc.keys()].sort(), ['api', 'db', 'migrate']);
  });

  it('pins db to PostgreSQL 17 with an exact tag and sha256 digest, never latest', () => {
    const image = block('db').find((l) => /^ {4}image:/.test(l)) ?? '';
    assert.match(image, /image: postgres:17\.\d+-[a-z]+@sha256:[0-9a-f]{64}$/);
    const uncommented = BASE.split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    assert.doesNotMatch(uncommented, /latest/i);
  });

  it('does not publish db ports by default', () => {
    assert.deepEqual(portsOf(block('db')), []);
    assert.equal(has(block('db'), /^ {4}ports:/), false);
  });

  it('publishes api only on 127.0.0.1', () => {
    const ports = portsOf(block('api'));
    assert.equal(ports.length, 1);
    assert.match(ports[0], /^127\.0\.0\.1:/);
    assert.doesNotMatch(BASE_CODE, /0\.0\.0\.0/);
  });

  it('applies cap_drop ALL, no-new-privileges and read_only to every service via the hardening anchor', () => {
    const hardening = section(BASE, 'x-hardening');
    assert.ok(has(hardening, /^ {2}cap_drop:$/) && has(hardening, /^ {4}- ALL$/));
    assert.ok(has(hardening, /no-new-privileges:true/));
    assert.ok(has(hardening, /read_only: true/));
    for (const name of svc.keys()) {
      assert.ok(has(block(name), /^ {4}<<: \*hardening$/), `${name} must merge *hardening`);
    }
  });

  it('keeps only the capabilities db needs after cap_drop ALL', () => {
    const caps = block('db')
      .filter((l) => /^ {6}- [A-Z_]+$/.test(l))
      .map((l) => l.trim().slice(2));
    assert.deepEqual(caps.sort(), ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID']);
    assert.equal(has(block('api'), /cap_add:/), false);
    assert.equal(has(block('migrate'), /cap_add:/), false);
  });

  it('sets memory, CPU and PID limits on every service', () => {
    for (const name of svc.keys()) {
      assert.ok(has(block(name), /^ {4}mem_limit: \d+m$/), `${name} mem_limit`);
      assert.ok(has(block(name), /^ {4}cpus: [\d.]+$/), `${name} cpus`);
      assert.ok(has(block(name), /^ {4}pids_limit: \d+$/), `${name} pids_limit`);
    }
  });

  it('gates startup with healthchecks and conditions', () => {
    assert.ok(has(block('db'), /^ {4}healthcheck:/));
    assert.ok(has(block('api'), /^ {4}healthcheck:/));
    assert.ok(block('db').some((l) => l.includes('pg_isready')));
    assert.ok(block('db').some((l) => l.includes('pg_roles')));
    assert.ok(block('api').some((l) => l.includes('/health')));
    assert.ok(has(block('migrate'), /^ {8}condition: service_healthy$/));
    assert.ok(has(block('api'), /^ {8}condition: service_completed_successfully$/));
  });

  it('stores PostgreSQL data in a named volume, not a host bind mount', () => {
    const db = block('db');
    const start = db.findIndex((l) => /^ {4}volumes:\s*$/.test(l));
    assert.notEqual(start, -1, 'db must declare volumes');
    const volumes: string[] = [];
    for (const line of db.slice(start + 1)) {
      if (!/^ {6}- /.test(line)) break;
      volumes.push(line);
    }
    assert.deepEqual(volumes, [
      '      - pgdata:/var/lib/postgresql/data',
      '      - ./init:/docker-entrypoint-initdb.d:ro',
    ]);
    const top = section(BASE, 'volumes');
    assert.ok(top.some((l) => /^ {2}pgdata:/.test(l)));
  });

  it('reads secrets only from git-ignored files through Compose secrets and *_FILE', () => {
    assert.ok(
      block('db').some((l) => l.includes('POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password')),
    );
    const secretsTop = section(BASE, 'secrets');
    assert.ok(secretsTop.some((l) => /file: \.\/secrets\/postgres_password\.txt/.test(l)));
    assert.doesNotMatch(BASE, /POSTGRES_PASSWORD:\s*\S/);
    assert.doesNotMatch(BASE_CODE, /DB_PASSWORD_(?:MIGRATOR|API_RO|IMPORTER|EDITOR):\s*\S/);
    assert.doesNotMatch(BASE, /^\s*env_file:/m);
  });

  it('delivers only each service credential and mounts the idempotent initializer in db', () => {
    const db = block('db').join('\n');
    const migrate = block('migrate').join('\n');
    const api = block('api').join('\n');
    assert.match(db, /POSTGRES_PASSWORD_FILE: \/run\/secrets\/postgres_password/);
    assert.match(db, /- db_password_migrator/);
    assert.match(db, /- db_password_api_ro/);
    assert.match(db, /\.\/init:\/docker-entrypoint-initdb\.d:ro/);
    assert.match(migrate, /DB_PASSWORD_MIGRATOR_FILE: \/run\/secrets\/db_password_migrator/);
    assert.match(api, /DB_PASSWORD_API_RO_FILE: \/run\/secrets\/db_password_api_ro/);
    assert.doesNotMatch(migrate, /api_ro|POSTGRES_PASSWORD|api_password/);
    assert.doesNotMatch(api, /migrator|POSTGRES_PASSWORD|importer|editor/);
    assert.doesNotMatch(db, /DB_PASSWORD_(?:IMPORTER|EDITOR)/);
  });

  it('declares only the role credentials needed by db, migrate and api', () => {
    const secretsTop = section(BASE, 'secrets').join('\n');
    assert.match(secretsTop, /db_password_migrator:/);
    assert.match(secretsTop, /db_password_api_ro:/);
    assert.doesNotMatch(secretsTop, /db_password_(?:importer|editor)/);
  });

  it('precreates roles without login, provisions only migrator and api_ro, and hashes passwords client-side', () => {
    assert.match(INIT, /for role in migrator importer editor api_ro/);
    assert.match(INIT, /CREATE ROLE %I NOLOGIN/);
    assert.match(INIT, /GRANT CREATE ON DATABASE %I TO migrator/);
    assert.match(INIT, /GRANT USAGE, CREATE ON SCHEMA public TO migrator/);
    assert.match(INIT, /CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION migrator/);
    assert.match(INIT, /provision_login migrator/);
    assert.match(INIT, /provision_login api_ro/);
    assert.doesNotMatch(INIT, /provision_login importer|provision_login editor/);
    assert.match(INIT, /\\password \$\{role\}/);
    assert.match(INIT, /printf '%s\\n%s\\n' "\$password" "\$password" \|/);
    assert.doesNotMatch(INIT, /echo .*password|set -x|--password\s+\$password/i);
    assert.match(INIT, /role provisioning failed: required secret unavailable/);
    assert.doesNotMatch(INIT, /\$password.*(printf|echo).*stderr/);
  });

  it('uses an explicit reprovisioner that never surfaces subprocess output', async () => {
    let safeError = '';
    try {
      await provisionDatabaseRoles({
        run: async () => ({ code: 1, output: 'sensitive subprocess output' }),
      });
    } catch (error) {
      safeError = error instanceof Error ? error.message : String(error);
    }
    assert.equal(safeError, 'Falló la provisión de roles (código 1)');
    assert.doesNotMatch(safeError, /sensitive/);
    assert.equal(existsSync(join(ROOT, 'infra', 'docker', 'init', '001-provision-roles.sh')), true);
  });

  it('routes existing-volume reprovisioning through a fixed command with no secret arguments', async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    await provisionDatabaseRoles({
      run: async (command, args) => {
        calls.push({ command, args });
        return { code: 0, output: 'role credentials provisioned\n' };
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'docker');
    assert.deepEqual(calls[0].args, [
      'compose',
      '-f',
      'infra/docker/compose.yaml',
      'exec',
      '-T',
      'db',
      'sh',
      '/docker-entrypoint-initdb.d/001-provision-roles.sh',
    ]);
  });

  it('never grants privilege, Docker socket or host bind mounts', () => {
    assert.doesNotMatch(BASE_CODE, /privileged:\s*true/);
    assert.doesNotMatch(BASE_CODE, /docker\.sock/);
    const localMounts = BASE_CODE.split(/\r?\n/).filter((line) => /^\s+- \.{0,2}\//.test(line));
    assert.deepEqual(localMounts, [
      '      - ./init:/docker-entrypoint-initdb.d:ro',
      '      - /tmp',
      '      - /var/run/postgresql',
      '      - /tmp',
      '      - /tmp',
    ]);
  });

  it('keeps database diagnostics without logging SQL, bind values or row details (T-125)', () => {
    const db = code(block('db').join('\n'));
    for (const setting of [
      'logging_collector=off',
      'log_destination=stderr',
      'log_timezone=UTC',
      'log_error_verbosity=terse',
      'log_statement=none',
      'log_min_error_statement=panic',
      'log_min_duration_statement=-1',
      'log_min_duration_sample=-1',
      'log_duration=off',
      'log_parameter_max_length=0',
      'log_parameter_max_length_on_error=0',
      'log_lock_waits=on',
    ]) {
      assert.ok(db.includes(`- ${setting}\n`), `db must preserve ${setting}`);
    }
    const prefix = db.split('\n').find((line) => line.includes('log_line_prefix=')) ?? '';
    for (const field of ['%m', '%p', '%e', '%u', '%d', '%a', '%r', '%c']) {
      assert.ok(prefix.includes(field), `missing diagnostic field ${field}`);
    }
    assert.match(db, /driver: local/);
    assert.match(db, /max-size: "10m"/);
    assert.match(db, /max-file: "3"/);
  });

  it('adds no Redis, queue or external-auth service (constitution VIII)', () => {
    for (const name of svc.keys()) {
      assert.doesNotMatch(name, /redis|valkey|queue|worker|auth|storage|minio/i);
    }
  });
});

describe('compose.debug.yaml (T-056)', () => {
  it('publishes only the db service and only on loopback', () => {
    assert.deepEqual([...debugSvc.keys()], ['db']);
    const ports = portsOf(debugSvc.get('db') ?? []);
    assert.equal(ports.length, 1);
    assert.match(ports[0], /^127\.0\.0\.1:\$\{POSTGRES_DEBUG_PORT:-5432\}:5432$/);
    assert.doesNotMatch(DEBUG, /0\.0\.0\.0/);
  });

  it('does not add secrets, env_file or privileges', () => {
    assert.doesNotMatch(DEBUG_CODE, /env_file|privileged|password/i);
  });
});
