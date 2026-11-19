# Implementation Plan: Rediseño de la UI, base visual y página de build (serie 009–013)

**Branch**: `009-rediseno-completo-ui` (planificación en `orq/11111619-ui-s9-plan`) | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-rediseno-completo-ui/spec.md`; evidencia y decisiones en [research.md](research.md); contrato en [data-model.md](data-model.md); `.specify/memory/constitution.md` (1.11.1, que T002 enmienda a 1.12.0).

**Estado**: planificada. Clarify cerrado con Paco (Preguntas 37–45, 2026-11-18). Primera spec de la serie 009–013, que sale en **un solo PR**; los presupuestos de rendimiento son **informativos** en 009 (P43) y la CI verde es responsabilidad de 013.

## Summary

Dar al sitio la base visual nueva (paleta negra, tokens, `DESIGN.md`, tooltip común, portada de maestría con arte del juego) y rehacer la página de build con la estructura de la referencia: cabecera con portada, breadcrumb, chips, fecha, changelog y autor; intro; índice siempre visible; checklist arriba; bloque «Build final» (skills de barra, devociones clave, pros/contras); loot filter compacto antes de las notas y notas al final en letra menor; nombres de juego en el idioma de la página. Antes de todo, reproducir y corregir «no veo el árbol ni el mapa» (T001). La base visual pasa un **punto de aprobación visual** de Paco (2–3 propuestas en capturas reales, T003–T004) antes de aplicarse a ninguna página (FR-033). La enmienda 1.12.0 de §VII (P44 = A) y el registro de T-043/T-148 son tareas propias. Árbol interactivo, devociones, objetos, catálogo y optimización quedan para 010–013 (`spec.md` §6).

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node 22 LTS; Angular 21 (SSG, `@defer`, i18n con `$localize`); scripts `.mts` con `tsx`; SQL de Drizzle.

**Primary Dependencies**: ninguna nueva (constitución IV y VIII). El tooltip, el índice móvil y la portada se hacen con Angular y CSS propios.

**Storage**: PostgreSQL 17; **migración nueva** `0015` (siete columnas de `builds` y la vista `v_public_build_documents`), ver `data-model.md`.

**Testing**: Vitest (`pnpm test`, dominio y web), `node --test` (`pnpm test:scripts`), pruebas de API con Postgres real (`pnpm test:api-adapter` y las de `apps/api`), Playwright + axe (`pnpm e2e:a11y`, `pnpm e2e:journeys`), regresión visual en Docker, `check:contrast`, `check:locale-parity`, `content:validate`.

**Target Platform**: artefacto estático prerrenderizado (EN en `/`, ES en `/es`) y servidor de desarrollo (`pnpm start`).

**Project Type**: monorepo pnpm (`apps/web`, `apps/api`, `packages/domain`, `scripts/`, `fixtures/`).

**Performance Goals**: informativos en 009 (P43): se miden antes (T001) y después (T019) y se registran: HTML de la guía (hoy ≈ 117,3–117,7 kB de 120 000 B), JS inicial de la guía (≈ 123 kB de 150 000 B), `/tier-list` (111 422 de 112 000 B), CSS gzip (3 434 / 6 164 de 20 000 B), LCP/CLS/TBT. Objetivo de diseño, no puerta: portada WebP ≤ 40 kB con dimensiones reservadas (CLS), interactividad nueva en código diferido.

**Constraints**: CSP sin `unsafe-inline` (posicionamiento por CSSOM); paridad EN/ES en catálogos; WCAG 2.2 AA y puertas de accesibilidad en verde (no son informativas); lectura sin JS (§III); `ASSET_SOURCE=own|game` con fallback; sin copiar a Maxroll (`scripts/no-maxroll`); sin secretos.

**Scale/Scope**: 21 tareas (T001–T021): 1 de reproducción y corrección, 2 de propuesta y aprobación visual, 7 fundacionales (enmienda, datos, portadas, contraste, tokens, tooltip), 9 de página y verificación, 2 de registro y cierre.

## Constitution Check

_GATE: previo a la Fase 0, re-comprobado tras el diseño._

| Principio                           | Relevancia | Cómo lo cumple                                                                                                                                                   |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Contenido verificable            | Alta       | Bloques sin datos no se muestran (nunca marcadores como contenido); el estado de contenido sigue visible en la cabecera; datos nuevos de la guía de ejemplo `own_original`. |
| II. Sin scraping                    | Alta       | La portada se incorpora a mano desde la copia local legal (T007); ninguna descarga de webs.                                                                      |
| III. SEO/SSG                        | Alta       | Cabecera, breadcrumb, intro, build final y textos de tooltip en el HTML prerenderizado; JSON-LD de breadcrumb coherente con el visible.                          |
| IV. Rendimiento                     | Media      | Medido y registrado (informativo por P43, decisión de Paco); sin dependencias nuevas; la CI verde se garantiza en 013.                                           |
| V. Accesibilidad                    | Alta       | Tooltip WCAG 1.4.13 y teclado; índice con `aria-current`; contraste AA calculado (`spec.md` §4) y `check:contrast`; `e2e:a11y` 0 violaciones.                  |
| VI. Una sola fuente                 | Alta       | Campos nuevos en dominio y PostgreSQL con migración; test de paridad; los derivados (fecha, rol, autor) no se duplican.                                         |
| VII. Legalidad y activos            | Alta       | **Enmienda 1.12.0 antes de publicar la portada** (T002 bloquea T007); manifiesto por imagen con `proof_ref` a `research.md#r8`, fallback y retirada.            |
| VIII. Simplicidad                   | Alta       | Tokens con los nombres actuales (D3); un componente de tooltip; composición en una tarea (D8); propuestas visuales sin integrar (solo capturas).                                                                  |
| IX. Pruebas proporcionales          | Alta       | Pruebas rojas primero en dominio, API, componentes y en la regresión de T001.                                                                                   |
| X. EN/ES                            | Alta       | Cadenas nuevas en los dos catálogos; nombres de juego según la página (T017) con prueba automática (T018).                                                       |
| XI/XII. Backend y secretos          | Media      | Migración versionada; ningún secreto; el build público sigue leyendo de la API.                                                                                  |

