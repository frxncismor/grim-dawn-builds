# Catálogo de maestrías

[English](mastery-catalog.md) · **Español**

Cómo se construye el catálogo de árboles de habilidades de las maestrías, qué parte
se versiona, con qué base se usa el arte del juego y cómo retirarlo. Todo lo que
sigue está comprobado contra el repositorio; la especificación es
[`specs/003-catalogo-arboles-maestria/spec.md`](../../specs/003-catalogo-arboles-maestria/spec.md),
el plan es [`plan.md`](../../specs/003-catalogo-arboles-maestria/plan.md) y la
evidencia de cada decisión está en
[`research.md`](../../specs/003-catalogo-arboles-maestria/research.md). Esta página
los enlaza en lugar de copiarlos.

## Propósito y alcance

El catálogo es el árbol de habilidades canónico de cada maestría de Grim Dawn: de
cada nodo de habilidad, su id, nombre en inglés y español, tier (nivel requerido de
la barra de maestría), columna y fila de la rejilla, puntos máximos, nodo padre y
tipo (FR-003 de la spec).

- **Alcance de v1**: las **6 maestrías base** (`class01` a `class06`: Soldado,
  Demoledor, Ocultista, Hoja de la Noche, Arcanista y Chamán) y **186 nodos de
  habilidad** (Soldier 32, Demolitionist 33, Occultist 30, Nightblade 31, Arcanist
  30, Shaman 30). Las expansiones (Ashes of Malmouth, Forgotten Gods, Fangs of
  Asterkarn) y los mods quedan **fuera de v1**, por decisión de Paco del 2026-11-13;
  el esquema no impide añadirlas después.
- **Quién lo consume**: los datos fluyen en un solo sentido, de los fixtures
  versionados al sitio público.

```text
fixtures/content/mastery-trees/*.json
  -> pnpm db:seed (rol importer; tablas mastery_trees y catalog_skill_nodes)
  -> vistas públicas v_public_* (rol api_ro, solo lectura)
  -> GET /api/v1/masteries y GET /api/v1/masteries/:slug
  -> web: /maestrias y /maestrias/:slug (prerenderizadas en inglés y español)
```

Los builds locales y de CI sin backend leen esos mismos fixtures
(`CONTENT_SOURCE=fixture`); los builds de release leen la API
(`CONTENT_SOURCE=api`), sin fallback silencioso (constitución XI). Las guías
editoriales (`skill_nodes`) pueden referenciar un nodo del catálogo mediante el
`skill_node_id` opcional; el catálogo nunca contiene campos editoriales (FR-006,
FR-015).

## Origen de los datos

- **Extracción local desde una copia legal del juego.** `pnpm catalog:extract` lee
  `database.arz` y los archivos de localización `Text_EN.arc` y `Text_ES.arc` de la
  instalación propia del mantenedor (tareas T001, T006 y T022). El repositorio
  recibe solo el JSON derivado y los hashes. No hay scraping ni contenido copiado de
  la wiki ni de ninguna web (constitución II).
- **Texturas** (tarea T028): `pnpm catalog:textures` decodifica los `.tex` de
  `resources/UI.arc` a PNG en `.game-assets/textures/`, que está en `.gitignore`.
- **Procedencia registrada en cada fixture** (`source`, idéntico en los seis
  archivos):

| Campo          | Valor                                                              |
| -------------- | ------------------------------------------------------------------ |
| `game_version` | `steam-build-25813250` (`buildid` de Steam)                        |
| `database.arz` | `9e3532250cdb611a4cc989997c8f97fcec2d6c422063a845e6c43cd538c30603` |
| `Text_EN.arc`  | `82defd8a0fddf71e8491b7494fada51b034b1af14ffc0a6cf9c8aabdf8700c25` |
| `Text_ES.arc`  | `e6f785d155d0791b3100092762111f59a06faa9e1a86d91898ec98317e395752` |

Los tres hashes son el array `source.sha256`, en ese orden. El sha256 de cada botón
de maestría publicado, con su `source_path` y tamaño, está en
[`fixtures/content/assets/manifest.json`](../../fixtures/content/assets/manifest.json)
(`provenance`). Cómo se sondeó el formato consta en `research.md` (secciones T001,
T022 y T028).

## Qué se versiona y qué no

Regla: FR-014 de la spec y constitución 1.10.1, sección VII.

