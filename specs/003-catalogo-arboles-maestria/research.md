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
