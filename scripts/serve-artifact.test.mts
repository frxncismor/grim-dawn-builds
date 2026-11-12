import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_SECURITY_HEADERS,
  contentSecurityPolicy,
  formatHeaders,
  inlineAllowLists,
  securityHeaders,
  startArtifactServer,
  type ArtifactServer,
} from './serve-artifact.mts';

/**
 * T-166 - el servidor del artefacto debe servir todos los recursos con las
 * cabeceras de seguridad de T-077, y la CSP debe permitir los scripts y estilos
 * inline del HTML prerenderizado solo por hash. Los hashes se recalculan aquí
 * de forma independiente para no validar la implementación contra sí misma.
 */

const INLINE_SCRIPT = `window.__probe = 'hola';`;
const INLINE_STYLE = `.probe { color: #eadfca; }`;
const INLINE_SCRIPT_HASH = `'sha256-${createHash('sha256').update(INLINE_SCRIPT).digest('base64')}'`;
const INLINE_STYLE_HASH = `'sha256-${createHash('sha256').update(INLINE_STYLE).digest('base64')}'`;

const PAGE = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Fixture</title>
  <style>${INLINE_STYLE}</style>
  <script type="application/ld+json">{"@type":"Thing"}</script>
</head>
<body>
  <h1>Fixture</h1>
  <script type="text/javascript" id="inline">${INLINE_SCRIPT}</script>
  <script src="main.js" type="module"></script>
  <script type="application/json" id="ng-state">{"state":true}</script>
