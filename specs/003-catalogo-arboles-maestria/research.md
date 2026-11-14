# Research: Catálogo propio de árboles de maestría (Fase 0)

**Feature**: `003-catalogo-arboles-maestria` | **Fase**: 0 — Investigación de formato
**Tareas**: T001, T002, T003, T004 de [`tasks.md`](tasks.md)

Cada sección la rellena la tarea que la nombra. Toda afirmación lleva su evidencia
(comando y salida real, o URL con revisión). Ningún archivo del juego (`.arz`, `.dbr`,
`.arc`, traducciones) se versiona: aquí solo se citan nombres de campo y valores factuales.

<!-- ===================================================================== -->

## T001 — Extracción real de `.arz`/`.dbr` en la versión instalada

### Versión del juego

```text
> (Get-Item 'Grim Dawn.exe').VersionInfo | Format-List FileVersion,ProductVersion
FileVersion    : 0.3.0.0
ProductVersion : 0.3.0.0
> steamapps\appmanifest_219990.acf  ->  "buildid" "25813250"  (TargetBuildID 25813250)
> database\database.arz  58 529 720 bytes, modificado 2026-10-12
```

El `FileVersion` del ejecutable (`0.3.0.0`) es un número interno poco informativo; la
referencia verificable de la versión instalada es el `buildid` de Steam `25813250`.
No hay expansiones instaladas: no existe ningún `gdx*` ni más `*.arz` en
`database\` (solo `database.arz` y `templates.arc`).

### Formato observado del `.arz` (cabecera 2/3, little-endian)

- Cabecera (24 bytes): `uint16 magic=2`, `uint16 version=3`, `uint32 recordStart`,
  `uint32 recordBytes`, `uint32 recordCount`, `uint32 stringStart`, `uint32 stringBytes`.
  Real: `recordStart=53208441`, `recordCount=34180`, `stringStart=54551066`.
- Tabla de cadenas (en `stringStart`): `uint32 n` (82 999) y `n` × (`uint32 len` + bytes
  latin1). Los nombres de campo y los valores de texto se referencian por índice.
- Tabla de registros (en `recordStart`), por registro: `uint32` índice de cadena de la
  ruta, `uint32 len` + tipo (p. ej. `Skill_Mastery`), `uint32 offset`,
  `uint32 compressed`, `uint32 size`, `8 bytes` de marca de tiempo (FILETIME).
- Datos: en `24 + offset`, `compressed` bytes, **LZ4 formato bloque** (sin cabecera de
  frame); descomprimidos suman `size`. Node no trae LZ4: el script incluye un
  descompresor de ~25 líneas, sin dependencias.
- Contenido de un registro: secuencia de campos `uint16 tipo`, `uint16 n`,
  `uint32` índice de cadena del nombre y `n` × `uint32` valores. Tipos: 0 = int32,
  1 = float32, 2 = índice de cadena, 3 = bool.

### Rutas de registros

Las 9 maestrías instaladas (`records/skills/playerclassNN/_classtraining_classNN.dbr`,
tipo `Skill_Mastery`). `FileDescription` solo está en las seis primeras:

| NN  | Registro de maestría                                      | `FileDescription` |
| --- | --------------------------------------------------------- | ----------------- |
| 01  | `records/skills/playerclass01/_classtraining_class01.dbr` | Soldier           |
| 02  | `records/skills/playerclass02/_classtraining_class02.dbr` | Demolition        |
| 03  | `records/skills/playerclass03/_classtraining_class03.dbr` | Occult            |
| 04  | `records/skills/playerclass04/_classtraining_class04.dbr` | Nightblade        |
| 05  | `records/skills/playerclass05/_classtraining_class05.dbr` | Arcanist          |
| 06  | `records/skills/playerclass06/_classtraining_class06.dbr` | Shaman            |
| 07  | `records/skills/playerclass07/_classtraining_class07.dbr` | (sin campo)       |
| 08  | `records/skills/playerclass08/_classtraining_class08.dbr` | (sin campo)       |
| 09  | `records/skills/playerclass09/_classtraining_class09.dbr` | (sin campo)       |

Otras rutas relevantes:

- `records/skills/playerclassNN/<habilidad>.dbr`: la habilidad (`skillTier`,
  `skillMaxLevel`, `skillDisplayName`…); `pets/` contiene invocaciones, no nodos.
- `records/skills/playerclassNN/_classtree_classNN.dbr` (tipo `SkillTree`): lista
  `skillName1..N` con las rutas de las habilidades del árbol. Su `ActorName` de
  `class01` dice «Demolition Skill Tree» aunque `class01` es Soldier (dato del juego).
- `records/ui/skills/classNN/skillMM.dbr`: nodo de UI con la posición
  (`bitmapPositionX/Y`) y `skillName` → registro de la habilidad. `classtraining.dbr`
  es el botón de la maestría (`skillName` → `_classtraining_classNN.dbr`).

### Salida real del script (recortada)

```text
> node --experimental-strip-types --no-warnings scripts/extract-mastery-trees.mts --game-dir "C:\Program Files (x86)\SteamOffline\steamapps\common\Grim Dawn"
# cabecera {"magic":2,"version":3,"recordStart":53208441,"recordBytes":1342625,"recordCount":34180,"stringStart":54551066,"stringBytes":3978638} cadenas=82999 registros=34180
# maestrías (registro -> FileDescription)
records/skills/playerclass01/_classtraining_class01.dbr -> Soldier
(... 8 maestrías más, ver tabla ...)
## records/skills/playerclass01/_classtraining_class01.dbr  [Skill_Mastery]
FileDescription = Soldier
MasteryEnumeration = SkillClass01
skillBaseDescription = tagClass01SkillDescription00A
skillDisplayName = tagClass01SkillName00A
skillMasteryLevelRequired = 0
skillMaxLevel = 50
skillUpBitmapName = ui/skills/skillallocation/skills_class01trainingbuttonup.tex
## records/ui/skills/class01/skill11.dbr  []
bitmapPositionX = 326
bitmapPositionY = 389
isCircular = true
skillName = records/skills/playerclass01/willtolive1.dbr
skillOffsetX = 4
skillOffsetY = 4
## records/skills/playerclass01/willtolive1.dbr  [Skill_PassiveOnLifeBuffSelf]
Class = Skill_PassiveOnLifeBuffSelf
skillBaseDescription = tagClass01SkillDescription08A
skillCooldownTime = 25, 24, 23, 22, 21, 20, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, ...
skillDisplayName = tagClass01SkillName08A
skillMasteryLevelRequired = 0
skillMaxLevel = 16
skillTier = 2
skillUltimateLevel = 26
```

Ejemplo de modificador (`--record records/skills/playerclass01/bladearc2.dbr`, tipo
`Skill_Modifier`): `skillMaxLevel = 12`, `skillTier = 7`, `skillUltimateLevel = 22`.

### Hallazgos para T002/T006

- No existe `skillDependancy` en `playerclass01`: los únicos campos de tipo
  tier/dependencia son `skillTier` y `skillMasteryLevelRequired`. La relación
  padre→modificador no está en un campo explícito; hay que derivarla (convención de
  nombre `xxx1` / `xxx1b` y/o `Skill_Modifier` + adyacencia en la UI). Queda para T002.
- `skillTier` observado: 2 (habilidad) y 7 (modificador).

### Bloqueos y alternativa

Sin bloqueos: el `.arz` se lee con parser propio (cabecera, cadenas, registros, LZ4
bloque). No hizo falta `ArchiveTool.exe`; queda como alternativa si cambia el formato.
Solo lectura sobre la instalación; el script no escribe ningún archivo.

<!-- ===================================================================== -->

<!-- separador T001/T002: no editar -->

<!-- ===================================================================== -->

## T002 — Tabla `tier → bar_required` y mapa de campos

Versión del juego: la de T001 (`buildid` 25813250). Solo lectura sobre `database.arz`; no se
modificó `scripts/extract-mastery-trees.mts` (no hizo falta ningún flag nuevo). Los volcados
masivos (186 nodos de UI de las seis maestrías con árbol) se hicieron con scripts
desechables que importan `Arz` del script del repo y escriben en `%TEMP%\gdb-t002\` (fuera del
repo); aquí solo se citan nombres de campo y valores factuales.

### 1. `tier → bar_required`

Fuente: registro del motor, un único campo con los umbrales (`records/game/gameengine.dbr`):

```text
> node --experimental-strip-types --no-warnings scripts/extract-mastery-trees.mts --game-dir "<juego>" --record records/game/gameengine.dbr | grep -E "^##|skillMasteryTierLevel"
## records/game/gameengine.dbr  []
skillMasteryTierLevel = 1, 5, 10, 15, 20, 25, 32, 40, 50
```

Es el único campo de la BD con ese nombre entre las ramas `records/game/`, `records/ui/` y
`records/skills/` (búsqueda por nombre de campo `tier|MasteryLevel|Requirement`). El índice _i_
(1-based) del array corresponde al `skillTier` _i_:

| `skillTier`    | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |
| -------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bar_required` | 1   | 5   | 10  | 15  | 20  | 25  | 32  | 40  | 50  |

