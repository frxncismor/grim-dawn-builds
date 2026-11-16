# Implementation Plan: Deuda aplazada de las revisiones de spec003 y spec004

**Branch**: `005-deuda-revisiones` (planificación en `orq/11111619-ui-s5-plan`) | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-deuda-revisiones/spec.md`; evidencia por elemento en [research.md](research.md); `.specify/memory/constitution.md` (1.11.0).

**Estado**: **clarify cerrado** (Paco, 2026-11-16): Q-A a Q-E (Preguntas 23–27) = **A**, todas las recomendadas; ver «Clarifications» en `spec.md`. Nuevo alcance de Paco el mismo día: marca pública «Grim Builds» (US6).

## Summary

Convertir en trabajo planificado 11 elementos de deuda aplazada: S4-D1 a S4-D7 de spec004 y S3-T042, S3-T043, A-01 y C-003 de spec003 (A-03 queda fuera: ya resuelto por spec004 T005, ver research R8), aplicar la marca pública «Grim Builds» con su aviso de no afiliación (US6) y añadir verificación visual: una revisión de fidelidad con visión (US7) y una regresión visual en CI (US8). Aparte de la marca, la salida visible no cambia. Orden por riesgo: primero la puerta de derechos (S4-D1), después el contrato de sembrado y el catálogo (capa de datos), después la presentación, la marca (que toca los mismos archivos de `apps/web` que la presentación y por eso va después), la revisión de fidelidad y su corrección, la regresión visual (la última de las visuales, para no regenerar referencias) y por último la puerta de cierre.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS; Angular 21 (SSG); scripts `.mts` ejecutados con `tsx`.

**Primary Dependencies**: ninguna nueva (constitución VIII).

**Storage**: PostgreSQL; **sin migración** (Q-A = A: solo cambia el SQL de siembra). Las fixtures cambian de nombre visible (US6), no de esquema.

**Testing**: `node --test` (`pnpm test:scripts`), Vitest en `packages/domain`, `apps/api` y `apps/web`, `*.int.spec.ts` con Postgres real en CI, Playwright + axe (`e2e:a11y`, `e2e:journeys`), Lighthouse CI (`check:performance`).

**Target Platform**: sitio estático prerenderizado local-first más API en Docker para release.

**Project Type**: monorepo pnpm. Huella: `scripts/`, `packages/domain`, `apps/api`, `apps/web`, `apps/web/DESIGN.md` y esta spec.

**Performance Goals**: presupuestos de §6 intactos (FR-020); `/tier-list` es la ruta con menos margen (111 206/112 000 B de JS inicial al cierre de spec004). Ninguna tarea de `apps/web` suma bytes netos; T011 (formateador compartido) debe medirse.

**Constraints**: CSP sin `unsafe-inline`, paridad EN/ES, WCAG 2.2 AA, lectura sin JS, sin secretos. `check:boundaries` entre `scripts/`, `apps/api`, `apps/web` y `packages/domain`.

**Scale/Scope**: 18 tareas (más las correcciones que propone la revisión de fidelidad); ~25 archivos de código más sus pruebas, y ~39 archivos con la cadena de marca antigua (de los que se tocan los de código, plantillas, traducción, fixtures e imagen; los históricos quedan fuera).

## Constitution Check

_GATE: previo a Fase 0, re-comprobado tras el diseño._

| Principio                                 | Relevancia | Cómo lo cumple                                                                                                          |
| ----------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| I. Contenido verificable y atribuido      | Media      | Sin contenido nuevo; T001 endurece la puerta que vigila la atribución a Crate.                                          |
| IV. Rendimiento                           | Alta       | FR-020/SC-008: medir el margen de `/tier-list` antes y después de las tareas de `apps/web`.                              |
| V. Accesibilidad                          | Alta       | T009 (doble anuncio) con `e2e:a11y`; las demás no cambian el árbol accesible.                                            |
| VI. Datos tipados, una sola fuente        | Alta       | T002/T004 (contrato y códigos) y T005/T006 (lista de maestrías) eliminan copias manuales.                                |
| VII. Legalidad y activos del juego        | Alta       | T001: las puertas de crédito dejan de pasar en vacío; T015: aviso visible de no afiliación con Crate y con Grim Dawn y marca que no sugiere afiliación; ninguna tarea cambia el manifiesto ni los activos. |
| VIII. Simplicidad                         | Alta       | Sin dependencias ni paquetes nuevos; la columna `retired_at` queda descartada (Q-A = A).                                 |
| IX. Pruebas proporcionales al riesgo      | Alta       | Cada tarea empieza por una prueba roja; C-003 se prueba contra Postgres real.                                            |
| X. EN/ES                                  | Alta       | T015: marca y aviso en ambos idiomas con paridad de `messages.*.xlf`; T009 mantiene la paridad si cambia una cadena.     |
| XI. Backend seguro por defecto            | Media      | T007 falla cerrado y sin cambios parciales; T005/T006 mantienen `.strict()` y los límites de la lista pública.           |
| XII. Secretos                             | Baja       | Ninguna tarea toca secretos; el contrato compartido no transporta credenciales.                                          |

Resultado: **sin violaciones**. Re-comprobado tras el diseño: el módulo de contrato (Q-E = A) vive en `packages/domain` sin dependencias nuevas; la única fuente de riesgo es el presupuesto de `/tier-list`, medido en T008 y T011.

## Project Structure

### Documentation (this feature)

```text
specs/005-deuda-revisiones/
├── spec.md
├── plan.md              # este archivo
├── research.md          # evidencia por elemento (R1–R12)
├── data-model.md        # entradas de datos tocadas
├── quickstart.md        # cómo validar cada historia
├── contracts/
│   └── seed-contract.md # contrato lanzador–sembrador (T002)
├── checklists/
│   └── requirements.md
├── reviews/             # notas de deuda y resultado de la puerta (al cerrar)
└── tasks.md
```

### Source Code (huella prevista)

```text
scripts/
├── check-assets.mts (+test)        # T001
├── seed-content.mts (+test)        # T003, T004
└── build-release.mts (+test)       # T001 si cambia la llamada
packages/domain/src/
├── seed-contract.ts (+spec)        # T002 (Q-E = A)
├── mastery-summary.ts (+spec)      # T005
└── index.ts                        # exportaciones
apps/api/src/
├── catalog/map-mastery.ts, mastery-repository.ts   # T005
├── routes/masteries.ts                              # T005
└── db/{seed,bootstrap,write-content}.mts (+tests)   # T003, T007
apps/web/src/
├── app/core/content/masteries.server.ts (+spec)     # T006
├── app/features/home/{home.page.html,home.page.ts,home-builds.ts}  # T010, T011, T012
├── app/features/build/{summary,attribution,source-attribution}/    # T011
├── app/shared/format-date.ts (+spec)                # T011 (nombre a confirmar al implementar)
├── app/shared/ui/build-card/                        # T009, T012
├── app/shared/ui/layout/site-layout.{html,ts}       # T015 (marca y aviso del pie)
├── app/core/seo/seo.service.ts                      # T015 (SITE_NAME, alt social)
├── app/features/build/build.page.ts                 # T015 (SITE_NAME, JSON-LD)
├── app/features/static-pages/                       # T015 (about, legal)
├── index.html, locale/messages.{en,es}.xlf          # T015
├── brand.test.mts                                   # T015 (prueba de marca)
└── styles/tier-components.css                       # T008
apps/web/DESIGN.md                                   # T013 (Q-D = A), T015
apps/web/PRODUCT.md                                  # T015
apps/web/public/og/site.{svg,png}                    # T015
fixtures/content/{authors,builds,sources,tier-lists}/  # T014 (nombre visible; slugs intactos)
apps/api/test/content.int.spec.ts                    # T014
scripts/{compare-builds,gen-catalog,static-home}.test.mts, scripts/fixtures/static-home.html, scripts/check-locale-parity.mts  # T014
```

**Structure Decision**: sin carpetas nuevas salvo el módulo de contrato y el formateador común.

## Reparto entre áreas (obligatorio)

Regla: lo de `apps/web` lo hace **UI**; lo de `apps/api`, `packages/*` o `scripts/` lo hace **implementación**. Las tareas que cruzan ambas se dividen; el dueño y la dependencia constan en cada una.

| Tarea | Elemento      | Área                 | Archivos principales                                                       | Depende de            | `[P]` |
| ----- | ------------- | -------------------- | -------------------------------------------------------------------------- | --------------------- | ----- |
| T001  | S4-D1         | implementación       | `scripts/check-assets.mts`, `scripts/check-assets.test.mts`, `scripts/build-release.mts` | — (**primera**) | no    |
| T002  | S3-T043       | implementación       | `packages/domain/src/seed-contract.ts` (+spec), `index.ts`                 | T001; Q-E             | no    |
| T003  | S3-T043       | implementación       | `scripts/seed-content.mts` (+test), `apps/api/src/db/{seed,bootstrap}.mts` | T002                  | no    |
| T004  | S3-T042       | implementación       | `scripts/seed-content.mts`, `apps/api/src/db/write-content.mts` (+tests)   | T003                  | no    |
| T005  | A-01          | implementación       | `packages/domain/src/mastery-summary.ts`, `apps/api/src/{catalog,routes}/` | T002 (mismo `index.ts`) | no  |
| T006  | A-01          | **UI**               | `apps/web/src/app/core/content/masteries.server.ts` (+spec)                | T005                  | no    |
| T007  | C-003         | implementación       | `apps/api/src/db/write-content.mts`, `apps/api/test/*.int.spec.ts`          | T004 (mismo archivo); Q-A | no |
| T008  | S4-D2         | **UI**               | `apps/web/src/styles/tier-components.css` (+prueba)                         | — (línea base de bytes aquí) | `[P]` con T010, T013 |
| T009  | S4-D3         | **UI**               | `apps/web/src/app/shared/ui/build-card/build-card.{ts,spec.ts}`             | T008 (medida); Q-C    | no    |
| T010  | S4-D4         | **UI**               | `apps/web/src/app/features/home/home.page.html` (+spec)                     | —                     | `[P]` con T008, T013 |
| T011  | S4-D5         | **UI**               | `apps/web/src/app/shared/` (nuevo) y las cuatro vistas                      | T010 (`home.page.ts`)  | no    |
| T012  | S4-D6         | **UI**               | `build-card.model.ts`, `home-builds.ts`, specs                              | T009                  | no    |
| T013  | S4-D7         | **UI** (doc de `apps/web`) | `apps/web/DESIGN.md`, `specs/005-deuda-revisiones/reviews/`            | Q-D                   | `[P]` con T008, T010 |
| T015  | marca (US6)   | **UI**               | `apps/web/src/**` (layout, SEO, home, build, estáticas, `index.html`, xlf), `apps/web/public/og/`, `apps/web/{PRODUCT,DESIGN}.md`, `apps/web/src/brand.test.mts`, registro en `package.json` | T012, T013, T014 | no |
| T014  | marca (US6)   | implementación       | `fixtures/content/**`, `apps/api/test/content.int.spec.ts`, `scripts/*.test.mts`, `scripts/fixtures/static-home.html`, `scripts/check-locale-parity.mts`, `docs/content/{permission-request-template,source-policy}.md`, `apps/web/src/app/core/content/{parity,fixture-source.server}.test.mts` (solo la aserción del nombre) | T007 | no |
| T016  | fidelidad (US7) | **UI**             | `e2e/fidelity-capture.spec.ts`, `package.json`, `specs/005-deuda-revisiones/reviews/fidelity.md` | T015, T008–T012 | no |
| T017  | regresión visual (US8) | **UI**      | `e2e/visual.spec.ts`, `playwright.visual.config.ts`, `e2e/visual-baselines/**`, `.github/workflows/{ci,visual-baselines}.yml`, `scripts/ci-workflow.test.mts`, `package.json`, `CONTRIBUTING.md` | T016 y correcciones; T015 | no |
| T018  | cierre        | implementación (coordina la puerta) | `specs/005-deuda-revisiones/reviews/`, `specs/README.md`        | T001–T017             | no    |

Dueño y dependencia en las tareas que cruzan áreas: **A-01** se divide en T005 (implementación: dominio + API) y T006 (UI: web), con T006 después de T005 y después de reconstruir `packages/domain`. **Marca (US6)** se divide en T014 (implementación: fixtures y pruebas de `scripts/` y `apps/api`) y T015 (UI: `apps/web`), con T015 después de T014. Excepciones acotadas de frontera, declaradas aquí para que ningún agente edite fuera de su área sin saberlo: T014 cambia solo la aserción del nombre en dos pruebas de contenido de `apps/web` (`parity.test.mts:247`, `fixture-source.server.test.mts:38`) porque comprueban las fixtures que T014 cambia; T015 añade una línea al `test:scripts` de `package.json` para registrar su prueba de marca. **S3-T043** y **C-003** son solo implementación.

### Paralelismo

`[P]` solo donde los archivos son disjuntos: T008 (CSS), T010 (`home.page.html`) y T013 (documentación) no comparten archivos. T009/T011/T012 comparten `build-card.*`, `home.page.ts` o `home-builds.ts` y van en serie; T015 toca archivos de todas ellas (`home.page.ts`, `build-card.spec.ts`, xlf, `DESIGN.md`) y por eso va después de T012 y T013. En implementación todo va en serie (comparten `index.ts`, `seed-content.mts` o `write-content.mts`). Implementación y UI pueden avanzar a la vez, cada una en su worktree, porque no comparten archivos hasta T006.

### Orden

1. **T001** (S4-D1, por decisión de Paco).
2. Implementación: T002 → T003 → T004 → T005 → T007 → T014.
3. UI en paralelo a lo anterior: T008 ∥ T010 ∥ T013, luego T009 → T011 → T012; T006 cuando T005 esté integrada; T015 cuando T012, T013 y T014 estén integradas.
4. T016: revisión de fidelidad (cuando T015 y T008–T012 estén integradas); las correcciones que acepte el principal van entre T016 y T017.
5. T017: regresión visual, **la última visual**.
6. T018: puerta de cierre de spec002 sobre spec005.

## Regresión visual: diseño (T017)

Respuesta a «cómo se generan y actualizan las referencias y dónde corren en CI».

| Aspecto                | Decisión                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qué se compara         | `toHaveScreenshot` de página completa: 5 rutas (`/`, `/tier-list`, `/builds/chaman-demoledor-golpe-primigenio`, `/maestrias`, `/maestrias/soldado`) × 375/768/1280 × EN/ES = **30 capturas**. Los estados del tooltip van en la revisión de fidelidad, no en la regresión (dependen de la interacción y multiplican las referencias). |
| Artefacto              | Construido con `ASSET_SOURCE=own` y `CONTENT_SOURCE=fixture` en su propio directorio (no es el artefacto `game` que miden Lighthouse y axe: no hay PNG del juego en el repositorio, así que `own` es el único determinista). |
| Entorno fijado         | Chromium del `package.json` en `ubuntu-24.04`; solo las fuentes locales del sitio (esperar `document.fonts.ready`); viewport 375/768/1280 × 900; `deviceScaleFactor: 1`; `locale` en-US/es-419; `timezoneId: 'UTC'`; `reducedMotion: 'reduce'`; `animations: 'disabled'`; `caret: 'hide'`; sin red externa (CSP). |
| Tolerancia             | `maxDiffPixelRatio: 0.002` y `threshold: 0.2` por captura (valores iniciales; T017 los ajusta con dos ejecuciones iguales y los deja escritos en la configuración). Sin máscaras salvo que una zona resulte no determinista. |
| Dónde viven las referencias | `e2e/visual-baselines/` (`snapshotPathTemplate` propio; `__screenshots__/` está en `.gitignore`). Unos 30 PNG de página completa: se estima 3–8 MB, que se mide en T017 y se declara; si pasa de lo razonable se reduce el alto o se elige `scale: 'css'` ya fijado. |
| Cómo se generan        | **Solo en Linux, en el CI**: flujo manual `.github/workflows/visual-baselines.yml` (`workflow_dispatch`) construye el artefacto `own`, ejecuta `pnpm e2e:visual:update` y publica las capturas como artefacto del flujo. Una persona las descarga y las commitea; el CI nunca hace push. Nunca se generan en Windows. |
| Cómo se actualizan     | Cambio visual deseado → lanzar el flujo en la rama del PR → descargar y commitear las referencias → la diferencia de PNG aparece en la revisión del PR. |
| Dónde corre en CI      | Trabajo nuevo `visual-regression` en `.github/workflows/ci.yml` (PR), paralelo al trabajo `verify`: `ubuntu-24.04`, mismos pasos de instalación, `pnpm run build` con `ASSET_SOURCE=own`, `playwright install --with-deps chromium`, `pnpm e2e:visual`. Al fallar sube esperada, obtenida y diferencia. |
| Prueba del flujo       | `scripts/ci-workflow.test.mts` exige que el trabajo exista, use `ASSET_SOURCE=own` y los permisos mínimos; `check:ci-secrets` sigue verde (sin secretos). |

## Decisiones de Paco aplicadas (clarify cerrado)

| Pregunta | Respuesta (2026-11-16)                                | Tareas   | Efecto                                                                        |
| -------- | ----------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Q-A (23) | A: borrar nodos y maestría; fallar cerrado si hay guías | T007   | Sin migración ni modelo nuevo                                                  |
| Q-B (24) | A: fallar en ambos modos con artefacto vacío          | T001     | Una sola condición, sin rama por modo                                          |
| Q-C (25) | A: `aria-hidden` en el estado visible                 | T009     | Cambio mínimo en `build-card.ts`                                               |
| Q-D (26) | A: documentar fuera de spec004 (`DESIGN.md` y `reviews/`) | T013 | El snapshot de cierre de spec004 sigue válido                                  |
| Q-E (27) | A: módulo en `packages/domain`                        | T002–T004 | Sin paquete nuevo                                                              |
| Marca    | «Grim Builds» (alcance nuevo, sin pregunta)            | T015, T014 | US6; aviso de no afiliación EN/ES; fixtures visibles cambian de nombre        |
| Visual   | revisión de fidelidad y regresión visual (alcance nuevo) | T016, T017 | US7, US8; la regresión va la última entre las visuales                        |

## Riesgos

| Riesgo                                                             | Prob. | Impacto | Mitigación                                                                                  |
| ------------------------------------------------------------------ | ----- | ------- | ------------------------------------------------------------------------------------------- |
| Margen de `/tier-list` (794 B) se agota con T011 o T009            | Media | Alto    | Medir antes (T008) y después; si no cabe, T011 se hace sin tocar `/tier-list` o se reabre.   |
| T007 borra una maestría usada por una guía real                    | Baja  | Alto    | `RESTRICT` + transacción + prueba con Postgres real; falla cerrado y nombra la maestría.     |
| Endurecer T001 rompe un build de release que hoy pasa en vacío     | Media | Medio   | La prueba cubre artefacto válido; `quickstart.md` ejecuta `pnpm build:release` real.          |
| Editar spec004 caduca su snapshot                                   | Media | Medio   | Q-D = A; ninguna tarea toca spec004 con el supuesto vigente.                                |
| Los `*.int.spec.ts` solo corren en CI                              | Media | Medio   | T007 exige correrlos con el Postgres de la corrida o declarar «solo CI» antes de marcar.      |
| Las referencias PNG pesan mucho en git o no son deterministas entre ejecuciones | Media | Medio | Medir tamaño en T017; generar solo en el CI; fijar entorno; ajustar tolerancia con dos ejecuciones iguales; máscara solo si hace falta. |
| La revisión de fidelidad sin capturas del juego es solo contra `DESIGN.md` y `PRODUCT.md` | Alta | Bajo | El informe lo declara; Paco puede repetirla cuando haya capturas en `gdb-referencias`. |
| La regresión se escribe antes de aplicar las correcciones de fidelidad y obliga a regenerar | Media | Medio | T017 depende de T016 y de sus correcciones (FR-037). |
| Cambiar el nombre en fixtures altera hashes, semillas o capturas   | Media | Medio   | T014 corre `content:validate`, `test:scripts` y los `*.int.spec.ts`; el slug no cambia. T015 compara capturas salvo marca y aviso. |
| La prueba de marca da falsos positivos con «Grim Dawn» (el juego) | Media | Bajo    | La prueba busca la cadena exacta «Grim Dawn Builds» y no «Grim Dawn»; FR-027 la protege.       |
| El aviso del pie añade bytes a `/tier-list` (margen 794 B)         | Media | Alto    | El pie ya tiene el aviso de Crate (`layout.independent`): se reescribe, no se añade otro; medir antes y después. |
| `og/site.png` no se regenera con las herramientas disponibles      | Media | Bajo    | T015 documenta el método de spec001 (render de `site.svg`) o declara el bloqueo antes de marcar. |

## Complexity Tracking

Sin desviaciones de la constitución que justificar.