| Elemento                                                                                                                   | Estado                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Datos factuales: nombres, tier, posición en la rejilla, límites de puntos, relaciones de padre, con los hashes de `source` | **Se versionan** en `fixtures/content/mastery-trees/*.json`                                               |
| Los seis **botones de maestría**, PNG de 197x41 sin modificar, publicados como «retratos» de maestría (decisión de Paco)   | **Se versionan** en `apps/web/public/assets/portraits/`, cada uno con entrada `approved` en el manifiesto |
| **Iconos de habilidad** (32x32)                                                                                            | Se extraen a `.game-assets/textures/` (nunca se versionan); se **publican** como PNG derivados con **una entrada de manifiesto por icono** solo tras la constitución 1.11.0 y el fallback propio |
| `.arz`, `.arc`, `.dbr`, volcados de localización, descripciones de habilidades                                             | **Nunca** se versionan                                                                                    |
| Fondos, marcos, otro arte, datos de Grim Tools                                                                             | **Nunca**; quedan fuera de las excepciones de la sección VII                                              |

Los fixtures llevan rutas `icon` y nombres de textura como simples cadenas: son
identificadores, no imágenes. Los avisos de atribución que acompañan a los datos
son
[`fixtures/content/mastery-trees/NOTICE.md`](../../fixtures/content/mastery-trees/NOTICE.md)
y
[`fixtures/content/assets/NOTICE.md`](../../fixtures/content/assets/NOTICE.md).

## Licencia y atribución

- **Atribución**: Grim Dawn © Crate Entertainment. Los nombres de habilidades y
  maestrías son propiedad de Crate y se usan como hecho, con atribución, para
  identificar elementos del juego. Las páginas que muestran los botones llevan un
  crédito visible a Crate.
- **Base del uso del arte**: **no existe permiso escrito de Crate Entertainment**.
  La base es **tolerancia de facto de la comunidad, asumida como riesgo por el dueño
  del repositorio**. La atribución no sustituye al permiso. Es el texto literal de
  la sección VII de la constitución (1.10.1); el análisis de riesgos es
  [`research.md`, sección T029](../../specs/003-catalogo-arboles-maestria/research.md),
  que es el `proof_ref` de cada entrada del manifiesto. Cada entrada registra
  `license_or_permission = tolerancia_de_facto_sin_permiso`.
