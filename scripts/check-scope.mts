/**
 * check-scope (T-069): guardia de alcance sin framework.
 *
 * Falla si el repositorio introduce piezas prohibidas por la constitución
 * (principio VIII) y el plan §12.7: Redis, colas/workers, proveedores de
 * autenticación externos, almacenamiento de objetos, scraping o automatización
 * de navegador, más de un servicio de aplicación / una base de datos en Compose,
 * y pantallas de comentarios y calculadora (fuera de alcance, spec AC-08).
 *
 * Diseño:
 * - Las reglas son datos (FORBIDDEN_CAPABILITIES). Añadir un paquete, imagen,
 *   nombre de servicio o esquema de URL es una línea en la tabla.
 * - Parser de Compose por indentación (sin dependencias). Ante sintaxis que no
 *   entiende (p. ej. `services: { ... }` en línea) falla de forma cerrada.
 * - Sin red, sin dependencias nuevas. Uso: `pnpm check:scope [--root <dir>]`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type RuleId = 'redis' | 'queue-worker' | 'external-auth' | 'object-storage' | 'scraping';
export type IssueRule = RuleId | 'compose-topology' | 'out-of-scope-route' | 'invalid-input';
export type SourceKind = 'code' | 'config';

export interface Issue {
  file: string;
  line: number;
  rule: IssueRule;
  message: string;
}

/**
 * Patrón de paquete/imagen/servicio: nombre exacto, o prefijo si termina en `*`.
 * Las reglas de paquetes cubren manifiestos y código; las de imagen y nombre,
 * Compose; `urlSchemes`, cadenas de conexión en código y configuración.
 */
export interface CapabilityRule {
  readonly id: RuleId;
  readonly label: string;
  readonly packages: readonly string[];
  readonly images: readonly string[];
  readonly serviceNames: readonly string[];
  readonly urlSchemes: readonly string[];
}

export const FORBIDDEN_CAPABILITIES: readonly CapabilityRule[] = [
  {
    id: 'redis',
    label: 'Redis',
    packages: [
      'redis',
      'redis-*',
      'ioredis*',
      '@redis/*',
      '@upstash/redis',
      '@testcontainers/redis',
    ],
    images: ['redis', 'valkey', 'keydb', 'dragonfly'],
    serviceNames: ['redis', 'valkey', 'keydb', 'dragonfly'],
    urlSchemes: ['redis', 'rediss'],
  },
  {
    id: 'queue-worker',
    label: 'cola o worker',
    packages: [
      'bull',
      'bullmq',
      'bee-queue',
      'kue',
      'agenda',
      'bree',
      'node-resque',
      'pg-boss',
      'amqplib',
      'amqp-connection-manager',
      'kafkajs',
      'node-rdkafka',
      'sqs-consumer',
      '@aws-sdk/client-sqs*',
      '@google-cloud/pubsub',
      'nats',
      '@nats-io/*',
      'piscina',
      'workerpool',
    ],
    images: ['rabbitmq', 'kafka', 'redpanda', 'nats', 'zookeeper', 'activemq'],
    serviceNames: [
      'worker',
      'workers',
      'queue',
      'queues',
      'rabbitmq',
      'kafka',
      'redpanda',
      'nats',
      'zookeeper',
      'activemq',
    ],
    urlSchemes: ['amqp', 'amqps', 'nats'],
  },
  {
    id: 'external-auth',
    label: 'proveedor de autenticación externo',
    packages: [
      'passport',
      'passport-*',
      'auth0',
      '@auth0/*',
      '@clerk/*',
      'keycloak-js',
      'keycloak-connect',
      'firebase',
      'firebase-admin',
      '@azure/msal-*',
      '@supabase/supabase-js',
      'next-auth',
      '@auth/*',
      '@okta/*',
      '@kinde-oss/*',
    ],
    images: ['keycloak', 'kratos', 'hydra', 'authentik', 'dex', 'zitadel'],
    serviceNames: ['keycloak', 'kratos', 'hydra', 'authentik', 'dex', 'zitadel'],
    urlSchemes: [],
  },
  {
    id: 'object-storage',
    label: 'almacenamiento de objetos',
    packages: [
      'minio',
      'aws-sdk',
      '@aws-sdk/client-s3*',
      '@aws-sdk/s3-request-presigner',
      '@aws-sdk/lib-storage',
      '@google-cloud/storage',
      '@azure/storage-blob',
      '@supabase/storage-js',
    ],
    images: ['minio', 'localstack', 'seaweedfs'],
    serviceNames: ['minio', 'localstack', 'seaweedfs'],
    urlSchemes: ['s3'],
  },
  {
    id: 'scraping',
    label: 'scraping o automatización de navegador',
    // `playwright`/`@playwright/test`, `lighthouse`, `chrome-launcher` y `jsdom`
    // son herramientas de prueba legítimas: no entran en la tabla (spec AC-08).
    packages: [
      'cheerio',
      'cheerio-*',
      'crawlee',
      '@crawlee/*',
      'puppeteer',
      'puppeteer-core',
      'puppeteer-extra',
      'puppeteer-extra-plugin-*',
      'scrape-it',
      'node-crawler',
      'simplecrawler',
      'website-scraper',
      'x-ray',
      'selenium-webdriver',
      'webdriverio',
      '@wdio/*',
      'nightmare',
      'phantomjs-prebuilt',
    ],
    images: ['browserless', 'standalone-chrome', 'standalone-firefox', 'standalone-edge'],
    serviceNames: ['browserless', 'scraper', 'scraping'],
    urlSchemes: [],
  },
];

