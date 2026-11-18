---
description: 'Tareas de la tercera tanda de deuda: LOW de spec006 y de la CI'
---

# Tasks: Deuda LOW de spec006 y de la CI (tercera tanda)

**Input**: `specs/007-deuda-revisiones-3/{spec.md,plan.md,research.md,data-model.md,quickstart.md}`
**Prerequisites**: spec006 cerrada (puerta spec002 `passed`, `c626f26`, fusionada en `mvp/1` en `81179fc`). Clarify resuelto por el planificador sin Paco (ver «Clarifications» en `spec.md`).
**Tests**: Sí, primero en rojo y después la implementación (constitución IX, FR-015). T005 es solo documentación; T004 solo comentarios.

**Formato**: `[ID] [P?] [US?] [Área] descripción` — `[P]` = archivos disjuntos. Cada tarea declara archivos, aceptación y evidencia. **Ninguna casilla `[x]` sin salida real citable** (comando y resultado). Áreas: **IMPL** = implementación (`apps/api`, `packages/*`, `scripts/`, CI); **UI** = `apps/web` y `e2e/`; **DOCS** = solo artefactos SDD, de UI.

> **Estado (2026-11-18)**: 6 tareas (T001–T006), ninguna hecha. Sin fase de setup: dependencias, `packages/domain` y gitleaks ya están listos en los worktrees de la corrida. Sin fase fundacional: ninguna tarea bloquea a otra salvo T006 (cierre). A-01, A-03 y C-003 de spec003 están cerrados (research §R7–R9) y no generan tareas.

---

## Fase 1 — US1 Enlaces en el artefacto (P1)

**Objetivo**: las puertas que recorren el artefacto rechazan los enlaces simbólicos. **Prueba independiente**: quickstart «US1».

- [ ] **T001** [P] [US1] [IMPL] Rechazar enlaces y entradas no regulares en el recorrido del artefacto (S-001 = F-101 de spec006; research §R4, D1) — `scripts/artifact-pages.mts` (`:26-29`), `scripts/artifact-pages.test.mts`, `scripts/check-assets.mts` (`assertNoGamePortraits`, escaneo `:162-165`), `scripts/check-assets.test.mts` — Aceptación: `prerenderedPages` lanza `«<gate>: el artefacto es inválido (…: <ruta>)»` ante una entrada bajo `browser/` que sea enlace simbólico (carpeta o archivo, *junction* incluido) o que no sea archivo ni directorio (FR-001); `assertNoGamePortraits` con `own` aplica el mismo criterio a su recorrido del artefacto completo mediante un helper exportado de `artifact-pages.mts`, sin otra copia del criterio (FR-002); con artefacto sin enlaces, salidas y mensajes idénticos en `game` y `own`; `scripts/check-public-build.mts` y `scripts/check-release.mts` no se tocan (FR-003). Pruebas rojas primero (FR-004): carpeta enlazada bajo `browser/` (*junction*), página `.html` enlazada (`symlinkSync(…, 'file')`, omitida con `t.skip(<motivo>)` solo ante `EPERM`) y carpeta `assets/portraits` enlazada con `own`. Evidencia: `node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts` (rojo y verde), `pnpm test:scripts`, `pnpm assets:check`, `pnpm check:boundaries`, `pnpm lint`. Depende de: nada.

**Checkpoint F1**: ningún recorrido del artefacto ignora un enlace en silencio.

---

## Fase 2 — US2 Regla de la combinación en la tarjeta (P2)

**Objetivo**: `buildCardData` impone la regla de B-002 para todo adaptador. **Prueba independiente**: quickstart «US2».

- [ ] **T002** [P] [US2] [UI] `srCombination` solo en tarjetas con enlace (B-002 = F-102 de spec006; research §R5, D3) — `apps/web/src/app/shared/ui/build-card/build-card.labels.ts` (`:67-72`), `apps/web/src/app/shared/ui/build-card/build-card.ts` (`:64-66`), `apps/web/src/app/shared/ui/build-card/build-card.model.ts` (docstring `:72-78`), `apps/web/src/app/shared/ui/build-card/build-card.spec.ts` — Aceptación: con `linked = !!(input.href || external?.url)`, `srCombination` solo se fija si `linked && combinationLang && combination`; `srText` no cambia; la línea `.build-card__combination` lleva `aria-hidden` salvo si hay `combinationLang` y no hay `srCombination`, de modo que una tarjeta sin enlace la expone con su `lang` (FR-005, data-model «Datos de la tarjeta»); docstring de `srCombination` dice que lo impone `buildCardData`; con entradas reales, `BuildCardData` idéntico (FR-007). Pruebas rojas primero (FR-006): sin enlace con `combinationLang` → `srCombination === null`, `srText` sin la combinación y, en el componente, la línea sin `aria-hidden` y con `lang`; externa con URL → `srCombination` fijado y línea oculta; externa con `url: null` → como sin enlace; tarjetas reales del catálogo y de la portada → mismo HTML que antes. **Medir** `/tier-list` antes y después (`pnpm build` raíz y `pnpm check:initial-js`): ≤ 112 000 B; si supera, detenerse y aplicar el plan B de research D3 (unión discriminada de `BuildCardInput`, 0 B) o escalar. Evidencia: `pnpm test` (web), `pnpm lint`, cifras de `/tier-list` antes/después, `pnpm e2e:a11y` 0 violaciones, regresión visual en Docker 30 passed sin regenerar y `git status e2e/visual-baselines` limpio (SC-005). Depende de: nada.

