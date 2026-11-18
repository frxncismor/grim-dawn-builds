# Research: evidencia por elemento (spec006)

Cada elemento de la petición se localizó en el código de `cc553c3` (rama `orq/11111619-ui-s6-plan`), solo lectura. Las líneas son de ese commit.

## R1. S4-D1, puertas que pasan en vacío: **aplica en parte**

Estado tras spec005 T001:

| Puerta | Archivo:línea | Con artefacto ausente | Con `browser/` sin HTML | Criterio propio |
| ------ | ------------- | --------------------- | ----------------------- | --------------- |
| `assertPortraitCredit` | `scripts/check-assets.mts:219` → `assertCredit` `:187-199` | falla | falla | `pages.length === 0` (inline en `assertCredit`) |
| `assertSkillIconCredit` | `scripts/check-assets.mts:232` → `assertCredit` | falla | falla | el mismo |
| `assertNoGamePortraits` (`own`) | `scripts/check-assets.mts:154-166` | **pasa** (`existsSync(artifact) ? … : []`, `:156-161`) | **pasa** (no mira páginas) | ninguno |
| `assertNoLegacyBrand` | `scripts/check-legacy-brand.mts:41-55` | falla | falla | `pages.length <= MIN_PRERENDERED_PAGES` (otra copia, otro umbral) |
| `compareTrees` (`compare:builds`) | `scripts/compare-builds.mts:231-295` | estado 2 | estado 2 | `html.length === 0` y sin sitemap |
| `contentFingerprint` (release) | `scripts/check-release.mts:95-108` | falla (`lstat` ENOENT) | falla solo si no hay **ningún** archivo (`:107`) | cuenta archivos, no páginas |
| `assertPublicBuild` (secretos) | `scripts/check-public-build.mts:52-92` | falla (`lstat`) | falla solo si no hay archivos (`:92`) | cuenta archivos |
| `measureInitialRoutes` / `check:initial-js` | `scripts/check-initial-js.mts:152,199,242` | falla (`readFile` ENOENT) | falla | lee rutas concretas |
| `check:performance` | `scripts/check-performance.mts:1429-1432` | falla (sin `index.html`) | falla | lee `index.html` |

Llamadas en el release: `scripts/build-release.mts:135-139` (`assertNoGamePortraits`, luego las dos de crédito). En el flujo de `build:release` el hueco de `assertNoGamePortraits` queda tapado porque la puerta de crédito siguiente falla; como función exportada y probada por separado, pasa en vacío.

Conclusión: la única puerta que **sufre** S4-D1 hoy es `assertNoGamePortraits`; el criterio de vacío está duplicado en `assertCredit` y `assertNoLegacyBrand` con umbrales distintos. Las de la segunda mitad de la tabla ya fallan cerrado con su propia unidad (archivos, rutas concretas, sitemap). P33 = A (Paco, 2026-11-17): el helper lo usan las cuatro primeras; las demás no cambian.

Diseño recomendado (plan): un módulo `scripts/artifact-pages.mts` con `prerenderedPages(browserDir, { gate, minPages })` que valida que `browser/` existe, es directorio real (no enlace), y devuelve la lista ordenada de `.html` o lanza `Error` con `«<gate>: el artefacto está vacío (…)»`. `assertCredit`, `assertNoGamePortraits` y `assertNoLegacyBrand` la usan; el mensaje actual de las de crédito se conserva literal (FR-004).

## R2. S4-D2, CSS de tier-components: **ya no aplica**

`apps/web/src/styles/tier-components.css:4-6` (comentario de spec005 T008) y `:14-…` (selectores con combinador hijo desde el host: `gd-filter-bar > .filters > .search > input`). Hecho en spec005 T008, con prueba `apps/web/src/app/features/tier-list/tier-components.spec.ts`.

## R3. S4-D3, `aria-hidden` del estado: **ya no aplica**

`apps/web/src/app/shared/ui/build-card/build-card.ts:68` (`<p class="build-card__status" aria-hidden="true" …>`). spec005 T009.

## R4. S4-D4, `track` de la portada: **ya no aplica**

`apps/web/src/app/features/home/home.page.html:41` (`@for (card of otherCards; track card.href)`). spec005 T010.

## R5. S4-D5, formateador de fecha: **ya no aplica**

Única implementación `apps/web/src/app/shared/date/long-date.ts:1-10` (`Intl.DateTimeFormat` con `timeZone: 'UTC'`); `grep` de `toLocaleDateString|Intl.DateTimeFormat|timeZone` en `apps/web/src/app` (sin specs) solo la devuelve a ella. La usan `home.page.ts`, `build-summary.ts`, `build-attribution.ts` y `source-attribution.ts`. spec005 T011.

## R6. S4-D6, campo `name`: **ya no aplica**

