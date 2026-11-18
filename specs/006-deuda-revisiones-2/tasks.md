---
description: 'Tareas de la segunda tanda de deuda de las revisiones de spec004 y spec005'
---

# Tasks: Deuda aplazada de las revisiones de spec004 y spec005 (segunda tanda)

**Input**: `specs/006-deuda-revisiones-2/{spec.md,plan.md,research.md,data-model.md,quickstart.md}`
**Prerequisites**: spec005 cerrada (puerta spec002 `passed`, `cc553c3`). Preguntas P33 y P34 **respondidas por Paco el 2026-11-17**: P33 = A; P34 a, b y d dentro, c fuera (ver «Clarifications» en `spec.md`).
**Tests**: Sí, primero en rojo y después la implementación (constitución IX, FR-018). T004 es solo documentación.

**Formato**: `[ID] [P?] [US?] [Área] descripción` — `[P]` = archivos disjuntos. Cada tarea declara archivos, aceptación y evidencia. **Ninguna casilla `[x]` sin salida real citable** (comando y resultado). Áreas: **IMPL** = implementación (`apps/api`, `packages/*`, `scripts/`, CI); **UI** = `apps/web` y `e2e/`; **DOCS** = solo artefactos SDD, de UI.

> **Estado (2026-11-17)**: 10 tareas (T001–T010): T001–T008 hechas (T008 marcada con la puerta spec002 en curso); T009 abierta y T010 hecha, correcciones de la ronda 1 de la puerta (decisión de Paco P35 = A). Sin fase de setup: dependencias, `packages/domain` y gitleaks ya están listos en los worktrees de la corrida. Sin fase fundacional: T001 va primera por decisión de Paco, no porque bloquee a las demás.

---

## Fase 1 — US1 Puertas sobre el artefacto (P1, primera por decisión de Paco)

**Objetivo**: ninguna de las cuatro puertas que leen páginas prerrenderizadas pasa en vacío, con un solo criterio. **Prueba independiente**: quickstart «US1».

- [x] **T001** [US1] [IMPL] Helper único de páginas prerrenderizadas (S4-D1; P33 = A; research D1) — `scripts/artifact-pages.mts` (nuevo), `scripts/artifact-pages.test.mts` (nuevo), `scripts/check-assets.mts` (`assertCredit` `:187-215`, `assertNoGamePortraits` `:154-166`), `scripts/check-assets.test.mts`, `scripts/check-legacy-brand.mts` (`assertNoLegacyBrand` `:41-55`), `scripts/check-legacy-brand.test.mts`, `package.json` (registrar `artifact-pages.test.mts` en `test:scripts`) — Aceptación: `prerenderedPages(browserDir, { gate, minPages })` falla con mensaje que nombra la puerta y la causa si `browser/` no existe, no es un directorio real o tiene menos de `minPages` `.html` (FR-001); las dos puertas de crédito, `assertNoGamePortraits` (solo `own`) y `assertNoLegacyBrand` (`minPages = MIN_PRERENDERED_PAGES + 1`) la usan y no conservan otra copia del criterio (FR-002, SC-002); `assertNoGamePortraits` falla con artefacto ausente o sin páginas en `own` (FR-003; hoy pasa); con artefacto válido salidas idénticas en `game` y `own` (FR-004); las puertas de compare-builds, huella de release, escaneo de secretos, `check:initial-js` y `check:performance` no se tocan. Pruebas rojas primero: `assertNoGamePortraits` sin artefacto y con `browser/` sin `.html` (FR-005). Evidencia: `pnpm test:scripts`, `pnpm assets:check`, `grep -n "pages.length" scripts/check-assets.mts scripts/check-legacy-brand.mts` sin criterio de vacío, `pnpm check:boundaries`. Depende de: nada. Evidencia real: `pnpm test:scripts` 812 pruebas, 0 fallos; rojo previo de `assertNoGamePortraits` visto; `assets:check`, `check:boundaries`, `lint`, `check:scope` OK.

**Checkpoint F1**: las cuatro puertas fallan cerrado; un solo criterio de vacío.

---

## Fase 2 — US2 Tarjeta determinista (P2)

**Objetivo**: el id de la descripción de la tarjeta sale de su contenido. **Prueba independiente**: quickstart «US2 y US3».

