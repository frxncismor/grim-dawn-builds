# Specification Analysis Report (speckit-analyze, planificación de spec009)

Fecha: 2026-11-18. Artefactos: `spec.md`, `plan.md`, `tasks.md` (más `research.md`, `data-model.md`, `quickstart.md`) y la constitución 1.11.1 (T002 la enmienda a 1.12.0). `check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` OK (`research.md`, `data-model.md`, `quickstart.md`, `tasks.md`); `.specify/extensions.yml` sin hooks `before_analyze`/`after_analyze`; `node scripts/spec-review.mjs prepare --feature specs/009-rediseno-completo-ui` lee las 21 tareas (`pending-tasks`, T-001…T-021, sin exclusiones). Análisis de solo lectura; las correcciones de la última columna se hicieron después, fuera de la fase, por el mismo agente de planificación, y se repitió el análisis una vez (sin hallazgos nuevos).

| ID  | Category           | Severity | Location(s)                                                   | Summary                                                                                                                                                                                                                         | Recommendation                                                                                                                       | Estado                                                     |
| --- | ------------------ | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| P1  | Parsing            | HIGH     | `tasks.md` T020                                               | La aceptación citaba literal la marca de aplazamiento entre corchetes; `spec-review.mjs` la tomaba como disposición de T020 y `prepare` devolvía `invalid task disposition for T-020`: la puerta de cierre no habría podido correr. | Describir la marca sin el literal entre corchetes.                                                                                   | Corregido; `prepare` lee 21 tareas                          |
| C1  | Constitution       | MEDIUM   | `tasks.md` T003; constitución §VII                            | Las propuestas visuales piden capturas de la cabecera con `ASSET_SOURCE=game`, pero la portada del juego no está cubierta por §VII hasta T002 y no se incorpora hasta T007 (tras el OK).                                        | La cabecera de las propuestas usa el fallback propio o una candidata solo local, ni versionada ni servida.                            | Corregido (T003)                                            |
| I1  | Inconsistency      | MEDIUM   | `spec.md` FR-011 frente a FR-012 y US5                        | FR-011 ponía el changelog tras las notas; FR-012/US5 exigen que las notas sean la última sección de contenido antes de fuentes/atribución.                                                                                     | Changelog como metadato junto a fuentes/atribución.                                                                                  | Corregido (FR-011, T016)                                    |
| I2  | Inconsistency      | MEDIUM   | `spec.md` «Edge Cases»                                        | Conservaba casos de 010 (búsqueda sin resultados) y de 011 (equipo) tras recortar el alcance.                                                                                                                                  | Mover la búsqueda a §6 (010) y quitar el equipo de la lista de 009.                                                                  | Corregido                                                   |
| I3  | Inconsistency      | MEDIUM   | `research.md` D3 frente a FR-033                              | D3 fijaba los valores de la paleta antes del punto de aprobación visual.                                                                                                                                                       | Los valores de §4 son punto de partida; mandan los de la propuesta aprobada en T004.                                                 | Corregido                                                   |
| DV1 | Deviation          | MEDIUM   | `tasks.md` «Dependencia dura»; `plan.md` reparto              | El encargo lista lo que puede ir antes del OK visual (corrección árbol/mapa, enmienda, registro, tokens en modo propuesta). El plan permite además el contrato de datos T005–T006 (dominio, BD y API), que no es tarea de página. | Informar al orquestador; si no se acepta, T005–T006 pasan a depender de T004 (sin otros cambios).                                     | Pendiente de aceptación del orquestador                     |
| U1  | Underspecification | LOW      | `tasks.md` T001                                               | El mecanismo exacto de la corrección en `pnpm start` queda abierto («o un script de arranque equivalente»): depende de lo que reproduzca.                                                                                        | Aceptado: la aceptación fija el resultado observable (200 y estilos) y la prueba de regresión.                                      | Aceptado                                                    |
| U2  | Underspecification | LOW      | `tasks.md` T007; `research.md` D6                             | La textura de origen de las portadas no está elegida; la documenta T007 y la valida Paco en T019.                                                                                                                              | Aceptado; fallback propio siempre disponible.                                                                                       | Aceptado                                                    |
| T1  | Terminology        | LOW      | `spec.md` §6                                                  | Los IDs FR-015–FR-023, FR-026, FR-027, FR-029 y SC-002 quedan en §6 sin tarea en 009.                                                                                                                                          | Aceptado: se conservan para la trazabilidad de 010–013 y no se reutilizan.                                                           | Aceptado                                                    |
| G1  | Governance         | LOW      | `tasks.md` T002                                               | Una enmienda de la constitución debía usar el flujo de Spec Kit.                                                                                                                                                               | T002 usa el skill `speckit-constitution`.                                                                                            | Corregido                                                   |
| DV2 | Deviation          | LOW      | `tasks.md` T020; `research.md` D9                             | El encargo preveía pedir IDs T-NNN de spec001; el registro se hace como tarea de spec009 sobre entradas existentes, sin IDs nuevos.                                                                                              | Informar al orquestador (no hace falta pedir IDs al principal).                                                                      | Informado                                                   |