Resultado: **sin violaciones**, condicionado a T002 (enmienda) antes de T007. Re-comprobado tras el diseño: los presupuestos se miden sin bloquear por decisión expresa de Paco (P43); no es una excepción de la constitución porque la CI verde se exige al cerrar la serie (013).

## Project Structure

### Documentation (this feature)

```text
specs/009-rediseno-completo-ui/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R1–R8 y D1–D10 (R8 = análisis de riesgos de la enmienda)
├── data-model.md        # campos editoriales nuevos y portada
├── quickstart.md        # validación por historia
├── checklists/
│   └── requirements.md
├── reviews/             # analyze ahora; puerta al cerrar
└── tasks.md
```

Sin `contracts/`: la API pública solo añade campos al DTO de guía, descritos en `data-model.md`.

### Source Code (huella prevista)

```text
apps/web/angular.json, apps/web/tools/*, .gitignore, e2e/ o scripts/ (regresión)            # T001
.specify/memory/constitution.md                                                              # T002
fuera del repo: runs/11111619/propuestas-009/ (capturas y nota de cada propuesta)            # T003
specs/009-rediseno-completo-ui/spec.md (Clarifications: propuesta elegida)                   # T004
packages/domain/src/schema.ts (+spec), fixtures/content/builds/*.json, apps/web/src/app/core/content/parity.test.mts   # T005
apps/api/drizzle/0015_*.sql, apps/api/src/db/{schema,write-content}.*, apps/api/src/content/map-content.* (+tests)   # T006
fixtures/content/assets/manifest.json, apps/web/public/assets/banners/*.webp, scripts/check-assets.mts (+test)   # T007
scripts/check-contrast.mts (+test)                                                           # T008
apps/web/src/styles/{tokens,fonts,base,accessibility}.css, apps/web/DESIGN.md                # T009
apps/web/src/app/shared/ui/tooltip/*, apps/web/src/app/shared/svg/skill-tree/place-tooltip.ts   # T010
apps/web/tools/emit-banners.mts (+test), apps/web/tools/emit-static-assets.mts, apps/web/angular.json, apps/web/src/app/features/build/header/*   # T011
apps/web/src/app/features/build/toc/*                                                        # T012
apps/web/src/app/features/build/checklist/*                                                  # T013
apps/web/src/app/features/build/final-build/*                                                # T014
apps/web/src/app/features/build/loot-filter/*                                                # T015
apps/web/src/app/features/build/{build.page.*,sections/*,summary/*}                          # T016
apps/web/src/app/shared/i18n/game-name.ts, features/build/{purchase-stepper,devotion-section}/*, shared/svg/devotion-map/*   # T017
apps/web/src/locale/messages.{en,es}.xlf                                                     # toda tarea UI con cadenas nuevas
e2e/{journeys,a11y}.spec.ts                                                                  # T018
e2e/visual-baselines/*, fuera del repo: runs/11111619/capturas-s9-{antes,despues}/          # T019 (antes: T001)
specs/001-mvp-guias-builds/tasks.md, specs/backlog-dx.md                                     # T020
specs/009-*/{tasks,quickstart}.md, specs/009-*/reviews/, specs/README.md                     # T021
```

