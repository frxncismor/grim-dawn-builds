import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { AuthorSchema, BuildSchema, SourceSchema, TierListSchema } from '@gd/domain';

/*
 * Adversarial fixtures (T-141, plan §17.49). The `builds/` folder only holds
 * documents the schema must reject, so `content:validate` is a folder of
 * rejections. Hostile text that the schema degrades to an inert value lives in
 * `safe-values/` and is asserted separately. Authors, sources and tier lists
 * are validated with the same domain schemas the seed/bootstrap paths use,
 * because `content:validate` only walks `builds/` today.
 */

const root = join(import.meta.dirname, '../../..');
const fixtures = join('scripts', 'fixtures', 'adversarial');

interface SchemaIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

interface ParseResult {
  readonly success: boolean;
  readonly error?: { readonly issues: readonly SchemaIssue[] };
}

interface ParsedSchema {
  safeParse(value: unknown): ParseResult;
}

interface ExpectedIssue {
  readonly path: string;
  readonly message: string;
}

function issuesOf(result: ParseResult): ExpectedIssue[] {
  if (result.success) return [];
  return (result.error?.issues ?? []).map((issue) => ({
    path: issue.path.length ? issue.path.map(String).join('.') : '(raíz)',
    message: issue.message,
  }));
}

function readJson(dir: string, name: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, dir, name), 'utf8')) as unknown;
}

const BUILD_ISSUES: Record<string, readonly ExpectedIssue[]> = {
  'extra-fields.json': [
    { path: '(raíz)', message: 'Unrecognized key: "campo_inyectado"' },
    { path: 'author', message: 'Unrecognized key: "rol_admin"' },
    { path: 'sources.0', message: 'Unrecognized key: "evidence_ref"' },
  ],
  'missing-fields.json': [
    { path: 'rights_status', message: 'Invalid option' },
    { path: 'author', message: 'expected object' },
    { path: 'skill_nodes.0.name_es', message: 'expected string' },
  ],
  'wrong-types.json': [
    { path: 'title', message: 'expected string, received number' },
    { path: 'summary', message: 'expected string, received array' },
    { path: 'published_at', message: 'expected string, received boolean' },
    { path: 'hero_callout_body', message: 'expected array, received string' },
  ],
  'rights-falsified.json': [
    { path: 'rights_status', message: 'publicado no admite rights_status=pending' },
    { path: 'author_slug', message: 'publicado requiere un autor confirmado' },
    { path: 'rights_confirmed_by', message: 'publicado requiere confirmación de derechos' },
  ],
  'broken-references.json': [
    { path: 'source_slugs', message: 'referencias de fuentes incoherentes' },
    { path: 'skill_nodes.0.mastery_slug', message: 'maestría desconocida' },
  ],
  'parent-cycle.json': [{ path: 'skill_nodes', message: 'ciclo de padres' }],
  'traversal-slug.json': [{ path: 'slug', message: 'slug en minúsculas ASCII' }],
  'javascript-url.json': [
    { path: 'video_url', message: 'URL HTTP(S) requerida' },
    { path: 'sources.0.url', message: 'URL HTTP(S) requerida' },
  ],
  'oversized-input.json': [
    { path: 'slug', message: 'slug en minúsculas ASCII' },
    { path: 'masteries', message: 'expected array to have <=2 items' },
  ],
};

const COLLECTION_ISSUES: Record<string, Record<string, readonly ExpectedIssue[]>> = {
  authors: {
    'extra-private-field.json': [{ path: '(raíz)', message: 'Unrecognized key: "reviewed_by"' }],
    'traversal-slug.json': [{ path: 'slug', message: 'slug en minúsculas ASCII' }],
    'javascript-url.json': [{ path: 'url', message: 'URL HTTP(S) requerida' }],
  },
  sources: {
    'extra-private-field.json': [{ path: '(raíz)', message: 'Unrecognized key: "evidence_ref"' }],
    'javascript-url.json': [{ path: 'url', message: 'URL HTTP(S) requerida' }],
    'unknown-kind.json': [{ path: 'kind', message: 'expected one of' }],
  },
  'tier-lists': {
    'unknown-combination.json': [
      { path: 'entries.0.combination_slug', message: 'combinación desconocida' },
    ],
    'external-with-own-rights.json': [
      {
        path: 'entries.0.rights_status',
        message: 'enlace_externo requiere rights_status=link_only',
      },
    ],
    'external-without-url.json': [
      { path: 'entries.0.external_url', message: 'enlace_externo requiere URL' },
    ],
    'traversal-slug.json': [{ path: 'slug', message: 'slug en minúsculas ASCII' }],
    'extra-private-field.json': [
      { path: 'sources.0', message: 'Unrecognized key: "evidence_ref"' },
    ],
  },
};

