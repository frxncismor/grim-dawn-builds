// T028 (spec 003): pruebas del extractor de texturas. Todo sintético: ningún píxel, `.tex`, `.arc`
// ni `.arz` real del juego; la prueba opcional con el juego escribe solo en una carpeta temporal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32 as zlibCrc32, inflateSync } from 'node:zlib';
import { Arc, Arz, iconIdOf } from './extract-mastery-trees.mts';
import {
  buildManifest,
  collectJobs,
  crc32,
  decodeTex,
  encodePng,
  extractTextures,
  renderJobs,
} from './extract-textures.mts';

// --- constructores sintéticos ----------------------------------------------------------------

/** `.tex` de Grim Dawn: `TEX\x02`, 4 ceros, tamaño de la carga y un DDS cuyo magic es `DDSR`. */
function buildTex(opts: {
  width: number;
  height: number;
  fourCC?: string;
  bits?: number;
  pfFlags?: number;
  data: Uint8Array;
}): Buffer {
  const dds = Buffer.alloc(128);
  dds.write('DDSR', 0, 'latin1');
  dds.writeUInt32LE(124, 4);
  dds.writeUInt32LE(0x1007, 8);
  dds.writeUInt32LE(opts.height, 12);
  dds.writeUInt32LE(opts.width, 16);
  dds.writeUInt32LE(1, 28); // mips
  dds.writeUInt32LE(32, 76); // tamaño de DDS_PIXELFORMAT
  if (opts.fourCC) {
    dds.writeUInt32LE(0x4, 80);
    dds.write(opts.fourCC, 84, 'latin1');
  } else {
    dds.writeUInt32LE(opts.pfFlags ?? 0x40, 80);
    dds.writeUInt32LE(opts.bits ?? 32, 88);
  }
  const head = Buffer.alloc(12);
  head.write('TEX', 0, 'latin1');
  head[3] = 2;
  head.writeUInt32LE(128 + opts.data.length, 8);
  return Buffer.concat([head, dds, opts.data]);
}

const rgb565 = (r: number, g: number, b: number): number =>
  ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
const u16 = (v: number): number[] => [v & 255, v >> 8];
/** Índices de color de 16 píxeles (fila a fila) en 4 bytes, 2 bits por píxel. */
function indices(px: readonly number[]): number[] {
  let bits = 0;
  px.forEach((v, i) => (bits |= v << (2 * i)));
  return [bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255];
}

const RED = rgb565(255, 0, 0); // 255,0,0
const BLUE = rgb565(0, 0, 255);
// Fila a fila: 0 = c0, 1 = c1, 2 = 2/3 c0 + 1/3 c1, 3 = 1/3 c0 + 2/3 c1
const SEL = [0, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 0, 3, 2, 1, 0];
const colorBlock = (c0: number, c1: number): number[] => [...u16(c0), ...u16(c1), ...indices(SEL)];
const EXPECT_RGB: Record<number, number[]> = {
  0: [255, 0, 0],
  1: [0, 0, 255],
  2: [170, 0, 85],
  3: [85, 0, 170],
};

const pixel = (rgba: Uint8Array, w: number, x: number, y: number): number[] => [
  ...rgba.subarray((y * w + x) * 4, (y * w + x) * 4 + 4),
];

// --- DDS ---------------------------------------------------------------------------------------

test('decodeTex DXT1: paleta de 4 colores con píxeles conocidos', () => {
  const tex = buildTex({
    width: 4,
    height: 4,
    fourCC: 'DXT1',
    data: Uint8Array.from(colorBlock(RED, BLUE)), // c0 > c1: sin transparencia
  });
  const d = decodeTex(tex, 'sintetica.tex');
  assert.equal(d.format, 'DXT1');
  assert.deepEqual([d.width, d.height], [4, 4]);
  SEL.forEach((sel, i) =>
    assert.deepEqual(pixel(d.rgba, 4, i & 3, i >> 2), [...EXPECT_RGB[sel]!, 255], `píxel ${i}`),
  );
});