- [x] **T002** [P] [US2] [UI] Id estable de `gd-build-card` (L1 = F-301 = B-11 = A-101; research D2) — `apps/web/src/app/shared/ui/build-card/build-card.{ts,model.ts,labels.ts,spec.ts}`, `apps/web/src/app/features/tier-list/card-data.ts` (+`card-data.spec.ts`), `apps/web/src/app/features/tier-list/tier-preview.component.ts`, `apps/web/src/app/features/home/home-builds.ts` (+su spec) y los specs que construyen `BuildCardInput` — Aceptación: `key` obligatoria en `BuildCardInput` y `BuildCardData` (catálogo `card.id`, portada `guide.slug`, preview literales); `descriptionId = 'build-card-combination-' + key`; sin `let` de módulo en `build-card.ts` y docstring cierto (FR-006, FR-007); prueba roja: dos renders de la misma tarjeta, en orden distinto, dan el mismo id; prueba de unicidad de ids en el catálogo de fixtures; nombre y descripción accesibles sin cambios (FR-010). **Medir** `/tier-list` antes y después (`pnpm build` raíz y `pnpm check:initial-js`): ≤ 112 000 B; si supera, detenerse y escalar. Evidencia: `pnpm test` (web), `pnpm lint`, `pnpm build` dos veces con `diff` vacío de los `id="build-card-combination-…"` de `/tier-list` EN y ES (SC-003), `pnpm e2e:a11y` 0 violaciones, regresión visual en Docker 30 passed sin regenerar (SC-006). Depende de: T001 (orden). Evidencia real: rojo previo visto (`key` inexistente en `BuildCardInput`); `pnpm test` web 679 pruebas OK, `pnpm lint` OK; `pnpm build` x2 con diff vacio de ids de `/tier-list` EN (45) y ES (0); `/tier-list` 111403 B antes, 111428 B despues (tope 112000); `pnpm e2e:a11y` 171 passed; regresion visual Docker 30 passed sin regenerar, `git status e2e/visual-baselines` limpio.

**Checkpoint F2**: HTML de tarjetas determinista; presupuestos y capturas sin cambios.

---

## Fase 3 — US3 Tarjeta al día (P3)

**Objetivo**: comentarios, rama muerta y e2e de la descripción accesible. **Prueba independiente**: quickstart «US2 y US3».

- [x] **T003** [P] [US3] [UI] Comentarios de `srCombination`, rama sin enlace y e2e de `aria-describedby` (L2 = C-201 = A-102 y L3 = resto de B-12; research D3) — `apps/web/src/app/shared/ui/build-card/build-card.{ts,model.ts,labels.ts,spec.ts}`, `e2e/a11y.spec.ts` — Aceptación: prueba previa con los adaptadores reales que demuestra que `combinationLang` solo aparece con `href` y, con ella, la rama `@else` deja de pintar `srCombination` (si la prueba demuestra lo contrario, la rama se conserva y se prueba); comentarios de `build-card.labels.ts:66-68` y `build-card.model.ts:66-70` al mecanismo `aria-describedby` (FR-008); e2e nuevo en `e2e/a11y.spec.ts`: `/tier-list` enlace de la guía con `toHaveAccessibleDescription` que contiene la combinación ES y el elemento descrito con `lang="es"`; `/es/tier-list` sin descripción (FR-009, SC-004). E2E rojo primero (no existe). Evidencia: `pnpm test` (web), `pnpm typecheck:e2e`, `pnpm e2e:a11y` (0 violaciones, casos nuevos en verde), `pnpm build && pnpm check:initial-js` (≤ 112 000 B). Depende de: T002 (mismos archivos). **Hecho**: la prueba con los adaptadores reales demostró la rama muerta y se retiró; e2e rojo (No tests found) a verde; `pnpm test` 683 passed, `typecheck:e2e` OK, `e2e:a11y` 177 passed, `/tier-list` 111 395 B (tope 112 000), visual Docker 30 passed.

**Checkpoint F3**: la tarjeta no tiene ramas ni comentarios que mientan; descripción probada en navegador.

---

## Fase 4 — US4 Registro SDD (P3)

**Objetivo**: los artefactos dicen el estado real. **Prueba independiente**: quickstart «US4».

