import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APPROVED_RIGHTS = ['own_original', 'licensed', 'permission_granted', 'link_only'] as const;
/*
 * Static shape tests for the T-055 gates migration (drizzle/0001_gates.sql).
 *
 * There is no live PostgreSQL in this repository yet, so these tests parse the
 * SQL text into statements and assert its structure: guard/requirement
 * decomposition of CHECK expressions, trigger timing, view predicates and the
 * exact grant matrix. Live semantics (rejections at INSERT/COMMIT time, real
 * role permissions) are verified by T-073 once PostgreSQL 17 is available.
 */

const drizzleDir = fileURLToPath(new URL('../../drizzle', import.meta.url));
const GATES = join(drizzleDir, '0001_gates.sql');
const INITIAL = join(drizzleDir, '0000_initial_schema.sql');
const INITIAL_SHA256 = 'F4BC25ACDA7B3964EE32BB39AD4C357B13BB2AE4EBA65C7E0BD26076CB0E1DCC';

const PUBLIC_VIEWS = [
  'v_public_assets',
  'v_public_authors',
  'v_public_builds',
  'v_public_tier_entries',
  'v_public_tier_lists',
];
const ROLES = ['migrator', 'importer', 'editor', 'api_ro'];

/** Removes `--` line comments (no string literal in this file contains `--`). */
const stripComments = (sql: string): string =>
  sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

/** Normalises SQL for structural comparison: no quoted identifiers, single spaces. */
const norm = (sql: string): string => sql.replace(/"/g, '').replace(/\s+/g, ' ').trim();

/** Splits an expression at top-level (outside parentheses and string literals) occurrences of `sep`. */
function splitTop(expr: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i] ?? '';
    if (c === "'") inStr = !inStr;
    if (inStr) continue;
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && expr.startsWith(sep, i)) {
      out.push(expr.slice(start, i).trim());
      i += sep.length - 1;
      start = i + 1;
    }
  }
  out.push(expr.slice(start).trim());
  return out;
}

/** Removes one pair of parentheses that wrap the whole expression. */
function unwrap(expr: string): string {
  if (!expr.startsWith('(') || !expr.endsWith(')')) return expr;
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === "'") inStr = !inStr;
    if (inStr) continue;
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth === 0 && i < expr.length - 1) return expr;
  }
  return expr.slice(1, -1).trim();
}

function loadStatements(): string[] {
  return readFileSync(GATES, 'utf8')
    .split(/-->\s*statement-breakpoint/)
    .map((s) => norm(stripComments(s)).replace(/;$/, ''))
    .filter((s) => s.length > 0);
}

/** Body of a named CHECK constraint, e.g. `builds_publication_ck`. */
function checkBody(stmts: string[], name: string, table: string): string {
  const re = new RegExp(`^ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK \\((.*)\\)$`, 'i');
  const hits = stmts.map((s) => re.exec(s)).filter((m): m is RegExpExecArray => m !== null);
  expect(hits, `CHECK ${name} on ${table}`).toHaveLength(1);
  return hits[0]?.[1] ?? '';
}

/**
 * Asserts the CHECK has the shape `guard OR (req1 AND req2 AND ...)`:
 * the guard is the only disjunct that lets a row bypass the requirements.
 */
function expectGuarded(body: string, guard: string, required: string[]): void {
  const disjuncts = splitTop(body, ' OR ');
  expect(disjuncts, body).toHaveLength(2);
  expect(disjuncts[0], 'guard').toBe(guard);
  const conjuncts = splitTop(unwrap(disjuncts[1] ?? ''), ' AND ').map(norm);
  for (const req of required) {
    expect(conjuncts, `requirement "${req}"`).toContain(req);
  }
}

function statementsOf(stmts: string[], re: RegExp): string[] {
  return stmts.filter((s) => re.test(s));
}

const stmtsCache = { value: null as string[] | null };
const allStmts = (): string[] => {
  stmtsCache.value ??= loadStatements();
  return stmtsCache.value;
};