**Structure Decision**: componentes nuevos dentro de `features/build/` y `shared/ui/tooltip/`; sin paquetes nuevos. Las propuestas visuales de T003 son prototipos en el worktree de su agente, **no se integran**: solo salen sus capturas.

## Reparto entre áreas (obligatorio)

Regla (research D10): `apps/web`, `apps/web/tools` y `e2e/` → **UI** (`sdd-ui`, con el skill `impeccable` desde `C:\Users\paco_\Documents\GitHub\grim-dawn-builds\.agents\skills\impeccable`, ruta absoluta porque está ignorado por git); `packages/*`, `apps/api`, `scripts/`, `fixtures/` → **implementación**; constitución y artefactos SDD → **DOCS**. El checkpoint T004 lo lleva el orquestador de UI con Paco.

| Tarea | Elemento                                         | Área       | Depende de                    | `[P]`                                 |
| ----- | ------------------------------------------------ | ---------- | ----------------------------- | ------------------------------------- |
| T001  | Reproducir y corregir árbol/mapa + «antes»       | UI         | —                             | con T002, T005, T006, T020            |
| T002  | Enmienda 1.12.0                                  | DOCS       | —                             | con T001, T003, T005, T006, T020      |
| T003  | 2–3 propuestas visuales (capturas reales)        | UI         | —                             | con T002, T005, T006, T020            |
| T004  | **Aprobación visual de Paco** (checkpoint)       | UI (orq.)  | T003                          | no                                    |
| T005  | Dominio + fixtures                               | IMPL       | —                             | con T001–T004, T020                   |
| T006  | BD y API                                         | IMPL       | T005                          | con T001–T004, T020                   |
| T007  | Portadas en el manifiesto                        | IMPL       | T002, **T004**                | con T009, T010                        |
| T008  | Contraste de los tokens nuevos                   | IMPL       | **T004**; integrar tras T009  | con T010                              |
| T009  | Paleta, tipografía, tokens y `DESIGN.md`         | UI         | **T004**, T001                | con T007                              |
| T010  | Tooltip común                                    | UI         | T009                          | con T007, T008                        |
| T011  | Emisión de portadas, cabecera e intro            | UI         | **T004**, T005, T007, T010    | no (cadenas, `angular.json`)          |
| T012  | Índice siempre visible                           | UI         | **T004**, T009                | no (cadenas)                          |
| T013  | Checklist arriba                                 | UI         | **T004**, T010                | no (cadenas)                          |
| T014  | Build final                                      | UI         | **T004**, T005, T010          | no (cadenas)                          |
| T015  | Loot filter compacto                             | UI         | **T004**, T010                | no (cadenas)                          |
| T016  | Composición de la página (orden, notas)          | UI         | T011–T015                     | no                                    |
| T017  | Nombres según la página                          | UI         | T016                          | no                                    |
| T018  | e2e y prueba de idioma                           | UI         | T017, T006                    | no                                    |
| T019  | Capturas «después», referencias visuales, medidas, revisión final | UI | T018                 | no                                    |
| T020  | Registro T-043/T-148                             | DOCS       | —                             | con todas salvo T021                  |
| T021  | Cierre (verify + spec002 + T-136)                | IMPL       | T001–T020                     | no                                    |

