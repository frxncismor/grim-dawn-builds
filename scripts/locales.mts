import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Configuración regional publicada por `angular.json` (T-138).
 *
 * `segments` es la ruta del artefacto desde `browser/`: el idioma de origen usa
 * `[]` (raíz) y cada configuración regional su `subPath` (`['es']`). Los scripts
 * de post-build recorren la misma lista para no tratar una ruta como idioma.
 */
export interface ArtifactLocale {
  code: string;
  segments: string[];
}

const SEGMENT = /^[a-z][a-z0-9-]*$/;

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function segmentsOf(subPath: unknown): string[] {
  if (subPath === undefined || subPath === '') return [];
  if (typeof subPath !== 'string') fail('angular.json: subPath de idioma inválido.');
  const segments = subPath.split('/');
  if (!segments.every((segment) => SEGMENT.test(segment)))
    fail('angular.json: subPath de idioma no seguro.');
  return segments;
}

/** Deriva de la sección `i18n` del proyecto las rutas de artefacto por idioma. */
export function artifactLocales(config: unknown): ArtifactLocale[] {
  if (!isRecord(config) || !isRecord(config['projects']))
    fail('angular.json: falta la sección projects.');
  for (const project of Object.values(config['projects'])) {
    if (!isRecord(project) || !isRecord(project['i18n'])) continue;
    const i18n = project['i18n'];
    const source = isRecord(i18n['sourceLocale']) ? i18n['sourceLocale'] : null;
    if (!source || typeof source['code'] !== 'string')
      fail('angular.json: falta sourceLocale.code.');
    const result: ArtifactLocale[] = [
      { code: source['code'], segments: segmentsOf(source['subPath']) },
    ];
    const locales = i18n['locales'];
    if (locales !== undefined) {
      if (!isRecord(locales)) fail('angular.json: locales inválidos.');
      for (const [code, locale] of Object.entries(locales)) {
        if (!isRecord(locale)) fail('angular.json: configuración regional inválida.');
        const segments = segmentsOf(locale['subPath']);
        if (segments.length === 0) fail(`angular.json: ${code} no declara subPath propio.`);
        result.push({ code, segments });
      }
    }
    const keys = new Set(result.map((locale) => locale.segments.join('/')));
    if (keys.size !== result.length) fail('angular.json: subPath de idioma duplicado.');
    return result;
  }
  return fail('angular.json: ningún proyecto declara i18n.');
}

/** Lee el `angular.json` de la web (`apps/web`) desde la raíz del repositorio. */
export async function readArtifactLocales(repoRoot: string): Promise<ArtifactLocale[]> {
  let raw: string;
  try {
    raw = await readFile(join(repoRoot, 'apps', 'web', 'angular.json'), 'utf8');
  } catch {
    return fail('angular.json no legible.');
  }
  try {
    return artifactLocales(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) fail('angular.json no es JSON válido.');
    throw error;
  }
}
