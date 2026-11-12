/**
 * check-ci-secrets (T-086 ST-1): validador estático de workflows de GitHub Actions.
 *
 * Falla cerrado si un workflow puede filtrar secretos o apuntar el DAST fuera del
 * runner (constitución, principio XII; plan §12.8 y §13):
 * - `pull_request_target` (ejecuta con secretos desde forks).
 * - Referencias `${{ secrets.… }}` en workflows disparados por `pull_request`.
 * - Impresión de secretos (echo/printf/cat/set -x) en bloques `run:`.
 * - Credenciales literales en `env:` y credenciales efímeras sin `::add-mask::` en el mismo job.
 * - `set -x`, `docker compose config` sin `--quiet`, `printenv`/`env`/`cat .env`.
 * - Artefactos con `.env` (salvo `.env.example`) o `secrets/`.
 * - Objetivo DAST que no sea `localhost`, `127.0.0.1` o `[::1]`, o que no se pueda resolver.
 *
 * Diseño:
 * - Sin dependencias: lector por indentación, suficiente para la forma de los workflows
 *   del proyecto (mapas y listas en bloque, escalares `|`/`>`). Los mapas y listas de
 *   flujo no se interpretan. Los comentarios se eliminan antes de aplicar las reglas.
 * - `isSecretName` se importa de check-secrets.mts para mantener una sola definición de
 *   «nombre secreto» en el proyecto (la misma que usa check-public-build.mts).
 * - Un `-t`/`--target` de otra herramienta dentro de un paso DAST también se evalúa
 *   (fallo cerrado; documentado).
 * - Los mensajes no contienen valores coincidentes: solo regla, archivo, línea y descripción.
 * - Uso: `pnpm exec tsx scripts/check-ci-secrets.mts [--dir <carpeta>]`. Códigos:
 *   0 = OK, 1 = hallazgos, 2 = error (incluida una carpeta sin workflows).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isSecretName } from './check-secrets.mts';

export type CiRule =
  | 'pull-request-target'
  | 'secret-in-job'
  | 'secret-echo'
  | 'literal-credential'
  | 'unmasked-credential'
  | 'set-x'
  | 'compose-config-values'
  | 'artifact-env'
  | 'env-dump'
  | 'remote-dast-target';

export interface CiFinding {
  file: string;
  line: number;
  rule: CiRule;
  message: string;
}

interface Line {
  line: number;
  text: string;
}

interface Frame {
  indent: number;
  name: string;
}

interface Entry {
  line: number;
  key: string;
  value: string;
  ancestors: string[];
  scalar: Line[];
}

interface RunLine extends Line {
  job: string | undefined;
  step: string | undefined;
}

interface Step {
  id: string;
  job: string | undefined;
  depth: number;
  entries: Entry[];
}

interface Scope {
  job: string | undefined;
  step: string | undefined;
}

const KEY_LINE = /^([A-Za-z_][\w.-]*)\s*:(?:\s+(.*))?$/;
const BLOCK_SCALAR = /^[|>][+-]?\d*$/;
const SECRET_REF = /\$\{\{\s*secrets\./;
const SECRET_VAR = /\$\{?([A-Za-z_]\w*)\}?/g;
const PRINT_COMMAND = /\b(?:echo|printf|cat)\b/;
const SET_X = /(?:^|[\s;&|(])set\s+-[A-Za-z]*x/;
const GENERATED = /openssl\s+rand|\$RANDOM\b|\/dev\/urandom|uuidgen|\$\(|`/;
const ASSIGNMENT = /\b([A-Za-z_][A-Za-z0-9_]*)=/g;
const SEGMENT_SPLIT = /&&|\|\||;|\|/;
const COMPOSE = /\bdocker(?:\s+|-)compose\b/;
const COMPOSE_CONFIG = /\sconfig(?:\s|$)/;
const QUIET_FLAG = /(?:^|\s)(?:--quiet|-q)(?:\s|$)/;
const ENV_CAT = /^cat\s+\S*\.env(?:\.[\w-]+)?(?=$|[\s"'*])/;
const DAST_NAME = /dast|zap/i;
const ZAP_RUN = /zap-baseline|zap\.sh|zaproxy/i;
const URL_KEY = /URL|TARGET/i;
const TARGET_FLAG = /(?:^|\s)(?:-t|--target)(?:\s+|=)("[^"]*"|'[^']*'|[^\s"']\S*)/g;
const VARIABLE_REF = /\$\{\{\s*env\.([A-Za-z_]\w*)\s*\}\}|\$\{?([A-Za-z_]\w*)\}?/g;
const UNRESOLVED_MARK = /[$`]/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const indentOf = (line: string): number => line.length - line.trimStart().length;

/** Quita un comentario de final de línea (` #`) o de línea completa. */
function stripComment(raw: string): string {
  if (/^\s*#/.test(raw)) return '';
  return raw.replace(/\s#(?:\s.*)?$/, '');
}

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, '$2').trim();
}

