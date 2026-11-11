import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  oneLine,
  orchestratorPrompt,
  parseCliArgs,
  planSpace,
  spaceName,
} from './herdr-space.mts';

test('space names follow <project>/<specialty> in lowercase with dashes', () => {
  assert.equal(spaceName('grim-dawn-builds', 'ui'), 'grim-dawn-builds/ui');
  for (const [project, specialty] of [
    ['Grim-Dawn', 'ui'],
    ['grim dawn', 'ui'],
    ['grim-dawn', 'UI'],
    ['grim-dawn', '../ui'],
    ['grim-dawn', ''],
    ['', 'ui'],
  ])
    assert.throws(() => spaceName(project, specialty), /inválid/, `${project}/${specialty}`);
});

test('the orchestrator prompt is one line and keeps the task and delegation rules', () => {
  const prompt = orchestratorPrompt('grim-dawn-builds', 'ui', 'Cerrar T-138\ncon evidencia');
  assert.doesNotMatch(prompt, /[\r\n]/);
  assert.match(prompt, /ORQUESTADOR DE DOMINIO de ui/);
  assert.match(prompt, /subagentes/);
  assert.match(prompt, /Tarea: Cerrar T-138 con evidencia/);
  assert.equal(oneLine('  a \n b  '), 'a b');
  assert.throws(() => oneLine('  '), /vacío/);
});

test('plans a new space with the prompt inside argv, never as a positional directory', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'gd-herdr-space-'));
  const plan = planSpace({
    project: 'grim-dawn-builds',
    specialty: 'ui',
    folder,
    task: 'Cerrar T-146',
    app: 'C:/tools/herdr-app.exe',
  });
  assert.equal(plan.name, 'grim-dawn-builds/ui');
  assert.equal(plan.tab, 'ui');
  assert.deepEqual(plan.argv.slice(0, 3), ['opencode', '--auto', '--prompt']);
  assert.match(plan.argv[3]!, /Tarea: Cerrar T-146/);
  assert.deepEqual(plan.command, [
    'C:/tools/herdr-app.exe',
    'do',
    'space.new',
    '--name',
    'grim-dawn-builds/ui',
    '--folder',
    resolve(folder),
    '--tab',
    'ui',
    '--argv',
    JSON.stringify(plan.argv),
  ]);
  assert.equal(plan.command.includes('--task'), false);
});

test('rejects relative or missing folders instead of launching in an unknown place', async () => {
  assert.throws(
    () => planSpace({ project: 'grim-dawn-builds', specialty: 'ui', folder: '.', task: 'x' }),
    /absoluta/,
  );
  assert.throws(
    () =>
      planSpace({
        project: 'grim-dawn-builds',
        specialty: 'ui',
        folder: join(tmpdir(), 'gd-no-existe-herdr-space'),
        task: 'x',
      }),
    /no existe/,
  );
  const file = join(await mkdtemp(join(tmpdir(), 'gd-herdr-file-')), 'file.txt');
  await writeFile(file, 'x');
  assert.throws(
    () => planSpace({ project: 'grim-dawn-builds', specialty: 'ui', folder: file, task: 'x' }),
    /no es un directorio/,
  );
});

test('CLI defaults the project to the folder name and requires specialty and task', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'gd-herdr-cli-'));
  const options = parseCliArgs(
    ['--specialty', 'tests', '--task', 'T-144', '--folder', folder, '--print'],
    'C:/elsewhere',
  );
  assert.match(options.project, /^gd-herdr-cli-[A-Za-z0-9]+$/);
  assert.equal(options.specialty, 'tests');
  assert.equal(options.task, 'T-144');
  assert.equal(options.print, true);
  assert.throws(() => parseCliArgs(['--task', 'x'], 'C:/x'), /Falta --specialty/);
  assert.throws(() => parseCliArgs(['--specialty', 'ui'], 'C:/x'), /Falta --task/);
  assert.throws(() => parseCliArgs(['--specialty', 'ui', '--task'], 'C:/x'), /Falta el valor/);
  assert.throws(() => parseCliArgs(['--otra', 'x'], 'C:/x'), /Argumento no válido/);
});