**Dependencia dura (FR-033)**: ninguna tarea de página (T011–T019, y en la serie el catálogo de 012) empieza antes de T004. Antes del OK solo avanzan T001 (corrección árbol/mapa), T002 (enmienda), T003 (propuestas, con los tokens en modo propuesta en el worktree del agente, sin integrar), T020 (registro) y, por no ser tareas de página, el contrato de datos T005–T006 (IMPL). T007–T010 esperan también al OK porque concretan la base elegida.

Las tareas UI T011–T019 no son `[P]` entre sí porque todas añaden cadenas a `messages.{en,es}.xlf` o tocan la misma página; un agente UI las hace en serie.

### Lotes por agente (líneas contiguas de `tasks.md`)

- **UI-1**: T001. **UI-2**: T003 (y el checkpoint T004 lo cierra el orquestador). **UI-3**: T009, T010. **UI-4**: T011–T015. **UI-5**: T016–T019.
- **IMPL-1**: T005, T006. **IMPL-2**: T007, T008. **IMPL-3**: T021.
- **DOCS**: T002 y T020.

### Orden

```text
T001 (UI) ─────────────────────────────────────────────┐
T002 (DOCS) ──────────────┐                            │
T003 (UI) ── T004 OK Paco ┼─ T007 (IMPL) ──┐           │
                          ├─ T009 ─ T010 ──┼─ T011 … T015 ─ T016 ─ T017 ─ T018 ─ T019 ─┐
                          └─ T008 (tras T009)          │                                ├─ T021
T005 ─ T006 (IMPL) ────────────────────────────────────┘ (T011, T014 usan T005; T018 usa T006)
T020 (DOCS) ───────────────────────────────────────────────────────────────────────────┘
```

## Diseño por tarea (resumen; detalle en research)

- **T001 (R1, D1, D2)**: capturas «antes» y medidas informativas; reproducir en las cuatro combinaciones; corregir (`pnpm start` sirve los assets generados desde una carpeta ignorada; aviso sin JS en el respaldo del árbol; lo que falle en el artefacto); prueba de regresión que falla sin la corrección.
- **T002 (P44 = A, R8)**: §VII excepción 3 con el alcance exacto de P44, condición común, retirada y fallback; versión 1.12.0; `proof_ref` = `research.md#r8`.
- **T003 (FR-033)**: con `impeccable` (modo `shape`/new-work), 2–3 direcciones de la base negra (paleta de `spec.md` §4 como punto de partida, tipografía, tokens, marco del tooltip) aplicadas en un prototipo **no integrado** sobre el artefacto real con `ASSET_SOURCE=game`; capturas a 375/768/1280 de cabecera de build, una sección, un tooltip abierto y una tarjeta; una nota por propuesta (intención, tokens, tipografía con su peso en bytes, contrastes) en `runs/11111619/propuestas-009/`.
- **T004 (FR-033, SC-008)**: Paco elige (o pide cambios); se registra en «Clarifications» de `spec.md` con fecha y ruta de las capturas, y en `preguntas-ui.md`.
- **T005 (D4)** y **T006**: contrato de datos y BD (ver `data-model.md`).
- **T007 (D6)**: 6 portadas WebP desde la copia local, con encuadre acorde a la propuesta elegida; manifiesto y `check-assets`.
- **T008 (D3)**: contraste de los tokens nuevos de la propuesta elegida.
- **T009 (D3)**: tokens, tipografía y `DESIGN.md` con la propuesta elegida (registrada en `DESIGN.md`); `accessibility.css` al día.
- **T010 (D5)**: tooltip común con el marco elegido.
- **T011–T015**: cabecera e intro, índice, checklist, build final y loot filter como componentes sin tocar `build.page.html` (D8).
- **T016–T017**: composición y nombres según la página.
- **T018–T019**: e2e, prueba de idioma, capturas «después», revisión final de Paco (SC-007), referencias visuales y medidas informativas.
- **T020 (D9)**: registro de T-043 y T-148. **T021**: cierre.

