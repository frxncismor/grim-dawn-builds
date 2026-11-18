# Quickstart y evidencia de cierre: catálogo de árboles de maestría (spec 003)

Este documento registra la evidencia real de T021 y T034 antes de la puerta de cierre. No sustituye
a la revisión de cierre: su veredicto va en `specs/003-catalogo-arboles-maestria/reviews/`.

- **Fecha**: 2026-11-14
- **HEAD de base**: `1f31526` (rama `orq/11111619-rev-t034`, worktree limpio salvo `tasks.md` y este archivo)
- **Entorno**: Windows 11, Node 22, `pnpm` global 12.18.0, sin `HTTP_PROXY`/`HTTPS_PROXY`.

## Comandos de la feature

```text
pnpm catalog:extract --game-dir <juego>   # extracción local (T006/T022); el repo solo guarda el JSON
pnpm catalog:nodes                        # valida fixtures/content/mastery-trees/*.json
pnpm catalog:textures --game-dir <juego>  # texturas a .game-assets/ (gitignorada)
pnpm verify                               # puerta local completa
node scripts/spec-review.mjs prepare --feature specs/003-catalogo-arboles-maestria
```

## Preparación de la puerta (T034)

1. La línea de «Paralelización segura» empezaba por una viñeta con `[P]` y los IDs T003/T004; el
   preparador la leía como tarea. Se reescribió sin corchetes («Paralelizables (marca P): …») con el
   mismo contenido.
2. `prepare` antes de marcar (T021 y T034 abiertas): `exit 1`, `pending-tasks`, no `invalid`.

```text
{"status":"pending-tasks","feature":"specs/003-catalogo-arboles-maestria","pendingTasks":[{"id":"T-021","line":80},{"id":"T-034","line":97}],"excludedTasks":[],"reasons":["active implementation tasks remain unchecked"]}
```

## `pnpm verify` completo (T021)

Comando: `pnpm verify` desde la raíz del worktree. Resultado: **`verify OK (local)`, exit 0**.

Nota de entorno: un primer intento falló en `test:scripts` porque el worktree no tenía el binario
fijado de gitleaks (`Run pnpm setup:gitleaks`); `pnpm setup:gitleaks` no tuvo red, así que se copió
al worktree (carpeta gitignorada `.tools/`) el mismo `gitleaks` 8.30.1 ya instalado en el repo
principal, y la segunda ejecución pasó completa.

| Paso                  | Resultado                                                               |
| --------------------- | ----------------------------------------------------------------------- |
| `check-scope`         | OK, 241 archivos                                                        |
| `check-boundaries`    | OK, 331 archivos                                                        |
| `check-secrets`       | OK, 641 archivos rastreados                                             |
| `check-ci-secrets`    | OK, 2 workflows                                                         |
| `domain:*`            | build, typecheck y lint OK; tests 278 passed, 2 expected fail           |
| `api:*`               | typecheck y lint OK; tests 333 passed, 1 expected fail, 116 skipped     |
| `test:rotation`       | 3 skipped (requiere PostgreSQL, sin `RUN_DB_TESTS`)                     |
| `lint`                | OK                                                                      |
| `lint:md`             | 85 archivos, 0 issues                                                   |
| `format`              | Prettier: todos los archivos conformes                                  |
| `test` (web)          | 50 archivos passed; 514 passed, 2 expected fail                         |
| `test:scripts`        | 687 tests, 685 pass, 0 fail, 2 skipped                                  |
| `content:validate`    | OK, 1 build                                                             |
| `catalog:check`       | gen-catalog OK (10 maestrías, 45 pares)                                 |
| `catalog:nodes`       | 6 maestrías OK: 32 + 33 + 31 + 30 + 30 + 30 = 186 nodos                 |
| `check:locale-parity` | OK                                                                      |
| `assets:check`        | OK, 6 entradas                                                          |
| `check:contrast`      | OK, 12 pares, mínimo 4.5:1                                              |
| `build`               | OK; `emit-static-assets` 7 ficheros (árboles y `deferred.css`)          |
| `check:public-build`  | OK, 422 archivos                                                        |
| `check:performance`   | OK, 122/122 comprobaciones (incluye `/maestrias` y `/maestrias/<slug>`) |

Limitaciones declaradas: `pnpm verify` local no ejecuta los pasos e2e ni axe (`e2e:a11y`,
`e2e:journeys`); esos suites se corrieron en las tareas T013, T027, T030 y T033 y corren en CI. Las
pruebas con PostgreSQL real (`RUN_DB_TESTS=1`) quedaron saltadas aquí; se ejecutaron en T031 (449
passed + 1 expected fail).

## `speckit-analyze` (T021, solo lectura)

