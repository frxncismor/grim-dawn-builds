# Análisis de consistencia (speckit-analyze) de spec005

**Fecha**: 2026-11-16 | **Artefactos**: `spec.md`, `plan.md`, `tasks.md` (más `research.md`, `data-model.md`, `quickstart.md`, `contracts/`) | **Modo**: solo lectura sobre el código; este informe es el único archivo escrito por la fase. Las correcciones de los hallazgos se aplicaron después en los artefactos de spec005 (columna «Resolución»).

`check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` devolvió `FEATURE_DIR` y los documentos `research.md`, `data-model.md`, `contracts/`, `quickstart.md` y `tasks.md`.

## Hallazgos

| ID | Categoría         | Severidad | Ubicación                 | Resumen                                                                                                                                   | Resolución                                                                                                                         |
| -- | ----------------- | --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| E1 | Cobertura         | HIGH      | `tasks.md` T001, FR-002   | Ninguna tarea nombraba FR-002 (helper compartido) aunque T001 lo implementa.                                                              | T001 cita FR-002. **Resuelto.**                                                                                                    |
| F1 | Inconsistencia    | HIGH      | `plan.md`, `tasks.md`     | Al añadir US6 el orden de IDs dejaba la puerta antes que las tareas de marca; el grafo y el reparto no coincidían.                         | Renumeradas: T014 marca (IMPL), T015 marca (UI), T018 puerta; grafo, reparto, cobertura y quickstart actualizados. **Resuelto.**   |
| F2 | Inconsistencia    | HIGH      | `plan.md` («Reparto»)     | La marca cruza áreas: `parity.test.mts` y `fixture-source.server.test.mts` viven en `apps/web` pero comprueban fixtures; registrar la prueba de marca toca `package.json`. | Excepciones de frontera acotadas declaradas en `plan.md` y `tasks.md`; dueño y orden (T014 antes que T015) fijados. **Resuelto.** |
| C1 | Cobertura         | MEDIUM    | FR-023                    | La imagen social `og/site.png` depende de un método de regeneración que no está en el repo.                                                | T015 exige regenerarla con el método de spec001 o declarar el bloqueo antes de marcar; riesgo en `plan.md`. **Resuelto (riesgo abierto).** |
| C2 | Cobertura         | MEDIUM    | `docs/content/*`          | La plantilla de petición de permiso a Crate y `source-policy.md` usan la marca antigua y no estaban en ninguna tarea.                      | Añadidos a T014. **Resuelto.**                                                                                                     |
| A1 | Ambigüedad        | MEDIUM    | SC-009                    | «0 apariciones» sin acotar: hay 39 archivos con la cadena fuera de `specs/`, entre ellos README, CONTRIBUTING y la constitución.            | Alcance explícito en «Fuera de alcance» y SC-009; el título de la constitución se cambia por su procedimiento (seguimiento). **Resuelto.** |
| I1 | Inconsistencia    | LOW       | SC-008, SC-009            | Criterios en orden inverso.                                                                                                                | Reordenados. **Resuelto.**                                                                                                         |
| I2 | Terminología      | LOW       | `spec.md`                 | «ver Q-X» seguía apuntando a preguntas ya respondidas.                                                                                     | Sustituido por «Q-X = A» y sección «Clarifications». **Resuelto.**                                                                 |
| F3 | Inconsistencia    | HIGH      | `tasks.md`, `plan.md` (orden) | La regresión visual (T017) debía ir después de la marca, de S4-D* y de las correcciones de la revisión de fidelidad; las correcciones no tienen IDs hasta que exista el informe. | T017 depende de T016 y de sus correcciones (IDs desde T019, reservados por el principal); FR-037 y el grafo lo fijan. **Resuelto.** |
| C3 | Cobertura         | MEDIUM    | US7, US8                  | La fidelidad usa un subagente con visión, que solo puede lanzar el orquestador UI (no el implementador); la regresión necesita el flujo de referencias en GitHub, que el agente no puede ejecutar (sin push). | T016 y T017 lo declaran en la aceptación y en el reparto; T017 indica que necesita permiso de Paco. **Resuelto (dependencia externa).** |
| A2 | Ambigüedad        | MEDIUM    | FR-033                    | «Tolerancia» sin valor.                                                                                                                      | Valores iniciales en `plan.md` («Regresión visual: diseño») y ajuste obligatorio en T017. **Resuelto.**                            |
| U1 | Subespecificación | LOW       | `tasks.md` T006           | La prueba de T006 exige `packages/domain` reconstruido.                                                                                    | Declarado en «Depende de» de T006. Sin más cambios.                                                                                |

Sin hallazgos CRITICAL. Sin conflictos con la constitución 1.11.0: US6 refuerza §VII (no afiliación) y §X (paridad EN/ES); ninguna tarea añade dependencias (§VIII).

## Cobertura de requisitos

| Requisito                  | Tarea(s)      | Notas                                         |
| -------------------------- | ------------- | --------------------------------------------- |
| FR-001 a FR-004            | T001          |                                               |
| FR-005, FR-008             | T002, T003    |                                               |
| FR-006, FR-007             | T004          |                                               |
| FR-009                     | T005          |                                               |
| FR-010                     | T006          |                                               |
| FR-011, FR-012             | T007          | Postgres real o declarar «solo CI».           |
| FR-013                     | T008          |                                               |
| FR-014                     | T009          |                                               |
| FR-015                     | T010          |                                               |
| FR-016                     | T011          |                                               |
| FR-017                     | T012          |                                               |
| FR-018, FR-019             | T013          |                                               |
| FR-023 a FR-027, FR-029    | T015          | UI; depende de T014.                          |
| FR-028                     | T014          | Implementación.                               |
| FR-030, FR-031, FR-032     | T016          | UI; el contraste lo hace un subagente de visión del orquestador UI. |
| FR-033 a FR-036            | T017          | UI.                                           |
| FR-037                     | T016, T017    | Orden.                                        |
| FR-020 a FR-022            | transversales | Verificadas en T018.                          |

## Elementos de deuda sin tarea

Ninguno. A-03 de spec003 queda fuera con evidencia (research R8: spec004 T005, `scripts/check-assets.mts:118`, `scripts/build-release.mts:87`).

## Métricas

- Requisitos funcionales: 37 (FR-001 a FR-037). Criterios de éxito: 11. Tareas: 18 (T001 a T018), más las correcciones de fidelidad (desde T019).
- Cobertura de requisitos con al menos una tarea: 100 % (37 de 37).
- Hallazgos: CRITICAL 0, HIGH 4 (resueltos), MEDIUM 5 (resueltos), LOW 3 (resueltos o aceptados).
- Ambigüedades abiertas: 0. Marcadores `NEEDS CLARIFICATION`: 0.

## Siguiente paso

Planificación cerrada. Implementar en orden: T001 (S4-D1), luego la cadena de implementación y la de UI en paralelo, T016 (fidelidad), sus correcciones, T017 (regresión visual) y T018 al final. Seguimiento fuera de spec005: renombrar el título de la constitución, README y CONTRIBUTING por su procedimiento.
