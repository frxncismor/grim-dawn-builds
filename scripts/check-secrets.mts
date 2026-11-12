/**
 * check-secrets (T-066a): guardia de secretos rastreados, sin framework.
 *
 * Falla si git rastrea secretos (constitución, principio XII; plan §13.1-§13.2):
 * - `.env` o `.env.*` distintos de `.env.example`.
 * - Cualquier archivo bajo un directorio `secrets/`.
 * - `.env.example` con valores no vacíos en campos secretos, o con placeholders débiles.
 * - Dockerfile: `ARG`/`ENV` con nombre secreto, o `COPY`/`ADD` de `.env*` o `secrets/`.
 * - Patrones de credenciales de alta confianza, URLs con contraseña literal y
 *   asignaciones literales a variables de nombre secreto en código, configuración,
 *   Dockerfiles, scripts de package.json y contenido.
 *
 * Diseño:
 * - Solo se leen archivos rastreados (`git ls-files --cached`). Los ficheros locales
 *   ignorados o sin añadir nunca se abren ni se reportan.
 * - Los mensajes no contienen valores coincidentes: solo regla, archivo, línea y descripción.
 * - Fallo cerrado: si git no puede listar los archivos, el proceso termina con código 2.
 * - Uso: `pnpm check:secrets [--root <dir>]`. Sin dependencias nuevas.
 *
 * Exclusiones intencionadas (solo para reglas de patrón; las estructurales y de Docker
 * siempre se aplican): Markdown, lockfiles, node_modules/dist/.angular/coverage y
 * carpetas de fixtures. Los binarios no se analizan por contenido.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type FindingRule =
  | 'tracked-env-file'
  | 'tracked-secrets-dir'
  | 'env-example-secret-value'
  | 'env-example-placeholder'
  | 'docker-secret-injection'
  | 'docker-secret-copy'
  | 'secret-pattern'
  | 'credential-url'
  | 'generic-secret-assignment';

export interface Finding {
  file: string;
  line: number;
  rule: FindingRule;
  message: string;
}

export interface ScanResult {
  findings: Finding[];
  scannedFiles: number;
}

const ENV_EXAMPLE = '.env.example';
const BINARY_PROBE_BYTES = 8000;

/** Nombre de variable sensible. Los sufijos `_FILE` (indirección a `/run/secrets`) son seguros. */
const SECRET_NAME = /(^|_)(PASSWORD|PASSWD|SECRET|TOKEN|KEY)(_|$)/;

export function isSecretName(name: string): boolean {
  const upper = name.toUpperCase();
  return !upper.endsWith('_FILE') && SECRET_NAME.test(upper);
}

/** Valores de ejemplo que no deben aparecer en `.env.example`. */
const PLACEHOLDER_SUBSTRINGS = /changeme|change_me|replace[-_]?me|xxx|<[^>]*>|your[-_]/i;
const PLACEHOLDER_WORDS = /^[a-z0-9]*[-_]?(password|passwd|secret|pass)\d*$/i;

/** Patrones de credenciales de alta confianza (formatos de proveedor con prefijo fijo). */
const HIGH_CONFIDENCE_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: 'clave de acceso AWS', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  {
    label: 'token de GitHub',
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g,
  },
  { label: 'token de Slack', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { label: 'clave secreta de Stripe', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/g },
  { label: 'clave de API de Google', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: 'token de npm', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { label: 'clave privada PEM', re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY(?: BLOCK)?-----/g },
  { label: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];

/** URL con usuario y contraseña literales. `${VAR}` y `<runtime>` no coinciden (caracteres excluidos). */
const CREDENTIAL_URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"`<>{}()$]+:[^\s/?#@'"`<>{}()$]+@/gi;

/** Asignación `NOMBRE_SECRETO = valor` (mayúsculas), con separador `:` o `=`. */
const GENERIC_ASSIGNMENT =
  /\b((?:[A-Z][A-Z0-9]*_)*(?:PASSWORD|PASSWD|SECRET|TOKEN|KEY))["']?\s*[:=]\s*(["']?)([^\s"'`;,]+)/g;

const MARKDOWN = /\.(?:md|markdown)$/i;
const PATTERN_SKIP_NAMES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'npm-shrinkwrap.json',
]);
const PATTERN_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.angular',
  'coverage',
  'playwright-report',
  'test-results',
  '.copilot',
  '.nx',
  '.turbo',
  'fixtures',
  '__fixtures__',
]);