- **Coincide exactamente con los hitos del plan** (1/5/10/15/20/25/32/40/50): sin diferencias.
- Tier 1 exige **1** punto de maestría (no 0). El máximo, 50, coincide con
  `skillMaxLevel = 50` del registro `Skill_Mastery` (T001).
- **Inferencia (no demostrada por un campo)**: que el tier _i_ se desbloquea con
  `bar_required[i]` puntos _asignados en esa maestría_ es la lectura natural del nombre
  `skillMasteryTierLevel` y de los valores, pero la BD no trae la regla de evaluación (vive en
  el ejecutable). No se consultó la wiki (no hacía falta y Q1 sigue sin confirmar).
- `skillMasteryLevelRequired` de cada habilidad vale **0** (o está ausente) en los 186 nodos de
  UI: no sirve como fuente del umbral.
- **Modificadores y transmutadores**: tienen su propio `skillTier`, siempre en una columna
  _posterior_ a la de su habilidad base (97 de 97, ver §3); nunca comparten tier con su padre.
- Tiers vacíos: ninguno; las seis maestrías con árbol ocupan los 9 tiers.

### 2. Tier frente a la posición en la UI

Cada nodo de `records/ui/skills/classNN/skillMM.dbr` da `bitmapPositionX/Y` y `skillName`
(registro de la habilidad). En las seis maestrías con UI (`class01`–`class06`) las columnas X son
**las mismas nueve**, con paso constante de 80 px:

| X (`bitmapPositionX`) | 246 | 326 | 406 | 486 | 566 | 646 | 726 | 806 | 886 |
| --------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `skillTier` observado | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |

`tier = (X − 246) / 80 + 1`. Resultado sobre los 186 nodos: **0 nodos con tier ≠ columna**
(donde el tier se pudo leer). `class01` (Soldier) y `class06` (Shaman) cumplen la tabla
íntegra; en `class01`, por ejemplo, `weaponpool1`/`shieldhammer1`/`cadence1` están en X=246 con
`skillTier = 1` y `stanceoffensive`/`stancedefensive` en X=886 con `skillTier = 9`.
`bitmapPositionY` toma valores no uniformes (39, 71, 109, 142, 179, 211, 249, 281, 319, 351,
389, 459…): es la fila visual, sin relación con el tier; las filas «intermedias» las ocupan
los transmutadores, desplazados ~32–38 px de su habilidad.

Desajustes de **datos** (no de tier/columna):

- **Nodos sin `skillTier` en su propio registro** (envoltorios): la habilidad de UI es un
  registro `Skill*`/`SkillSecondary_*` casi vacío que apunta a otro con `buffSkillName` (p. ej.
  `fieldcommand1` → `fieldcommand1buff.dbr`, `skillTier = 5`, `skillMaxLevel = 12`) o
  `petSkillName` (`mortartrap2_petmod` → `mortartrap2.dbr`, tipo `Skill_Modifier`). Seguir ese
  puntero resuelve el tier salvo en los cinco casos siguientes.
- **5 nodos `SkillSecondary_PetModifier` sin tier ni rangos** (`petSkillName` apunta a
  `pets/petskill_*`, tipo `Skill_BuffOther`, sin `skillTier`/`skillMaxLevel`): `class03`
  `summon_raven2_petmodifier`, `summon_raven3_petmodifier`, `summon_hellhound3_petmodifier`;
  `class06` `totem2_petmodifier`, `summon_briarthorn3_petmodifier`. El tier solo sale de la
  **columna X**; `max_rank`/`ultimate_rank` no están en la BD para ellos.
- **3 nodos de UI con `skillName` colgante** (el registro no existe en `database.arz`):
  `class03/skill31` → `bloodofdreeg1b.dbr`, `class05/skill27` → `mindovermatter1b.dbr`,
  `class06/skill23` → `devouringswarm1b.dbr`; tampoco aparecen en `_classtree_classNN.dbr`.
  Se comprobaron todos los nodos de `records/ui/skills/class0[1-6]/`. El catálogo debe
  **excluirlos** (probables transmutadores retirados; el dato solo prueba que no existen).
- Los `skillName1..N` de `_classtree_classNN.dbr` coinciden con los nodos de UI salvo la propia
  maestría (`_classtraining_classNN.dbr`), que figura en el árbol (`class01`: 33 entradas = 32
  nodos + maestría).

Nodos de UI por maestría (tier leído en el propio registro + vía envoltorio + sin tier):
`class01` 32 (30 + 2 + 0), `class02` 33 (29 + 4 + 0), `class03` 30 (21 + 6 + 3), `class04` 31
(28 + 3 + 0), `class05` 30 (28 + 2 + 0), `class06` 30 (23 + 5 + 2) = **186 nodos** (los 3 de
`class03` y los 2 de `class06` sin tier son los petmods anteriores).

### 3. Mapa de campos (para T005/T006)