function popTo(stack: Frame[], indent: number): void {
  while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
}

/** Lector por indentación: cada clave con sus ancestros (ítems de lista como `-N`). */
function parse(text: string): { lines: Line[]; entries: Entry[] } {
  const lines: Line[] = [];
  const entries: Entry[] = [];
  const stack: Frame[] = [];
  let itemCount = 0;
  let owner: Entry | undefined;
  let ownerIndent = 0;

  text.split('\n').forEach((raw, index) => {
    const no = index + 1;
    const stripped = stripComment(raw);
    if (stripped.trim() === '') return;
    lines.push({ line: no, text: stripped });

    if (owner !== undefined) {
      if (indentOf(stripped) > ownerIndent) {
        owner.scalar.push({ line: no, text: stripped });
        return;
      }
      owner = undefined;
    }

    let col = indentOf(stripped);
    let rest = stripped.slice(col);
    while (rest === '-' || rest.startsWith('- ')) {
      popTo(stack, col);
      stack.push({ indent: col, name: `-${++itemCount}` });
      const after = rest.slice(1).trimStart();
      col += rest.length - after.length;
      rest = after;
    }
    if (rest === '') return;

    popTo(stack, col);
    const match = KEY_LINE.exec(rest);
    if (!match) return;
    const key = match[1];
    const value = unquote((match[2] ?? '').trim());
    const entry: Entry = { line: no, key, value, ancestors: stack.map((f) => f.name), scalar: [] };
    entries.push(entry);
    if (BLOCK_SCALAR.test(value)) {
      owner = entry;
      ownerIndent = col;
    } else if (value === '') {
      stack.push({ indent: col, name: key });
    }
  });
  return { lines, entries };
}

const parentOf = (entry: Entry): string | undefined => entry.ancestors[entry.ancestors.length - 1];

function jobOf(entry: Entry): string | undefined {
  return entry.ancestors[0] === 'jobs' ? entry.ancestors[1] : undefined;
}

/** Texto de un escalar `run:`/`path:`: el valor en línea o las líneas del bloque. */
function textOf(entry: Entry): Line[] {
  if (BLOCK_SCALAR.test(entry.value)) return entry.scalar;
  return entry.value === '' ? [] : [{ line: entry.line, text: entry.value }];
}

function buildSteps(entries: readonly Entry[]): Step[] {
  const steps = new Map<string, Step>();
  for (const entry of entries) {
    const s = entry.ancestors.indexOf('steps');
    if (s < 0 || s + 1 >= entry.ancestors.length) continue;
    const id = entry.ancestors.slice(0, s + 2).join('/');
    let step = steps.get(id);
    if (step === undefined) {
      step = { id, job: jobOf(entry), depth: s + 2, entries: [] };
      steps.set(id, step);
    }
    step.entries.push(entry);
  }
  return [...steps.values()];
}

