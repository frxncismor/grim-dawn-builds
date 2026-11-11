# Contract: Puerta de cierre de spec

## CLI local

Desde raíz del repo, con Node 22; no requiere red ni proveedor:

```text
node scripts/spec-review.mjs prepare --feature specs/<feature>
node scripts/spec-review.mjs check --feature specs/<feature>
```

`prepare` solo lee y emite JSON: `status`, `feature`, `snapshot` cuando ready,
`pendingTasks` y `reasons`. Exige spec/plan/tasks dentro de raíz, al menos una
tarea activa `- [ ] Tnnn`/`T-nnn` o histórica `- **T-nnn**`, con sufijos de letras,
y ninguna pendiente. Admite también el formato real del repositorio
`- [x] **T-051**` y `- [X] **T-066a**`: la negrita del ID no cambia su estado.
Las históricas sin checkbox son pendientes. Reconoce `[x]` y `[X]`, y falla
cerrado con líneas de tareas mal formadas o IDs duplicados. No trata otras
checklists como tareas. Solo excluye marcadores inline explícitos
`[REEMPLAZADA por <IDs>; <motivo>]`, `[DIFERIDA: <motivo y referencia SDD>]`,
`[OPCIONAL NO SELECCIONADA: <motivo y referencia SDD>]`; admite la sintaxis histórica
`[REEMPLAZADA por <IDs>; no ejecutar]` y `[REEMPLAZADA por <IDs>]` existente.
La lista de reemplazos admite IDs separados por `/`, como
`[REEMPLAZADA por T-071/T-055; no ejecutar]`; cada ID debe ser válido, y una lista
mal formada no puede excluir silenciosamente la tarea.
Devuelve `excludedTasks` y su justificación para que el agente compruebe que no
se excluyen requisitos activos por una etiqueta sin autorización. No infiere
estado de secciones ni de palabras sueltas. `ready` autoriza despachar, no cerrar.

`check` solo lee el informe fijo `specs/<feature>/reviews/completion-review.json`,
valida [data-model](../data-model.md), recalcula prepare/snapshot y emite JSON con
`status` y `reasons`. Solo passed permite cierre. El resto identifica causa sin
volcar archivos ni evidencia sensible. Si el JSON del informe no se puede
parsear, conserva pending-review y una causa fija saneada; nunca devuelve
`SyntaxError.message`, fragmentos del JSON de entrada ni valores del informe,
en stdout o stderr. Los comandos usan códigos de salida:
0 ready/passed, 1 pending-tasks/pending-review/blocked, 2 invalid/errores de uso.
No ejecutan modelos ni generan informes de éxito. Deben ser importables para
tests sin ejecutar CLI accidentalmente.

## Coordinación por el agente

El esquema canónico de `Review`/`CompletionReview` para **todas** las features
es `specs/002-spec-completion-reviews/data-model.md`, y su contrato es
`specs/002-spec-completion-reviews/contracts/review-gate.md`. Cada uno de los
cinco skills debe resolver explícitamente esas rutas desde la raíz. Los archivos
spec/plan/tasks y los contratos/modelos de dominio de la feature activa son
contexto de revisión, nunca una ubicación presupuesta del esquema del informe.
Su ausencia no exige crear ni copiar contratos de revisión en otras specs.

El hook `.specify/extensions.yml` usa el formato oficial `hooks.after_implement`
con una lista de registro `extension: spec-review`,
`command: speckit.review.complete`, `enabled: true`, `optional: false`, sin
condition. No anuncia una extensión instalada. Resuelve el skill
`.agents/skills/speckit-review-complete/SKILL.md`; sin router de comandos, el
harness lee el archivo como invocación explícita y comunica ese modo.

El coordinador ejecuta prepare. Con pendientes, termina comunicando ese estado.
Con ready, ejecuta y espera cuatro pases reales, delegados a otro agente si hay
capacidad. Entrega AGENTS, constitución, contribución, spec, plan, tareas, cambios,
snapshot y los SKILL.md pertinentes. No envía un resultado esperado al revisor.
Puede agrupar cuatro pases en un subagente independiente, conservando resultados
por especialidad. Sin subagentes, ejecuta pases separados y registra self-review
y capabilityReason. No inventa identidades ni comprobaciones.

Los revisores devuelven las secciones de Review; no cambian la aplicación ni
marcan tareas. El coordinador consolida el JSON en la ruta fija, sanea la evidencia
y ejecuta check antes de informar. La validación estructural no prueba por sí sola
la ejecución LLM; el agente debe ejecutar y describir los pases que produjeron
el informe. Sin capacidad de hacerlo, status not-run y cierre pendiente.

El informe final humano enlaza el JSON y resume cuatro especialidades, decisión,
severidades abiertas, independencia, comandos y limitaciones. No sustituye otras
puertas de calidad del proyecto ni habilita commits/push/PR sin autorización.

## Semántica de evidencia

La huella cubre el árbol elegible descrito en plan, incluida configuración y los
artefactos SDD. Escritura de informes en `specs/*/reviews/**` no la cambia. Fuera de
esa exclusión, cambios nuevos, editados o eliminados invalidan el resultado.
Las rutas no pueden escapar raíz ni usar symlinks para leer fuera del repo.

CRITICAL/HIGH solo se resuelven tras tarea planificada, corrección verificada y
revisión nueva. No se admite aplazarlos para pasar. MEDIUM/LOW open no permite
pasar sin disposición: se resuelven o se aplazan con motivo explícito; aplazar no
afirma implementación ni autorización para ampliar alcance.