| Campo del catálogo | Origen (registro → campo)                                                           | Tipo                | Regla de derivación                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mastery`          | `_classtraining_classNN.dbr` → `MasteryEnumeration` (`SkillClassNN`)                | string              | `NN` de la ruta; `FileDescription` solo existe en 01–06                                                                                                                                                                |
| `mastery.name`     | `_classtraining_classNN.dbr` → `skillDisplayName` (p. ej. `tagClass01SkillName00A`) | tag de localización | tal cual (resolver el texto es otra tarea)                                                                                                                                                                             |
| `id`               | nombre del registro de la habilidad sin `.dbr` (`willtolive1`)                      | string              | único dentro de la maestría; prefijo `classNN/` en el id global                                                                                                                                                        |
| `name`             | habilidad → `skillDisplayName` (tag)                                                | tag                 | si el registro es envoltorio, el del destino (`buffSkillName`/`petSkillName`) cuando exista                                                                                                                            |
| `description`      | habilidad → `skillBaseDescription` (tag)                                            | tag                 | ídem                                                                                                                                                                                                                   |
| `tier`             | habilidad (o destino del envoltorio) → `skillTier`                                  | int 1–9             | si falta (5 petmods): `(bitmapPositionX − 246) / 80 + 1`                                                                                                                                                               |
| `bar_required`     | `records/game/gameengine.dbr` → `skillMasteryTierLevel[tier − 1]`                   | int                 | tabla de §1                                                                                                                                                                                                            |
| `max_rank`         | habilidad (o destino) → `skillMaxLevel`                                             | int                 | observados: base 16/12/10/8; modificador 12/10/8; transmutador 3 ó 1                                                                                                                                                   |
| `ultimate_rank`    | habilidad (o destino) → `skillUltimateLevel`                                        | int                 | observado `max + 10` en base y modificador, igual a `max` en transmutadores; ausente en 2 transmutadores y 5 petmods                                                                                                   |
| `grid.col`         | nodo de UI → `bitmapPositionX`                                                      | int                 | `(X − 246) / 80 + 1` (= `tier`, 0 discrepancias)                                                                                                                                                                       |
| `grid.row`         | nodo de UI → `bitmapPositionY`                                                      | int                 | valor crudo; la rejilla de filas se declara en T005 (alturas no uniformes, §2)                                                                                                                                         |
| `kind`             | habilidad → `Class` (tipo del registro)                                             | enum                | `Skill_Modifier`, `Skill_ProjectileModifier`, `SkillSecondary_*` → modificador; `Skill_Transmuter`, `Skill_ProjectileTransmuter` → transmutador; `Skill_Passive*` → pasiva; resto → activa; `Skill_Mastery` → maestría |
| `parent`           | (derivado; no existe campo)                                                         | id                  | ver regla más abajo                                                                                                                                                                                                    |
| `icon` (opc.)      | habilidad → `skillUpBitmapName`                                                     | ruta `.tex`         | solo el nombre; no se versiona el arte                                                                                                                                                                                 |

Campos que **no existen** en `class01`–`class06`: `skillDependancy*`, `skillBaseName`. Los
registros de modificador/transmutador no llevan ningún puntero al padre.

**Regla `parent` (verificada)**: para un nodo cuyo `Class` es modificador, transmutador o
`SkillSecondary_*`, el padre es el nodo **no hijo** de la misma maestría cuya _familia_ coincide
y cuya columna es la más cercana por la izquierda. Familia = id sin el sufijo
`_petmodifier`/`_petmod`, sin `_modN`, sin dígitos finales y sin una `b`/`c` final
(`bladearc1b` → `bladearc`, `ringofsteel_mod0` → `ringofsteel`, `shieldhammer3` →
`shieldhammer`). Una excepción de datos: `natureblessing1` (raíz) frente a `naturesblessing2/3`
(hijos) en `class06`, con una `s` de más; se resuelve con un alias explícito.

Verificación sobre las seis maestrías: **97 hijos** (modificador/transmutador/secundario); la
regla asigna padre a los **97** y en los 97 la columna del padre es **estrictamente menor** que
la del hijo. Comparada con una regla geométrica independiente (raíz más cercana por la izquierda
con |ΔY| ≤ 40) coinciden 89 de 97; en 7 de las 8 discrepancias son transmutadores colocados en
una fila intermedia (`bladearc1b`, `canisterbomb1b`, `flamestrike2c`, `witchfire1b`, `pox1b`,
`ringofsteel_mod0`, `aetherray1b`), donde falla la geometría, y la restante es
`class02/passive2` (abajo). Para **`class01`: 32 nodos = 19 raíces + 13 hijos; los 13 hijos se
resuelven por nombre y 0 quedan ambiguos**:

```text
cadence2<-cadence1 cadence3<-cadence1 shieldhammer2<-shieldhammer1 shieldhammer3<-shieldhammer1
blitz2<-blitz1 bladearc2<-bladearc1 fieldcommand2<-fieldcommand1 warcry2<-warcry1
cadence1b<-cadence1 bladearc1b<-bladearc1 warcry1b<-warcry1 shieldhammer1b<-shieldhammer1
overguard1b<-overguard1
```

Ambiguos en todo el conjunto: **1** — `class02/passive2` (`Skill_Modifier`, columna 9, fila 249)
resuelve por nombre a `passive1` (columna 7, fila 39), pero la geometría apunta a otro nodo;
requiere decisión en T005. Las demás `passiveN` son raíces independientes.

Descartado como regla de `parent`: el array `skillConnectionOn/Off` de cada habilidad (lista
de texturas de conector, solo en habilidades con descendientes). Describe el dibujo, pero su
longitud no es función fiable de la distancia al hijo más lejano (`shieldhammer1`: 6 elementos
y hijo más lejano a 5 columnas; `blitz1`: 4 y a 4; `overguard1`: 1 y a 1), así que no se usa.

### 4. Cobertura

- Registros `records/skills/playerclassNN/_classtraining_classNN.dbr`: **9** (`NN` = 01–09); el
  selector de clases de la UI tiene 9 botones (`skills_classselectionbutton01..09.dbr`).
- Solo **01–06** tienen árbol real: 30–33 nodos de UI cada una y 35–38 archivos de habilidad.
- **07, 08 y 09 son esqueletos**: `records/skills/playerclassNN/` solo contiene
  `_classtraining_classNN.dbr` y `_classtree_classNN.dbr`; el árbol lista un único `skillName1`
  (la maestría), y **no existe** `records/ui/skills/classNN/` ni habilidades. Sus
  `skillDisplayName`/`skillBaseDescription` son `TagClassNNSkillName00`/`…Description00`
  (capitalización distinta de las de 01–06) y no tienen `FileDescription`.
- Por tanto esta instalación permite catalogar **6 maestrías con árbol**, no diez; la BD no
  permite extraer los árboles de 07–09. T001 ya registró que no hay expansiones instaladas
  (`database\` solo contiene `database.arz` y `templates.arc`). Los datos no dicen a qué
  maestrías de la spec corresponden `class07`–`class09`, y no se especula aquí. Para T005/T006:
  el catálogo cubre las maestrías con nodos de UI y la spec debe reconciliar «diez maestrías»
  con lo extraíble.

**Decisión (decisión de Paco, 2026-11-13)**: v1 = `class01`–`class06` (las 6 maestrías base);
expansiones fuera de v1.

<!-- ===================================================================== -->

<!-- separador T002/T003: no editar -->

<!-- ===================================================================== -->

## T003 — Decisión de parser (propio mínimo vs librería)

Decisión tomada el 2026-11-13. Fuentes consultadas por lectura web; no se descargó nada al repo.

### Formato `.arz` (según `gd-utility/gd_arc_browser/docs/ARZ.md`)

- Cabecera de 24 bytes sin magic (`u16` desconocido = 2, `u16` versión = 3, inicio y tamaño de la
  tabla de registros, nº de registros, inicio y tamaño de la tabla de cadenas); pie de 16 bytes sin
  significado conocido; sin checksums documentados.
- Tabla de registros de longitud variable (índice de nombre, clase, offset, `compressedSize`,
  `decompressedSize`, `FILETIME`) y tabla de cadenas (`u32` cuenta + cadenas con prefijo de longitud).
- **Compresión: LZ4 en bloque, sin cabecera de frame, un bloque por registro** (no zlib; zlib era el
  formato de versiones antiguas según el foro de Crate, lo que explica que `ArchiveTool.exe` pida
  `zlibwapi.dll`).
- Carga útil descomprimida: lista plana de campos `u16 tipo, u16 count, u32 índice-de-nombre, u32[count]`
  (0 = int, 1 = float, 2 = índice de cadena, 3 = bool); los campos deben cubrir la carga exacta, lo que
  sirve de autovalidación.
- **Node 22 no trae LZ4**: `node:zlib` ofrece deflate/gzip/brotli y zstd (22.15, experimental), no LZ4
  ([docs](https://nodejs.org/docs/latest-v22.x/api/zlib.html)). Un descompresor LZ4 de bloque son
  ~30 líneas de TypeScript. Contraste con el juego real: lo valida T001.

### Comparativa

| Opción                                                                      | Licencia (verificada)                                                                                                                                                                                               | Lenguaje                | Mantenimiento                                                                 | Tamaño                                                      | Deps.                                | ¿Utilizable desde Node?                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| **Parser propio mínimo**                                                    | del repo (el parser es código propio)                                                                                                                                                                               | TypeScript              | el nuestro                                                                    | estimado ~150–250 líneas (cabecera + tablas + LZ4 + campos) | ninguna (`node:fs`)                  | Sí, sin dependencia nueva                                                        |
| [`R-Hidayatullah/gd-utility`](https://github.com/R-Hidayatullah/gd-utility) | MIT, [LICENSE](https://raw.githubusercontent.com/R-Hidayatullah/gd-utility/master/LICENSE) («Copyright (c) 2026 Ridwan Hidayatullah»), commit `1d468f5`, leído 2026-11-13                                           | C++20 (CMake)           | último push 2026-08-30; repo de 2,6 MB, un solo commit visible de importación | ~2,6 MB (incluye investigación de ingeniería inversa)       | compilador C++20                     | No hay paquete npm: solo sirve como **especificación** (`docs/ARZ.md`, `DBR.md`) |
| [`xaviershay/gd-explorer`](https://github.com/xaviershay/gd-explorer)       | BSD-3-Clause, [LICENSE](https://raw.githubusercontent.com/xaviershay/gd-explorer/main/LICENSE) (texto BSD-3 con el titular **sin rellenar**: «Copyright 2026 Author name here»), commit `e18991e`, leído 2026-11-13 | Haskell (Stack)         | último push 2026-07-06; el README dice «probably out of date»                 | 453 KB                                                      | toolchain Haskell + paquetes Hackage | No; ni siquiera confirmado que cubra la versión actual                           |
| [`gregates/gddb`](https://github.com/gregates/gddb)                         | GPL-3.0 (README/metadatos de GitHub; no se leyó el archivo LICENSE)                                                                                                                                                 | Rust                    | no determinado                                                                | no medido                                                   | crates Rust                          | Descartada por licencia copyleft                                                 |
| [`atom0s/grimarz`](https://gitlab.com/atom0s/grimarz)                       | no verificada (GitLab devolvió 403)                                                                                                                                                                                 | n/d                     | n/d                                                                           | n/d                                                         | n/d                                  | No evaluable                                                                     |
| `ArchiveTool.exe` (Crate)                                                   | Sin licencia publicada para la herramienta; términos en el EULA/Modding Guide de Crate (**no verificados**: el PDF no se pudo leer, `pdftoppm` ausente; la búsqueda web no halló el texto del EULA)                 | binario Windows cerrado | lo distribuye el juego                                                        | n/d                                                         | `zlibwapi.dll`                       | Solo como CLI local                                                              |

No se encontró ningún paquete npm mantenido que lea `.arz` (búsqueda web 2026-11-13, sin resultados
relevantes); los lectores conocidos son C++, Haskell, Rust y Go (`arc0`).

### Decisión

**Parser propio mínimo en TypeScript con builtins de Node (`node:fs`, `node:crypto` para el sha256)
y un descompresor LZ4 de bloque propio**, dentro de `scripts/extract-mastery-trees.mts`.

- **Tamaño (Constitución IV)**: cero dependencias nuevas y cero bytes en el bundle de producto (el
  script no se despliega). Cualquier librería añadiría un toolchain (C++/Haskell/Rust) o un paquete
  sin mantener a cambio de ~200 líneas.
- **Licencia**: nada ajeno entra en el repo. MIT/BSD-3 permitirían reutilizar código, pero las dos
  únicas con licencia permisiva no están en un lenguaje que Node pueda consumir; usamos `gd-utility`
  solo como especificación del formato (hechos, no código copiado), citada en la fuente.
- **Verificabilidad**: la propia estructura (`recordTableStart + recordTableSize == stringTableStart`,
  campos que cubren la carga exacta) permite probar el parser y fallar de forma explícita ante cambios
  de formato.

### Alternativa descartada

**Librería comunitaria (`gd-utility` MIT / `gd-explorer` BSD-3)**: descartada porque ninguna es
utilizable desde Node sin compilar un toolchain ajeno (C++20/Haskell) ni dar un paquete instalable;
`gd-explorer` además admite estar desactualizada y su LICENSE no identifica al titular. `gddb` queda
fuera por GPL-3.0. **`ArchiveTool.exe`** se descarta como solución del repo: es un binario cerrado de
Crate sin licencia de redistribución verificada, solo Windows y con el juego instalado, por lo que no
puede ir al repo (VII) ni a CI (no hay juego en CI); queda como **fallback manual local** para extraer
`.dbr` a una carpeta fuera del repo y contrastar el resultado del parser.

### Riesgos

- El formato no es oficial y está documentado por ingeniería inversa de terceros: un parche del juego
  puede cambiarlo. Mitigación: validar estructura y fallar con mensaje claro; registrar `game_version`
  y sha256 del `.arz` (T006).
- Descompresor LZ4 propio: riesgo de bug en casos límite. Mitigación: contrastar con `ArchiveTool`
  sobre una muestra (T001) y pruebas con vectores LZ4 pequeños.
- Términos de Crate sin verificar (EULA/Modding Guide): pendiente de lectura humana; el diseño no
  versiona ningún archivo del juego, solo valores factuales (VII).
- `gd-utility` se lee como referencia de formato; si en el futuro se copia código, hay que conservar
  su aviso MIT.
- Hechos a confirmar con el juego real (T001): LZ4 y tamaño de cabecera en la versión instalada.

<!-- ===================================================================== -->

<!-- separador T003/T004: no editar -->

<!-- ===================================================================== -->

## T004 — Licencia de la wiki (Q1)

Comprobado en vivo el **2026-11-13** (solo lectura de la página de derechos y de metadatos
del sitio; sin scraping ni copia de contenido de la wiki, Constitución II).

**Página de derechos**: <https://grimdawn.miraheze.org/wiki/Project:Copyrights?oldid=82>

| Dato                 | Valor                                    |
| -------------------- | ---------------------------------------- |
| Revisión actual      | `oldid=82` (padre 81), pageid 7, ns 4    |
| Fecha de la revisión | 2020-05-21T16:52:07Z                     |
| Autor                | `Rostiger Bot`                           |
| Revisión previa      | 81 (2019-01-11, `wikia:grimdawn>Pcjbot`) |

Fuente (API MediaWiki):

```text
GET https://grimdawn.miraheze.org/w/api.php?action=query&prop=revisions&titles=Project:Copyrights&rvprop=ids|timestamp|user|content&rvslots=main&format=json
-> {"pages":{"7":{"title":"Project:Copyrights","revisions":[{"revid":82,"parentid":81,
   "user":"Rostiger Bot","timestamp":"2020-05-21T16:52:07Z", ...
GET ...api.php?action=query&prop=revisions&titles=Project:Copyrights&rvprop=ids|timestamp|user&rvlimit=5&format=json
-> revids 82, 81, 80, 79, 78 (82 es la más reciente)
```

### Cita literal — cuerpo de la página (wikitext de `oldid=82`)

> All textual and graphical content on {{SITENAME}} that we may lawfully license is licensed
> to you under the Creative Commons [Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)]
> license.

(enlace a `https://creativecommons.org/licenses/by-sa/3.0/`). Las otras frases de la página:
el contenido del juego es propiedad intelectual de sus titulares; el contenido que aporta un
usuario se licencia a la wiki bajo los Terms of Service de Fandom.

### Cita literal — pie de página (`$wgRightsText`)

```text
GET https://grimdawn.miraheze.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json
-> {"query":{"rightsinfo":{"url":"","text":"Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)"}}}
```

> Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)

Limitación: el HTML renderizado (`?oldid=82`) devuelve HTTP 403 (desafío anti-bot) a clientes
no interactivos, así que el texto exacto del pie («Content is available under … unless
otherwise noted») no se pudo volver a leer hoy; sí se confirmó su licencia vía `rightsinfo`.
`url` está vacío (el pie no enlaza a la licencia por API).

### Política general de Miraheze

Terms of Use de Miraheze, sección 2 («Copyright»), revisión `oldid=492660` (2025-09-24):
<https://meta.miraheze.org/wiki/Terms_of_Use>

> By default, wikis have contents licensed under the Creative Commons Attribution-ShareAlike
> 4.0 License. Wiki owners can change this; see Help:Changing your wiki license.

(Fuente: `https://meta.miraheze.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Terms_of_Use&format=json`.)
Esto explica el 4.0 del pie (valor por defecto de la plataforma) frente al 3.0 de la página
de derechos (texto heredado de Fandom, 2020).

### Contradicción

Se **confirma** lo registrado en `spec.md` §0.1: `oldid=82`, cuerpo **CC BY-SA 3.0**, pie
(`$wgRightsText`) **CC BY-SA 4.0**. Sin diferencias respecto a la comprobación del 2026-11-12
(mismo `oldid`, mismas licencias).

### Decisión aplicada (SC-006)

Paco **aún no ha respondido** Q1 (`spec.md` §6). Resolución propuesta vigente, aplicada con
carácter **provisional**:

1. Aplicar **CC BY-SA 3.0** (la del cuerpo; más explícita para el contenido).
2. **No copiar nada de la wiki** (ni texto, ni imágenes, ni coordenadas) hasta confirmación
   escrita de Paco.
3. El catálogo derivado de los `.dbr` no depende de esta licencia (FR-002–FR-006).

Estado: pendiente de confirmación escrita de Paco.

_Lo anterior queda **superado** por la decisión final de abajo; se conserva como histórico._

#### Decisión final (decisión de Paco, 2026-11-13)

Licencia de la wiki = **CC BY-SA 4.0** (sustituye la decisión provisional 3.0). Obras derivadas
de la wiki bajo CC BY-SA 4.0 con atribución y share-alike. La wiki sigue sin ser fuente por
defecto: la licencia queda resuelta, no autoriza scraping.

## T022 — Textos de localización (.arc)

Investigado el 2026-11-13 sobre la instalación local (build Steam 25813250). Solo se citan nombres de
tag y unos valores como dato factual; ningún `.arc` ni volcado de textos entra en el repo.

### Contenedor `.arc` (versión 3, little-endian)

`resources/Text_EN.arc` (471 531 bytes) y `resources/Text_ES.arc` (2 447 988 bytes); hay más idiomas
(`Text_CS`, `_DE`, `_FR`, … `_ZH`), fuera de alcance. Estructura verificada con ambos archivos:

- **Cabecera (28 bytes, datos desde 2048)**: `"ARC\0"`, `u32` versión (= 3), `u32` nº de archivos,
  `u32` nº de partes, `u32` tamaño de la tabla de partes, `u32` tamaño de la tabla de cadenas, `u32`
  offset del índice (tabla de partes). En EN: `0x435241 3 0xb 0xb 0x84 0xb8 0x72ecb`.
- **Índice (al final del archivo)**: tabla de partes (`nPartes × 12` bytes: `u32` offset de datos, `u32`
  tamaño comprimido, `u32` tamaño real), a continuación la tabla de cadenas (nombres de archivo
  concatenados, sin separador) y, hasta el final del archivo, `nArchivos × 44` bytes de registros. En EN
  `índice + 132 + 184 + 11×44 = 471 531` (tamaño exacto del archivo): autovalidación del formato.
- **Registro de archivo (44 bytes)**: `u32` modo de almacenamiento (3 = LZ4), `u32` offset, `u32`
  tamaño comprimido, `u32` tamaño real, `u32` checksum, `u64` marca de tiempo (FILETIME), `u32` nº de partes,
  `u32` índice de la primera parte, `u32` longitud del nombre, `u32` offset del nombre en la tabla de cadenas.
- **Compresión**: cada parte es un bloque LZ4 sin cabecera de frame (el mismo que el `.arz`); el
  archivo es la concatenación de sus partes descomprimidas. Una parte con tamaño comprimido = real se
  trata como almacenada sin comprimir. En ambos archivos todos los archivos tienen 1 parte, modo 3.
- `Text_EN.arc` contiene 11 archivos planos; `Text_ES.arc`, 1 161 (incluye subcarpetas como `aom/`).

### Archivos de etiquetas y dónde están los nombres

Salida real (recortada) de listar `Text_EN.arc` por el lector de la investigación:

```text
credits  tags_achievements.txt  tags_console.txt  tags_creatures.txt  tags_items.txt
tags_mutators.txt  tags_skills.txt  tags_storyelements.txt  tags_tutorial.txt  tags_ui.txt  tags_uimain.txt
```

Los nombres de maestrías y habilidades están **solo en `tags_skills.txt`** (EN y ES; 2 175 / 2 197
etiquetas, sin duplicados). Los 192 tags que usa el catálogo (6 maestrías + 186 nodos) existen en
ambos idiomas (0 ausentes en EN y en ES):

```text
EN: tagClass01SkillName00A=Soldier   tagClass02SkillName00A=Demolitionist   tagClass01SkillName01A=Cadence   tagClass01SkillName01B=Fighting Form
ES: tagClass01SkillName00A=Soldado   tagClass02SkillName00A=Demoledor       tagClass01SkillName01A=Cadencia  tagClass01SkillName01B=Forma de Combate
```

(`tagClass03SkillName00` va sin letra: el Ocultista se llama «Ocultista» en ES.)

### Formato del `.txt`

- Líneas `tag=valor` (se parte por el **primer** `=`); finales `CRLF` y `LF` mezclados; sin BOM.
- Codificación: **ASCII** en EN y **UTF-8** en ES (p. ej. «Chamán», «Táctico»); se decodifica como UTF-8.
- Comentarios: líneas que empiezan por `#` (`#Default`, `#Class01`, …); líneas vacías ignoradas.
- Códigos de formato (recuento en `tags_skills.txt`, idénticos en EN y ES): `{^s}`, `{^g}`, `{^r}`, `{^-}`
  (color), `{%t0}`, `{%t1}`, `{%d0}`, `{%d1}` (marcadores de sustitución); en ES además marcas de
  género `[ms]`/`[fs]` (19 cada una; p. ej. `[ms]Táctico[fs]Táctica`). **Ninguno aparece** en los 192
  nombres del catálogo; el extractor los limpia igualmente (`{^…}` se elimina; `{%…}` se elimina; en una
  cadena con `[ms]…[fs]…` se toma la variante masculina) por si un parche los añade.

### Hashes (para `source.sha256[]`)

```text
Text_EN.arc  82defd8a0fddf71e8491b7494fada51b034b1af14ffc0a6cf9c8aabdf8700c25
Text_ES.arc  e6f785d155d0791b3100092762111f59a06faa9e1a86d91898ec98317e395752
```

### Decisiones

- Lector `.arc` mínimo propio en `scripts/extract-mastery-trees.mts` (solo `node:`), reutiliza `lz4Block`.
  Carga solo `tags_skills.txt` de cada idioma (único archivo con estos tags).
- ES ausente ⇒ valor EN y aviso por stderr con el conteo; EN ausente ⇒ error con el tag.
- `--no-localize` deja `name.en = name.es = tag` (comportamiento de T006) y no toca los `.arc`.

## T029 — Enmienda 1.10.0: arte del juego bajo tolerancia de facto

Decisión de Paco (2026-11-13, opción B): los **retratos de maestría** se versionan y publican
por el sitio; los **iconos de habilidad** se admiten solo en uso local por ahora. Es el
`proof_ref` de las entradas del manifiesto (`specs/003-catalogo-arboles-maestria/research.md#t029`).

> **No existe permiso escrito de Crate Entertainment.** La base del uso es tolerancia de facto
> de la comunidad, asumida como riesgo por el dueño del repositorio. La atribución no
> sustituye al permiso.

### Análisis de riesgos

| Riesgo                                       | Probabilidad                         | Impacto                         | Mitigación decidida                                                                                     |
| -------------------------------------------- | ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Crate pide retirar el arte                   | Media-baja (tolerancia con fansites) | Medio: los retratos se publican | Retirada inmediata (`status: withdrawn`, registro en `handoff.md`) y fallback propio en el mismo cambio |
| Publicar aumenta la exposición               | Alta                                 | Medio                           | Solo seis retratos derivados; atribución y no afiliación visibles; publicar iconos exige revisar esto   |
| Confundir tolerancia con licencia            | Alta                                 | Alto (deuda ética/legal)        | El texto lo dice literalmente y el manifiesto registra `tolerancia_de_facto_sin_permiso`                |
| Extender la excepción a más arte por inercia | Media                                | Alto                            | Bloques explícitos: fondos, marcos, otro arte, datos internos y Grim Tools solo por enmienda nueva      |
| Contaminar contenido con datos de Grim Tools | Media                                | Alto                            | §VII lo prohíbe; el esquema de fuentes no cambia; incorporación manual y editorial                      |

### Traza técnica (lo que ya existe)

- `AssetSchema` (`packages/domain/src/schema.ts`) exige para `status: approved`: `file_path`,
  `origin_url`, `rights_holder`, `license_or_permission` y `proof_ref`; `fallback_svg` es
  obligatorio en toda entrada. La enmienda encaja sin cambiar el esquema.
- Salvedad: `ASSET_STATUSES` es `pending | approved | rejected`; la retirada con
  `status: withdrawn` exige añadir el valor (o mapearlo) al implementar T015.
- El manifiesto es `fixtures/content/assets/manifest.json` (vacío hoy) y `pnpm assets:check`
  rechaza archivos bajo `apps/web/public/assets/**` sin entrada `approved`.
- Ubicación prevista de los retratos: `apps/web/public/assets/portraits/<slug>.webp`.
- El interruptor `ASSET_SOURCE=own|game` y la iconografía propia son trabajo de T015.

### Decisión de dueño asumida

Riesgo asumido por el dueño del repositorio, sin permiso escrito de Crate. No es ausencia de
riesgo. Publicar iconos de habilidad exige revisar este análisis y tener terminado el fallback.
