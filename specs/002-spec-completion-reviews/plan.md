# Implementation Plan: Revisiones al cierre de una spec

**Branch**: no se crea rama en planificación | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-spec-completion-reviews/spec.md`

## Summary

Cuatro skills portables revisan código, arquitectura, seguridad y buenas prácticas.
Un quinto skill coordina el cierre mediante el hook oficial `after_implement` de
Spec Kit y las reglas compartidas. Un helper Node pequeño calcula la huella y
evalúa evidencia; no simula revisiones ni llama modelos. El agente ejecuta las
revisiones reales y comunica limitaciones del harness.

## Technical Context

**Language/Version**: Markdown/YAML de instrucciones; JavaScript ESM, Node 22.

**Primary Dependencies**: Spec Kit instalado 1.3.3.dev0, commit
`c43849408ac0de2ca6a52f14eaae71449776057b`; módulos nativos Node; ninguna dependencia nueva.

**Storage**: Un informe JSON por spec en `specs/<feature>/reviews/completion-review.json`.

**Testing**: `node --test scripts/spec-review.test.mjs`; validación de skills con
`quick_validate.py` de skill-creator; pruebas conductuales y markdownlint.

**Target Platform**: Repositorio local en Windows/Linux; harness que pueda leer
archivos y ejecutar Node; subagentes cuando estén disponibles.

**Project Type**: Instrucciones de agentes y herramienta local de verificación.

**Performance Goals**: Cero cambios al bundle/API, cero peticiones de red; una
enumeración Git y una lectura por archivo elegible por cálculo de huella.

**Constraints**: Sin nuevos servicios, SDK ni modelos fijados; no modifica app;
una tarea a la vez; no secretos en evidencia; revisiones no equivalen a auditoría.

**Scale/Scope**: Cinco skills, un helper, un archivo de pruebas, una configuración
de hook y tres documentos de integración. No framework ni extensión instalable.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio/puerta | Diseño y resultado antes/después |
| --- | --- |
| VIII simplicidad | PASS: instrucciones + helper nativo, sin dependencias ni app nueva. |
| IX pruebas proporcionales | PASS: decisiones de puerta/huella con escenarios reales y pase de skills. |
| XII secretos | PASS: ubicaciones/evidencia saneada; no lee archivos ignorados ni solicita red. |
| IV rendimiento | PASS: cero impacto web/API; huella local acotada a archivos elegibles. |
| SDD y alcance | PASS: solo artefactos de planificación en esta fase; lista exacta abajo. |
| Markdown obligatorio | PASS de diseño: todos los nuevos Markdown se validan en T012; no se desactivan reglas. |
| Calidad PR/GitFlow | PASS: no sustituye DAST/Copilot ni autoriza git push/merge; no acciones Git mutantes en planificación. |
| I–III/V–VII/X/XI | Sin cambio en contenido, derechos, UI, SEO, datos ni backend. |

## Project Structure

### Documentation (this feature)

```text
specs/002-spec-completion-reviews/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/review-gate.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
.agents/skills/
├── review-code/SKILL.md
├── review-architecture/SKILL.md
├── review-security/SKILL.md
├── review-best-practices/SKILL.md
└── speckit-review-complete/SKILL.md
.specify/extensions.yml
scripts/spec-review.mjs
scripts/spec-review.test.mjs
AGENTS.md
.github/copilot-instructions.md
CONTRIBUTING.md
```

**Structure Decision**: SKILL.md con frontmatter estándar `name`/`description`,
sin metadata específica de proveedor. Los cuatro revisores referencian un único
contrato en `contracts/review-gate.md`; el coordinador lo aplica. No crear agentes
por proveedor ni duplicar reglas. `package.json` no cambia: prueba ejecutable con
Node directo. Los informes concretos se generan en la spec revisada, no se
precargan resultados de éxito.

## Phase 0: Research

Ver [research.md](research.md). Sin aclaraciones pendientes. Los comandos locales
oficiales son ejecutables; los skills de fases se siguen como instrucciones del
agente, no como CLI ficticia.

## Phase 1: Design

- Hook `after_implement`: `extension: spec-review`,
  `command: speckit.review.complete`, `enabled: true`, `optional: false`, sin
  `condition`. Es un registro local al comando/skill portable; no se afirma tener
  una extensión instalada ni se añade `installed: [spec-review]` ficticio.
- Spec Kit convierte el comando a `speckit-review-complete`. El agente carga ese
  SKILL.md y ejecuta su flujo. Si el harness no resuelve comandos, carga el archivo
  explícitamente; si no puede hacerlo, declara cierre pendiente/no soportado.
- Antes de despachar, `prepare` exige los tres artefactos y tareas bien formadas,
  con al menos una tarea activa y todas verificadas/marcadas. Las tareas históricas
  `- **T-001**` y sufijos como T-066a sin checkbox son pendientes; solo excluye
  reemplazadas/diferidas/opcionales no seleccionadas con disposición explícita
  justificada en SDD. No cuenta checklists de
  calidad como tareas. Pendientes producen estado pendiente, sin cuatro revisiones.
- Los revisores reciben reglas AGENTS, spec, plan, tareas, cambios y huella. El
  principal delega a agente distinto del implementador cuando hay subagentes;
  puede usar un agente independiente para los cuatro pases separados. Sin ellos,
  cuatro pases explícitos con limitación registrada. No se exige modelo específico.
- Informe canónico y CLI según [contrato](contracts/review-gate.md). `check`
  recalcula huella, valida cuatro resultados y deriva la decisión. No certifica
  por sí solo que un modelo ejecutó una revisión: esa evidencia pertenece al
  coordinador y al reporte de ejecución real.
- Huella: rutas y bytes SHA-256 de `git ls-files -co --exclude-standard -z`,
  ordenados/deduplicados; incluye rastreados y nuevos no ignorados, incluso
  eliminación de rastreados con marca de ausencia. Excluye únicamente los informes
  `specs/*/reviews/**` y `.specify/feature.json` (puntero local), más archivos
  ignorados no rastreados por Git. Cualquier otro cambio invalida conservadoramente.
  Rechazar symlinks/archivos fuera de raíz y rutas de spec externas.
- Las tareas de implementación se marcan tras pasar sus checks y antes del hook;
  la puerta posterior no es una tarea que deba marcarse para habilitarse a sí misma.
  Completar tareas no declara completa la spec. Correcciones exigen nuevas tareas,
  nueva verificación y nuevas revisiones sobre la huella vigente.
- CRITICAL/HIGH abiertos bloquean; ausentes/fallidos/inválidos/obsoletos dejan
  pendiente. MEDIUM/LOW requieren disposición explícita. No hay waiver automático
  de severidad alta. Revisores escriben solamente su evidencia; coordinador
  consolida el informe y nunca corrige app.

## Complexity Tracking

No hay violaciones constitucionales que requieran excepciones.

## Remediación previa a T013: compatibilidad y confidencialidad

T012a cubre tres fallos nuevos reproducidos tras la verificación T012. Conserva
su evidencia histórica; no acredita que estos casos hubieran pasado antes.

- `prepare` debe reconocer tareas checked con ID en negrita
  `- [x] **T-051**`, incluidas mayúscula X y sufijos, y reemplazos con IDs
  separados por `/`, como T-071/T-055. No convierte tareas legacy sin checkbox
  ni listas de reemplazo inválidas en tareas completas o excluidas.
- Los cinco skills usan explícitamente el modelo y contrato de informe canónicos
  en `specs/002-spec-completion-reviews/`; los documentos de la feature activa
  aportan contexto del producto. No presuponen que su data-model describa Review
  ni que tenga un contrato de cierre local.
- El helper captura errores JSON sin propagar mensajes del parser que puedan
  contener fragmentos privados del informe. Un JSON mal formado deja la puerta
  pendiente y solo comunica una causa fija saneada; no cambia a éxito ni imprime
  el contenido por stdout/stderr.

Archivos autorizados de T012a: `scripts/spec-review.mjs`,
`scripts/spec-review.test.mjs` y los cinco `SKILL.md` enumerados en Project
Structure; `quickstart.md` registra la nueva evidencia. Primero pruebas de
regresión que fallen por los defectos reproducidos, luego corrección mínima y
validación focalizada. No añade dependencias, framework ni contratos duplicados.
T013 y T014 permanecen pendientes hasta verificar esta corrección.
