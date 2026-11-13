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
  Arz,
  buildCatalog,
  type CatalogTree,
  extractFromGameDir,
  kindOf,
  lz4Block,
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
    const out = extractFromGameDir(gameDir, { masteries: ['class01'] });
    const json = JSON.parse(out);
    assert.deepEqual(json[0].source, {
      game_version: 'steam-build-25813250',
      sha256: [createHash('sha256').update(arzBuf).digest('hex')],
    });
    assert.equal(out, extractFromGameDir(gameDir, { masteries: ['class01'] }));
    // `gameVersion` explícito tiene prioridad; sin manifest ni valor explícito, error
    assert.equal(
      JSON.parse(extractFromGameDir(gameDir, { masteries: ['class01'], gameVersion: 'x' }))[0]
        .game_version,
      'x',
    );
    const lone = join(root, 'solo');
    await mkdir(join(lone, 'database'), { recursive: true });
    await writeFile(join(lone, 'database', 'database.arz'), arzBuf);
    assert.throws(() => extractFromGameDir(lone, { masteries: ['class01'] }), /versi/);
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
    const a = extractFromGameDir(REAL);
    assert.equal(a, extractFromGameDir(REAL));
    const j = JSON.parse(a);
    assert.deepEqual(
      j.map((t: { mastery: { id: string } }) => t.mastery.id),
      ['class01', 'class02', 'class03', 'class04', 'class05', 'class06'],
    );
    for (const t of j)
      for (const nd of t.nodes)
        assert.equal(nd.kind === 'modifier' || nd.kind === 'transmuter', nd.parent_id !== null);
  },
);