function isDockerfile(name: string): boolean {
  return name === 'Dockerfile' || name.startsWith('Dockerfile.') || name.endsWith('.Dockerfile');
}

function isEnvFileName(name: string): boolean {
  return (name === '.env' || name.startsWith('.env.')) && name !== ENV_EXAMPLE;
}

function isSecretsSegment(segment: string): boolean {
  return segment.toLowerCase() === 'secrets';
}

/** Reglas por ruta: `.env` rastreados y directorios `secrets/`. */
function checkPathRules(path: string): Finding[] {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  const findings: Finding[] = [];
  if (isEnvFileName(name)) {
    findings.push({
      file: path,
      line: 1,
      rule: 'tracked-env-file',
      message: 'archivo .env rastreado por git; solo se permite .env.example',
    });
  }
  if (segments.slice(0, -1).some(isSecretsSegment)) {
    findings.push({
      file: path,
      line: 1,
      rule: 'tracked-secrets-dir',
      message: 'archivo dentro de un directorio secrets/ rastreado por git',
    });
  }
  return findings;
}

/** `.env.example`: los campos secretos deben estar vacíos y ningún valor puede ser placeholder. */
function checkEnvExample(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  text.split('\n').forEach((raw, index) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=(.*)$/.exec(trimmed);
    if (!match) return;
    const key = match[1];
    const value = match[2]
      .replace(/\s#.*$/, '')
      .trim()
      .replace(/^(["'])(.*)\1$/, '$2')
      .trim();
    const line = index + 1;

    if (isSecretName(key)) {
      if (value !== '') {
        findings.push({
          file,
          line,
          rule: 'env-example-secret-value',
          message: `campo secreto "${key}" con valor; debe quedar vacío en ${ENV_EXAMPLE}`,
        });
      }
      return;
    }
    if (PLACEHOLDER_SUBSTRINGS.test(value) || PLACEHOLDER_WORDS.test(value)) {
      findings.push({
        file,
        line,
        rule: 'env-example-placeholder',
        message: `valor de ejemplo débil en "${key}"; use un campo vacío o una referencia`,
      });
    }
  });
  return findings;
}

/** Instrucción Dockerfile lógica (unidas las líneas con `\`), con la línea de inicio. */
interface DockerInstruction {
  line: number;
  text: string;
}

function dockerInstructions(text: string): DockerInstruction[] {
  const instructions: DockerInstruction[] = [];
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
    instructions.push({ line: startLine, text: buffer });
    buffer = undefined;
  });
  if (buffer !== undefined && buffer !== '') instructions.push({ line: startLine, text: buffer });
  return instructions;
}

/** Nombres que define una instrucción ARG o ENV (`K=V` o la forma legada `ENV K valor`). */
function definedNames(keyword: 'ARG' | 'ENV', tokens: string[]): string[] {
  if (keyword === 'ARG') return tokens.map((t) => t.split('=')[0]);
  if (tokens[0]?.includes('='))
    return tokens.filter((t) => t.includes('=')).map((t) => t.split('=')[0]);
  return tokens.slice(0, 1);
}

/** Fuente de COPY/ADD que expone un `.env*` (salvo `.env.example`) o un directorio `secrets/`. */
function isSecretSource(source: string): boolean {
  const segments = source.replace(/^\.\//, '').replace(/\/+$/, '').split('/');
  const name = segments[segments.length - 1];
  return isEnvFileName(name) || segments.some(isSecretsSegment);
}

function checkDockerfile(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  for (const instruction of dockerInstructions(text)) {
    const match = /^(ARG|ENV|COPY|ADD)\s+(.+)$/i.exec(instruction.text);
    if (!match) continue;
    const keyword = match[1].toUpperCase();
    const tokens = match[2].split(/\s+/).filter(Boolean);

    if (keyword === 'ARG' || keyword === 'ENV') {
      const secret = definedNames(keyword, tokens).find(isSecretName);
      if (secret !== undefined) {
        findings.push({
          file,
          line: instruction.line,
          rule: 'docker-secret-injection',
          message: `${keyword} con nombre secreto; los secretos no se inyectan en la imagen (use *_FILE y Compose secrets)`,
        });
      }
      continue;
    }

    const sources = tokens.filter((t) => !t.startsWith('--')).slice(0, -1);
    if (sources.some(isSecretSource)) {
      findings.push({
        file,
        line: instruction.line,
        rule: 'docker-secret-copy',
        message: `${keyword} de .env o de un directorio secrets/ hacia la imagen`,
      });
    }
  }
  return findings;
}

/** Un valor literal parece secreto: largo, mezcla letras y dígitos, y no es una referencia. */
function isLikelySecretValue(value: string): boolean {
  return (
    value.length >= 16 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value) &&
    !/[\$\{\}<\(\[\.`]/.test(value)
  );
}

function checkPatterns(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  text.split('\n').forEach((line, index) => {
    const lineNo = index + 1;
    for (const { label, re } of HIGH_CONFIDENCE_PATTERNS) {
      if (line.search(re) !== -1) {
        findings.push({
          file,
          line: lineNo,
          rule: 'secret-pattern',
          message: `posible secreto de alta confianza (${label})`,
        });
      }
    }
    if (line.search(CREDENTIAL_URL) !== -1) {
      findings.push({
        file,
        line: lineNo,
        rule: 'credential-url',
        message:
          'URL con contraseña literal; use una referencia a variable o a un secreto de runtime',
      });
    }
    for (const match of line.matchAll(GENERIC_ASSIGNMENT)) {
      if (isLikelySecretValue(match[3])) {
        findings.push({
          file,
          line: lineNo,
          rule: 'generic-secret-assignment',
          message: `asignación literal a una variable de nombre secreto ("${match[1]}")`,
        });
        break;
      }
    }
  });
  return findings;
}

/** Ruta sujeta a las reglas de patrón (no Markdown, lockfiles, generados ni fixtures). */
function isPatternScanned(path: string): boolean {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  if (MARKDOWN.test(name) || PATTERN_SKIP_NAMES.has(name)) return false;
  return !segments.slice(0, -1).some((s) => PATTERN_SKIP_DIRS.has(s));
}

/**
 * Aplica todas las reglas a las rutas dadas. `readText` devuelve el contenido, o
 * `undefined` si no debe analizarse por contenido (binario o no disponible).
 */
export function scanFiles(
  paths: readonly string[],
  readText: (path: string) => string | undefined,
): Finding[] {
  const findings: Finding[] = [];
  for (const path of paths) {
    findings.push(...checkPathRules(path));
    const text = readText(path);
    if (text === undefined) continue;
    const name = basename(path);
    if (name === ENV_EXAMPLE) {
      findings.push(...checkEnvExample(path, text));
      continue;
    }
    if (isDockerfile(name)) findings.push(...checkDockerfile(path, text));
    if (isPatternScanned(path)) findings.push(...checkPatterns(path, text));
  }
  return findings;
}

function normalizePath(path: string): string {
  const slashes = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? slashes.toLowerCase() : slashes;
}

function runGit(root: string, args: string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} falló (código ${result.status}): ${result.stderr.trim()}`);
  }
  return result.stdout;
}

/**
 * Rutas rastreadas por git (índice). Falla cerrado si `root` no es la raíz del
 * repositorio: sin esta comprobación git subiría a un repositorio padre y
 * escanearía un índice ajeno.
 */
export function listTrackedFiles(root: string): string[] {
  const top = runGit(root, ['rev-parse', '--show-toplevel']).trim();
  if (normalizePath(top) !== normalizePath(realpathSync(root))) {
    throw new Error(`${root} no es la raíz de un repositorio git`);
  }
  return runGit(root, ['ls-files', '-z', '--cached']).split('\0').filter(Boolean);
}

function readTrackedText(root: string, rel: string): string | undefined {
  let buffer: Buffer;
  try {
    buffer = readFileSync(join(root, rel));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  if (buffer.subarray(0, BINARY_PROBE_BYTES).includes(0)) return undefined;
  return buffer.toString('utf8');
}

/** Escanea solo los archivos rastreados por git de `root`. */
export function scanRepository(root: string): ScanResult {
  const tracked = listTrackedFiles(root);
  const findings = scanFiles(tracked, (path) => readTrackedText(root, path));
  return { findings, scannedFiles: tracked.length };
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function rootFromArgs(argv: readonly string[]): string {
  const index = argv.indexOf('--root');
  return index !== -1 && argv[index + 1] ? resolve(argv[index + 1]) : REPO_ROOT;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const result = scanRepository(rootFromArgs(process.argv.slice(2)));
    if (result.findings.length > 0) {
      for (const finding of result.findings) {
        console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
      }
      console.error(
        `\ncheck:secrets FALLÓ (${result.findings.length} incidencia(s), ${result.scannedFiles} archivos rastreados)`,
      );
      process.exit(1);
    }
    console.log(`check:secrets OK (${result.scannedFiles} archivos rastreados revisados)`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`check:secrets ERROR: ${reason}`);
    process.exit(2);
  }
}