test('decodeTex DXT1: c0 <= c1 da el punto medio y el índice 3 transparente', () => {
  const tex = buildTex({
    width: 4,
    height: 4,
    fourCC: 'DXT1',
    data: Uint8Array.from(colorBlock(BLUE, RED)), // c0 < c1
  });
  const d = decodeTex(tex);
  // BLUE=c0, RED=c1: índice 0 -> azul, 1 -> rojo, 2 -> mezcla 1/2, 3 -> transparente
  assert.deepEqual(pixel(d.rgba, 4, 0, 0), [0, 0, 255, 255]);
  assert.deepEqual(pixel(d.rgba, 4, 1, 0), [255, 0, 0, 255]);
  assert.deepEqual(pixel(d.rgba, 4, 2, 0), [127, 0, 127, 255]);
  assert.deepEqual(pixel(d.rgba, 4, 3, 0), [0, 0, 0, 0]);
});

test('decodeTex DXT5: alfa interpolada de 8 valores (a0 > a1) y color del bloque', () => {
  // índices de alfa 0..7 en 3 bits: píxel i usa el índice i % 8
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 8; i++) {
    lo |= (i % 8) << (3 * i);
    hi |= (i % 8) << (3 * i);
  }
  const alpha = [
    255,
    0,
    lo & 255,
    (lo >> 8) & 255,
    (lo >> 16) & 255,
    hi & 255,
    (hi >> 8) & 255,
    (hi >> 16) & 255,
  ];
  const tex = buildTex({
    width: 4,
    height: 4,
    fourCC: 'DXT5',
    data: Uint8Array.from([...alpha, ...colorBlock(RED, BLUE)]),
  });
  const d = decodeTex(tex);
  assert.equal(d.format, 'DXT5');
  // tabla con a0=255, a1=0: [255, 0, 218, 182, 145, 109, 72, 36]
  const table = [255, 0, 218, 182, 145, 109, 72, 36];
  for (let i = 0; i < 16; i++) {
    const p = pixel(d.rgba, 4, i & 3, i >> 2);
    assert.deepEqual(p.slice(0, 3), EXPECT_RGB[SEL[i]!]);
    assert.equal(p[3], table[i % 8], `alfa del píxel ${i}`);
  }
});

test('decodeTex DXT5: a0 <= a1 usa 6 valores más 0 y 255', () => {
  const tex = buildTex({
    width: 4,
    height: 4,
    fourCC: 'DXT5',
    // a0=10, a1=200, índices 6 y 7 -> 0 y 255 en los píxeles 0 y 1
    data: Uint8Array.from([10, 200, 6 | (7 << 3), 0, 0, 0, 0, 0, ...colorBlock(RED, BLUE)]),
  });
  const d = decodeTex(tex);
  assert.equal(pixel(d.rgba, 4, 0, 0)[3], 0);
  assert.equal(pixel(d.rgba, 4, 1, 0)[3], 255);
  assert.equal(pixel(d.rgba, 4, 2, 0)[3], 10); // índice 0 = a0
});

test('decodeTex DXT3: alfa explícita de 4 bits', () => {
  const alpha = Array.from({ length: 8 }, (_, i) => ((2 * i + 1) << 4) | (2 * i)); // nibbles 0..15
  const tex = buildTex({
    width: 4,
    height: 4,
    fourCC: 'DXT3',
    data: Uint8Array.from([...alpha, ...colorBlock(RED, BLUE)]),
  });
  const d = decodeTex(tex);
  for (let i = 0; i < 16; i++) assert.equal(pixel(d.rgba, 4, i & 3, i >> 2)[3], i * 17);
});

test('decodeTex DXT: dimensiones que no son múltiplo de 4 recortan los bloques', () => {
  const block = colorBlock(RED, BLUE);
  const tex = buildTex({
    width: 5,
    height: 2,
    fourCC: 'DXT1',
    data: Uint8Array.from([...block, ...block]), // 2x1 bloques
  });
  const d = decodeTex(tex);
  assert.equal(d.rgba.length, 5 * 2 * 4);
  assert.deepEqual(pixel(d.rgba, 5, 4, 1), [...EXPECT_RGB[SEL[4]!]!, 255]); // bloque 2, píxel (0,1)
});

test('decodeTex sin comprimir: BGRA32 y BGR24 se convierten a RGBA', () => {
  const bgra = buildTex({
    width: 2,
    height: 1,
    bits: 32,
    data: Uint8Array.from([3, 2, 1, 200, 30, 20, 10, 0]), // B,G,R,A
  });
  const a = decodeTex(bgra);
  assert.equal(a.format, 'BGRA32');
  assert.deepEqual([...a.rgba], [1, 2, 3, 200, 10, 20, 30, 0]);
  const bgr = buildTex({
    width: 2,
    height: 1,
    bits: 24,
    data: Uint8Array.from([3, 2, 1, 6, 5, 4]),
  });
  const b = decodeTex(bgr);
  assert.equal(b.format, 'BGR24');
  assert.deepEqual([...b.rgba], [1, 2, 3, 255, 4, 5, 6, 255]);
});

