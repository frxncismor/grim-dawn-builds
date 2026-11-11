# Data Model: Evidencia de revisión

No hay tablas nuevas ni cambios de dominio. El JSON de cierre usa estas entidades.

## CompletionReview

- `schemaVersion`: entero fijo `1`.
- `feature`: ruta relativa `specs/<feature>` existente dentro de raíz.
- `snapshot`: SHA-256 hexadecimal de 64 caracteres del árbol elegible.
- `createdAt`: fecha ISO 8601 UTC.
- `implementationActor`: identidad no vacía del implementador.
- `delegationAvailable`: booleano de capacidad efectiva del harness.
- `reviews`: exactamente cuatro Review, especialidades únicas y obligatorias
  `code`, `architecture`, `security`, `best-practices`.
- La decisión no se confía a un campo del informe: la deriva `check` de los datos.

## Review

- `specialty`: una de las cuatro especialidades anteriores.
- `reviewer`: identidad no vacía.
- `mode`: `independent` o `self-review`.
- `capabilityReason`: texto obligatorio si `delegationAvailable` es false; `mode`
  debe ser `self-review`. Si es true, `mode` debe ser `independent` y reviewer
  debe diferir de implementationActor.
- `status`: `completed`, `failed` o `not-run`; solo completed permite cerrar.
- `coverage`: lista no vacía de rutas/áreas inspeccionadas.
- `checks`: lista de comprobaciones realmente ejecutadas y resultados, puede
  estar vacía con explicación en limitaciones.
- `limitations`: lista, admite vacía si no hay limitaciones conocidas.
- `findings`: lista de Finding, admite vacía; cero hallazgos no significa garantía.

## Finding

- `id`: identificador único no vacío dentro del informe.
- `severity`: `CRITICAL`, `HIGH`, `MEDIUM` o `LOW`.
- `path`: ruta relativa contenida en repositorio; `line`: entero positivo.
- `evidence`, `impact`, `recommendation`: textos no vacíos, saneados sin secretos.
- `disposition`: `open`, `resolved` o `deferred`.
- `resolution`: requerido cuando resolved; describe comprobación y referencia a
  tarea SDD de corrección verificada. Los revisores no implementan esa corrección.
- `deferReason`: requerido cuando deferred; solo MEDIUM/LOW admiten deferred.

## State transitions

Tareas pendientes → pending-tasks, sin despacho.
Artefactos inválidos → invalid, sin despacho.
Todas marcadas → ready → cuatro pases → evaluación de informe.
Informe parcial/inválido/fallido/obsoleto → pending-review.
CRITICAL/HIGH open → blocked.
Cuatro completed vigentes y disposiciones válidas → passed.
Cambio relevante posterior → pending-review aunque antes hubiera passed.
