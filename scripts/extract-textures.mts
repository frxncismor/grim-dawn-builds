// T028 (spec 003): extrae las texturas `.tex` de las maestrías y las habilidades a PNG en una
// carpeta gitignorada. Solo lectura del juego, solo `node:` builtins (Constitución IV).
//
// Uso:
//   pnpm catalog:textures --game-dir <ruta> [--out <carpeta>] [--kind masteries|skills|icons|all]  (all = masteries + skills; icons va aparte)
//   (o env GRIMDAWN_DIR; `--game-version <texto>` fuerza la versión; por defecto, el buildid de Steam)
//
// Por defecto `--out` es `.game-assets/textures/` en la raíz del repo (gitignorada) y `--kind` es
// `masteries`. Nada del juego se versiona (FR-014, Constitución VII): ni `.tex`, ni PNG.
// Determinista: PNG sin marcas de tiempo ni chunks opcionales, orden estable, mismo juego => mismos bytes.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  Arc,
  Arz,
  BASE_MASTERIES,
  buildCatalog,
  iconIdOf,
  steamVersion,
} from './extract-mastery-trees.mts';

// ---------------------------------------------------------------------------------------------
// Formato `.tex` (research.md §T028): 12 bytes de cabecera + un DDS cuyo «magic» es `DDSR`
// ---------------------------------------------------------------------------------------------

export interface DecodedTexture {
  readonly width: number;
  readonly height: number;
  /** Nombre del formato de píxel, p. ej. `DXT5` o `BGRA32`. */
  readonly format: string;
  /** RGBA de 8 bits por canal, fila a fila, solo el mip de mayor tamaño. */
  readonly rgba: Uint8Array;
}

const TEX_HEADER = 12;
const DDS_HEADER = 128; // magic (4) + DDS_HEADER (124)
const PF_ALPHAPIXELS = 0x1;
const PF_FOURCC = 0x4;
const PF_RGB = 0x40;

const expand5 = (v: number): number => (v << 3) | (v >> 2);
const expand6 = (v: number): number => (v << 2) | (v >> 4);

/** Colores de un bloque de color DXT (los 4 de la paleta); `alpha1` activa el modo DXT1 con 1 bit de alfa. */
function colorPalette(
  buf: Uint8Array,
  p: number,
  alpha1: boolean,
): { pal: number[][]; transparent: boolean } {
  const c0 = buf[p]! | (buf[p + 1]! << 8);
  const c1 = buf[p + 2]! | (buf[p + 3]! << 8);
  const rgb = (c: number): number[] => [
    expand5((c >> 11) & 31),
    expand6((c >> 5) & 63),
    expand5(c & 31),
    255,
  ];
  const a = rgb(c0);
  const b = rgb(c1);
  const mix = (x: number[], y: number[], wx: number, wy: number, d: number): number[] => [
    Math.floor((wx * x[0]! + wy * y[0]!) / d),
    Math.floor((wx * x[1]! + wy * y[1]!) / d),
    Math.floor((wx * x[2]! + wy * y[2]!) / d),
    255,
  ];
  if (!alpha1 || c0 > c1) {
    return { pal: [a, b, mix(a, b, 2, 1, 3), mix(a, b, 1, 2, 3)], transparent: false };
  }
  return { pal: [a, b, mix(a, b, 1, 1, 2), [0, 0, 0, 0]], transparent: true };
}

/** Decodifica una superficie comprimida con bloques de 4x4 (DXT1/DXT3/DXT5). */
function decodeBlocks(
  data: Uint8Array,
  w: number,
  h: number,
  format: 'DXT1' | 'DXT3' | 'DXT5',
): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  const bw = Math.ceil(w / 4);
  const bh = Math.ceil(h / 4);
  const blockBytes = format === 'DXT1' ? 8 : 16;
  if (data.length < bw * bh * blockBytes)
    throw new Error(`${format}: datos insuficientes (${data.length} < ${bw * bh * blockBytes})`);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const p = (by * bw + bx) * blockBytes;
      const cp = format === 'DXT1' ? p : p + 8;
      const { pal } = colorPalette(data, cp, format === 'DXT1');
      const bits =
        (data[cp + 4]! | (data[cp + 5]! << 8) | (data[cp + 6]! << 16) | (data[cp + 7]! << 24)) >>>
        0;
      const alpha: number[] = new Array<number>(16).fill(255);
      if (format === 'DXT3') {
        for (let i = 0; i < 16; i++) {
          const nib = (data[p + (i >> 1)]! >> ((i & 1) * 4)) & 15;
          alpha[i] = nib * 17;
        }
      } else if (format === 'DXT5') {
        const a0 = data[p]!;
        const a1 = data[p + 1]!;
        const tab: number[] = [a0, a1];
        if (a0 > a1) for (let k = 1; k <= 6; k++) tab.push(Math.floor(((7 - k) * a0 + k * a1) / 7));
        else {
          for (let k = 1; k <= 4; k++) tab.push(Math.floor(((5 - k) * a0 + k * a1) / 5));
          tab.push(0, 255);
        }
        let lo = data[p + 2]! | (data[p + 3]! << 8) | (data[p + 4]! << 16);
        let hi = data[p + 5]! | (data[p + 6]! << 8) | (data[p + 7]! << 16);
        for (let i = 0; i < 8; i++) {
          alpha[i] = tab[lo & 7]!;
          alpha[i + 8] = tab[hi & 7]!;
          lo >>= 3;
          hi >>= 3;
        }
      }
      for (let i = 0; i < 16; i++) {
        const x = bx * 4 + (i & 3);
        const y = by * 4 + (i >> 2);
        if (x >= w || y >= h) continue;
        const c = pal[(bits >>> (2 * i)) & 3]!;
        const o = (y * w + x) * 4;
        out[o] = c[0]!;
        out[o + 1] = c[1]!;
        out[o + 2] = c[2]!;
        out[o + 3] = format === 'DXT1' ? c[3]! : alpha[i]!;
      }
    }
  }
  return out;
}