test('decodeTex: FourCC no soportado falla con el nombre de la textura y el formato', () => {
  const tex = buildTex({ width: 4, height: 4, fourCC: 'ATI2', data: new Uint8Array(16) });
  assert.throws(
    () => decodeTex(tex, 'ui/skills/falsa.tex'),
    /ui\/skills\/falsa\.tex.*formato no soportado.*ATI2/,
  );
  const bad = buildTex({ width: 1, height: 1, bits: 16, data: new Uint8Array(2) });
  assert.throws(() => decodeTex(bad, 'x.tex'), /x\.tex.*16 bits/);
});

test('decodeTex: cabeceras inválidas fallan con el nombre', () => {
  const ok = buildTex({ width: 1, height: 1, bits: 32, data: new Uint8Array(4) });
  assert.throws(() => decodeTex(Buffer.from('nope'), 'a.tex'), /a\.tex.*no es un \.tex/);
  const v = Buffer.from(ok);
  v[3] = 9;
  assert.throws(() => decodeTex(v, 'b.tex'), /b\.tex.*versión/);
  const s = Buffer.from(ok);
  s.writeUInt32LE(5, 8);
  assert.throws(() => decodeTex(s, 'c.tex'), /c\.tex.*tamaño/);
  const m = Buffer.from(ok);
  m.write('XXXX', 12, 'latin1');
  assert.throws(() => decodeTex(m, 'd.tex'), /d\.tex.*DDS/);
  const trunc = buildTex({ width: 4, height: 4, fourCC: 'DXT1', data: new Uint8Array(4) });
  assert.throws(() => decodeTex(trunc, 'e.tex'), /DXT1.*insuficientes/);
});

// --- PNG ---------------------------------------------------------------------------------------

/** Lector de PNG mínimo de la prueba: valida firma, orden de chunks y CRC; devuelve IHDR y píxeles. */
function readPng(png: Buffer): { width: number; height: number; rgba: Buffer; types: string[] } {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const types: string[] = [];
  const idat: Buffer[] = [];
  let ihdr!: Buffer;
  let p = 8;
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString('latin1', p + 4, p + 8);
    const body = png.subarray(p + 8, p + 8 + len);
    assert.equal(
      png.readUInt32BE(p + 8 + len),
      zlibCrc32(png.subarray(p + 4, p + 8 + len)),
      `CRC de ${type}`,
    );
    types.push(type);
    if (type === 'IHDR') ihdr = body;
    if (type === 'IDAT') idat.push(body);
    p += 12 + len;
  }
  assert.equal(p, png.length);
  assert.equal(ihdr.length, 13);
  assert.deepEqual([...ihdr.subarray(8)], [8, 6, 0, 0, 0]); // 8 bits, RGBA, sin entrelazado
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const raw = inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, (width * 4 + 1) * height);
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (width * 4 + 1)], 0, 'filtro 0');
    raw.copy(rgba, y * width * 4, y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1));
  }
  return { width, height, rgba, types };
}

test('crc32 propio coincide con zlib.crc32 y con el vector estándar', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const data = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 37) & 255));
  assert.equal(crc32(data), zlibCrc32(data));
});

test('encodePng: PNG válido (firma, IHDR, CRC) que decodifica a los mismos píxeles', () => {
  const rgba = Uint8Array.from(Array.from({ length: 3 * 2 * 4 }, (_, i) => (i * 11) & 255));
  const out = readPng(encodePng(3, 2, rgba));
  assert.deepEqual([out.width, out.height], [3, 2]);
  assert.deepEqual(out.types, ['IHDR', 'IDAT', 'IEND']); // sin tIME, tEXt ni otros chunks variables
  assert.deepEqual([...out.rgba], [...rgba]);
  assert.throws(() => encodePng(2, 2, new Uint8Array(3)), /inconsistente/);
});

test('encodePng: determinista (mismos bytes en dos ejecuciones)', () => {
  const rgba = Uint8Array.from(Array.from({ length: 64 * 64 * 4 }, (_, i) => (i * i) & 255));
  assert.ok(encodePng(64, 64, rgba).equals(encodePng(64, 64, rgba)));
});

// --- .arc/.arz sintéticos y extracción de extremo a extremo ----------------------------------

