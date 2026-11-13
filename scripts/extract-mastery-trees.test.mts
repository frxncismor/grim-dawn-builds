// T006 (spec 003): la prueba NO depende del juego instalado. Construye un `.arz` sintético
// (cabecera, registros LZ4 sin compresión de coincidencias y tabla de cadenas) y prueba
// parser, mapeo de campos, regla de `parent`, determinismo y ausencia de rutas absolutas.
// Si el juego está instalado hay además una prueba opcional que se salta sin él.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Arc,
  Arz,
  buildCatalog,
  type CatalogTree,
  cleanText,
  createLocalizer,
  extractFromGameDir,
  kindOf,
  loadTags,
  lz4Block,
  parseTags,
  serializeCatalog,
} from './extract-mastery-trees.mts';

type Val = number | string | boolean;
type Fields = Record<string, Val | readonly Val[]>;
interface Rec {
  readonly path: string;
  readonly type: string;
  readonly fields: Fields;
}

/** Bloque LZ4 válido con una sola secuencia de literales (sin coincidencias). */
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

/** Escribe un `.arz` mínimo con el mismo formato que el del juego (cabecera 2/3). */
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
  const meta: { path: number; type: string; offset: number; comp: number; size: number }[] = [];
  let offset = 0;
  for (const r of records) {
    const chunks: Buffer[] = [];
    for (const [key, raw] of Object.entries(r.fields)) {
      const vals = Array.isArray(raw) ? (raw as readonly Val[]) : [raw as Val];
      const first = vals[0]!;
      const kind =
        typeof first === 'boolean'
          ? 3
          : typeof first === 'string'
            ? 2
            : Number.isInteger(first)
              ? 0
              : 1;
      const head = Buffer.alloc(8);
      head.writeUInt16LE(kind, 0);
      head.writeUInt16LE(vals.length, 2);
      head.writeUInt32LE(sid(key), 4);
      const body = Buffer.alloc(4 * vals.length);
      vals.forEach((v, i) => {
        if (kind === 0) body.writeInt32LE(v as number, 4 * i);
        else if (kind === 1) body.writeFloatLE(v as number, 4 * i);
        else if (kind === 2) body.writeUInt32LE(sid(v as string), 4 * i);
        else body.writeUInt32LE(v ? 1 : 0, 4 * i);
      });
      chunks.push(head, body);
    }
    const plain = Buffer.concat(chunks);
    const comp = lz4Literals(plain);
    meta.push({
      path: sid(r.path),
      type: r.type,
      offset,
      comp: comp.length,
      size: plain.length,
    });
    blocks.push(comp);
    offset += comp.length;
  }
  const data = Buffer.concat(blocks);
  const table: Buffer[] = [];
  for (const m of meta) {
    const t = Buffer.alloc(8 + m.type.length + 12 + 8);
    t.writeUInt32LE(m.path, 0);
    t.writeUInt32LE(m.type.length, 4);
    t.write(m.type, 8, 'latin1');
    const p = 8 + m.type.length;
    t.writeUInt32LE(m.offset, p);
    t.writeUInt32LE(m.comp, p + 4);
    t.writeUInt32LE(m.size, p + 8);
    table.push(t);
  }
  const recTable = Buffer.concat(table);
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

const SK = 'records/skills/playerclass01/';
const UI = 'records/ui/skills/class01/';
const ui = (n: number, x: number, y: number, skill: string, circular?: boolean): Rec => ({
  path: `${UI}skill${n}.dbr`,
  type: '',
  fields: {
    bitmapPositionX: x,
    bitmapPositionY: y,
    skillName: `${SK}${skill}.dbr`,
    ...(circular === undefined ? {} : { isCircular: circular }),
  },
});
const skill = (id: string, type: string, f: Fields): Rec => ({
  path: `${SK}${id}.dbr`,
  type,
  fields: { Class: type, ...f },
});

