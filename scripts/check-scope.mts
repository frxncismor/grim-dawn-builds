/**
 * check-scope (T-069, T-113, T-109): guardia de alcance sin framework.
 *
 * Falla si el repositorio introduce piezas prohibidas por la constitución
 * (principio VIII) y el plan §12.7: Redis, colas/workers, proveedores de
 * autenticación externos, almacenamiento de objetos, scraping o automatización
 * de navegador, más de un servicio de aplicación / una base de datos en Compose,
 * pantallas de comentarios y calculadora (fuera de alcance, spec AC-08) y
 * dependencias o rutas de auth, registro, cuenta y edición pública (spec AC-24).
 *
 * T-109 añade dos reglas estructurales de derechos y fuentes (spec AC-19/AC-23):
 * - `external-source-access`: en el código de la app y de la ingesta (`apps/web/`,
 *   `apps/`, `src/` histórico y los scripts cuyo basename empieza por
 *   ingest|import|source|scrape|crawl|fetch) una llamada HTTP automatizada cuyo
 *   primer argumento
 *   contiene un literal `http(s)://host/...` con host ajeno al proyecto falla.
 *   No hay lista de dominios: cualquier host externo es acceso a terceros.
 *   Hosts propios: localhost, 127.0.0.1, ::1, [::1], 0.0.0.0 y PROJECT_HOSTS.
 *   Un literal construido desde variables (`fetch(`${BASE_URL}/...`)`) no lleva
 *   host literal y no se marca; tampoco una URL suelta en prosa o comentario.
 * - `source-rights-gate`: un registro JSON de `content/sources/` (o de
 *   cualquier carpeta `sources/`) en estado `habilitada` o `limitada` exige
 *   evidencia completa (tipo, referencia, alcance, fecha) y un `rights_status`
 *   publicable. Sin `status` el registro es `pending` y no se marca.
 *
 * Excepción de `external-source-access` (también documentada en
 * docs/content/source-policy.md): un comentario en la MISMA línea de la llamada
 * o en la inmediatamente anterior con `check-scope:external-http-ok` seguido de
 * un motivo de al menos 10 caracteres exime esa llamada. Ejemplo:
 *   // check-scope:external-http-ok descarga del binario fijado (T-083)
 * Un marcador sin motivo, con motivo más corto o en otra línea no exime.
 *
 * Diseño:
 * - Las reglas son datos (FORBIDDEN_CAPABILITIES). Añadir un paquete, imagen,
 *   nombre de servicio o esquema de URL es una línea en la tabla.
 * - Parser de Compose por indentación (sin dependencias). Ante sintaxis que no
 *   entiende (p. ej. `services: { ... }` en línea) falla de forma cerrada.
 * - Sin red, sin dependencias nuevas. Uso: `pnpm check:scope [--root <dir>]`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type RuleId = 'redis' | 'queue-worker' | 'external-auth' | 'object-storage' | 'scraping';
export type IssueRule =
  | RuleId
  | 'compose-topology'
  | 'out-of-scope-route'
  | 'external-source-access'
  | 'source-rights-gate'
  | 'invalid-input';
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
      // T-113: piezas propias de una cuenta de usuario (registro, sesión,
      // credenciales y edición pública), prohibidas por la constitución
      // (principio VIII) y la spec AC-24.
      //
      // Exclusiones deliberadas y probadas en `check-scope.test.mts`:
      // - `playwright`, `@playwright/test`, `jsdom`, `lighthouse` y
      //   `chrome-launcher` son herramientas de prueba/rendimiento legítimas
      //   (spec AC-08); marcarlas rompería el test que las declara válidas.
      // - `jsonwebtoken` y `p-queue` están declarados como dependencias
      //   legítimas en el test (firma de artefactos y concurrencia de scripts);
      //   por sí solos no implementan una cuenta.
      // - `puppeteer` y `cheerio` pertenecen a `scraping` (T-069b), no aquí.
      'express-session',
      'cookie-session',
      'iron-session',
      'lucia',
      'better-auth',
      'bcrypt',
      'bcryptjs',
      'argon2',
      '@node-rs/argon2',
      'oauth',
      'oauth2',
      'simple-oauth2',
      'openid-client',
      'grant',
      'csurf',
      'remix-auth',
      '@hono/auth-js',
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

/**
 * Rutas de autenticación, registro, cuenta y edición pública (T-113, spec
 * AC-24). Son datos: añadir un segmento prohibido es una línea aquí.
 *
 * La comparación es por SEGMENTO EXACTO de ruta, nunca por subcadena:
 * `autores/:slug` (segmento `autores`) no coincide con `auth`, y `tier-list`,
 * `legal`, `acerca`, `404`, `**`, `placeholder` o `borrador` pasan. A cambio,
 * `editar/:slug` falla por su primer segmento (`editar`).
 */
