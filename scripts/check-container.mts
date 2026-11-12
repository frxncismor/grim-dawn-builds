/**
 * check-container (T-066b): guardia de configuración de contenedores y umbral de Trivy.
 *
 * Falla cerrado si el Dockerfile, el Compose por defecto o un informe de Trivy incumplen
 * las puertas del plan §12.7/§12.8 y de la constitución (XI, XII):
 * - La imagen final debe declarar un `USER` no-root (sin `USER` o con `USER root`/`0` falla).
 * - No se copian `.env*` (salvo `.env.example`) ni directorios `secrets/` a la imagen.
 * - `ARG`/`ENV` con nombre secreto o valor con patrón de credencial falla (mismas reglas
 *   que check-secrets.mts, importadas para no duplicar la definición).
 * - El servicio `db` del Compose por defecto no publica `ports`; el acceso de depuración
 *   es el override opt-in `compose.debug.yaml`.
 * - Un informe de Trivy (JSON con `Results[].Vulnerabilities[]` y opcionalmente
 *   `Results[].Misconfigurations[]`) bloquea con exit 1 cualquier hallazgo MEDIUM, HIGH o
 *   CRITICAL **con corrección publicada** (decisión del usuario 2026-11-09, revisada el
 *   2026-11-11: los no corregibles no bloquean porque no dependen de este repositorio). No
 *   hay allowlist ni lista de CVEs: los hallazgos no corregibles se **cuentan y resumen**
 *   siempre en la salida (severidad y paquete), de modo que la exclusión nunca es
 *   silenciosa, y las misconfigurations de Dockerfile/Compose bloquean siempre porque son
 *   accionables. El umbral equivale a ejecutar Trivy con `--ignore-unfixed` **más** un
 *   resumen explícito de lo excluido.
 * - Un informe vacío (sin sobre de Trivy) o mal formado falla cerrado con exit 2; un sobre
 *   válido sin hallazgos es un escaneo limpio y pasa.
 *
 * Diseño:
 * - Sin dependencias nuevas ni parser YAML: lector por indentación, suficiente para la
 *   forma de los archivos del proyecto (mapas y listas en bloque). El estilo de flujo de
 *   `db` se detecta como caso conservador.
 * - Los mensajes nunca vuelcan el informe: solo destino, identificador, paquete, versión y
 *   severidad (en español). La salida se limita a un máximo de líneas, pero el total de
 *   hallazgos bloqueantes se informa siempre.
 * - Uso: `pnpm check-container [--dockerfile <ruta>] [--compose <ruta>] [--report <ruta>]`.
 *   Códigos: 0 = OK, 1 = hallazgos, 2 = error de uso, lectura o informe inválido.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanFiles } from './check-secrets.mts';

export type ContainerRule = 'docker-root-user' | 'docker-secret' | 'compose-db-published';

export interface ContainerFinding {
  file: string;
  line: number;
  rule: ContainerRule;
  message: string;
}

export type TrivyKind = 'vulnerability' | 'misconfiguration';

export interface TrivyFinding {
  target: string;
  kind: TrivyKind;
  id: string;
  severity: string;
  pkg?: string;
  installed?: string;
  fixed?: string;
}

/** Severidades que bloquean (MEDIA/ALTA/CRÍTICA). LOW y UNKNOWN no bloquean. */
const BLOCKING_SEVERITIES = new Set(['MEDIUM', 'HIGH', 'CRITICAL']);
const KNOWN_SEVERITIES = new Set(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const SEVERITY_ES: Record<string, string> = {
  UNKNOWN: 'DESCONOCIDA',
  LOW: 'BAJA',
  MEDIUM: 'MEDIA',
  HIGH: 'ALTA',
  CRITICAL: 'CRÍTICA',
};

const SECRET_RULES = new Set([
  'docker-secret-injection',
  'docker-secret-copy',
  'secret-pattern',
  'credential-url',
  'generic-secret-assignment',
]);

const indentOf = (line: string): number => line.length - line.trimStart().length;

/** Instrucción lógica del Dockerfile (las líneas continuadas con `\` se unen). */
interface Instruction {
  line: number;
  keyword: string;
  args: string;
}

function dockerInstructions(text: string): Instruction[] {
  const instructions: Instruction[] = [];
  let buffer: string | undefined;
  let startLine = 0;
  text.split('\n').forEach((raw, index) => {
    const trimmed = raw.trim();
    if (buffer === undefined) {
      if (trimmed === '' || trimmed.startsWith('#')) return;
      buffer = '';
      startLine = index + 1;
    } else if (trimmed === '' || trimmed.startsWith('#')) {
      return;
    }
    if (trimmed.endsWith('\\')) {
      buffer += `${trimmed.slice(0, -1)} `;
      return;
    }
    buffer += trimmed;
    const match = /^([A-Za-z_][\w-]*)\s*(.*)$/.exec(buffer);
    if (match)
      instructions.push({
        line: startLine,
        keyword: match[1].toUpperCase(),
        args: match[2].trim(),
      });
    buffer = undefined;
  });
  if (buffer !== undefined && buffer !== '') {
    const match = /^([A-Za-z_][\w-]*)\s*(.*)$/.exec(buffer);
    if (match)
      instructions.push({
        line: startLine,
        keyword: match[1].toUpperCase(),
        args: match[2].trim(),
      });
  }
  return instructions;
}

interface Stage {
  fromLine: number;
  user?: { line: number; value: string };
}

/** Etapas `FROM ... [AS nombre]`; `FROM <etapa>` hereda el USER de esa etapa anterior. */
function dockerStages(instructions: readonly Instruction[]): Stage[] {
  const stages: Stage[] = [];
  const byName = new Map<string, Stage>();
  for (const instruction of instructions) {
    if (instruction.keyword === 'FROM') {
      const tokens = instruction.args.split(/\s+/).filter(Boolean);
      const parent = byName.get((tokens[0] ?? '').toLowerCase());
      const stage: Stage = { fromLine: instruction.line, user: parent?.user };
      const asIndex = tokens.findIndex((token) => token.toUpperCase() === 'AS');
      const name = asIndex >= 0 ? tokens[asIndex + 1] : undefined;
      if (name !== undefined) byName.set(name.toLowerCase(), stage);
      stages.push(stage);
    } else if (instruction.keyword === 'USER' && stages.length > 0) {
      stages[stages.length - 1].user = { line: instruction.line, value: instruction.args };
    }
  }
  return stages;
}

/** `root`/uid 0 frente a no-root; `unknown` si el valor no se puede verificar estáticamente. */
function userKind(value: string): 'root' | 'non-root' | 'unknown' {
  const user = value
    .split(':')[0]
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2');
  if (user === '' || /[$`{}]/.test(user)) return 'unknown';
  if (/^root$/i.test(user)) return 'root';
  if (/^\d+$/.test(user)) return Number(user) === 0 ? 'root' : 'non-root';
  return 'non-root';
}

/**
 * Reglas estáticas del Dockerfile: imagen final no-root y ausencia de secretos en capas
 * (nombres secretos en ARG/ENV, COPY/ADD de `.env*` o `secrets/`, patrones de credencial).
 */
export function checkDockerfile(file: string, text: string): ContainerFinding[] {
  const findings: ContainerFinding[] = [];
  const stages = dockerStages(dockerInstructions(text));
  const finalStage = stages[stages.length - 1];

  if (finalStage === undefined) {
    findings.push({
      file,
      line: 1,
      rule: 'docker-root-user',
      message: 'el Dockerfile no declara ninguna etapa FROM; no se puede verificar la imagen final',
    });
  } else if (finalStage.user === undefined) {
    findings.push({
      file,
      line: finalStage.fromLine,
      rule: 'docker-root-user',
      message: 'la imagen final no declara USER y corre como root; use un UID fijo no-root',
    });
  } else {
    const kind = userKind(finalStage.user.value);
    if (kind === 'root') {
      findings.push({
        file,
        line: finalStage.user.line,
        rule: 'docker-root-user',
        message: 'la imagen final corre como root (USER root/0); use un UID fijo no-root',
      });
    } else if (kind === 'unknown') {
      findings.push({
        file,
        line: finalStage.user.line,
        rule: 'docker-root-user',
        message: 'USER de la imagen final no verificable estáticamente; no se puede descartar root',
      });
    }
  }

  const seen = new Set<string>();
  for (const finding of scanFiles([file], () => text)) {
    if (!SECRET_RULES.has(finding.rule)) continue;
    const key = `${finding.line}:docker-secret`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      file,
      line: finding.line,
      rule: 'docker-secret',
      message: finding.message,
    });
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Reglas estáticas del Compose por defecto: `db` no publica `ports` (el override
 * `compose.debug.yaml` es el único acceso de depuración y solo escucha en loopback).
 */
export function checkCompose(file: string, text: string): ContainerFinding[] {
  const findings: ContainerFinding[] = [];
  let inServices = false;
  let service: string | undefined;

  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.replace(/^\s*#.*$/, '').replace(/\s+#.*$/, '');
      if (line.trim() === '') return;
      const indent = indentOf(line);
      const trimmed = line.trim();

      if (indent === 0) {
        inServices = /^services\s*:\s*$/.test(trimmed);
        service = undefined;
        return;
      }
      if (!inServices) return;

      const match = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(trimmed);
      if (!match) return;
      const [, key, rest] = match;

      if (indent === 2) {
        service = key;
        // Estilo de flujo: no se interpreta, pero un `ports` en línea es un positivo.
        if (key === 'db' && rest !== '' && /\bports\b/.test(rest)) {
          findings.push({
            file,
            line: index + 1,
            rule: 'compose-db-published',
            message:
              'el servicio db publica ports en el Compose por defecto; use compose.debug.yaml',
          });
        }
        return;
      }

      if (service === 'db' && indent === 4 && key === 'ports') {
        findings.push({
          file,
          line: index + 1,
          rule: 'compose-db-published',
          message: 'el servicio db publica ports en el Compose por defecto; use compose.debug.yaml',
        });
      }
    });

  return findings;
}

/** Error de informe inválido o vacío: el CLI lo traduce a exit 2 (fallo cerrado). */
export class TrivyReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrivyReportError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function textField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Lee y valida un informe JSON de Trivy. Lanza `TrivyReportError` si el sobre no es un
 * informe de Trivy, si `Results` falta o no es una lista, o si un hallazgo no trae
 * severidad/identificador reconocibles.
 */
export function parseTrivyReport(text: string): TrivyFinding[] {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new TrivyReportError('el informe Trivy no es JSON válido');
  }

  const report = asRecord(root);
  if (report === undefined) throw new TrivyReportError('el informe Trivy no es un objeto JSON');
  if (typeof report.SchemaVersion !== 'number') {
    throw new TrivyReportError(
      'el informe Trivy no tiene SchemaVersion: no parece un informe de Trivy',
    );
  }
  if (textField(report.ArtifactName) === undefined) {
    throw new TrivyReportError('el informe Trivy no identifica ArtifactName; se falla cerrado');
  }
  if (!Array.isArray(report.Results)) {
    throw new TrivyReportError('el informe Trivy no tiene Results o está vacío; se falla cerrado');
  }

  const findings: TrivyFinding[] = [];
  for (const result of report.Results) {
    const entry = asRecord(result);
    if (entry === undefined) throw new TrivyReportError('Results contiene una entrada inválida');
    const target =
      textField(entry.Target) ?? textField(report.ArtifactName) ?? 'destino desconocido';

    for (const kind of ['Vulnerabilities', 'Misconfigurations'] as const) {
      const list = entry[kind];
      if (list === undefined || list === null) continue;
      if (!Array.isArray(list)) {
        throw new TrivyReportError(`${kind} de "${target}" no es una lista`);
      }
      for (const raw of list) {
        const item = asRecord(raw);
        if (item === undefined) throw new TrivyReportError(`hallazgo inválido en ${kind}`);
        const severity = textField(item.Severity)?.toUpperCase();
        if (severity === undefined || !KNOWN_SEVERITIES.has(severity)) {
          throw new TrivyReportError(`severidad Trivy desconocida o ausente en "${target}"`);
        }
        const id =
          kind === 'Vulnerabilities'
            ? textField(item.VulnerabilityID)
            : (textField(item.ID) ?? textField(item.AVDID));
        if (id === undefined) {
          throw new TrivyReportError(`hallazgo sin identificador en "${target}"`);
        }
        findings.push({
          target,
          kind: kind === 'Vulnerabilities' ? 'vulnerability' : 'misconfiguration',
          id,
          severity,
          pkg: textField(item.PkgName),
          installed: textField(item.InstalledVersion),
          fixed: textField(item.FixedVersion),
        });
      }
    }
  }

  return findings;
}

/**
 * Hallazgos que bloquean: MEDIA, ALTA o CRÍTICA **con corrección publicada**, más toda
 * misconfiguration (siempre accionable). Un CVE sin FixedVersion no puede corregirse
 * desde este repositorio y se resume aparte con summarizeUnfixed, nunca en silencio.
 */
export function blockingFindings(findings: readonly TrivyFinding[]): TrivyFinding[] {
  return findings.filter(
    (finding) =>
      BLOCKING_SEVERITIES.has(finding.severity) &&
      (finding.kind === 'misconfiguration' || finding.fixed !== undefined),
  );
}

/** Hallazgos MEDIA/ALTA/CRÍTICA sin corrección publicada: informan, no bloquean. */
export function unfixedFindings(findings: readonly TrivyFinding[]): TrivyFinding[] {
  return findings.filter(
    (finding) =>
      BLOCKING_SEVERITIES.has(finding.severity) &&
      finding.kind === 'vulnerability' &&
      finding.fixed === undefined,
  );
}

/** Resumen legible de lo no corregible, por severidad y paquete, con el total. */
/**
 * Resumen legible de lo no corregible, por severidad y paquete, con el total.
 * No es una lista de excepciones: son hallazgos que este repositorio no puede corregir
 * (severidad MEDIA+ sin `FixedVersion`), y se publican siempre para que la exclusión no
 * sea silenciosa.
 */
export function summarizeUnfixed(findings: readonly TrivyFinding[]): string[] {
  if (findings.length === 0) return [];
  const bySeverity = new Map<string, number>();
  const byPackage = new Map<string, number>();
  for (const finding of findings) {
    bySeverity.set(finding.severity, (bySeverity.get(finding.severity) ?? 0) + 1);
    const pkg = finding.pkg ?? 'paquete desconocido';
    byPackage.set(pkg, (byPackage.get(pkg) ?? 0) + 1);
  }
  const severityText = [...bySeverity.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([severity, count]) => `${SEVERITY_ES[severity] ?? severity} ${count}`)
    .join(', ');
  const packageText = [...byPackage.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([pkg, count]) => `${pkg} ${count}`)
    .join(', ');
  return [
    `check-container: ${findings.length} hallazgo(s) MEDIA/ALTA/CRÍTICA SIN corrección publicada ` +
      `(no bloquean; se contabilizan aquí): ${severityText}. Paquetes: ${packageText}` +
      (byPackage.size > 10 ? ', …' : '.'),
  ];
}

/** Línea de informe sin volcar el JSON ni descripciones del escáner. */
export function formatTrivyFinding(finding: TrivyFinding): string {
  const severity = SEVERITY_ES[finding.severity] ?? finding.severity;
  if (finding.kind === 'vulnerability') {
    const fixed =
      finding.fixed !== undefined ? `corregido en ${finding.fixed}` : 'sin corrección publicada';
    return `${finding.target}: [${severity}] ${finding.id} en ${finding.pkg ?? 'paquete desconocido'} (instalado ${finding.installed ?? 'desconocido'}, ${fixed})`;
  }
  return `${finding.target}: [${severity}] ${finding.id} configuración insegura (revisar Dockerfile/Compose)`;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DOCKERFILE = join(REPO_ROOT, 'apps/api/Dockerfile');
const DEFAULT_COMPOSE = join(REPO_ROOT, 'infra/docker/compose.yaml');
/** Tope de líneas impresas: el gate sigue contando todos los hallazgos. */
const MAX_REPORT_LINES = 50;

const HELP = `Uso: pnpm check-container [opciones]

Verifica la configuración de contenedores (T-066b):
  - Dockerfile: la imagen final declara USER no-root, no copia .env*/secrets/ y no
    contiene secretos literales en ARG/ENV.
  - Compose: el servicio db no publica ports en el compose por defecto.
  - Informe Trivy: bloquea cualquier hallazgo MEDIUM, HIGH o CRITICAL (MEDIA/ALTA/CRÍTICA) con corrección publicada; los no corregibles no bloquean pero se resumen por severidad y paquete.

Opciones:
  --dockerfile <ruta>  Dockerfile a revisar (por defecto apps/api/Dockerfile).
  --compose <ruta>     Compose por defecto (por defecto infra/docker/compose.yaml).
  --report <ruta>      Evalúa un informe JSON de Trivy en lugar de la verificación estática.
  -h, --help           Muestra este uso.

Códigos: 0 = OK, 1 = hallazgos, 2 = error de uso, lectura o informe vacío/mal formado.`;

interface Options {
  dockerfile: string;
  compose: string;
  report?: string;
  help: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    dockerfile: DEFAULT_DOCKERFILE,
    compose: DEFAULT_COMPOSE,
    help: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--dockerfile' || arg === '--compose' || arg === '--report') {
      const value = argv[index + 1];
      if (value === undefined || value === '') throw new Error(`${arg} requiere una ruta`);
      index++;
      if (arg === '--dockerfile') options.dockerfile = resolve(value);
      else if (arg === '--compose') options.compose = resolve(value);
      else options.report = resolve(value);
      continue;
    }
    throw new Error(`argumento no reconocido: ${arg}`);
  }
  return options;
}

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`no se pudo leer ${path}: ${reason}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(HELP);
      process.exit(0);
    }

    if (options.report !== undefined) {
      const findings = parseTrivyReport(readText(options.report));
      const blocking = blockingFindings(findings);
      const unfixed = unfixedFindings(findings);
      for (const line of summarizeUnfixed(unfixed)) console.log(line);
      if (blocking.length > 0) {
        for (const finding of blocking.slice(0, MAX_REPORT_LINES)) {
          console.error(formatTrivyFinding(finding));
        }
        if (blocking.length > MAX_REPORT_LINES) {
          console.error(
            `… y ${blocking.length - MAX_REPORT_LINES} hallazgo(s) más (no se vuelca el informe completo)`,
          );
        }
        console.error(
          `\ncheck-container FALLÓ: ${blocking.length} hallazgo(s) corregible(s) desde severidad MEDIA en el informe Trivy`,
        );
        process.exit(1);
      }
      console.log(
        `check-container OK: sin hallazgos corregibles MEDIA/ALTA/CRÍTICA (${findings.length} por debajo del umbral, ${unfixed.length} sin corrección)`,
      );
      process.exit(0);
    }

    const findings = [
      ...checkDockerfile(options.dockerfile, readText(options.dockerfile)),
      ...checkCompose(options.compose, readText(options.compose)),
    ];
    if (findings.length > 0) {
      for (const finding of findings) {
        console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
      }
      console.error(`\ncheck-container FALLÓ (${findings.length} incidencia(s) estática(s))`);
      process.exit(1);
    }
    console.log(
      `check-container OK (${basename(options.dockerfile)} y ${basename(options.compose)} conformes)`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`check-container ERROR: ${reason}`);
    process.exit(2);
  }
}