/** Dos maestrías sintéticas; el mundo de pruebas cubre cada regla del mapa de campos (T002 §3). */
function synthetic(): Buffer {
  const mastery = (nn: string, desc: string): Rec => ({
    path: `records/skills/playerclass${nn}/_classtraining_class${nn}.dbr`,
    type: 'Skill_Mastery',
    fields: {
      MasteryEnumeration: `SkillClass${nn}`,
      FileDescription: desc,
      skillDisplayName: `tagClass${nn}SkillName00A`,
      skillBaseDescription: `tagClass${nn}SkillDescription00A`,
      skillMaxLevel: 50,
    },
  });
  return buildArz([
    {
      path: 'records/game/gameengine.dbr',
      type: '',
      fields: { skillMasteryTierLevel: [1, 5, 10, 15, 20, 25, 32, 40, 50] },
    },
    mastery('01', 'Soldier'),
    // nodos de UI en orden NO alfabético a propósito
    ui(12, 326, 71, 'cadence2'),
    ui(11, 246, 39, 'cadence1', true),
    ui(13, 326, 109, 'cadence1b'),
    ui(14, 406, 39, 'fieldcommand1'),
    ui(15, 486, 39, 'summon_raven2_petmodifier'),
    ui(16, 566, 39, 'ghost1'), // registro inexistente: se excluye
    ui(17, 726, 39, 'stanceoffensive'),
    ui(18, 886, 39, 'naturesblessing2'),
    ui(19, 246, 71, 'natureblessing1'),
    ui(20, 406, 109, 'summon_raven1'),
    skill('cadence1', 'Skill_AttackWeapon', {
      skillDisplayName: 'tagClass01SkillName01A',
      skillBaseDescription: 'tagClass01SkillDescription01A',
      skillTier: 1,
      skillMaxLevel: 16,
      skillUltimateLevel: 26,
      skillUpBitmapName: 'ui/skills/cadence1up.tex',
    }),
    skill('cadence2', 'Skill_Modifier', {
      skillDisplayName: 'tagClass01SkillName01B',
      skillBaseDescription: 'tagClass01SkillDescription01B',
      skillTier: 2,
      skillMaxLevel: 12,
      skillUltimateLevel: 22,
    }),
    skill('cadence1b', 'Skill_Transmuter', {
      skillDisplayName: 'tagClass01SkillName01C',
      skillBaseDescription: 'tagClass01SkillDescription01C',
      skillTier: 2,
      skillMaxLevel: 1,
      skillUltimateLevel: 1,
    }),
    // envoltorio: sin tier propio, apunta a `buffSkillName`
    skill('fieldcommand1', 'Skill_BuffSelfDuration', {
      buffSkillName: `${SK}fieldcommand1buff.dbr`,
      skillDisplayName: 'tagClass01SkillName02A',
      skillBaseDescription: 'tagClass01SkillDescription02A',
    }),
    skill('fieldcommand1buff', 'Skill_BuffSelf', {
      skillTier: 3,
      skillMaxLevel: 12,
      skillUltimateLevel: 22,
    }),
    // petmodifier: tier/rangos/texto salen de la cadena petSkillName -> buffSkillName (2 saltos)
    skill('summon_raven2_petmodifier', 'SkillSecondary_PetModifier', {
      petSkillName: 'records/skills/playerclass01/pets/petskill_raven.dbr',
    }),
    {
      path: `${SK}pets/petskill_raven.dbr`,
      type: 'Skill_BuffOther',
      fields: {
        Class: 'Skill_BuffOther',
        buffSkillName: `${SK}pets/petskill_raven_buff.dbr`,
      },
    },
    {
      path: `${SK}pets/petskill_raven_buff.dbr`,
      type: 'SkillBuff_Passive',
      fields: {
        Class: 'SkillBuff_Passive',
        skillTier: 4,
        skillMaxLevel: 12,
        skillDisplayName: 'tagClass01SkillName03B',
      },
    },
    skill('summon_raven1', 'Skill_AttackWeapon', {
      skillDisplayName: 'tagClass01SkillName03A',
      skillTier: 3,
      skillMaxLevel: 12,
    }),
    skill('stanceoffensive', 'Skill_PassiveOnLifeBuffSelf', {
      skillDisplayName: 'tagClass01SkillName04A',
      skillTier: 7,
      skillMaxLevel: 10,
      skillUltimateLevel: 20,
    }),
    // alias explícito: `natureblessing1` (raíz) frente a `naturesblessing2` (hijo)
    skill('natureblessing1', 'Skill_AttackWeapon', {
      skillDisplayName: 'tagClass01SkillName05A',
      skillTier: 1,
      skillMaxLevel: 8,
    }),
    skill('naturesblessing2', 'Skill_Modifier', {
      skillDisplayName: 'tagClass01SkillName05B',
      skillTier: 9,
      skillMaxLevel: 8,
      skillUltimateLevel: 18,
    }),
    mastery('02', 'Demolition'),
    {
      path: 'records/ui/skills/class02/skill11.dbr',
      type: '',
      fields: {
        bitmapPositionX: 406,
        bitmapPositionY: 211,
        skillName: 'records/skills/playerclass02/blitz1.dbr',
      },
    },
    {
      path: 'records/skills/playerclass02/blitz1.dbr',
      type: 'Skill_AttackWeapon',
      fields: {
        Class: 'Skill_AttackWeapon',
        skillTier: 3,
        skillMaxLevel: 16,
        skillDisplayName: 'tagClass02SkillName01A',
      },
    },
  ]);
}

