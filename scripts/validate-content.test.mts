import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { validateBuildFiles } from './validate-content.mts';

const validDraft = {
  slug: 'chaman-demoledor-golpe-primigenio',
  locale: 'es',
  title: 'Chamán + Demoledor',
  author_slug: 'por-confirmar',
  source_slugs: ['guia-original'],
  game_version: '1.2.x',
  review_state: 'borrador',
  rights_status: 'pending',
  rights_confirmed_by: null,
  rights_confirmed_on: null,
  content_status: 'sin_verificar',
  reviewed_by: null,
  published_at: null,
  skill_nodes: [{ slug: 'golpe-primigenio', bar_required: 5, parent_slug: null }],
};

describe('validateBuildFiles', () => {
  it('passes a valid draft build', () => {
    const issues = validateBuildFiles([{ file: 'builds/a.json', data: validDraft }]);
    assert.deepEqual(issues, []);
  });

  it('reports the file and the field path for an invalid build', () => {
    const issues = validateBuildFiles([
      { file: 'builds/a.json', data: { ...validDraft, rights_status: 'unknown' } },
    ]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].file, 'builds/a.json');
    assert.equal(issues[0].path, 'rights_status');
  });

  it('blocks publicado while rights are pending', () => {
    const issues = validateBuildFiles([
      { file: 'builds/a.json', data: { ...validDraft, review_state: 'publicado' } },
    ]);
    assert.ok(issues.some((i) => i.path === 'rights_status'));
  });
});

describe('content:validate CLI', () => {
  const run = (dir: string) =>
    spawnSync(
      process.execPath,
      ['--import', 'tsx', join('scripts', 'validate-content.mts'), '--dir', dir],
      { encoding: 'utf8' },
    );

  it('exits 0 for the valid fixture', () => {
    const result = run(join('scripts', 'fixtures', 'content-valid'));
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it('exits 1 and names the invalid field for the invalid fixture', () => {
    const result = run(join('scripts', 'fixtures', 'content-invalid'));
    assert.equal(result.status, 1);
    assert.match(result.stderr + result.stdout, /rights_status/);
  });

  it('exits 1 when the builds folder is missing', () => {
    const result = run(join('scripts', 'fixtures', 'no-such-dir'));
    assert.equal(result.status, 1);
  });
});