/** Sin comprimir de 24/32 bits: el juego los guarda como BGR(A) sin máscaras (research §T028). */
function decodeRaw(data: Uint8Array, w: number, h: number, bits: 24 | 32): Uint8Array {
  const bpp = bits / 8;
  if (data.length < w * h * bpp)
    throw new Error(`BGR${bits}: datos insuficientes (${data.length} < ${w * h * bpp})`);
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp;
    out[i * 4] = data[s + 2]!;
    out[i * 4 + 1] = data[s + 1]!;
    out[i * 4 + 2] = data[s]!;
    out[i * 4 + 3] = bits === 32 ? data[s + 3]! : 255;
  }
  return out;
}

/**
 * Decodifica un `.tex` de Grim Dawn (solo el mip de mayor tamaño). Un formato no soportado
 * lanza un error con el `name` de la textura y el formato (FourCC o bits por píxel).
 */
export function decodeTex(buf: Uint8Array, name = '<textura>'): DecodedTexture {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < TEX_HEADER + DDS_HEADER || b.toString('latin1', 0, 3) !== 'TEX')
    throw new Error(`${name}: no es un .tex (se esperaba la cabecera "TEX")`);
  if (b[3] !== 2) throw new Error(`${name}: versión de .tex no soportada (${b[3]})`);
  if (b.readUInt32LE(8) !== b.length - TEX_HEADER)
    throw new Error(`${name}: tamaño de carga inconsistente en la cabecera del .tex`);
  const magic = b.toString('latin1', 12, 16);
  if (magic !== 'DDSR' && magic !== 'DDS ')
    throw new Error(`${name}: DDS embebido inválido (magic ${JSON.stringify(magic)})`);
  if (b.readUInt32LE(16) !== 124) throw new Error(`${name}: cabecera DDS inválida`);
  const height = b.readUInt32LE(24);
  const width = b.readUInt32LE(28);
  if (width === 0 || height === 0) throw new Error(`${name}: dimensiones inválidas`);
  const pfFlags = b.readUInt32LE(92);
  const data = b.subarray(TEX_HEADER + DDS_HEADER);
  if (pfFlags & PF_FOURCC) {
    const cc = b.toString('latin1', 96, 100);
    if (cc !== 'DXT1' && cc !== 'DXT3' && cc !== 'DXT5')
      throw new Error(`${name}: formato no soportado (FourCC ${JSON.stringify(cc)})`);
    return { width, height, format: cc, rgba: decodeBlocks(data, width, height, cc) };
  }
  if (pfFlags & (PF_RGB | PF_ALPHAPIXELS)) {
    const bits = b.readUInt32LE(100);
    if (bits !== 24 && bits !== 32)
      throw new Error(`${name}: formato no soportado (sin comprimir, ${bits} bits por píxel)`);
    return {
      width,
      height,
      format: `BGR${bits === 32 ? 'A32' : '24'}`,
      rgba: decodeRaw(data, width, height, bits),
    };
  }
  throw new Error(`${name}: formato no soportado (flags de píxel 0x${pfFlags.toString(16)})`);
}

// ---------------------------------------------------------------------------------------------
// PNG (RGBA, 8 bits, sin entrelazado, filtro 0, un solo IDAT, sin chunks opcionales)
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== width * height * 4) throw new Error('PNG: tamaño de RGBA inconsistente');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height); // filtro 0 en cada fila
  for (let y = 0; y < height; y++)
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------------------------
// Extracción
// ---------------------------------------------------------------------------------------------

export type TextureKind = 'masteries' | 'skills' | 'icons' | 'all';