const OPTS = { gameVersion: 'buildid-1', sha256: ['ab'.repeat(32)] } as const;
const catalogOf = (buf: Buffer, masteries?: readonly string[]) =>
  buildCatalog(new Arz(buf), { ...OPTS, ...(masteries ? { masteries } : {}) });

test('lz4Block: descomprime secuencias con coincidencias (vector escrito a mano)', () => {
  // 'abcd' literales + coincidencia (offset 4, longitud 4+4) + 'x'
  const src = Buffer.from([0x44, 0x61, 0x62, 0x63, 0x64, 0x04, 0x00, 0x10, 0x78]);
  assert.equal(Buffer.from(lz4Block(src, 13)).toString('latin1'), 'abcdabcdabcdx');
  assert.throws(() => lz4Block(src, 12), /LZ4/);
});

test('Arz: lee cabecera, cadenas y campos tipados del .arz sintético', () => {
  const arz = new Arz(synthetic());
  assert.equal(arz.header.recordCount, arz.entries.size);
  const eng = arz.read('records/game/gameengine.dbr');
  assert.deepEqual(eng.fields.get('skillMasteryTierLevel'), [1, 5, 10, 15, 20, 25, 32, 40, 50]);
  assert.equal(arz.read(`${SK}cadence1.dbr`).type, 'Skill_AttackWeapon');
  assert.throws(() => new Arz(Buffer.alloc(24)), /cabecera/);
});

test('kindOf: clasifica los tipos de registro observados en el juego real', () => {
  const table: Record<string, string> = {
    Skill_Modifier: 'modifier',
    Skill_ProjectileModifier: 'modifier',
    SkillSecondary_PetModifier: 'modifier',
    SkillSecondary_ChainLightning: 'modifier',
    Skill_Transmuter: 'transmuter',
    Skill_ProjectileTransmuter: 'transmuter',
    Skill_SpawnPetTransmuter: 'transmuter',
    Skill_Passive: 'passive',
    Skill_PassiveOnLifeBuffSelf: 'passive',
    Skill_AttackWeapon: 'active',
    Skill_BuffSelfToggled: 'active',
    Skill_WeaponPool_BasicAttack: 'active',
  };
  for (const [type, kind] of Object.entries(table)) assert.equal(kindOf(type), kind, type);
});

const byId = (t: CatalogTree) => Object.fromEntries(t.nodes.map((x) => [x.id, x]));