/**
 * Pantallas fuera de alcance del MVP (spec §7, AC-08): comentarios y calculadora.
 * Se detectan como valor de `path:` o como enlace absoluto (`/comentarios`), no
 * como palabra suelta, para no marcar prosa que las menciona.
 */
export const OUT_OF_SCOPE_ROUTES: readonly string[] = [
  'comentarios',
  'comments',
  'calculadora',
  'calculator',
];

/** Imágenes de base de datos: el máximo permitido es una (plan §12.7). */
export const DB_IMAGES: readonly string[] = [
  'postgres',
  'postgis',
  'mysql',
  'mariadb',
  'mongo',
  'mssql',
  'cockroachdb',
];
/** Servicios de un solo uso exentos del conteo de aplicación (plan §12.7: `migrate`). */
export const ONE_SHOT_SERVICES: readonly string[] = ['migrate'];
export const MAX_APP_SERVICES = 1;
export const MAX_DB_SERVICES = 1;

const MANIFEST_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

/** Directorios ignorados en cualquier nivel. */
const IGNORED_DIRS_ANY = new Set([
  'node_modules',
  'dist',
  '.angular',
  '.git',
  'coverage',
  'playwright-report',
  'test-results',
  '.copilot',
  'session-state',
  '.nx',
  '.turbo',
  // Árboles de prueba: pueden contener Redis/colas como fixtures (no son alcance de producción).
  'test',
  'tests',
  '__tests__',
  '__mocks__',
  'e2e',
  'fixtures',
  'testing',
]);
/** Directorios de documentación/specs ignorados solo en la raíz (src/app/core/content sí se escanea). */
const IGNORED_DIRS_ROOT = new Set(['specs', 'docs', '.specify', 'content']);
const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

