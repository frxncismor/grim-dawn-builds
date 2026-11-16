# Research: Deuda aplazada de las revisiones de spec003 y spec004

**Feature**: [spec.md](spec.md) | **Fecha**: 2026-11-16 | **Base**: `fe77dd6`

Cada elemento se localizó leyendo el código de la base (sin cambiar nada). Formato por elemento: origen, hallazgo actual (archivo y línea), decisión y alternativas.

## R1. S4-D1, puertas de crédito en vacío (A-003, B-002 de spec004)

- **Origen**: `specs/004-rediseno-ui-grim-dawn/reviews/deuda.md` (1).
- **Hallazgo actual**: `assertPortraitCredit` (`scripts/check-assets.mts:174`) y `assertSkillIconCredit` (`scripts/check-assets.mts:201`) son idénticas salvo el patrón (`assets/portraits` frente a `assets/skill-icons`), el marcador (`data-credit` frente a `data-game-art-credit`) y los mensajes. Las dos hacen `if (!existsSync(browser)) return;` (líneas 177 y 204) y recorren `readdirSync(...)` filtrando `.html` sin comprobar que haya alguna: con `browser/` ausente o sin HTML salen sin error. Las pruebas (`scripts/check-assets.test.mts:232` y `:268`) cubren páginas con y sin crédito, pero no el artefacto vacío. `runRelease` las llama en `scripts/build-release.mts:137` y `:139`. El docstring promete «y solo entonces»; la rama `own` lo implementa, pero no hay un caso que falle si se rompe.
- **Decisión**: un helper parametrizado (patrón, marcador, mensajes) que **falla** si no existe `browser/` o no hay páginas; las dos puertas pasan a ser dos llamadas con datos. Prueba roja primero para el vacío; la regla «solo entonces» se prueba (ya está implementada).
- **Alternativas**: fallar solo en `game` (Q-B); dejar las dos funciones y añadir el chequeo en cada una (perpetúa la copia).

## R2. S4-D2, CSS global con selectores descendientes (A-002, B-001)

- **Origen**: `deuda.md` (2).
- **Hallazgo actual**: `apps/web/src/styles/tier-components.css:7-101` usa `:is(gd-tier-row, gd-filter-chip, gd-filter-bar, gd-empty-state) <descendiente>` (`input` en la línea 29, `button` en la 54, `.chip` en la 60). Un selector descendiente alcanza a cualquier `button` dentro de esos hosts, incluidas las `gd-build-card` proyectadas en `gd-tier-row` (`apps/web/src/app/features/tier-list/tier-list.page.html:30`). El comentario de la línea 4 («nothing leaks to other pages») es cierto hacia otras páginas y falso hacia dentro. Hoy sin efecto visible.
- **Decisión**: acotar con combinador hijo o clases propias de cada host y corregir el comentario. Prueba de que una `gd-build-card` dentro de `gd-tier-row` no recibe las reglas, más capturas idénticas a 375/1280 EN/ES.
- **Alternativas**: volver a CSS de componente (spec004 lo sacó a hoja global por presupuesto y CSP); `@scope` (soporte y riesgo desproporcionados).

## R3. S4-D3, el estado de la tarjeta se anuncia dos veces (F-001 de T-136)

- **Origen**: `deuda.md` (3).
- **Hallazgo actual**: `apps/web/src/app/shared/ui/build-card/build-card.labels.ts:65` construye `srText` con `[input.combination, statusLabel, newTab]` (incluye el estado); `build-card.ts:40/45/49` lo pinta en `.build-card__sr` dentro del enlace y `build-card.ts:55` repinta el estado en `.build-card__status`.
- **Decisión provisional** (Q-C = A): `aria-hidden="true"` en `.build-card__status`. Prueba en `build-card.spec.ts` y `e2e:a11y`.
- **Alternativas**: quitar el estado de `srText`; `srText` solo con enlace.

## R4. S4-D4, clave de la lista de la portada (C-001)

- **Origen**: `deuda.md` (4).
- **Hallazgo actual**: `apps/web/src/app/features/home/home.page.html:41`: `@for (card of otherCards; track card.title)`. El título no es único por contrato; `href` sí lo es por tarjeta.
- **Decisión**: `track card.href`; prueba con dos tarjetas de igual título y distinto destino.
- **Alternativas**: `track $index` (pierde identidad al reordenar).

## R5. S4-D5, cuatro copias del formateador de fecha larga (A-004)

- **Origen**: `deuda.md` (5).
- **Hallazgo actual**: cuatro `Intl.DateTimeFormat` con `day/month/year` y `timeZone: 'UTC'`: `apps/web/src/app/features/home/home.page.ts:36`, `.../build/summary/build-summary.ts:82`, `.../build/attribution/build-attribution.ts:74`, `.../build/source-attribution/source-attribution.ts:57`.
- **Decisión**: función pura en `apps/web/src/app/shared/` que recibe el idioma y la fecha ISO y devuelve el texto o `null`, con una sola política; las cuatro vistas la usan.
- **Alternativas**: servicio inyectable o pipe (más JS en la ruta con el margen más estrecho, `/tier-list`).

