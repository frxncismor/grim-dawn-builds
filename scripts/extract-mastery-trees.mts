// T001 (spec 003): esqueleto de extracción de `database.arz` de Grim Dawn.
// Solo lectura, solo `node:` builtins, escribe únicamente a stdout (nada en disco).
// Uso: node --import tsx scripts/extract-mastery-trees.mts --game-dir <ruta> [--record <ruta-registro>]...
import { readFileSync } from 'node:fs';
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

function dump(r: ArzRecord, only?: readonly string[]): void {
  console.log(`## ${r.path}  [${r.type}]`);
  for (const [k, v] of r.fields) {
    if (only && !only.includes(k)) continue;
    console.log(`${k} = ${v.join(', ')}`);
  }
}

const MASTERY_FIELDS = [
  'MasteryEnumeration',
  'FileDescription',
  'skillDisplayName',
  'skillBaseDescription',
  'skillMaxLevel',
  'skillMasteryLevelRequired',
  'skillUpBitmapName',
];
const UI_FIELDS = [
  'bitmapPositionX',
  'bitmapPositionY',
  'skillName',
  'skillOffsetX',
  'skillOffsetY',
  'isCircular',
];
const SKILL_FIELDS = [
  'Class',
  'skillDisplayName',
  'skillTier',
  'skillMaxLevel',
  'skillMasteryLevelRequired',
  'skillDependancy',
  'skillDependancy1',
  'skillDependancy2',
  'skillBaseName',
  'skillBaseDescription',
  'skillUltimateLevel',
  'skillCooldownTime',
];

function main(): void {
  const args = process.argv.slice(2);
  const gi = args.indexOf('--game-dir');
  if (gi < 0 || !args[gi + 1]) {
    console.error('uso: extract-mastery-trees.mts --game-dir <ruta> [--record <ruta>]...');
    process.exit(2);
  }
  const arz = new Arz(readFileSync(join(args[gi + 1]!, 'database', 'database.arz')));
  console.log(
    `# cabecera ${JSON.stringify(arz.header)} cadenas=${arz.strings.length} registros=${arz.entries.size}`,
  );
  const explicit = args.flatMap((a, i) => (a === '--record' ? [args[i + 1]!] : []));
  if (explicit.length) {
    for (const p of explicit) dump(arz.read(p));
    return;
  }
  const masteries = [...arz.entries.keys()]
    .filter((p) => /^records\/skills\/playerclass\d+\/_classtraining_class\d+\.dbr$/.test(p))
    .sort();
  console.log('# maestrías (registro -> FileDescription)');
  for (const p of masteries)
    console.log(`${p} -> ${arz.read(p).fields.get('FileDescription')?.[0] ?? '?'}`);
  const m = masteries[0];
  if (!m) throw new Error('no se encontró ninguna maestría');
  dump(arz.read(m), MASTERY_FIELDS);
  const num = /class(\d+)/.exec(m)![1]!;
  const uiRec = arz.read(`records/ui/skills/class${num}/skill11.dbr`);
  dump(uiRec, UI_FIELDS);
  dump(arz.read(uiRec.fields.get('skillName')![0] as string), SKILL_FIELDS);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
