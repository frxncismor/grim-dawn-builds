---
description: 'Tareas de la deuda aplazada de las revisiones de spec003 y spec004'
---

# Tasks: Deuda aplazada de las revisiones de spec003 y spec004

**Input**: `specs/005-deuda-revisiones/{spec.md,plan.md,research.md,data-model.md,quickstart.md,contracts/}`
**Prerequisites**: spec003 y spec004 cerradas (puerta spec002 `passed`). Preguntas Q-A a Q-E (Preguntas 23–27) **respondidas por Paco el 2026-11-16: todas = A** (ver «Clarifications» en `spec.md`). Alcance nuevo de Paco: marca «Grim Builds» (US6).
**Tests**: Sí, primero en rojo y después la implementación (constitución IX, FR-021).

**Formato**: `[ID] [P?] [US?] [Área] descripción` — `[P]` = archivos disjuntos. Cada tarea declara archivos, aceptación y evidencia. **Ninguna casilla `[x]` sin salida real citable** (comando y resultado). Áreas: **IMPL** = implementación (`apps/api`, `packages/*`, `scripts/`); **UI** = `apps/web`.

> **Estado (2026-11-16)**: planificación cerrada (specify, clarify, plan, tasks y analyze ejecutados; ver `reviews/analyze.md`); ninguna tarea de implementación empezada. Las correcciones de la revisión de fidelidad (T016) se añadirán desde T019.

---

## Fase 1 — US1 Puertas de crédito (P1, primera por decisión de Paco)

- [ ] **T001** [US1] [IMPL] Helper parametrizado de crédito que falla en vacío (S4-D1; A-003/B-002 de spec004) — `scripts/check-assets.mts`, `scripts/check-assets.test.mts`, `scripts/build-release.mts` si cambia la llamada — Aceptación: `assertPortraitCredit` y `assertSkillIconCredit` son dos llamadas a un solo helper (patrón, marcador, mensajes; FR-002); fallan con mensaje que nombra la causa si no existe `browser/` o no hay ninguna página `.html` (FR-001; con Q-B = A en `game` y en `own`); con artefacto válido su salida es idéntica a la actual (FR-004); la regla «solo con arte del juego» tiene un caso que falla si se rompe (FR-003). Pruebas rojas primero (artefacto sin `browser/`, con `browser/` sin HTML, ambas puertas). Evidencia: `pnpm test:scripts` y `pnpm assets:check`; un `pnpm build:release` de prueba sigue pasando. Depende de: nada. Decisión: Q-B = A.

**Checkpoint F1**: ninguna puerta de crédito pasa en vacío.

---

## Fase 2 — US2 Contrato lanzador–sembrador (P2)

- [ ] **T002** [US2] [IMPL] Módulo compartido del contrato — `packages/domain/src/seed-contract.ts` (+spec), `packages/domain/src/index.ts` — Aceptación: contiene la ruta del contenido, `seedCompleteLine`/`bootstrapCompleteLine` con sus patrones derivados y la unión cerrada de códigos de error (conjunto de `contracts/seed-contract.md`); sin dependencias nuevas; prueba que enumera el conjunto y falla si falta un código emitido. Evidencia: `pnpm --filter @gd/domain test` y `pnpm check:boundaries`. Depende de: T001 (orden). Decisión: Q-E = A.
- [ ] **T003** [US2] [IMPL] `scripts/` y `apps/api` usan el módulo (S3-T043; A-01 de la ronda 3) — `scripts/seed-content.mts`, `scripts/seed-content.test.mts`, `apps/api/src/db/seed.mts`, `apps/api/src/db/bootstrap.mts` (+sus specs) — Aceptación: ninguna copia local de la línea de éxito, la ruta ni los códigos; la prueba del contrato usa `import` estático del módulo compartido, sin `node -e` con rutas de `apps/api`; `check:boundaries` ve la dependencia (FR-005, FR-008). Evidencia: `pnpm test:scripts`, `pnpm --filter @gd/api test`, `pnpm check:boundaries`. Depende de: T002.
- [ ] **T004** [US2] [IMPL] El lanzador reenvía todos los códigos (S3-T042; C-001/F-001 de la ronda 3) — `scripts/seed-content.mts`, `scripts/seed-content.test.mts`, `apps/api/src/db/write-content.mts` (tipo de `SeedError.code`) — Aceptación: la regex del lanzador se deriva de la unión; los diez códigos que hoy caen en `Seed failed` (`column`, `conflicting-resource`, `database-result`, `duplicate`, `fixture-read`, `owned-content`, `reference`, `table`, `environment`, `configuration-or-database`) se reenvían; un código fuera de la unión se informa como desconocido, nunca como éxito (FR-006, FR-007). Pruebas rojas primero con un caso por código. Evidencia: `pnpm test:scripts`; ejecución real de `pnpm db:seed` con una fixture inválida si el entorno lo permite. Depende de: T003 (mismos archivos).

