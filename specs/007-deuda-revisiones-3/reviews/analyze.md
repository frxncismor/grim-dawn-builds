# Specification Analysis Report (speckit-analyze, planificación de spec007)

Fecha: 2026-11-18. Artefactos: `spec.md`, `plan.md`, `tasks.md` (más `research.md`, `data-model.md`, `quickstart.md`) y la constitución 1.11.1. `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` OK; `.specify/extensions.yml` sin hooks `before_analyze`/`after_analyze`. Análisis de solo lectura; las correcciones de la última columna se hicieron después, fuera de la fase, por el mismo agente de planificación, y se repitió el análisis una vez sobre el resultado (sin hallazgos nuevos).

| ID  | Category           | Severity | Location(s)                                                                                                | Summary                                                                                                                                                                                                                                                                                                                     | Recommendation                                                                                                                            | Estado                                                                              |
| --- | ------------------ | -------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| C1  | Constitution       | CRITICAL | `spec.md` FR-005 y «Assumptions»; `research.md` D3; `data-model.md` «Datos de la tarjeta»; `tasks.md` T002 | El diseño de B-002 metía la combinación en el idioma del contenido dentro de `srText`, que no lleva `lang`: el lector de pantalla la leería con la voz de la interfaz. Viola la constitución V (WCAG 2.2 AA, criterio 3.1.2 «idioma de las partes»), aunque solo en un caso que ninguna entrada real produce.               | Sin enlace, exponer la línea visible `.build-card__combination` (que ya lleva su `lang`) en lugar de `aria-hidden`; `srText` sin cambios. | Corregido (FR-005, Q2 de clarify, D3, data-model, T002 añade `build-card.ts:64-66`) |
| I1  | Inconsistency      | MEDIUM   | `quickstart.md` encabezados de US2–US4; `data-model.md` «Datos de la tarjeta»                              | Tras renumerar las tareas por orden de archivo, quickstart y data-model citaban los IDs anteriores (T003 por T002, T004 por T003, T002 por T004).                                                                                                                                                                           | Alinear con `tasks.md`.                                                                                                                   | Corregido                                                                           |
| U1  | Underspecification | MEDIUM   | `tasks.md` T003                                                                                            | «Prueba roja primero» no era verificable en una prueba de cobertura sin defecto de producto: el caso con claves reales pasa desde el principio.                                                                                                                                                                             | Definir el rojo como el control que hace fallar la unicidad con dos claves iguales, y registrar que el caso real pasa desde el principio. | Corregido                                                                           |
| I2  | Inconsistency      | LOW      | `research.md` D1–D5 frente a T001–T005                                                                     | Las decisiones siguen el orden de los elementos de la petición (D2 = T004, D3 = T002, D4 = T003), no el de las tareas.                                                                                                                                                                                                      | Cada tarea cita su decisión; sin efecto en la ejecución.                                                                                  | Aceptado                                                                            |
| DV1 | Deviation          | LOW      | `research.md` §R3, D4; `tasks.md` T003                                                                     | La petición pedía que `e2e/a11y.spec.ts` usara 2+ guías (fixture o artefacto de borradores). El artefacto de borradores no sirve (la portada solo lista guías publicadas) y una guía pública más cambia el sitio y las 30 referencias; se elige la vía más barata: prueba de componente con 3 guías y e2e que exige ≥ 1 id. | Informar al principal; reversible si prefiere un tercer artefacto e2e (§R3 c).                                                            | Aceptada por el principal (2026-11-18)                                              |
| DV2 | Deviation          | LOW      | `spec.md` Q1 de clarify; `research.md` §R5                                                                 | La petición pedía llevar la regla de B-002 «al dominio o al esquema»; el dominio no conoce tarjetas ni enlaces, así que se impone en `buildCardData` (punto único de todos los adaptadores), con la unión discriminada del tipo como plan B sin bytes.                                                                      | Informar al principal.                                                                                                                    | Aceptada por el principal (2026-11-18)                                              |
| U2  | Underspecification | LOW      | `tasks.md` T004                                                                                            | Tarea de solo comentarios sin prueba roja (FR-015).                                                                                                                                                                                                                                                                         | Declararlo en la evidencia; `git diff -U0` limitado a líneas de comentario.                                                               | Aceptado (ya en la aceptación)                                                      |

**Coverage Summary Table:**

| Requirement Key        | Has Task? | Task IDs   | Notes                                      |
| ---------------------- | --------- | ---------- | ------------------------------------------ |
| FR-001 – FR-004        | Sí        | T001       | Pruebas con _junction_ y enlace de archivo |
| FR-005 – FR-007        | Sí        | T002       | Medida de `/tier-list` y capturas          |
| FR-008 – FR-010        | Sí        | T003       | Control no vacuo                           |
| FR-011, FR-012, FR-014 | Sí        | T005       | Solo docs                                  |
| FR-013                 | Sí        | T004       | Solo comentarios                           |
| FR-015                 | Sí        | T001–T003  | T004 y T005 sin código ejecutable          |
| FR-016                 | Sí        | T006       |                                            |
| FR-017                 | Sí        | todas      | Restricción                                |
| SC-001                 | Sí        | T001       |                                            |
| SC-002                 | Sí        | T002       |                                            |
| SC-003                 | Sí        | T003       |                                            |
| SC-004                 | Sí        | T004, T005 |                                            |
| SC-005                 | Sí        | T002, T006 |                                            |
| SC-006                 | Sí        | T006       |                                            |

**Constitution Alignment Issues:** C1 (V, WCAG 3.1.2), corregido antes de cerrar la planificación. Tras la corrección: IV presupuesto medido en T002; V T002/T003; VII T001; IX pruebas rojas; X sin cadenas nuevas.

**Unmapped Tasks:** ninguna (T006 = FR-016).

**Metrics:**

- Total Requirements: 17 FR + 6 SC
- Total Tasks: 6 (3 de implementación, 3 de UI)
- Coverage: 100 % (23 de 23)
- Ambiguity Count: 0 (sin marcadores ni placeholders)
- Duplication Count: 0
- Critical Issues Count: **1 encontrado, 0 abiertos** (1 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW; CRITICAL y MEDIUM corregidos)

**Next Actions:** sin CRITICAL, HIGH ni MEDIUM abiertos tras una corrección y una repetición del análisis: se puede implementar. Implementación empieza por T001 (y T004); UI por T002, T003 y T005 en paralelo; T006 al final. DV1 y DV2 se comunican al principal.