`apps/web/src/app/shared/ui/build-card/build-card.model.ts:25-27` (`masteries: { portrait }[]`, sin `name`) y `:60`. spec005 T012.

## R7. S4-D7, docs: **ya no aplica**

`apps/web/DESIGN.md:153` (sección «Hojas globales») y `specs/005-deuda-revisiones/reviews/t052-huella.md`. spec005 T013 (Q-D = A).

## R8. L1 (F-301 = B-11 = A-101), id por contador: **aplica**

`apps/web/src/app/shared/ui/build-card/build-card.ts:5` (`let nextCardId = 0;`) y `:81` (`` descriptionId = `build-card-combination-${nextCardId++}` ``); docstring «it has no state» en `:8`. Usos de la tarjeta: `home.page.html:18,42`, `tier-list.page.html:39,51`, `tier-preview.component.ts:21-26`.

Claves estables disponibles: en el catálogo, `card.id` = `${combination.slug}:${entry.entry_kind}:${entry.build_slug ?? index}` (`apps/web/src/app/features/tier-list/catalog.model.ts:104`), ya usada como `track`; en la portada, `href` (ya `track` en `home.page.html:41`) y la guía destacada no se repite en `otherCards` (`home.page.ts:28,33`). Las claves llevan `:` pero no espacios, así que son IDREF válidos sin saneado (decisión final en D2); los e2e las seleccionan con `[id="…"]`, no con `#id`.

Alternativas valoradas: (a) clave del contenido en `BuildCardData` (recomendada; es lo que pide Paco); (b) contador por render inyectado (`providedIn: 'root'` reinicia por petición de prerender): determinista por página pero sigue dependiendo del orden; (c) `APP_ID`: constante por aplicación, no distingue tarjetas. Coste en bytes: (a) añade un campo, sin función de saneado (D2); medir `/tier-list` (margen 597 B).

## R9. L2 (C-201 = A-102 y parte de B-12), comentarios y rama muerta: **aplica**

- `apps/web/src/app/shared/ui/build-card/build-card.labels.ts:66-68`: dice que la combinación en el idioma del contenido «is read in its own `lang` span (`srCombination`)»; tras T040 se lee como descripción (`aria-describedby`, `build-card.ts:40,49`).
- `build-card.model.ts:66-70`: el docstring de `srCombination` dice «read before `srText` … drawn in its own `lang` span»; ya no es así en las ramas con enlace.
- `build-card.ts:53-60`: rama `@else` (sin enlace) que pinta `srCombination` en un `span` oculto. Según las revisiones no hay entrada real sin enlace con `combinationLang`; la tarea lo comprueba con los adaptadores (`home-builds.ts`, `tier-list/card-data.ts`) antes de retirarla.

## R10. L3 (resto de B-12), e2e de `aria-describedby`: **aplica**

`grep -n describedby e2e/` solo encuentra `e2e/skill-tooltip.spec.ts:71` (tooltip del árbol); `e2e/a11y.spec.ts` no tiene caso de la tarjeta.

## R11. S3-T042 y S3-T043: **ya no aplican**

Resueltos por spec005 T002–T004: `packages/domain/src/seed-contract.ts` (contrato y unión de códigos); `scripts/seed-content.mts:8-11` importa `failurePattern` y `successPattern` de `@gd/domain` y `:165-167` los usa. Quedan textos caducos: `specs/README.md`, sección «003-catalogo-arboles-maestria» («Quedan aplazados … S3-T042 … S3-T043»), y `specs/003-catalogo-arboles-maestria/tasks.md:113-114` (no se edita: spec cerrada; FR-014).

## R12. F-002, poda de nodos antes de reescribir guías: **aplica**

`apps/api/src/db/write-content.mts:428-431` (`DELETE FROM catalog_skill_nodes WHERE mastery_id = $1 AND id <> ALL($2::text[])`) dentro de `writeCatalogRows` (`:398`), que `seed.mts:282` y `bootstrap.mts:111` llaman **antes** de `writeContentRows` (`seed.mts:283`, `bootstrap.mts:112`). La retirada de maestrías completas ya va después (`retireMasteries`, `write-content.mts:367-388`, `seed.mts:284`) y traduce 23503 a `SeedError('reference', id)` (`:384-385`); la poda de nodos sueltos no. Coste: ver D4 (mover la poda entera después del upsert chocaría con la restricción única de celda `catalog_skill_nodes_grid_cell_uq`; se parte en dos pasos); pruebas en `apps/api/test/seed.int.spec.ts` con Postgres real. Riesgo: bajo (solo desarrollo/test; hoy ya falla cerrado, pero con `database-failed` sin id).

## R13. S-001, montaje del repositorio en el contenedor: **aplica**

