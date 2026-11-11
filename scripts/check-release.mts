import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ReleaseInfo {
  source: 'api';
  migration: string;
  builtAt: string;
  contentHash: string;
}
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const digest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

/** Same v1 identity as the API; expected identity is always derived from this checkout. */
export async function expectedMigration(root: string): Promise<string> {
  const folder = join(root, 'apps/api/drizzle');
  const journal: unknown = JSON.parse(await readFile(join(folder, 'meta/_journal.json'), 'utf8'));
  if (
    !journal ||
    typeof journal !== 'object' ||
    !('entries' in journal) ||
    !Array.isArray(journal.entries) ||
    !journal.entries.length
  )
    throw new Error('Historial de migraciones inválido.');
  const tags = new Set<string>();
  const hashes: string[] = [];
  for (const [index, entry] of journal.entries.entries()) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      entry.idx !== index ||
      typeof entry.tag !== 'string' ||
      !/^\d{4}_[a-z0-9_]+$/.test(entry.tag) ||
      tags.has(entry.tag)
    )
      throw new Error('Historial de migraciones inválido.');
    tags.add(entry.tag);
    const path = join(folder, `${entry.tag}.sql`);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Migración no regular.');
    hashes.push(hash(await readFile(path)));
  }
  return hash(JSON.stringify(hashes));
}

export function publicApiUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    url.pathname = `${url.pathname.replace(/\/$/, '')}/`;
    return url;
  } catch {
    throw new Error('API_BASE_URL inválida.');
  }
}

export async function probeReleaseApi(
  base: string,
  migration: string,
  request: typeof fetch = fetch,
): Promise<void> {
  try {
    const response = await request(new URL('ready', publicApiUrl(base)), {
      redirect: 'error',
      credentials: 'omit',
      signal: AbortSignal.timeout(5000),
    });
    if (
      response.status !== 200 ||
      !digest(migration) ||
      response.headers.get('X-Content-Migration') !== migration
    ) {
      await response.body?.cancel();
      throw new Error();
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'ready')
      throw new Error();
  } catch {
    throw new Error('Release requiere API ready y migración idéntica al checkout.');
  }
}

/** Hash public bytes and POSIX paths, not server output or private source documents. */
export async function contentFingerprint(folder: string): Promise<string> {
  const files: [string, string][] = [];
  const walk = async (path: string, relative: string): Promise<void> => {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Artefacto con enlace simbólico.');
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort())
        await walk(join(path, name), relative ? `${relative}/${name}` : name);
    } else if (stat.isFile()) files.push([relative, hash(await readFile(path))]);
    else throw new Error('Artefacto no regular.');
  };
  await walk(folder, '');
  if (!files.length) throw new Error('Artefacto vacío.');
  files.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return hash(JSON.stringify(files));
}

export async function verifyRelease(
  info: unknown,
  folder: string,
  migration: string,
): Promise<ReleaseInfo> {
  if (
    !info ||
    typeof info !== 'object' ||
    Object.keys(info).sort().join(',') !== 'builtAt,contentHash,migration,source' ||
    !('source' in info) ||
    info.source !== 'api' ||
    !('migration' in info) ||
    !digest(info.migration) ||
    info.migration !== migration ||
    !('builtAt' in info) ||
    typeof info.builtAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(info.builtAt) ||
    !Number.isFinite(Date.parse(info.builtAt)) ||
    new Date(info.builtAt).toISOString() !== info.builtAt ||
    !('contentHash' in info) ||
    !digest(info.contentHash) ||
    info.contentHash !== (await contentFingerprint(folder))
  )
    throw new Error('Informe de release inválido o artefacto modificado.');
  const html = await readFile(join(folder, 'index.html'), 'utf8');
  const states = [
    ...html.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  let valid = false;
  for (const [, raw] of states) {
    const state = JSON.parse(raw!) as Record<string, unknown>;
    const source = state['gd-content-source'];
    if (
      source &&
      typeof source === 'object' &&
      'source' in source &&
      source.source === 'api' &&
      'includeDrafts' in source &&
      source.includeDrafts === false
    )
      valid = true;
  }
  if (!valid) throw new Error('Artefacto sin marcador API público.');
  return info as ReleaseInfo;
}

async function main(): Promise<number> {
  try {
    if (process.argv.length !== 2) throw new Error();
    const root = resolve(import.meta.dirname, '..');
    const migration = await expectedMigration(root);
    await verifyRelease(
      JSON.parse(await readFile(join(root, 'dist/build-info.json'), 'utf8')),
      join(root, 'dist/grim-dawn-builds/browser'),
      migration,
    );
    await probeReleaseApi(process.env['API_BASE_URL'] ?? 'http://127.0.0.1:3000', migration);
    console.log('check:release OK (API, migración y artefacto verificados).');
    return 0;
  } catch {
    console.error('check:release FALLÓ: fuente, API, migración o artefacto inválido.');
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
