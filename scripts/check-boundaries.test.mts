import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSource, scanWorkspace, zoneOf, zoneOfPackage } from './check-boundaries.mts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join('scripts', 'check-boundaries.mts');

const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** Árbol temporal de fixtures (nunca dentro del repo). */
function makeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'check-boundaries-'));
  tempDirs.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const rulesOf = (file: string, code: string) => checkSource(file, code).map((i) => i.rule);

describe('zoneOf', () => {
  it('maps repository paths to their owning zone', () => {
    assert.equal(zoneOf('src/app/app.ts'), 'web');
    assert.equal(zoneOf('apps/web/src/main.ts'), 'web');
    assert.equal(zoneOf('apps/api/src/server.ts'), 'api');
    assert.equal(zoneOf('packages/domain/src/index.ts'), 'domain');
    assert.equal(zoneOf('scripts/check-scope.mts'), 'scripts');
  });

  it('leaves unowned paths out of the zone graph', () => {
    assert.equal(zoneOf('content/builds/a.json'), undefined);
    assert.equal(zoneOf('srcx/app.ts'), undefined, 'prefix must match whole segments');
    assert.equal(zoneOf('apps/apix/a.ts'), undefined, 'prefix must match whole segments');
    assert.equal(zoneOf('../outside.ts'), undefined);
  });
});

describe('zoneOfPackage', () => {
  it('maps workspace package names, including subpaths', () => {
    assert.equal(zoneOfPackage('@gd/domain'), 'domain');
    assert.equal(zoneOfPackage('@gd/domain/vocabulary'), 'domain');
    assert.equal(zoneOfPackage('@gd/api'), 'api');
    assert.equal(zoneOfPackage('@gd/web'), 'web');
  });

  it('ignores third-party packages', () => {
    assert.equal(zoneOfPackage('zod'), undefined);
    assert.equal(zoneOfPackage('@angular/core'), undefined);
  });
});

describe('allowed dependency graph (plan §12.4)', () => {
  it('allows web, api and scripts to import the domain', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', "import { x } from '@gd/domain';"), []);
    assert.deepEqual(rulesOf('src/app/a.ts', "import { x } from '@gd/domain/vocabulary';"), []);
    assert.deepEqual(rulesOf('apps/api/src/a.ts', "import { x } from '@gd/domain';"), []);
    assert.deepEqual(rulesOf('scripts/a.mts', "import { x } from '@gd/domain';"), []);
  });

  it('allows same-zone imports, including relative ones', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', "import { b } from './b';"), []);
    assert.deepEqual(rulesOf('packages/domain/src/a.ts', "import { b } from './schema';"), []);
    assert.deepEqual(rulesOf('scripts/a.mts', "import { b } from './b.mts';"), []);
  });

  it('forbids web importing the API by package name', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', "import { x } from '@gd/api';"), ['zone-edge']);
  });

  it('forbids the API importing the web by package name', () => {
    assert.deepEqual(rulesOf('apps/api/src/a.ts', "import { x } from '@gd/web';"), ['zone-edge']);
  });

  it('forbids every edge that is not on the allowlist', () => {
    const cases: [string, string][] = [
      ['src/app/a.ts', "import { x } from '../../scripts/check-scope.mts';"],
      ['scripts/a.mts', "import { x } from '../src/app/app.ts';"],
      ['packages/domain/src/a.ts', "import { x } from '../../../src/app/app.ts';"],
      ['packages/domain/src/a.ts', "import { x } from '@gd/api';"],
      ['apps/api/src/a.ts', "import { x } from '../../../scripts/a.mts';"],
    ];
    for (const [file, code] of cases) {
      assert.deepEqual(rulesOf(file, code), ['zone-edge'], `${file}: ${code}`);
    }
  });

  it('forbids relative paths that climb from the web into the API', () => {
    const issues = checkSource(
      'src/app/a.ts',
      "\nimport { server } from '../../apps/api/src/server';\n",
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, 'zone-edge');
    assert.equal(issues[0].line, 2);
    assert.match(issues[0].message, /apps\/api\/src\/server/);
  });

  it('forbids the API importing web source relatively', () => {
    assert.deepEqual(rulesOf('apps/api/src/a.ts', "import { x } from '../../../src/app/app.ts';"), [
      'zone-edge',
    ]);
  });

  it('reports the line of the module specifier in a multi-line import', () => {
    const issues = checkSource('src/app/a.ts', "import {\n  a,\n  b\n} from '@gd/api';\n");
    assert.equal(issues.length, 1);
    assert.equal(issues[0].line, 4);
  });

  it('gives an actionable message naming the allowed dependencies', () => {
    const [issue] = checkSource('src/app/a.ts', "import { x } from '@gd/api';");
    assert.match(issue.message, /"web"/);
    assert.match(issue.message, /"api"/);
    assert.match(issue.message, /web→domain|domain/);
  });

  it('ignores imports from files that belong to no zone', () => {
    assert.deepEqual(rulesOf('content/x.ts', "import { x } from '@gd/api';"), []);
  });
});