const IMPORT_PATTERNS: readonly RegExp[] = [
  // El especificador es siempre el último grupo de captura.
  /\bimport\s+(?:type\s+)?[^'";]*?\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bexport\s+[^'";]*?\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
];

const URL_SCHEMES = FORBIDDEN_CAPABILITIES.flatMap((r) => r.urlSchemes);
const URL_PATTERN = new RegExp(`\\b(${URL_SCHEMES.join('|')}):\\/\\/`, 'gi');

/**
 * Rutas fuera de alcance: `path: 'comentarios'` (o con `/` inicial) y enlaces
 * absolutos `'/comentarios'`. Ambas formas exigen límites de ruta, así que
 * prosa como «sin comentarios» no produce incidencia. Una sola expresión evita
 * contar dos veces `path: '/comentarios'`.
 */
const ROUTE_ALTERNATION = OUT_OF_SCOPE_ROUTES.join('|');
const ROUTE_PATTERN = new RegExp(
  `(?:\\bpath\\s*:\\s*['"]\\/?|['"]\\/)(${ROUTE_ALTERNATION})(?=['"/?#]|$)`,
  'gi',
);

/** Coincide un valor con un patrón exacto o de prefijo (`algo*`). */
function matchesPattern(value: string, pattern: string): boolean {
  return pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : value === pattern;
}

export function ruleForPackage(name: string): CapabilityRule | undefined {
  return FORBIDDEN_CAPABILITIES.find((r) => r.packages.some((p) => matchesPattern(name, p)));
}

function ruleForScheme(scheme: string): CapabilityRule | undefined {
  return FORBIDDEN_CAPABILITIES.find((r) => r.urlSchemes.includes(scheme));
}

/** Nombre de paquete de un especificador de import; undefined si es relativo o builtin. */
export function packageName(specifier: string): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:'))
    return undefined;
  const parts = specifier.split('/');
  if (specifier.startsWith('@')) return parts.length < 2 ? undefined : parts.slice(0, 2).join('/');
  return parts[0];
}

/** Basename de imagen sin registro, tag ni digest: `docker.io/library/postgres:17@sha256:..` -> `postgres`. */
export function imageBase(image: string | undefined): string | undefined {
  if (!image) return undefined;
  const noDigest = image.split('@')[0];
  const last = noDigest.split('/').pop() ?? noDigest;
  return last.split(':')[0].toLowerCase() || undefined;
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sustituye por líneas vacías los comentarios, conservando los números de línea. */
function stripComments(text: string, kind: SourceKind): string {
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      const isComment =
        t.startsWith('#') ||
        (kind === 'code' && (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')));
      return isComment ? '' : line;
    })
    .join('\n');
}

/** Manifiesto package.json: busca paquetes prohibidos en todas las secciones de dependencias. */
export function checkManifestText(file: string, text: string): Issue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [{ file, line: 1, rule: 'invalid-input', message: `JSON no válido: ${reason}` }];
  }
  if (!isRecord(parsed)) return [];

  const lines = text.split('\n');
  const issues: Issue[] = [];
  for (const section of MANIFEST_SECTIONS) {
    const deps = parsed[section];
    if (!isRecord(deps)) continue;
    for (const name of Object.keys(deps)) {
      const rule = ruleForPackage(name);
      if (!rule) continue;
      const keyLine = lines.findIndex((l) => l.includes(`"${name}"`));
      issues.push({
        file,
        line: keyLine === -1 ? 1 : keyLine + 1,
        rule: rule.id,
        message: `dependencia "${name}" en ${section} (${rule.label}) prohibida por la constitución, principio VIII`,
      });
    }
  }
  return issues;
}

/**
 * Código y configuración: imports/require de paquetes prohibidos (solo código)
 * y URLs de conexión prohibidas (código y configuración).
 */
export function checkSourceText(file: string, text: string, kind: SourceKind): Issue[] {
  const source = stripComments(text, kind);
  const issues: Issue[] = [];

  if (kind === 'code') {
    for (const pattern of IMPORT_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const spec = match[1];
        const pkg = packageName(spec);
        const rule = pkg === undefined ? undefined : ruleForPackage(pkg);
        if (!rule) continue;
        const specIndex = (match.index ?? 0) + match[0].lastIndexOf(spec);
        issues.push({
          file,
          line: lineAt(source, specIndex),
          rule: rule.id,
          message: `importa "${spec}" (${rule.label}) prohibido por la constitución, principio VIII`,
        });
      }
    }
  }

  for (const match of source.matchAll(URL_PATTERN)) {
    const scheme = match[1].toLowerCase();
    const rule = ruleForScheme(scheme);
    if (!rule) continue;
    issues.push({
      file,
      line: lineAt(source, match.index ?? 0),
      rule: rule.id,
      message: `URL ${scheme}:// (${rule.label}) prohibida por la constitución, principio VIII`,
    });
  }

  for (const match of source.matchAll(ROUTE_PATTERN)) {
    const segment = match[1].toLowerCase();
    issues.push({
      file,
      line: lineAt(source, match.index ?? 0),
      rule: 'out-of-scope-route',
      message: `ruta "${segment}" (pantalla de comentarios o calculadora, fuera de alcance) prohibida por la constitución, principio VIII`,
    });
  }
  return issues;
}

