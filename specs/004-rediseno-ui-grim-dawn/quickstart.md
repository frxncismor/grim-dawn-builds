# Quickstart: validar el rediseño de UI

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

> Guía de validación **prevista** (clarify cerrado el 2026-11-15; `tasks.md` T001–T051): los comandos son los que ya existen en `package.json` (`pnpm verify` y sus
> piezas) más los e2e nuevos que crearán las tareas. Las salidas reales de cierre figuran abajo, en «Evidencia de
> cierre (T035)». Una casilla de `tasks.md` no se marca sin evidencia citable.

## Prerrequisitos

- Node 22 LTS y pnpm; dependencias instaladas (`pnpm install`).
- Docker para el release con la API (`CONTENT_SOURCE=api`); no hace falta para fixtures.
- Para extraer los iconos del juego (Q11 = B, **solo tras la puerta G1**: análisis de riesgos y enmienda 1.11.0 aprobadas): instalación legal de Grim Dawn y el extractor de texturas (carpeta `.game-assets/` ignorada por git); los PNG derivados se versionan después, con manifiesto.
- `impeccable` se invoca por ruta absoluta desde el checkout principal (está gitignorado): `C:\Users\paco_\Documents\GitHub\grim-dawn-builds\.agents\skills\impeccable\scripts\impeccable.cmd`.

## Escenarios de validación

| Escenario                           | Comando                                                                                    | Resultado esperado                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Markdown sano                       | `pnpm lint:md`                                                                             | 0 issues                                                                                                                                                                                                     |
| Alcance                             | `pnpm check:scope`                                                                         | sin hallazgos                                                                                                                                                                                                |
| Puerta local completa               | `pnpm verify`                                                                              | exit 0                                                                                                                                                                                                       |
| Presupuestos de §6 (SC-005, SC-006) | `pnpm check:performance`                                                                   | todas las comprobaciones OK; HTML ≤ 120 000 B y CSS gzip ≤ 20 000 B por ruta                                                                                                                                 |
| JS inicial                          | `pnpm check:initial-js`                                                                    | `/` 0 B (≤ 90 000), `/tier-list` ≤ 112 000, `/builds/:slug` ≤ 150 000                                                                                                                                        |
| Accesibilidad (SC-004)              | `pnpm e2e:a11y`                                                                            | 0 violaciones critical/serious en las cinco rutas, EN y ES, 375/768/1280                                                                                                                                     |
| Recorrido (SC-001, SC-003)          | `pnpm e2e:journeys`                                                                        | portada → guía en ≤ 2 clics; tooltip a ≤ 16 px del nodo y dentro del viewport (ratón, teclado, toque)                                                                                                        |
| Contraste                           | `pnpm check:contrast`                                                                      | tokens con contraste ≥ 4,5:1 (texto) y ≥ 3:1 (controles)                                                                                                                                                     |
| Paridad EN/ES (SC-008)              | `pnpm check:locale-parity`                                                                 | mismas secciones y cadenas                                                                                                                                                                                   |
| Tipado de e2e (deuda S3-T042/B-001) | `pnpm typecheck:e2e`                                                                       | exit 0, y forma parte de `pnpm verify`                                                                                                                                                                       |
| Activos (SC-009, FR-017, FR-019)    | `pnpm assets:check`                                                                        | manifiesto válido con entradas de iconos y `proof_ref` a `research.md#r10`; artefacto `own` sin arte del juego; `game` con entrada inválida falla cerrado; sin rutas internas de textura en la vista pública |
| Orden de gobernanza (SC-009)        | revisión del historial: T003 y T004 antes de T027                                          | enmienda 1.11.0 y análisis de riesgos registrados antes del primer PNG de icono versionado                                                                                                                   |
| Anti «AI slop» (SC-010)             | `impeccable.cmd detect --json <archivos cambiados>`                                        | sin hallazgos de reglas deterministas; pruebas de componente sin tarjetas anidadas                                                                                                                           |
| Revisión visual (SC-011)            | capturas 375/768/1280, EN y ES, de las cinco rutas y de los tres estados del tooltip       | aprobadas por Paco o lista de cambios cerrada                                                                                                                                                                |
| Cierre de spec                      | `node scripts/spec-review.mjs prepare --feature specs/004-rediseno-ui-grim-dawn` y `check` | `status: passed` tras las cuatro revisiones de la puerta spec002                                                                                                                                             |