function directValue(step: Step, key: string): string {
  return step.entries.find((e) => e.key === key && e.ancestors.length === step.depth)?.value ?? '';
}

function triggerEvents(entries: readonly Entry[]): string[] {
  const events: string[] = [];
  for (const entry of entries) {
    if (entry.key === 'on' && entry.ancestors.length === 0) {
      events.push(
        ...entry.value
          .replace(/[[\]]/g, '')
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== ''),
      );
    } else if (parentOf(entry) === 'on' && entry.ancestors.length === 1) {
      events.push(entry.key);
    }
  }
  return events;
}

/** Ruta de `upload-artifact` sensible: `.env*` (salvo `.env.example`) o un directorio `secrets/`. */
function isSecretPath(token: string): boolean {
  const clean = token.replace(/["',]/g, '');
  if (clean === '') return false;
  const segments = clean.split('/');
  if (segments.some((s) => s.toLowerCase() === 'secrets')) return true;
  const base = segments[segments.length - 1];
  return base !== '.env.example' && /^\.env(?:\.|\*|$)/.test(base);
}

function secretReferenced(text: string): boolean {
  if (SECRET_REF.test(text)) return true;
  return [...text.matchAll(SECRET_VAR)].some((m) => isSecretName(m[1]));
}

function generatesSecret(text: string): boolean {
  const assignsSecret = [...text.matchAll(ASSIGNMENT)].some((m) => isSecretName(m[1]));
  return assignsSecret && (GENERATED.test(text) || text.includes('GITHUB_ENV'));
}

function isLoopbackTarget(value: string): boolean {
  const rest = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const authority = rest.split(/[\/?#]/)[0];
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
  const host = hostPort.startsWith('[')
    ? hostPort.slice(0, hostPort.indexOf(']') + 1)
    : hostPort.split(':')[0];
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

function checkWorkflow(file: string, text: string): CiFinding[] {
  const { lines, entries } = parse(text);
  const findings: CiFinding[] = [];
  const report = (line: number, rule: CiRule, message: string): void => {
    findings.push({ file, line, rule, message });
  };

  const events = triggerEvents(entries);
  const envEntries = entries.filter((e) => parentOf(e) === 'env');
  const steps = buildSteps(entries);
  const runLines: RunLine[] = [];
  for (const entry of entries) {
    if (entry.key !== 'run') continue;
    for (const t of textOf(entry))
      runLines.push({ ...t, job: jobOf(entry), step: stepIdOf(entry) });
  }

  for (const { line, text: content } of lines) {
    if (/pull_request_target/.test(content)) {
      report(
        line,
        'pull-request-target',
        'trigger pull_request_target: ejecuta con secretos desde forks; use pull_request',
      );
    }
    if (events.includes('pull_request') && SECRET_REF.test(content)) {
      report(
        line,
        'secret-in-job',
        'referencia a secreto en un workflow disparado por pull_request (los forks no reciben secretos)',
      );
    }
  }

  for (const entry of envEntries) {
    if (isSecretName(entry.key) && entry.value !== '' && !UNRESOLVED_MARK.test(entry.value)) {
      report(
        entry.line,
        'literal-credential',
        `variable de nombre secreto "${entry.key}" con valor literal; genérela de forma efímera`,
      );
    }
  }

  for (const r of runLines) {
    const segments = r.text.split(SEGMENT_SPLIT).map((s) => s.trim());
    const masksOrPublishes = r.text.includes('::add-mask::') || r.text.includes('GITHUB_ENV');

    if (SET_X.test(r.text)) report(r.line, 'set-x', 'set -x en un run puede volcar valores');

    if (
      secretReferenced(r.text) &&
      !masksOrPublishes &&
      (PRINT_COMMAND.test(r.text) || SET_X.test(r.text))
    ) {
      report(
        r.line,
        'secret-echo',
        'un bloque run imprime un secreto (echo/printf/cat/set -x); no lo imprima',
      );
    }

    for (const segment of segments) {
      if (COMPOSE.test(segment) && COMPOSE_CONFIG.test(segment) && !QUIET_FLAG.test(segment)) {
        report(
          r.line,
          'compose-config-values',
          'docker compose config sin --quiet imprime valores resueltos',
        );
      }
      const dumpsEnv =
        /^printenv\b/.test(segment) ||
        segment === 'env' ||
        (ENV_CAT.test(segment) && !segment.includes('.env.example'));
      if (dumpsEnv)
        report(
          r.line,
          'env-dump',
          'volcado de entorno o de .env en un run (printenv, env, cat .env)',
        );
    }
  }

  const firstGenerated = new Map<string, RunLine>();
  const masked = new Set<string>();
  for (const r of runLines) {
    if (r.job === undefined) continue;
    if (r.text.includes('::add-mask::')) masked.add(r.job);
    if (!firstGenerated.has(r.job) && generatesSecret(r.text)) firstGenerated.set(r.job, r);
  }
  for (const [job, r] of firstGenerated) {
    if (!masked.has(job)) {
      report(
        r.line,
        'unmasked-credential',
        `el job "${job}" genera una credencial efímera sin ::add-mask:: en el mismo job`,
      );
    }
  }

  for (const step of steps) {
    if (!directValue(step, 'uses').includes('upload-artifact')) continue;
    for (const entry of step.entries) {
      if (entry.key !== 'path' || parentOf(entry) !== 'with') continue;
      for (const t of textOf(entry)) {
        if (
          t.text
            .trim()
            .split(/[\s,]+/)
            .some(isSecretPath)
        ) {
          report(t.line, 'artifact-env', 'el artefacto incluye .env o secrets/');
        }
      }
    }
  }

  const jobs = [...new Set(entries.map(jobOf).filter((j): j is string => j !== undefined))];
  for (const job of jobs) {
    const jobEntries = entries.filter((e) => jobOf(e) === job);
    const jobName =
      entries.find((e) => e.key === 'name' && e.ancestors.length === 2 && e.ancestors[1] === job)
        ?.value ?? '';
    if (DAST_NAME.test(job) || DAST_NAME.test(jobName)) {
      const runs = runLines.filter((r) => r.job === job);
      checkDast(
        report,
        { job, step: undefined },
        jobEntries,
        runs,
        jobEntries[0]?.line ?? 1,
        envEntries,
      );
      continue;
    }
    for (const step of steps.filter((s) => s.job === job)) {
      const runs = runLines.filter((r) => r.step === step.id);
      if (DAST_NAME.test(directValue(step, 'name')) || runs.some((r) => ZAP_RUN.test(r.text))) {
        checkDast(
          report,
          { job, step: step.id },
          step.entries,
          runs,
          step.entries[0].line,
          envEntries,
        );
      }
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

/** Variable visible desde un ámbito: paso, después job y después workflow. */
function lookupEnv(name: string, scope: Scope, envEntries: readonly Entry[]): Entry | undefined {
  const inScope = [
    ...envEntries.filter((e) => scope.step !== undefined && stepIdOf(e) === scope.step),
    ...envEntries.filter(
      (e) => e.ancestors[0] === 'jobs' && jobOf(e) === scope.job && !e.ancestors.includes('steps'),
    ),
    ...envEntries.filter((e) => e.ancestors.length === 1),
  ];
  return inScope.find((e) => e.key === name);
}

function stepIdOf(entry: Entry): string | undefined {
  const s = entry.ancestors.indexOf('steps');
  if (s < 0 || s + 1 >= entry.ancestors.length) return undefined;
  return entry.ancestors.slice(0, s + 2).join('/');
}

/** Sustituye referencias por valores literales; `undefined` si alguna no se puede resolver. */
function resolveTarget(
  raw: string,
  line: number,
  scope: Scope,
  envEntries: readonly Entry[],
): { value: string; line: number } | undefined {
  const text = unquote(raw.trim());
  let resolvedLine = line;
  let unresolved = false;
  const value = text.replace(
    VARIABLE_REF,
    (_match, braced: string | undefined, plain: string | undefined) => {
      const hit = lookupEnv(braced ?? plain ?? '', scope, envEntries);
      if (hit === undefined || hit.value === '' || UNRESOLVED_MARK.test(hit.value)) {
        unresolved = true;
        return '';
      }
      resolvedLine = hit.line;
      return hit.value;
    },
  );
  return unresolved ? undefined : { value, line: resolvedLine };
}

function checkDast(
  report: (line: number, rule: CiRule, message: string) => void,
  scope: Scope,
  scopeEntries: readonly Entry[],
  runs: readonly RunLine[],
  headerLine: number,
  envEntries: readonly Entry[],
): void {
  const candidates: { line: number; value: string }[] = [];
  for (const entry of scopeEntries) {
    if (URL_KEY.test(entry.key) && entry.value !== '')
      candidates.push({ line: entry.line, value: entry.value });
  }
  for (const r of runs) {
    for (const match of r.text.matchAll(TARGET_FLAG))
      candidates.push({ line: r.line, value: match[1] });
  }

  if (candidates.length === 0) {
    report(
      headerLine,
      'remote-dast-target',
      'paso DAST sin objetivo verificable (se exige localhost, 127.0.0.1 o [::1])',
    );
    return;
  }
  for (const candidate of candidates) {
    const resolved = resolveTarget(candidate.value, candidate.line, scope, envEntries);
    if (resolved === undefined) {
      report(
        candidate.line,
        'remote-dast-target',
        'objetivo DAST no verificable: referencia sin valor literal de loopback',
      );
    } else if (!isLoopbackTarget(resolved.value)) {
      report(
        resolved.line,
        'remote-dast-target',
        'objetivo DAST fuera del runner (se exige localhost, 127.0.0.1 o [::1])',
      );
    }
  }
}

/**
 * Valida el contenido de workflows. Devuelve hallazgos sin valores coincidentes,
 * ordenados por archivo y línea, sin duplicados por línea y regla.
 */
export function validateWorkflows(files: readonly { path: string; text: string }[]): CiFinding[] {
  const out: CiFinding[] = [];
  for (const file of files) {
    const seen = new Set<string>();
    for (const finding of checkWorkflow(file.path, file.text.replace(/\r\n/g, '\n'))) {
      const key = `${finding.line}:${finding.rule}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(finding);
    }
  }
  return out;
}

/** Valida los `*.yml` y `*.yaml` de una carpeta, en orden de nombre. Falla si no puede leerla. */
export function scanWorkflowDir(dir: string): { findings: CiFinding[]; scanned: number } {
  const names = readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name) && statSync(join(dir, name)).isFile())
    .sort();
  const files = names.map((path) => ({ path, text: readFileSync(join(dir, path), 'utf8') }));
  return { findings: validateWorkflows(files), scanned: files.length };
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function dirFromArgs(argv: readonly string[]): string {
  const index = argv.indexOf('--dir');
  if (index === -1) return join(REPO_ROOT, '.github', 'workflows');
  const value = argv[index + 1];
  if (!value) throw new Error('--dir requiere una carpeta');
  return resolve(value);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const dir = dirFromArgs(process.argv.slice(2));
    const result = scanWorkflowDir(dir);
    if (result.scanned === 0) throw new Error(`no hay workflows *.yml ni *.yaml en ${dir}`);
    if (result.findings.length > 0) {
      for (const finding of result.findings) {
        console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
      }
      console.error(
        `\ncheck-ci-secrets FALLÓ (${result.findings.length} incidencia(s), ${result.scanned} workflow(s) revisados)`,
      );
      process.exit(1);
    }
    console.log(`check-ci-secrets OK (${result.scanned} workflow(s) revisados)`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`check-ci-secrets ERROR: ${reason}`);
    process.exit(2);
  }
}
