// T001/T006/T022 (spec 003): extracción reproducible de los árboles de maestría desde el
// `database.arz` instalado de Grim Dawn. Solo lectura, solo `node:` builtins.
//
// Uso:
//   pnpm catalog:extract --game-dir <ruta> [--out <archivo>]   (o env GRIMDAWN_DIR)
//   ... --game-version <texto>    fuerza `source.game_version` (por defecto: buildid de Steam)
//   ... --no-localize             conserva los tags de localización (sin leer los `.arc` de texto)
//   ... --record <ruta-registro>  (depuración, repetible) vuelca campos de un registro a stdout
//
// Por defecto resuelve `name.en`/`name.es` desde `resources/Text_EN.arc` y `Text_ES.arc` (T022).
//
// Sin `--out` el JSON va a stdout. Con `--out` se escribe SOLO ese archivo: usa una ruta fuera
// del repo o ignorada (`tmp/`); los datos extraídos del juego no se versionan.
// Determinista: sin fechas ni rutas absolutas; mismo `.arz` => mismos bytes (SC-002).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type FieldValue = number | string | boolean;
export interface ArzRecord {
  readonly path: string;
  readonly type: string;
  readonly fields: ReadonlyMap<string, readonly FieldValue[]>;
}
interface Entry {
  readonly path: string;
  readonly type: string;
  readonly offset: number;
  readonly compressed: number;
  readonly size: number;
}

/** Descompresión LZ4 (formato bloque, sin cabecera de frame). */
export function lz4Block(src: Uint8Array, outSize: number): Uint8Array {
  const out = new Uint8Array(outSize);
  let i = 0;
  let o = 0;
  while (i < src.length) {
    const token = src[i++]!;
    let lit = token >> 4;
    if (lit === 15) {
      let n: number;
      do {
        n = src[i++]!;
        lit += n;
      } while (n === 255);
    }
    if (o + lit > outSize || i + lit > src.length) throw new Error('LZ4: literales fuera de rango');
    out.set(src.subarray(i, i + lit), o);
    i += lit;
    o += lit;
    if (i >= src.length) break;
    const off = src[i]! | (src[i + 1]! << 8);
    i += 2;
    let len = token & 15;
    if (len === 15) {
      let n: number;
      do {
        n = src[i++]!;
        len += n;
      } while (n === 255);
    }
    len += 4;
    if (off === 0 || off > o) throw new Error('LZ4: desplazamiento inválido');
    if (o + len > outSize) throw new Error('LZ4: coincidencia fuera de rango');
    for (let k = 0; k < len; k++, o++) out[o] = out[o - off]!;
  }
  if (o !== outSize) throw new Error(`LZ4: ${o} bytes, se esperaban ${outSize}`);
  return out;
}

export class Arz {
  readonly strings: string[] = [];
  readonly entries = new Map<string, Entry>();
  private readonly buf: Buffer;
  readonly header: Record<string, number>;

  constructor(buf: Buffer) {
    this.buf = buf;
    const h = {
      magic: buf.readUInt16LE(0),
      version: buf.readUInt16LE(2),
      recordStart: buf.readUInt32LE(4),
      recordBytes: buf.readUInt32LE(8),
      recordCount: buf.readUInt32LE(12),
      stringStart: buf.readUInt32LE(16),
      stringBytes: buf.readUInt32LE(20),
    };
    if (h.magic !== 2 || h.version !== 3)
      throw new Error(`cabecera .arz no soportada: ${h.magic}/${h.version}`);
    this.header = h;
    let p = h.stringStart;
    const nStr = buf.readUInt32LE(p);
    p += 4;
    for (let n = 0; n < nStr; n++) {
      const len = buf.readUInt32LE(p);
      this.strings.push(buf.toString('latin1', p + 4, p + 4 + len));
      p += 4 + len;
    }
    p = h.recordStart;
    for (let n = 0; n < h.recordCount; n++) {
      const path = this.strings[buf.readUInt32LE(p)]!;
      const tl = buf.readUInt32LE(p + 4);
      const type = buf.toString('latin1', p + 8, p + 8 + tl);
      p += 8 + tl;
      this.entries.set(path, {
        path,
        type,
        offset: buf.readUInt32LE(p),
        compressed: buf.readUInt32LE(p + 4),
        size: buf.readUInt32LE(p + 8),
      });
      p += 12 + 8; // + marca de tiempo (FILETIME, 8 bytes)
    }
  }

