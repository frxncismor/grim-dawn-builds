---
description: "Implementation tasks for portable spec completion reviews"
---

# Tasks: Revisiones al cierre de una spec

**Input**: Design documents from `/specs/002-spec-completion-reviews/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/review-gate.md
**Tests**: Solicitadas en FR-012; primero casos de puerta/huella, después helper.
**Organization**: Una tarea a la vez; US1 revisores, US2 invocación, US3 evidencia.

## Format: `[ID] [P?] [Story] Description`

- `[P]` indica independencia de archivos, no autorización para implementar varias
  tareas simultáneamente. No hay tareas UI.
- Rutas relativas a raíz. No modificar otros archivos sin regularizar antes SDD.
- Las casillas se marcan solo tras pasar la aceptación de cada tarea; el hook
  posterior conserva la decisión separada de si la spec está completa.

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Comprobar el formato de hook oficial contra `.agents/skills/speckit-implement/SKILL.md` y registrar procedencia/capacidades reales en `specs/002-spec-completion-reviews/research.md`; aceptación: confirmar `after_implement`, obligatorio sin condition y fallback sin router, sin editar el skill generado ni afirmar extensión instalada. Verificado leyendo el skill instalado y registrando en `research.md` los requisitos y el límite de capacidad del harness.

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Crear pruebas significativas en `scripts/spec-review.test.mjs` para el contrato prepare/check de `specs/002-spec-completion-reviews/contracts/review-gate.md`: spec incompleta moderna y legacy sin checkbox con sufijos, disposición explícita frente a sección futura, artefactos ausentes, IDs duplicados, cuatro resultados obligatorios, not-run/failed, identidad/independencia, CRITICAL/HIGH, MEDIUM/LOW y reporte obsoleto por archivo rastreado/nuevo/eliminado; aceptación: `node --test scripts/spec-review.test.mjs` falla por helper ausente, no por fixtures inválidos. Los fixtures no cuentan como revisiones reales. Verificado: `node --test scripts/spec-review.test.mjs` falla únicamente en la aserción explícita de que falta `scripts/spec-review.mjs`; los 8 escenarios contractuales quedan skips intencionales hasta T010.

## Phase 3: User Story 1 - Revisores portables (Priority: P1)

**Goal**: Cuatro skills útiles sin dependencia de proveedor.
**Independent Test**: Un pase sobre cambios de ejemplo devuelve evidencia válida
sin modificar aplicación; cero hallazgos se permite con cobertura/limitaciones.

- [x] T003 [P] [US1] Crear `.agents/skills/review-code/SKILL.md` con skill-creator: revisar corrección, regresiones, errores y pruebas respecto a spec/tarea; exigir evidencia/ruta/línea, no cambiar app ni afirmar ejecución no realizada; aceptación: quick_validate.py del skill pasa y FR-002/003/011 son aplicables sin herramientas de proveedor. Verificado con quick_validate.py: `Skill is valid!`.
- [x] T004 [P] [US1] Crear `.agents/skills/review-architecture/SKILL.md`: comprobar fronteras web/API/domain, fuente de verdad, SSR, alcance y dependencias según constitución/plan sin rediseñar ni ampliar alcance; aceptación: quick_validate.py pasa y resultados usan el contrato común con hallazgos sustentados o ninguno. Verificado con quick_validate.py: `Skill is valid!`.
- [x] T005 [P] [US1] Crear `.agents/skills/review-security/SKILL.md`: revisar trust boundaries, validación/roles, publicación/derechos, secretos y despliegue aplicables; no red ni pruebas destructivas ni copiar valores secretos; aceptación: quick_validate.py pasa y comunica limitaciones de DAST/auditoría sin suplantarlos. Verificado con quick_validate.py: `Skill is valid!`.
- [x] T006 [P] [US1] Crear `.agents/skills/review-best-practices/SKILL.md`: revisar mantenibilidad/SOLID proporcional, duplicación, accesibilidad/rendimiento/documentación solo donde aplique y calidad de verificación; aceptación: quick_validate.py pasa sin imponer refactors ajenos ni inventar defectos por estilo. Verificado con quick_validate.py: `Skill is valid!`.

## Phase 4: User Story 2 - Invocación al cierre (Priority: P1)

**Goal**: El flujo despacha cuatro pases reales cuando todas las tareas activas
están verificadas y comunica capacidades del harness.
**Independent Test**: Sesión con tareas pendientes no revisa; sesión lista carga
coordinador por hook y espera cuatro resultados reales o queda pendiente.

- [x] T007 [US2] Crear `.agents/skills/speckit-review-complete/SKILL.md` con el flujo del contrato: prepare antes de despacho, contexto SDD completo, cuatro pases/espera, delegación independiente cuando disponible y cuatro pases self-review con capabilityReason sin subagentes; consolidar JSON y check, sin corregir app ni marcar tareas; aceptación: quick_validate.py pasa y un reporte faltante/not-run nunca se interpreta como revisión ejecutada (FR-004–006/009). Verificado con quick_validate.py: `Skill is valid!`; el flujo exige prepare, no fabrica resultados y falla cerrado si falta capacidad/evidencia.
- [x] T008 [US2] Registrar el hook local obligatorio `speckit.review.complete` en `.specify/extensions.yml`, `hooks.after_implement`, `enabled: true`, `optional: false`, sin condition ni installed ficticio; aceptación: estructura coincide con contrato oficial, resolución a `.agents/skills/speckit-review-complete/SKILL.md` documentada y hook existente preservado si apareciera. Verificado: YAML se parsea, registro coincide exactamente con el contrato, no hay condición ni extensión ficticiamente instalada y existe el skill de destino.
- [x] T009 [US2] Integrar la puerta mediante enlaces en `AGENTS.md`, `.github/copilot-instructions.md` y `CONTRIBUTING.md`; aceptación: los tres exigen revisión antes de declarar spec completa, explican fallback sin router/hook y propagación al delegar, sin prometer automatismo universal ni modificar políticas de PR/modelos/SDD (FR-010). Verificado por lectura de los tres archivos: enlazan el coordinador/spec, describen fallback explícito, propagación SDD y cierre pendiente sin atribuir soporte universal.

## Phase 5: User Story 3 - Evidencia vigente y gate (Priority: P2)

**Goal**: Evaluación local reproducible que no simula juicio semántico.
**Independent Test**: Reporte parcial o huella antigua no pasa; cuatro resultados
completos vigentes sin bloqueos y con disposiciones válidas pasan.

- [x] T010 [US3] Implementar `scripts/spec-review.mjs` sin dependencias, importable y con CLI prepare/check según contrato/data-model: exactamente cuatro especialidades; schemaVersion 1; snapshot SHA-256 64 hex; identidades no vacías; modo independent/self-review y capabilityReason conforme capacidad; coverage no vacía; status completed/failed/not-run; severidad CRITICAL/HIGH/MEDIUM/LOW; resolución con referencia SDD y deferReason solo para MEDIUM/LOW; rutas contenidas y línea positiva; aceptación: pasan pruebas T002, detecta pending legacy y no genera resultados LLM ni modifica aplicación. Verificado: `node --test scripts/spec-review.test.mjs` pasa (9/9); helper no tiene dependencias externas ni genera informes.
- [x] T011 [US3] Completar en `scripts/spec-review.test.mjs` escenarios de independencia falsa, datos mal formados, escapes de ruta/symlink, exclusión de reports/puntero local y lectura de archivos nuevos no ignorados; aceptación: `node --test scripts/spec-review.test.mjs` pasa y cambiar una ruta o bytes elegibles invalida reporte; ignorados no se leen ni aparecen secretos de fixtures en salida. Verificado: `node --test scripts/spec-review.test.mjs` pasa 13/13, incluidas ruta traversal, junction/symlink de directorio, snapshot por archivo nuevo/editado/eliminado, ignorados y exclusiones de informe/puntero.

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T012 Validar cinco skills con quick_validate.py y nuevos Markdown con el comando focalizado de `specs/002-spec-completion-reviews/quickstart.md`; registrar resultados reales en ese archivo, sin declarar resueltos problemas ajenos de lint del repo; aceptación: validadores focalizados pasan, sin desactivar reglas semánticas. Verificado: los cinco `quick_validate.py` pasan; markdownlint local reporta 38 archivos y 0 problemas. `pnpm exec` vía Corepack falló por keyid local y se documentó; binario local equivalente pasó.
- [x] T012a Corregir los tres fallos nuevos reproducidos después de T012, antes de T013: añadir primero pruebas de regresión en `scripts/spec-review.test.mjs` que fallen por checked bold `- [x] **T-051**`/`- [X] **T-066a**`, reemplazos T-071/T-055 y JSON mal formado cuyo valor sintético privado nunca aparezca en stdout/stderr; corregir mínimamente `scripts/spec-review.mjs` manteniendo pending-review con causa fija saneada y rechazo de variantes inválidas; ajustar `.agents/skills/review-code/SKILL.md`, `.agents/skills/review-architecture/SKILL.md`, `.agents/skills/review-security/SKILL.md`, `.agents/skills/review-best-practices/SKILL.md` y `.agents/skills/speckit-review-complete/SKILL.md` para usar el modelo/contrato canónicos `specs/002-spec-completion-reviews/{data-model.md,contracts/review-gate.md}` en todas las features; aceptación: pruebas de regresión fallan antes y toda la suite pasa después, prepare sobre 001 deja de fallar por esos formatos y conserva tareas activas pendientes, los cinco skills pasan quick_validate.py/markdownlint y una validación contextual sobre feature sin contrato Review propio resuelve los artefactos canónicos de 002; registrar evidencia real en `specs/002-spec-completion-reviews/quickstart.md` sin sobrescribir la histórica ni marcar T013/T014 por pruebas anteriores. FR-001/004/011/012.
- [x] T013 Ejecutar validación conductual real de coordinador/revisores sobre un espacio temporal según `specs/002-spec-completion-reviews/quickstart.md`, incluyendo defecto real, cambio documental sin hallazgos, hook dispatch/fallback y modo sin subagentes; con subagentes disponibles usar evaluador independiente sin solución esperada; registrar evidencia saneada en quickstart; aceptación: cuatro resultados reales, tareas incompletas no despachan, sin mutar aplicación, independencia honesta y reporte ausente no cierra. Si falta capacidad, registrar explícitamente escenario pendiente, no marcar esta tarea completa sin validación. Depende de T012a verificada; la evidencia conductual previa solo acredita el estado que realmente evaluó. **Estado 2026-11-12: hecha.** Fixture temporal con tres raíces: `pending-tasks` sin despacho (T-002), defecto real con cuatro pases `completed` y `check blocked` por 4 CRITICAL/HIGH, cambio documental con cero hallazgos y `check passed`; hook registrado pero sin router en OpenCode, con fallback explícito a `SKILL.md`; modo con delegación externa `blocked` por 3 CRITICAL/HIGH; solo se escribió `reviews/**`, con hashes y snapshot idénticos. Evidencia en `quickstart.md` §T013; límites de auto-revisión y delegación externa declarados. FR-001/002/003/005/006/010/012, SC-001/002/004/005.
- [x] T014 Reejecutar `node --test scripts/spec-review.test.mjs`, revisar diff permitido y documentar evidencia final en `specs/002-spec-completion-reviews/quickstart.md`; aceptación: pruebas y calidad focalizada pasan, todos los FR/SC quedan cubiertos y ninguna tarea se marca sin evidencia. Tras marcar esta última tarea verificada, ejecutar el hook/coordinador real de cierre de spec002; esa revisión posterior decide si la spec está completa. **Estado 2026-11-12: hecha la verificación; la revisión de cierre se ejecuta a continuación y su veredicto queda en `reviews/completion-review.json`.** `node --test scripts/spec-review.test.mjs` 16/16 (salida 0), `node --check` 0 en ambos archivos, markdownlint 74 archivos/0 problemas, `quick_validate.py` `Skill is valid!` en los cinco skills; FR/SC cubiertos con la evidencia de T013 y las limitaciones declaradas; diff permitido solo en quickstarts, este `tasks.md` y el informe canónico.

## Dependencies & Execution Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 →
T011 → T012 → T012a → T013 → T014 → hook real de cierre.

US1 entrega revisión manual independiente. US2 añade invocación y requiere US1;
su prueba de ejecución completa espera helper US3. US3 cubre evidencia y puede
probarse con fixtures sintéticos; nunca los presenta como revisiones reales.
T013 verifica la integración completa. Ningún helper se ejecuta en US2 antes de T010.

## Parallel Example: User Story 1

T003–T006 tienen archivos independientes y podrían distribuirse si se autorizara
trabajo paralelo. En este repositorio se ejecutan secuencialmente, una tarea activa.
US2 y US3 no tienen oportunidades adicionales sin dependencias.

## Implementation Strategy

1. Retomar esta spec con sdd-implement y skill-creator; no regenerar planificación.
2. Entregar cuatro revisores manuales primero, después coordinador/hook y helper.
3. Verificar invariantes con tests y comportamiento real con evaluador independiente.
4. Marcar cada tarea tras su aceptación. Las revisiones de cierre se ejecutan
   después de todas ellas; no crear una tarea circular que exija su propio informe.
5. Si la revisión detecta correcciones, planificarlas antes de implementar y repetir
   la revisión sobre la huella vigente. No acciones de Git/publicación implícitas.

## Notes

FR-001/002/003/011 → T003–T007/T013; FR-004/005/006 → T002/T007–T010/T013;
FR-007/008/012 → T002/T010/T011/T013; FR-009 → T007/T009/T014;
FR-010 → T008/T009/T013. SC-001/004 → T003–T006/T013;
SC-002/005 → T007–T010/T013; SC-003 → T002/T010/T011/T013.
Los archivos de implementación están limitados a los enumerados en plan;
`quickstart.md` y `research.md` admiten solo evidencia de estas tareas.
T012a es remediación nueva de fallos detectados después de T012: sus requisitos
se registran antes de corregir; los checks T001–T012 conservan evidencia histórica
sin acreditar cobertura retroactiva de estos casos.