**Checkpoint F2**: una sola fuente del contrato; `check:boundaries` en verde.

---

## Fase 3 — US3 Catálogo de maestrías (P2)

- [ ] **T005** [US3] [IMPL] `MasterySummarySchema` al dominio (A-01 de spec003, parte API) — `packages/domain/src/mastery-summary.ts` (+spec), `packages/domain/src/index.ts`, `apps/api/src/catalog/map-mastery.ts`, `apps/api/src/catalog/mastery-repository.ts`, `apps/api/src/routes/masteries.ts` (+tests) — Aceptación: el esquema (`.strict()`, campos de `data-model.md`) vive en `packages/domain`; la API lo importa de allí y no queda definición local; las pruebas existentes de la lista siguen pasando; prueba de dominio que rechaza campo extra, `node_count` negativo y `slug` inválido (FR-009). Evidencia: `pnpm --filter @gd/domain test`, `pnpm --filter @gd/api test`. Depende de: T002 (comparten `index.ts`).
- [ ] **T006** [US3] [UI] La web valida la lista con el esquema del dominio (A-01 de spec003, parte web) — `apps/web/src/app/core/content/masteries.server.ts` (+spec) — Aceptación: `listSummaries` (`:150-167`) parsea con el esquema compartido y mapea a `MasterySummary` de vista (`nodeCount`, `portrait`); se conserva el error `unavailable()` ante respuesta inválida, vacía o con `slug` duplicado; sin campos copiados a mano (FR-010). Pruebas rojas primero. Evidencia: `pnpm test` (web) y `pnpm check:performance` (JS inicial sin subir; el código es de servidor). Depende de: T005 integrada y `packages/domain` reconstruido.
- [ ] **T007** [US3] [IMPL] Siembra de maestrías retiradas (C-003 de spec003) — `apps/api/src/db/write-content.mts`, `apps/api/test/*.int.spec.ts` (nuevo caso), `apps/api/src/db/seed.spec.ts` — Aceptación: con Q-A = A, `writeCatalogRows` borra nodos y fila de las maestrías de `mastery_trees` ausentes de `catalog` en la misma transacción; si algún `build_skill_nodes` referencia sus nodos, la restricción aborta sin cambios parciales y el error es un `SeedError` que nombra la maestría (FR-011, FR-012). Pruebas rojas primero con Postgres real (retirada sin guías, retirada con guías, siembra idempotente sin retirada). Evidencia: `*.int.spec.ts` con Postgres de la corrida, o nota explícita «solo CI» antes de marcar. Depende de: T004 (mismo archivo). Decisión: Q-A = A.

**Checkpoint F3**: una definición de la lista; sin maestrías fantasma.

---

## Fase 4 — US4 Presentación (P3)