test('buildCatalog: forma del contrato T005/T006 y source', () => {
  const trees = catalogOf(synthetic(), ['class01']);
  assert.equal(trees.length, 1);
  const t = trees[0]!;
  assert.deepEqual(t.source, { game_version: 'buildid-1', sha256: ['ab'.repeat(32)] });
  assert.equal(t.game_version, 'buildid-1');
  assert.deepEqual(t.mastery, {
    id: 'class01',
    slug: 'soldier',
    name: { en: 'tagClass01SkillName00A', es: 'tagClass01SkillName00A' },
  });
  const n = byId(t);
  assert.deepEqual(n['class01/cadence1'], {
    id: 'class01/cadence1',
    name: { en: 'tagClass01SkillName01A', es: 'tagClass01SkillName01A' },
    kind: 'active',
    circular: true,
    tier: 1,
    bar_required: 1,
    grid: { col: 1, row: 39 },
    max_points: 16,
    ultimate_points: 26,
    parent_id: null,
    icon: 'ui/skills/cadence1up.tex',
  });
  assert.equal(n['class01/cadence2']!.kind, 'modifier');
  assert.equal(n['class01/cadence2']!.circular, false);
  assert.equal(n['class01/cadence2']!.parent_id, 'class01/cadence1');
  assert.equal(n['class01/cadence2']!.bar_required, 5);
  assert.equal(n['class01/cadence1b']!.kind, 'transmuter');
  assert.equal(n['class01/cadence1b']!.parent_id, 'class01/cadence1');
  assert.equal(n['class01/stanceoffensive']!.kind, 'passive');
  assert.equal(n['class01/stanceoffensive']!.bar_required, 32);
});

test('buildCatalog: envoltorio, petmodifier por cadena, alias, colgantes y orden', () => {
  const t = catalogOf(synthetic(), ['class01'])[0]!;
  const n = byId(t);
  const P = 'class01/';
  // envoltorio: tier/rangos del destino, nombre propio
  assert.equal(n[`${P}fieldcommand1`]!.tier, 3);
  assert.equal(n[`${P}fieldcommand1`]!.bar_required, 10);
  assert.equal(n[`${P}fieldcommand1`]!.max_points, 12);
  assert.equal(n[`${P}fieldcommand1`]!.name.en, 'tagClass01SkillName02A');
  // petmodifier: valores resueltos por la cadena petSkillName -> buffSkillName
  const pet = n[`${P}summon_raven2_petmodifier`]!;
  assert.equal(pet.tier, 4);
  assert.equal(pet.max_points, 12);
  assert.equal(pet.name.en, 'tagClass01SkillName03B');
  assert.equal(pet.kind, 'modifier');
  assert.equal(pet.parent_id, `${P}summon_raven1`);
  // alias natureblessing / naturesblessing
  assert.equal(n[`${P}naturesblessing2`]!.parent_id, `${P}natureblessing1`);
  // `ghost1` (skillName colgante) se excluye
  assert.equal(`${P}ghost1` in n, false);
  // orden estable: (col, row, id)
  const keys = t.nodes.map((x) => [x.grid.col, x.grid.row, x.id] as const);
  const sorted = [...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));
  assert.deepEqual(keys, sorted);
});

