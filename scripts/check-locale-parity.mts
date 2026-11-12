import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Cadenas que DEBEN ser idénticas en inglés y español (endónimos, marcas y
 * términos propios). Cada entrada lleva el motivo. Cualquier otra unidad cuyo
 * target en español coincida con el source inglés falla la paridad.
 * Si una entrada deja de ser idéntica, el check falla hasta quitarla de aquí.
 */
export const ALLOWED_IDENTICAL_IDS: readonly { readonly id: string; readonly reason: string }[] = [
  {
    id: 'buildAttribution.contentPlaceholder',
    reason: 'Placeholder: término de UI idéntico en ambos idiomas',
  },
  {
    id: 'buildAttribution.kindOriginal',
    reason: 'Original: tipo de autoría con nombre propio en ambos idiomas',
  },
  {
    id: 'buildAttribution.kindVideo',
    reason: 'Video: tipo de contenido, mismo término en ambos idiomas',
  },
  { id: 'buildPage.statusMeta', reason: 'Meta: estado de build, término del juego y la comunidad' },
  { id: 'buildToc.video', reason: 'Video: etiqueta de índice, mismo término en ambos idiomas' },
  {
    id: 'videoFacade.heading',
    reason: 'Video: encabezado de reproductor, mismo término en ambos idiomas',
  },
  { id: 'notFound.eyebrow', reason: 'Error 404: código de error estándar' },
  { id: 'catalog.placeholder', reason: 'Placeholder: término de UI idéntico en ambos idiomas' },
  {
    id: 'catalog.tier',
    reason: 'Tier: término de ranking (marcador de posición ICU sin traducir)',
  },
  {
    id: 'devotionMap.tier',
    reason: 'Tier: término de ranking (marcador de posición ICU sin traducir)',
  },
  {
    id: 'skillTree.status.meta',
    reason: 'Meta: estado de build, término del juego y la comunidad',
  },
  { id: 'layout.brand', reason: 'Marca: Grim Dawn Builds es nombre propio del sitio' },
  {
    id: 'catalog.option.elemental',
    reason: 'Elemental: tipo de daño con el mismo término en ambos idiomas',
  },
  {
    id: 'catalog.option.shattered_realm',
    reason: 'Shattered Realm: nombre propio del modo de juego',
  },
  { id: 'catalog.option.crucible', reason: 'Crucible: nombre propio del modo de juego' },
  {
    id: 'catalog.option.placeholder',
    reason: 'Placeholder: estado del catálogo, término de UI idéntico en ambos idiomas',
  },
  {
    id: 'locale.english',
    reason: 'English: endónimo del conmutador, se muestra en su propio idioma',
  },
  {
    id: 'locale.spanish',
    reason: 'Español: endónimo del conmutador, se muestra en su propio idioma',
  },
];

export interface XliffUnit {
  id: string;
  source: string;
  target: string | null;
}

export type XliffParseErrorKind = 'malformed' | 'duplicate' | 'empty';

export class XliffParseError extends Error {
  readonly kind: XliffParseErrorKind;

  constructor(kind: XliffParseErrorKind, message: string) {
    super(message);
    this.name = 'XliffParseError';
    this.kind = kind;
  }
}

export type LocaleFailureCategory =
  | 'catalog'
  | 'id-set'
  | 'duplicate-id'
  | 'empty-target'
  | 'identical-target'
  | 'allowlist'
  | 'source'
  | 'placeholder'
  | 'icu-braces';

export interface LocaleFailure {
  category: LocaleFailureCategory;
  id?: string;
  message: string;
}

export interface LocaleParityStats {
  enUnits: number;
  esUnits: number;
  allowlisted: number;
  identicalAllowed: number;
}

export interface LocaleParityInput {
  en: string;
  es: string;
  allowedIdenticalIds?: readonly string[];
}

export interface LocaleParityResult {
  failures: LocaleFailure[];
  stats: LocaleParityStats;
}

const TAG_PATTERN =
  /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/y;