export interface OutOfScopeRouteFamily {
  readonly id: 'auth' | 'registro' | 'cuenta-y-edicion-publica';
  readonly label: string;
  readonly segments: readonly string[];
}

export const OUT_OF_SCOPE_ROUTE_RULES: readonly OutOfScopeRouteFamily[] = [
  {
    id: 'auth',
    label: 'autenticación o sesión de cuenta',
    segments: [
      'login',
      'log-in',
      'signin',
      'sign-in',
      'logout',
      'log-out',
      'signout',
      'auth',
      'oauth',
      'oidc',
      'sso',
      'session',
      'sesion',
      'password',
      'contrasena',
      '2fa',
      'mfa',
    ],
  },
  {
    id: 'registro',
    label: 'registro de cuenta',
    segments: ['register', 'registro', 'signup', 'sign-up', 'crear-cuenta', 'nueva-cuenta'],
  },
  {
    id: 'cuenta-y-edicion-publica',
    label: 'cuenta, administración o edición pública',
    segments: [
      'cuenta',
      'account',
      'mi-cuenta',
      'dashboard',
      'admin',
      'administracion',
      'moderacion',
      'moderator',
      'moderar',
      'editor',
      'editar',
      'edicion',
      'edit',
      'nueva-guia',
      'crear-guia',
      'publicar-guia',
      'submit-guide',
    ],
  },
];

/**
 * Segmentos normalizados de una ruta: descarta `?consulta` y `#ancla`, el `/`
 * inicial, los vacíos y los `:` de los parámetros (`:slug` -> `slug`).
 * `'/editar/:slug?x=1'` -> `['editar', 'slug']`.
 */