test('buildCatalog: el hijo sin padre, o el tier distinto de la columna, fallan con mensaje', () => {
  const orphan = buildArz([
    {
      path: 'records/game/gameengine.dbr',
      type: '',
      fields: { skillMasteryTierLevel: [1, 5, 10, 15, 20, 25, 32, 40, 50] },
    },
    {
      path: 'records/skills/playerclass01/_classtraining_class01.dbr',
      type: 'Skill_Mastery',
      fields: {
        MasteryEnumeration: 'SkillClass01',
        skillDisplayName: 'a',
        skillBaseDescription: 'b',
      },
    },
    ui(11, 326, 39, 'lonely2'),
    skill('lonely2', 'Skill_Modifier', { skillDisplayName: 'x', skillTier: 2, skillMaxLevel: 1 }),
  ]);
  assert.throws(() => catalogOf(orphan, ['class01']), /padre.*lonely2|lonely2.*padre/);
  const bad = buildArz([
    {
      path: 'records/game/gameengine.dbr',
      type: '',
      fields: { skillMasteryTierLevel: [1, 5, 10, 15, 20, 25, 32, 40, 50] },
    },
    {
      path: 'records/skills/playerclass01/_classtraining_class01.dbr',
      type: 'Skill_Mastery',
      fields: {
        MasteryEnumeration: 'SkillClass01',
        skillDisplayName: 'a',
        skillBaseDescription: 'b',
      },
    },
    ui(11, 326, 39, 'root1'),
    skill('root1', 'Skill_AttackWeapon', { skillDisplayName: 'x', skillTier: 5, skillMaxLevel: 1 }),
  ]);
  assert.throws(() => catalogOf(bad, ['class01']), /tier.*columna|columna.*tier/);
});

test('buildCatalog: varias maestrías, orden por id; maestría sin registros falla', () => {
  const c = catalogOf(synthetic(), ['class02', 'class01']);
  assert.deepEqual(
    c.map((t) => t.mastery.id),
    ['class01', 'class02'],
  );
  assert.equal(c[1]!.mastery.slug, 'demolition');
  assert.equal(c[1]!.nodes[0]!.id, 'class02/blitz1');
  assert.equal(c[1]!.nodes[0]!.tier, 3);
  assert.throws(() => catalogOf(synthetic(), ['class03']), /class03/);
});

test('serializeCatalog: determinista (bytes idénticos), claves estables, sin rutas ni fechas', () => {
  const a = serializeCatalog(catalogOf(synthetic(), ['class01', 'class02']));
  const b = serializeCatalog(catalogOf(synthetic(), ['class01', 'class02']));
  assert.equal(a, b);
  assert.ok(a.endsWith('\n'));
  const j = JSON.parse(a);
  assert.deepEqual(Object.keys(j[0]), ['mastery', 'game_version', 'source', 'nodes']);
  assert.deepEqual(Object.keys(j[0].nodes[0]), [
    'id',
    'name',
    'kind',
    'circular',
    'tier',
    'bar_required',
    'grid',
    'max_points',
    'ultimate_points',
    'parent_id',
    'icon',
  ]);
  assert.doesNotMatch(a, /[A-Za-z]:\\|\/Users\/|\/home\/|\d{4}-\d{2}-\d{2}T/);
});

