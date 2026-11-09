/**
 * setup-env (T-079): prepara el entorno local de Docker sin imprimir secretos.
 *
 * Crea `infra/docker/.env` y un archivo por campo secreto en `infra/docker/secrets/`
 * a partir de `infra/docker/.env.example` (constitución XII; plan §13.2):
 * - Cada campo secreto (`isSecretName`, p. ej. `DB_PASSWORD_API_RO`) recibe una
 *   contraseña aleatoria propia de `crypto.randomBytes(24)` en base64url (32 caracteres,
 *   segura para `.env` y URLs). Ningún rol comparte valor con otro.
 * - Idempotente y sin sobrescribir: el valor no vacío de `.env` manda; si falta, se
 *   reutiliza el del archivo de secretos; solo si ambos faltan se genera uno nuevo.
 *   Los campos vacíos de un `.env` existente se rellenan; el resto se conserva tal cual.
 * - Fallo cerrado: no escribe nada si `root` no es la raíz de un repositorio git o si
 *   `.env` o un archivo de secretos no está ignorado por git (T-080).
 * - Ningún valor secreto aparece en la salida ni en los mensajes de error: solo
 *   acciones, rutas y recuentos.
 *
 * Uso: `pnpm setup:env [--root <dir>]`. Sin dependencias nuevas.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isSecretName } from './check-secrets.mts';

/** Mínimo de bytes aleatorios por contraseña de rol (plan §13.2). */
export const PASSWORD_BYTES = 24;

const TEMPLATE_POSIX = 'infra/docker/.env.example';
const ENV_POSIX = 'infra/docker/.env';
const SECRETS_DIR_POSIX = 'infra/docker/secrets';
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

export type ActionKind = 'creado' | 'actualizado' | 'conservado';

export interface SetupAction {
  path: string;
  action: ActionKind;
}

export interface SetupReport {
  actions: SetupAction[];
  /** Número de campos secretos a los que se les asignó un valor nuevo (nunca los valores). */
  generated: number;
  /** Avisos sin valores, p. ej. un archivo de secretos que difiere de `.env`. */
  warnings: string[];
}

/** Contraseña aleatoria de un rol: `PASSWORD_BYTES` bytes codificados en base64url. */
export function generatePassword(): string {
  return randomBytes(PASSWORD_BYTES).toString('base64url');
}

function normalizePath(path: string): string {
  const slashes = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? slashes.toLowerCase() : slashes;
}

function runGit(root: string, args: string[]) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

/** Falla cerrado si `root` no es la raíz de un repositorio git (no subir a un repo padre). */
function assertGitRoot(root: string): void {
  const result = runGit(root, ['rev-parse', '--show-toplevel']);
  if (result.status !== 0 || normalizePath(result.stdout.trim()) !== normalizePath(realpathSync(root))) {
    throw new Error(`${root} no es la raíz de un repositorio git; no se escriben secretos`);
  }
}

/** Falla cerrado si alguna ruta sensible no está ignorada por git (`--no-index`: por reglas, no por índice). */
function assertIgnored(root: string, paths: readonly string[]): void {
  for (const path of paths) {
    const result = runGit(root, ['check-ignore', '-q', '--no-index', '--', path]);
    if (result.status === 0) continue;
    if (result.status === 1) {
      throw new Error(`${path} no está ignorado por git; no se escriben secretos`);
    }
    throw new Error(`git check-ignore falló (código ${result.status}) para ${path}`);
  }
}

/** Quita comentario de línea y comillas envolventes. */
function parseValue(raw: string): string {
  const value = raw.replace(/\s#.*$/, '').trim();
  return /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
}

/** Nombres de campos secretos de la plantilla. Rechaza una plantilla con valor en un campo secreto. */
function secretKeysOf(template: string): string[] {
  const keys: string[] = [];
  for (const line of template.split(/\r?\n/)) {
    const match = ASSIGNMENT.exec(line.trim());
    if (!match || !isSecretName(match[1])) continue;
    if (parseValue(match[2]) !== '') {
      throw new Error(`${TEMPLATE_POSIX}: el campo secreto ${match[1]} no está vacío; corrija la plantilla`);
    }
    if (!keys.includes(match[1])) keys.push(match[1]);
  }
  return keys;
}

function parseAssignments(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = ASSIGNMENT.exec(line.trim());
    if (match && !map.has(match[1])) map.set(match[1], parseValue(match[2]));
  }
  return map;
}

/** Archivo de secretos por campo: `DB_PASSWORD_API_RO` → `db_password_api_ro.txt`. */
export function secretFileName(key: string): string {
  return `${key.toLowerCase()}.txt`;
}

