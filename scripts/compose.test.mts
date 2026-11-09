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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = readFileSync(join(ROOT, 'infra', 'docker', 'compose.yaml'), 'utf8');
const DEBUG = readFileSync(join(ROOT, 'infra', 'docker', 'compose.debug.yaml'), 'utf8');

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
const code = (text: string) => text.split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n');
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
    const uncommented = BASE.split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n');
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
    assert.deepEqual(volumes, ['      - pgdata:/var/lib/postgresql/data']);
    const top = section(BASE, 'volumes');
    assert.ok(top.some((l) => /^ {2}pgdata:/.test(l)));
  });

  it('reads secrets only from git-ignored files through Compose secrets and *_FILE', () => {
    assert.ok(block('db').some((l) => l.includes('POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password')));
    const secretsTop = section(BASE, 'secrets');
    assert.ok(secretsTop.some((l) => /file: \.\/secrets\/postgres_password\.txt/.test(l)));
    assert.doesNotMatch(BASE, /POSTGRES_PASSWORD:\s*\S/);
    assert.doesNotMatch(BASE, /DB_PASSWORD_\w+:\s*\S/);
    assert.doesNotMatch(BASE, /^\s*env_file:/m);
  });

  it('never grants privilege, Docker socket or host bind mounts', () => {
    assert.doesNotMatch(BASE_CODE, /privileged:\s*true/);
    assert.doesNotMatch(BASE_CODE, /docker\.sock/);
    assert.doesNotMatch(BASE_CODE, /^[ \t]*- \.{0,2}\/[^:\n]*:/m);
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
