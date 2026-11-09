import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkComposeFiles,
  checkManifestText,
  checkSourceText,
  parseComposeServices,
  scanRepository,
} from './check-scope.mts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join('scripts', 'check-scope.mts');
const REAL_MANIFEST = readFileSync(join(REPO_ROOT, 'package.json'), 'utf8');

const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** Crea un árbol temporal de fixtures (nunca dentro del repo). */
function makeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'check-scope-'));
  tempDirs.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const CLEAN_COMPOSE = `name: grim-dawn-builds
services:
  db:
    image: postgres:17.5-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
  migrate:
    build:
      context: ../../apps/api
    depends_on:
      db:
        condition: service_healthy
  api:
    build:
      context: ../../apps/api
    depends_on:
      migrate:
        condition: service_completed_successfully
    ports:
      - "127.0.0.1:3000:3000"
`;

describe('manifests (package.json)', () => {
  it('passes the current package.json', () => {
    assert.deepEqual(checkManifestText('package.json', REAL_MANIFEST), []);
  });

  it('fails a controlled fixture that adds redis to dependencies', () => {
    const manifest = JSON.parse(REAL_MANIFEST);
    manifest.dependencies.redis = '^4.7.0';
    const issues = checkManifestText('package.json', JSON.stringify(manifest, null, 2));
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, 'redis');
    assert.equal(issues[0].file, 'package.json');
    assert.equal(issues[0].line, JSON.stringify(manifest, null, 2).split('\n').findIndex((l) => l.includes('"redis"')) + 1);
  });

  it('flags forbidden packages in every dependency section', () => {
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      const text = JSON.stringify({ [section]: { bullmq: '^5.0.0' } });
      const issues = checkManifestText('package.json', text);
      assert.deepEqual(
        issues.map((i) => i.rule),
        ['queue-worker'],
        `section ${section}`,
      );
    }
  });

  it('maps each forbidden package family to its rule', () => {
    const cases: [string, string][] = [
      ['ioredis', 'redis'],
      ['@redis/client', 'redis'],
      ['@upstash/redis', 'redis'],
      ['bull', 'queue-worker'],
      ['pg-boss', 'queue-worker'],
      ['amqplib', 'queue-worker'],
      ['kafkajs', 'queue-worker'],
      ['piscina', 'queue-worker'],
      ['passport', 'external-auth'],
      ['passport-local', 'external-auth'],
      ['@auth0/nextjs-auth0', 'external-auth'],
      ['@clerk/clerk-js', 'external-auth'],
      ['keycloak-js', 'external-auth'],
      ['firebase-admin', 'external-auth'],
      ['@azure/msal-browser', 'external-auth'],
      ['@supabase/supabase-js', 'external-auth'],
      ['@aws-sdk/client-s3', 'object-storage'],
      ['minio', 'object-storage'],
      ['@google-cloud/storage', 'object-storage'],
      ['@azure/storage-blob', 'object-storage'],
    ];
    for (const [pkg, rule] of cases) {
      const issues = checkManifestText('package.json', JSON.stringify({ devDependencies: { [pkg]: '1.0.0' } }));
      assert.deepEqual(
        issues.map((i) => i.rule),
        [rule],
        `package ${pkg}`,
      );
    }
  });

  it('does not flag legitimate tooling, app and test dependencies', () => {
    const legit = {
      dependencies: { fastify: '^5.0.0', 'drizzle-orm': '^0.44.0', pg: '^8.16.0', zod: '^4.6.7', '@angular/core': '^21.2.0' },
      devDependencies: {
        vitest: '^4.0.8',
        jsdom: '^28.0.0',
        tsx: '^4.23.15',
        prettier: '^3.8.1',
        eslint: '^10.3.0',
        'markdownlint-cli2': '0.24.0',
        '@playwright/test': '^1.50.0',
        testcontainers: '^10.0.0',
        'p-queue': '^8.0.0',
        jsonwebtoken: '^9.0.0',
      },
    };
    assert.deepEqual(checkManifestText('package.json', JSON.stringify(legit)), []);
  });

  it('fails closed when the manifest is not valid JSON', () => {
    const issues = checkManifestText('package.json', '{ "dependencies": ');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, 'invalid-input');
  });
});