- [ ] **T008** [P] [US4] [UI] Acotar el CSS global de la lista de builds (S4-D2; A-002/B-001) — `apps/web/src/styles/tier-components.css` (+prueba de CSS) — Aceptación: los selectores `button`/`input`/`.chip` quedan acotados a los elementos propios de cada host (combinador hijo o clases propias); una `gd-build-card` proyectada en `gd-tier-row` no recibe las reglas (prueba); el comentario de `:4` es cierto; capturas 375/1280 EN/ES idénticas (FR-013). **Mide primero** la línea base de HTML y JS de `/tier-list` y `/` (`pnpm check:performance`) y la deja en la nota. Evidencia: prueba, capturas, `pnpm check:performance`. Depende de: nada.
- [ ] **T009** [US4] [UI] El estado de la tarjeta se anuncia una vez (S4-D3; F-001 de T-136) — `apps/web/src/app/shared/ui/build-card/build-card.ts`, `build-card.spec.ts` — Aceptación: con Q-C = A, `.build-card__status` lleva `aria-hidden="true"` (el texto accesible del enlace ya incluye el estado); prueba roja de que el estado aparece una vez en el nombre accesible; `e2e:a11y` 0 violaciones; capturas idénticas (FR-014). Evidencia: `pnpm test` (web), `pnpm e2e:a11y`. Depende de: T008 (medida base). Decisión: Q-C = A.
- [ ] **T010** [P] [US4] [UI] Clave única en la portada (S4-D4; C-001) — `apps/web/src/app/features/home/home.page.html` (+`home.page.spec.ts`) — Aceptación: `track card.href`; prueba con dos tarjetas de igual título y distinto destino que conserva ambas (FR-015). Evidencia: `pnpm test` (web). Depende de: nada.
- [ ] **T011** [US4] [UI] Formateador común de fecha larga UTC (S4-D5; A-004) — `apps/web/src/app/shared/` (función nueva + spec), `apps/web/src/app/features/home/home.page.ts`, `.../build/summary/build-summary.ts`, `.../build/attribution/build-attribution.ts`, `.../build/source-attribution/source-attribution.ts` — Aceptación: una sola política ante fecha ausente o inválida (devuelve `null`); las cuatro vistas la usan y las pruebas existentes pasan sin debilitarlas; el texto renderizado EN/ES es idéntico (FR-016, SC-006). Medir `/tier-list` antes y después: no baja del margen de T008 (SC-008). Evidencia: `pnpm test` (web), `pnpm check:performance`, capturas. Depende de: T010 (`home.page.ts`) y T008.
- [ ] **T012** [US4] [UI] Retirar `BuildCardInput.masteries[].name` (S4-D6; A-005) — `apps/web/src/app/shared/ui/build-card/build-card.model.ts`, `apps/web/src/app/features/home/home-builds.ts`, specs que lo pasan como entrada de tarjeta — Aceptación: el campo no existe en el tipo, ni en `home-builds.ts:74`; typecheck verde; los specs que usan `name` en otros modelos (`catalog.model.spec.ts`, `filter.spec.ts`, `build-summary.spec.ts`, `file.repository.spec.ts`) no se tocan salvo que lo pasen a la tarjeta (FR-017). Evidencia: `pnpm test` (web) y `pnpm lint`. Depende de: T009 (`build-card.*`).

**Checkpoint F4**: capturas idénticas a las de antes; `e2e:a11y` y presupuestos en verde.

---

## Fase 5 — US5 Documentación (P3)

- [ ] **T013** [P] [US5] [UI] Documentar la regla de hojas globales y la huella real de T052 (S4-D7; A-001/B-003) — `apps/web/DESIGN.md`, `specs/005-deuda-revisiones/reviews/t052-huella.md` — Aceptación: con Q-D = A, la regla «las hojas globales llevan selectores con prefijo propio» está en `apps/web/DESIGN.md` y la lista real de archivos de T052 en la nota de `reviews/`; **no** se edita ningún archivo de `specs/004-*` (FR-018, FR-019, FR-022); `pnpm lint:md` 0 problemas. Decisión: Q-D = A. Evidencia: `pnpm lint:md`. Depende de: nada.
**Checkpoint F5**: la regla y la huella real están escritas fuera de spec004.

---

## Fase 6 — US6 Marca pública «Grim Builds» (P2, alcance nuevo de Paco)

