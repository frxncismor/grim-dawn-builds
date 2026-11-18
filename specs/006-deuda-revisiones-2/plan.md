# Implementation Plan: Deuda aplazada de las revisiones de spec004 y spec005 (segunda tanda)

**Branch**: `006-deuda-revisiones-2` (planificación en `orq/11111619-ui-s6-plan`) | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-deuda-revisiones-2/spec.md`; evidencia y decisiones en [research.md](research.md); `.specify/memory/constitution.md` (1.11.1).

**Estado**: planificada. Clarify cerrado (Paco, 2026-11-17): **P33 = A**; **P34**: a) F-002 dentro, b) S-001 dentro, c) S3-T042/S3-T043 fuera (ya hechos), d) `coldStartMs` como mediana de 3 arranques con umbral 5000 ms dentro.

## Summary

Cerrar la deuda que sigue abierta tras spec005, sin cambiar el producto: (1) **S4-D1**, una comprobación única de «artefacto prerrenderizado con páginas» que usan las cuatro puertas que leen páginas (la de arte del juego con fuente propia pasa hoy en vacío); (2) **L1–L3**, ids deterministas en `gd-build-card` derivados de una clave del contenido, comentarios al día, rama muerta fuera y e2e de `aria-describedby`; (3) **L4 y to-do 134**, registro SDD de spec005 y `specs/README.md` al día; (4) **F-002**, la siembra poda los nodos del catálogo sin romper guías que dejan de usarlos en la misma pasada; (5) **S-001**, el contenedor de referencias visuales solo recibe los archivos versionables; (6) **`coldStartMs`** como mediana de 3 arranques. Cierra con la puerta de spec002. S4-D2–S4-D7 y S3-T042/S3-T043 quedan fuera (hechos en spec005; research §R2–R7, §R11).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS (22.23.5); Angular 21 (SSG); scripts `.mts` con `tsx`; `sh` POSIX en el script de Docker.

**Primary Dependencies**: ninguna nueva (constitución VIII).

**Storage**: PostgreSQL 17; **sin migración** (F-002 solo cambia el orden y la traducción de errores del SQL de siembra).

**Testing**: `node --test` (`pnpm test:scripts`), Vitest en `apps/api` y `apps/web`, `*.int.spec.ts` con Postgres real (`RUN_DB_TESTS=1`), Playwright + axe (`e2e:a11y`), regresión visual en Docker (modo `check` del procedimiento vigente de `CONTRIBUTING.md`), `check:initial-js`/`check:performance`.

**Target Platform**: sitio estático prerrenderizado más API en Docker para release; procedimiento manual de Docker local para las referencias visuales.

**Project Type**: monorepo pnpm. Huella: `scripts/`, `apps/api` (`src/db`, `test`), `apps/web/src/app/{shared/ui/build-card,features/home,features/tier-list}`, `e2e/a11y.spec.ts`, `CONTRIBUTING{,.es}.md`, `specs/005-*`, `specs/006-*`, `specs/README.md`.

**Performance Goals**: `/tier-list` ≤ 112 000 B de JS inicial; base aceptada **111 403 B** (margen 597 B). Solo T002 puede sumar bytes al cliente (una clave por tarjeta); se mide antes y después. `coldStartMs` mantiene el umbral de 5000 ms.

**Constraints**: CSP sin `unsafe-inline`; paridad EN/ES; WCAG 2.2 AA; lectura sin JS; sin secretos; `check:boundaries`; las 30 referencias visuales no se regeneran (ningún cambio visible).

**Scale/Scope**: 8 tareas (T001–T008); ~15 archivos de código y pruebas, ~8 de documentación.

## Constitution Check

_GATE: previo a Fase 0, re-comprobado tras el diseño._

| Principio | Relevancia | Cómo lo cumple |
| --------- | ---------- | -------------- |
| I. Contenido verificable y atribuido | Media | T001 endurece las puertas que vigilan el crédito a Crate y el arte del juego. |
| III. SEO/SSG | Media | T002 hace determinista el HTML prerrenderizado; no cambia metadatos ni contenido. |
| IV. Rendimiento | Alta | Medir `/tier-list` antes y después de T002; T007 hace estable el presupuesto de arranque sin relajarlo. |
| V. Accesibilidad | Alta | T002/T003 conservan el nombre y la descripción accesibles; T003 añade el e2e que faltaba; `e2e:a11y` 0 violaciones. |
| VI. Una sola fuente | Alta | T001 deja un único criterio de vacío; T005 no cambia el esquema. |
| VII. Legalidad y activos | Alta | T001: la puerta «sin arte del juego con `own`» deja de pasar en vacío. |
| VIII. Simplicidad | Alta | Sin dependencias ni paquetes; un módulo pequeño en `scripts/`. |
| IX. Pruebas proporcionales | Alta | Cada tarea de código empieza en rojo; F-002 con Postgres real; S-001 con Docker real. |
| X. EN/ES | Media | T003 prueba la descripción en EN y ES; ninguna cadena nueva. |
| XI. Backend seguro | Media | T005 falla cerrado, sin cambios parciales, sin SQL ni valores en el error. |
| XII. Secretos | Alta | T006 hace real la frontera que `CONTRIBUTING` promete: ningún archivo ignorado entra al contenedor. |

Resultado: **sin violaciones**. Re-comprobado tras el diseño: la única fuente de riesgo de presupuesto es T002.

## Project Structure

### Documentation (this feature)

```text
specs/006-deuda-revisiones-2/
├── spec.md
├── plan.md              # este archivo
├── research.md          # evidencia R1–R15 y decisiones D1–D6
├── data-model.md        # entidades tocadas (sin esquema nuevo)
├── quickstart.md        # cómo validar cada historia
├── checklists/
│   └── requirements.md
├── reviews/             # resultado de la puerta (al cerrar)
└── tasks.md
```

Sin `contracts/`: no cambia ninguna interfaz pública (API, rutas, CLI); el helper de T001 es interno de `scripts/` y su firma está en research D1.

### Source Code (huella prevista)

```text
scripts/
├── artifact-pages.mts (+.test.mts)            # T001 (nuevo: helper único, D1)
├── check-assets.mts (+.test.mts)              # T001
├── check-legacy-brand.mts (+.test.mts)        # T001
├── visual-baselines-docker.sh                 # T006
└── visual-baselines-docker.test.mts           # T006 (nuevo)
package.json                                   # T001, T006 (registro en test:scripts)
apps/api/src/db/{write-content,seed,bootstrap}.mts   # T005
apps/api/src/db/seed.spec.ts                         # T005
apps/api/test/{seed,bootstrap}.int.spec.ts           # T005
apps/api/test/performance.int.spec.ts                # T007
apps/web/src/app/shared/ui/build-card/build-card.{ts,model.ts,labels.ts,spec.ts}  # T002, T003
apps/web/src/app/features/tier-list/{card-data.ts,tier-preview.component.ts} (+specs)  # T002
apps/web/src/app/features/home/home-builds.ts (+spec)                                # T002
e2e/a11y.spec.ts                                     # T003
CONTRIBUTING.md, CONTRIBUTING.es.md                  # T006
specs/005-deuda-revisiones/{spec,plan,quickstart,tasks}.md   # T004
specs/README.md                                      # T004, T008
specs/006-deuda-revisiones-2/{tasks.md,reviews/}     # T008
```

**Structure Decision**: sin carpetas nuevas; un módulo nuevo en `scripts/` (T001) y dos pruebas nuevas (T001, T006).

## Reparto entre áreas (obligatorio)

Regla: `apps/web` y `e2e/` → **UI**; `apps/api`, `packages/*`, `scripts/`, CI → **implementación**; solo docs SDD → **UI**. `CONTRIBUTING{,.es}.md` va con T006 (implementación) porque documenta el script que cambia.

| Tarea | Elemento | Área | Archivos principales | Depende de | `[P]` |
| ----- | -------- | ---- | -------------------- | ---------- | ----- |
| T001 | S4-D1 | implementación | `scripts/artifact-pages.mts` (+test), `scripts/check-assets.mts` (+test), `scripts/check-legacy-brand.mts` (+test), `package.json` | — (**primera**) | no |
| T002 | L1 | **UI** | `build-card.{ts,model.ts,labels.ts,spec.ts}`, `tier-list/card-data.ts`, `tier-list/tier-preview.component.ts`, `home/home-builds.ts` (+specs) | T001 (orden) | `[P]` con T005–T007 |
| T003 | L2, L3 | **UI** | `build-card.{ts,model.ts,labels.ts,spec.ts}`, `e2e/a11y.spec.ts` | T002 (mismos archivos) | `[P]` con T005–T007 |
| T004 | L4, to-do 134 | **UI** (solo docs SDD) | `specs/005-deuda-revisiones/{spec,plan,quickstart,tasks}.md`, `specs/README.md` | T001 (orden) | `[P]` con T002, T003, T005–T007 |
| T005 | F-002 | implementación | `apps/api/src/db/{write-content,seed,bootstrap}.mts`, `seed.spec.ts`, `apps/api/test/{seed,bootstrap}.int.spec.ts` | T001 | `[P]` con T002–T004 |
| T006 | S-001 | implementación | `scripts/visual-baselines-docker.sh`, `scripts/visual-baselines-docker.test.mts`, `package.json`, `CONTRIBUTING{,.es}.md` | T005 (serie del área); T001 (`package.json`) | `[P]` con T002–T004 |
| T007 | coldStart (to-do 117) | implementación | `apps/api/test/performance.int.spec.ts` | T006 (serie del área) | `[P]` con T002–T004 |
| T008 | cierre | implementación (coordina la puerta) | `specs/006-deuda-revisiones-2/reviews/`, `specs/006-deuda-revisiones-2/tasks.md`, `specs/README.md` | T001–T007 | no |

Ninguna tarea cruza áreas: L1 y L3 son solo de `apps/web`/`e2e`; F-002, S-001 y coldStart solo de `apps/api`/`scripts`. Única arista entre áreas: `specs/README.md` (T004 de UI y T008 de implementación), en serie. T006 va después de T001 aunque sean del mismo área porque ambas tocan la línea `test:scripts` de `package.json`.

### Orden

1. **T001** (S4-D1, por decisión de Paco), integrada antes de abrir lo demás.
2. En paralelo, cada área en su worktree:
   - Implementación: T005 → T006 → T007.
   - UI: T002 → T003, y T004 cuando quiera (archivos disjuntos).
3. **T008**: puerta de cierre de spec002 sobre spec006.

## Diseño por tarea (resumen; detalle en research D1–D6)

- **T001 (D1)**: `prerenderedPages(browserDir, { gate, minPages = 1 })` en `scripts/artifact-pages.mts`: exige que `browser/` exista, sea directorio real (no enlace simbólico ni archivo) y tenga al menos `minPages` páginas `.html` (la marca exige más de `MIN_PRERENDERED_PAGES`, es decir `minPages = MIN_PRERENDERED_PAGES + 1`); devuelve la lista ordenada; si no, lanza `Error` con `«<gate>: el artefacto está vacío (…)»`. `assertCredit` y `assertNoLegacyBrand` lo usan; con artefacto válido sus mensajes no cambian (FR-004) y los de vacío pasan a ser los del helper, con el nombre de la puerta como prefijo (`ASSET_SOURCE=<modo>: <puerta>` en las de crédito, como hoy); si una prueba existente fija el texto de vacío, se actualiza y se cita en la evidencia; `assertNoGamePortraits` lo llama solo con `source === 'own'` y después hace su búsqueda de PNG como hoy. Las puertas de la segunda mitad de la tabla de research §R1 no cambian (P33 = A).
- **T002 (D2)**: `BuildCardInput.key` (obligatoria) y `BuildCardData.key`; `descriptionId = 'build-card-combination-' + key`. Claves: catálogo `card.id` (ya única por entrada, `catalog.model.ts:104`); portada el slug de la guía; preview claves fijas. Sin `let` de módulo; docstring corregido. Las claves no tienen espacios (un `id`/IDREF válido con `:`), así que no hace falta saneado en el cliente.
- **T003 (D3)**: la rama `@else` (sin enlace) deja de pintar `srCombination` (ninguna entrada real la alcanza: `combinationLang` solo existe con guía, `card-data.ts:63-72`, y la portada no lo usa); comentarios de `build-card.labels.ts:66-68` y `build-card.model.ts:66-70` al mecanismo actual (`aria-describedby`); e2e en `e2e/a11y.spec.ts` con `toHaveAccessibleDescription` en `/tier-list` (EN: descripción con la combinación ES, `lang="es"`) y `/es/tier-list` (sin descripción).
- **T005 (D4)**: la poda de nodos sueltos sale de `writeCatalogRows` y se parte en dos: antes del upsert se borran solo los nodos obsoletos **sin** referencias de guías (libera sus celdas de la rejilla, `catalog_skill_nodes_grid_cell_uq`); después de `writeContentRows` se borran los demás, traduciendo 23503 a `SeedError('reference', <id de maestría>)` como `retireMasteries`. Un nodo obsoleto aún referenciado que choca con la celda de un nodo nuevo (23505 en el upsert) se traduce igual a `reference` _(histórico, sustituido por T009: el nodo se aparca fuera de la rejilla con `grid_row + 1000000` y decide la FK en la poda, `write-content.mts:463-474`; el 23505 ya no se produce)_. Los tres llamadores (`seedCatalog`, `seed`, `bootstrap`) siguen el mismo orden.
- **T006 (D5)**: el árbol entra al contenedor por stdin: `git ls-files -co --exclude-standard -z | tar --null -T - -cf - | docker run -i … sh /run.sh update`; desaparece el montaje `-v "$PWD:/src:ro"`; el script extrae en `/work` y **falla** si encuentra `.env`, `.env.*` (salvo `.env.example`) o `infra/docker/secrets/` (defensa en profundidad); sin `tar -X`. `CONTRIBUTING{,.es}.md` y los comentarios describen la frontera real.
- **T007 (D6)**: `measureColdStart` se ejecuta 3 veces en serie; `coldStartMs` = mediana; el informe de consola lista las 3 muestras; el JSON conserva su forma (`coldStartMs` numérico) para no tocar `scripts/check-performance.mts:692`; tiempo del caso de 60 s a 90 s.

## Decisiones de Paco aplicadas

| Pregunta | Respuesta (2026-11-17) | Tareas | Efecto |
| -------- | ---------------------- | ------ | ------ |
| P33 | A: las 4 puertas que leen páginas | T001 | Helper único; las otras puertas no cambian |
| P34 a | F-002 dentro | T005 | Sin migración |
| P34 b | S-001 dentro | T006 | Cambia el comando documentado |
| P34 c | S3-T042/S3-T043 fuera (hechos) | T004 | Solo `specs/README.md` |
| P34 d | mediana de 3, umbral 5000 ms | T007 | Mismo umbral |
| To-do 134 | base 111 403 B aceptada | T004 | Texto de spec005 al día |

## Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
| ------ | ----- | ------- | ---------- |
| T001 cambia un mensaje que una prueba o `build-release` espera | Media | Medio | Mensajes actuales conservados literalmente; `pnpm test:scripts` completo; `build-release.test.mts` sin cambios. |
| T001 rompe la puerta de marca con un artefacto pequeño legítimo | Baja | Medio | `minPages` conserva el umbral actual (`MIN_PRERENDERED_PAGES`). |
| T002 agota el margen de `/tier-list` (597 B) | Baja | Alto | Medir antes/después con `pnpm build` raíz y `check:initial-js`; la clave reutiliza `card.id` ya presente. Si supera, se detiene y se escala. |
| T002 crea ids duplicados en una página | Baja | Alto | Claves únicas por diseño; prueba unitaria y `e2e:a11y` (regla axe `duplicate-id-aria`). |
| T003 quita una rama que sí se usa | Baja | Medio | Prueba previa con los adaptadores reales que demuestre que `combinationLang` sin `href` no ocurre; si ocurre, se conserva y se prueba. |
| T005 deja la siembra a medias | Baja | Alto | Todo en la transacción existente; 3 casos con Postgres real (retira sin guía, deja de usarlo en la misma siembra, sigue usado). |
| T005 choca con la celda de rejilla de un nodo nuevo | Media | Medio | Poda previa de los no referenciados; 23505 traducido a `reference` _(histórico, sustituido por T009: aparcado en `grid_row + 1000000`; decide la FK en la poda)_. |
| T006 rompe el procedimiento de referencias | Media | Medio | Ejecutar `check` y `update` en Docker real; las 30 referencias no cambian (`git status` limpio en `e2e/visual-baselines/`). |
| T006 se ejecuta en Windows sin `tar --null` | Media | Bajo | Git Bash trae GNU tar; `CONTRIBUTING` lo indica como hoy (`MSYS_NO_PATHCONV=1`). |
| T007 alarga la suite de BD | Alta | Bajo | +2 arranques (≈ 2–6 s); tiempo de caso a 90 s. |
| Docker o Postgres no disponibles en local | Media | Medio | La tarea lo declara antes de marcarse; no se marca `[x]` sin la salida real. |

## Complexity Tracking

Sin desviaciones de la constitución que justificar.