test('extractFromGameDir: lee database.arz, hash sha256 y versión del appmanifest de Steam', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gdb-t006-'));
  try {
    const gameDir = join(root, 'steamapps', 'common', 'Grim Dawn');
    await mkdir(join(gameDir, 'database'), { recursive: true });
    const arzBuf = synthetic();
    await writeFile(join(gameDir, 'database', 'database.arz'), arzBuf);
    await writeFile(
      join(root, 'steamapps', 'appmanifest_219990.acf'),
      '"AppState"\n{\n\t"appid"\t\t"219990"\n\t"buildid"\t\t"25813250"\n}\n',
    );
    const out = extractFromGameDir(gameDir, { masteries: ['class01'], localize: false });
    const json = JSON.parse(out);
    assert.deepEqual(json[0].source, {
      game_version: 'steam-build-25813250',
      sha256: [createHash('sha256').update(arzBuf).digest('hex')],
    });
    assert.equal(out, extractFromGameDir(gameDir, { masteries: ['class01'], localize: false }));
    // `gameVersion` explícito tiene prioridad; sin manifest ni valor explícito, error
    assert.equal(
      JSON.parse(
        extractFromGameDir(gameDir, { masteries: ['class01'], gameVersion: 'x', localize: false }),
      )[0].game_version,
      'x',
    );
    const lone = join(root, 'solo');
    await mkdir(join(lone, 'database'), { recursive: true });
    await writeFile(join(lone, 'database', 'database.arz'), arzBuf);
    assert.throws(
      () => extractFromGameDir(lone, { masteries: ['class01'], localize: false }),
      /versi/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------
// T022: textos de localización (.arc). Todo sintético: ningún texto real del juego.
// ---------------------------------------------------------------------------------------------

/** Escribe un `.arc` v3 mínimo (cabecera, partes LZ4 de literales, cadenas y registros de 44 bytes). */
function buildArc(files: readonly { name: string; content: string; stored?: boolean }[]): Buffer {
  const header = Buffer.alloc(2048); // los datos empiezan en 2048, como en el juego
  const blocks: Buffer[] = [];
  const parts: Buffer[] = [];
  const recs: Buffer[] = [];
  let names = '';
  let offset = 2048;
  for (const [i, f] of files.entries()) {
    const plain = Buffer.from(f.content, 'utf8');
    const comp = f.stored ? plain : lz4Literals(plain);
    blocks.push(comp);
    const part = Buffer.alloc(12);
    part.writeUInt32LE(offset, 0);
    part.writeUInt32LE(comp.length, 4);
    part.writeUInt32LE(plain.length, 8);
    parts.push(part);
    const r = Buffer.alloc(44);
    r.writeUInt32LE(f.stored ? 1 : 3, 0);
    r.writeUInt32LE(offset, 4);
    r.writeUInt32LE(comp.length, 8);
    r.writeUInt32LE(plain.length, 12);
    r.writeUInt32LE(1, 28); // nº de partes
    r.writeUInt32LE(i, 32); // primera parte
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

const crlf = (lines: readonly string[]): string => lines.join('\r\n') + '\r\n';
const TAGS_EN = crlf([
  '#Default',
  'tagClass01SkillName00A=Alpha Class',
  'tagClass01SkillName01A=First Skill',
  'tagClass01SkillName01B=Second {^g}Skill{^-}',
  'tagClass01SkillName01C=Third = Skill',
  'tagClass01SkillName02A=Fourth',
  'tagClass01SkillName03A=Fifth',
  'tagClass01SkillName03B=Sixth',
  'tagClass01SkillName04A=Seventh',
  'tagClass01SkillName05A=Eighth',
  'tagClass01SkillName05B=Ninth',
  'tagClass02SkillName00A=Beta Class',
  'tagClass02SkillName01A=Tenth',
]);
const TAGS_ES = crlf([
  '// comentario',
  'tagClass01SkillName00A=Clase Alfa',
  'tagClass01SkillName01A=Primera Habilidad',
  'tagClass01SkillName01B=Segunda [ms]Táctico[fs]Táctica',
  'tagClass01SkillName01C=Tercera',
  'tagClass01SkillName02A=Cuarta',
  'tagClass01SkillName03A=Quinta',
  'tagClass01SkillName03B=Sexta',
  'tagClass01SkillName04A=Séptima',
  'tagClass01SkillName05A=Octava',
  'tagClass01SkillName05B=Novena',
  'tagClass02SkillName00A=Clase Beta',
  // `tagClass02SkillName01A` falta a propósito: fallback ES -> EN
]);
const arcOf = (tags: string): Buffer =>
  buildArc([
    { name: 'credits', content: 'sin tags\r\n' },
    { name: 'tags_skills.txt', content: tags },
  ]);

test('Arc: lee cabecera, índice y archivos LZ4 y almacenados del .arc sintético', () => {
  const arc = new Arc(
    buildArc([
      { name: 'a.txt', content: 'hola\r\n' },
      { name: 'dir/b.txt', content: 'adiós', stored: true },
    ]),
  );
  assert.deepEqual([...arc.files.keys()], ['a.txt', 'dir/b.txt']);
  assert.equal(arc.read('a.txt').toString('utf8'), 'hola\r\n');
  assert.equal(arc.read('dir/b.txt').toString('utf8'), 'adiós');
  assert.throws(() => arc.read('nada.txt'), /nada\.txt/);
  assert.throws(() => new Arc(Buffer.alloc(64)), /\.arc/);
  const v2 = buildArc([{ name: 'a.txt', content: 'x' }]);
  v2.writeUInt32LE(2, 4);
  assert.throws(() => new Arc(v2), /\.arc/);
});

test('parseTags/cleanText: comentarios, primer "=", CRLF/LF y códigos de formato', () => {
  const m = parseTags('#c\r\n// c\r\n\r\na=1 = 2\nb=Hola {^g}mundo{^-}\r\nsin igual\r\nc=\r\n');
  assert.deepEqual(
    [...m],
    [
      ['a', '1 = 2'],
      ['b', 'Hola mundo'],
      ['c', ''],
    ],
  );
  assert.equal(cleanText('{^s}Iron{^-} {%t0} bits'), 'Iron bits');
  assert.equal(cleanText('[ms]Táctico[fs]Táctica'), 'Táctico');
  assert.equal(cleanText('[fs]Táctica'), 'Táctica');
  assert.equal(cleanText('  sin cambios  '), 'sin cambios');
});

test('loadTags: solo tags_skills.txt; falla con el archivo ausente', () => {
  assert.equal(loadTags(new Arc(arcOf(TAGS_EN))).get('tagClass01SkillName00A'), 'Alpha Class');
  assert.throws(
    () => loadTags(new Arc(buildArc([{ name: 'x.txt', content: 'a=b' }]))),
    /tags_skills/,
  );
});

const localizer = () =>
  createLocalizer(loadTags(new Arc(arcOf(TAGS_EN))), loadTags(new Arc(arcOf(TAGS_ES))));

test('createLocalizer: resuelve EN/ES; ES ausente cae a EN y se cuenta; EN ausente falla', () => {
  const l = localizer();
  assert.deepEqual(l.resolve('tagClass01SkillName01A'), {
    en: 'First Skill',
    es: 'Primera Habilidad',
  });
  assert.deepEqual(l.resolve('tagClass02SkillName01A'), { en: 'Tenth', es: 'Tenth' });
  l.resolve('tagClass02SkillName01A'); // repetido: cuenta una sola vez
  assert.deepEqual([...l.fallbacks], ['tagClass02SkillName01A']);
  assert.throws(() => l.resolve('tagClassXXSkillName99Z'), /tagClassXXSkillName99Z/);
  assert.deepEqual(l.resolve('tagClass01SkillName01B'), {
    en: 'Second Skill',
    es: 'Segunda Táctico',
  });
});

test('buildCatalog + localizer: maestrías y nodos salen del texto, no del tag', () => {
  const l = localizer();
  const trees = buildCatalog(new Arz(synthetic()), {
    ...OPTS,
    masteries: ['class01', 'class02'],
    localizer: l,
  });
  const t = trees.find((x) => x.mastery.id === 'class01')!;
  assert.deepEqual(t.mastery.name, { en: 'Alpha Class', es: 'Clase Alfa' });
  const n = byId(t);
  assert.deepEqual(n['class01/cadence1']!.name, { en: 'First Skill', es: 'Primera Habilidad' });
  assert.equal(n['class01/stanceoffensive']!.name.es, 'Séptima');
  // petmodifier: el nombre resuelto sale de la cadena petSkillName -> buffSkillName
  assert.equal(n['class01/summon_raven2_petmodifier']!.name.en, 'Sixth');
  for (const nd of trees.flatMap((x) => x.nodes)) {
    assert.doesNotMatch(nd.name.en, /^tag/);
    assert.doesNotMatch(nd.name.es, /^tag/);
  }
  // class02 tiene un nodo (blitz1) con el tag ausente en ES: fallback
  assert.deepEqual(trees.find((x) => x.mastery.id === 'class02')!.nodes[0]!.name, {
    en: 'Tenth',
    es: 'Tenth',
  });
  assert.equal(l.fallbacks.size, 1);
  // sin localizer se conserva T006 (tags)
  assert.equal(catalogOf(synthetic(), ['class01'])[0]!.mastery.name.en, 'tagClass01SkillName00A');
});

test('extractFromGameDir: resuelve nombres, añade sha256 de los .arc, avisa del fallback y es determinista', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gdb-t022-'));
  try {
    const dir = join(root, 'Grim Dawn');
    await mkdir(join(dir, 'database'), { recursive: true });
    await mkdir(join(dir, 'resources'), { recursive: true });
    const arz = synthetic();
    const en = arcOf(TAGS_EN);
    const es = arcOf(TAGS_ES);
    await writeFile(join(dir, 'database', 'database.arz'), arz);
    await writeFile(join(dir, 'resources', 'Text_EN.arc'), en);
    await writeFile(join(dir, 'resources', 'Text_ES.arc'), es);
    const warnings: string[] = [];
    const base = {
      gameVersion: 'v1',
      masteries: ['class01', 'class02'],
      warn: (m: string) => warnings.push(m),
    };
    const out = extractFromGameDir(dir, base);
    const j = JSON.parse(out) as CatalogTree[];
    const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
    assert.deepEqual(j[0]!.source.sha256, [sha(arz), sha(en), sha(es)]);
    assert.equal(j[0]!.mastery.name.es, 'Clase Alfa');
    assert.equal(j[1]!.mastery.name.en, 'Beta Class');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /1 .*ES.*EN/);
    assert.equal(out, extractFromGameDir(dir, { ...base, warn: () => undefined }));
    // --no-localize: tags y un solo hash, sin leer los .arc
    const raw = JSON.parse(extractFromGameDir(dir, { ...base, localize: false })) as CatalogTree[];
    assert.equal(raw[0]!.mastery.name.en, 'tagClass01SkillName00A');
    assert.deepEqual(raw[0]!.source.sha256, [sha(arz)]);
    // .arc ausente: error claro que sugiere --no-localize
    await rm(join(dir, 'resources', 'Text_ES.arc'));
    assert.throws(() => extractFromGameDir(dir, base), /Text_ES\.arc.*--no-localize/);
    // tag ausente en EN: falla con el tag concreto
    await writeFile(join(dir, 'resources', 'Text_ES.arc'), es);
    await writeFile(
      join(dir, 'resources', 'Text_EN.arc'),
      arcOf(TAGS_EN.replace('tagClass01SkillName02A=Fourth\r\n', '')),
    );
    assert.throws(() => extractFromGameDir(dir, base), /tagClass01SkillName02A/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const REAL =
  process.env['GRIMDAWN_DIR'] ??
  'C:\\Program Files (x86)\\SteamOffline\\steamapps\\common\\Grim Dawn';
test(
  'juego instalado (opcional): 6 maestrías, determinista y con padre en todo hijo',
  { skip: existsSync(join(REAL, 'database', 'database.arz')) ? false : 'juego no instalado' },
  () => {
    const a = extractFromGameDir(REAL, { warn: () => undefined });
    assert.equal(a, extractFromGameDir(REAL, { warn: () => undefined }));
    const j = JSON.parse(a);
    assert.deepEqual(
      j.map((t: { mastery: { id: string } }) => t.mastery.id),
      ['class01', 'class02', 'class03', 'class04', 'class05', 'class06'],
    );
    for (const t of j) {
      assert.doesNotMatch(t.mastery.name.en, /^tag/);
      assert.doesNotMatch(t.mastery.name.es, /^tag/);
      for (const nd of t.nodes) {
        assert.equal(nd.kind === 'modifier' || nd.kind === 'transmuter', nd.parent_id !== null);
        assert.doesNotMatch(nd.name.en, /^tag/);
        assert.doesNotMatch(nd.name.es, /^tag/);
      }
    }
  },
);