`CONTRIBUTING.md:264` y `CONTRIBUTING.es.md:263`: `docker run … -v "$PWD:/src:ro" …`; `CONTRIBUTING.md:258` afirma «neither local secrets nor results of earlier runs enter the container»; `scripts/visual-baselines-docker.sh:7` y `:26` lo repiten, y `:27-31` filtra la copia `/src` → `/work` con `tar -X` (patrones con comodines). Coste: enviar el árbol por stdin (`git ls-files -co --exclude-standard -z | tar --null -T - -cf -`) con `docker run -i` y quitar el montaje `/src`, o montar una copia ya filtrada; `--no-wildcards` en el filtro si se mantiene; corregir `CONTRIBUTING{,.es}.md` y comentarios. Verificación: necesita Docker y regenerar 0 referencias (`e2e:visual` en Docker sigue 30 passed). Riesgo: medio-bajo (uso manual y local; el cambio toca el procedimiento con el que se generan las referencias).

## R14. `coldStartMs` como mediana (to-do 117): **aplica**

`apps/api/test/performance.int.spec.ts:67` (`coldStartMs: 5000`), `:195-224` (`measureColdStart`, un solo arranque) y `:523-524` (`coldStartMs = await measureColdStart(); expect(…).toBeLessThanOrEqual(BUDGETS.coldStartMs)`); el informe la publica en `:298` y `:326`, y `scripts/check-performance.mts:692` declara el campo. Coste: bucle de N arranques (N = 3 o 5), mediana, y el informe con las N muestras; +2 a +4 arranques por ejecución de la suite de BD (≈ 2–4 s cada uno en local). Riesgo: bajo; cambia la semántica del presupuesto (mediana en lugar de un valor), sin cambiar el umbral.

## R15. To-do 134 y L4: **aplica**

- «pendiente de confirmación de Paco» de la base 111 403 B: `specs/005-deuda-revisiones/tasks.md:141`; «a la espera de la confirmación de Paco»: `spec.md:256` (SC-008); la cifra sin decisión en `plan.md:27` y `quickstart.md:266,271`.
- L4: `specs/005-deuda-revisiones/tasks.md:141` dice «Pendiente: fallo preexistente de `e2e:a11y` T052» y, más adelante en la misma nota, «T052 frente a F-002 resuelta con aria-describedby».
- `specs/README.md`: fila de spec004 «Implementada; puerta spec002 en curso» (la puerta pasó: `specs/004-rediseno-ui-grim-dawn/reviews/completion-review.json`, snapshot `0663ab5e…`) y de spec005 «Implementada; puerta T018 en curso» (pasó en `cc553c3`, snapshot `8c9d04be…`).
- El snapshot de la puerta (`scripts/spec-review.mjs:62-95`) es un hash de **todo** el repositorio salvo `specs/*/reviews/` y `.specify/feature.json`: cualquier cambio posterior lo caduca, también el de esta spec; no exige reabrir la puerta de spec005.

## Decisiones de diseño (fase 0 del plan)

Formato de Spec Kit: decisión, motivo y alternativas. Las respuestas de Paco (P33, P34) fijan el alcance; aquí se decide el cómo.

### D1. Helper único de páginas prerrenderizadas (T001; P33 = A)

- **Decisión**: módulo `scripts/artifact-pages.mts` con `prerenderedPages(browserDir, { gate, minPages = 1 }): string[]`. Valida que `browserDir` existe y es un directorio real (no enlace simbólico ni archivo), recorre las `.html` en orden estable y lanza `Error` con `«<gate>: el artefacto está vacío (sin carpeta browser/ en …)»`, `«… (carpeta browser/ inválida)»` o `«… (N páginas .html en browser/; se esperan al menos M)»`. Lo usan `assertCredit` (las dos puertas de crédito), `assertNoGamePortraits` (solo con `own`) y `assertNoLegacyBrand` (`minPages = MIN_PRERENDERED_PAGES + 1`, el mismo umbral de hoy).
- **Motivo**: un solo criterio de vacío (FR-001, FR-002, SC-002); `assertNoGamePortraits` deja de pasar con un artefacto ausente (FR-003); módulo propio para que `check-legacy-brand.mts` no importe `check-assets.mts` (que arrastra `@gd/domain`).
- **Alternativas**: exportarlo desde `check-assets.mts` (acopla la puerta de marca al manifiesto de activos); extenderlo a las cinco puertas que ya fallan cerrado con otra unidad (P33 B, descartada por Paco).

### D2. Id estable de la tarjeta (T002; L1)