- [x] **T004** [P] [US4] [DOCS] Base aceptada de `/tier-list`, nota de T040 y `specs/README.md` (to-do 134; L4 = B-10; P34 c) — `specs/005-deuda-revisiones/spec.md` (SC-008, `:256`), `specs/005-deuda-revisiones/plan.md` (`:27`), `specs/005-deuda-revisiones/quickstart.md` (`:266-271`), `specs/005-deuda-revisiones/tasks.md` (`:141`), `specs/README.md` — Aceptación: la base dice «111 403 B (margen 597 B), aceptada por Paco el 2026-11-17» en los cuatro archivos, sin «pendiente» ni «a la espera» (FR-011); la nota de T040 deja una sola versión del fallo de `e2e:a11y` T052 (resuelto en T040 con `aria-describedby`) (FR-012); `specs/README.md`: spec004 «Cerrada (puerta spec002 passed)» con su commit, spec005 «Cerrada (puerta spec002 passed, `cc553c3`)», sección de spec003 sin S3-T042/S3-T043 como aplazados (resueltos por spec005 T003/T004), y fecha de actualización (FR-013); ningún archivo de `specs/003-*` ni `specs/004-*` cambia (FR-014). Evidencia: `grep -rn "confirmación de Paco\|a la espera" specs/005-deuda-revisiones/{spec,plan,quickstart,tasks}.md` sin líneas de la base, `git diff --stat` solo con esos cinco archivos, `pnpm lint:md` 0 issues (SC-005). Depende de: T001 (orden). Evidencia real: los `grep` de la base sin líneas de la base, `git diff --stat` con los cinco archivos, `pnpm lint:md` 0 issues, `pnpm check:scope` OK.

**Checkpoint F4**: registro coherente.

---

## Fase 5 — US5 Siembra, contenedor y arranque en frío (P3; P34 a, b, d)

**Objetivo**: F-002, S-001 y la mediana de `coldStartMs`. **Prueba independiente**: quickstart «US5».

- [x] **T005** [P] [US5] [IMPL] Poda de nodos del catálogo después de reescribir las guías (F-002; P34 a; research D4) — `apps/api/src/db/write-content.mts` (`writeCatalogRows` `:398-431` y paso nuevo junto a `retireMasteries` `:367`), `apps/api/src/db/seed.mts` (`:252-256`, `:282-287`), `apps/api/src/db/bootstrap.mts` (`:111-116`), `apps/api/src/db/seed.spec.ts`, `apps/api/test/seed.int.spec.ts`, `apps/api/test/bootstrap.int.spec.ts` — Aceptación: antes del upsert solo se borran nodos ausentes sin referencias; después de `writeContentRows` el resto, con 23503 → `SeedError('reference', <maestría>)`; 23505 de celda ocupada por un nodo ausente aún referenciado → `reference`; los tres llamadores siguen el mismo orden (FR-015). Pruebas rojas primero con Postgres real: (1) una guía deja de usar un nodo que el catálogo quita en la misma siembra → OK (hoy 23503); (2) el nodo quitado sigue usado → `reference` con la maestría, sin cambios parciales; (3) un nodo nuevo ocupa la celda de uno quitado sin uso → OK; siembra idempotente sin cambios. Evidencia: `RUN_DB_TESTS=1` sobre `seed.int.spec.ts` y `bootstrap.int.spec.ts` (o la suite de BD completa) con el Postgres de la corrida, `pnpm --filter @gd/api test`, `pnpm --filter @gd/api typecheck`; si no hay Postgres, nota «solo CI» antes de marcar. Depende de: T001. **Hecho**: `pruneCatalogNodes` tras `writeContentRows` en seed, seedCatalog y bootstrap; suite de BD de la API 500 passed con Postgres real, typecheck OK.
- [x] **T006** [P] [US5] [IMPL] El contenedor de referencias visuales solo recibe archivos versionables (S-001 = S-101 = B-13; P34 b; research D5) — `scripts/visual-baselines-docker.sh`, `scripts/visual-baselines-docker.test.mts` (nuevo), `package.json` (registrar la prueba en `test:scripts`), `CONTRIBUTING.md` (`:252-270`), `CONTRIBUTING.es.md` (misma sección) — Aceptación: el comando documentado envía el árbol por stdin (`git ls-files -co --exclude-standard -z | tar --null -T - -cf - | docker run -i …`) y no monta `$PWD:/src`; el script extrae en `/work` y aborta si hay `.env`, `.env.*` (salvo `.env.example`) o `infra/docker/secrets/`; sin `tar -X` ni patrones con comodines; los dos `CONTRIBUTING` y los comentarios del script describen la frontera real (FR-016). Prueba roja primero: el script no referencia `/src` y contiene la guarda; los `CONTRIBUTING` no montan `$PWD:/src`. Evidencia: `pnpm test:scripts`, `sh -n scripts/visual-baselines-docker.sh`, Docker real: con un `.env` de prueba en el host, `docker run -i … sh -c` que extrae y comprueba `test ! -e /work/.env`, y `check` con 30 passed; `git status e2e/visual-baselines` limpio. Sin Docker, no se marca. Depende de: T005 (serie del área) y T001 (`package.json`). Evidencia (hecha): prueba roja 0/3 a verde 3/3; `pnpm test:scripts` 813 pass, 0 fail; `sh -n` OK; Docker con `.env` de prueba: `test ! -e /work/.env` OK, la guarda aborta con exit 1 si el árbol trae `.env`, `check` 30 passed sin regenerar y `git status e2e/visual-baselines` limpio.
- [x] **T007** [P] [US5] [IMPL] `coldStartMs` como mediana de 3 arranques (to-do 117; P34 d; research D6) — `apps/api/test/performance.int.spec.ts` (`:67`, `:195-224`, `:298`, `:326`, `:523-525`) — Aceptación: 3 arranques en serie, `coldStartMs` = mediana comparada con 5000 ms; la consola lista las 3 muestras; el JSON conserva `coldStartMs` numérico (sin tocar `scripts/check-performance.mts:692`); tiempo del caso 90 s (FR-017). Prueba roja primero: función pura de mediana con un atípico (p. ej. `[900, 7000, 950]` → 950 ≤ 5000). Evidencia: `RUN_DB_TESTS=1 pnpm --filter @gd/api exec vitest run test/performance.int.spec.ts` con el Postgres de la corrida (salida con las 3 muestras), `pnpm --filter @gd/api typecheck`. Depende de: T006 (serie del área). **Evidencia T007**: rojo `median is not defined`; verde con Postgres 17 real, muestras [1056, 1043, 1031] ms, mediana 1043 ms ≤ 5000; 7 tests OK; `typecheck` OK; `check:performance --backend` OK.