- [ ] **T014** [US6] [IMPL] Nombre de marca en fixtures y pruebas de `scripts/` y `apps/api` (US6, parte de contenido) — `fixtures/content/authors/grim-dawn-builds.json` (`display_name`; el nombre de archivo y el slug **no** cambian), `fixtures/content/builds/chaman-demoledor-golpe-primigenio.json`, `fixtures/content/sources/{catalogo-maestrias,guia-original}.json`, `fixtures/content/tier-lists/principal.json`, `apps/api/test/content.int.spec.ts:227`, `scripts/{compare-builds,gen-catalog,static-home}.test.mts`, `scripts/fixtures/static-home.html`, `scripts/check-locale-parity.mts:49` (motivo de la excepción de `layout.brand`), `docs/content/{permission-request-template,source-policy}.md` (nombre del proyecto en la plantilla de petición a Crate y en la política de fuentes; la URL del repositorio no cambia), y solo la aserción del nombre en `apps/web/src/app/core/content/parity.test.mts:247` y `fixture-source.server.test.mts:38` (excepción de frontera declarada en plan.md) — Aceptación: `display_name`, `author_name`, `reviewed_by` y las notas visibles dicen «Grim Builds»; el slug `grim-dawn-builds` y las rutas no cambian (FR-028); las pruebas esperan el nombre nuevo y fallan con el antiguo (pruebas rojas primero cambiando la aserción); `content:validate` y los `*.int.spec.ts` pasan. Evidencia: `pnpm content:validate`, `pnpm test:scripts`, `pnpm --filter @gd/api test`, `*.int.spec.ts` con Postgres o nota «solo CI». Depende de: T007 (orden de implementación).
- [ ] **T015** [US6] [UI] Marca pública «Grim Builds» y aviso de no afiliación (US6; decisión de Paco 2026-11-16) — `apps/web/src/app/shared/ui/layout/site-layout.{html,ts,spec.ts}` (cabecera `layout.brand`; pie: sustituir `layout.independent` por un aviso EN/ES que diga independiente y **no afiliado ni respaldado por Crate Entertainment ni por Grim Dawn**), `apps/web/src/app/core/seo/seo.service.ts` (`SITE_NAME`, alt social) y sus specs, `apps/web/src/app/features/build/build.page.ts` (`SITE_NAME`, JSON-LD `publisher`), `apps/web/src/app/features/home/home.page.ts` (`title`, JSON-LD `WebSite`), `apps/web/src/app/features/static-pages/{about,legal}.page.{html,ts}` y specs, `apps/web/src/index.html`, `apps/web/src/locale/messages.{en,es}.xlf`, `apps/web/public/og/site.svg` y `site.png` (regenerar del SVG con el método de spec001; si no se puede, declarar el bloqueo), los demás specs de `apps/web/src` que citan la marca, `apps/web/PRODUCT.md` y `apps/web/DESIGN.md` (nombre «Grim Builds»; quitar el «pendiente de Paco» de `PRODUCT.md:9` y `:76` y la línea de `DESIGN.md:203`), `apps/web/src/brand.test.mts` (nuevo) y su registro en `test:scripts` de `package.json` — Aceptación: «Grim Builds» en cabecera, pie, `<title>`, `og:site_name`, `og:title`, JSON-LD y la imagen social, en EN y ES (FR-023); aviso de no afiliación visible en todas las páginas, EN y ES, con paridad de xlf sin excepción nueva (FR-024); `PRODUCT.md`/`DESIGN.md` actualizados (FR-025); la prueba de marca **falla** si «Grim Dawn Builds» reaparece en `apps/web/src`, `apps/web/public`, `apps/web/*.md`, los xlf o el HTML prerrenderizado, y **no** falla con menciones a «Grim Dawn» como juego (FR-026, FR-027); no se crea manifiesto (FR-029). Pruebas rojas primero (la prueba de marca falla antes del cambio). Mide `/tier-list` antes y después: el aviso reescribe el texto del pie, no añade otro, y no baja del margen de T008 (SC-008). Evidencia: `pnpm test` (web), `pnpm test:scripts`, `pnpm check:locale-parity`, `pnpm e2e:a11y`, `pnpm check:performance`, capturas EN/ES a 375/1280 px solo con marca y aviso distintos. Depende de: T012, T013 y T014.

**Checkpoint F6**: ninguna cadena de marca antigua; aviso de no afiliación en EN y ES.

---

## Fase 7 — US7 y US8 Verificación visual (P3; después de la marca y de los cambios visuales)