describe('source and configuration', () => {
  it('flags Redis, queue, auth and storage imports in runtime code', () => {
    const cases: [string, string][] = [
      ["import { createClient } from 'redis';", 'redis'],
      ['import type { Redis } from "ioredis";', 'redis'],
      ["const amqp = require('amqplib');", 'queue-worker'],
      ["const m = await import('@aws-sdk/client-s3');", 'object-storage'],
      ["export * from 'passport-local';", 'external-auth'],
      ["import { S3 } from '@aws-sdk/client-s3/dist-types/S3';", 'object-storage'],
    ];
    for (const [code, rule] of cases) {
      const issues = checkSourceText('src/app/x.ts', code, 'code');
      assert.deepEqual(
        issues.map((i) => i.rule),
        [rule],
        code,
      );
    }
  });

  it('reports the line of a multi-line import', () => {
    const code = "import {\n  Queue,\n  Worker\n} from 'bullmq';\n";
    const issues = checkSourceText('scripts/jobs.mts', code, 'code');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].line, 4);
  });

  it('does not flag comments, relative paths, builtins or legitimate packages', () => {
    const code = [
      "// import { createClient } from 'redis';",
      " * import Queue from 'bullmq';",
      "import { helper } from './redis';",
      "import { Worker } from 'node:worker_threads';",
      "import { PQueue } from 'p-queue';",
      "import { Injectable } from '@angular/core';",
      "import { z } from 'zod';",
    ].join('\n');
    assert.deepEqual(checkSourceText('src/app/x.ts', code, 'code'), []);
  });

  it('flags Redis and AMQP connection URLs in code and configuration', () => {
    assert.deepEqual(
      checkSourceText('src/app/x.ts', "const url = 'redis://localhost:6379';", 'code').map((i) => i.rule),
      ['redis'],
    );
    assert.deepEqual(
      checkSourceText('.env.example', 'REDIS_URL=rediss://cache:6380\n', 'config').map((i) => i.rule),
      ['redis'],
    );
    assert.deepEqual(
      checkSourceText('infra/config.json', '{ "broker": "amqp://guest@broker" }', 'config').map((i) => i.rule),
      ['queue-worker'],
    );
  });

  it('ignores URL-like text inside comment lines of configuration', () => {
    assert.deepEqual(checkSourceText('infra/x.yaml', '# example: redis://localhost\n', 'config'), []);
  });
});

