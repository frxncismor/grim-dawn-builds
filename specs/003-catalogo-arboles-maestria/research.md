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

_Pendiente (T002, depende de T001)._

<!-- ===================================================================== -->

<!-- separador T002/T003: no editar -->

<!-- ===================================================================== -->

## T003 — Decisión de parser (propio mínimo vs librería)

_Pendiente (T003)._

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