/** Bloque LZ4 con una sola secuencia de literales. */
function lz4Literals(data: Uint8Array): Buffer {
  const parts: number[] = [];
  let lit = data.length;
  if (lit < 15) parts.push(lit << 4);
  else {
    parts.push(15 << 4);
    lit -= 15;
    while (lit >= 255) {
      parts.push(255);
      lit -= 255;
    }
    parts.push(lit);
  }
  return Buffer.concat([Buffer.from(parts), data]);
}

/** `.arc` v3 mínimo (mismo formato que el del juego; ver research.md §T022). */
function buildArc(files: readonly { name: string; content: Buffer }[]): Buffer {
  const header = Buffer.alloc(2048);
  const blocks: Buffer[] = [];
  const parts: Buffer[] = [];
  const recs: Buffer[] = [];
  let names = '';
  let offset = 2048;
  for (const [i, f] of files.entries()) {
    const comp = lz4Literals(f.content);
    blocks.push(comp);
    const part = Buffer.alloc(12);
    part.writeUInt32LE(offset, 0);
    part.writeUInt32LE(comp.length, 4);
    part.writeUInt32LE(f.content.length, 8);
    parts.push(part);
    const r = Buffer.alloc(44);
    r.writeUInt32LE(3, 0);
    r.writeUInt32LE(offset, 4);
    r.writeUInt32LE(comp.length, 8);
    r.writeUInt32LE(f.content.length, 12);
    r.writeUInt32LE(1, 28);
    r.writeUInt32LE(i, 32);
    r.writeUInt32LE(f.name.length, 36);
    r.writeUInt32LE(names.length, 40);
    names += f.name;
    recs.push(r);
    offset += comp.length;
  }
  const partTable = Buffer.concat(parts);
  header.write('ARC\0', 0, 'latin1');
  header.writeUInt32LE(3, 4);
  header.writeUInt32LE(files.length, 8);
  header.writeUInt32LE(files.length, 12);
  header.writeUInt32LE(partTable.length, 16);
  header.writeUInt32LE(names.length, 20);
  header.writeUInt32LE(offset, 24);
  return Buffer.concat([header, ...blocks, partTable, Buffer.from(names, 'latin1'), ...recs]);
}

type Fields = Record<string, number | string | readonly number[]>;
interface Rec {
  readonly path: string;
  readonly fields: Fields;
}

/** `.arz` mínimo (campos enteros, listas de enteros y cadenas). */
function buildArz(records: readonly Rec[]): Buffer {
  const strings: string[] = [];
  const idx = new Map<string, number>();
  const sid = (s: string): number => {
    let i = idx.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      idx.set(s, i);
    }
    return i;
  };
  const blocks: Buffer[] = [];
  const meta: { path: number; offset: number; comp: number; size: number }[] = [];
  let offset = 0;
  for (const r of records) {
    const chunks: Buffer[] = [];
    for (const [key, raw] of Object.entries(r.fields)) {
      const vals = Array.isArray(raw) ? (raw as readonly number[]) : [raw as number | string];
      const isStr = typeof vals[0] === 'string';
      const head = Buffer.alloc(8);
      head.writeUInt16LE(isStr ? 2 : 0, 0);
      head.writeUInt16LE(vals.length, 2);
      head.writeUInt32LE(sid(key), 4);
      const body = Buffer.alloc(4 * vals.length);
      vals.forEach((v, i) =>
        isStr ? body.writeUInt32LE(sid(v as string), 4 * i) : body.writeInt32LE(v as number, 4 * i),
      );
      chunks.push(head, body);
    }
    const plain = Buffer.concat(chunks);
    const comp = lz4Literals(plain);
    meta.push({ path: sid(r.path), offset, comp: comp.length, size: plain.length });
    blocks.push(comp);
    offset += comp.length;
  }
  const data = Buffer.concat(blocks);
  const recTable = Buffer.concat(
    meta.map((m) => {
      const t = Buffer.alloc(8 + 12 + 8);
      t.writeUInt32LE(m.path, 0);
      t.writeUInt32LE(0, 4);
      t.writeUInt32LE(m.offset, 8);
      t.writeUInt32LE(m.comp, 12);
      t.writeUInt32LE(m.size, 16);
      return t;
    }),
  );
  const strParts: Buffer[] = [Buffer.alloc(4)];
  strParts[0]!.writeUInt32LE(strings.length, 0);
  for (const s of strings) {
    const l = Buffer.alloc(4);
    l.writeUInt32LE(s.length, 0);
    strParts.push(l, Buffer.from(s, 'latin1'));
  }
  const strTable = Buffer.concat(strParts);
  const header = Buffer.alloc(24);
  header.writeUInt16LE(2, 0);
  header.writeUInt16LE(3, 2);
  header.writeUInt32LE(24 + data.length, 4);
  header.writeUInt32LE(recTable.length, 8);
  header.writeUInt32LE(records.length, 12);
  header.writeUInt32LE(24 + data.length + recTable.length, 16);
  header.writeUInt32LE(strTable.length, 20);
  return Buffer.concat([header, data, recTable, strTable]);
}

