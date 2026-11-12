import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileContentRepository } from './file.repository';
import { FixtureContentSource, type FixtureCollection } from './fixture-source';

/** Server entry only: never import this module from browser app configuration. */
export function createFixtureRepository(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
) {
  if (env['BUILD_MODE'] && env['BUILD_MODE'] !== 'local')
    throw new Error('El adaptador fixture solo admite BUILD_MODE=local; release requiere API.');
  if (env['CONTENT_SOURCE'] && env['CONTENT_SOURCE'] !== 'fixture')
    throw new Error('La fuente solicitada requiere el adaptador API; no hay fallback a fixtures.');
  if (env['INCLUDE_DRAFTS'] && !['true', 'false'].includes(env['INCLUDE_DRAFTS']))
    throw new Error('INCLUDE_DRAFTS debe ser true o false.');
  return new FileContentRepository(
    new FixtureContentSource((collection) => readCollection(root, collection)),
    {
      includeDrafts: env['INCLUDE_DRAFTS'] === 'true',
      buildMode: 'local',
    },
  );
}

async function readCollection(root: string, collection: FixtureCollection): Promise<unknown[]> {
  let entries;
  try {
    entries = await readdir(join(root, collection), { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    // Keep filesystem paths and possible private error details out of build logs.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`No se pudo leer la colección ${collection}.`);
  }
  const files = entries
    .filter((entry) => entry.name.endsWith('.json'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return Promise.all(
    files.map(async (entry) => {
      if (!entry.isFile() || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(entry.name))
        throw new Error(`Archivo fixture no permitido en ${collection}.`);
      try {
        return JSON.parse(await readFile(join(root, collection, entry.name), 'utf8')) as unknown;
      } catch {
        // JSON.parse includes excerpts of its input in modern Node. Do not retain its cause.
        throw new Error(`No se pudo leer JSON fixture: ${collection}/${entry.name}.`);
      }
    }),
  );
}
