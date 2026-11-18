# Implementation Plan: Deuda LOW de spec006 y de la CI (tercera tanda)

**Branch**: `007-deuda-revisiones-3` (planificación en `orq/11111619-ui-s7-plan`) | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-deuda-revisiones-3/spec.md`; evidencia y decisiones en [research.md](research.md); `.specify/memory/constitution.md` (1.11.1).

**Estado**: planificada. Clarify resuelto por el planificador sin Paco (instrucción del principal): ningún punto cambia esquema de BD ni contrato público.

## Summary

Cerrar la deuda LOW que dejaron abierta la puerta de spec006 y T-177, sin cambiar el producto: (1) **S-001**, las puertas que recorren el artefacto rechazan los enlaces simbólicos en lugar de ignorarlos; (2) el **comentario de `visual-regression`** en la CI deja de afirmar que no hay PNG del juego versionados; (3) **B-002**, `buildCardData` impone que solo una tarjeta con enlace describa el enlace con la combinación en el idioma del contenido; (4) **S6-D3**, la unicidad de ids de la portada se prueba con 3 guías en una prueba de componente y el e2e deja de ser vacuo; (5) **S6-D1 y S6-D2**, diseño de spec006 y `specs/README.md` al día. A-01, A-03 y C-003 de spec003 ya están cerrados (research §R7–R9). Cierra con la verificación de integración y la puerta de spec002 más T-136.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS (22.23.5); Angular 21 (SSG); scripts `.mts` con `tsx`; YAML de GitHub Actions.

**Primary Dependencies**: ninguna nueva (constitución VIII).

**Storage**: PostgreSQL 17; **sin migración** ni cambio de esquema (solo se corrige la documentación de la siembra de spec006).

**Testing**: `node --test` (`pnpm test:scripts`), Vitest de `apps/web` (`pnpm test`), Playwright + axe (`pnpm e2e:a11y`), `pnpm typecheck:e2e`, `check:initial-js`, regresión visual en Docker (modo `check` del procedimiento vigente de `CONTRIBUTING.md`).

**Target Platform**: artefacto estático prerrenderizado; CI de GitHub Actions (solo comentarios).

**Project Type**: monorepo pnpm. Huella: `scripts/`, `.github/workflows/ci.yml`, `apps/web/src/app/{shared/ui/build-card,features/home}`, `e2e/a11y.spec.ts`, `specs/006-*`, `specs/007-*`, `specs/README.md`.

**Performance Goals**: `/tier-list` ≤ 112 000 B de JS inicial; base **111 395 B** (margen 605 B; evidencia de spec006 T008/T010). Solo T002 puede sumar bytes al cliente; se mide antes y después.

**Constraints**: CSP sin `unsafe-inline`; paridad EN/ES; WCAG 2.2 AA; lectura sin JS; sin secretos; `check:boundaries`; las 30 referencias visuales no se regeneran (ningún cambio visible); ningún paso ni variable de la CI cambia.

**Scale/Scope**: 6 tareas (T001–T006), de ellas 3 de implementación; ~8 archivos de código y pruebas, ~5 de documentación.

## Constitution Check

_GATE: previo a Fase 0, re-comprobado tras el diseño._

| Principio | Relevancia | Cómo lo cumple |
| --------- | ---------- | -------------- |
| I. Contenido verificable y atribuido | Media | T003 no añade guías al contenido público (FR-010); T001 endurece las puertas que vigilan el crédito a Crate. |
| III. SEO/SSG | Baja | Ningún cambio en HTML de páginas reales (T002 solo cambia un caso que ninguna entrada produce). |
| IV. Rendimiento | Alta | T002 mide `/tier-list` antes y después; si supera 112 000 B, plan B sin bytes (research D3). |
| V. Accesibilidad | Alta | T002 garantiza la combinación para AT en toda tarjeta; T003 hace no vacua la prueba de ids; `e2e:a11y` 0 violaciones. |
| VI. Una sola fuente | Media | T001 reutiliza el criterio único de `scripts/artifact-pages.mts`; la regla de B-002 vive en un solo punto (`buildCardData`), no en el dominio (research §R5 a). |
| VII. Legalidad y activos | Alta | T001: la puerta «sin arte del juego con `own`» deja de esquivarse con una carpeta enlazada; T004 explica bien por qué la regresión visual usa `own`. |
| VIII. Simplicidad | Alta | Sin dependencias ni paquetes; un helper pequeño en un módulo existente. |
| IX. Pruebas proporcionales | Alta | Cada tarea de código empieza en rojo; T003 incluye un control que demuestra que el detector de duplicados no es vacuo. |
| X. EN/ES | Media | T003 prueba en EN con contenido ES; ninguna cadena nueva. |
| XII. Secretos | Baja | Sin cambios; T004 no toca variables ni secretos de la CI. |

Resultado: **sin violaciones**. Re-comprobado tras el diseño: el único riesgo de presupuesto es T002.

## Project Structure

### Documentation (this feature)

```text
specs/007-deuda-revisiones-3/
├── spec.md
├── plan.md              # este archivo
├── research.md          # evidencia R1–R9 y decisiones D1–D5
├── data-model.md        # entidades tocadas (sin esquema nuevo)
├── quickstart.md        # cómo validar cada historia
├── checklists/
│   └── requirements.md
├── reviews/             # analyze ahora; resultado de la puerta al cerrar
└── tasks.md
```

Sin `contracts/`: no cambia ninguna interfaz pública (API, rutas, CLI); el helper de T001 es interno de `scripts/`.

### Source Code (huella prevista)

```text
scripts/
├── artifact-pages.mts (+.test.mts)            # T001 (rechazo de enlaces, D1)
├── check-assets.mts (+.test.mts)              # T001 (escaneo de assertNoGamePortraits)
└── ci-workflow.test.mts                       # T004 (solo comentario)
.github/workflows/ci.yml                       # T004 (solo comentario)
apps/web/src/app/shared/ui/build-card/build-card.{ts,labels.ts,model.ts,spec.ts}   # T002
apps/web/src/app/features/home/home.page.spec.ts                                # T003
e2e/a11y.spec.ts                                                                # T003
specs/006-deuda-revisiones-2/{data-model,plan,research}.md                       # T005
specs/README.md                                                                 # T005, T006
specs/007-deuda-revisiones-3/{tasks.md,quickstart.md,reviews/}                   # T006
```

**Structure Decision**: sin carpetas ni módulos nuevos.

## Reparto entre áreas (obligatorio)

Regla: `apps/web` y `e2e/` → **UI**; `apps/api`, `packages/*`, `scripts/`, CI → **implementación**; solo docs SDD → **UI**.

| Tarea | Elemento | Área | Archivos principales | Depende de | `[P]` |
| ----- | -------- | ---- | -------------------- | ---------- | ----- |
| T001 | S-001 | implementación | `scripts/artifact-pages.mts` (+test), `scripts/check-assets.mts` (+test) | — | `[P]` con T002–T005 |
| T002 | B-002 | **UI** | `build-card.{ts,labels.ts,model.ts,spec.ts}` | — | `[P]` con T001, T003–T005 |
| T003 | S6-D3 | **UI** | `features/home/home.page.spec.ts`, `e2e/a11y.spec.ts` | — | `[P]` con T001, T002, T004, T005 |
| T004 | comentario de CI (T-177) | implementación | `.github/workflows/ci.yml`, `scripts/ci-workflow.test.mts` | — | `[P]` con T001–T003, T005 |
| T005 | S6-D1, S6-D2 | **UI** (solo docs SDD) | `specs/006-deuda-revisiones-2/{data-model,plan,research}.md`, `specs/README.md` | — | `[P]` con T001–T004 |
| T006 | cierre | implementación (coordina la puerta) | `specs/007-deuda-revisiones-3/{tasks,quickstart}.md`, `specs/007-deuda-revisiones-3/reviews/`, `specs/README.md` | T001–T005 | no |

Ninguna tarea cruza áreas ni comparte archivos con otra salvo `specs/README.md` (T005 de UI antes que T006 de implementación). T001 y T004 son del mismo área pero disjuntas (T004 no toca `test:scripts` de `package.json`; ninguna lo toca). T002 y T003 son del mismo área y disjuntas (T003 no toca `build-card.*`). Tres tareas de implementación, muy por debajo del límite de ~8; no hace falta agrupar más.

### Orden

1. En paralelo, cada área en su worktree:
   - Implementación: T001 y T004 (disjuntas; un agente puede hacerlas en serie).
   - UI: T002, T003 y T005 (disjuntas).
2. **T006**: verificación de integración (`pnpm verify` y las suites de la puerta) y puerta de cierre de spec002 + T-136 sobre spec007.

## Diseño por tarea (resumen; detalle en research D1–D5)

- **T001 (D1)**: `prerenderedPages` rechaza toda entrada bajo `browser/` que sea enlace simbólico o no sea archivo ni directorio, con `«<gate>: el artefacto es inválido (…: <ruta>)»`; `assertNoGamePortraits` aplica el mismo criterio a su recorrido del artefacto completo (helper compartido exportado de `artifact-pages.mts`). Mensajes con artefacto válido sin cambios (FR-003). Pruebas rojas con _junction_ y con enlace de archivo (omitida con motivo si `EPERM`).
- **T002 (D3)**: en `buildCardData`, `linked = !!(input.href || external?.url)`; `srCombination` solo si `linked`; en `build-card.ts` la línea `.build-card__combination` lleva `aria-hidden` salvo si hay `combinationLang` y no hay `srCombination` (tarjeta sin enlace: se expone con su `lang`). `srText` no cambia. Docstring de `srCombination` al día. Pruebas: sin enlace, externa con URL y externa sin URL, en el modelo y en el componente. Medir `/tier-list`; si supera 112 000 B, detenerse y aplicar el plan B (unión discriminada del tipo, 0 B) o escalar.
- **T003 (D4)**: caso nuevo en `home.page.spec.ts` con 3 guías públicas sintéticas y página `en`: ≥ 2 ids `build-card-combination-…`, todos distintos, más un control que demuestra que el detector ve un duplicado; `e2e/a11y.spec.ts:622-628` exige ≥ 1 id y remite al caso del componente.
- **T004 (D2)**: dos comentarios reescritos (`ci.yml:485-489`, `ci-workflow.test.mts:387`); `pnpm test:scripts` sigue igual (la prueba del flujo no lee comentarios).
- **T005 (D5)**: spec006 `data-model.md:33`, `plan.md:128,153`, `research.md:116` al mecanismo de T009 conservando el histórico; `specs/README.md`: spec006 cerrada (10 de 10, `c626f26`), sección con los aplazados remitidos a spec007, fecha.
- **T006**: como spec006 T008: marcar antes de ejecutar según el precedente; `pnpm verify` y suites de la puerta sobre el resultado integrado; `node scripts/spec-review.mjs prepare|check --feature specs/007-deuda-revisiones-3`; cuatro revisiones y T-136 con `speckit-review-complete`; fila de spec007 cerrada en `specs/README.md`.

## Decisiones aplicadas (sin Paco)

| Punto | Decisión (planificador, 2026-11-18) | Tareas | Efecto |
| ----- | ----------------------------------- | ------ | ------ |
| Dónde vive la regla de B-002 | `buildCardData` (no el dominio) | T002 | Unas decenas de bytes medidos; plan B sin bytes |
| Datos de 2+ guías para S6-D3 | prueba de componente con 3 guías sintéticas | T003 | Sin cambios en contenido público ni referencias |
| Enlace simbólico en el artefacto | artefacto inválido, nunca se sigue | T001 | Falla cerrado |
| A-01, A-03, C-003 | cerrados, solo registro | — | Sin tareas (research §R7–R9) |

## Desviaciones aprobadas respecto al encargo

Aprobadas por el principal el 2026-11-18 («D1 ok, D2 ok»); numeración de `reviews/analyze.md`.

| ID | Encargo original | Decisión | Motivo | Aprobación | Tarea |
| -- | ---------------- | -------- | ------ | ---------- | ----- |
| D1 | S6-D3: que `e2e/a11y.spec.ts` use 2+ guías (fixture o artefacto de borradores). | Caso de componente de `HomePage` con 3 guías sintéticas (`home.page.spec.ts`); el e2e exige ≥ 1 id en lugar de 2+ guías. | El artefacto de borradores no lista guías (la portada solo muestra las publicadas); una guía pública más cambia el sitio y obliga a regenerar las 30 capturas, y un tercer artefacto e2e añade un build y un puerto (research §R3). | Principal, 2026-11-18 | T003 |
| D2 | B-002: imponer la regla «al dominio o al esquema». | Se impone en `buildCardData` de `apps/web`, no en `packages/domain` ni en el esquema; plan B: unión discriminada de `BuildCardInput` (0 B). | `BuildCardData` es una vista de presentación («not a domain entity»): el dominio no conoce tarjetas, enlaces ni el idioma de la página (research §R5, constitución VI). `buildCardData` es el punto único de todos los adaptadores. | Principal, 2026-11-18 | T002 |

## Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
| ------ | ----- | ------- | ---------- |
| T001 rechaza un artefacto legítimo (Angular emite algún enlace) | Baja | Alto | `assertPublicBuild` ya rechaza enlaces en el release y pasa hoy; `pnpm verify` y `build:release` en T006. |
| T001 no puede crear enlaces de archivo en Windows | Media | Bajo | _Junction_ para carpetas; enlace de archivo con `t.skip(motivo)` ante `EPERM`; el CI Linux lo ejecuta. |
| T002 agota el margen de `/tier-list` (605 B) | Baja | Alto | Medir antes/después con `pnpm build` raíz y `check:initial-js`; si supera, plan B (tipo) o escalar. |
| T002 cambia el texto accesible de una tarjeta real | Baja | Medio | Ninguna entrada real tiene `combinationLang` sin enlace (`card-data.ts:64-73`); `e2e:a11y` y regresión visual sin cambios. |
| T003 da un falso verde (prueba vacua otra vez) | Baja | Medio | Control explícito que ve un duplicado y aserción `≥ 2` ids. |
| T005 desfasa el snapshot de la puerta de spec006 | Alta | Bajo | Esperado (spec006 Edge Cases); no se reabre la puerta. |
| Docker no disponible en local para la regresión visual | Media | Medio | La tarea lo declara antes de marcarse; no se marca `[x]` sin la salida real. |

## Complexity Tracking

Sin desviaciones de la constitución que justificar.