describe('domain purity (plan §12.4)', () => {
  const DOMAIN = 'packages/domain/src/a.ts';

  it('allows pure dependencies such as zod and vitest', () => {
    assert.deepEqual(rulesOf(DOMAIN, "import { z } from 'zod';"), []);
    assert.deepEqual(rulesOf(DOMAIN, "import { it } from 'vitest';"), []);
  });

  it('forbids framework imports', () => {
    assert.deepEqual(rulesOf(DOMAIN, "import { Injectable } from '@angular/core';"), [
      'domain-framework',
    ]);
    assert.deepEqual(rulesOf(DOMAIN, "import Fastify from 'fastify';"), ['domain-framework']);
    assert.deepEqual(rulesOf(DOMAIN, "import cors from '@fastify/cors';"), ['domain-framework']);
  });

  it('forbids Drizzle and database driver imports', () => {
    assert.deepEqual(rulesOf(DOMAIN, "import { drizzle } from 'drizzle-orm/node-postgres';"), [
      'domain-database',
    ]);
    assert.deepEqual(rulesOf(DOMAIN, "import { defineConfig } from 'drizzle-kit';"), [
      'domain-database',
    ]);
    assert.deepEqual(rulesOf(DOMAIN, "import { Pool } from 'pg';"), ['domain-database']);
    assert.deepEqual(rulesOf(DOMAIN, "export * from 'postgres';"), ['domain-database']);
  });

  it('forbids Node HTTP and network modules', () => {
    assert.deepEqual(rulesOf(DOMAIN, "import { createServer } from 'node:http';"), [
      'domain-network',
    ]);
    assert.deepEqual(rulesOf(DOMAIN, "import { request } from 'https';"), ['domain-network']);
    assert.deepEqual(rulesOf(DOMAIN, "import axios from 'axios';"), ['domain-network']);
  });

  it('forbids I/O modules, including subpaths and dynamic or CommonJS forms', () => {
    assert.deepEqual(rulesOf(DOMAIN, "import { readFileSync } from 'node:fs';"), ['domain-io']);
    assert.deepEqual(rulesOf(DOMAIN, "import { readFile } from 'node:fs/promises';"), [
      'domain-io',
    ]);
    assert.deepEqual(rulesOf(DOMAIN, "import { join } from 'path';"), ['domain-io']);
    assert.deepEqual(rulesOf(DOMAIN, "import { execFile } from 'node:child_process';"), [
      'domain-io',
    ]);
    assert.deepEqual(rulesOf(DOMAIN, "import { env } from 'node:process';"), ['domain-io']);
    assert.deepEqual(rulesOf(DOMAIN, "const fs = require('fs');"), ['domain-io']);
    assert.deepEqual(rulesOf(DOMAIN, "const os = await import('node:os');"), ['domain-io']);
    assert.deepEqual(rulesOf(DOMAIN, "import fs = require('fs');"), ['domain-io']);
  });

  it('forbids I/O globals: process.env, import.meta.env, fetch and sockets', () => {
    const cases: [string, string][] = [
      ['export const dev = process.env.NODE_ENV;', 'domain-io'],
      ["const x = process['env'];", 'domain-io'],
      ['const y = globalThis.process.env.X;', 'domain-io'],
      ['const m = import.meta.env.MODE;', 'domain-io'],
      ["const r = await fetch('https://example.org');", 'domain-io'],
      ["const r = globalThis.fetch('x');", 'domain-io'],
      ['const x = new XMLHttpRequest();', 'domain-io'],
      ["const s = new WebSocket('wss://example.org');", 'domain-io'],
    ];
    for (const [code, rule] of cases) {
      assert.deepEqual(rulesOf(DOMAIN, code), [rule], code);
    }
  });

  it('does not flag look-alike members that are not I/O', () => {
    const code = 'const a = client.fetch("x");\nconst b = config.env;\nconst c = obj.process;\n';
    assert.deepEqual(rulesOf(DOMAIN, code), []);
  });

  it('applies the purity rules only inside packages/domain', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', "import { readFileSync } from 'node:fs';"), []);
    assert.deepEqual(rulesOf('src/app/a.ts', 'const e = process.env.X;'), []);
    assert.deepEqual(rulesOf('scripts/a.mts', "import { readFileSync } from 'node:fs';"), []);
  });
});