const ATTRIBUTE_PATTERN = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/g;
const ENTITY_PATTERN = /&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);/gi;
const INVALID_ENTITY_PATTERN = /&(?!(?:#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);)/i;
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const MARKER_PATTERN = /<([A-Za-z][\w.:-]*)(?: id="([^"]*)")?\/>/g;

function malformed(message: string): never {
  throw new XliffParseError('malformed', message);
}

function decodeText(text: string): string {
  if (INVALID_ENTITY_PATTERN.test(text)) malformed('entidad XML no válida');
  return text.replace(ENTITY_PATTERN, (_entity, body: string) => {
    if (body.startsWith('#')) {
      const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (code > 0x10ffff) malformed('entidad numérica fuera de rango');
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? body;
  });
}

function readAttributes(text: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of text.matchAll(ATTRIBUTE_PATTERN)) {
    attributes.set(match[1]!, match[2] ?? match[3] ?? '');
  }
  return attributes;
}

/**
 * Parsea un XLIFF 1.2 de Angular extract-i18n. Lanza XliffParseError si el XML
 * está mal formado, si hay trans-units duplicados o si no hay ninguno.
 */
export function parseXliff(xml: string): XliffUnit[] {
  const stack: string[] = [];
  const units: XliffUnit[] = [];
  const seen = new Set<string>();
  let rootSeen = false;
  let unit = null as {
    id: string;
    source: string | null;
    target: string | null;
    depth: number;
  } | null;
  let capture = null as { name: 'source' | 'target'; depth: number; buffer: string } | null;

  const openElement = (name: string, attributes: Map<string, string>) => {
    if (capture) {
      const id = attributes.get('id');
      capture.buffer += `<${name}${id === undefined ? '' : ` id="${id}"`}/>`;
    } else if (name === 'trans-unit') {
      if (unit) malformed('trans-unit anidado');
      const id = attributes.get('id');
      if (!id) malformed('trans-unit sin atributo id');
      unit = { id, source: null, target: null, depth: stack.length + 1 };
    } else if ((name === 'source' || name === 'target') && unit && stack.at(-1) === 'trans-unit') {
      capture = { name, depth: stack.length + 1, buffer: '' };
    }
    if (stack.length === 0) rootSeen = true;
    stack.push(name);
  };

  const closeElement = (name: string) => {
    const top = stack.pop();
    if (top !== name) malformed(`etiqueta </${name}> no coincide con <${top ?? 'nada'}>`);
    const depth = stack.length + 1;
    if (capture && capture.depth === depth && capture.name === name) {
      if (capture.name === 'source') unit!.source = capture.buffer;
      else unit!.target = capture.buffer;
      capture = null;
    }
    if (unit && name === 'trans-unit' && unit.depth === depth) {
      if (seen.has(unit.id))
        throw new XliffParseError('duplicate', `trans-unit duplicado: ${unit.id}`);
      seen.add(unit.id);
      units.push({ id: unit.id, source: unit.source ?? '', target: unit.target });
      unit = null;
    }
  };

  let pos = 0;
  while (pos < xml.length) {
    const lt = xml.indexOf('<', pos);
    const text = xml.slice(pos, lt === -1 ? xml.length : lt);
    if (text) {
      if (stack.length === 0) {
        if (text.trim()) malformed('texto fuera del elemento raíz');
      } else if (capture) {
        capture.buffer += decodeText(text);
      } else {
        decodeText(text);
      }
    }
    if (lt === -1) break;

    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const [opener, terminator] = xml.startsWith('<![CDATA[', lt)
        ? ['<![CDATA[', ']]>']
        : xml.startsWith('<!--', lt)
          ? ['<!--', '-->']
          : xml.startsWith('<?', lt)
            ? ['<?', '?>']
            : ['<!', '>'];
      const start = lt + opener!.length;
      const close = xml.indexOf(terminator!, start);
      if (close === -1) malformed('sección sin cerrar');
      if (opener === '<![CDATA[' && capture) capture.buffer += xml.slice(start, close);
      pos = close + terminator!.length;
      continue;
    }

    TAG_PATTERN.lastIndex = lt;
    const match = TAG_PATTERN.exec(xml);
    if (!match) malformed(`etiqueta mal formada en la posición ${lt}`);
    pos = TAG_PATTERN.lastIndex;
    const name = match[2]!;
    if (match[1]) {
      closeElement(name);
    } else {
      openElement(name, readAttributes(match[3] ?? ''));
      if (match[4]) closeElement(name);
    }
  }

  if (stack.length || unit || capture) malformed('elemento sin cerrar');
  if (!rootSeen) malformed('documento vacío');
  if (units.length === 0) throw new XliffParseError('empty', 'el catálogo no tiene trans-units');
  return units;
}

function markers(text: string): string[] {
  return [...text.matchAll(MARKER_PATTERN)]
    .map((match) => `<${match[1]} id="${match[2] ?? ''}"/>`)
    .sort();
}

function countOf(text: string, char: string): number {
  return text.split(char).length - 1;
}

