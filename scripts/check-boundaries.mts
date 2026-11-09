/**
 * check-boundaries (T-052): comprobación de fronteras entre zonas del monorepo.
 *
 * Reglas (plan §12.4, constitución VI/VIII/XI):
 * - Dependencias permitidas entre zonas: web→domain, api→domain, scripts→domain
 *   (y dentro de la misma zona). Cualquier otra arista entre zonas falla:
 *   en particular web→api y api→web.
 * - `packages/domain` es código puro: no importa framework (Angular, Fastify),
 *   Drizzle/drivers de BD, módulos HTTP/red de Node, ni E/S (fs, path,
 *   child_process, process, fetch, sockets, `process.env`, `import.meta.env`).
 *
 * Diseño:
 * - Se analiza el AST con TypeScript (dependencia de desarrollo raíz ya existente),
 *   no con expresiones regulares: comentarios y texto de cadenas no producen
 *   falsos positivos, y solo cuentan import/export-from, `import x = require()`,
 *   `require()`, `import()` y tipos `import('…')`.
 * - Las reglas son datos (ZONES, ALLOWED_EDGES, DOMAIN_FORBIDDEN). Añadir `apps/api`
 *   o un paquete prohibido es una línea en la tabla.
 * - Un import dinámico o `require` con especificador no literal no se puede verificar:
 *   se reporta (falla cerrada) en lugar de ignorarlo.
 * - Sin red, sin dependencias nuevas. Uso: `pnpm check:boundaries [--root <dir>]`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export type Zone = 'web' | 'api' | 'domain' | 'scripts';

export type IssueRule =
  | 'zone-edge'
  | 'domain-framework'
  | 'domain-database'
  | 'domain-network'
  | 'domain-io'
  | 'unresolvable-import';

export interface Issue {
  file: string;
  line: number;
  rule: IssueRule;
  message: string;
}

export interface ScanResult {
  issues: Issue[];
  scannedFiles: number;
}

interface ZoneDef {
  readonly zone: Zone;
  /** Rutas (relativas a la raíz, separador `/`) que pertenecen a la zona. */
  readonly roots: readonly string[];
}

/**
 * Zonas del repositorio. `src/` es la web hoy; cuando T-067 mueva la web, `apps/web`
 * ya está cubierto. `apps/api` se añade con T-053 sin cambiar la regla.
 */
export const ZONES: readonly ZoneDef[] = [
  { zone: 'web', roots: ['src', 'apps/web', 'e2e'] },
  { zone: 'api', roots: ['apps/api'] },
  { zone: 'domain', roots: ['packages/domain'] },
  { zone: 'scripts', roots: ['scripts'] },
];

/** Nombres de paquete de workspace que apuntan a una zona. */
const ZONE_PACKAGES: ReadonlyMap<string, Zone> = new Map([
  ['@gd/web', 'web'],
  ['@gd/api', 'api'],
  ['@gd/domain', 'domain'],
]);

/** Aristas permitidas `origen → destinos` (la misma zona siempre se permite). */
export const ALLOWED_EDGES: Readonly<Record<Zone, readonly Zone[]>> = {
  web: ['domain'],
  api: ['domain'],
  domain: [],
  scripts: ['domain'],
};

const EDGE_HINTS: ReadonlyMap<string, string> = new Map([
  ['web>api', 'La web no importa la API: el acceso es solo HTTP desde el adaptador ApiContentRepository.'],
  ['api>web', 'La API no importa la web: los contratos compartidos viven en packages/domain.'],
]);

interface ForbiddenGroup {
  readonly rule: IssueRule;
  readonly label: string;
  /** Nombre exacto, o prefijo si termina en `*`. Para módulos de Node, sin `node:`. */
  readonly patterns: readonly string[];
}

const DOMAIN_FORBIDDEN: readonly ForbiddenGroup[] = [
  {
    rule: 'domain-framework',
    label: 'framework (Angular/Fastify)',
    patterns: ['@angular/*', '@angular-devkit/*', 'fastify', 'fastify-*', '@fastify/*'],
  },
  {
    rule: 'domain-database',
    label: 'Drizzle o driver de base de datos',
    patterns: [
      'drizzle-orm',
      'drizzle-kit',
      'pg',
      'pg-*',
      'postgres',
      'mysql2',
      'better-sqlite3',
      'sqlite3',
      '@prisma/client',
      '@electric-sql/pglite',
      'knex',
      'typeorm',
      'sequelize',
      'mongodb',
    ],
  },
  {
    rule: 'domain-network',
    label: 'módulo HTTP o de red',
    patterns: ['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns', 'undici', 'node-fetch', 'axios', 'got'],
  },
  {
    rule: 'domain-io',
    label: 'E/S del sistema',
    patterns: ['fs', 'path', 'child_process', 'os', 'process', 'worker_threads', 'cluster', 'readline', 'vm'],
  },
];