describe('compose', () => {
  it('parses service names and images from a block-style compose file', () => {
    const services = parseComposeServices(CLEAN_COMPOSE, 'infra/docker/compose.yaml');
    assert.deepEqual(
      services.map((s) => [s.name, s.image]),
      [
        ['db', 'postgres:17.5-alpine'],
        ['migrate', undefined],
        ['api', undefined],
      ],
    );
  });

  it('passes one application service, one database and the migrate job', () => {
    assert.deepEqual(checkComposeFiles([{ file: 'infra/docker/compose.yaml', text: CLEAN_COMPOSE }]), []);
  });

  it('fails a controlled fixture that adds a redis service', () => {
    const text = `${CLEAN_COMPOSE}  redis:\n    image: redis:7.4-alpine\n`;
    const issues = checkComposeFiles([{ file: 'infra/docker/compose.yaml', text }]);
    assert.ok(issues.some((i) => i.rule === 'redis'), JSON.stringify(issues));
    assert.equal(issues.find((i) => i.rule === 'redis')?.line, text.split('\n').findIndex((l) => l === '  redis:') + 1);
  });

  it('fails a worker or queue service even without a known image', () => {
    const text = `${CLEAN_COMPOSE}  worker:\n    build: ../../apps/api\n`;
    const issues = checkComposeFiles([{ file: 'infra/docker/compose.yaml', text }]);
    assert.ok(issues.some((i) => i.rule === 'queue-worker'));
  });

  it('fails when a second application service is added', () => {
    const text = `${CLEAN_COMPOSE}  web:\n    build: ../../\n`;
    const issues = checkComposeFiles([{ file: 'infra/docker/compose.yaml', text }]);
    assert.deepEqual(issues.map((i) => i.rule), ['compose-topology']);
    assert.match(issues[0].message, /web/);
  });

  it('fails when a second database service is added', () => {
    const text = `${CLEAN_COMPOSE}  reports-db:\n    image: mysql:8.4\n`;
    const issues = checkComposeFiles([{ file: 'infra/docker/compose.yaml', text }]);
    assert.deepEqual(issues.map((i) => i.rule), ['compose-topology']);
  });

  it('classifies database images with registry and digest correctly', () => {
    const text = CLEAN_COMPOSE.replace(
      'image: postgres:17.5-alpine',
      'image: docker.io/library/postgres:17.5@sha256:0123abcd',
    );
    assert.deepEqual(checkComposeFiles([{ file: 'infra/docker/compose.yaml', text }]), []);
  });

  it('merges override files by service name', () => {
    const override = 'services:\n  db:\n    ports:\n      - "127.0.0.1:5432:5432"\n';
    const issues = checkComposeFiles([
      { file: 'infra/docker/compose.yaml', text: CLEAN_COMPOSE },
      { file: 'infra/docker/compose.debug.yaml', text: override },
    ]);
    assert.deepEqual(issues, []);
  });

  it('ignores commented-out services', () => {
    const text = `${CLEAN_COMPOSE}  # redis:\n  #   image: redis:7\n`;
    assert.deepEqual(checkComposeFiles([{ file: 'infra/docker/compose.yaml', text }]), []);
  });

  it('fails closed on an inline services definition it cannot read', () => {
    const issues = checkComposeFiles([
      { file: 'infra/docker/compose.yaml', text: 'services: { api: { build: . } }\n' },
    ]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, 'invalid-input');
  });
});

describe('scanRepository', () => {
  it('passes the current repository', () => {
    const result = scanRepository(REPO_ROOT);
    assert.deepEqual(result.issues, []);
    assert.ok(result.scannedFiles > 0);
  });

  it('ignores specs, docs, test trees and dependency folders, but scans nested content code', () => {
    const root = makeFixture({
      'package.json': JSON.stringify({ dependencies: { fastify: '^5.0.0' } }),
      'specs/001/plan.md': 'Redis, BullMQ and Keycloak are forbidden.',
      'specs/001/compose.yaml': CLEAN_COMPOSE + '  redis:\n    image: redis:7\n',
      'docs/example.ts': "import { createClient } from 'redis';\n",
      'content/builds/x.json': '{ "url": "redis://example" }',
      'src/app/x.spec.ts': "import { createClient } from 'ioredis';\n",
      'e2e/flow.ts': "import { createClient } from 'redis';\n",
      'scripts/fixtures/a.ts': "import { createClient } from 'redis';\n",
      'node_modules/redis/index.js': "import { x } from 'redis';\n",
      'src/app/core/content/bad.ts': "import { createClient } from 'redis';\n",
      'infra/docker/compose.yaml': CLEAN_COMPOSE,
    });
    const result = scanRepository(root);
    assert.deepEqual(
      result.issues.map((i) => `${i.file}:${i.rule}`),
      ['src/app/core/content/bad.ts:redis'],
    );
  });

  it('finds a Compose redis service and reports its file', () => {
    const root = makeFixture({
      'package.json': JSON.stringify({ dependencies: {} }),
      'infra/docker/compose.yaml': `${CLEAN_COMPOSE}  redis:\n    image: redis:7\n`,
    });
    const result = scanRepository(root);
    assert.ok(result.issues.some((i) => i.file === 'infra/docker/compose.yaml' && i.rule === 'redis'));
  });
});

describe('check:scope CLI', () => {
  const run = (root: string) =>
    spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, '--root', root], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

  it('exits 0 for the current repository', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it('exits 1 and names the rule and file for a fixture that adds redis', () => {
    const manifest = JSON.parse(REAL_MANIFEST);
    manifest.dependencies.redis = '^4.7.0';
    const root = makeFixture({ 'package.json': JSON.stringify(manifest, null, 2) });
    const result = run(root);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout + result.stderr, /package\.json.*\[redis\]/);
  });
});