  read(path: string): ArzRecord {
    const e = this.entries.get(path);
    if (!e) throw new Error(`registro inexistente: ${path}`);
    const raw = this.buf.subarray(24 + e.offset, 24 + e.offset + e.compressed);
    const d = Buffer.from(lz4Block(raw, e.size));
    const fields = new Map<string, FieldValue[]>();
    for (let p = 0; p < d.length;) {
      const kind = d.readUInt16LE(p);
      const count = d.readUInt16LE(p + 2);
      const key = this.strings[d.readUInt32LE(p + 4)]!;
      p += 8;
      const vals: FieldValue[] = [];
      for (let n = 0; n < count; n++, p += 4) {
        if (kind === 0) vals.push(d.readInt32LE(p));
        else if (kind === 1) vals.push(Math.round(d.readFloatLE(p) * 1e6) / 1e6);
        else if (kind === 2) vals.push(this.strings[d.readUInt32LE(p)]!);
        else if (kind === 3) vals.push(d.readUInt32LE(p) !== 0);
        else throw new Error(`tipo de campo desconocido ${kind} en ${path}`);
      }
      fields.set(key, vals);
    }
    return { path, type: e.type, fields };
  }
}

// ---------------------------------------------------------------------------------------------
// T022: contenedor `.arc` (v3) de textos de localización (research.md §T022)
// ---------------------------------------------------------------------------------------------

interface ArcFile {
  readonly name: string;
  readonly firstPart: number;
  readonly partCount: number;
}

/** Lector mínimo de `.arc` v3: tabla de partes, cadenas y registros de 44 bytes (solo lectura). */
export class Arc {
  readonly files = new Map<string, ArcFile>();
  private readonly parts: { offset: number; compressed: number; size: number }[] = [];
  private readonly buf: Buffer;

  constructor(buf: Buffer) {
    this.buf = buf;
    if (buf.length < 28 || buf.toString('latin1', 0, 4) !== 'ARC\0' || buf.readUInt32LE(4) !== 3)
      throw new Error('cabecera .arc no soportada (se esperaba "ARC", versión 3)');
    const nFiles = buf.readUInt32LE(8);
    const nParts = buf.readUInt32LE(12);
    const partBytes = buf.readUInt32LE(16);
    const strBytes = buf.readUInt32LE(20);
    const tocOffset = buf.readUInt32LE(24);
    const strOffset = tocOffset + partBytes;
    const recOffset = strOffset + strBytes;
    if (partBytes !== nParts * 12 || recOffset + nFiles * 44 !== buf.length)
      throw new Error('índice .arc inconsistente con el tamaño del archivo');
    for (let n = 0; n < nParts; n++) {
      const p = tocOffset + n * 12;
      this.parts.push({
        offset: buf.readUInt32LE(p),
        compressed: buf.readUInt32LE(p + 4),
        size: buf.readUInt32LE(p + 8),
      });
    }
    const names = buf.toString('latin1', strOffset, recOffset);
    for (let n = 0; n < nFiles; n++) {
      const p = recOffset + n * 44;
      const nameLen = buf.readUInt32LE(p + 36);
      const nameOff = buf.readUInt32LE(p + 40);
      const name = names.slice(nameOff, nameOff + nameLen);
      const firstPart = buf.readUInt32LE(p + 32);
      const partCount = buf.readUInt32LE(p + 28);
      if (firstPart + partCount > nParts) throw new Error(`.arc: partes fuera de rango en ${name}`);
      this.files.set(name, { name, firstPart, partCount });
    }
  }

