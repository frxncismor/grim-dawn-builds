import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * T-147: abre un espacio de Herdr por orquestador de dominio.
 *
 * El nivel 0 nunca abre pestañas de dominio en su propia instancia: cada
 * especialidad vive en un espacio nuevo llamado `<proyecto>/<especialidad>`, con
 * un orquestador interactivo que despacha a sus propios subagentes.
 */

export const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
export const SPACE_USAGE =
  'Uso: tsx scripts/herdr-space.mts --specialty <dominio> [--project <nombre>] [--folder <ruta absoluta>] [--task <texto>] [--app <ruta>] [--print]';

export interface SpaceRequest {
  readonly project: string;
  readonly specialty: string;
  readonly folder: string;
  readonly task: string;
  readonly app?: string;
}

export interface SpacePlan {
  readonly name: string;
  readonly tab: string;
  readonly prompt: string;
  readonly argv: readonly string[];
  /** Executable followed by its arguments, ready for spawnSync. */
  readonly command: readonly string[];
}

export function oneLine(text: string): string {
  const value = text.replace(/\s+/g, ' ').trim();
  if (!value) throw new Error('El prompt del orquestador no puede estar vacío.');
  return value;
}

export function spaceName(project: string, specialty: string): string {
  if (!SEGMENT.test(project))
    throw new Error(
      `Proyecto inválido: «${project}». Usa minúsculas, dígitos y guiones (p. ej. grim-dawn-builds).`,
    );
  if (!SEGMENT.test(specialty))
    throw new Error(
      `Especialidad inválida: «${specialty}». Usa minúsculas, dígitos y guiones (p. ej. ui, tests, backend).`,
    );
  return `${project}/${specialty}`;
}

export function orchestratorPrompt(project: string, specialty: string, task: string): string {
  return oneLine(
    `Eres el ORQUESTADOR DE DOMINIO de ${specialty} del proyecto ${project}. ` +
      'Lee AGENTS.md, CONTRIBUTING.md, la constitución y los artefactos SDD antes de actuar. ' +
      'Despacha sub-tareas auto-contenidas a TUS propios subagentes; no implementes lo que puedas delegar. ' +
      'Verifica con comandos y salida real, no marques tareas sin evidencia y reporta al nivel 0 con alcance, archivos, verificación, desviaciones, bloqueos y siguiente paso. ' +
      `Tarea: ${task}`,
  );
}

export function planSpace(request: SpaceRequest): SpacePlan {
  const name = spaceName(request.project, request.specialty);
  if (!isAbsolute(request.folder))
    throw new Error(`La carpeta debe ser absoluta: «${request.folder}».`);
  let directory;
  try {
    directory = statSync(request.folder);
  } catch {
    throw new Error(`La carpeta no existe: «${request.folder}».`);
  }
  if (!directory.isDirectory())
    throw new Error(`La carpeta no es un directorio: «${request.folder}».`);

  const prompt = orchestratorPrompt(request.project, request.specialty, request.task);
  const argv = ['opencode', '--auto', '--prompt', prompt];
  const command = [
    request.app ?? 'herdr-app',
    'do',
    'space.new',
    '--name',
    name,
    '--folder',
    resolve(request.folder),
    '--tab',
    request.specialty,
    '--argv',
    JSON.stringify(argv),
  ];
  return { name, tab: request.specialty, prompt, argv, command };
}

export interface CliOptions extends SpaceRequest {
  readonly print: boolean;
}

export function parseCliArgs(argv: readonly string[], cwd: string): CliOptions {
  const values = new Map<string, string>();
  let print = false;
  const flags = new Set(['--project', '--specialty', '--folder', '--task', '--app']);
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]!;
    if (flag === '--print') {
      print = true;
      continue;
    }
    if (!flags.has(flag)) throw new Error(`Argumento no válido: «${flag}». ${SPACE_USAGE}`);
    const value = argv[++index];
    if (value === undefined || value.startsWith('--'))
      throw new Error(`Falta el valor de ${flag}. ${SPACE_USAGE}`);
    values.set(flag.slice(2), value);
  }
  const folder = values.get('folder') ?? cwd;
  const specialty = values.get('specialty');
  if (!specialty) throw new Error(`Falta --specialty. ${SPACE_USAGE}`);
  const task = values.get('task');
  if (!task) throw new Error(`Falta --task con la tarea del orquestador. ${SPACE_USAGE}`);
  const project = values.get('project') ?? basename(resolve(folder));
  const app = values.get('app');
  return { project, specialty, folder, task, app, print };
}

export function runSpace(plan: SpacePlan): number {
  const [executable, ...args] = plan.command;
  const result = spawnSync(executable!, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function main(argv: string[]): Promise<number> {
  try {
    const options = parseCliArgs(argv, process.cwd());
    const plan = planSpace(options);
    if (options.print) {
      console.log(JSON.stringify({ space: plan.name, tab: plan.tab, command: plan.command }, null, 2));
      console.log(
        'Comprobación pendiente tras lanzar: `herdr-app ls` debe mostrar `app` y `status` no nulos.',
      );
      return 0;
    }
    const status = runSpace(plan);
    if (status !== 0) {
      console.error(`herdr-space FALLÓ: herdr-app terminó con código ${status}.`);
      return status;
    }
    console.log(
      `Espacio «${plan.name}» solicitado. Verifica con \`herdr-app ls\` que app y status no son nulos.`,
    );
    return 0;
  } catch (error) {
    console.error(`herdr-space FALLÓ: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