- **Decisión**: `key` obligatoria en `BuildCardInput` y `BuildCardData`; `descriptionId = 'build-card-combination-' + key`. Catálogo: `card.id` (`catalog.model.ts:104`, ya `track` de las filas); portada: el slug de la guía (`home-builds.ts:32`); preview de desarrollo: claves literales distintas. Sin estado de módulo.
- **Motivo**: lo que pide Paco (derivado del contenido); determinista entre renders, procesos y builds; único por página porque las claves ya son las de `track`. Las claves no tienen espacios, así que son IDREF válidos sin saneado (sin bytes de cliente para ello).
- **Alternativas**: contador por render inyectado (`providedIn: 'root'`, se reinicia por petición de prerender: determinista por página, pero depende del orden de render); `APP_ID` (no distingue tarjetas); hash del título (no único: dos guías con igual título).

### D3. Rama sin enlace y comentarios (T003; L2, L3)

- **Decisión**: retirar de la rama `@else` de `build-card.ts:53-60` el `span` de `srCombination`, tras una prueba unitaria con los adaptadores reales (`catalogCardInput`, `buildCardData` de la portada) que demuestre que `combinationLang` solo aparece con `href` (`card-data.ts:63-72`). Comentarios de `build-card.labels.ts:66-68` y `build-card.model.ts:66-70` al mecanismo de T040 (`aria-describedby` hacia `.build-card__combination`). E2E en `e2e/a11y.spec.ts`: en `/tier-list` el enlace de la guía ES tiene `toHaveAccessibleDescription` con la combinación y el elemento descrito lleva `lang="es"`; en `/es/tier-list` no tiene descripción.
- **Motivo**: FR-008 y FR-009; la prueba previa evita quitar una rama viva.
- **Alternativas**: conservar la rama con una prueba sintética (mantiene código que ninguna entrada real usa).

### D4. Poda de nodos del catálogo (T005; F-002)

- **Decisión**: sacar de `writeCatalogRows` (`write-content.mts:428-431`) la poda de nodos ausentes y partirla: (1) antes del upsert, borrar solo los nodos ausentes **sin** filas en `build_skill_nodes` (libera su celda de `catalog_skill_nodes_grid_cell_uq`, `apps/api/drizzle/0009_mastery_catalog.sql:19`); (2) después de `writeContentRows`, borrar los ausentes restantes, traduciendo 23503 a `SeedError('reference', <id de maestría>)`. Si en (1) un nodo ausente aún referenciado ocupa la celda de un nodo nuevo, el upsert da 23505 y se traduce también a `reference` con la maestría. `seedCatalog`, `seed` y `bootstrap` llaman a (2) junto a `retireMasteries`.
- **Motivo**: el orden actual borra antes de reescribir las guías y la FK `ON DELETE RESTRICT` aborta una siembra válida; moverla entera después del upsert chocaría con la restricción única de celda. La traducción da el código de la unión y el id (FR-015).
- **Alternativas**: solo traducir el 23503 sin reordenar (sigue fallando la siembra válida de US5 escenario 1); `ON DELETE CASCADE` (migración y riesgo de borrar datos editoriales; constitución VI).

### D5. Frontera del contenedor de referencias (T006; S-001)

- **Decisión**: el árbol del repositorio entra por stdin, filtrado por git: `git ls-files -co --exclude-standard -z | tar --null -T - -cf - | docker run -i --rm --ipc=host -v "$PWD/test-results/visual-out:/out" -v "$PWD/scripts/visual-baselines-docker.sh:/run.sh:ro" mcr.microsoft.com/playwright:v1.65.0-noble sh /run.sh update`. Sin montaje de `/src`. El script extrae stdin en `/work` y aborta si existe `.env`, `.env.*` salvo `.env.example`, o `infra/docker/secrets/`. Sin `tar -X` (desaparece el problema de comodines). Prueba `scripts/visual-baselines-docker.test.mts`: el script no lee `/src` y contiene la guarda; `CONTRIBUTING{,.es}.md` no monta `$PWD:/src`.
- **Motivo**: lo ignorado por git (`.env*`, `infra/docker/secrets/`, `node_modules`, `dist`) nunca sale del host; la promesa de `CONTRIBUTING.md:258` pasa a ser cierta.
- **Alternativas**: montar una copia filtrada preparada en el host (más pasos manuales y espacio en disco); mantener el montaje y solo corregir la documentación (deja el riesgo).

### D6. Mediana de arranques en frío (T007; P34 d)

- **Decisión**: `measureColdStart` 3 veces en serie; `coldStartMs` = mediana; consola con las 3 muestras; el JSON del informe conserva la clave `coldStartMs` numérica; tiempo del caso de 60 s a 90 s; umbral 5000 ms sin cambios.
- **Motivo**: un único arranque lento bajo carga no debe fallar la suite (to-do 117); la mediana de 3 es la mínima robusta a un atípico.
- **Alternativas**: N = 5 (más tiempo); mínimo de N (oculta regresiones reales).