Skill: `.agents/skills/speckit-analyze/SKILL.md`. Sin hooks `before_analyze`/`after_analyze` en
`.specify/extensions.yml`. `check-prerequisites.ps1` solo resolvió la feature con
`SPECIFY_FEATURE_DIRECTORY` (no hay `.specify/feature.json`); `AVAILABLE_DOCS`: `research.md`,
`tasks.md`. No se modificó ningún archivo; los hallazgos se registran, no se corrigen aquí.

### Specification Analysis Report

| ID  | Categoría         | Severidad | Ubicación                      | Resumen                                                                                                                                                                               | Recomendación                                                                               |
| --- | ----------------- | --------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| C1  | Cobertura         | MEDIUM    | spec.md US2 esc. 1, tasks T014 | US2 promete cambiar de una maestría a otra «sin recargar la página completa»; ninguna tarea ni criterio de aceptación lo cubre (T014 pide solo seis tarjetas y «sin datos»).          | Aclarar si es navegación del router de Angular o recortar el texto de la historia.          |
| C2  | Cobertura         | MEDIUM    | plan.md Constitution Check I   | El plan promete «verificación editorial del catálogo» (principio I); no hay tarea que la registre (T007 valida estructura, no revisión editorial).                                    | Añadir criterio editorial a T021 o declarar que la verificación es la de T007/T025.         |
| C3  | Cobertura         | LOW       | spec.md FR-011/FR-012          | Las tareas no citan FR-011/FR-012 (transcripción de builds de terceros y `rights_status`); se cubren por el modelo de 001, no por una tarea de 003.                                   | Referenciar el modelo de derechos de 001 en spec o excluir ambos FR del alcance de 003.     |
| I1  | Inconsistencia    | MEDIUM    | plan.md «Project Structure»    | El plan lista `data-model.md` y `contracts/mastery-tree.md` como entregables de Fase 1 y no existen (solo `research.md`, `tasks.md`; `quickstart.md` nace ahora).                     | Crear los documentos o retirarlos del plan; el contrato real vive en `packages/domain`.     |
| I2  | Inconsistencia    | LOW       | plan.md cabecera, Estado       | «Constitución 1.9.0 + enmienda 1.10.0 en borrador» y «Nada se implementa sin orden» están obsoletos: la 1.10.0 está aprobada y las tareas están hechas.                               | Actualizar la cabecera y el estado.                                                         |
| I3  | Inconsistencia    | LOW       | spec.md cabecera               | `Estado: Borrador para aprobación` y base `e95c2f5` son anteriores a la implementación.                                                                                               | Actualizar estado y base.                                                                   |
| I4  | Inconsistencia    | LOW       | plan.md Fases                  | Fase 2 dice «`speckit-analyze` antes de implementar»; esta es la primera pasada y se hace al cierre (T021).                                                                           | Documentar que se ejecutó al cierre.                                                        |
| I5  | Inconsistencia    | LOW       | tasks.md Fase 4 y Ampliaciones | Las tareas no siguen el orden numérico (T033 entre T017 y T018; T026–T033 fuera de fase); T021 vive en la fase Cierre y las ampliaciones T022–T034 quedan fuera de la lista de fases. | Reordenar o aclarar el criterio.                                                            |
| A1  | Ambigüedad        | LOW       | tasks.md T021                  | «sobre la huella nueva» y «sin huecos» no son medibles.                                                                                                                               | Sustituir por el conjunto de archivos del diff de la rama y los comandos de este documento. |
| A2  | Ambigüedad        | LOW       | spec.md FR-003 vs plan.md      | FR-003 pone `game_version` en cada nodo; el plan y los fixtures la llevan en `source` del árbol.                                                                                      | Alinear FR-003 con el esquema real.                                                         |
| U1  | Subespecificación | LOW       | spec.md SC-004                 | Pide axe «con y sin JavaScript, en tres viewports»; `verify` local no lo ejecuta y la evidencia depende de `e2e:a11y` (T013/T027).                                                    | Citar el comando e2e en la evidencia de cierre.                                             |

Sin hallazgos de duplicación. **CRITICAL: 0. HIGH: 0.** Sin conflictos con la constitución 1.10.0:
VII (excepciones, manifiesto, fallback `ASSET_SOURCE`), X (EN/ES, docs de T019/T020), IV (cero
dependencias nuevas) y XII (sin secretos) quedan cubiertos por T015, T019, T020, T022, T029 y T033.

### Cobertura de requisitos (resumen)