describe('0001_gates.sql: file and integrity', () => {
  it('is a sibling of the frozen 0000 migration and keeps 0000 byte-identical', () => {
    const sha = createHash('sha256').update(readFileSync(INITIAL)).digest('hex').toUpperCase();
    expect(sha).toBe(INITIAL_SHA256);
    expect(() => readFileSync(GATES, 'utf8')).not.toThrow();
  });

  it('contains only well-formed statements separated by drizzle breakpoints', () => {
    const stmts = allStmts();
    expect(stmts.length).toBeGreaterThan(0);
    for (const s of stmts) expect(s).not.toBe('');
  });

  it('uses no dynamic SQL (EXECUTE format / EXECUTE literal), no DROP/TRUNCATE of data', () => {
    const text = norm(stripComments(readFileSync(GATES, 'utf8')));
    expect(text).not.toMatch(/\bEXECUTE\s+(format\s*\(|')/i);
    expect(text).not.toMatch(/\bDROP\s+(TABLE|SCHEMA|DATABASE|TYPE|ROLE)\b/i);
    expect(text).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('embeds no credential material', () => {
    const text = norm(stripComments(readFileSync(GATES, 'utf8')));
    expect(text).not.toMatch(/PASSWORD|ENCRYPTED|md5|SCRAM/i);
  });
});

describe('publication gate on builds', () => {
  it('builds_publication_ck: publicado requires published_at, reviewed_by, approved rights and rights confirmation', () => {
    const body = checkBody(allStmts(), 'builds_publication_ck', 'builds');
    const disjuncts = splitTop(body, ' OR ');
    expect(disjuncts).toHaveLength(2);
    expect(disjuncts[0]).toBe("review_state <> 'publicado'");
    const conjuncts = splitTop(unwrap(disjuncts[1] ?? ''), ' AND ').map(norm);
    expect(conjuncts).toEqual(
      expect.arrayContaining([
        'published_at IS NOT NULL',
        'reviewed_by IS NOT NULL',
        'rights_confirmed_by IS NOT NULL',
        'rights_confirmed_on IS NOT NULL',
        `rights_status IN (${APPROVED_RIGHTS.map((r) => `'${r}'`).join(', ')})`,
      ]),
    );
  });

  it('builds_publication_ck does not admit pending rights (pending is not in the approved list)', () => {
    expect(APPROVED_RIGHTS).not.toContain('pending');
    const body = checkBody(allStmts(), 'builds_publication_ck', 'builds');
    expect(body).not.toMatch(/'pending'/);
  });

  it('gates_check_build raises check_violation for placeholder author and missing sources, and only when publicado', () => {
    const fn = statementsOf(allStmts(), /^CREATE OR REPLACE FUNCTION gates_check_build\(/);
    expect(fn).toHaveLength(1);
    const body = fn[0] ?? '';
    expect(body).toMatch(/RETURNS void/);
    expect(body).toMatch(/SET search_path/);
    // Early exit unless the build is publicado.
    expect(body).toMatch(/review_state <> 'publicado' THEN RETURN/);
    // Placeholder author: flag or the domain placeholder slug.
    expect(body).toMatch(/is_placeholder/);
    expect(body).toMatch(/slug = 'por-confirmar'/);
    // At least one build_sources row; raised as check_violation.
    expect(body).toMatch(/NOT EXISTS \(SELECT 1 FROM build_sources/);
    expect(body).toMatch(/ERRCODE = 'check_violation'/);
    expect(body.match(/RAISE EXCEPTION/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('wires deferred constraint triggers on builds, build_sources and authors', () => {
    const triggers = allStmts()
      .map((s) =>
        /^CREATE CONSTRAINT TRIGGER (\w+) AFTER (.+?) ON (\w+) DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION (\w+)\(\)$/.exec(
          s,
        ),
      )
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ events: m[2], table: m[3], fn: m[4] }));

    const byTable = (t: string) => triggers.find((x) => x.table === t);
    expect(byTable('builds')?.events).toBe('INSERT OR UPDATE');
    expect(byTable('build_sources')?.events).toBe('INSERT OR UPDATE OR DELETE');
    expect(byTable('authors')?.events).toBe('UPDATE');
    expect(triggers).toHaveLength(3);
  });

  it('build_sources and authors triggers re-check the affected published builds', () => {
    const text = allStmts().join('\n');
    expect(text).toMatch(
      /CREATE OR REPLACE FUNCTION gates_trg_build_sources\(\)[\s\S]*gates_check_build\(/,
    );
    expect(text).toMatch(
      /CREATE OR REPLACE FUNCTION gates_trg_authors\(\)[\s\S]*FROM builds WHERE author_id = NEW\.id/,
    );
  });
});

describe('tier_entries CHECK gates', () => {
  const stmts = () => allStmts();

  it('tier_entries_identity_ck: a row needs a build or a display name', () => {
    expect(checkBody(stmts(), 'tier_entries_identity_ck', 'tier_entries')).toBe(
      'build_id IS NOT NULL OR display_name IS NOT NULL',
    );
  });

  it('tier_entries_placeholder_ck: placeholder has sin_clasificar, no build, no external URL, content placeholder', () => {
    expectGuarded(
      checkBody(stmts(), 'tier_entries_placeholder_ck', 'tier_entries'),
      "entry_kind <> 'placeholder'",
      [
        "tier = 'sin_clasificar'",
        'build_id IS NULL',
        'external_url IS NULL',
        "content_status = 'placeholder'",
      ],
    );
  });

  it('tier_entries_link_only_ck: enlace_externo needs URL, external author, source and link_only rights', () => {
    expectGuarded(
      checkBody(stmts(), 'tier_entries_link_only_ck', 'tier_entries'),
      "entry_kind <> 'enlace_externo'",
      [
        'external_url IS NOT NULL',
        "btrim(external_url) <> ''",
        'external_author IS NOT NULL',
        "btrim(external_author) <> ''",
        'source_id IS NOT NULL',
        "rights_status = 'link_only'",
      ],
    );
  });

  it('tier_entries_build_ck: build_propia needs a build reference', () => {
    expectGuarded(
      checkBody(stmts(), 'tier_entries_build_ck', 'tier_entries'),
      "entry_kind <> 'build_propia'",
      ['build_id IS NOT NULL'],
    );
  });

  it('tier_entries_real_tier_ck: any real tier needs source and evaluated_on', () => {
    expectGuarded(
      checkBody(stmts(), 'tier_entries_real_tier_ck', 'tier_entries'),
      "tier = 'sin_clasificar'",
      ['source_id IS NOT NULL', 'evaluated_on IS NOT NULL'],
    );
  });
});

describe('asset gates', () => {
  it('assets_approved_provenance_ck: approved requires non-empty file_path and full provenance', () => {
    const cols = ['file_path', 'origin_url', 'rights_holder', 'license_or_permission', 'proof_ref'];
    const required = cols.flatMap((c) => [`${c} IS NOT NULL`, `btrim(${c}) <> ''`]);
    expectGuarded(
      checkBody(allStmts(), 'assets_approved_provenance_ck', 'assets'),
      "status <> 'approved'",
      required,
    );
  });

  it('assets_file_path_approved_ck: file_path is only allowed on approved assets', () => {
    const body = checkBody(allStmts(), 'assets_file_path_approved_ck', 'assets');
    expect(splitTop(body, ' OR ')).toEqual(['file_path IS NULL', "status = 'approved'"]);
  });
});

describe('anti-reimport gate after bootstrap', () => {
  const stmts = () => allStmts();

  it('gates_block_fixture_reimport rejects fixture rows once content_origin has its marker row', () => {
    const fn = statementsOf(
      stmts(),
      /^CREATE OR REPLACE FUNCTION gates_block_fixture_reimport\(\)/,
    );
    expect(fn).toHaveLength(1);
    const body = fn[0] ?? '';
    expect(body).toMatch(/RETURNS trigger/);
    expect(body).toMatch(/IF EXISTS \(SELECT 1 FROM content_origin\)/);
    expect(body).toMatch(/to_jsonb\(NEW\) ->> 'origin' = 'fixture'/);
    expect(body).toMatch(/RAISE EXCEPTION/);
    expect(body).toMatch(/ERRCODE = 'check_violation'/);
  });

  it('attaches a BEFORE INSERT OR UPDATE row trigger to every editorial table with an origin column', () => {
    const tables = stmts()
      .map((s) =>
        /^CREATE TRIGGER (\w+) BEFORE INSERT OR UPDATE ON (\w+) FOR EACH ROW EXECUTE FUNCTION gates_block_fixture_reimport\(\)$/.exec(
          s,
        ),
      )
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => m[2])
      .sort();
    expect(tables).toEqual(['authors', 'builds', 'sources', 'tier_entries', 'tier_lists']);
  });

  it('makes content_origin single-row and append-only', () => {
    const text = stmts().join('\n');
    expect(text).toMatch(/CREATE UNIQUE INDEX \w+ ON content_origin \(\(true\)\)/);
    expect(text).toMatch(
      /CREATE TRIGGER \w+ BEFORE UPDATE OR DELETE ON content_origin FOR EACH ROW EXECUTE FUNCTION gates_block_content_origin_change\(\)/,
    );
    const fn = statementsOf(
      stmts(),
      /^CREATE OR REPLACE FUNCTION gates_block_content_origin_change\(\)/,
    );
    expect(fn[0]).toMatch(/RAISE EXCEPTION/);
  });
});

describe('public views', () => {
  const view = (name: string): string => {
    const hits = statementsOf(allStmts(), new RegExp(`^CREATE VIEW ${name} AS SELECT `));
    expect(hits, name).toHaveLength(1);
    return hits[0] ?? '';
  };
  const selectList = (v: string): string => {
    const m = /^CREATE VIEW \w+ AS SELECT (.*?) FROM /.exec(v);
    expect(m, v.slice(0, 80)).not.toBeNull();
    return m?.[1] ?? '';
  };
  const whereConjuncts = (v: string): string[] => {
    const idx = v.indexOf(' WHERE ');
    expect(idx, 'WHERE clause').toBeGreaterThan(-1);
    return splitTop(v.slice(idx + ' WHERE '.length), ' AND ').map(norm);
  };

  it('creates exactly the five v_public_* views and nothing else in view form', () => {
    const names = allStmts()
      .map((s) => /^CREATE VIEW (\w+) AS/.exec(s)?.[1])
      .filter((n): n is string => n !== undefined)
      .sort();
    expect(names).toEqual(PUBLIC_VIEWS);
  });

  it('v_public_builds exposes only publicado builds with approved rights and no internal audit columns', () => {
    const v = view('v_public_builds');
    expect(whereConjuncts(v)).toEqual(
      expect.arrayContaining([
        "review_state = 'publicado'",
        `rights_status IN (${APPROVED_RIGHTS.map((r) => `'${r}'`).join(', ')})`,
      ]),
    );
    const list = selectList(v);
    expect(list).not.toMatch(/\*/);
    for (const internal of [
      'rights_notes',
      'rights_confirmed_by',
      'rights_confirmed_on',
      'reviewed_by',
      'reviewed_at',
      'origin',
    ]) {
      expect(list, internal).not.toMatch(new RegExp(`\\b${internal}\\b`));
    }
  });

  it('v_public_tier_lists exposes only publicado lists', () => {
    const v = view('v_public_tier_lists');
    expect(whereConjuncts(v)).toContain("review_state = 'publicado'");
    expect(selectList(v)).not.toMatch(/\borigin\b|\*/);
  });

  it('v_public_tier_entries requires a publicado list, approved rights, and a publicado build when linked', () => {
    const v = view('v_public_tier_entries');
    const conj = whereConjuncts(v);
    expect(conj).toContain("review_state = 'publicado'");
    expect(conj).toContain(`rights_status IN (${APPROVED_RIGHTS.map((r) => `'${r}'`).join(', ')})`);
    expect(
      conj.some((c) =>
        /^EXISTS \(SELECT 1 FROM tier_lists tl WHERE tl\.id = tier_list_id AND tl\.review_state = 'publicado'\)$/.test(
          c,
        ),
      ),
    ).toBe(true);
    expect(
      conj.some((c) =>
        /build_id IS NULL OR EXISTS \(SELECT 1 FROM builds b WHERE b\.id = build_id AND b\.review_state = 'publicado'/.test(
          c,
        ),
      ),
    ).toBe(true);
    expect(selectList(v)).not.toMatch(/\borigin\b|\*/);
  });

  it('v_public_authors hides placeholder authors', () => {
    expect(whereConjuncts(view('v_public_authors'))).toContain('is_placeholder = false');
  });

  it('v_public_assets exposes file path and provenance only for approved assets', () => {
    const list = selectList(view('v_public_assets'));
    for (const col of [
      'file_path',
      'origin_url',
      'rights_holder',
      'license_or_permission',
      'proof_ref',
    ]) {
      expect(list, col).toContain(`CASE WHEN status = 'approved' THEN ${col} END AS ${col}`);
    }
    expect(list).toMatch(/\bfallback_svg\b/);
  });
});

describe('roles', () => {
  const text = () => norm(stripComments(readFileSync(GATES, 'utf8')));

  it('creates exactly the four roles, all NOLOGIN with no privileged attributes', () => {
    const created = [...text().matchAll(/CREATE ROLE (\w+) ([^;]*);/g)].map((m) => ({
      name: m[1] ?? '',
      attrs: m[2] ?? '',
    }));
    expect(created.map((c) => c.name).sort()).toEqual([...ROLES].sort());
    for (const { name, attrs } of created) {
      expect(attrs, name).toMatch(/\bNOLOGIN\b/);
      expect(attrs, name).not.toMatch(/\bLOGIN\b/);
      expect(attrs, name).not.toMatch(
        /SUPERUSER|BYPASSRLS|CREATEROLE|CREATEDB|REPLICATION|PASSWORD/,
      );
    }
  });

  it('creates roles idempotently (guarded by pg_roles lookup, no error on re-apply)', () => {
    expect(text()).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'migrator'\)/);
    expect(text()).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'api_ro'\)/);
  });

  it('never grants to PUBLIC', () => {
    for (const g of grants()) expect(g.grantee).not.toBe('PUBLIC');
  });

  it('api_ro: schema usage, then SELECT on the five v_public_* views and nothing else', () => {
    const mine = grants().filter((g) => g.grantee === 'api_ro');
    const schema = mine.filter((g) => g.object === 'SCHEMA public');
    expect(schema.map((g) => g.privileges)).toEqual([['USAGE']]);
    const rest = mine.filter((g) => g.object !== 'SCHEMA public');
    for (const g of rest) {
      expect(g.privileges, g.object).toEqual(['SELECT']);
    }
    expect(rest.map((g) => g.object).sort()).toEqual([...PUBLIC_VIEWS].sort());
  });

  it('api_ro is never granted write privileges, base tables, or ALL', () => {
    const mine = grants().filter((g) => g.grantee === 'api_ro');
    for (const g of mine) {
      expect(g.privileges).not.toContain('ALL');
      for (const p of g.privileges)
        expect(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']).not.toContain(
          p,
        );
      expect(g.object).not.toMatch(/ALL TABLES|ALL SEQUENCES|ALL FUNCTIONS/);
    }
  });

  it('importer: DML on exactly the 0000 base tables, schema usage only, no views or DDL', () => {
    const initialTables = [...readFileSync(INITIAL, 'utf8').matchAll(/CREATE TABLE "(\w+)"/g)].map(
      (m) => m[1] ?? '',
    );
    expect(initialTables.length).toBeGreaterThan(10);
    const mine = grants().filter((g) => g.grantee === 'importer');
    const dml = mine.filter((g) => g.object !== 'SCHEMA public');
    expect(dml.map((g) => g.object).sort()).toEqual([...initialTables].sort());
    for (const g of dml)
      expect(g.privileges.sort()).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
    expect(mine.filter((g) => g.object === 'SCHEMA public').map((g) => g.privileges)).toEqual([
      ['USAGE'],
    ]);
  });

  it('migrator: schema USAGE and CREATE only, no table DML', () => {
    const mine = grants().filter((g) => g.grantee === 'migrator');
    expect(mine.map((g) => ({ object: g.object, privileges: g.privileges.sort() }))).toEqual([
      { object: 'SCHEMA public', privileges: ['CREATE', 'USAGE'] },
    ]);
  });

  it('editor is reserved: it receives no grants at all', () => {
    expect(grants().filter((g) => g.grantee === 'editor')).toEqual([]);
  });

  it('no GRANT ALL PRIVILEGES anywhere', () => {
    expect(text()).not.toMatch(/GRANT ALL/i);
  });
});

/** Parses top-level GRANT statements (not REVOKE) into privileges/object/grantee. */
function grants(): { privileges: string[]; object: string; grantee: string }[] {
  return allStmts()
    .map((s) => /^GRANT (.+?) ON (.+?) TO (\w+)$/.exec(s))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({
      privileges: (m[1] ?? '').split(', '),
      object: m[2] ?? '',
      grantee: m[3] ?? '',
    }));
}