**Coverage Summary Table:**

| Requirement Key        | Has Task? | Task IDs               | Notes                                   |
| ---------------------- | --------- | ---------------------- | --------------------------------------- |
| FR-001                 | Sí        | T003, T008, T009       | Tras la aprobación visual               |
| FR-002                 | Sí        | T011–T015              |                                         |
| FR-003                 | Sí        | T010                   |                                         |
| FR-004                 | Sí        | T007, T011, T014       | Constelaciones y objetos en 010/011     |
| FR-005                 | Sí        | T017, T018             |                                         |
| FR-006, FR-007         | Sí        | T005, T011             |                                         |
| FR-008                 | Sí        | T012                   |                                         |
| FR-009                 | Sí        | T005, T006, T014       | Equipo en 011                           |
| FR-010                 | Sí        | T013                   |                                         |
| FR-011, FR-012, FR-014 | Sí        | T016                   |                                         |
| FR-013                 | Sí        | T015                   |                                         |
| FR-024, FR-025         | Sí        | T001                   | Primera tarea                           |
| FR-028                 | Sí        | T009–T019, T018        | Puertas de accesibilidad bloqueantes    |
| FR-030                 | Sí        | T020                   |                                         |
| FR-031                 | Sí        | todas                  | Restricción                             |
| FR-032                 | Sí        | T002, T007             |                                         |
| FR-033                 | Sí        | T003, T004, T009       | Dependencia dura en el grafo            |
| SC-001                 | Sí        | T011, T016, T018       |                                         |
| SC-003                 | Sí        | T001, T019             |                                         |
| SC-004                 | Sí        | T017, T018             |                                         |
| SC-005                 | Sí        | T018                   |                                         |
| SC-006                 | Sí        | T001, T019, T021       | Informativo (P43)                       |
| SC-007                 | Sí        | T019                   |                                         |
| SC-008                 | Sí        | T003, T004             |                                         |

**Dependencia de la aprobación visual (FR-033)**: verificada en `tasks.md` («Dependencia dura», grafo y «Depende de» de cada tarea): T007–T019 dependen de T004 directa o transitivamente (T007, T008, T009, T011–T015 directamente; T010 por T009; T016–T019 por T011–T015). Antes de T004 solo pueden avanzar T001, T002, T003, T020 y, por DV1, T005–T006.

**Constitution Alignment Issues:** C1 (§VII, portada antes de la enmienda), corregido. IV: presupuestos informativos por decisión expresa de Paco (P43) y CI verde exigida en 013: no es una violación. VII: T002 precede a T007. V: puertas de accesibilidad bloqueantes en cada tarea UI.

**Unmapped Tasks:** T004 (checkpoint, FR-033/SC-008), T020 (FR-030), T021 (cierre): todas mapeadas.

**Metrics:**

- Total Requirements: 21 FR de 009 + 7 SC de 009 (más 11 FR y 1 SC registrados en §6 para 010–013)
- Total Tasks: 21 (14 UI, incluido el checkpoint T004; 5 IMPL; 2 DOCS)
- Coverage: 100 % de los requisitos de 009
- Ambiguity Count: 0 marcadores; 2 LOW aceptados (U1, U2)
- Duplication Count: 0
- Critical Issues Count: **0 CRITICAL**; 1 HIGH, 4 MEDIUM y 1 desviación MEDIUM encontrados; **0 HIGH y 0 MEDIUM de defecto abiertos** (DV1 pendiente de aceptación del orquestador); LOW registrados.

**Next Actions:** sin CRITICAL ni HIGH abiertos: se puede implementar en cuanto el orquestador acepte DV1 (o la revierta). Empezar por T001 (UI), T003 (UI, propuestas), T002 y T020 (DOCS) y T005 → T006 (IMPL); ninguna tarea de página antes del OK de Paco en T004.