## Evidencia de cierre (T035)

Fecha: 2026-11-16. HEAD de base: `d00b908` (`orq/11111619-rev-s4-t035`, sin cambios locales al empezar). Node 22, `pnpm` 12.18.0, sin
`HTTP_PROXY`/`HTTPS_PROXY`, máquina sin otra carga. Las salidas están saneadas (rutas y cadenas de conexión omitidas).

### `pnpm verify` con `ASSET_SOURCE` por defecto (`own`)

Comando: `pnpm verify` desde la raíz. Resultado: **`verify OK (local)`, exit 0**.

| Paso                  | Resultado                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `check-scope`         | OK, 259 archivos                                                                                            |
| `check-boundaries`    | OK, 365 archivos                                                                                            |
| `check-secrets`       | OK, 865 archivos rastreados                                                                                 |
| `check-ci-secrets`    | OK, 2 workflows                                                                                             |
| `domain:*`            | tests 298 passed, 2 expected fail (13 archivos)                                                             |
| `api:*`               | tests 344 passed, 1 expected fail, 126 skipped (24 archivos, 10 saltados; sin `RUN_DB_TESTS`)               |
| `test:rotation`       | 3 skipped (requiere PostgreSQL)                                                                             |
| `lint`                | `ng lint`: All files pass linting                                                                           |
| `typecheck:e2e`       | `tsc -p tsconfig.e2e.json` sin errores                                                                      |
| `lint:md`             | 95 archivos, 0 issues                                                                                       |
| `format`              | Prettier: todos los archivos conformes                                                                      |
| `test` (web)          | 58 archivos passed; 632 passed, 2 expected fail                                                             |
| `test:scripts`        | 756 tests, 754 pass, 0 fail, 2 skipped                                                                      |
| `content:validate`    | OK, 1 build                                                                                                 |
| `catalog:check`       | gen-catalog OK (10 maestrías, 45 pares)                                                                     |
| `catalog:nodes`       | 6 maestrías OK (186 nodos)                                                                                  |
| `check:locale-parity` | OK, 340 unidades en paridad, 0 fallos                                                                       |
| `assets:check`        | OK, 170 entradas (164 iconos y 6 retratos)                                                                  |
| `check:contrast`      | OK, 12 pares, mínimo 4,5:1                                                                                  |
| `build`               | OK; `static-home`, `emit-404`, `emit-static-assets` (0 retratos y 0 iconos con `own`)                       |
| `check:initial-js`    | OK en las 12 rutas (`/` 0 B; `/tier-list` 111 746/112 000; maestrías 118 179/150 000; guía 126 218/150 000) |
| `check:public-build`  | OK, 430 archivos; valores y patrones ausentes                                                               |
| `check:performance`   | OK, **141/141 comprobaciones** (15 rutas, mediana de 3 corridas; HTML y CSS dentro de presupuesto)          |

Extracto del final del log:

```text
check:performance OK (141/141 comprobaciones; informes en <dist>\lighthouse-performance\run-20261116-072908-e0e947)

verify OK (local)
EXIT=0
```

Holguras más ajustadas (presupuestos sin ampliar): JS inicial de `/tier-list` 111 746/112 000 B; HTML de la guía 117 650 B (EN) y
118 122 B (ES) de 120 000.

### `check:performance` con `ASSET_SOURCE=game`

Comandos: `ASSET_SOURCE=game pnpm build` y después `ASSET_SOURCE=game pnpm check:performance` (el build de `pnpm verify` usa `own`).

- `pnpm build`: **exit 0**; `emit-static-assets OK (7 ficheros en assets\mastery-trees, assets\deferred.css, 6 retratos y 164 iconos de habilidad con ASSET_SOURCE=game)`; `check:initial-js` OK en las 12 rutas con las mismas cifras que con `own`.
- `pnpm check:performance`: **exit 0**, a la primera (no hizo falta repetir): `check:performance OK (141/141 comprobaciones; informes en <dist>\lighthouse-performance\run-20261116-073902-bb9639)`.

### Pruebas de la API con PostgreSQL real

Comando: `RUN_DB_TESTS=1 pnpm exec vitest run` en `apps/api` (equivale a `RUN_DB_TESTS=1 pnpm --filter @gd/api test`). Exit 0:

```text
 Test Files  34 passed (34)
      Tests  470 passed | 1 expected fail (471)
```

0 fallos y 0 saltadas. Las pruebas levantan sus propios contenedores efímeros (`docker run --rm`, nombre aleatorio, imagen fijada por
digest) y los eliminan; no se tocó el stack `grim-dawn-builds` ni se creó ningún proyecto compose. `test:rotation` con BD no se ejecutó:
usa `docker compose` con el nombre del proyecto compartido y T035 no lo exige.

### Markdown y alcance

- `pnpm lint:md` (exit 0): `Linting: 95 files`, `Summary: 0 issues in 0 files`.
- `pnpm check:scope` (exit 0): `check:scope OK (259 archivos revisados)`.

### `speckit-analyze` sobre spec004 (solo lectura)

Resultado: **0 CRITICAL**, 0 HIGH, 2 MEDIUM, 5 LOW. Ninguno bloquea el cierre ni se corrige en T035.

| ID  | Categoría       | Gravedad | Ubicación                                           | Resumen                                                                                                                                                       | Recomendación                                                                            |
| --- | --------------- | -------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A1  | Inconsistencia  | MEDIUM   | `spec.md` FR-040; `plan.md`; `tasks.md`; quickstart | FR-040 dice «`/tier-list` ≤ 110 kB», pero plan, tareas, quickstart y `check:initial-js` usan 112 000 B (excepción documentada de spec001); medido: 111 746 B. | Alinear FR-040 con la excepción de 112 000 B de spec001 o citarla explícitamente.        |
| A2  | Inconsistencia  | MEDIUM   | `tasks.md` L13                                      | La nota «Estado: planificación. Ninguna tarea está hecha» está obsoleta (T001–T034 y T038–T046 hechas).                                                       | Actualizar la nota de estado (T037 o corrección posterior).                              |
| A3  | Inconsistencia  | LOW      | `plan.md` L66, `spec.md` L7, `quickstart.md` L5     | «37 tareas» (hay 46: T001–T046), «Listo para `tasks`» y «T001–T037 … hoy no hay ninguna salida real».                                                         | Actualizar los recuentos y el estado en la próxima edición de documentos.                |
| C1  | Cobertura       | LOW      | `tasks.md` trazabilidad                             | T001, T038–T041 y T042–T046 (solo en SC-011) no aparecen en la tabla requisito → tarea; T036 y T037 son de gobernanza.                                        | Añadir filas o declarar tareas de apoyo.                                                 |
| I1  | Inconsistencia  | LOW      | `tasks.md` T032, T042                               | T042 «Depende de T032» y T032 «se marca cuando T042–T045 estén integradas»: dependencia circular en la redacción.                                             | Reformular T042–T046 como dependientes de la lista de cambios de T032, no de su casilla. |
| I2  | Terminología    | LOW      | `tasks.md` T037, T042–T043                          | T042/T043 designan tareas propias y deuda de spec003 («T042/C-001», «T043»).                                                                                  | Citar siempre con prefijo `spec003`/`spec004` (ya lo exige la nota de dependencias).     |
| U1  | Subespecificada | LOW      | `spec.md` FR-040, SC-006                            | Holguras muy ajustadas (JS `/tier-list` 254 B; HTML guía ES 1 878 B) sin criterio de qué hacer si una tarea futura las agota.                                 | Registrar en `DESIGN.md` o R2 el procedimiento ante el agotamiento del margen.           |

Cobertura: 33 FR y 11 SC = 44 requisitos; 46 tareas (T001–T046); cobertura ≥ 1 tarea: 44/44 (100 %); ambigüedades: 0; duplicaciones: 0;
críticos: 0. Conflictos con la constitución (1.11.0): ninguno.

### Cierre de spec003

spec003 queda cerrada con la evidencia de `1fd7e77` (`spec-review check` passed, snapshot `a5a33731…`); su `check` no se repite en
HEAD porque el snapshot es global (decisión del principal, 2026-11-16).

### Puerta spec002 y T-136

Se ejecutan **tras marcar T036** (precedente spec002 T014, spec003 T021). La evidencia va en
`specs/004-rediseno-ui-grim-dawn/reviews/` (fuera del snapshot que `prepare` firma). Su resultado no se registra aquí.

## Verificación tras las correcciones de la ronda 1 de la puerta (T047–T051)

