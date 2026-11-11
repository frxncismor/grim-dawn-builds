import { createServer, type Server } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const previews = {
  skill: { directory: 'skill-tree-preview', port: 4310 },
  devotion: { directory: 'devotion-map-preview', port: 4311 },
} as const;
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

/** Read-only test server. The CLI accepts only the two known generated previews. */
export async function createPreviewServer(directory: string): Promise<Server> {
  const requested = resolve(directory);
  const base = await realpath(requested);
  if (relative(requested, base) !== '') throw new Error('invalid_preview_root');
  const outside = (file: string) => {
    const distance = relative(base, file);
    return distance === '..' || distance.startsWith('..' + sep) || isAbsolute(distance);
  };
  return createServer(async (request, response) => {
    const send = (status: number, body: string | Buffer, type = 'text/plain; charset=utf-8') => {
      response.writeHead(status, {
        'Content-Type': type,
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        Allow: 'GET, HEAD',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method ?? '')) return send(405, 'method_not_allowed');
    let pathname: string;
    try {
      pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
    } catch {
      return send(400, 'bad_request');
    }
    if (
      !/^\/[a-zA-Z0-9/_\-.]*$/.test(pathname) ||
      pathname.startsWith('//') ||
      pathname.split('/').some((segment) => segment.startsWith('.'))
    )
      return send(403, 'forbidden');
    try {
      const target = await realpath(resolve(base, '.' + pathname));
      if (outside(target)) return send(403, 'forbidden');
      const file = pathname.endsWith('/') ? await realpath(join(target, 'index.html')) : target;
      if (outside(file)) return send(403, 'forbidden');
      if (!(await stat(file)).isFile()) return send(404, 'not_found');
      send(
        200,
        await readFile(file),
        mime[extname(file).toLowerCase()] ?? 'application/octet-stream',
      );
    } catch {
      send(404, 'not_found');
    }
  });
}

async function main() {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || (mode !== 'skill' && mode !== 'devotion'))
    throw new Error('invalid_preview');
  const selected = previews[mode];
  const server = await createPreviewServer(join(root, 'dist', selected.directory, 'browser'));
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(selected.port, '127.0.0.1', done);
  });
  console.log(`Preview SVG listo en 127.0.0.1:${selected.port}`);
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('No se pudo servir el preview SVG.');
    process.exitCode = 1;
  });
}