export interface ComposeService {
  name: string;
  image?: string;
  line: number;
}

/** Parser de Compose por indentación: servicios bajo `services:` y su `image:` directa. */
export function parseComposeServices(text: string, file: string): ComposeService[] {
  return parseCompose(text, file).services;
}

interface ParsedCompose {
  services: ComposeService[];
  issues: Issue[];
}

function parseCompose(text: string, file: string): ParsedCompose {
  const services: ComposeService[] = [];
  const issues: Issue[] = [];
  let inServices = false;
  let serviceIndent = -1;
  let childIndent = -1;
  let current: ComposeService | undefined;

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, '');
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;

    if (indent === 0) {
      if (/^services:\s*(#.*)?$/.test(raw)) {
        inServices = true;
        serviceIndent = -1;
        current = undefined;
      } else if (/^services:\s*\S/.test(raw)) {
        issues.push({
          file,
          line: i + 1,
          rule: 'invalid-input',
          message: '`services` en línea no soportado; use la forma de bloque YAML',
        });
        inServices = false;
      } else {
        inServices = false;
        current = undefined;
      }
      continue;
    }
    if (!inServices) continue;

    if (serviceIndent === -1) serviceIndent = indent;
    if (indent === serviceIndent) {
      const key = /^["']?([A-Za-z0-9_.-]+)["']?:\s*(.*)$/.exec(trimmed);
      if (!key) {
        issues.push({
          file,
          line: i + 1,
          rule: 'invalid-input',
          message: 'entrada de servicio no reconocida',
        });
        current = undefined;
        continue;
      }
      if (key[2].startsWith('{')) {
        issues.push({
          file,
          line: i + 1,
          rule: 'invalid-input',
          message: `servicio "${key[1]}" en línea no soportado`,
        });
        current = undefined;
        continue;
      }
      current = { name: key[1], line: i + 1 };
      childIndent = -1;
      services.push(current);
    } else if (current && indent > serviceIndent) {
      if (childIndent === -1) childIndent = indent;
      const image = indent === childIndent ? /^image:\s*(.+)$/.exec(trimmed) : null;
      if (image && current.image === undefined) {
        const value = image[1]
          .replace(/\s+#.*$/, '')
          .trim()
          .replace(/^["']|["']$/g, '');
        if (value) current.image = value;
      }
    }
  }
  return { services, issues };
}

function forbiddenComposeRule(name: string, image: string | undefined): CapabilityRule | undefined {
  const base = imageBase(image);
  const lowered = name.toLowerCase();
  return FORBIDDEN_CAPABILITIES.find(
    (r) => r.serviceNames.includes(lowered) || (base !== undefined && r.images.includes(base)),
  );
}

export interface ComposeFile {
  file: string;
  text: string;
}

/**
 * Compose: fusiona servicios por nombre entre ficheros (base + overrides), marca
 * servicios prohibidos y cuenta aplicaciones y bases de datos.
 */
export function checkComposeFiles(files: readonly ComposeFile[]): Issue[] {
  const issues: Issue[] = [];
  const merged = new Map<string, { name: string; image?: string; file: string; line: number }>();
  const flagged = new Set<string>();

  for (const { file, text } of files) {
    const parsed = parseCompose(text, file);
    issues.push(...parsed.issues);
    for (const svc of parsed.services) {
      const rule = forbiddenComposeRule(svc.name, svc.image);
      if (rule) {
        flagged.add(svc.name);
        issues.push({
          file,
          line: svc.line,
          rule: rule.id,
          message: `servicio "${svc.name}" (${rule.label}) prohibido por la constitución, principio VIII`,
        });
      }
      const prev = merged.get(svc.name);
      if (!prev) merged.set(svc.name, { name: svc.name, image: svc.image, file, line: svc.line });
      else if (prev.image === undefined && svc.image !== undefined) prev.image = svc.image;
    }
  }

  const apps: { name: string; file: string; line: number }[] = [];
  const dbs: { name: string; file: string; line: number }[] = [];
  for (const svc of merged.values()) {
    if (flagged.has(svc.name) || ONE_SHOT_SERVICES.includes(svc.name)) continue;
    const base = imageBase(svc.image);
    (base !== undefined && DB_IMAGES.includes(base) ? dbs : apps).push(svc);
  }

  for (const [kind, list, max] of [
    ['aplicación', apps, MAX_APP_SERVICES],
    ['base de datos', dbs, MAX_DB_SERVICES],
  ] as const) {
    if (list.length <= max) continue;
    const extra = list[max];
    const names = list.map((s) => s.name).join(', ');
    issues.push({
      file: extra.file,
      line: extra.line,
      rule: 'compose-topology',
      message: `más de ${max} servicio(s) de ${kind} en Compose (${names}); el máximo es ${max} (plan §12.7)`,
    });
  }
  return issues;
}

const CODE_EXT = /\.[cm]?[jt]sx?$/;
const CONFIG_EXT = /\.(?:json|ya?ml|toml|ini|conf|html)$/;
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
const COMPOSE_FILE = /^(?:docker-)?compose(?:[.-][\w.-]+)?\.ya?ml$/;

function classify(name: string): SourceKind | undefined {
  if (LOCKFILES.has(name) || TEST_FILE.test(name)) return undefined;
  if (CODE_EXT.test(name)) return 'code';
  if (
    CONFIG_EXT.test(name) ||
    name.startsWith('.env') ||
    name === 'Dockerfile' ||
    name.startsWith('Dockerfile.')
  ) {
    return 'config';
  }
  return undefined;
}

function isScannable(name: string): boolean {
  return name === 'package.json' || COMPOSE_FILE.test(name) || classify(name) !== undefined;
}

function walk(root: string, dirRel = '', out: string[] = []): string[] {
  const entries = readdirSync(join(root, dirRel), { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const rel = dirRel === '' ? entry.name : `${dirRel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS_ANY.has(entry.name)) continue;
      if (dirRel === '' && IGNORED_DIRS_ROOT.has(entry.name)) continue;
      walk(root, rel, out);
    } else if (entry.isFile() && isScannable(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

export interface ScanResult {
  issues: Issue[];
  scannedFiles: number;
}

/** Escanea el repositorio (o un fixture) aplicando todas las reglas. */
export function scanRepository(root: string): ScanResult {
  const issues: Issue[] = [];
  const composeFiles: ComposeFile[] = [];
  const files = walk(root);

  for (const rel of files) {
    const name = basename(rel);
    const text = readFileSync(join(root, rel), 'utf8');
    if (name === 'package.json') issues.push(...checkManifestText(rel, text));
    if (COMPOSE_FILE.test(name)) composeFiles.push({ file: rel, text });
    const kind = classify(name) ?? 'config';
    issues.push(...checkSourceText(rel, text, kind));
  }

  issues.push(...checkComposeFiles(composeFiles));
  return { issues, scannedFiles: files.length };
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function rootFromArgs(argv: readonly string[]): string {
  const index = argv.indexOf('--root');
  return index !== -1 && argv[index + 1] ? resolve(argv[index + 1]) : REPO_ROOT;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = scanRepository(rootFromArgs(process.argv.slice(2)));
  if (result.issues.length > 0) {
    for (const issue of result.issues) {
      console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`);
    }
    console.error(
      `\ncheck:scope FALLÓ (${result.issues.length} incidencia(s), ${result.scannedFiles} archivos revisados)`,
    );
    process.exit(1);
  }
  console.log(`check:scope OK (${result.scannedFiles} archivos revisados)`);
}