/** Constructores globales de red o E/S prohibidos en el dominio. */
const NETWORK_CONSTRUCTORS: ReadonlySet<string> = new Set(['XMLHttpRequest', 'WebSocket']);
const FETCH_RECEIVERS: ReadonlySet<string> = new Set(['globalThis', 'window', 'self']);

/** Directorios ignorados en cualquier nivel de una zona. `fixtures` aloja casos a propósito inválidos. */
const IGNORED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', 'coverage', '.angular', '.git', 'fixtures']);
const CODE_EXT = /\.[cm]?[jt]sx?$/;

function normalizeRel(path: string): string {
  return posix.normalize(path.replace(/\\/g, '/'));
}

/** Zona de una ruta relativa a la raíz del repositorio; undefined si no pertenece a ninguna. */
export function zoneOf(relPath: string): Zone | undefined {
  const path = normalizeRel(relPath);
  if (path === '..' || path.startsWith('../')) return undefined;
  for (const { zone, roots } of ZONES) {
    for (const root of roots) {
      if (path === root || path.startsWith(`${root}/`)) return zone;
    }
  }
  return undefined;
}

/**
 * Nombre de paquete de un especificador: `@scope/name` o `name` (sin subruta).
 * `node:fs/promises` → `fs`. Undefined para rutas relativas y absolutas.
 */
export function packageName(specifier: string): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return undefined;
  if (specifier.startsWith('node:')) return specifier.slice('node:'.length).split('/')[0];
  const parts = specifier.split('/');
  if (specifier.startsWith('@')) return parts.length < 2 ? undefined : parts.slice(0, 2).join('/');
  return parts[0];
}

/** Zona de un paquete de workspace (`@gd/domain`, `@gd/domain/vocabulary`). */
export function zoneOfPackage(specifier: string): Zone | undefined {
  const name = packageName(specifier);
  return name === undefined ? undefined : ZONE_PACKAGES.get(name);
}

function matchesPattern(name: string, pattern: string): boolean {
  return pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern;
}

function forbiddenDomainGroup(specifier: string): ForbiddenGroup | undefined {
  const name = packageName(specifier);
  if (name === undefined) return undefined;
  return DOMAIN_FORBIDDEN.find((group) => group.patterns.some((p) => matchesPattern(name, p)));
}

function scriptKindFor(file: string): ts.ScriptKind {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function isGlobalFetch(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) return expression.text === 'fetch';
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === 'fetch' &&
    ts.isIdentifier(expression.expression) &&
    FETCH_RECEIVERS.has(expression.expression.text)
  );
}

/** Nombre del uso de E/S global (`process.env`, `fetch`…) o undefined si el nodo no lo es. */
function ioGlobalUse(node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'env') {
    const target = node.expression;
    if (ts.isIdentifier(target) && target.text === 'process') return 'process.env';
    if (ts.isPropertyAccessExpression(target) && target.name.text === 'process') return 'process.env';
    if (ts.isMetaProperty(target)) return 'import.meta.env';
  }
  if (
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process' &&
    ts.isStringLiteral(node.argumentExpression) &&
    node.argumentExpression.text === 'env'
  ) {
    return 'process.env';
  }
  if (ts.isCallExpression(node) && isGlobalFetch(node.expression)) return 'fetch()';
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && NETWORK_CONSTRUCTORS.has(node.expression.text)) {
    return `new ${node.expression.text}()`;
  }
  return undefined;
}

function isModuleCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  return callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');
}

function edgeMessage(spec: string, from: Zone, to: Zone): string {
  const hint = EDGE_HINTS.get(`${from}>${to}`) ?? '';
  const allowed = ALLOWED_EDGES[from].map((target) => `${from}→${target}`);
  const permitted = allowed.length > 0 ? allowed.join(', ') : 'ninguna (solo dentro de la zona)';
  return (
    `importa "${spec}" (zona "${to}") desde la zona "${from}": prohibido. ${hint} ` +
    `Dependencias permitidas desde "${from}": ${permitted} (plan §12.4).`.trim()
  );
}

