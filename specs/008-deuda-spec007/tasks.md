---
description: 'Tareas de la deuda de spec007: erratum DV1/DV2, registro y recorrido único del artefacto'
---

# Tasks: Deuda de spec007 (erratum DV1/DV2, registro y recorrido único del artefacto)

**Input**: `specs/008-deuda-spec007/{spec.md,plan.md,research.md,data-model.md,quickstart.md}`
**Prerequisites**: spec007 cerrada (puerta spec002 `passed` en `95f18de`, fusionada en `mvp/1` en `1375dda`). Clarify resuelto por el planificador sin Paco (ver «Clarifications» en `spec.md`).
**Tests**: Sí, primero en rojo y después la implementación (constitución IX, FR-011). T001 es solo documentación.

**Formato**: `[ID] [P?] [US?] [Área] descripción` — `[P]` = archivos disjuntos. Cada tarea declara archivos, aceptación y evidencia. **Ninguna casilla `[x]` sin salida real citable** (comando y resultado). Áreas: **IMPL** = implementación (`scripts/`); **DOCS** = solo artefactos SDD, de UI.

> **Estado (2026-11-18)**: 4 tareas (T001–T004), ninguna hecha. Sin fase de setup: dependencias, `packages/domain` y gitleaks ya están listos en los worktrees de la corrida. Sin fase fundacional: T001 y T002 son independientes; T003 depende de T002 y T004 (cierre) de todas.

---

## Fase 1 — US2 Registro de spec007 (P2)

**Objetivo**: el registro SDD describe el estado real de spec007. **Prueba independiente**: quickstart «US2». Va primero en el archivo porque la hace otro área (UI) en paralelo con la Fase 2.