| Requisito              | ¿Tarea? | Tareas                                       |
| ---------------------- | ------- | -------------------------------------------- |
| FR-001, FR-002, FR-004 | Sí      | T001, T006, T022, T025                       |
| FR-003, FR-005, FR-016 | Sí      | T005, T007                                   |
| FR-006, FR-015         | Sí      | T016, T018, T031                             |
| FR-007, SC-006         | Sí      | T004                                         |
| FR-008, FR-009, FR-010 | Sí      | T010, T011, T012                             |
| FR-011, FR-012         | Parcial | Modelo de derechos de 001 (ver C3)           |
| FR-013, FR-014         | Sí      | T015, T028, T029 (FR-013 es una restricción) |
| FR-017, SC-005         | Sí      | T013, T027, T030, T033                       |
| SC-001, SC-002, SC-003 | Sí      | T007, T006, T012                             |
| SC-004                 | Sí      | T011, T013, T027                             |
| SC-007                 | Sí      | T016, T018                                   |

Métricas: 17 FR + 7 SC = 24 requisitos; 34 tareas (T001–T034); cobertura ≥ 1 tarea: 22/24 (91,7 %;
FR-011/FR-012 parciales); ambigüedades: 2; duplicaciones: 0; críticos: 0.

### Próximas acciones

- Sin CRITICAL: se puede proceder a la puerta de cierre.
- C1, C2 e I1 (MEDIUM) son candidatos a una tarea posterior de limpieza de documentos; no bloquean.

## Verify final tras T035–T041 (B-001)

Fecha: 2026-11-15 (16:02–16:13, hora local). HEAD `bab5e34`. Comando: `pnpm verify` desde la raíz del
worktree de integración. Resultado: **`verify OK (local)`, exit 0** (`== pnpm verify exit 0`).

| Paso                  | Resultado                                                                     |
| --------------------- | ----------------------------------------------------------------------------- |
| `check-scope`         | OK, 246 archivos                                                              |
| `check-boundaries`    | OK, 334 archivos                                                              |
| `check-secrets`       | OK, 649 archivos rastreados                                                   |
| `check-ci-secrets`    | OK, 2 workflows                                                               |
| `domain:*`            | tests 281 passed, 2 expected fail (13 archivos)                               |
| `api:*`               | tests 340 passed, 1 expected fail, 126 skipped (24 archivos, 10 saltados)     |
| `test:rotation`       | 3 skipped (requiere PostgreSQL, sin `RUN_DB_TESTS`)                           |
| `lint`                | `ng lint`: All files pass linting                                             |
| `lint:md`             | 86 archivos, 0 issues                                                         |
| `format`              | Prettier: todos los archivos conformes                                        |
| `test` (web)          | 50 archivos passed; 514 passed, 2 expected fail                               |
| `test:scripts`        | 701 tests, 699 pass, 0 fail, 2 skipped                                        |
| `content:validate`    | OK, 1 build                                                                   |
| `catalog:check`       | gen-catalog OK (10 maestrías, 45 pares)                                       |
| `catalog:nodes`       | 6 maestrías OK                                                                |
| `check:locale-parity` | OK, 324 unidades en paridad, 0 fallos                                         |
| `assets:check`        | OK, 6 entradas                                                                |
| `check:contrast`      | OK, 12 pares, mínimo 4.5:1                                                    |
| `build`               | OK; `check:initial-js` OK en las 10 rutas                                     |
| `check:public-build`  | OK, 1267 archivos; valores y patrones ausentes                                |
| `check:performance`   | OK, 122/122 comprobaciones (13 rutas, mediana de 3 corridas; presupuestos OK) |

Extracto del final del log: `check:performance OK (122/122 comprobaciones; …)`, `verify OK (local)`.

Limitaciones: `pnpm verify` local no ejecuta e2e ni axe (`e2e:a11y`, `e2e:journeys`) y las pruebas con
PostgreSQL real (`RUN_DB_TESTS=1`) quedan saltadas; esas se ejecutaron en las tareas T031, T035, T039
y T040 y corren en CI.

## Puerta spec002 y T-136

Se ejecutan **tras marcar T021** (precedente spec002 T014). La evidencia va en
`specs/003-catalogo-arboles-maestria/reviews/` (fuera del snapshot que `prepare` firma). Su
resultado no se registra aquí.

## `prepare` tras marcar T021 y T034

`node scripts/spec-review.mjs prepare --feature specs/003-catalogo-arboles-maestria` (exit 0) y
`pnpm lint:md` (86 archivos, 0 issues):

```text
{"status":"ready","feature":"specs/003-catalogo-arboles-maestria","snapshot":"(se omite: cambia con cada edición)","pendingTasks":[],"excludedTasks":[],"reasons":[]}
```

El `snapshot` cambia con cada edición de la spec; el valor vigente lo recalcula la puerta de cierre.