function parseCatalog(label: string, xml: string, failures: LocaleFailure[]): XliffUnit[] | null {
  try {
    return parseXliff(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const kind = error instanceof XliffParseError ? error.kind : 'malformed';
    failures.push({
      category: kind === 'duplicate' ? 'duplicate-id' : 'catalog',
      message: `catálogo ${label}: ${message}`,
    });
    return null;
  }
}

/** Compara los catálogos en/es. Función pura: no lee disco. */
export function checkLocaleParity({
  en,
  es,
  allowedIdenticalIds = ALLOWED_IDENTICAL_IDS.map((entry) => entry.id),
}: LocaleParityInput): LocaleParityResult {
  const failures: LocaleFailure[] = [];
  const fail = (category: LocaleFailureCategory, id: string | undefined, message: string) =>
    failures.push({ category, id, message });
  const enUnits = parseCatalog('en', en, failures);
  const esUnits = parseCatalog('es', es, failures);
  const allowed = new Set(allowedIdenticalIds);
  const stats: LocaleParityStats = {
    enUnits: enUnits?.length ?? 0,
    esUnits: esUnits?.length ?? 0,
    allowlisted: allowed.size,
    identicalAllowed: 0,
  };
  if (!enUnits || !esUnits) return { failures, stats };

  const enById = new Map(enUnits.map((unit) => [unit.id, unit]));
  const esById = new Map(esUnits.map((unit) => [unit.id, unit]));

  for (const unit of enUnits) {
    if (!esById.has(unit.id)) fail('id-set', unit.id, 'existe en en pero falta en es');
  }
  for (const unit of esUnits) {
    if (!enById.has(unit.id)) fail('id-set', unit.id, 'existe en es pero falta en en');
  }

  for (const enUnit of enUnits) {
    const esUnit = esById.get(enUnit.id);
    if (!esUnit) continue;
    const id = enUnit.id;

    if (!enUnit.source.trim()) fail('source', id, 'source vacío en en');
    if (!esUnit.source.trim()) fail('source', id, 'source vacío en es');
    else if (enUnit.source !== esUnit.source) fail('source', id, 'source distinto entre en y es');

    const target = esUnit.target ?? '';
    if (!target.trim()) {
      fail('empty-target', id, 'target vacío en es');
      continue;
    }

    const identical = target.trim() === enUnit.source.trim();
    if (allowed.has(id)) {
      if (identical) stats.identicalAllowed += 1;
    } else if (identical) {
      fail(
        'identical-target',
        id,
        'target en es idéntico al texto en inglés y no está en la allowlist',
      );
    }

    const enMarkers = markers(enUnit.source);
    const esMarkers = markers(target);
    if (enMarkers.join('\n') !== esMarkers.join('\n')) {
      fail(
        'placeholder',
        id,
        `placeholders distintos: en=[${enMarkers.join(', ')}] es=[${esMarkers.join(', ')}]`,
      );
    }

    const enOpen = countOf(enUnit.source, '{');
    const enClose = countOf(enUnit.source, '}');
    const esOpen = countOf(target, '{');
    const esClose = countOf(target, '}');
    if (enOpen !== esOpen || enClose !== esClose) {
      fail(
        'icu-braces',
        id,
        `llaves ICU distintas: en={${enOpen} }${enClose} es={${esOpen} }${esClose}`,
      );
    }
  }

  for (const id of allowed) {
    const enUnit = enById.get(id);
    const esUnit = esById.get(id);
    if (!enUnit || !esUnit) {
      fail(
        'allowlist',
        id,
        'entrada de allowlist sin unidad en ambos catálogos; quitar la entrada',
      );
    } else if (esUnit.target?.trim() && esUnit.target.trim() !== enUnit.source.trim()) {
      fail('allowlist', id, 'entrada de allowlist ya traducida; quitar de la allowlist');
    }
  }

  return { failures, stats };
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface CatalogPaths {
  en: string;
  es: string;
}

/** Interpreta `--en <ruta>` y `--es <ruta>`. Las rutas relativas parten de process.cwd(). */
export function parseCliArgs(argv: readonly string[]): CatalogPaths {
  const paths: CatalogPaths = {
    en: resolve(REPO_ROOT, 'apps/web/src/locale/messages.en.xlf'),
    es: resolve(REPO_ROOT, 'apps/web/src/locale/messages.es.xlf'),
  };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if ((flag !== '--en' && flag !== '--es') || !value || value.startsWith('--')) {
      throw new Error(
        `argumento no válido: ${flag ?? '(vacío)'}. Uso: [--en <ruta>] [--es <ruta>]`,
      );
    }
    if (flag === '--en') paths.en = resolve(value);
    else paths.es = resolve(value);
  }
  return paths;
}

async function readCatalog(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new Error(`no se puede leer ${path}`);
  }
}

async function main(argv: string[]): Promise<number> {
  let paths: CatalogPaths;
  let en: string;
  let es: string;
  try {
    paths = parseCliArgs(argv);
    en = await readCatalog(paths.en);
    es = await readCatalog(paths.es);
  } catch (error) {
    console.error(`check:locale-parity FALLÓ: ${error instanceof Error ? error.message : error}`);
    return 1;
  }

  const { failures, stats } = checkLocaleParity({ en, es });
  console.log(`catálogo en: ${paths.en} (${stats.enUnits} unidades)`);
  console.log(`catálogo es: ${paths.es} (${stats.esUnits} unidades)`);
  console.log(
    `allowlist: ${stats.allowlisted} ids (${stats.identicalAllowed} idénticos permitidos)`,
  );
  if (failures.length === 0) {
    console.log(`check:locale-parity OK: ${stats.enUnits} unidades en paridad, 0 fallos`);
    return 0;
  }

  const byCategory = new Map<string, number>();
  for (const failure of failures) {
    byCategory.set(failure.category, (byCategory.get(failure.category) ?? 0) + 1);
  }
  const summary = [...byCategory].map(([category, count]) => `${category}=${count}`).join(', ');
  console.error(`check:locale-parity FALLÓ: ${failures.length} fallos (${summary})`);
  for (const failure of failures) {
    console.error(
      `- [${failure.category}] ${failure.id ? `${failure.id}: ` : ''}${failure.message}`,
    );
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