describe('precision: comments, strings and syntax', () => {
  it('does not treat comments or string text as imports', () => {
    const code = [
      "// import { Injectable } from '@angular/core';",
      "/* import Fastify from 'fastify'; */",
      "const s = \"import('fs') and process.env.X and from '../../apps/api/x'\";",
      '',
    ].join('\n');
    assert.deepEqual(rulesOf('packages/domain/src/a.ts', code), []);
    assert.deepEqual(
      rulesOf(
        'src/app/a.ts',
        "// import x from '@gd/api';\nconst s = \"from '../../apps/api/x'\";",
      ),
      [],
    );
  });

  it('flags a cross-zone type-only import', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', "type Thing = import('@gd/api').Thing;"), [
      'zone-edge',
    ]);
  });

  it('flags cross-zone re-exports', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', "export { x } from '@gd/api';"), ['zone-edge']);
  });

  it('accepts literal dynamic imports and no-substitution template literals', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', "const m = () => import('./home.page');"), []);
    assert.deepEqual(rulesOf('src/app/a.ts', 'const m = () => import(`./home.page`);'), []);
  });

  it('fails closed on dynamic imports whose target cannot be read statically', () => {
    assert.deepEqual(rulesOf('src/app/a.ts', 'const m = await import(name);'), [
      'unresolvable-import',
    ]);
    assert.deepEqual(rulesOf('packages/domain/src/a.ts', 'const m = require(p);'), [
      'unresolvable-import',
    ]);
    assert.deepEqual(rulesOf('src/app/a.ts', 'const m = import(`./locale/${id}`);'), [
      'unresolvable-import',
    ]);
  });
});

describe('scanWorkspace', () => {
  it('passes the current repository', () => {
    const result = scanWorkspace(REPO_ROOT);
    assert.deepEqual(result.issues, []);
    assert.ok(result.scannedFiles > 0);
  });

  it('skips zones that do not exist yet (apps/api before T-053)', () => {
    const root = makeFixture({
      'src/app/a.ts': "import { x } from '@gd/domain';\n",
      'packages/domain/src/a.ts': 'export const a = 1;\n',
    });
    const result = scanWorkspace(root);
    assert.deepEqual(result.issues, []);
    assert.equal(result.scannedFiles, 2);
  });

  it('reports forbidden imports with file and line, and ignores fixtures, dependencies, build output and docs', () => {
    const root = makeFixture({
      'apps/api/src/server.ts': "import { BuildSchema } from '@gd/domain';\nexport const s = 1;\n",
      'apps/api/node_modules/lib/index.ts': "import { x } from '@gd/web';\n",
      'apps/api/dist/out.js': "import { x } from '@gd/web';\n",
      'src/app/bad.ts': "export {};\nimport { server } from '../../apps/api/src/server';\n",
      'src/app/comment.ts': "// import { x } from '@gd/api';\n",
      'packages/domain/src/io.ts': "import { readFileSync } from 'node:fs';\n",
      'packages/domain/src/ok.ts': 'export const ok = 1;\n',
      'scripts/fixtures/bad.mts': "import { x } from '@gd/api';\n",
      'docs/example.ts': "import { x } from '@gd/api';\n",
    });
    const result = scanWorkspace(root);
    const found = result.issues.map((i) => `${i.file}:${i.line}:${i.rule}`).sort();
    assert.deepEqual(found, [
      'packages/domain/src/io.ts:1:domain-io',
      'src/app/bad.ts:2:zone-edge',
    ]);
    assert.equal(result.scannedFiles, 5);
  });
});

describe('check:boundaries CLI', () => {
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

  it('exits 1 and names file, line and rule for a fixture with a forbidden import', () => {
    const root = makeFixture({
      'src/app/bad.ts': "export {};\nimport { server } from '../../apps/api/src/server';\n",
      'apps/api/src/server.ts': 'export const s = 1;\n',
    });
    const result = run(root);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout + result.stderr, /src\/app\/bad\.ts:2 \[zone-edge\]/);
  });

  it('exits 1 for a domain file that imports a framework', () => {
    const root = makeFixture({ 'packages/domain/src/bad.ts': "import Fastify from 'fastify';\n" });
    const result = run(root);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(
      result.stdout + result.stderr,
      /packages\/domain\/src\/bad\.ts:1 \[domain-framework\]/,
    );
  });
});