- [x] **T001** [P] [US2] [DOCS] Erratum DV1/DV2 y registro de spec007 (B-101 = A-101 y entrada 2 de la ronda 2 de spec007; research §R1, §R2, R8-D1, R8-D2) — `specs/008-deuda-spec007/erratum.md` (nuevo), `specs/007-deuda-revisiones-3/reviews/deuda.md` (`:15-19`), `specs/README.md` (`:4`, `:14`, `:62-68`) — Aceptación: `erratum.md` cita el criterio (4) de T007 en `specs/007-deuda-revisiones-3/tasks.md:68` como erróneo, fija DV1 = S6-D3 (caso de componente de `HomePage` con 3 guías, T003) y DV2 = B-002 (regla en `buildCardData`, T002), remite a `specs/007-deuda-revisiones-3/plan.md:135-136` y `reviews/analyze.md:11-12` como fuente vigente y explica por qué `tasks.md` de spec007 no se edita (FR-007); en `deuda.md`, las entradas 1 (B-101 = A-101) y 2 (fila de spec007) de la ronda 2 dicen «Cerrada por spec008 T001» con enlace a spec008, sin borrar el texto original; la entrada S-003 = A-002 (ronda 1) y la 3 de la ronda 2 (S-101, A-002) **no** se marcan aquí: las cierra T004 cuando T002–T003 estén integradas (FR-008); `specs/README.md`: fila de spec007 «Cerrada (puerta spec002 passed, `95f18de`)», «7 de 7», «0»; su sección dice cerrada, puerta `passed` en `95f18de` (snapshot `bf9dac85…`), fusionada en `mvp/1` en `1375dda` (PR #13), y remite su deuda a spec008 (S-003 = A-002 «en curso en spec008 T002–T003»); fecha de actualización (FR-009); `git diff --stat -- specs/007-deuda-revisiones-3` solo con `reviews/deuda.md` y ningún archivo de `specs/001-*` a `specs/006-*` (FR-010). Sin prueba roja: solo docs (FR-011 no aplica; declararlo). Evidencia: `grep -n "DV1\|DV2" specs/008-deuda-spec007/erratum.md`, `grep -n "spec008" specs/007-deuda-revisiones-3/reviews/deuda.md`, `git diff --stat`, `pnpm lint:md` 0 issues, `pnpm check:scope` OK. Depende de: nada. **Evidencia (T001)**: solo docs, sin prueba roja (FR-011 no aplica); `grep` de `erratum.md` con DV1/DV2 (líneas 19-20) y de `deuda.md` de spec007 con «Cerrada por spec008 T001» en las entradas 1 y 2 (líneas 19 y 21); `git diff --stat` solo `specs/007-deuda-revisiones-3/reviews/deuda.md` y `specs/README.md` (más `erratum.md` nuevo), sin `specs/001-*` a `006-*`; `pnpm lint:md` 0 issues, `pnpm check:scope` OK (269 archivos).

**Checkpoint F1**: registro de spec007 coherente; spec007 intacta fuera de `reviews/`.

---

## Fase 2 — US1 Lectura única del artefacto (P1)

**Objetivo**: cada puerta lee el artefacto una vez y examina lo que validó. **Prueba independiente**: quickstart «US1».

- [x] **T002** [P] [US1] [IMPL] Lectura validada única en `prerenderedPages` (S-003 = A-002, primera parte; research §R3, §R6, R8-D3) — `scripts/artifact-pages.mts` (`:10-20`, `:31-56`), `scripts/artifact-pages.test.mts` — Aceptación: una función exportada de `artifact-pages.mts` hace la única `readdirSync(dir, { recursive: true, withFileTypes: true })` y devuelve las entradas válidas y las no regulares; el mensaje de no regular se construye en un solo sitio con el texto de hoy (`«<gate>: el artefacto es inválido (enlace o entrada no regular: <raíz>/<rel>).»`); `prerenderedPages` consume esa lectura y lee el directorio **1** vez por llamada (FR-001, SC-001); mismos mensajes y orden que hoy (research §R3, pasos 1–4; FR-003); `assertRegularEntries` sigue exportada como envoltorio de la lectura única, sin `readdirSync` propia, hasta T003. Pruebas primero (FR-004): (1) espía `mock.method(fs, 'readdirSync')` + `syncBuiltinESMExports()` restaurado en `finally`/`t.after`, que espera 1 lectura en `prerenderedPages` sobre un artefacto válido (rojo hoy: 2); (2) caracterización de mensaje exacto (igualdad de texto) para enlace bajo `browser/` y para `browser/` sin páginas, verde antes y después; las 7 pruebas existentes sin tocar su aserción. Evidencia: `node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts scripts/check-legacy-brand.test.mts` (rojo del espía con su salida y verde), `pnpm test:scripts` (recuento antes y después, 0 fail), `pnpm check:boundaries`, `pnpm lint`. Depende de: nada.
- [x] **T003** [US1] [IMPL] `assertNoGamePortraits` sobre la lectura única (S-003 = A-002, segunda parte; research §R3, R8-D3; data-model «Orden de comprobaciones») — `scripts/check-assets.mts` (`:6`, `:156-171`), `scripts/check-assets.test.mts`; si queda sin consumidores, retirar `assertRegularEntries` de `scripts/artifact-pages.mts` — Aceptación: con `own`, una sola lectura del artefacto por llamada de la que se derivan, en este orden, la primera no regular bajo `browser/` (mensaje con `browser/<rel>`), el recuento de páginas (mismo mensaje, `minPages` 1), la primera no regular fuera de `browser/` (mensaje con `<basename(artifact)>/<rel>`) y la búsqueda de `assets/(portraits|skill-icons)/` sobre las entradas válidas (FR-002, FR-003, SC-001); con `game` o vacío, 0 lecturas; `check-assets.mts` no llama a `readdirSync` sobre el artefacto ni a `assertRegularEntries` (FR-006); `scripts/check-public-build.mts`, `scripts/check-release.mts` y `scripts/compare-builds.mts` sin cambios (FR-005). Pruebas primero (FR-004): (1) espía que espera 1 lectura con `own` (rojo hoy: 4) y 0 con `game`; (2) caracterización de mensaje exacto para la carpeta `assets/portraits` enlazada bajo `browser/` y para la carpeta enlazada en `server/`, y de la precedencia «`browser/` sin páginas + enlace en `server/` → mensaje de artefacto vacío», verde antes y después; las pruebas existentes de `check-assets.test.mts` sin tocar su aserción; enlaces con `t.skip(<motivo>)` solo ante `EPERM`/`EACCES`. Evidencia: `node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts scripts/check-legacy-brand.test.mts` (rojo del espía y verde), `pnpm test:scripts` (0 fail), `pnpm assets:check`, `pnpm check:boundaries`, `pnpm lint`, `git diff --stat` solo con `scripts/artifact-pages.{mts,test.mts}` y `scripts/check-assets.{mts,test.mts}`. Depende de: T002.

**Checkpoint F2**: ninguna puerta de páginas lee el artefacto dos veces ni sin validar.

---

## Fase 3 — Cierre

- [ ] **T004** [IMPL] Verificación de integración y puerta de cierre de spec008 (spec002 + T-136) — `specs/008-deuda-spec007/quickstart.md` (evidencia), `specs/008-deuda-spec007/reviews/`, `specs/008-deuda-spec007/tasks.md`, `specs/README.md` (fila de spec008), `specs/007-deuda-revisiones-3/reviews/deuda.md` (`:5-9`, `:20`) — Aceptación: se marca antes de ejecutar la puerta según el precedente (spec002 T014, spec003 T021, spec004 T036, spec005 T018, spec006 T008, spec007 T006); primero la verificación de integración sobre el resultado de T001–T003: `pnpm verify` exit 0 (`ASSET_SOURCE=own`; si solo falla el TBT, repetir `pnpm check:performance` y citar cifras), `ASSET_SOURCE=game pnpm build`, `pnpm build:release` o, si no hay API/BD, declararlo y citar `node --import tsx --test scripts/build-release.test.mts`, `pnpm lint:md` y `pnpm check:scope` OK, con su tabla en `quickstart.md` («Evidencia de cierre (T004)»); sin cambios en `apps/`, la regresión visual no es obligatoria (declararlo); después `node scripts/spec-review.mjs prepare --feature specs/008-deuda-spec007` en `ready`, cuatro revisiones reales (code, architecture, security, best-practices) y T-136 con `speckit-review-complete`, resultado en `reviews/completion-review.json` y `node scripts/spec-review.mjs check` en `passed` (SC-004); `specs/README.md` con spec008 cerrada y su commit; en `specs/007-deuda-revisiones-3/reviews/deuda.md`, la entrada S-003 = A-002 (ronda 1) y la 3 de la ronda 2 dicen «Cerrada por spec008 T002–T003» con enlace (FR-008). Hallazgos de la puerta: decisión del principal/Paco y, si se aplazan, en `reviews/deuda.md`. Evidencia: tabla de `quickstart.md` y `reviews/completion-review.json` con la puerta `passed`. Depende de: T001–T003.

---

## Dependencias y orden

```text
UI:   T001                 ─┐
IMPL: T002 ── T003         ─┴── T004 (IMPL, cierre)
```

- T001 y T002 son independientes y de áreas distintas (`[P]`); T003 espera a T002 (mismo agente de implementación, en serie); T004 espera a las tres.
- Aristas entre áreas: `specs/README.md` y `specs/007-deuda-revisiones-3/reviews/deuda.md` (T001 de UI antes que T004 de implementación; tocan entradas distintas).
- Las líneas de `tasks.md` de UI (T001) y de implementación (T002–T004) están en fases distintas, separadas por el checkpoint: no chocan al integrar.

### Ejemplos de paralelismo

- UI lanza T001 en un agente mientras implementación lanza T002 y, al aceptarla, T003 en el mismo agente.

## Estrategia

1. **MVP**: T002 + T003 (la única deuda con efecto en una puerta de derechos).
2. Incremental: T001 (registro), verificable sola.
3. T004 verifica la integración y cierra con la puerta.

## Cobertura de requisitos

| Requisito      | Tareas                                                |
| -------------- | ----------------------------------------------------- |
| FR-001         | T002                                                  |
| FR-002         | T003                                                  |
| FR-003, FR-004 | T002, T003                                            |
| FR-005, FR-006 | T003                                                  |
| FR-007         | T001                                                  |
| FR-008         | T001 (ronda 2, entradas 1–2), T004 (S-003, entrada 3) |
| FR-009         | T001 (spec007), T004 (spec008)                        |
| FR-010         | T001 (y todas: ninguna toca spec001–spec006)          |
| FR-011         | T002, T003 (prueba roja primero); T001 sin código     |
| FR-012         | T004 y numeración T001–T004                           |
| FR-013         | todas (ninguna toca estilos, cadenas ni lo diferido)  |
| SC-001         | T002, T003                                            |
| SC-002         | T002, T003                                            |
| SC-003         | T001                                                  |
| SC-004         | T004                                                  |