**Checkpoint F5**: siembra válida no falla; frontera del contenedor real; presupuesto de arranque estable.

---

## Fase 6 — Cierre

- [x] **T008** [IMPL] Puerta de cierre de spec006 (spec002 + T-136) y registro — `specs/006-deuda-revisiones-2/reviews/`, `specs/006-deuda-revisiones-2/tasks.md`, `specs/README.md` (fila de spec006) — Aceptación: se marca antes de ejecutarla según el precedente (spec002 T014, spec003 T021, spec004 T036, spec005 T018); `node scripts/spec-review.mjs prepare --feature specs/006-deuda-revisiones-2` en `ready`; cuatro revisiones reales (code, architecture, security, best-practices) y T-136 con `speckit-review-complete`; resultado en `reviews/completion-review.json` y `node scripts/spec-review.mjs check` en `passed`; `specs/README.md` con spec006 cerrada y su commit; `pnpm verify` exit 0 (si solo falla el TBT, repetir `pnpm check:performance` sola y citar cifras); `pnpm lint:md` y `pnpm check:scope` OK. Hallazgos de la puerta: decisión del principal/Paco y, si se aplazan, en `reviews/deuda.md`. Evidencia: `reviews/completion-review.json` con la puerta `passed`. Depende de: T001–T007. **Evidencia (puerta spec002 en curso)**: `quickstart.md` «Evidencia de cierre (T008)»; `pnpm verify` exit 0, `check:performance` 141/141, API con BD 501 passed, a11y 177 passed, journeys 544 passed, visual Docker 30 passed, `test:scripts` 813 pass, `lint:md` 0, `check:scope` OK.

---

## Fase 7 — Correcciones de la ronda 1 de la puerta (T008)

**Objetivo**: corregir los hallazgos de la ronda 1 de la puerta spec002 que Paco decidió arreglar (P35 = A, 2026-11-17); S-001 y B-002 se aplazan en `reviews/deuda.md`. **Prueba independiente**: quickstart «US3» (T010) y la suite de BD de la API (T009). No se reabren T001–T008.