Fecha: 2026-11-16. HEAD: `e1e1450` (con T047–T051 integradas). Todo en un worktree de integración; extractos saneados (sin rutas internas ni secretos) del log de la corrida. Los cuatro bloques terminaron en **exit 0**: `pnpm verify` (09:10–09:21), build y puertas con `ASSET_SOURCE=game`, API con PostgreSQL real y reconstrucción final con `own`.

| Comando                                     | Exit | Extracto                                                                                                         |
| ------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm verify` (`own`)                       | 0    | `verify OK (local)`                                                                                              |
| `domain:test`                               | 0    | `Test Files  13 passed (13)` · `Tests  310 passed \| 2 expected fail (312)`                                      |
| `api:test` (sin BD)                         | 0    | `Test Files  24 passed \| 10 skipped (34)` · `Tests  344 passed \| 1 expected fail \| 126 skipped (471)`         |
| `lint`                                      | 0    | `All files pass linting.`                                                                                        |
| `typecheck:e2e`                             | 0    | `tsc -p tsconfig.e2e.json` sin errores                                                                           |
| `lint:md`                                   | 0    | `Linting: 95 files` · `Summary: 0 issues in 0 files`                                                             |
| `format`                                    | 0    | `All matched files use Prettier code style!`                                                                     |
| `test` (web)                                | 0    | `Test Files  58 passed (58)` · `Tests  642 passed \| 2 expected fail (644)`                                      |
| `test:scripts`                              | 0    | `# tests 759` · `# pass 757` · `# fail 0` (2 sin contar: skipped/todo)                                           |
| `catalog:nodes` / `check:locale-parity`     | 0    | 6 maestrías OK / `OK: 340 unidades en paridad, 0 fallos`                                                         |
| `assets:check` / `check:public-build`       | 0    | `OK (170 entradas)` / `OK (1457 archivos; valores y patrones ausentes)`                                          |
| `check:performance` (`own`)                 | 0    | `check:performance OK (141/141 comprobaciones; …)`                                                               |
| `ASSET_SOURCE=game pnpm build`              | 0    | `emit-static-assets OK (… 6 retratos y 164 iconos de habilidad con ASSET_SOURCE=game)`                           |
| `ASSET_SOURCE=game pnpm check:initial-js`   | 0    | 12/12 rutas OK (tabla abajo)                                                                                     |
| `ASSET_SOURCE=game pnpm check:performance`  | 0    | `check:performance OK (141/141 comprobaciones; …)`                                                               |
| `RUN_DB_TESTS=1 pnpm --filter @gd/api test` | 0    | `Test Files  34 passed (34)` · `Tests  470 passed \| 1 expected fail (471)` (0 fallos)                           |
| `pnpm build` final (`own`)                  | 0    | `emit-static-assets OK (… 0 retratos y 0 iconos de habilidad con ASSET_SOURCE=own)`; `check:initial-js` 12/12 OK |

`check:initial-js` por ruta (idéntico con `own` en `verify`, con `game` y en la reconstrucción final con `own`; la versión `/es/…` coincide con la inglesa):

| Ruta                                              | JS inicial (gzip 6) | Límite  |
| ------------------------------------------------- | ------------------- | ------- |
| `/` y `/es`                                       | 0 B                 | 90 000  |
| **`/tier-list` y `/es/tier-list`**                | **111 998 B**       | 112 000 |
| `/maestrias` y `/es/maestrias`                    | 106 160 B           | 112 000 |
| `/maestrias/soldier` y `/demolition` (+ES)        | 118 397 B           | 150 000 |
| `/builds/chaman-demoledor-golpe-primigenio` (+ES) | 126 350 B           | 150 000 |

Holgura de `/tier-list`: **2 B** (111 998/112 000); cualquier cambio posterior en la tarjeta la agota. HTML en `own`: `/tier-list` 78 224 B; guía 117 736 B (EN) y 118 216 B (ES) de 120 000; con `game` 117 767 y 118 286 B. CLS 0,000 en las 15 rutas. LCP máximo 907,4 ms (`/builds/…`).

`check:performance`: **141/141 con `own` y 141/141 con `game`** (15 rutas, mediana de 3 corridas, móvil, 4G lento simulado).

Esta verificación **no** repite `e2e:journeys` ni `e2e:a11y`: sus cifras (450 y 165) son las de las notas de T049 en `tasks.md`.