## R6. S4-D6, campo muerto `BuildCardInput.masteries[].name` (A-005)

- **Origen**: `deuda.md` (6).
- **Hallazgo actual**: `apps/web/src/app/shared/ui/build-card/build-card.model.ts:23-27` declara `name?: string` con el comentario «Not drawn ... kept for callers that still pass it». Lo sigue pasando `apps/web/src/app/features/home/home-builds.ts:74` y algunos specs; otros specs (`catalog.model.spec.ts`, `filter.spec.ts`, `build-summary.spec.ts`, `file.repository.spec.ts`) pasan `name` por otros modelos y se revisan uno a uno.
- **Decisión**: quitar el campo del tipo, de `home-builds.ts` y de los specs que lo usan como entrada de tarjeta.
- **Alternativas**: dejarlo (ya está marcado como muerto).

## R7. S4-D7, documentación (A-001, B-003)

- **Origen**: `deuda.md` (7).
- **Hallazgo actual**: `specs/004-rediseno-ui-grim-dawn/plan.md` no recoge la regla «las hojas globales llevan selectores con prefijo propio» (el árbol de `styles/` de `plan.md:75-81` no la dice) y la nota de T052 en `specs/004-rediseno-ui-grim-dawn/tasks.md:111` no lista toda su huella (`build-card.css`, `tier-components.css`, `styles.css`…).
- **Riesgo**: el snapshot de la puerta de spec004 (`completion-review.json`, `"snapshot": "0663ab5e…"`) cubre su diff; editar `plan.md` o `tasks.md` de spec004 lo caduca. Por eso `deuda.md` vive en `reviews/`.
- **Decisión provisional** (Q-D = A): regla en un documento vivo (`apps/web/DESIGN.md`) y huella real de T052 como nota en `specs/005-deuda-revisiones/reviews/`, sin tocar spec004.
- **Alternativas**: editar spec004 y repetir su puerta (caro para un LOW); editar y declarar el snapshot caducado (reabre un cierre `passed`).

## R8. A-03 de spec003, doble fuente del estado de los activos — excluido

- **Origen**: A-03 de la ronda 1 de spec003 (`apps/web/src/app/core/content/portraits.server.ts:61` en el registro de la corrida).
- **Hallazgo actual**: ya resuelto por spec004 T005 (`specs/004-rediseno-ui-grim-dawn/tasks.md:27`, `[x]`). `assertAssetStatusParity` (`scripts/check-assets.mts:118`) compara el manifiesto con lo que publica la tabla `assets` y falla cerrado nombrando el activo y los dos estados; `runRelease` la ejecuta antes del build (`scripts/build-release.mts:87`) y lo emitido sigue el manifiesto. Pruebas rojas en `scripts/check-assets.test.mts:93,107,131`. `portraits.server.ts` lee solo el manifiesto del repositorio, que ahora es la fuente única.
- **Decisión**: fuera de alcance; sin tarea.

## R9. A-01 de spec003, `MasterySummarySchema` al dominio

- **Origen**: A-01 de la ronda 1 de spec003 (registro de la corrida).
- **Hallazgo actual**: sigue aplicando, con otras ubicaciones. El esquema vive en `apps/api/src/catalog/map-mastery.ts:42` (`.strict()`: `id`, `slug`, `name`, `game_version`, `node_count`), construido sobre `PublicMasteryTreeSchema.shape` de `@gd/domain`, y lo usan `apps/api/src/catalog/mastery-repository.ts:5` y `apps/api/src/routes/masteries.ts:4,46`. La web no lo importa: `apps/web/src/app/core/content/masteries.server.ts:150-167` valida la respuesta de `api/v1/masteries` a mano, y su tipo `MasterySummary` (`apps/web/src/app/core/content/masteries.ts:9`) es otro (`nodeCount`, `name` anulable, `portrait`). Son dos definiciones de la misma lista.
- **Decisión**: mover `MasterySummarySchema` y su tipo a `packages/domain` (con prueba y exportación pública); la API lo importa de allí; la web valida con él y lo traduce a su modelo de vista, conservando el error `unavailable()`. Dos tareas con dueño distinto, la segunda depende de la primera.
- **Alternativas**: dejar la validación de la web y probar la paridad (mantiene dos fuentes; viola VI).

## R10. C-003 de spec003, `write-content` no borra las maestrías retiradas

