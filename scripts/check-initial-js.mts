import { readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertStaticHome, STATIC_HOME_MARKER, inlineExecutableScripts } from './static-home.mts';
import { readArtifactLocales } from './locales.mts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const INITIAL_JS_LIMIT = 90000;
/** `/tier-list` budget. Raised from 110500 to 112000 on 2026-11-11 by explicit user
 * decision (T-138): the localized build adds the i18n hydration support
 * (`withI18nSupport()`, 1 225 B gzip) plus the language switcher, and the measured
 * artifact closes at 111 949 B. The previous 110000 → 110500 exception is kept in
 * plan §17.51 together with this one; T-144 remains open to recover real headroom
 * and lower the ceiling again. */
export const CATALOG_JS_LIMIT = 112000;
interface Output {
  entryPoint?: string;
  imports: { path: string; kind: string; external?: boolean }[];
}

/** Browser JS outputs are flat in this application's Angular production build. */
export function collectInitialJs(
  metadata: unknown,
  html: string,
  route: 'home' | 'tier-list' = 'home',
): string[] {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('outputs' in metadata) ||
    !metadata.outputs ||
    typeof metadata.outputs !== 'object'
  )
    throw new Error('Metafile inválido.');
  const outputs = new Map<string, Output>();
  for (const [path, raw] of Object.entries(metadata.outputs)) {
    if (!path.endsWith('.js')) continue;
    if (!raw || typeof raw !== 'object' || !('imports' in raw) || !Array.isArray(raw.imports))
      throw new Error('Output incompleto.');
    const file = basename(path.replace(/\\/g, '/'));
    if (!/^[a-z0-9_.-]+\.js$/i.test(file) || outputs.has(file)) throw new Error('Output ambiguo.');
    const imports = raw.imports.map((item: unknown) => {
      if (
        !item ||
        typeof item !== 'object' ||
        !('path' in item) ||
        typeof item.path !== 'string' ||
        !('kind' in item) ||
        typeof item.kind !== 'string'
      )
        throw new Error('Import inválido.');
      return {
        path: item.path,
        kind: item.kind,
        external: 'external' in item && item.external === true,
      };
    });
    const entryPoint =
      'entryPoint' in raw && typeof raw.entryPoint === 'string'
        ? raw.entryPoint.replace(/\\/g, '/')
        : undefined;
    outputs.set(file, { imports, entryPoint });
  }
  if (html.includes(STATIC_HOME_MARKER)) {
    if (route !== 'home') throw new Error('Ruta interactiva sin bootstrap.');
    assertStaticHome(html);
    return [];
  }
  const entries: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const url = new URL(match[1]!, 'https://artifact.invalid/');
    if (url.origin !== 'https://artifact.invalid' || url.username || url.password)
      throw new Error('Script externo no medible.');
    entries.push(basename(url.pathname));
  }
  if (!entries.length) throw new Error('No hay scripts iniciales.');
  const home = [...outputs].filter(([, output]) =>
    output.entryPoint?.endsWith(
      route === 'home'
        ? 'src/app/features/home/home.page.ts'
        : 'src/app/features/tier-list/tier-list.page.ts',
    ),
  );
  if (home.length !== 1) throw new Error('Entrada Home ausente o ambigua.');
  entries.push(home[0]![0]);
  const visited = new Set<string>();
  const visit = (file: string) => {
    if (visited.has(file)) return;
    const output = outputs.get(file);
    if (!output) throw new Error('Referencia JS sin metadatos.');
    visited.add(file);
    for (const dependency of output.imports) {
      if (dependency.kind === 'dynamic-import') continue;
      if (dependency.external) throw new Error('Import externo no medible.');
      if (dependency.path.endsWith('.js')) visit(basename(dependency.path.replace(/\\/g, '/')));
    }
  };
  entries.forEach(visit);
  return [...visited].sort();
}

export async function measureInitialJs(
  root: string,
  route: 'home' | 'tier-list' = 'home',
  segments: readonly string[] = [],
) {
  const [stats, html] = await Promise.all([
    readFile(join(root, 'stats.json'), 'utf8'),
    readFile(
      join(
        root,
        'browser',
        ...segments,
        route === 'home' ? 'index.html' : 'tier-list/index.html',
      ),
      'utf8',
    ),
  ]);
  const paths = collectInitialJs(JSON.parse(stats) as unknown, html, route);
  const files = await Promise.all(
    paths.map(async (file) => {
      const bytes = await readFile(join(root, 'browser', file));
      return { file, rawBytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 6 }).length };
    }),
  );
  inlineExecutableScripts(html).forEach((script, index) => {
    const bytes = Buffer.from(script);
    files.push({
      file: `inline-script-${index + 1}`,
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 6 }).length,
    });
  });
  return {
    files,
    totalGzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
    limitBytes: route === 'home' ? INITIAL_JS_LIMIT : CATALOG_JS_LIMIT,
  };
}

/** Measure current interactive catalog as well as Home for every configured locale. */
export async function measureInitialRoutes(
  root: string,
  locales: readonly (readonly string[])[] = [[]],
) {
  const stats = JSON.parse(await readFile(join(root, 'stats.json'), 'utf8')) as {
    outputs: Record<string, { entryPoint?: string }>;
  };
  const hasTier = Object.values(stats.outputs).some((o) =>
    o.entryPoint?.replaceAll('\\', '/').endsWith('src/app/features/tier-list/tier-list.page.ts'),
  );
  const results = [];
  for (const segments of locales) {
    const prefix = segments.length === 0 ? '' : `/${segments.join('/')}`;
    results.push({ route: prefix || '/', ...(await measureInitialJs(root, 'home', segments)) });
    let tier = hasTier;
    if (!tier) {
      try {
        await readFile(join(root, 'browser', ...segments, 'tier-list/index.html'));
        tier = true;
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
          throw error;
      }
    }
    if (tier)
      results.push({
        route: `${prefix}/tier-list`,
        ...(await measureInitialJs(root, 'tier-list', segments)),
      });
  }
  return results;
}

async function main(argv: string[]): Promise<number> {
  try {
    if (argv.length && (argv.length !== 2 || argv[0] !== '--dir'))
      throw new Error('Argumento inválido.');
    const root = resolve(argv[1] ?? 'dist/grim-dawn-builds');
    const locales: (readonly string[])[] = [];
    for (const locale of await readArtifactLocales(REPO_ROOT)) {
      try {
        await readFile(join(root, 'browser', ...locale.segments, 'index.html'));
        locales.push(locale.segments);
      } catch {
        // Un idioma sin artefacto no se mide; emit-404 ya exige su 404 y static-home su HTML.
      }
    }
    if (locales.length === 0) locales.push([]);
    const results = await measureInitialRoutes(root, locales);
    let pass = true;
    for (const result of results) {
      for (const file of result.files)
        console.log(`${result.route} ${file.file}: ${file.gzipBytes} bytes gzip`);
      const routePass = result.totalGzipBytes <= result.limitBytes;
      pass &&= routePass;
      console.log(
        `check:initial-js ${routePass ? 'OK' : 'FALLÓ'} ${result.route} (${result.totalGzipBytes}/${result.limitBytes} bytes gzip nivel 6)`,
      );
    }
    return pass ? 0 : 1;
  } catch {
    console.error(
      'check:initial-js FALLÓ: comprueba argumentos, stats, HTML y archivos JS del artefacto.',
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