function readSecretFile(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8').replace(/\r?\n$/, '');
}

/**
 * Rellena los campos secretos vacíos de `base` y añade los que falten. Las líneas no
 * secretas y los valores ya definidos no cambian. `changed` indica si hubo cambios.
 */
function renderEnv(
  base: string,
  secretKeys: readonly string[],
  values: ReadonlyMap<string, string>,
): { text: string; changed: boolean } {
  const eol = base.includes('\r\n') ? '\r\n' : '\n';
  const lines = base.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  let changed = false;
  const seen = new Set<string>();
  const out = lines.map((line) => {
    const match = ASSIGNMENT.exec(line.trim());
    if (!match || !secretKeys.includes(match[1])) return line;
    const key = match[1];
    seen.add(key);
    if (parseValue(match[2]) !== '') return line;
    changed = true;
    return `${key}=${values.get(key) ?? ''}`;
  });
  for (const key of secretKeys) {
    if (seen.has(key)) continue;
    changed = true;
    out.push(`${key}=${values.get(key) ?? ''}`);
  }
  return { text: out.join(eol) + eol, changed };
}

/** Escritura solo de archivos nuevos (`wx`): nunca sustituye un archivo existente. */
function writeNew(path: string, content: string): void {
  writeFileSync(path, content, { flag: 'wx', mode: FILE_MODE });
}

/**
 * Crea o completa el entorno local de Docker bajo `root`. Ver la cabecera del módulo.
 * `generate` es inyectable solo para pruebas; por defecto usa `generatePassword`.
 */
export function setupEnv(root: string, generate: () => string = generatePassword): SetupReport {
  assertGitRoot(root);
  const templatePath = join(root, TEMPLATE_POSIX);
  if (!existsSync(templatePath)) throw new Error(`falta ${TEMPLATE_POSIX}`);
  const template = readFileSync(templatePath, 'utf8');
  const secretKeys = secretKeysOf(template);
  const fileFor = (key: string) => join(root, SECRETS_DIR_POSIX, secretFileName(key));
  const relFor = (key: string) => `${SECRETS_DIR_POSIX}/${secretFileName(key)}`;
  assertIgnored(root, [ENV_POSIX, ...secretKeys.map(relFor)]);

  const envPath = join(root, ENV_POSIX);
  const existingEnv = existsSync(envPath) ? readFileSync(envPath, 'utf8') : undefined;
  const envValues = parseAssignments(existingEnv ?? '');

  const values = new Map<string, string>();
  const warnings: string[] = [];
  let generated = 0;
  for (const key of secretKeys) {
    const fromEnv = envValues.get(key) ?? '';
    const fromFile = readSecretFile(fileFor(key));
    if (fromEnv !== '' && fromFile !== '' && fromEnv !== fromFile) {
      warnings.push(`${relFor(key)} difiere de ${ENV_POSIX}; no se modifica`);
    }
    let value = fromEnv || fromFile;
    if (value === '') {
      value = generate();
      generated += 1;
    }
    values.set(key, value);
  }

  const actions: SetupAction[] = [];
  const rendered = renderEnv(existingEnv ?? template, secretKeys, values);
  if (existingEnv === undefined) {
    writeNew(envPath, rendered.text);
    actions.push({ path: ENV_POSIX, action: 'creado' });
  } else if (rendered.changed) {
    writeFileSync(envPath, rendered.text, { mode: FILE_MODE });
    actions.push({ path: ENV_POSIX, action: 'actualizado' });
  } else {
    actions.push({ path: ENV_POSIX, action: 'conservado' });
  }

  const secretsDir = join(root, SECRETS_DIR_POSIX);
  mkdirSync(secretsDir, { recursive: true, mode: DIR_MODE });
  for (const key of secretKeys) {
    const path = fileFor(key);
    if (existsSync(path)) {
      actions.push({ path: relFor(key), action: 'conservado' });
    } else {
      writeNew(path, values.get(key) ?? '');
      actions.push({ path: relFor(key), action: 'creado' });
    }
  }

  return { actions, generated, warnings };
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function rootFromArgs(argv: readonly string[]): string {
  const index = argv.indexOf('--root');
  return index !== -1 && argv[index + 1] ? resolve(argv[index + 1]) : REPO_ROOT;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const report = setupEnv(rootFromArgs(process.argv.slice(2)));
    for (const { path, action } of report.actions) console.log(`${action}: ${path}`);
    for (const warning of report.warnings) console.warn(`aviso: ${warning}`);
    console.log(`setup:env OK (${report.generated} secreto(s) generado(s); ningún valor se muestra)`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`setup:env ERROR: ${reason}`);
    process.exit(2);
  }
}
