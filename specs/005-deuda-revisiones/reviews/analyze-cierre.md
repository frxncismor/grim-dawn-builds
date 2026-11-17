# Análisis de consistencia de cierre (speckit-analyze) de spec005

**Fecha**: 2026-11-17 | **HEAD de base**: `6131a8d` (rama `orq/11111619-rev-s5-t018`) | **Artefactos**: `spec.md`, `plan.md`, `tasks.md` (más `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `reviews/`, y la constitución 1.11.1) | **Modo**: solo lectura sobre los artefactos de spec; este informe es el único archivo escrito por el análisis. Es el segundo análisis de spec005: el primero (planificación, 2026-11-16) está en [analyze.md](analyze.md); este lo repite al cerrar, con las tareas T001–T017, T019–T035 ya hechas.

Se siguió `speckit-analyze` (pasadas de duplicación, ambigüedad, subespecificación, constitución, cobertura e inconsistencia). `.specify/extensions.yml` no se consultó como puerta: el análisis es manual sobre los artefactos. No se corrige nada: las recomendaciones quedan para quien decida.

## Resultado

**0 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW.** Ningún hallazgo bloquea el cierre. Sin conflictos con la constitución 1.11.1.

## Hallazgos

| ID  | Categoría      | Severidad | Ubicación                                                                               | Resumen                                                                                                                                                                                                                                                                                                                                                                                                    | Recomendación                                                                                                                                                                      |
| --- | -------------- | --------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | Inconsistencia | MEDIUM    | `spec.md` FR-034, US8 escenario 4, SC-011; `tasks.md` T017 y «Checkpoint F7»; `plan.md` | La spec exige que las referencias visuales se generen **solo en el entorno del CI (Linux)** y que SC-011 se cumpla con «dos ejecuciones consecutivas del CI». T017 las generó en Docker local (imagen `mcr.microsoft.com/playwright:v1.65.0-noble`, Ubuntu 24.04.5) por decisión de Paco y las dos pasadas verdes son de contenedores locales; el trabajo `visual-regression` aún no ha corrido en GitHub. | Registrar la excepción (Docker equivalente a CI) en FR-034 y SC-011, o ejecutar el flujo `visual-baselines` y dos veces `visual-regression` en GitHub cuando Paco permita el push. |
| I2  | Inconsistencia | MEDIUM    | `spec.md` FR-020 y SC-008; `plan.md` («Performance Goals», riesgos); `tasks.md` L90     | FR-020, SC-008 y el plan siguen midiendo `/tier-list` contra 111 206/112 000 B (794 B de margen). La Pregunta 32 de Paco (2026-11-17) fijó la nueva base en 111 292 B, pero solo consta en `tasks.md`. Medido hoy: 111 251 B (749 B de margen), por debajo de la base nueva.                                                                                                                               | Citar la decisión P32 en `spec.md` (SC-008) y `plan.md`, o declarar que `tasks.md` manda para la base.                                                                             |
| I3  | Inconsistencia | LOW       | `spec.md` «Fuera de alcance»; `tasks.md` T019; tabla de cobertura                       | La spec deja fuera «título de la constitución, README, CONTRIBUTING» (su renombre exige enmienda y «queda como seguimiento»), pero T019 (enmienda 1.11.1) los renombra. T019 no figura en la tabla requisito → tarea ni cita un FR.                                                                                                                                                                        | Ajustar «Fuera de alcance» y añadir T019 a la cobertura (p. ej. bajo FR-023/FR-025 o como tarea de apoyo).                                                                         |
| I4  | Inconsistencia | LOW       | `spec.md` FR-020; `tasks.md` Fase 9                                                     | FR-020 prohíbe cambios visibles «salvo la marca y el aviso de US6», pero las correcciones T020–T033 (FR-038 a FR-040 y los F-xx) cambian lo visible por decisión de Paco; FR-020 no las menciona.                                                                                                                                                                                                          | Reformular FR-020 como «salvo US6 y las correcciones de US7 aceptadas (FR-038 a FR-040)».                                                                                          |
| I5  | Terminología   | LOW       | `spec.md` Status; `plan.md` L5, L7, L31; `tasks.md` T018 «Depende de»                   | Estados y recuentos obsoletos: la spec dice «Sin código», el plan «clarify cerrado», «18 tareas» (hay 35) y «constitución 1.11.0» (vigente 1.11.1); T018 depende de «T001–T017 y T020–T033» pero el grafo incluye también T034 y T035. La cabecera de estado de `tasks.md` se actualiza en esta misma tarea.                                                                                               | Poner al día los estados y recuentos en la próxima edición; añadir T034 y T035 a «Depende de» de T018.                                                                             |
| A1  | Ambigüedad     | LOW       | `plan.md` «Regresión visual: diseño» (referencias); `tasks.md` T017                     | El plan estimaba 3–8 MB para las 30 referencias; miden 17 668 946 B (≈ 17,7 MB; el mayor, 1 461 468 B). El plan no registra el desvío; solo lo declara la nota de T017 y, desde T018, la aceptación de Paco (2026-11-17).                                                                                                                                                                                  | Actualizar la fila del plan con la cifra real y la decisión de Paco.                                                                                                               |

## Cobertura de requisitos

| Requisito               | Tarea(s)                          | Notas                                                          |
| ----------------------- | --------------------------------- | -------------------------------------------------------------- |
| FR-001 a FR-004         | T001                              |                                                                |
| FR-005, FR-008          | T002, T003                        |                                                                |
| FR-006, FR-007          | T004                              |                                                                |
| FR-009, FR-010          | T005, T006                        |                                                                |
| FR-011, FR-012          | T007                              | Probado con Postgres real (T007; repetido en T018: 474 pasan). |
| FR-013 a FR-017         | T008 a T012                       |                                                                |
| FR-018, FR-019          | T013                              |                                                                |
| FR-023 a FR-027, FR-029 | T015 (FR-027 también T034 y T035) |                                                                |
| FR-028                  | T014                              |                                                                |
| FR-030 a FR-032         | T016                              |                                                                |
| FR-033 a FR-036         | T017                              | Ver I1 (referencias generadas en Docker local).                |
| FR-037                  | T016, T017 (orden), T020 a T033   |                                                                |
| FR-038, FR-039, FR-040  | T023, T024, T033                  |                                                                |
| FR-020, FR-021, FR-022  | transversales                     | Verificadas en T018 (ver I4 para FR-020).                      |

## Éxito medible (SC) con trabajo construible

SC-001 a SC-011: los 11 tienen tarea o puerta que los mide (SC-001 T001; SC-002 T004; SC-003 T005; SC-004 T007; SC-005 T009; SC-006 T011; SC-007 y SC-008 `pnpm verify` y `check:performance` en T018; SC-009 T014, T015, T034 y T035; SC-010 T016; SC-011 T017, con la salvedad de I1).

## Conflictos con la constitución (1.11.1)

Ninguno. §IV (rendimiento): los presupuestos de JS y HTML siguen en verde (`/tier-list` 111 251/112 000 B; guía EN 117 333/120 000 B). §V (accesibilidad) y §X (paridad EN/ES): `check:locale-parity` 341 unidades en paridad, 0 fallos. §VII (derechos): aviso de no afiliación en el pie, sin arte nuevo del juego (`own` por defecto; `game` solo bajo las excepciones vigentes). §VIII (simplicidad): ninguna dependencia nueva. §IX (pruebas): cada tarea declara prueba roja primero. §XII (secretos): `check:secrets` y `check:ci-secrets` OK; el workflow nuevo `visual-baselines.yml` está dentro de los 3 workflows revisados.

## Tareas sin requisito

T019 (enmienda 1.11.1; ver I3). T018 es la puerta de cierre y cubre FR-020 a FR-022 de forma transversal.

## Métricas

- Requisitos funcionales: 40 (FR-001 a FR-040). Criterios de éxito: 11. Total: 51.
- Tareas: 35 (T001 a T035), 34 marcadas y T018 en curso al ejecutar este análisis.
- Cobertura de requisitos con al menos una tarea: 100 % (51 de 51).
- Ambigüedades: 1 (A1, LOW). Duplicaciones: 0. Marcadores `NEEDS CLARIFICATION`, `TODO` o `TBD`: 0.
- Hallazgos: CRITICAL 0, HIGH 0, MEDIUM 2, LOW 4.

## Siguiente paso

Sin CRITICAL: T018 puede marcarse y lanzar la puerta spec002 y T-136. I1 e I2 conviene resolverlos (o aceptarlos por escrito) antes del PR; no se corrigen en este análisis.