const ONE = ['class01'];
const SK = 'records/skills/playerclass01/';
const TEX_UP = 'ui/skills/skillallocation/skills_class01trainingbuttonup.tex';
const ICON = 'ui/skills/icons/class01/skillicon_cadence1up.tex';
const ICON_MISSING = 'ui/skills/icons/class01/skillicon_gone1up.tex';

const syntheticArz = (): Buffer =>
  buildArz([
    { path: 'records/game/gameengine.dbr', fields: { skillMasteryTierLevel: [1, 5, 10] } },
    {
      path: `${SK}_classtraining_class01.dbr`,
      fields: {
        FileDescription: 'Soldier',
        skillDisplayName: 'tagClass01SkillName00A',
        skillUpBitmapName: TEX_UP,
      },
    },
    ...[
      [11, 246, 39, 'cadence1'],
      [12, 246, 179, 'gone1'],
    ].map(([n, x, y, id]) => ({
      path: `records/ui/skills/class01/skill${n}.dbr`,
      fields: {
        bitmapPositionX: x as number,
        bitmapPositionY: y as number,
        skillName: `${SK}${id}.dbr`,
      },
    })),
    ...[
      ['cadence1', ICON],
      ['gone1', ICON_MISSING],
    ].map(([id, icon]) => ({
      path: `${SK}${id}.dbr`,
      fields: {
        Class: 'Skill_AttackWeapon',
        skillDisplayName: `tag_${id}`,
        skillTier: 1,
        skillMaxLevel: 12,
        skillUpBitmapName: icon!,
      },
    })),
  ]);

const dxt1 = (w: number, h: number): Buffer =>
  buildTex({
    width: w,
    height: h,
    fourCC: 'DXT1',
    data: Uint8Array.from(colorBlock(RED, BLUE)),
  });

// El `.arc` guarda los nombres sin `ui/` y con las mayúsculas del archivo.
const syntheticArc = (extra: readonly { name: string; content: Buffer }[] = []): Buffer =>
  buildArc([
    { name: 'Skills/SkillAllocation/skills_class01trainingbuttonup.tex', content: dxt1(4, 4) },
    {
      name: 'skills/icons/class01/skillicon_cadence1up.tex',
      content: buildTex({
        width: 2,
        height: 1,
        bits: 32,
        data: Uint8Array.from([3, 2, 1, 200, 30, 20, 10, 0]),
      }),
    },
    ...extra,
  ]);

async function fakeGame(arc: Buffer = syntheticArc()): Promise<{ root: string; game: string }> {
  const root = await mkdtemp(join(tmpdir(), 'gdb-t028-test-'));
  const game = join(root, 'game');
  await mkdir(join(game, 'database'), { recursive: true });
  await mkdir(join(game, 'resources'), { recursive: true });
  await writeFile(join(game, 'database', 'database.arz'), syntheticArz());
  await writeFile(join(game, 'resources', 'UI.arc'), arc);
  return { root, game };
}

test('collectJobs: rutas y nombres deterministas a partir de los registros', () => {
  const arz = new Arz(syntheticArz());
  assert.deepEqual(
    collectJobs(arz, 'masteries', ONE).map((j) => [j.group, j.key, j.outPath, j.sourcePath]),
    [['masteries', 'soldier', 'masteries/soldier.png', TEX_UP]],
  );
  assert.deepEqual(
    collectJobs(arz, 'skills', ONE).map((j) => [j.key, j.outPath]),
    [
      ['class01/cadence1', 'skills/soldier/cadence1.png'],
      ['class01/gone1', 'skills/soldier/gone1.png'],
    ],
  );
  assert.equal(collectJobs(arz, 'all', ONE).length, 3);
});