**Checkpoint F2**: ninguna tarjeta pierde la combinación para tecnologías de apoyo; presupuesto y capturas sin cambios.

---

## Fase 3 — US3 Unicidad de ids con varias guías (P3)

**Objetivo**: la comprobación de ids únicos de la portada deja de ser vacua. **Prueba independiente**: quickstart «US3».

- [ ] **T003** [P] [US3] [UI] Unicidad de ids de la portada con 3 guías y e2e no vacuo (S6-D3 = B-102 de spec006; research §R3, D4) — `apps/web/src/app/features/home/home.page.spec.ts`, `e2e/a11y.spec.ts` (`:622-628`) — Aceptación: caso nuevo que monta `HomePage` con `LOCALE_ID` `en` y 3 guías públicas sintéticas con contenido en español (datos como el bloque spec005 T010 de `home.page.spec.ts:191-240`), y comprueba ≥ 2 ids `build-card-combination-…` y todos distintos (FR-008, SC-003); control en la misma prueba que demuestra que el detector ve un duplicado (no vacuo); en `e2e/a11y.spec.ts` el bloque «@a11y T010» exige `ids.length > 0` antes de la unicidad y su mensaje remite al caso del componente (FR-009); `fixtures/content/` y `e2e/visual-baselines/` sin cambios (FR-010). Prueba roja primero (FR-015, prueba de cobertura sin defecto de producto que corregir): el rojo es el control, que con dos tarjetas de la misma clave hace fallar la aserción de unicidad (citar su salida); el caso con claves reales pasa desde el principio y se registra así. Evidencia: `pnpm test` (web), `pnpm typecheck:e2e`, `pnpm e2e:a11y --workers=2` (0 violaciones), `pnpm lint`, `git diff --stat` sin `fixtures/` ni `e2e/visual-baselines/`. Depende de: nada.

**Checkpoint F3**: la unicidad de ids se prueba con varias guías.

---

## Fase 4 — US4 Registro SDD y CI (P3)

**Objetivo**: los artefactos de spec006, `specs/README.md` y la CI dicen el estado real. **Prueba independiente**: quickstart «US4».

- [ ] **T004** [P] [US4] [IMPL] Comentario del trabajo `visual-regression` (T-177; research §R6, D2) — `.github/workflows/ci.yml` (`:485-489`), `scripts/ci-workflow.test.mts` (`:387`) — Aceptación: ningún comentario afirma que no haya PNG del juego versionados; el motivo del modo `own` es que las referencias se generan con `own` en el flujo manual `visual-baselines` y que `own` es el modo por defecto y la vía de retirada (constitución VII) (FR-013); ningún paso, `env` ni aserción cambia (`git diff` solo en líneas de comentario). Sin prueba roja: solo comentarios (FR-015 no aplica; declararlo). Evidencia: `grep -rn "no game PNG" .github scripts` sin resultados, `git diff -U0 .github/workflows/ci.yml scripts/ci-workflow.test.mts` solo con líneas `#`/`//`, `pnpm test:scripts` (mismo recuento que antes), `pnpm format:check`. Depende de: nada.
- [ ] **T005** [P] [US4] [DOCS] Diseño de spec006 y `specs/README.md` al día (S6-D1 = C-101/A-101 y S6-D2 = A-102/B-101 de spec006; research §R1, §R2, D5) — `specs/006-deuda-revisiones-2/data-model.md` (`:33`), `specs/006-deuda-revisiones-2/plan.md` (`:128`, `:153`), `specs/006-deuda-revisiones-2/research.md` (`:116`), `specs/README.md` (`:4`, `:13`, `:50-57`) — Aceptación: el paso de la siembra que trata un nodo ausente aún usado en una celda entrante describe el aparcado fuera de la rejilla (`grid_row + 1000000`) y la decisión por FK en la poda (T009, `apps/api/src/db/write-content.mts:463-474`), y el texto de 23505 queda marcado como histórico sustituido por T009 (FR-011); `specs/README.md`: fila de spec006 «Cerrada (puerta spec002 passed, `c626f26`)», «10 de 10», «0»; su sección resume T001–T010 y remite S-001, B-002, S6-D1, S6-D2 y S6-D3 a spec007; fecha de actualización (FR-012); ningún archivo de `specs/001-*` a `specs/005-*` cambia (FR-014). Evidencia: `grep -n "23505" specs/006-deuda-revisiones-2/{data-model,plan,research}.md` (cada línea marcada como histórico), `git diff --stat` solo con esos cuatro archivos, `pnpm lint:md` 0 issues, `pnpm check:scope` OK. Depende de: nada.