- **Origen**: C-003 (LOW, aplazado) en el registro de la corrida.
- **Hallazgo actual**: sigue aplicando. `writeCatalogRows` (`apps/api/src/db/write-content.mts:354`) hace `INSERT ... ON CONFLICT (id) DO UPDATE` en `mastery_trees` y borra los nodos de cada maestría presente que ya no están en la fixture, pero no borra filas de `mastery_trees` ausentes de `catalog`: una maestría retirada queda con todos sus nodos. `build_skill_nodes.skill_node_id` referencia `catalog_skill_nodes(id)` con `ON DELETE restrict` (`apps/api/drizzle/0010_skill_node_id.sql:2`), así que borrar nodos referenciados falla en la base.
- **Decisión provisional** (Q-A = A): borrar nodos y maestría ausentes en la misma transacción; si una guía los referencia, la restricción aborta la siembra sin cambios parciales y se lanza un `SeedError` que nombra la maestría. Prueba de integración con Postgres real (`*.int.spec.ts`).
- **Alternativas**: columna `retired_at` con vista pública que la oculte (modelo y migración nuevos); documentar y no hacer nada (el residuo crece).

## R11. S3-T042, códigos de error de `seed-content`

- **Origen**: `specs/003-catalogo-arboles-maestria/tasks.md:113` (C-001/F-001 de la ronda 3).
- **Hallazgo actual**: sigue aplicando. `scripts/seed-content.mts:168-178` reconoce solo `invalid-content|role|already|not-empty|migration|credentials|database-failed|bootstrapped` (8). El sembrador emite `bootstrapped`, `column`, `conflicting-resource`, `credentials`, `database-failed`, `duplicate`, `fixture-read`, `invalid-content`, `owned-content`, `reference`, `role`, `table`, `database-result` (`write-content.mts:49`), `environment` (`seed.mts:317`, `bootstrap.mts:153`) y, por defecto, `configuration-or-database` (`seed.mts:353`); el *bootstrap* añade `already`, `not-empty` y `migration`. Diez códigos reales caen en `throw new Error('Seed failed')`. `SeedError.code` es `string` (`write-content.mts:6`), así que ningún tipo avisa al añadir un código. La parte B-001 de S3-T042 (`typecheck:e2e` en `verify`) ya la hizo spec004 T001 (`scripts/verify-local.mjs:38`).
- **Decisión**: los códigos pasan a una unión cerrada en el módulo compartido de S3-T043, de la que se derivan la regex del lanzador y `SeedError.code`; prueba que enumera el conjunto.
- **Alternativas**: ampliar la regex a mano (la deriva vuelve).

## R12. S3-T043, contrato lanzador–sembrador en un módulo compartido

- **Origen**: `specs/003-catalogo-arboles-maestria/tasks.md:114` (A-01 de la ronda 3).
- **Hallazgo actual**: sigue aplicando. `successPattern` y `CONTENT_MOUNT` están en `scripts/seed-content.mts:20-27`; `seedCompleteLine` y `bootstrapCompleteLine` en `apps/api/src/db/seed.mts:179` y `bootstrap.mts:59`. La prueba `scripts/seed-content.test.mts:126-135` importa `./apps/api/src/db/seed.mts` dentro de un `node -e` (cadena opaca que `check:boundaries` no analiza).
- **Decisión provisional** (Q-E = A): módulo de contrato en `packages/domain` (entrada propia) con la ruta de montaje, las líneas de éxito, sus patrones y la unión de códigos. `scripts/` y `apps/api` lo importan; la prueba lo importa con `import` estático.
- **Alternativas**: paquete nuevo (peso de workspace para pocas constantes); carpeta compartida sin paquete (`check:boundaries` pide fronteras explícitas).

## Elementos y su estado

| ID             | Elemento                                       | Estado en la base `fe77dd6`         | Tarea      |
| -------------- | ---------------------------------------------- | ----------------------------------- | ---------- |
| S4-D1          | Puertas de crédito en vacío                    | Sigue (R1)                          | T001       |
| S3-T043        | Contrato lanzador–sembrador compartido         | Sigue (R12)                         | T002, T003 |
| S3-T042        | Códigos de error de `seed-content`             | Sigue (R11)                         | T004       |
| A-01           | `MasterySummarySchema` al dominio              | Sigue (R9)                          | T005, T006 |
| C-003          | `write-content` no borra maestrías retiradas   | Sigue (R10)                         | T007       |
| S4-D2          | CSS global con selectores descendientes        | Sigue (R2)                          | T008       |
| S4-D3          | Estado de la tarjeta anunciado dos veces       | Sigue (R3)                          | T009       |
| S4-D4          | `track card.title`                             | Sigue (R4)                          | T010       |
| S4-D5          | Cuatro copias del formateador de fecha         | Sigue (R5)                          | T011       |
| S4-D6          | Campo muerto `masteries[].name`                | Sigue (R6)                          | T012       |
| S4-D7          | Docs (regla de hojas globales, huella de T052) | Sigue (R7)                          | T013       |
| A-03 (spec003) | Doble fuente del estado de los activos         | Resuelto por spec004 T005 (R8)      | —          |