/** Tamaño de los iconos de habilidad del juego (spec004 T026); otro tamaño es un error, no se remuestrea. */
export const SKILL_ICON_SIZE = 32;

export interface ManifestEntry {
  /** Slug de la maestría (`masteries`), id del nodo `classNN/<registro>` (`skills`) o `icon_id` (`icons`). */
  readonly slug?: string;
  readonly id?: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly sourcePath: string;
  /** SHA-256 del PNG generado. */
  readonly sha256: string;
  /** SHA-256 del `.tex` de origen. */
  readonly sourceSha256: string;
}

export interface TextureManifest {
  readonly version: 1;
  readonly source: {
    readonly game_version: string;
    readonly sha256: { readonly 'database.arz': string; readonly 'UI.arc': string };
  };
  readonly masteries: readonly ManifestEntry[];
  readonly skills: readonly ManifestEntry[];
  /** Un icono por textura única, nombrado por su `icon_id` público (spec004 T025/T026). */
  readonly icons: readonly ManifestEntry[];
}

export interface TextureJob {
  readonly group: 'masteries' | 'skills' | 'icons';
  readonly key: string; // slug o id del nodo
  readonly outPath: string; // relativa a `out`, con `/`
  readonly sourcePath: string; // ruta del registro, p. ej. `ui/skills/...tex`
}

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Trabajos de extracción derivados del `.arz`: texturas de las maestrías y de los nodos del catálogo. */
export function collectJobs(
  arz: Arz,
  kind: TextureKind,
  masteries: readonly string[] = BASE_MASTERIES,
): TextureJob[] {
  const trees = buildCatalog(arz, { gameVersion: 'x', sha256: [], masteries });
  const jobs: TextureJob[] = [];
  for (const t of trees) {
    if (kind === 'masteries' || kind === 'all') {
      const rec = arz.read(
        `records/skills/player${t.mastery.id}/_classtraining_${t.mastery.id}.dbr`,
      );
      const src = str(rec.fields.get('skillUpBitmapName')?.[0]);
      if (!src)
        throw new Error(`${t.mastery.id}: sin skillUpBitmapName en el registro de maestría`);
      jobs.push({
        group: 'masteries',
        key: t.mastery.slug,
        outPath: `masteries/${t.mastery.slug}.png`,
        sourcePath: src,
      });
    }
    if (kind === 'skills' || kind === 'all') {
      for (const n of t.nodes) {
        if (!n.icon) continue; // nodo sin `skillUpBitmapName`: no hay textura referenciada
        jobs.push({
          group: 'skills',
          key: n.id,
          outPath: `skills/${t.mastery.slug}/${n.id.slice(n.id.indexOf('/') + 1)}.png`,
          sourcePath: n.icon,
        });
      }
    }
  }
  if (kind === 'icons') {
    // Un icono por textura única: los nodos que comparten textura comparten icon_id (S-004: el id
    // público no es la ruta de textura).
    const seen = new Set<string>();
    for (const t of trees)
      for (const n of t.nodes) {
        if (!n.icon || seen.has(n.icon)) continue;
        seen.add(n.icon);
        const id = iconIdOf(n.icon);
        jobs.push({ group: 'icons', key: id, outPath: `icons/${id}.png`, sourcePath: n.icon });
      }
  }
  return jobs.sort((a, b) => cmp(a.outPath, b.outPath));
}

export interface RenderedTexture {
  readonly job: TextureJob;
  readonly png: Buffer;
  readonly width: number;
  readonly height: number;
  readonly sourceSha256: string;
}

/**
 * Lee, decodifica y codifica cada trabajo. Una textura ausente del `.arc` se cuenta y se avisa,
 * y se continúa; si no queda ninguna, falla. Un formato no soportado falla con el nombre.
 */