- **Licencia de la wiki**: la wiki de Grim Dawn está bajo **CC BY-SA 4.0** (pregunta
  Q1, resuelta por Paco el 2026-11-13: el cuerpo de la página dice 3.0 y el pie
  dice 4.0; ver
  [`research.md`, sección T004](../../specs/003-catalogo-arboles-maestria/research.md)
  y la revisión
  [`Project:Copyrights?oldid=82`](https://grimdawn.miraheze.org/wiki/Project:Copyrights?oldid=82)).
  Esto solo fija los términos que aplicarían a cualquier obra derivada de la wiki
  (atribución y compartir igual). **No autoriza el scraping**: la wiki no es fuente
  por defecto, y el catálogo se genera solo desde los archivos del juego, así que no
  hereda esa obligación.
- **Sin afiliación**: este proyecto **no está afiliado ni respaldado por Crate
  Entertainment**. El aviso se muestra allí donde aparece el arte del juego.
- **Nada más queda cubierto**: las excepciones son explícitas, acotadas y
  reversibles, y ampliarlas exige una nueva enmienda constitucional.

## `ASSET_SOURCE`

Un único interruptor decide qué arte sirve el índice de maestrías (`/maestrias`). Se
lee en el servidor durante el prerenderizado
(`apps/web/src/app/core/content/portraits.server.ts`).

| Valor           | Efecto                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `own` (defecto) | Los iconos SVG propios del proyecto (`apps/web/src/assets/icons/mastery-*.svg`, el `fallback_svg` del manifiesto). No se sirve arte del juego. |
| `game`          | El botón de maestría del juego de cada maestría, solo para entradas `approved` con `license_or_permission = tolerancia_de_facto_sin_permiso`.  |

Sin definir equivale a `own`. Cualquier otro valor es un error, y falla cerrado: un
valor inválido, `game` sin manifiesto legible o una entrada aprobada mal formada
hacen fallar el build en lugar de degradarse en silencio.

- **Dónde se aplica `game`** (tarea T015, decisión de Paco del 2026-11-13): `pnpm
build:release` y los jobs de CI que construyen el artefacto medido (`verify` y
  `dast` en `.github/workflows/ci.yml`). El release además comprueba el manifiesto
  antes de construir (`assertGameAssets`) y se niega a construir salvo que las seis
  maestrías tengan un retrato `approved`. Los builds locales siguen en `own`. El
  release no da valor por defecto al interruptor: un `ASSET_SOURCE` sin definir es
  un error (T036, S-003).
- **Los PNG**: `angular.json` no copia `public/assets/portraits/`; solo
  `ASSET_SOURCE=game` los emite (`apps/web/tools/emit-portraits.mts`, que ejecutan
  `pnpm build` y `build:release`) y el release rechaza un artefacto `own` que lleve
  alguno (T036, S-001). `ng serve` y `--configuration development` los siguen sirviendo.
- **Fallback**: con `own`, o con una entrada ausente, `withdrawn` o no aprobada, la
  fila muestra el icono propio del proyecto. El sitio nunca se queda sin iconos. Los
  iconos de habilidad usan los iconos propios hasta que se publiquen bajo la constitución
  1.11.0 (una entrada de manifiesto por icono, `proof_ref` a
  [`research.md`, sección R10](../../specs/004-rediseno-ui-grim-dawn/research.md)).

## Procedimiento de retirada

Si Crate Entertainment, o quien tenga legitimación, pide retirar el arte, en **un
solo** cambio:

1. Poner las entradas afectadas del manifiesto en `status: withdrawn` (la entrada no
   lleva ruta de archivo) en `fixtures/content/assets/manifest.json`.
2. Borrar los PNG de `apps/web/public/assets/portraits/`.
3. Pasar a la iconografía propia: hacer el release con `ASSET_SOURCE=own`
   (`build:release` acepta un `own` explícito) y quitar `ASSET_SOURCE: game` de los
   jobs de CI que lo fijan.
4. Registrar la retirada en `handoff.md` y en el manifiesto.
5. Ejecutar `pnpm assets:check` y `pnpm verify`, y reconstruir y republicar.

El procedimiento general de retirada, el objetivo operativo de 72 horas, el canal y
la evidencia que se conserva están en [`takedown-runbook.md`](takedown-runbook.md),
que no se duplica aquí. Una petición sobre el arte del juego tiene prioridad sobre
cualquier otro trabajo, como dice ese runbook.

## Regenerar el catálogo

Requisito: una copia local legal de Grim Dawn. Pasa su carpeta con `--game-dir` o
con la variable de entorno `GRIMDAWN_DIR`. El extractor solo lee de la carpeta del
juego y escribe únicamente en la ruta de `--out` (o a stdout), así que envía esa
salida primero fuera del repositorio.

```text
pnpm catalog:extract --game-dir <Grim Dawn folder> --out <tmp>/all.json
pnpm exec tsx scripts/split-mastery-catalog.mts <tmp>/all.json fixtures/content/mastery-trees
pnpm catalog:nodes
pnpm catalog:textures --game-dir <Grim Dawn folder> [--out <folder>] [--kind masteries|skills|all]
```

- `catalog:extract` emite las seis maestrías base como un array JSON con la forma de
  `MasteryTreeSchema` y `source {game_version, sha256[]}`. Opciones:
  `--game-version <texto>` fuerza la versión (por defecto, el `buildid` de Steam) y
  `--no-localize` conserva los tags de localización y no lee los `.arc`.
- `split-mastery-catalog.mts` escribe un `<slug>.json` por maestría. Nada de los
  fixtures se edita a mano.
- `catalog:nodes` (`scripts/check-mastery-catalog.mts`, opción `--dir <carpeta>`)
  valida cada fixture con `MasteryTreeSchema` y comprueba: árbol acíclico, todo
  `parent_id` existe, ids únicos, rejilla sin colisiones, tier creciente desde la
  raíz, `bar_required` coherente con el tier, `max_points` en el rango 1 a 16,
  `ultimate_points` como máximo 26, nombres no vacíos, nombre de archivo igual al
  slug y exactamente las seis maestrías base (SC-001). Corre dentro de `pnpm verify`
  y en CI.
- `catalog:textures` escribe PNG y su propio `manifest.json` en
  `.game-assets/textures/` (en `.gitignore`) por defecto. `--kind` es `masteries` por
  defecto. Para publicar un botón de maestría, cópialo a mano a
  `apps/web/public/assets/portraits/` y añade su entrada al manifiesto; la ingesta
  nunca se automatiza (constitución II, 1.10.0). `pnpm assets:check` rechaza un
  archivo bajo `apps/web/public/assets/` sin entrada `approved` o con otro hash.
- **Reproducibilidad (SC-002)**: la salida tiene claves ordenadas, sin marcas de
  tiempo, y dos ejecuciones sobre la misma instalación dan un `diff` vacío. Lo mismo
  vale para las texturas (dos ejecuciones a carpetas distintas, `diff -r` vacío). Un
  build nuevo del juego cambia `game_version` y los hashes, así que regenera y
  versiona los fixtures en el mismo cambio.
