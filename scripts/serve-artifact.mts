/**
 * T-166 - servidor estático del artefacto web con cabeceras de seguridad.
 *
 * Hasta ahora el servidor mínimo vivía embebido en `playwright.config.ts` y se
 * escribía en el directorio temporal en cada ejecución. Aquí es un script
 * reutilizable: sirve `dist/.../browser` con 404 real, `HEAD`, tipos MIME y
 * `Cache-Control: no-store` igual que antes, y añade en **todas** las respuestas
 * las cabeceras de seguridad que ZAP exige (T-077):
 *
 *   - `Content-Security-Policy` con `default-src 'self'`, `frame-ancestors
 *     'none'`, `base-uri 'self'`, `object-src 'none'` y `form-action 'self'`.
 *   - `script-src`/`style-src` sin `unsafe-eval` ni `unsafe-inline`: el HTML
 *     prerenderizado de Angular lleva scripts y estilos inline, así que cada
 *     respuesta HTML aporta los hashes SHA-256 calculados del propio contenido
 *     servido (no hay comodín).
 *   - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
 *     `Referrer-Policy: strict-origin-when-cross-origin` y una
 *     `Permissions-Policy` mínima.
 *
 * Uso:
 *
 *   node --import tsx scripts/serve-artifact.mts <raíz> <puerto> [host]
 *   node --import tsx scripts/serve-artifact.mts --print-headers <html>
 *
 * `--print-headers` imprime las cabeceras exactas que se enviarían para ese
 * HTML (con sus hashes), que es como se regenera el juego declarado en
 * `infra/hosting/security-headers.conf` para el hosting futuro.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Tipos MIME del artefacto; cualquier otro se sirve como binario opaco. */
export const MIME_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};

/**
 * Tipos de `<script>` que no se ejecutan (datos estructurados y bloques de
 * estado que Angular deja en el HTML). No reciben hash porque el navegador no
 * aplica `script-src` a datos inertes; hashearlos daría una falsa sensación de
 * permiso sobre código ejecutable.
 */
const DATA_SCRIPT_TYPES: ReadonlySet<string> = new Set([
  'application/json',
  'application/ld+json',
  'application/manifest+json',
  'text/plain',
  'text/template',
  'text/x-template',
]);

const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE_TAG = /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi;
const HANDLER_ATTRIBUTE = /\son[a-z0-9-]+\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const SRC_ATTRIBUTE = /(?:^|\s)src\s*=/i;
const TYPE_ATTRIBUTE = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&#x27;': "'",
};

/** Hashes de los scripts, estilos y manejadores inline de un HTML, para la CSP. */
export interface InlineAllowLists {
  readonly scripts: readonly string[];
  readonly styles: readonly string[];
  readonly handlers: readonly string[];
}

function attributeType(attributes: string): string {
  const match = TYPE_ATTRIBUTE.exec(attributes);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim().toLowerCase();
}

/**
 * El parser HTML normaliza CRLF a LF antes de tokenizar, así que el hash se
 * calcula sobre el texto con esa misma normalización; si no, un artefacto
 * copiado con CRLF generaría hashes que el navegador nunca aceptaría. Los
 * valores de atributo decodifican además las entidades simples.
 */