## Decisiones aplicadas

| Punto                      | Decisión                                                         | Origen              | Tareas     |
| -------------------------- | ---------------------------------------------------------------- | ------------------- | ---------- |
| Fondo                      | Negro, paleta de `spec.md` §4 como punto de partida              | Paco, P37           | T003, T008, T009 |
| Aprobación visual          | 2–3 propuestas y OK antes de las páginas                         | Paco, FR-033        | T003, T004 |
| Activos del juego          | Enmienda 1.12.0 con el alcance de P44 = A                        | Paco, P40/P44       | T002, T007 |
| Idioma de nombres          | Según la página                                                  | Paco, P39           | T017, T018 |
| Presupuestos               | Informativos en 009; CI verde en 013                             | Paco, P43           | T001, T019, T021 |
| Partición y PR             | Serie 009–013, un solo PR                                        | Paco, P42           | —          |
| Nombres de tokens          | Se conservan; cambian valores (D3)                               | Planificador        | T008, T009 |
| Campos editoriales         | Siete campos; derivados sin columna (D4)                         | Planificador        | T005, T006 |
| Registro T-043/T-148       | Sin IDs nuevos de spec001 (D9)                                   | Planificador        | T020       |

## Riesgos

| Riesgo                                                                  | Prob. | Impacto | Mitigación                                                                                                        |
| ----------------------------------------------------------------------- | ----- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| T001 descubre otra causa (artefacto con JS)                             | Media | Alto    | La tarea corrige lo que reproduzca, con prueba de regresión; si excede el alcance, se detiene y escala.            |
| El HTML de la guía supera 120 000 B                                     | Alta  | Bajo en 009 | Informativo (P43); se registra la cifra; lo resuelve 013 sin degradar UI/UX.                                  |
| Migración 0015 rompe la siembra o el release                            | Baja  | Alto    | Columnas con valores por defecto; pruebas con Postgres real; `check:release` en T021.                             |
| La portada no tiene buena fuente en el juego                            | Media | Medio   | T007 documenta candidatas; Paco valida en T019; fallback propio siempre disponible.                               |
| Cambio de paleta rompe el contraste forzado o el foco                   | Media | Medio   | `check:contrast`, `accessibility.css` revisada en T009 y `e2e:a11y`.                                              |
| Regenerar las 30 referencias visuales oculta regresiones                | Media | Medio   | Solo tras la revisión visual de Paco (T019) y con las capturas antes/después adjuntas.                            |
| Conflictos en `messages.*.xlf` entre agentes UI                         | Alta  | Bajo    | Tareas UI en serie en un solo agente por lote.                                                                    |
| `angular.json` tocado por T001 y T011                                   | Media | Bajo    | T001 se integra antes de que empiece T011.                                                                        |
| Paco no elige ninguna propuesta o pide otra ronda                       | Media | Alto    | T004 admite «cambios»: T003 se repite con su feedback; las tareas de página siguen bloqueadas; IMPL avanza con datos. |

## Complexity Tracking

Sin desviaciones de la constitución que justificar (la enmienda 1.12.0 es una tarea aprobada por Paco, no una excepción).