  /** Contenido descomprimido de un archivo (concatenación de sus partes). */
  read(name: string): Buffer {
    const f = this.files.get(name);
    if (!f) throw new Error(`archivo inexistente en el .arc: ${name}`);
    const chunks: Buffer[] = [];
    for (const part of this.parts.slice(f.firstPart, f.firstPart + f.partCount)) {
      const raw = this.buf.subarray(part.offset, part.offset + part.compressed);
      chunks.push(part.compressed === part.size ? raw : Buffer.from(lz4Block(raw, part.size)));
    }
    return Buffer.concat(chunks);
  }
}

/** Códigos de formato del juego: `{^x}`/`{%x}` se eliminan; `[ms]A[fs]B` se queda con la variante masculina. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\{[\^%][^}]*\}/g, '')
    .replace(/\[ms\]([^[]*)(?:\[[a-z]{2}\][^[]*)*/g, '$1')
    .replace(/\[[a-z]{2}\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** `tag=valor` (primer `=`); ignora vacías y comentarios (`#`, `//`); acepta CRLF y LF. */
export function parseTags(text: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (line === '' || line.startsWith('#') || line.startsWith('//')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    tags.set(line.slice(0, eq).trim(), cleanText(line.slice(eq + 1)));
  }
  return tags;
}

const TAGS_FILE = 'tags_skills.txt';
/** Etiquetas de `tags_skills.txt` (UTF-8; ASCII en EN), donde están los nombres de maestrías y habilidades. */
export function loadTags(arc: Arc): Map<string, string> {
  if (!arc.files.has(TAGS_FILE)) throw new Error(`el .arc no contiene ${TAGS_FILE}`);
  return parseTags(arc.read(TAGS_FILE).toString('utf8'));
}

export interface Localizer {
  resolve(tag: string): LocalizedName;
  /** Tags sin texto ES (se usó el EN), sin repetidos. */
  readonly fallbacks: Set<string>;
}

/** EN ausente => error con el tag; ES ausente => texto EN y registro en `fallbacks`. */
export function createLocalizer(
  en: ReadonlyMap<string, string>,
  es: ReadonlyMap<string, string>,
): Localizer {
  const fallbacks = new Set<string>();
  return {
    fallbacks,
    resolve(tag) {
      const e = en.get(tag);
      if (!e) throw new Error(`falta el tag de localización en EN: ${tag}`);
      const s = es.get(tag);
      if (!s) fallbacks.add(tag);
      return { en: e, es: s || e };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// T006: catálogo de árboles (mapa de campos de research.md T002 §3)
// ---------------------------------------------------------------------------------------------

export type NodeKind = 'active' | 'passive' | 'modifier' | 'transmuter';

export interface LocalizedName {
  en: string;
  es: string;
}
/** Forma del contrato T005/T006 (`CatalogSkillNodeSchema`): `id` = `classNN/<registro>`. */
export interface CatalogNode {
  id: string;
  name: LocalizedName;
  kind: NodeKind;
  circular: boolean;
  tier: number;
  bar_required: number;
  grid: { col: number; row: number };
  max_points?: number;
  ultimate_points?: number;
  parent_id: string | null;
  icon?: string;
}
export interface CatalogTree {
  mastery: { id: string; slug: string; name: LocalizedName };
  game_version: string;
  source: { game_version: string; sha256: string[] };
  nodes: CatalogNode[];
}

export interface BuildOptions {
  readonly gameVersion: string;
  readonly sha256: readonly string[];
  readonly masteries?: readonly string[];
  /** T022: resuelve `name`; sin él, `name.en = name.es = tag` (comportamiento de T006). */
  readonly localizer?: Localizer;
}

/** v1 (decisión de Paco, 2026-11-13): las 6 maestrías base. */
export const BASE_MASTERIES: readonly string[] = [
  'class01',
  'class02',
  'class03',
  'class04',
  'class05',
  'class06',
];

const ENGINE_RECORD = 'records/game/gameengine.dbr';
const COL_ORIGIN = 246; // bitmapPositionX de la columna del tier 1
const COL_STEP = 80;
/** Excepción de datos del juego (research T002 §3): `natureblessing1` frente a `naturesblessing2/3`. */
const FAMILY_ALIASES: Readonly<Record<string, string>> = { naturesblessing: 'natureblessing' };

const first = (r: ArzRecord | undefined, key: string): FieldValue | undefined =>
  r?.fields.get(key)?.[0];
const int = (v: FieldValue | undefined): number | null => (typeof v === 'number' ? v : null);
const str = (v: FieldValue | undefined): string | null =>
  typeof v === 'string' && v !== '' ? v : null;

export function kindOf(type: string): NodeKind {
  if (/Transmuter$/.test(type)) return 'transmuter';
  if (/Modifier$/.test(type) || type.startsWith('SkillSecondary_')) return 'modifier';
  if (type.startsWith('Skill_Passive')) return 'passive';
  return 'active';
}

/** Familia de una habilidad (research T002 §3, regla `parent`). */
function familyOf(id: string): string {
  const base = id
    .replace(/_(petmodifier|petmod)$/, '')
    .replace(/_mod\d+$/, '')
    .replace(/(\d)[bc]$/, '$1')
    .replace(/\d+$/, '');
  return FAMILY_ALIASES[base] ?? base;
}

const skillId = (path: string): string => path.replace(/^.*\//, '').replace(/\.dbr$/, '');
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function readMastery(
  arz: Arz,
  tiers: readonly number[],
  nn: string,
  meta: { game_version: string; sha256: readonly string[]; localizer?: Localizer | undefined },
): CatalogTree {
  const nameOf = (tag: string): LocalizedName =>
    meta.localizer ? meta.localizer.resolve(tag) : { en: tag, es: tag };
  const id = `class${nn}`;
  const mPath = `records/skills/playerclass${nn}/_classtraining_class${nn}.dbr`;
  if (!arz.entries.has(mPath)) throw new Error(`maestría ${id}: falta el registro ${mPath}`);
  const m = arz.read(mPath);
  const uiPaths = [...arz.entries.keys()].filter((p) =>
    new RegExp(`^records/ui/skills/class${nn}/skill\\d+\\.dbr$`).test(p),
  );
  if (uiPaths.length === 0) throw new Error(`maestría ${id}: sin nodos de UI (no tiene árbol)`);

  const nodes: CatalogNode[] = [];
  for (const uiPath of uiPaths) {
    const uiRec = arz.read(uiPath);
    const skillPath = str(first(uiRec, 'skillName'));
    // `skillName` colgante (registro retirado): se excluye (research T002 §2).
    if (!skillPath || !arz.entries.has(skillPath)) continue;
    const rec = arz.read(skillPath);
    // Envoltorios: se sigue `buffSkillName`/`petSkillName` (hasta 3 saltos) y se toma el primer valor.
    const chain: ArzRecord[] = [rec];
    for (let hop = 0; hop < 3; hop++) {
      const last = chain[chain.length - 1]!;
      const next = str(first(last, 'buffSkillName')) ?? str(first(last, 'petSkillName'));
      if (!next || !arz.entries.has(next) || chain.some((c) => c.path === next)) break;
      chain.push(arz.read(next));
    }
    const pick = (key: string): FieldValue | undefined => {
      for (const c of chain) {
        const v = first(c, key);
        if (v !== undefined) return v;
      }
      return undefined;
    };
    const x = int(first(uiRec, 'bitmapPositionX'));
    const y = int(first(uiRec, 'bitmapPositionY'));
    if (x === null || y === null) throw new Error(`${uiPath}: sin bitmapPosition`);
    if ((x - COL_ORIGIN) % COL_STEP !== 0)
      throw new Error(`${uiPath}: bitmapPositionX ${x} fuera de la rejilla de columnas`);
    const col = (x - COL_ORIGIN) / COL_STEP + 1;
    const own = int(pick('skillTier'));
    if (own !== null && own !== col)
      throw new Error(`${skillId(skillPath)}: tier ${own} distinto de la columna ${col}`);
    const tier = own ?? col;
    const barRequired = tiers[tier - 1];
    if (barRequired === undefined)
      throw new Error(`${skillId(skillPath)}: tier ${tier} sin umbral`);
    const tag = str(pick('skillDisplayName'));
    if (!tag) throw new Error(`${skillId(skillPath)}: sin skillDisplayName`);
    const maxPoints = int(pick('skillMaxLevel'));
    const ultimate = int(pick('skillUltimateLevel'));
    const icon = str(pick('skillUpBitmapName'));
    nodes.push({
      id: `class${nn}/${skillId(skillPath)}`,
      name: nameOf(tag),
      kind: kindOf(rec.type),
      circular: first(uiRec, 'isCircular') === true,
      tier,
      bar_required: barRequired,
      grid: { col, row: y },
      ...(maxPoints !== null ? { max_points: maxPoints } : {}),
      ...(ultimate !== null ? { ultimate_points: ultimate } : {}),
      parent_id: null,
      ...(icon ? { icon } : {}),
    });
  }

  // `parent_id`: nodo no hijo de la misma familia con la columna más cercana por la izquierda.
  const local = (n: CatalogNode): string => n.id.slice(id.length + 1);
  const isChild = (n: CatalogNode): boolean => n.kind === 'modifier' || n.kind === 'transmuter';
  const roots = nodes.filter((n) => !isChild(n));
  for (const n of nodes) {
    if (!isChild(n)) continue;
    const fam = familyOf(local(n));
    const cands = roots
      .filter((r) => familyOf(local(r)) === fam && r.grid.col < n.grid.col)
      .sort(
        (a, b) =>
          b.grid.col - a.grid.col ||
          Math.abs(a.grid.row - n.grid.row) - Math.abs(b.grid.row - n.grid.row) ||
          cmp(a.id, b.id),
      );
    if (cands.length === 0) throw new Error(`${id}: sin padre para ${local(n)} (familia ${fam})`);
    n.parent_id = cands[0]!.id;
  }
  nodes.sort((a, b) => a.grid.col - b.grid.col || a.grid.row - b.grid.row || cmp(a.id, b.id));

  const desc = str(first(m, 'FileDescription'));
  if (!desc) throw new Error(`${id}: el registro de maestría no tiene FileDescription (slug)`);
  const slug = desc
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const name = str(first(m, 'skillDisplayName'));
  if (!name) throw new Error(`${id}: sin skillDisplayName`);
  return {
    mastery: { id, slug, name: nameOf(name) },
    game_version: meta.game_version,
    source: { game_version: meta.game_version, sha256: [...meta.sha256] },
    nodes,
  };
}

/** Construye los árboles de las maestrías pedidas (por defecto las 6 base), ordenados por id. */
export function buildCatalog(arz: Arz, opts: BuildOptions): CatalogTree[] {
  const tiers = (arz.read(ENGINE_RECORD).fields.get('skillMasteryTierLevel') ?? []).filter(
    (v): v is number => typeof v === 'number',
  );
  if (tiers.length === 0) throw new Error(`${ENGINE_RECORD}: sin skillMasteryTierLevel`);
  const ids = [...new Set(opts.masteries ?? BASE_MASTERIES)].sort();
  const meta = {
    game_version: opts.gameVersion,
    sha256: opts.sha256,
    localizer: opts.localizer,
  };
  return ids.map((id) => {
    const m = /^class(\d\d)$/.exec(id);
    if (!m) throw new Error(`id de maestría inválido: ${id}`);
    return readMastery(arz, tiers, m[1]!, meta);
  });
}

/** JSON canónico: array de árboles, orden de claves fijo, indentado, con salto final. */
export function serializeCatalog(c: readonly CatalogTree[]): string {
  return `${JSON.stringify(c, null, 2)}
`;
}

/** `buildid` de Steam del manifiesto contiguo (`<steamapps>/appmanifest_219990.acf`), si existe. */
export function steamVersion(gameDir: string): string | null {
  try {
    const acf = readFileSync(join(gameDir, '..', '..', 'appmanifest_219990.acf'), 'utf8');
    const id = /"buildid"\s+"(\d+)"/.exec(acf)?.[1];
    return id ? `steam-build-${id}` : null;
  } catch {
    return null;
  }
}

export interface ExtractOptions {
  readonly gameVersion?: string;
  readonly masteries?: readonly string[];
  /** T022: `false` (`--no-localize`) deja los tags y no lee los `.arc`. */
  readonly localize?: boolean;
  /** Aviso (por defecto stderr), p. ej. el conteo de fallbacks ES -> EN. */
  readonly warn?: (message: string) => void;
}

function readText(gameDir: string, file: string): Buffer {
  try {
    return readFileSync(join(gameDir, 'resources', file));
  } catch {
    throw new Error(
      `no se pudo leer resources/${file}: instala el juego completo o usa --no-localize`,
    );
  }
}

/** Lee `<gameDir>/database/database.arz` y `resources/Text_{EN,ES}.arc` (solo lectura) y devuelve el JSON. */
export function extractFromGameDir(gameDir: string, opts: ExtractOptions = {}): string {
  const buf = readFileSync(join(gameDir, 'database', 'database.arz'));
  const gameVersion = opts.gameVersion ?? steamVersion(gameDir);
  if (!gameVersion)
    throw new Error('no se pudo determinar la versión del juego: usa --game-version <texto>');
  const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
  const sha256 = [sha(buf)];
  let localizer: Localizer | undefined;
  if (opts.localize !== false) {
    const en = readText(gameDir, 'Text_EN.arc');
    const es = readText(gameDir, 'Text_ES.arc');
    sha256.push(sha(en), sha(es));
    localizer = createLocalizer(loadTags(new Arc(en)), loadTags(new Arc(es)));
  }
  const json = serializeCatalog(
    buildCatalog(new Arz(buf), {
      gameVersion,
      sha256,
      ...(opts.masteries ? { masteries: opts.masteries } : {}),
      ...(localizer ? { localizer } : {}),
    }),
  );
  if (localizer && localizer.fallbacks.size > 0) {
    const tags = [...localizer.fallbacks].sort();
    const shown = tags.slice(0, 10).join(', ') + (tags.length > 10 ? ', …' : '');
    (opts.warn ?? ((m: string) => console.error(m)))(
      `aviso: ${tags.length} etiqueta(s) sin texto en ES; se usa el de EN (${shown})`,
    );
  }
  return json;
}

function dump(r: ArzRecord): void {
  console.log(`## ${r.path}  [${r.type}]`);
  for (const [k, v] of r.fields) console.log(`${k} = ${v.join(', ')}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const opt = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const gameDir = opt('--game-dir') ?? process.env['GRIMDAWN_DIR'];
  if (!gameDir) {
    console.error(
      'uso: extract-mastery-trees.mts --game-dir <ruta> [--out <archivo>] [--game-version <texto>]\n' +
        '     [--no-localize]\n' +
        '     (o variable GRIMDAWN_DIR); --record <ruta-registro> para depurar',
    );
    process.exit(2);
  }
  const records = args.flatMap((a, i) => (a === '--record' ? [args[i + 1]!] : []));
  if (records.length) {
    const arz = new Arz(readFileSync(join(gameDir, 'database', 'database.arz')));
    for (const p of records) dump(arz.read(p));
    return;
  }
  const gameVersion = opt('--game-version');
  const json = extractFromGameDir(gameDir, {
    ...(gameVersion ? { gameVersion } : {}),
    ...(args.includes('--no-localize') ? { localize: false } : {}),
  });
  const out = opt('--out');
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