**Checkpoint F4**: registro y CI coherentes.

---

## Fase 5 — Cierre

- [ ] **T006** [IMPL] Verificación de integración y puerta de cierre de spec007 (spec002 + T-136) — `specs/007-deuda-revisiones-3/quickstart.md` (evidencia), `specs/007-deuda-revisiones-3/reviews/`, `specs/007-deuda-revisiones-3/tasks.md`, `specs/README.md` (fila de spec007) — Aceptación: se marca antes de ejecutar la puerta según el precedente (spec002 T014, spec003 T021, spec004 T036, spec005 T018, spec006 T008); primero la verificación de integración sobre el resultado de T001–T005: `pnpm verify` exit 0 (`ASSET_SOURCE=own`; si solo falla el TBT, repetir `pnpm check:performance` y citar cifras), `ASSET_SOURCE=game pnpm build`, `pnpm e2e:a11y` y `pnpm e2e:journeys` sobre el artefacto `own`, regresión visual en Docker 30 passed, `pnpm lint:md` y `pnpm check:scope` OK, con su tabla en `quickstart.md` («Evidencia de cierre (T006)»); después `node scripts/spec-review.mjs prepare --feature specs/007-deuda-revisiones-3` en `ready`, cuatro revisiones reales (code, architecture, security, best-practices) y T-136 con `speckit-review-complete`, resultado en `reviews/completion-review.json` y `node scripts/spec-review.mjs check` en `passed` (SC-006); `specs/README.md` con spec007 cerrada y su commit. Hallazgos de la puerta: decisión del principal/Paco y, si se aplazan, en `reviews/deuda.md`. Evidencia: tabla de `quickstart.md` y `reviews/completion-review.json` con la puerta `passed`. Depende de: T001–T005.

---

## Dependencias y orden

```text
IMPL: T001, T004 (disjuntas)  ─┐
UI:   T002, T003, T005        ─┴── T006 (IMPL, cierre)
```

- Ninguna tarea depende de otra salvo T006, que espera a las cinco.
- **UI** e **implementación** avanzan en paralelo, cada una en su worktree, sin archivos compartidos. Dentro de cada área todas son disjuntas (`[P]`).
- Única arista entre áreas: `specs/README.md` (T005 de UI antes que T006 de implementación).
- Los IDs siguen el orden del archivo, por historia; T004 es de implementación aunque esté en la fase de US4 y puede hacerla el mismo agente que T001.

### Ejemplos de paralelismo

- Implementación lanza T001 y T004 (o un agente las hace en serie).
- UI lanza T002, T003 y T005 en tres agentes, o T002 en uno y T003 + T005 en otro.

## Estrategia

1. **MVP**: T001 (la única deuda con efecto en una puerta de derechos).
2. Incremental: T002 (tarjeta), T003 (prueba de la portada), T004 y T005 (registro y CI), cada una verificable sola.
3. T006 verifica la integración y cierra con la puerta.

## Cobertura de requisitos

| Requisito | Tareas |
| --------- | ------ |
| FR-001 – FR-004 | T001 |
| FR-005 – FR-007 | T002 |
| FR-008 – FR-010 | T003 |
| FR-011, FR-012, FR-014 | T005 |
| FR-013 | T004 |
| FR-015 | T001, T002, T003 (prueba roja primero); T004 y T005 sin código ejecutable |
| FR-016 | T006 y numeración T001–T006 |
| FR-017 | todas (ninguna toca estilos, cadenas visibles ni alcance diferido) |
| SC-001 | T001 |
| SC-002 | T002 |
| SC-003 | T003 |
| SC-004 | T004, T005 |
| SC-005 | T002, T006 |
| SC-006 | T006 |
