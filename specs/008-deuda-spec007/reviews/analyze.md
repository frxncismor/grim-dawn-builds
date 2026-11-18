# Specification Analysis Report (speckit-analyze, planificación de spec008)

Fecha: 2026-11-18. Artefactos: `spec.md`, `plan.md`, `tasks.md` (más `research.md`, `data-model.md`, `quickstart.md`) y la constitución 1.11.1. `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` OK; `.specify/extensions.yml` sin hooks `before_analyze`/`after_analyze` (solo `after_implement`). Análisis de solo lectura; las correcciones de la última columna se hicieron después, fuera de la fase, por el mismo agente de planificación, y se repitió el análisis una vez sobre el resultado (sin hallazgos nuevos).

| ID  | Category           | Severity | Location(s)                                                                            | Summary                                                                                                                                                                                                                              | Recommendation                                                                                                                                              | Estado                                                                     |
| --- | ------------------ | -------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| U1  | Underspecification | MEDIUM   | `tasks.md` T001; `plan.md` reparto; `research.md` R8-D1                                | T001 (UI, en paralelo con T002) marcaba «Cerrada por spec008» la entrada S-003 = A-002 de `deuda.md` de spec007 antes de que existiera el código de T002–T003: un cierre sin evidencia.                                              | T001 cierra solo las entradas 1–2 de la ronda 2; S-003 y la entrada 3 las cierra T004 tras integrar T002–T003.                                              | Corregido (T001, T004, plan, research R8-D1, quickstart, cobertura FR-008) |
| I1  | Inconsistency      | LOW      | `research.md` §R2; `tasks.md` T001                                                     | Al añadir la fila de spec008 en `specs/README.md` durante la planificación, la sección de spec007 pasó de `:61-67` a `:62-68`.                                                                                                       | Citar la línea vigente y la de `1375dda`.                                                                                                                   | Corregido                                                                  |
| A1  | Ambiguity          | LOW      | `spec.md` US1, FR-001–FR-006                                                           | «Recorrido» y «lectura» se usan a la vez.                                                                                                                                                                                            | «Lectura» = una lectura del directorio (la métrica de SC-001); «recorrido» = el proceso de la puerta. Definido en data-model.                               | Aceptado                                                                   |
| Q1  | Spec quality       | LOW      | `spec.md` (nombres `browser/`, `buildCardData`, `specs/README.md`)                     | La spec nombra carpetas, archivos y una función.                                                                                                                                                                                     | Precedente de spec005–spec007: la deuda es el propio artefacto o la desviación se llama así (nota del checklist).                                           | Aceptado                                                                   |
| U2  | Underspecification | LOW      | `tasks.md` T001                                                                        | Tarea de solo docs sin prueba roja (FR-011).                                                                                                                                                                                         | Declararlo en la evidencia; `git diff --stat` limitado a los archivos previstos.                                                                            | Aceptado (ya en la aceptación)                                             |
| C1  | Coverage           | LOW      | `tasks.md` T004                                                                        | La regresión visual no es obligatoria en el cierre.                                                                                                                                                                                  | Ningún archivo de `apps/` cambia; T004 lo declara.                                                                                                          | Aceptado                                                                   |
| R1  | Residual risk      | LOW      | `research.md` §R4; `scripts/check-assets.mts:198`, `scripts/check-legacy-brand.mts:39` | Entre la lectura validada y el `readFile` de cada página, un archivo podría sustituirse por un enlace (TOCTOU). La lectura única cierra el hueco del listado, no el del contenido.                                                   | Aplazado con motivo: teórico, el artefacto es local, lo genera el propio build y no cambia mientras corren las puertas.                                     | Aplazado (sin tarea; registrado en research §R4)                           |
| S1  | Scope              | LOW      | `spec.md` «Fuera de alcance»; `research.md` §R4 c, §R5                                 | El encargo dice «cualquier otra puerta que hoy recorra el artefacto»: el escaneo de secretos, la huella del release y el comparador de builds quedan fuera, y la lectura compartida por las tres puertas de `build-release` también. | Comunicar al principal: esas lecturas ya validan en su única lectura (sin el defecto de S-003); ampliarlo cambiaría sus mensajes o la firma de las puertas. | Informado al principal (reporte)                                           |

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs   | Notes                               |
| --------------- | --------- | ---------- | ----------------------------------- |
| FR-001          | Sí        | T002       | Espía de lecturas                   |
| FR-002          | Sí        | T003       | Espía de lecturas, `own` y `game`   |
| FR-003, FR-004  | Sí        | T002, T003 | Caracterización de mensajes exactos |
| FR-005, FR-006  | Sí        | T003       | `git diff --stat`                   |
| FR-007          | Sí        | T001       | `erratum.md`                        |
| FR-008          | Sí        | T001, T004 | Ronda 2 en T001; S-003 en T004      |
| FR-009          | Sí        | T001, T004 | spec007 en T001; spec008 en T004    |
| FR-010          | Sí        | T001       | Restricción para todas              |
| FR-011          | Sí        | T002, T003 | T001 sin código                     |
| FR-012          | Sí        | T004       |                                     |
| FR-013          | Sí        | todas      | Restricción                         |
| SC-001          | Sí        | T002, T003 | 2 → 1 y 4 → 1                       |
| SC-002          | Sí        | T002, T003 |                                     |
| SC-003          | Sí        | T001       |                                     |
| SC-004          | Sí        | T004       |                                     |

**Constitution Alignment Issues:** ninguno. VI (criterio único en `scripts/artifact-pages.mts`), VII (la puerta «sin arte del juego» examina lo que validó), VIII (sin dependencias), IX (rojo con el espía) y la calidad de documentación (`lint:md`) cubiertos.

**Unmapped Tasks:** ninguna (T004 = FR-012).

**Metrics:**

- Total Requirements: 13 FR + 4 SC
- Total Tasks: 4 (1 de docs de UI, 2 de implementación, 1 de cierre)
- Coverage: 100 % (17 de 17)
- Ambiguity Count: 1 (A1, LOW, aceptado); 0 marcadores ni placeholders
- Duplication Count: 0
- Critical Issues Count: **0** (0 CRITICAL, 0 HIGH, 1 MEDIUM corregido, 7 LOW: 1 corregido, 4 aceptados, 1 aplazado con motivo, 1 informado)

**Next Actions:** sin CRITICAL, HIGH ni MEDIUM abiertos tras una corrección y una repetición del análisis: se puede implementar. UI empieza por T001; implementación por T002 y después T003; T004 al final. S1 se comunica al principal.
