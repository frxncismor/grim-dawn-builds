// T001/T006 (spec 003): extracción reproducible de los árboles de maestría desde el
// `database.arz` instalado de Grim Dawn. Solo lectura, solo `node:` builtins.
//
// Uso:
//   pnpm catalog:extract --game-dir <ruta> [--out <archivo>]   (o env GRIMDAWN_DIR)
//   ... --game-version <texto>    fuerza `source.game_version` (por defecto: buildid de Steam)
//   ... --record <ruta-registro>  (depuración, repetible) vuelca campos de un registro a stdout
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
  meta: { game_version: string; sha256: readonly string[] },
): CatalogTree {
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
      name: { en: tag, es: tag },
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
    mastery: { id, slug, name: { en: name, es: name } },
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
  const meta = { game_version: opts.gameVersion, sha256: opts.sha256 };
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
function steamVersion(gameDir: string): string | null {
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
}

/** Lee `<gameDir>/database/database.arz` (solo lectura) y devuelve el JSON del catálogo. */
export function extractFromGameDir(gameDir: string, opts: ExtractOptions = {}): string {
  const buf = readFileSync(join(gameDir, 'database', 'database.arz'));
  const gameVersion = opts.gameVersion ?? steamVersion(gameDir);
  if (!gameVersion)
    throw new Error('no se pudo determinar la versión del juego: usa --game-version <texto>');
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return serializeCatalog(
    buildCatalog(new Arz(buf), {
      gameVersion,
      sha256: [sha256],
      ...(opts.masteries ? { masteries: opts.masteries } : {}),
    }),
  );
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
  const json = extractFromGameDir(gameDir, gameVersion ? { gameVersion } : {});
  const out = opt('--out');
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