- [ ] **T016** [US7] [UI] Revisión de fidelidad visual (informe y tareas de corrección) — `e2e/fidelity-capture.spec.ts` (nuevo, solo captura y escribe en `test-results/fidelity/`, carpeta ignorada), `package.json` (script `e2e:fidelity`), `specs/005-deuda-revisiones/reviews/fidelity.md` (informe) — Aceptación: (1) el implementador UI construye el artefacto con `ASSET_SOURCE=own` y captura las cinco rutas × 375/768/1280 × EN/ES (30) más los estados del tooltip (reposo, ratón, foco, fijado por toque, volteo en el borde) a 375/768/1280, sin versionar ninguna captura (FR-030); (2) el **orquestador UI** lanza con `Start-Subagente.ps1` un especialista con visión, que contrasta las capturas con `apps/web/DESIGN.md` y `apps/web/PRODUCT.md` y, si existen, con `C:\Users\paco_\Pictures\gdb-referencias` (hoy vacía: el informe lo declara y no se detiene) (FR-031); (3) `reviews/fidelity.md` lista cada discrepancia con ruta, ancho, idioma, estado, captura local, regla incumplida, severidad y tarea de corrección propuesta; ninguna captura del juego se copia ni se reproduce (FR-032, SC-010). El informe no corrige nada: las correcciones que el principal acepte se incorporan a este `tasks.md` (IDs que reserva el principal, desde T019) y **se hacen antes de T017**. Evidencia: informe, `git ls-files` sin capturas, `pnpm lint:md`. Depende de: T015 (marca) y T008–T012 (cambios visuales de S4-D\*).
- [ ] **T017** [US8] [UI] Regresión visual con `toHaveScreenshot` en CI — `e2e/visual.spec.ts` (nuevo), `playwright.visual.config.ts` (nuevo), `e2e/visual-baselines/**` (referencias PNG, fuera de `__screenshots__/`), `.github/workflows/ci.yml` (trabajo `visual-regression`), `.github/workflows/visual-baselines.yml` (nuevo, `workflow_dispatch`), `scripts/ci-workflow.test.mts` (+ la prueba que exija el trabajo), `package.json` (`e2e:visual`, `e2e:visual:update`), `docs/` o `CONTRIBUTING.md` (procedimiento de actualización) — Aceptación: cinco rutas × 375/768/1280 × EN/ES = 30 capturas con el entorno y la tolerancia de `plan.md` («Regresión visual: diseño»); el trabajo de CI construye el artefacto con `ASSET_SOURCE=own` en su propio directorio y no toca el que miden las demás puertas; las referencias se generan solo con el flujo `visual-baselines` (Linux) y se descargan como artefacto para commitearlas; la prueba pasa dos veces seguidas sin cambios y falla con un cambio de CSS deliberado, nombrando ruta, ancho e idioma (FR-033 a FR-036, SC-011). Prueba roja primero (sin referencias falla). Evidencia: ejecución del flujo de referencias, dos ejecuciones verdes del trabajo, una roja con cambio deliberado, `pnpm test:scripts`. Depende de: T016 y de sus correcciones, T008–T012 y T015 (FR-037). Necesita que Paco permita ejecutar el flujo en GitHub (el agente no hace push).

**Checkpoint F7**: informe de fidelidad entregado, correcciones aplicadas y 30 referencias visuales verdes dos veces seguidas en CI.

---

## Fase 8 — Cierre

- [ ] **T018** [IMPL] Puerta de cierre de spec005 (spec002 + T-136) y registro — `specs/005-deuda-revisiones/reviews/`, `specs/README.md` — Aceptación: se marca antes de ejecutarla según el precedente (spec002 T014, spec003 T021, spec004 T036); resultado de las cuatro revisiones en `reviews/`; `specs/README.md` con la fila de spec005; `pnpm verify` exit 0 (si solo falla el TBT, repetir `pnpm check:performance` sola y citar cifras). Evidencia: `reviews/completion-review.json` con la puerta `passed`. Depende de: T001–T017 y de las correcciones que acepte el principal.

---

## Dependencias y orden

```text
T001 (S4-D1, primera)
T001 -> T002 -> T003 -> T004 -> T007 -> T014
T002 -> T005 -> T006
T008 [P] T010 [P] T013          (disjuntas; arrancan a la vez)
T008 -> T009 -> T012
T010 -> T011  (T008 antes, por la medida)
T012, T013, T014 -> T015
T015, T008..T012 -> T016 -> (correcciones, desde T019) -> T017
T001..T017 -> T018
```

- Implementación (T001–T005, T007) y UI (T006, T008–T013) pueden avanzar a la vez en worktrees distintos; las aristas entre áreas son T005 → T006 y T014 → T015.
- `[P]` solo en T008, T010 y T013 (archivos disjuntos). Todo lo demás comparte archivos y va en serie.
- T014 va antes que T015 porque las pruebas de contenido de `apps/web` leen las fixtures; se integran seguidas y `pnpm verify` se corre tras ambas.

## Cobertura de requisitos

| Requisito          | Tarea              |
| ------------------ | ------------------ |
| FR-001 a FR-004    | T001               |
| FR-005, FR-008     | T002, T003         |
| FR-006, FR-007     | T004               |
| FR-009             | T005               |
| FR-010             | T006               |
| FR-011, FR-012     | T007               |
| FR-013             | T008               |
| FR-014             | T009               |
| FR-015             | T010               |
| FR-016             | T011               |
| FR-017             | T012               |
| FR-018, FR-019     | T013               |
| FR-023, FR-024, FR-025, FR-026, FR-027, FR-029 | T015 |
| FR-028             | T014               |
| FR-030, FR-031, FR-032 | T016           |
| FR-033, FR-034, FR-035, FR-036 | T017    |
| FR-037             | T016, T017 (orden) |
| FR-020, FR-021, FR-022 | todas (transversal); T018 verifica |
