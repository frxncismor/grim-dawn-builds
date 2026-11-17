# Specification Analysis Report (speckit-analyze, planificación de spec006)

Fecha: 2026-11-17. Artefactos: `spec.md`, `plan.md`, `tasks.md` (más `research.md`, `data-model.md`, `quickstart.md`) y la constitución 1.11.1. `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` OK; `.specify/extensions.yml` sin hooks `before_analyze`/`after_analyze`. Análisis de solo lectura; las correcciones de la última columna se hicieron después, fuera de la fase, por el mismo agente de planificación.

| ID | Category | Severity | Location(s) | Summary | Recommendation | Estado |
| -- | -------- | -------- | ----------- | ------- | -------------- | ------ |
| I1 | Inconsistency | MEDIUM | `research.md` §R12 «Coste» frente a D4 y `plan.md` (T005) | §R12 propone mover la poda entera después de `writeContentRows`; D4 descubre que eso choca con `catalog_skill_nodes_grid_cell_uq` y la parte en dos. | Remitir §R12 a D4. | Corregido |
| I2 | Inconsistency | LOW | `quickstart.md` «US2 y US3»; `plan.md` Technical Context (Testing) | Citan `sh scripts/visual-baselines-docker.sh check` como si fuera un comando del host; T006 cambia cómo se invoca. | Citar «el procedimiento vigente de `CONTRIBUTING.md`». | Corregido |
| U1 | Underspecification | MEDIUM | `tasks.md` T006 | La prueba de `scripts/visual-baselines-docker.test.mts` es estática (lee el texto del script y de `CONTRIBUTING`); la frontera real solo la prueba Docker. | Mantener la ejecución real en Docker como evidencia obligatoria (ya dice «Sin Docker, no se marca»). | Aceptado |
| U2 | Underspecification | LOW | `tasks.md` T002 | El determinismo entre builds se prueba con dos `pnpm build` (lento); no hay comprobación automática en `pnpm verify`. | Suficiente para LOW de origen; `compare:builds` queda como está (fuera de CI, decisión de spec005). | Aceptado |
| C1 | Coverage | LOW | `spec.md` SC-006, `tasks.md` T006 | SC-006 («regresión visual con las referencias actuales») también aplica a T006, que toca el procedimiento. | T006 ya exige `check` 30 passed y `git status` limpio en `e2e/visual-baselines`. | Sin cambios |
| F1 | Inconsistency | LOW | `spec.md` Edge Cases (1.ª viñeta) | Redacción densa sobre en qué modos aplica el criterio de vacío. | Coherente con D1 y FR-002/FR-003; sin efecto en tareas. | Sin cambios |

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
| --------------- | --------- | -------- | ----- |
| FR-001 – FR-005 | Sí | T001 | Prueba roja de `assertNoGamePortraits` |
| FR-006, FR-007 | Sí | T002 | |
| FR-008, FR-009 | Sí | T003 | |
| FR-010 | Sí | T002, T003 | Medida de `/tier-list` y capturas |
| FR-011 – FR-014 | Sí | T004 | |
| FR-015 | Sí | T005 | Postgres real |
| FR-016 | Sí | T006 | Docker real |
| FR-017 | Sí | T007 | |
| FR-018 | Sí | T001–T003, T005–T007 | T004 solo docs |
| FR-019 | Sí | T008 | |
| FR-020 | Sí | todas | Restricción |
| SC-001 – SC-007 | Sí | T001–T007 | |

**Constitution Alignment Issues:** ninguno (IV presupuesto medido en T002/T003; VII T001; IX pruebas rojas; XII T006).

**Unmapped Tasks:** ninguna (T008 = FR-019).

**Metrics:**

- Total Requirements: 20 FR + 7 SC
- Total Tasks: 8
- Coverage: 100 % (27 de 27)
- Ambiguity Count: 0 (sin marcadores ni placeholders)
- Duplication Count: 0
- Critical Issues Count: **0** (0 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW)

**Next Actions:** sin CRITICAL ni HIGH: se puede implementar empezando por T001. I1 e I2 corregidos; U1, U2, C1 y F1 aceptados sin cambios.