- [x] **T009** [IMPL] Guarda de celda de `pruneCatalogNodes` con las guías previas (F-001 = A-001 = C-001, ronda 1; P35 = A) — `apps/api/src/db/write-content.mts` (`:465`), `apps/api/test/seed.int.spec.ts` (y `bootstrap.int.spec.ts` si el caso aplica) — Aceptación: renombrar un nodo en la misma celda a la vez que la guía cambia de nodo es una siembra válida: la guarda de celda no usa las referencias de las guías previas a la reescritura y no aborta un renombrado en sitio coherente; un nodo quitado que sigue referenciado por una guía final sigue dando `SeedError('reference', <maestría>)` sin cambios parciales (FR-015 intacto). Prueba roja primero con Postgres real: el renombrado en la misma celda con cambio de guía. Evidencia: `RUN_DB_TESTS=1` sobre `seed.int.spec.ts` y `bootstrap.int.spec.ts`, `pnpm --filter @gd/api test`, `pnpm --filter @gd/api typecheck`. Depende de: T008 (ronda 1 de la puerta). **La implementa otro agente tras T010.** Evidencia: prueba roja `SeedError: reference: class06` en el renombrado en sitio; la guarda se sustituye por aparcar la fila de la celda (`grid_row + 1000000`) y decide el FK en `pruneCatalogNodes`; verde con `RUN_DB_TESTS=1` (181 pruebas en 14 archivos, y 502 en la suite de BD completa), `pnpm --filter @gd/api test` y `typecheck`.
- [x] **T010** [UI] e2e de la descripción en la portada y coherencia del registro (C-002, B-003, B-001 de la ronda 1; P35 = A) — `e2e/a11y.spec.ts` (`:579`), `specs/006-deuda-revisiones-2/research.md` (§R8 `:55`, `:57`), `specs/README.md` (fila y sección de spec006) — Aceptación: C-002, e2e nuevo de la descripción accesible en `/` (tarjeta de guía con `aria-describedby`, `toHaveAccessibleDescription` con la combinación ES y elemento descrito con `lang="es"`) y `/es` (sin descripción) (FR-009); B-003, §R8 remite a D2 (id sin saneado, IDREF válido con `:`) sin contradecir la implementación de T002; B-001, fila de spec006 en `specs/README.md` «Implementada; puerta spec002 en curso» con el recuento real y su sección al día. E2E rojo primero (no existe). Evidencia: `pnpm typecheck:e2e`, `pnpm e2e:a11y --workers=2` (0 violaciones, casos nuevos en verde), `pnpm lint`, `pnpm lint:md`, `pnpm check:scope`, `node scripts/spec-review.mjs prepare --feature specs/006-deuda-revisiones-2`. Depende de: T008 (ronda 1). Evidencia real: e2e rojo (`No tests found`) a verde (6 passed en 3 viewports); `pnpm typecheck:e2e` OK; `pnpm e2e:a11y --workers=2` 183 passed, 0 violaciones; `pnpm lint` OK; `pnpm check:scope` OK (267 archivos); `pnpm lint:md` y `spec-review prepare` en el reporte.

**Checkpoint F7**: hallazgos corregidos de la ronda 1 cerrados o aplazados con motivo; la puerta se repite sobre el resultado.

---

## Dependencias y orden

```text
T001 ──┬── UI:   T002 → T003        T004 (cuando quiera)
       └── IMPL: T005 → T006 → T007
T002..T007 ── T008 ── T009 (IMPL), T010 (UI), en paralelo
```

- **T001 primero** (decisión de Paco), integrada antes de abrir lo demás.
- **UI** y **implementación** avanzan en paralelo, cada una en su worktree: no comparten archivos (marca `P` entre áreas). Dentro de UI, T002 → T003 comparten `build-card.*`; T004 es disjunta y puede ir en paralelo con T002/T003. Dentro de implementación todo va en serie (orden del área y `package.json` compartido por T001 y T006).
- Única arista entre áreas: `specs/README.md` (T004 de UI antes que T008 de implementación).

### Ejemplos de paralelismo

- Tras integrar T001: UI lanza T002 y, en otro agente, T004; implementación lanza T005.
- Tras T002: UI lanza T003 mientras implementación sigue con T006.

## Estrategia

1. **MVP**: T001 (la única puerta de derechos que pasa en vacío).
2. Incremental: T002–T003 (tarjeta), T004 (registro), T005–T007 (datos, seguridad local, rendimiento), cada una verificable sola.
3. T008 cierra con la puerta.

## Cobertura de requisitos

| Requisito | Tareas |
| --------- | ------ |
| FR-001 – FR-005 | T001 |
| FR-006, FR-007 | T002 |
| FR-008, FR-009 | T003 |
| FR-010 | T002, T003 (medida y capturas) |
| FR-011 – FR-014 | T004 |
| FR-015 | T005 |
| FR-016 | T006 |
| FR-017 | T007 |
| FR-009 (portada), ronda 1 | T010 |
| FR-015 (guarda de celda), ronda 1 | T009 |
| FR-018 | T001–T003, T005–T007 (prueba roja primero) |
| FR-019 | T008 y numeración T001–T008 |
| FR-020 | todas (ninguna toca estilos ni cadenas visibles) |
| SC-001, SC-002 | T001 |
| SC-003 | T002 |
| SC-004 | T003 |
| SC-005 | T004 |
| SC-006 | T002, T003 |
| SC-007 | T005, T006, T007 |