</body>
</html>
`;

const NOT_FOUND_STYLE = `.not-found { color: #eadfca; }`;
const NOT_FOUND_STYLE_HASH = `'sha256-${createHash('sha256').update(NOT_FOUND_STYLE).digest('base64')}'`;
const NOT_FOUND = `<!doctype html><html lang="es"><head><style>${NOT_FOUND_STYLE}</style></head><body><h1>No encontrada</h1></body></html>`;

async function artifact(
  files: Readonly<Record<string, string>> = { 'index.html': PAGE },
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gd-serve-artifact-'));
  for (const [name, content] of Object.entries(files)) {
    const target = join(root, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

async function cleanup(root: string): Promise<void> {
  if (basename(root).startsWith('gd-serve-artifact-') && dirname(root) === tmpdir())
    await rm(root, { recursive: true, force: true });
}

interface Reply {
  status: number;
  headers: import('node:http').IncomingHttpHeaders;
  body: string;
}

/** Petición real por HTTP para no probar solo funciones puras. */
function fetchWith(url: string, method = 'GET'): Promise<Reply> {
  return new Promise((resolvePromise, reject) => {
    const req = request(url, { method }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolvePromise({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

async function serve(
  files: Readonly<Record<string, string>>,
  run: (server: ArtifactServer) => Promise<void>,
): Promise<void> {
  const root = await artifact(files);
  let server: ArtifactServer | undefined;
  try {
    server = await startArtifactServer({ root, port: 0 });
    await run(server);
  } finally {
    if (server) await server.close();
    await cleanup(root);
  }
}

function csp(reply: Reply): string {
  const value = reply.headers['content-security-policy'];
  return Array.isArray(value) ? value.join('; ') : (value ?? '');
}

test('serves the artifact HTML with the security headers and CSP hashes', async () => {
  await serve({ 'index.html': PAGE }, async (server) => {
    const reply = await fetchWith(`${server.url}/`);
    assert.equal(reply.status, 200);
    assert.equal(reply.headers['x-frame-options'], 'DENY');
    assert.equal(reply.headers['x-content-type-options'], 'nosniff');
    assert.equal(reply.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.match(String(reply.headers['permissions-policy']), /camera=\(\)/);
    assert.equal(reply.headers['cache-control'], 'no-store');
    const policy = csp(reply);
    for (const expected of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ])
      assert.ok(policy.includes(expected), `falta ${expected} en: ${policy}`);
    assert.ok(!/unsafe-inline/.test(policy), `la CSP no puede permitir unsafe-inline: ${policy}`);
    assert.ok(!/unsafe-eval/.test(policy), `la CSP no puede permitir unsafe-eval: ${policy}`);
    const scriptDirective = policy.split('; ').find((part) => part.startsWith('script-src '));
    const styleDirective = policy.split('; ').find((part) => part.startsWith('style-src '));
    assert.equal(scriptDirective, `script-src 'self' ${INLINE_SCRIPT_HASH}`);
    assert.equal(styleDirective, `style-src 'self' ${INLINE_STYLE_HASH}`);
    assert.ok(
      policy.split('; ').includes("script-src-attr 'none'"),
      `sin manejadores inline la directiva debe ser 'none': ${policy}`,
    );
    // Los bloques de datos y los scripts con `src` no se hashean como ejecutables.
    assert.equal(inlineAllowLists(PAGE).scripts.length, 1);
    assert.ok(
      !policy.includes(INLINE_STYLE_HASH.replace('sha256-', 'sha256-W')),
      'hash de relleno',
    );
  });
});

test('allows the critical-CSS onload handler only by its own hash', async () => {
  const handler = `this.media='all'`;
  const handlerHash = `'sha256-${createHash('sha256').update(handler).digest('base64')}'`;
  const page = `<!doctype html><html lang="es"><head><style>${INLINE_STYLE}</style><link rel="stylesheet" href="styles.css" media="print" onload="${handler}"><noscript><link rel="stylesheet" href="styles.css"></noscript></head><body><h1>Crítico</h1></body></html>`;
  await serve({ 'index.html': page }, async (server) => {
    const policy = csp(await fetchWith(`${server.url}/`));
    const attributeDirective = policy
      .split('; ')
      .find((part) => part.startsWith('script-src-attr '));
    assert.equal(attributeDirective, `script-src-attr 'unsafe-hashes' ${handlerHash}`);
    assert.ok(!/unsafe-inline/.test(policy));
    assert.equal(inlineAllowLists(page).handlers.length, 1);
  });
});

test('serves 404 with the real status and the same headers, hashing the 404 page', async () => {
  await serve({ 'index.html': PAGE, '404.html': NOT_FOUND }, async (server) => {
    const reply = await fetchWith(`${server.url}/no-existe`);
    assert.equal(reply.status, 404);
    assert.equal(reply.headers['x-frame-options'], 'DENY');
    assert.ok(csp(reply).includes("frame-ancestors 'none'"));
    assert.ok(csp(reply).includes(NOT_FOUND_STYLE_HASH));
    assert.match(reply.body, /No encontrada/);
  });
});

test('serves plain-text 404 with headers when the artifact has no 404 page', async () => {
  await serve({ 'index.html': PAGE }, async (server) => {
    const reply = await fetchWith(`${server.url}/no-existe`);
    assert.equal(reply.status, 404);
    assert.equal(reply.body, 'not_found');
    assert.equal(reply.headers['x-frame-options'], 'DENY');
    assert.match(csp(reply), /default-src 'self'/);
  });
});

test('does not emit hashes for HTML without inline scripts or styles', async () => {
  const plain =
    '<!doctype html><html lang="es"><head><title>Liso</title></head><body><h1>Liso</h1></body></html>';
  await serve({ 'index.html': plain }, async (server) => {
    const reply = await fetchWith(`${server.url}/`);
    assert.equal(reply.status, 200);
    assert.ok(!csp(reply).includes('sha256-'), `no debe haber hashes: ${csp(reply)}`);
    assert.equal(reply.headers['x-content-type-options'], 'nosniff');
  });
});

test('supports HEAD and rejects other methods with headers', async () => {
  await serve({ 'index.html': PAGE }, async (server) => {
    const head = await fetchWith(`${server.url}/`, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.ok(csp(head).includes(INLINE_SCRIPT_HASH));
    const post = await fetchWith(`${server.url}/`, 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.headers['x-frame-options'], 'DENY');
  });
});

test('keeps the artifact MIME map and directory indexes', async () => {
  await serve(
    {
      'index.html': PAGE,
      'main.js': 'console.log(1);',
      'styles.css': 'h1{color:#eadfca}',
      'tier-list/index.html': '<!doctype html><html><body><h1>Catálogo</h1></body></html>',
    },
    async (server) => {
      assert.equal(
        (await fetchWith(`${server.url}/main.js`)).headers['content-type'],
        'text/javascript; charset=utf-8',
      );
      assert.equal(
        (await fetchWith(`${server.url}/styles.css`)).headers['content-type'],
        'text/css; charset=utf-8',
      );
      const directory = await fetchWith(`${server.url}/tier-list/`);
      assert.equal(directory.status, 200);
      assert.match(directory.body, /Catálogo/);
    },
  );
});

test('keeps the declared hosting configuration in sync with the server', async () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const declared = await readFile(
    join(repoRoot, 'infra', 'hosting', 'security-headers.conf'),
    'utf8',
  );
  const lines = declared
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z-]+: /.test(line))
    .map((line) => line.slice(0, line.indexOf(': ')));
  assert.deepEqual(lines, [...Object.keys(BASE_SECURITY_HEADERS), 'Content-Security-Policy']);
  const declaredPolicy = declared
    .split(/\r?\n/)
    .find((line) => line.startsWith('Content-Security-Policy: '))
    ?.slice('Content-Security-Policy: '.length);
  assert.ok(declaredPolicy);
  const directiveNames = (policy: string) =>
    policy
      .replace(/<[A-Z_]+>/g, '')
      .split('; ')
      .map((part) => part.trim().split(' ')[0]);
  assert.deepEqual(
    directiveNames(declaredPolicy ?? ''),
    directiveNames(
      contentSecurityPolicy({
        scripts: ["'sha256-x'"],
        styles: ["'sha256-y'"],
        handlers: ["'sha256-z'"],
      }),
    ),
  );
  assert.match(declared, /script-src-attr 'unsafe-hashes' <HANDLER_HASHES>/);
  assert.match(declared, /NOT ACTIVE/);
  assert.match(declared, /T-045/);
});

test('prints the headers that would be sent for a given HTML', async () => {
  const lines = formatHeaders(securityHeaders(PAGE));
  assert.ok(lines.some((line) => line.startsWith('Content-Security-Policy: ')));
  assert.ok(lines.includes('X-Frame-Options: DENY'));
  assert.ok(lines.some((line) => line.includes(INLINE_SCRIPT_HASH)));
  assert.deepEqual(Object.keys(BASE_SECURITY_HEADERS), [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ]);
});
