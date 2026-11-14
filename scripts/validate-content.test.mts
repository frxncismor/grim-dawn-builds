import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { MasteryTreeSchema } from '@gd/domain';
import { validateBuildFiles } from './validate-content.mts';

const fixtureJson = (path: string): any =>
  JSON.parse(readFileSync(new URL('../fixtures/content/' + path, import.meta.url), 'utf8'));
const guide = fixtureJson('builds/chaman-demoledor-golpe-primigenio.json');
const catalog = ['shaman', 'demolition'].map((s) =>
  MasteryTreeSchema.parse(fixtureJson('mastery-trees/' + s + '.json')),
);
const withRef = (skill_node_id: string) => ({
  ...guide,
  skill_nodes: guide.skill_nodes.map((n: any, i: number) =>
    i === 0 ? { ...n, skill_node_id } : n,
  ),
});

const withDuplicateRef = () => ({
  ...guide,
  skill_nodes: guide.skill_nodes.map((n: any, i: number) =>
    i < 2 ? { ...n, skill_node_id: catalog[0]!.nodes[0]!.id } : n,
  ),
});

const validDraft: Record<string, unknown> = JSON.parse(
  readFileSync(
    new URL('./fixtures/content-valid/builds/valid-draft.json', import.meta.url),
    'utf8',
  ),
);

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

describe('validateBuildFiles con catálogo (T016)', () => {
  const run = (data: unknown) => validateBuildFiles([{ file: 'builds/g.json', data }], catalog);

  it('la guía actual sigue válida sin skill_node_id', () => {
    assert.deepEqual(run(guide), []);
  });

  it('acepta una referencia válida', () => {
    assert.deepEqual(run(withRef(catalog[0]!.nodes[0]!.id)), []);
  });

  it('un id inexistente falla con archivo, nodo y motivo', () => {
    const issues = run(withRef('class06/no-existe'));
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.file, 'builds/g.json');
    assert.equal(issues[0]!.path, 'skill_nodes.0.skill_node_id');
    assert.match(issues[0]!.message, /golpe-primigenio.*no existe en el catálogo/);
  });

  it('un skill_node_id repetido en la guía falla nombrando el primer nodo (T035)', () => {
    const issues = run(withDuplicateRef());
    assert.ok(
      issues.some((i) => i.path === 'skill_nodes.1.skill_node_id' && /repetido/.test(i.message)),
    );
  });

  it('un id de otra maestría falla', () => {
    const issues = run(withRef(catalog[1]!.nodes[0]!.id));
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /otra maestría/);
  });

  it('un id con formato inválido falla por esquema', () => {
    const issues = run(withRef('golpe-primigenio'));
    assert.ok(issues.some((i) => i.path === 'skill_nodes.0.skill_node_id'));
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

  it('exits 1 naming the node when skill_node_id is not in the catalog', () => {
    const dir = mkdtempSync(join(tmpdir(), 'content-ref-'));
    mkdirSync(join(dir, 'builds'));
    cpSync(join('fixtures', 'content', 'mastery-trees'), join(dir, 'mastery-trees'), {
      recursive: true,
    });
    writeFileSync(join(dir, 'builds', 'g.json'), JSON.stringify(withRef('class06/no-existe')));
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /golpe-primigenio.*no existe en el catálogo/);
  });
});