test('renderJobs: busca sin `ui/` ni distinguir mayúsculas; avisa de las ausentes y continúa', () => {
  const warns: string[] = [];
  const rendered = renderJobs(
    new Arc(syntheticArc()),
    collectJobs(new Arz(syntheticArz()), 'all', ONE),
    (m) => warns.push(m),
  );
  assert.deepEqual(
    rendered.map((r) => r.job.outPath),
    ['masteries/soldier.png', 'skills/soldier/cadence1.png'],
  );
  assert.equal(warns.length, 1);
  assert.match(warns[0]!, /1 textura\(s\).*ausente.*skillicon_gone1up\.tex/);
  const icon = readPng(rendered[1]!.png);
  assert.deepEqual([...icon.rgba], [1, 2, 3, 200, 10, 20, 30, 0]);
});

test('renderJobs: si no existe ninguna textura referenciada, falla', () => {
  assert.throws(
    () =>
      renderJobs(
        new Arc(buildArc([{ name: 'otra.tex', content: dxt1(4, 4) }])),
        collectJobs(new Arz(syntheticArz()), 'all', ONE),
        () => undefined,
      ),
    /ninguna textura/,
  );
});

test('renderJobs: un FourCC no soportado en una textura referenciada falla con su nombre', () => {
  const arc = buildArc([
    {
      name: 'skills/skillallocation/skills_class01trainingbuttonup.tex',
      content: buildTex({ width: 4, height: 4, fourCC: 'BC7 ', data: new Uint8Array(16) }),
    },
  ]);
  assert.throws(
    () => renderJobs(new Arc(arc), collectJobs(new Arz(syntheticArz()), 'masteries', ONE)),
    /skills_class01trainingbuttonup\.tex.*BC7/,
  );
});

