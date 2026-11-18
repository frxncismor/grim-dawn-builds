# Implementation Plan: Deuda de spec007 (erratum DV1/DV2, registro y recorrido único del artefacto)

**Branch**: `008-deuda-spec007` (planificación en `orq/11111619-ui-s8-plan`) | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-deuda-spec007/spec.md`; evidencia y decisiones en [research.md](research.md); `.specify/memory/constitution.md` (1.11.1).

**Estado**: planificada. Clarify resuelto por el planificador sin Paco (instrucción del principal): ningún punto cambia esquema de BD, contrato público ni producto.

## Summary

Cerrar la deuda que dejó la puerta de spec007, sin cambiar el producto: (1) **erratum DV1/DV2** (B-101 = A-101) en un archivo propio de spec008 que remite a `plan.md:135-136` de spec007, sin editar spec007 fuera de `reviews/`, y cierre de las entradas de `specs/007-deuda-revisiones-3/reviews/deuda.md`; (2) **`specs/README.md`** con spec007 cerrada y fusionada, y la fila de spec008 al cerrar; (3) **S-003 = A-002**, una sola lectura validada del artefacto por llamada de cada puerta (`prerenderedPages` 2 → 1, `assertNoGamePortraits` 4 → 1), con mensajes y orden de comprobaciones idénticos. Cierra con la verificación de integración y la puerta de spec002 más T-136.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS; scripts `.mts` con `tsx`; Markdown (artefactos SDD).

**Primary Dependencies**: ninguna nueva (constitución VIII).

**Storage**: N/A (sin migración ni cambio de esquema).

**Testing**: `node --test` (`node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts scripts/check-legacy-brand.test.mts`, `pnpm test:scripts`); espía `mock.method(fs, 'readdirSync')` + `syncBuiltinESMExports()` (research §R6); `pnpm verify` en el cierre.

**Target Platform**: scripts de release y de CI sobre el artefacto estático prerrenderizado.

**Project Type**: monorepo pnpm. Huella: `scripts/artifact-pages.{mts,test.mts}`, `scripts/check-assets.{mts,test.mts}`, `specs/007-deuda-revisiones-3/reviews/deuda.md`, `specs/008-deuda-spec007/`, `specs/README.md`.

**Performance Goals**: las puertas leen el directorio del artefacto 1 vez por llamada (hoy 2 y 4; research §R3). Sin bytes de cliente: `/tier-list` sigue en 111 422 B de 112 000 B (evidencia de spec007 T006); ningún archivo de `apps/` cambia.

**Constraints**: mensajes, rutas y orden de comprobaciones de las puertas idénticos (FR-003); `check-public-build.mts`, `check-release.mts` y `compare-builds.mts` sin cambios (FR-005); `check:boundaries`; sin secretos; ningún artefacto de spec001 a spec006 ni de spec007 fuera de `reviews/` (FR-010).

**Scale/Scope**: 4 tareas (T001–T004): 1 de docs, 2 de código (2 módulos y sus pruebas) y el cierre.

## Constitution Check

_GATE: previo a Fase 0, re-comprobado tras el diseño._

| Principio                            | Relevancia | Cómo lo cumple                                                                                                                                                  |
| ------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Contenido verificable y atribuido | Baja       | Sin cambios de contenido; las puertas de crédito a Crate conservan su comportamiento (FR-003).                                                                  |
| III. SEO/SSG                         | Baja       | Ningún cambio en el HTML ni en el build.                                                                                                                        |
| IV. Rendimiento                      | Baja       | Menos lecturas de disco en las puertas; 0 B de cliente.                                                                                                         |
| V. Accesibilidad                     | N/A        | Sin UI.                                                                                                                                                         |
| VI. Una sola fuente                  | Alta       | El criterio «entrada válida del artefacto» y su única lectura viven en `scripts/artifact-pages.mts`; ninguna puerta de páginas lee el directorio por su cuenta. |
| VII. Legalidad y activos             | Alta       | La puerta «sin arte del juego con `own`» examina exactamente lo que validó; con artefacto válido o no, mismo resultado (FR-003).                                |
| VIII. Simplicidad                    | Alta       | Sin dependencias ni módulos nuevos; se elimina una lectura duplicada.                                                                                           |
| IX. Pruebas proporcionales           | Alta       | Rojo con el espía de lecturas; caracterización de mensajes exactos antes del cambio.                                                                            |
| X. EN/ES                             | N/A        | Sin cadenas de interfaz; los mensajes de las puertas no cambian.                                                                                                |
| XII. Secretos                        | Baja       | El escaneo de secretos del build público no se toca (FR-005).                                                                                                   |

Resultado: **sin violaciones**. Re-comprobado tras el diseño: el único riesgo es de regresión de mensajes, cubierto por la caracterización (T002, T003).

## Project Structure

### Documentation (this feature)

```text
specs/008-deuda-spec007/
├── spec.md
├── plan.md              # este archivo
├── research.md          # evidencia R1–R6 y decisiones R8-D1–R8-D3
├── data-model.md        # entrada del artefacto y lectura única (sin esquema)
├── quickstart.md        # cómo validar cada historia
├── erratum.md           # T001 (DV1/DV2 de spec007)
├── checklists/
│   └── requirements.md
├── reviews/             # analyze ahora; resultado de la puerta al cerrar
└── tasks.md
```

Sin `contracts/`: no cambia ninguna interfaz pública (API, rutas, CLI); las funciones de `scripts/artifact-pages.mts` son internas de `scripts/`.

### Source Code (huella prevista)

```text
scripts/
├── artifact-pages.mts (+.test.mts)            # T002 (lectura única, prerenderedPages)
└── check-assets.mts (+.test.mts)              # T003 (assertNoGamePortraits sobre la lectura única)
specs/007-deuda-revisiones-3/reviews/deuda.md  # T001 (ronda 2), T004 (S-003); fuera del snapshot
specs/008-deuda-spec007/erratum.md             # T001
specs/README.md                                # T001 (spec007), T004 (spec008)
specs/008-deuda-spec007/{tasks,quickstart}.md, reviews/   # T004
```

**Structure Decision**: sin carpetas ni módulos nuevos. `scripts/check-legacy-brand.mts` no cambia (consume `prerenderedPages`); su prueba solo se ejecuta como regresión.

## Reparto entre áreas (obligatorio)

Regla: `scripts/` → **implementación**; solo docs SDD → **UI**.

| Tarea | Elemento                                        | Área                                | Archivos principales                                                                                                                                    | Depende de | `[P]`             |
| ----- | ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------- |
| T001  | Erratum DV1/DV2 + registro de spec007           | **UI** (solo docs SDD)              | `specs/008-deuda-spec007/erratum.md`, `specs/007-deuda-revisiones-3/reviews/deuda.md`, `specs/README.md`                                                | —          | `[P]` con T002    |
| T002  | S-003: lectura única en `prerenderedPages`      | implementación                      | `scripts/artifact-pages.mts`, `scripts/artifact-pages.test.mts`                                                                                         | —          | `[P]` con T001    |
| T003  | S-003: `assertNoGamePortraits` sobre la lectura | implementación                      | `scripts/check-assets.mts`, `scripts/check-assets.test.mts`                                                                                             | T002       | no (mismo agente) |
| T004  | cierre                                          | implementación (coordina la puerta) | `specs/008-deuda-spec007/{tasks,quickstart}.md`, `specs/008-deuda-spec007/reviews/`, `specs/README.md` (fila de spec008), `deuda.md` de spec007 (S-003) | T001–T003  | no                |

Notas de integración:

- El erratum, las entradas 1–2 de la ronda 2 de `deuda.md` y `specs/README.md` van **agrupados en T001** (pequeños, de UI y con líneas contiguas en `tasks.md`): separarlos haría chocar las marcas al integrar.
- T002 y T003 son del mismo área y en serie (T003 usa la lectura única de T002): un solo agente de implementación las hace en orden, con un commit de integración por tarea.
- Aristas entre áreas: `specs/README.md` y `deuda.md` de spec007 (T001 de UI antes que T004 de implementación). La entrada S-003 y la 3 de la ronda 2 las cierra T004, no T001: no se marca cerrado lo que aún no está integrado.
- `tasks.md` lo marcan dos áreas: UI marca T001 e implementación T002–T004; son líneas distintas, no contiguas entre áreas (T001 va en su fase, T002–T003 en la suya).

### Orden

1. En paralelo, cada área en su worktree:
   - UI: T001.
   - Implementación: T002 y después T003.
2. **T004**: verificación de integración (`pnpm verify` y las suites de la puerta) y puerta de cierre de spec002 + T-136 sobre spec008.

## Diseño por tarea (resumen; detalle en research R8-D1–R8-D3)

- **T001 (R8-D1, R8-D2)**: `erratum.md` con texto erróneo, correcto, fuente vigente y motivo; `deuda.md` de spec007: entradas 1–2 de la ronda 2 (`:15-19`) a «Cerrada por spec008 T001»; `specs/README.md` fila y sección de spec007 cerradas (`95f18de`, `1375dda`, PR #13), deuda remitida a spec008, fecha.
- **T002 (R8-D3)**: lectura única en `artifact-pages.mts` que devuelve las entradas y las no regulares; `prerenderedPages` la consume (1 `readdirSync`); mensaje de no regular construido en un solo sitio. Pruebas: espía de lecturas (rojo: hoy 2), caracterización de mensajes exactos (verde antes y después), las 7 existentes sin tocar su aserción.
- **T003 (R8-D3)**: `assertNoGamePortraits` con `own` hace una lectura del artefacto y deriva, en el orden de research §R3, no regulares bajo `browser/` (mensaje con `browser/<rel>`), páginas (mismo mensaje), no regulares fuera de `browser/` (mensaje con `<basename(artifact)>/<rel>`) y la búsqueda de arte del juego. Sin `assertRegularEntries` ni `readdirSync` propia en `check-assets.mts` para el artefacto. Pruebas: espía (rojo: hoy 4), con `game` 0 lecturas, caracterización de mensajes exactos y de la precedencia «vacío antes que enlace fuera de `browser/`».
- **T004**: como T006 de spec007: marcar antes de ejecutar según el precedente; `pnpm verify` y suites de la puerta sobre el resultado integrado; `node scripts/spec-review.mjs prepare|check --feature specs/008-deuda-spec007`; cuatro revisiones y T-136 con `speckit-review-complete`; fila de spec008 cerrada en `specs/README.md`; entrada S-003 (`:5-9`) y entrada 3 de la ronda 2 (`:20`) de `deuda.md` de spec007 a «Cerrada por spec008 T002–T003».

## Decisiones aplicadas (sin Paco)

| Punto                                | Decisión (planificador, 2026-11-18)                    | Tareas     | Efecto                                      |
| ------------------------------------ | ------------------------------------------------------ | ---------- | ------------------------------------------- |
| Dónde vive el erratum                | `specs/008-deuda-spec007/erratum.md`                   | T001       | spec007 intacta fuera de `reviews/`         |
| Alcance de «una lectura»             | por llamada de cada puerta (research §R4 a)            | T002, T003 | Sin cambio de firma de las puertas          |
| Lecturas del artefacto que no entran | escaneo de secretos, huella, comparador (research §R5) | —          | Ya validan en su única lectura (FR-005)     |
| Rojo de un refactor                  | espía de `readdirSync` + caracterización (§R6)         | T002, T003 | Rojo verificable sin cambiar comportamiento |

## Desviaciones respecto al encargo

Ninguna. Las decisiones de la tabla anterior interpretan el encargo dentro de su alcance; la de «lecturas que no entran» se comunica al principal en el reporte por si quiere ampliarlo (no exige decisión de Paco).

## Riesgos

| Riesgo                                                            | Prob. | Impacto | Mitigación                                                                                                                  |
| ----------------------------------------------------------------- | ----- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| T003 cambia la ruta o el orden de un mensaje                      | Media | Medio   | Caracterización de mensajes exactos y de la precedencia escrita antes del cambio (FR-004).                                  |
| El espía no intercepta la importación con nombre                  | Baja  | Bajo    | Comprobado en lectura (research §R3, §R6); `syncBuiltinESMExports()` tras `mock.method` y al restaurar.                     |
| El espía queda activo y contamina otras pruebas del mismo archivo | Baja  | Medio   | Restaurar en `finally`/`t.after` y re-sincronizar; `pnpm test:scripts` completo en T002, T003 y T004.                       |
| T002 deja `check-assets.mts` roto entre T002 y T003               | Baja  | Bajo    | T002 conserva `assertRegularEntries` (envoltorio de la lectura única) hasta T003; `pnpm test:scripts` verde al cerrar T002. |
| T001/T002/T003 desfasan el snapshot de la puerta de spec007       | Alta  | Bajo    | Esperado (spec Assumptions); la puerta cerrada no se reabre.                                                                |
| Docker no disponible en local para la regresión visual del cierre | Media | Bajo    | Sin cambios de `apps/`; T004 lo declara y cita la evidencia vigente; no se marca sin la salida real del resto.              |

## Complexity Tracking

Sin desviaciones de la constitución que justificar.