export function renderJobs(
  arc: Arc,
  jobs: readonly TextureJob[],
  warn: (message: string) => void = (m) => console.error(m),
): RenderedTexture[] {
  // Los nombres de los registros no respetan mayúsculas respecto a los del `.arc`; el `.arc` no lleva `ui/`.
  const byLower = new Map<string, string>();
  for (const name of arc.files.keys()) byLower.set(name.toLowerCase(), name);
  const out: RenderedTexture[] = [];
  const missing: string[] = [];
  for (const job of jobs) {
    const real = byLower.get(job.sourcePath.toLowerCase().replace(/^ui\//, ''));
    if (!real) {
      missing.push(job.sourcePath);
      continue;
    }
    const tex = arc.read(real);
    const d = decodeTex(tex, job.sourcePath);
    if (job.group === 'icons' && (d.width !== SKILL_ICON_SIZE || d.height !== SKILL_ICON_SIZE))
      throw new Error(
        `${job.sourcePath}: un icono mide ${SKILL_ICON_SIZE} x ${SKILL_ICON_SIZE}, no ${d.width} x ${d.height}`,
      );
    out.push({
      job,
      png: encodePng(d.width, d.height, d.rgba),
      width: d.width,
      height: d.height,
      sourceSha256: sha(tex),
    });
  }
  if (missing.length > 0) {
    const shown = [...new Set(missing)].sort().slice(0, 5).join(', ');
    warn(
      `aviso: ${missing.length} textura(s) referenciada(s) y ausente(s) del UI.arc (${shown}${missing.length > 5 ? ', …' : ''})`,
    );
  }
  if (out.length === 0) throw new Error('ninguna textura referenciada existe en el UI.arc');
  return out;
}

export function buildManifest(
  rendered: readonly RenderedTexture[],
  source: TextureManifest['source'],
): TextureManifest {
  const entry = (r: RenderedTexture): ManifestEntry => ({
    ...(r.job.group === 'masteries' ? { slug: r.job.key } : { id: r.job.key }),
    path: r.job.outPath,
    width: r.width,
    height: r.height,
    sourcePath: r.job.sourcePath,
    sha256: sha(r.png),
    sourceSha256: r.sourceSha256,
  });
  const of = (g: 'masteries' | 'skills' | 'icons'): ManifestEntry[] =>
    rendered
      .filter((r) => r.job.group === g)
      .sort((a, b) => cmp(a.job.outPath, b.job.outPath))
      .map(entry);
  return {
    version: 1,
    source,
    masteries: of('masteries'),
    skills: of('skills'),
    icons: of('icons'),
  };
}

const NOTICE =
  'Texturas extraídas localmente de una copia legal de Grim Dawn (c) Crate Entertainment.\n' +
  'No se versionan ni se redistribuyen: esta carpeta está en .gitignore (Constitución VII, FR-014).\n' +
  'Este proyecto no está afiliado ni respaldado por Crate Entertainment.\n';

export interface ExtractTexturesOptions {
  readonly out: string;
  readonly kind?: TextureKind;
  readonly gameVersion?: string;
  readonly warn?: (message: string) => void;
  /** Maestrías a extraer (por defecto, las 6 base); las pruebas usan una sola. */
  readonly masteries?: readonly string[];
}

/** Lee `database.arz` y `resources/UI.arc` (solo lectura) y escribe los PNG, `manifest.json` y `NOTICE.txt` en `out`. */
export function extractTextures(gameDir: string, opts: ExtractTexturesOptions): TextureManifest {
  const kind = opts.kind ?? 'masteries';
  const arzBuf = readFileSync(join(gameDir, 'database', 'database.arz'));
  const gameVersion = opts.gameVersion ?? steamVersion(gameDir);
  if (!gameVersion)
    throw new Error('no se pudo determinar la versión del juego: usa --game-version <texto>');
  let uiBuf: Buffer;
  try {
    uiBuf = readFileSync(join(gameDir, 'resources', 'UI.arc'));
  } catch {
    throw new Error('no se pudo leer resources/UI.arc: instala el juego completo');
  }
  const jobs = collectJobs(new Arz(arzBuf), kind, opts.masteries);
  const rendered = renderJobs(new Arc(uiBuf), jobs, opts.warn);
  const manifest = buildManifest(rendered, {
    game_version: gameVersion,
    sha256: { 'database.arz': sha(arzBuf), 'UI.arc': sha(uiBuf) },
  });
  for (const r of rendered) {
    const file = join(opts.out, ...r.job.outPath.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, r.png);
  }
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(opts.out, 'NOTICE.txt'), NOTICE);
  return manifest;
}

const DEFAULT_OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.game-assets',
  'textures',
);

function main(): void {
  const args = process.argv.slice(2);
  const opt = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const gameDir = opt('--game-dir') ?? process.env['GRIMDAWN_DIR'];
  const kind = opt('--kind') ?? 'masteries';
  if (
    !gameDir ||
    (kind !== 'masteries' && kind !== 'skills' && kind !== 'icons' && kind !== 'all')
  ) {
    console.error(
      'uso: extract-textures.mts --game-dir <ruta> [--out <carpeta>] [--kind masteries|skills|all]\n' +
        '     [--game-version <texto>]  (o variable GRIMDAWN_DIR)\n' +
        '     por defecto: --kind masteries, --out .game-assets/textures (gitignorada)',
    );
    process.exit(2);
  }
  const out = resolve(opt('--out') ?? DEFAULT_OUT);
  const gameVersion = opt('--game-version');
  const m = extractTextures(gameDir, {
    out,
    kind,
    ...(gameVersion ? { gameVersion } : {}),
  });
  console.error(
    `ok: ${m.masteries.length} maestría(s), ${m.skills.length} habilidad(es) y ${m.icons.length} icono(s) en ${out}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