const COLLECTION_SCHEMAS: Record<string, ParsedSchema> = {
  authors: AuthorSchema,
  sources: SourceSchema,
  'tier-lists': TierListSchema,
};

function jsonFiles(dir: string): string[] {
  return readdirSync(join(fixtures, dir)).filter((name) => name.endsWith('.json'));
}

function assertExpectedIssues(
  label: string,
  actual: readonly ExpectedIssue[],
  expected: readonly ExpectedIssue[],
): void {
  for (const wanted of expected) {
    const match = actual.find(
      (issue) => issue.path === wanted.path && issue.message.includes(wanted.message),
    );
    assert.ok(
      match,
      `${label}: expected ${wanted.path} to include "${wanted.message}", got ${JSON.stringify(actual)}`,
    );
  }
}

function runContentValidate(): { status: number | null; output: string } {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', join('scripts', 'validate-content.mts'), '--dir', fixtures],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.error, undefined, `content:validate could not start: ${result.error}`);
  return { status: result.status, output: `${result.stderr ?? ''}${result.stdout ?? ''}` };
}

/** Parses `file: path: message` lines emitted by `content:validate`. */
function parseValidateOutput(output: string): Map<string, ExpectedIssue[]> {
  const byFile = new Map<string, ExpectedIssue[]>();
  const pattern = /^(builds[\\/][^:]+): (\(raíz\)|[^:]+): (.+)$/;
  for (const line of output.split(/\r?\n/)) {
    const match = pattern.exec(line);
    if (!match) continue;
    const file = match[1].replace(/\\/g, '/');
    const issue = { path: match[2], message: match[3] };
    byFile.set(file, [...(byFile.get(file) ?? []), issue]);
  }
  return byFile;
}

describe('adversarial fixtures under scripts/fixtures/adversarial', () => {
  it('content:validate rejects every build fixture and reports the expected path', () => {
    const { status, output } = runContentValidate();
    assert.equal(status, 1, output);

    const reported = parseValidateOutput(output);
    assert.deepEqual(
      [...reported.keys()].sort(),
      jsonFiles('builds')
        .map((name) => `builds/${name}`)
        .sort(),
      `every build fixture must be rejected (${output})`,
    );
    for (const [name, expected] of Object.entries(BUILD_ISSUES))
      assertExpectedIssues(`builds/${name}`, reported.get(`builds/${name}`) ?? [], expected);
  });

  it('rejects every author, source and tier-list fixture with the same schemas', () => {
    for (const [dir, expectedFiles] of Object.entries(COLLECTION_ISSUES)) {
      assert.deepEqual(jsonFiles(dir).sort(), Object.keys(expectedFiles).sort(), dir);
      for (const [name, expected] of Object.entries(expectedFiles)) {
        const result = COLLECTION_SCHEMAS[dir].safeParse(readJson(dir, name));
        assert.equal(result.success, false, `${dir}/${name} must be rejected`);
        assertExpectedIssues(`${dir}/${name}`, issuesOf(result), expected);
      }
    }
  });

  it('degrades hostile text to the identical inert value instead of rejecting it', () => {
    const html = BuildSchema.safeParse(readJson('safe-values', 'html-text.json'));
    assert.equal(html.success, true);
    if (!html.success) return;
    assert.equal(html.data.title, '<script>alert(1)</script>');
    assert.equal(html.data.summary, '"><img src=x onerror=alert(1)>');
    assert.equal(html.data.footer_disclaimer, '<svg onload=alert(1)>');
    assert.equal(html.data.author.display_name, '<b>Autor</b>');
    assert.equal(html.data.sources[0]?.title, '<img src=x onerror=alert(2)>');

    const unicodeText = BuildSchema.safeParse(readJson('safe-values', 'unicode-text.json'));
    assert.equal(unicodeText.success, true);
    if (!unicodeText.success) return;
    assert.equal(unicodeText.data.title, 'Cham\u0061\u0301n + Demoledor');
    assert.ok(unicodeText.data.summary.includes('\u202Egnp.exe'));
    assert.ok(unicodeText.data.summary.includes('\u0441haman'));

    const empty = BuildSchema.safeParse(readJson('safe-values', 'nulls-and-empty.json'));
    assert.equal(empty.success, true);
    if (!empty.success) return;
    assert.equal(empty.data.author.bio, null);
    assert.deepEqual(empty.data.notes, []);
    assert.equal(empty.data.sections_meta[0]?.visible, false);
  });
});