test('extractTextures: escribe PNG, manifest y NOTICE; dos ejecuciones son idénticas byte a byte', async () => {
  const { root, game } = await fakeGame();
  try {
    const opts = {
      gameVersion: 'v-test',
      kind: 'all',
      masteries: ONE,
      warn: () => undefined,
    } as const;
    const m1 = extractTextures(game, { ...opts, out: join(root, 'a') });
    extractTextures(game, { ...opts, out: join(root, 'b') });
    for (const f of [
      'manifest.json',
      'NOTICE.txt',
      'masteries/soldier.png',
      'skills/soldier/cadence1.png',
    ]) {
      assert.ok((await readFile(join(root, 'a', f))).equals(await readFile(join(root, 'b', f))), f);
    }
    assert.equal(existsSync(join(root, 'a', 'skills', 'soldier', 'gone1.png')), false);
    const manifest = JSON.parse(await readFile(join(root, 'a', 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest, JSON.parse(JSON.stringify(m1)));
    assert.equal(manifest.version, 1);
    assert.equal(manifest.source.game_version, 'v-test');
    assert.match(manifest.source.sha256['database.arz'], /^[0-9a-f]{64}$/);
    assert.match(manifest.source.sha256['UI.arc'], /^[0-9a-f]{64}$/);
    const e = manifest.masteries[0];
    assert.deepEqual(
      [e.slug, e.path, e.width, e.height, e.sourcePath],
      ['soldier', 'masteries/soldier.png', 4, 4, TEX_UP],
    );
    const png = await readFile(join(root, 'a', e.path));
    assert.equal(
      e.sha256,
      (await import('node:crypto')).createHash('sha256').update(png).digest('hex'),
    );
    // los píxeles del PNG son los del bloque DXT1 sintético
    const px = readPng(png);
    assert.deepEqual([...px.rgba.subarray(0, 8)], [255, 0, 0, 255, 0, 0, 255, 255]);
    assert.equal(manifest.skills[0].id, 'class01/cadence1');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('extractTextures: por defecto solo maestrías; sin UI.arc o sin versión falla con mensaje', async () => {
  const { root, game } = await fakeGame();
  try {
    const m = extractTextures(game, {
      masteries: ONE,
      out: join(root, 'o'),
      gameVersion: 'v',
      warn: () => undefined,
    });
    assert.equal(m.masteries.length, 1);
    assert.equal(m.skills.length, 0);
    assert.throws(
      () => extractTextures(game, { out: join(root, 'p'), masteries: ONE }),
      /versión del juego/,
    );
    await rm(join(game, 'resources', 'UI.arc'));
    assert.throws(
      () => extractTextures(game, { out: join(root, 'q'), gameVersion: 'v', masteries: ONE }),
      /UI\.arc/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('buildManifest: ordena por ruta de salida', () => {
  const mk = (group: 'masteries' | 'skills', key: string, outPath: string) => ({
    job: { group, key, outPath, sourcePath: 'ui/x.tex' },
    png: Buffer.from('p'),
    width: 1,
    height: 1,
    sourceSha256: 'a'.repeat(64),
  });
  const m = buildManifest(
    [mk('skills', 'class01/b', 'skills/s/b.png'), mk('skills', 'class01/a', 'skills/s/a.png')],
    { game_version: 'v', sha256: { 'database.arz': 'x', 'UI.arc': 'y' } },
  );
  assert.deepEqual(
    m.skills.map((s) => s.id),
    ['class01/a', 'class01/b'],
  );
  assert.deepEqual(m.masteries, []);
});

// --- juego instalado (opcional) ----------------------------------------------------------------

const REAL =
  process.env['GRIMDAWN_DIR'] ??
  'C:\\Program Files (x86)\\SteamOffline\\steamapps\\common\\Grim Dawn';
test(
  'juego instalado (opcional): 6 PNG de maestría con tamaño > 0, fuera del repo',
  {
    skip:
      existsSync(join(REAL, 'database', 'database.arz')) &&
      existsSync(join(REAL, 'resources', 'UI.arc'))
        ? false
        : 'juego no instalado',
  },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'gdb-t028-real-'));
    try {
      const m = extractTextures(REAL, { out: root, warn: () => undefined });
      assert.deepEqual(
        m.masteries.map((e) => e.slug),
        ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'],
      );
      for (const e of m.masteries) {
        assert.ok(e.width > 0 && e.height > 0, e.slug);
        const png = readPng(await readFile(join(root, e.path)));
        assert.deepEqual([png.width, png.height], [e.width, e.height]);
        assert.ok(png.rgba.length > 0);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

// --- spec004 T026: iconos de habilidad a PNG 32 x 32 --------------------------------------------

const ICON_ARC_NAME = 'skills/icons/class01/skillicon_cadence1up.tex';
/** Píxeles BGRA de un icono 32 x 32 sintético, todos distintos para detectar cualquier remuestreo. */
const iconBgra = (): Uint8Array => {
  const data = new Uint8Array(32 * 32 * 4);
  for (let i = 0; i < 32 * 32; i++)
    data.set([i % 251, (i * 3) % 253, (i * 7) % 255, 255 - (i % 200)], i * 4);
  return data;
};
const iconArc = (size = 32): Buffer =>
  buildArc([
    { name: 'Skills/SkillAllocation/skills_class01trainingbuttonup.tex', content: dxt1(4, 4) },
    {
      name: ICON_ARC_NAME,
      content: buildTex({
        width: size,
        height: size,
        bits: 32,
        data: size === 32 ? iconBgra() : new Uint8Array(size * size * 4),
      }),
    },
  ]);

test('collectJobs icons: un trabajo por textura única, nombrado por su icon_id público', () => {
  const arz = new Arz(syntheticArz());
  const jobs = collectJobs(arz, 'icons', ONE);
  assert.deepEqual(
    jobs.map((j) => [j.group, j.key, j.outPath, j.sourcePath]),
    [
      ['icons', iconIdOf(ICON), `icons/${iconIdOf(ICON)}.png`, ICON],
      ['icons', iconIdOf(ICON_MISSING), `icons/${iconIdOf(ICON_MISSING)}.png`, ICON_MISSING],
    ].sort((a, b) => (a[2]! < b[2]! ? -1 : 1)),
  );
  for (const j of jobs) assert.doesNotMatch(j.outPath, /skillicon|cadence|\.tex$/);
});

test('collectJobs icons: dos nodos con la misma textura dan un solo icono', () => {
  const arz = new Arz(
    buildArz([
      { path: 'records/game/gameengine.dbr', fields: { skillMasteryTierLevel: [1, 5, 10] } },
      {
        path: `${SK}_classtraining_class01.dbr`,
        fields: {
          FileDescription: 'Soldier',
          skillDisplayName: 'tagClass01SkillName00A',
          skillUpBitmapName: TEX_UP,
        },
      },
      ...[
        [11, 246, 39, 'a'],
        [12, 246, 179, 'b'],
      ].map(([n, x, y, id]) => ({
        path: `records/ui/skills/class01/skill${n}.dbr`,
        fields: {
          bitmapPositionX: x as number,
          bitmapPositionY: y as number,
          skillName: `${SK}${id}.dbr`,
        },
      })),
      ...['a', 'b'].map((id) => ({
        path: `${SK}${id}.dbr`,
        fields: {
          Class: 'Skill_AttackWeapon',
          skillDisplayName: `tag_${id}`,
          skillTier: 1,
          skillMaxLevel: 12,
          skillUpBitmapName: ICON,
        },
      })),
    ]),
  );
  assert.equal(collectJobs(arz, 'icons', ONE).length, 1);
});

test('extractTextures icons: PNG 32 x 32 con los píxeles sin tocar, sha256 y salida determinista', async () => {
  const { root, game } = await fakeGame(iconArc());
  try {
    const opts = {
      gameVersion: 'v-test',
      kind: 'icons',
      masteries: ONE,
      warn: () => undefined,
    } as const;
    const m1 = extractTextures(game, { ...opts, out: join(root, 'a') });
    extractTextures(game, { ...opts, out: join(root, 'b') });
    assert.equal(m1.icons.length, 1);
    const e = m1.icons[0]!;
    assert.equal(e.id, iconIdOf(ICON));
    assert.deepEqual(
      [e.path, e.width, e.height, e.sourcePath],
      [`icons/${iconIdOf(ICON)}.png`, 32, 32, ICON],
    );
    const png = await readFile(join(root, 'a', e.path));
    assert.ok(png.equals(await readFile(join(root, 'b', e.path))), 'determinista');
    const { createHash } = await import('node:crypto');
    assert.equal(e.sha256, createHash('sha256').update(png).digest('hex'));
    assert.match(e.sourceSha256, /^[0-9a-f]{64}$/);
    const px = readPng(png);
    assert.deepEqual([px.width, px.height], [32, 32]);
    const bgra = iconBgra();
    for (const i of [0, 1, 31, 32, 500, 1023]) {
      assert.deepEqual(
        [...px.rgba.subarray(i * 4, i * 4 + 4)],
        [bgra[i * 4 + 2], bgra[i * 4 + 1], bgra[i * 4], bgra[i * 4 + 3]],
        `píxel ${i} sin modificar`,
      );
    }
    // no escribe máscaras ni maestrías: solo los iconos pedidos
    assert.equal(existsSync(join(root, 'a', 'masteries')), false);
    assert.deepEqual(m1.masteries, []);
    assert.deepEqual(m1.skills, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('extractTextures icons: un icono que no mide 32 x 32 falla nombrando la textura', async () => {
  const { root, game } = await fakeGame(iconArc(16));
  try {
    assert.throws(
      () =>
        extractTextures(game, {
          gameVersion: 'v-test',
          kind: 'icons',
          masteries: ONE,
          out: join(root, 'o'),
          warn: () => undefined,
        }),
      /skillicon_cadence1up\.tex.*32 x 32.*16 x 16/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('extractTextures: sin --kind icons el manifiesto trae `icons` vacío', async () => {
  const { root, game } = await fakeGame();
  try {
    const m = extractTextures(game, {
      gameVersion: 'v-test',
      masteries: ONE,
      out: join(root, 'o'),
      warn: () => undefined,
    });
    assert.deepEqual(m.icons, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test(
  'juego instalado (opcional): 164 iconos 32 x 32 cuyos icon_id son los del catálogo versionado',
  {
    skip:
      existsSync(join(REAL, 'database', 'database.arz')) &&
      existsSync(join(REAL, 'resources', 'UI.arc'))
        ? false
        : 'juego no instalado',
  },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'gdb-t026-real-'));
    try {
      const m = extractTextures(REAL, { out: root, kind: 'icons', warn: () => undefined });
      assert.equal(m.icons.length, 164);
      assert.ok(m.icons.every((e) => e.width === 32 && e.height === 32));
      const fixtures = ['arcanist', 'demolition', 'nightblade', 'occult', 'shaman', 'soldier'];
      const expected = new Set<string>();
      for (const slug of fixtures) {
        const tree = JSON.parse(
          await readFile(
            new URL(`../fixtures/content/mastery-trees/${slug}.json`, import.meta.url),
            'utf8',
          ),
        );
        for (const n of tree.nodes) if (n.icon_id) expected.add(n.icon_id);
      }
      assert.deepEqual(new Set(m.icons.map((e) => e.id)), expected);
      for (const e of m.icons) {
        const png = readPng(await readFile(join(root, e.path)));
        assert.deepEqual([png.width, png.height], [32, 32]);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