function inlineHash(content: string): string {
  const normalized = content.replace(/\r\n?/g, '\n');
  const digest = createHash('sha256').update(normalized, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

function decodeAttribute(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|apos|#39|#x27);/gi,
    (entity) => ENTITIES[entity.toLowerCase()] ?? entity,
  );
}

/** Calcula los hashes SHA-256 del contenido inline ejecutable del HTML. */
export function inlineAllowLists(html: string): InlineAllowLists {
  const scripts: string[] = [];
  for (const match of html.matchAll(SCRIPT_TAG)) {
    const attributes = match[1] ?? '';
    const content = match[2] ?? '';
    if (SRC_ATTRIBUTE.test(attributes) || content.length === 0) continue;
    if (DATA_SCRIPT_TYPES.has(attributeType(attributes))) continue;
    scripts.push(inlineHash(content));
  }
  const styles: string[] = [];
  for (const match of html.matchAll(STYLE_TAG)) {
    const content = match[2] ?? '';
    if (content.length === 0) continue;
    styles.push(inlineHash(content));
  }
  const handlers: string[] = [];
  for (const match of html.matchAll(HANDLER_ATTRIBUTE)) {
    const value = decodeAttribute(match[1] ?? match[2] ?? match[3] ?? '');
    if (value.length > 0) handlers.push(inlineHash(value));
  }
  return { scripts, styles, handlers };
}

function directive(name: string, values: readonly string[]): string {
  const extra = values.filter(Boolean).join(' ');
  return extra.length > 0 ? `${name} 'self' ${extra}` : `${name} 'self'`;
}

/**
 * CSP completa. Sin `unsafe-eval` ni `unsafe-inline`: los inline del HTML se
 * permiten solo por hash. El único caso especial es el `onload` que Angular
 * inyecta en el `<link>` de la hoja crítica (`this.media='all'`): los
 * manejadores de eventos solo admiten hash con `'unsafe-hashes'`, así que
 * `script-src-attr` permite exclusivamente los hashes de los manejadores
 * servidos; sin manejadores, la directiva queda en `'none'`.
 * `frame-ancestors 'none'` complementa `X-Frame-Options: DENY`.
 */
export function contentSecurityPolicy(
  allow: InlineAllowLists = { scripts: [], styles: [], handlers: [] },
): string {
  const handlerDirective =
    allow.handlers.length > 0
      ? `script-src-attr 'unsafe-hashes' ${allow.handlers.join(' ')}`
      : "script-src-attr 'none'";
  return [
    "default-src 'self'",
    directive('script-src', allow.scripts),
    handlerDirective,
    directive('style-src', allow.styles),
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

/** Cabeceras de seguridad comunes a todas las respuestas, con o sin HTML. */
export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
};

/**
 * Cabeceras de seguridad de una respuesta. Para HTML se calculan los hashes del
 * propio documento; para el resto se emite la CSP base sin hashes.
 */
export function securityHeaders(html?: string): Record<string, string> {
  const allow =
    html === undefined ? { scripts: [], styles: [], handlers: [] } : inlineAllowLists(html);
  return { ...BASE_SECURITY_HEADERS, 'Content-Security-Policy': contentSecurityPolicy(allow) };
}

/** Las cabeceras en el formato de un archivo de configuración (`Nombre: valor`). */
export function formatHeaders(headers: Readonly<Record<string, string>>): string[] {
  return Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
}

export interface ArtifactServerOptions {
  /** Directorio del artefacto (`browser/`). */
  readonly root: string;
  /** Puerto; `0` elige uno efímero. */
  readonly port?: number;
  readonly host?: string;
}

export interface ArtifactServer {
  readonly server: Server;
  readonly url: string;
  close(): Promise<void>;
}

type Body = Buffer | string;

function contentTypeFor(file: string): string {
  return MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

function isHtml(contentType: string): boolean {
  return contentType.startsWith('text/html');
}

function send(
  response: ServerResponse,
  head: boolean,
  status: number,
  body: Body,
  type = 'text/plain; charset=utf-8',
): void {
  const html = isHtml(type);
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    Allow: 'GET, HEAD',
    ...securityHeaders(html ? String(body) : undefined),
  });
  response.end(head ? undefined : body);
}

async function handle(
  root: string,
  request: import('node:http').IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const head = request.method === 'HEAD';
  if (request.method !== 'GET' && !head) return send(response, head, 405, 'method_not_allowed');
  let pathname: string;
  try {
    pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
  } catch {
    return send(response, head, 400, 'bad_request');
  }
  const segments = pathname.split('/');
  if (
    !pathname.startsWith('/') ||
    segments.some((segment) => segment === '..' || segment === '.')
  ) {
    return send(response, head, 403, 'forbidden');
  }
  try {
    const target = join(root, pathname);
    const file = (await stat(target)).isDirectory() ? join(target, 'index.html') : target;
    const outside = relative(root, file);
    if (outside.startsWith('..') || isAbsolute(outside))
      return send(response, head, 403, 'forbidden');
    const body = await readFile(file);
    return send(response, head, 200, body, contentTypeFor(file));
  } catch {
    try {
      return send(
        response,
        head,
        404,
        await readFile(join(root, '404.html')),
        'text/html; charset=utf-8',
      );
    } catch {
      return send(response, head, 404, 'not_found');
    }
  }
}

/** Arranca el servidor; resuelve cuando escucha y publica su URL real. */
export function startArtifactServer(options: ArtifactServerOptions): Promise<ArtifactServer> {
  const root = resolve(options.root);
  const port = options.port ?? 4321;
  const host = options.host ?? '127.0.0.1';
  const server = createServer((request, response) => {
    void handle(root, request, response).catch(() => {
      if (!response.headersSent) send(response, false, 500, 'internal_error');
      else response.destroy();
    });
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      const actualPort = address && typeof address === 'object' ? address.port : port;
      resolvePromise({
        server,
        url: `http://${host}:${actualPort}`,
        close: () =>
          new Promise<void>((done, fail) =>
            server.close((error) => (error ? fail(error) : done())),
          ),
      });
    });
  });
}

interface Cli {
  readonly root?: string;
  readonly port?: number;
  readonly host?: string;
  readonly printHeaders?: string;
}

function parseCli(argv: readonly string[]): Cli {
  let root: string | undefined;
  let port: number | undefined;
  let host: string | undefined;
  let printHeaders: string | undefined;
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? '';
    if (argument === '--print-headers') printHeaders = argv[++index];
    else if (argument === '--root') root = argv[++index];
    else if (argument === '--port') port = Number(argv[++index]);
    else if (argument === '--host') host = argv[++index];
    else if (argument.startsWith('--')) throw new Error(`opción desconocida: ${argument}`);
    else positionals.push(argument);
  }
  root = root ?? positionals[0];
  if (port === undefined && positionals[1] !== undefined) port = Number(positionals[1]);
  host = host ?? positionals[2];
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535))
    throw new Error(`puerto inválido: ${positionals[1] ?? ''}`);
  return { root, port, host, printHeaders };
}

async function main(argv: readonly string[]): Promise<number> {
  try {
    const cli = parseCli(argv);
    if (cli.printHeaders !== undefined) {
      const html = await readFile(resolve(cli.printHeaders), 'utf8');
      for (const header of formatHeaders(securityHeaders(html))) console.log(header);
      return 0;
    }
    if (!cli.root) throw new Error('falta el directorio del artefacto');
    const server = await startArtifactServer({
      root: cli.root,
      port: cli.port,
      host: cli.host,
    });
    console.log(`artefacto servido en ${server.url} desde ${resolve(cli.root)}`);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        void server.close().then(() => process.exit(0));
      });
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