/**
 * Comprueba un archivo fuente. `file` es la ruta relativa a la raíz (separador `/`).
 * Función pura: no lee disco. Archivos fuera de cualquier zona no se analizan.
 */
export function checkSource(file: string, text: string): Issue[] {
  const zone = zoneOf(file);
  if (zone === undefined) return [];

  const relPath = normalizeRel(file);
  const sourceFile = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, scriptKindFor(relPath));
  const issues: Issue[] = [];
  const lineOf = (node: ts.Node): number => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  const checkSpecifier = (spec: string, node: ts.Node): void => {
    const line = lineOf(node);
    const isRelative = spec.startsWith('.');
    const target = isRelative ? zoneOf(posix.join(posix.dirname(relPath), spec)) : zoneOfPackage(spec);
    if (target !== undefined && target !== zone && !ALLOWED_EDGES[zone].includes(target)) {
      issues.push({ file: relPath, line, rule: 'zone-edge', message: edgeMessage(spec, zone, target) });
    }
    if (zone !== 'domain') return;
    const group = forbiddenDomainGroup(spec);
    if (group !== undefined) {
      issues.push({
        file: relPath,
        line,
        rule: group.rule,
        message:
          `importa "${spec}" (${group.label}) prohibido en packages/domain: el dominio es puro (plan §12.4). ` +
          'Mueve la E/S o el framework a apps/* o scripts/ y pasa el dato como parámetro.',
      });
    }
  };

  const reportUnresolved = (node: ts.Node): void => {
    issues.push({
      file: relPath,
      line: lineOf(node),
      rule: 'unresolvable-import',
      message:
        'import/require con especificador no literal: la frontera no se puede verificar. ' +
        'Usa un string literal (p. ej. import("./home.page")).',
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        checkSpecifier(node.moduleSpecifier.text, node.moduleSpecifier);
      }
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (ts.isStringLiteral(expression)) checkSpecifier(expression.text, expression);
    } else if (ts.isImportTypeNode(node)) {
      const literal = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      if (literal && ts.isStringLiteral(literal)) checkSpecifier(literal.text, literal);
    } else if (ts.isCallExpression(node) && isModuleCall(node)) {
      const arg = node.arguments[0];
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
        checkSpecifier(arg.text, arg);
      } else {
        reportUnresolved(node);
      }
    }

    if (zone === 'domain') {
      const use = ioGlobalUse(node);
      if (use !== undefined) {
        issues.push({
          file: relPath,
          line: lineOf(node),
          rule: 'domain-io',
          message: `uso de ${use} (E/S) prohibido en packages/domain: el dominio es puro (plan §12.4). Pasa el valor como parámetro.`,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return issues;
}

/** Archivos de código de las zonas, relativos a `root`, en orden determinista. */
function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (relDir: string): void => {
    const entries = readdirSync(join(root, relDir), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(rel);
      } else if (entry.isFile() && CODE_EXT.test(entry.name)) {
        out.push(rel);
      }
    }
  };
  for (const { roots } of ZONES) {
    for (const zoneRoot of roots) {
      if (existsSync(join(root, zoneRoot))) walk(zoneRoot);
    }
  }
  return out;
}

/** Escanea las zonas de un repositorio (o fixture). Las zonas inexistentes se omiten. */
export function scanWorkspace(root: string): ScanResult {
  const files = collectFiles(root);
  const issues = files.flatMap((rel) => checkSource(rel, readFileSync(join(root, rel), 'utf8')));
  return { issues, scannedFiles: files.length };
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function rootFromArgs(argv: readonly string[]): string {
  const index = argv.indexOf('--root');
  return index !== -1 && argv[index + 1] ? resolve(argv[index + 1]) : REPO_ROOT;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = scanWorkspace(rootFromArgs(process.argv.slice(2)));
  if (result.issues.length > 0) {
    for (const issue of result.issues) {
      console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`);
    }
    console.error(`\ncheck:boundaries FALLÓ (${result.issues.length} incidencia(s), ${result.scannedFiles} archivos revisados)`);
    process.exit(1);
  }
  console.log(`check:boundaries OK (${result.scannedFiles} archivos revisados)`);
}