export function outOfScopeRouteSegments(path: string): string[] {
  return path
    .split(/[?#]/)[0]
    .split('/')
    .map((segment) => segment.replace(/:/g, '').trim().toLowerCase())
    .filter((segment) => segment !== '');
}

/** Familia fuera de alcance a la que pertenece una ruta, si la hay. */
export function outOfScopeRouteFor(path: string): OutOfScopeRouteFamily | undefined {
  const segments = outOfScopeRouteSegments(path);
  return OUT_OF_SCOPE_ROUTE_RULES.find((family) =>
    family.segments.some((forbidden) => segments.includes(forbidden)),
  );
}

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
/** Directorios de documentación/specs ignorados solo en la raíz (apps/web/src/app/core/content sí se escanea). */
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

/**
 * Contextos que declaran una ruta de la aplicación (T-113). Cada patrón captura
 * SOLO el texto de la ruta, y todos exigen un contexto sintáctico, nunca una
 * palabra suelta, para no marcar prosa, roles de BD (`user: 'editor'`),
 * nombres de secreto (`db_password_editor`) ni hojas de estilo
 * (`styleUrl: './editorial.css'`):
 * a) `path: 'editar/:slug'` (rutas Angular, con o sin `/` inicial);
 * b) `href="/login"`, `routerLink="/cuenta"`, `[routerLink]="['/registro']"`;
 * c) `app|router|server|fastify .get|post|put|patch|delete('/register', …)`;
 * d) `url: '/admin'` (opciones de ruta de Fastify y objetos equivalentes).
 * En b, c y d se exige `/` inicial para no confundir enlaces externos
 * (`href="https://…"`) con rutas propias.
 */
const DECLARED_ROUTE_PATTERNS: readonly RegExp[] = [
  /\b["']?path["']?\s*:\s*['"]([^'"\n]*)['"]/g,
  /\b["']?url["']?\s*:\s*['"](\/[^'"\n]*)['"]/g,
  /\b(?:href|routerLink)\s*=\s*['"](\/[^'"\n]*)['"]/g,
  /\[routerLink\]\s*=\s*['"]\s*\[?\s*['"](\/[^'"\n]*)['"]/g,
  /\b(?:app|router|server|fastify)\s*\.\s*(?:get|post|put|patch|delete)\s*\(\s*['"](\/[^'"\n]*)['"]/g,
];

/**
 * Hosts propios del proyecto (T-109). La lista está VACÍA a propósito: el sitio
 * se configura por entorno (`ORIGIN`, dominio de despliegue) y el repositorio no
 * debe fijar un dominio real. Añadir aquí solo un host que el proyecto controle
 * de verdad; cualquier otro host es un tercero.
 */
export const PROJECT_HOSTS: readonly string[] = [];

/**
 * Hosts considerados propios: loopback y los declarados en PROJECT_HOSTS.
 * `[::1]` se mantiene con corchetes porque es la forma que devuelve el parser
 * de URL para IPv6.
 */
const OWN_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  ...PROJECT_HOSTS.map((host) => host.toLowerCase()),
]);

/**
 * Clientes HTTP cuyo primer argumento puede ser una URL (T-109):
 * `fetch(`, `axios(` y `axios.<verbo>(`, `got(` y `got.<verbo>(`,
 * `undici.request(`, `undici.fetch(`, `http|https.get|request(`,
 * `page.goto(` y `cheerio.load(`.
 */
const SOURCE_ACCESS_CLIENT =
  /\b(?:fetch|axios|got|axios\s*\.\s*\w+|got\s*\.\s*\w+|undici\.request|undici\.fetch|http\.get|http\.request|https\.get|https\.request|page\.goto|cheerio\.load)\s*\(/g;

/** Marcador de excepción y longitud mínima del motivo (T-109). */
const EXTERNAL_OK_MARKER = 'check-scope:external-http-ok';
const MIN_EXTERNAL_OK_REASON = 10;
/** Ventana máxima del primer argumento que se inspecciona (caracteres). */
const MAX_ARGUMENT_WINDOW = 2000;

/**
 * Ámbitos donde el acceso HTTP automatizado es ingesta de terceros (T-109):
 * código de `apps/web/` (y `src/` histórico) y `apps/` a cualquier profundidad, y scripts cuyo basename
 * empieza por ingest|import|source|scrape|crawl|fetch. El tooling de build
 * (`scripts/setup-gitleaks.mts`, `scripts/check-contrast.mts`, etc.) queda fuera.
 * Los archivos de prueba se excluyen aparte con `TEST_FILE`.
 */
export function isSourceAccessScope(file: string): boolean {
  const rel = file.replace(/\\/g, '/').replace(/^\.\//, '');
  if (/^(?:src|apps)\//.test(rel)) return true;
  if (!rel.startsWith('scripts/')) return false;
  const name = rel.slice('scripts/'.length).split('/').pop()?.toLowerCase() ?? '';
  return /^(?:ingest|import|source|scrape|crawl|fetch)/.test(name);
}

/**
 * Primer argumento de una llamada: desde el paréntesis de apertura hasta el
 * paréntesis equilibrado, respetando literales de cadena y plantilla. Si no se
 * cierra dentro de `MAX_ARGUMENT_WINDOW`, devuelve la ventana truncada.
 */
function callArgument(source: string, openParenIndex: number): string {
  let depth = 0;
  let quote: string | undefined;
  const limit = Math.min(source.length, openParenIndex + MAX_ARGUMENT_WINDOW + 1);
  for (let i = openParenIndex; i < limit; i++) {
    const char = source[i];
    if (quote !== undefined) {
      if (char === '\\') i++;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')') {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return source.slice(openParenIndex + 1, limit);
}

/** Host normalizado (sin credenciales ni puerto) de un literal URL. */
function hostOf(url: string): string | undefined {
  const authority = /^https?:\/\/([^/?#]*)/i.exec(url)?.[1];
  if (authority === undefined) return undefined;
  const at = authority.lastIndexOf('@');
  const hostPort = at === -1 ? authority : authority.slice(at + 1);
  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']');
    return (end === -1 ? hostPort : hostPort.slice(0, end + 1)).toLowerCase();
  }
  return hostPort.split(':')[0].toLowerCase() || undefined;
}

/** Motivo escrito tras el marcador en una línea, si lo hay. */
function markerReason(line: string | undefined): string | undefined {
  if (line === undefined) return undefined;
  const index = line.indexOf(EXTERNAL_OK_MARKER);
  if (index === -1) return undefined;
  return line
    .slice(index + EXTERNAL_OK_MARKER.length)
    .replace(/\*\/\s*$/, '')
    .trim();
}

/** El marcador solo exime en la misma línea o en la inmediatamente anterior. */
function hasExternalOkMarker(lines: readonly string[], line: number): boolean {
  if (line < 1 || line > lines.length) return false;
  return [lines[line - 1], lines[line - 2]].some((candidate) => {
    const reason = markerReason(candidate);
    return reason !== undefined && reason.length >= MIN_EXTERNAL_OK_REASON;
  });
}

/**
 * Acceso HTTP automatizado a hosts de terceros (T-109, AC-23). Solo mira el
 * primer argumento de cada llamada y solo literales absolutos; una URL montada
 * desde variables no lleva host y no se puede atribuir aquí.
 */
function checkExternalSourceAccess(file: string, original: string, source: string): Issue[] {
  if (!isSourceAccessScope(file)) return [];
  const issues: Issue[] = [];
  const lines = original.split('\n');
  for (const match of source.matchAll(SOURCE_ACCESS_CLIENT)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf('(');
    const argument = callArgument(source, open);
    const literal = /(['"`])(https?:\/\/[^'"`\s]+)\1/i.exec(argument);
    if (!literal) continue;
    const host = hostOf(literal[2]);
    if (host === undefined || OWN_HOSTS.has(host)) continue;
    const line = lineAt(source, match.index ?? 0);
    if (hasExternalOkMarker(lines, line)) continue;
    issues.push({
      file,
      line,
      rule: 'external-source-access',
      message: `acceso HTTP automatizado a host externo "${host}" (fuente de terceros); requiere permiso verificado y lectura humana (AC-23)`,
    });
  }
  return issues;
}

/** Vocabulario de estados de `docs/content/source-policy.md` (T-109). */
export const SOURCE_STATUSES = [
  'pending',
  'evaluando',
  'habilitada',
  'limitada',
  'revocada',
  'prohibida',
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** Tipos de evidencia de derechos admitidos por la política de fuentes. */
export const SOURCE_EVIDENCE_TYPES = ['licencia_explicita', 'permiso_escrito'] as const;

/** Estados de derechos que permiten publicar contenido derivado (FR-27). */
const PUBLISHABLE_RIGHTS = ['licensed', 'permission_granted'] as const;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Un registro de fuente declara al menos dos de `slug`, `kind` y `title`. */
function isSourceRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return (
    ['slug', 'kind', 'title'].filter((key) => nonEmptyString(value[key]) !== undefined).length >= 2
  );
}

/** Registros de un JSON: array raíz u objeto único. */
function sourceRecords(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed.filter(isSourceRecord);
  return isSourceRecord(parsed) ? [parsed] : [];
}

/** Evidencia anidada en `rights_evidence` o `evidence`; si no, campos del registro. */
function registryEvidence(record: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['rights_evidence', 'evidence']) {
    const candidate = record[key];
    if (isRecord(candidate)) return candidate;
  }
  return record;
}

/** Primer valor no vacío de `names` en la evidencia y, si falta, en el registro. */
function registryField(
  evidence: Record<string, unknown>,
  record: Record<string, unknown>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = nonEmptyString(evidence[name]) ?? nonEmptyString(record[name]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Puerta de derechos de un registro de fuente (T-109, AC-23): `habilitada` y
 * `limitada` exigen evidencia completa. `pending`, `evaluando`, `revocada` y
 * `prohibida` no producen incidencia; un registro sin `status` es `pending`.
 */
export function checkSourceRegistryText(file: string, text: string): Issue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [{ file, line: 1, rule: 'invalid-input', message: `JSON no válido: ${reason}` }];
  }

  const lines = text.split('\n');
  const issues: Issue[] = [];
  sourceRecords(parsed).forEach((record, index) => {
    const name =
      nonEmptyString(record.slug) ?? nonEmptyString(record.title) ?? `registro ${index + 1}`;
    const lineOfName = lines.findIndex((line) => line.includes(name));
    const line = lineOfName === -1 ? 1 : lineOfName + 1;
    const status = nonEmptyString(record.status);
    if (status === undefined) return;
    if (!(SOURCE_STATUSES as readonly string[]).includes(status)) {
      issues.push({
        file,
        line,
        rule: 'invalid-input',
        message: `fuente "${name}": estado "${status}" fuera del vocabulario (${SOURCE_STATUSES.join('|')})`,
      });
      return;
    }
    if (status !== 'habilitada' && status !== 'limitada') return;

    const evidence = registryEvidence(record);
    const missing: string[] = [];
    const evidenceType = registryField(evidence, record, ['evidence_type']);
    if (
      evidenceType === undefined ||
      !(SOURCE_EVIDENCE_TYPES as readonly string[]).includes(evidenceType)
    )
      missing.push(`evidence_type (${SOURCE_EVIDENCE_TYPES.join('|')})`);
    if (registryField(evidence, record, ['evidence_ref', 'permission_ref']) === undefined)
      missing.push('evidence_ref o permission_ref');
    if (registryField(evidence, record, ['scope', 'scope_notes']) === undefined)
      missing.push('scope o scope_notes');
    if (registryField(evidence, record, ['recorded_on', 'verified_on']) === undefined)
      missing.push('recorded_on o verified_on');
    const rightsStatus = registryField(evidence, record, ['rights_status']);
    if (
      rightsStatus !== undefined &&
      !(PUBLISHABLE_RIGHTS as readonly string[]).includes(rightsStatus)
    )
      missing.push(`rights_status ${PUBLISHABLE_RIGHTS.join(' o ')}`);
    if (
      status === 'limitada' &&
      registryField(evidence, record, ['condition', 'scope_notes']) === undefined
    )
      missing.push('condición escrita (condition o scope_notes)');

    if (missing.length === 0) return;
    issues.push({
      file,
      line,
      rule: 'source-rights-gate',
      message: `fuente "${name}" en estado "${status}" sin evidencia verificada: falta ${missing.join('; ')} (AC-23)`,
    });
  });
  return issues;
}

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

  // Rutas declaradas de auth, registro, cuenta o edición pública (T-113).
  const declaredRoutes: Issue[] = [];
  const seen = new Set<string>();
  for (const pattern of DECLARED_ROUTE_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const path = match[1];
      const family = outOfScopeRouteFor(path);
      if (!family) continue;
      const index = (match.index ?? 0) + match[0].indexOf(path);
      const key = `${index}:${family.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      declaredRoutes.push({
        file,
        line: lineAt(source, index),
        rule: 'out-of-scope-route',
        message: `ruta "${path}" (${family.label}, fuera de alcance) prohibida por la constitución, principio VIII`,
      });
    }
  }
  declaredRoutes.sort((a, b) => a.line - b.line);
  issues.push(...declaredRoutes);

  // Acceso HTTP automatizado a hosts de terceros (T-109, AC-23).
  if (kind === 'code') issues.push(...checkExternalSourceAccess(file, text, source));

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

/** Todos los `*.json` bajo un directorio, usado por los registros de fuentes. */
function listJsonFiles(root: string, dirRel: string, out: string[] = []): string[] {
  const absolute = join(root, dirRel);
  if (!existsSync(absolute)) return out;
  const entries = readdirSync(absolute, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const rel = `${dirRel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS_ANY.has(entry.name)) continue;
      listJsonFiles(root, rel, out);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Registros de fuentes (T-109): los JSON de `content/sources/` y cualquier `*.json`
 * bajo un directorio llamado `sources`. `content` está ignorado por el walker
 * general (son datos, no código), por eso se recogen aparte y no cuentan en
 * `scannedFiles`.
 */
export function collectSourceRegistryFiles(root: string): string[] {
  const found = new Set<string>(listJsonFiles(root, 'content/sources'));
  const visit = (dirRel: string): void => {
    const absolute = join(root, dirRel);
    if (!existsSync(absolute)) return;
    const entries = readdirSync(absolute, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS_ANY.has(entry.name)) continue;
      const rel = dirRel === '' ? entry.name : `${dirRel}/${entry.name}`;
      if (entry.name === 'sources') {
        for (const file of listJsonFiles(root, rel)) found.add(file);
        continue;
      }
      if (dirRel === '' && IGNORED_DIRS_ROOT.has(entry.name)) continue;
      visit(rel);
    }
  };
  visit('');
  return [...found].sort();
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

  // Puerta de derechos de los registros de fuentes (T-109, AC-23).
  for (const rel of collectSourceRegistryFiles(root)) {
    issues.push(...checkSourceRegistryText(rel, readFileSync(join(root, rel), 'utf8')));
  }

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
