# Feature Specification: Revisiones al cierre de una spec

**Feature Directory**: `specs/002-spec-completion-reviews`
**Created**: 2026-11-09
**Status**: Draft
**Input**: User description: "crees agentes o skills que puedas leer tu y otros harness/agentes/proveedores para revisar codigo, revisar arquitectura, revisar seguridad, revisar buenas practicas y que sean invocadas automaticamente al terminar una spec"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Revisiones especializadas portables (Priority: P1)

Como mantenedor quiero cuatro revisores reutilizables para detectar problemas de
código, arquitectura, seguridad y buenas prácticas con cualquier proveedor.

**Why this priority**: La revisión necesita criterios y evidencia compartidos.

**Independent Test**: Un agente recibe instrucciones de un revisor y una spec de
ejemplo con defectos conocidos; comunica hallazgos sustentados y limitaciones sin
cambiar la aplicación.

**Acceptance Scenarios**:

1. **Given** requisitos y cambios identificados, **When** se invocan los cuatro
   revisores, **Then** cada uno comunica cobertura, evidencia y hallazgos con
   severidad y ubicación, o declara cero hallazgos dentro del alcance revisado.
2. **Given** un harness sin descubrimiento automático de instrucciones,
   **When** recibe las instrucciones como contexto, **Then** puede revisar sin
   herramientas ni modelos de un proveedor concreto.
3. **Given** un posible secreto, **When** comunica el hallazgo, **Then** identifica
   ubicación y riesgo sin copiar su valor sensible.

### User Story 2 - Puerta automática antes del cierre (Priority: P1)

Como mantenedor quiero que terminar las tareas de una spec invoque las cuatro
revisiones y retenga la declaración de spec completa hasta conocer sus resultados.

**Why this priority**: Tener tareas marcadas no sustituye la revisión efectiva.

**Independent Test**: Una spec pendiente no despacha revisiones de cierre; otra
con todas sus tareas verificadas despacha exactamente las cuatro y espera los
resultados antes de evaluar la puerta.

**Acceptance Scenarios**:

1. **Given** una tarea pendiente, **When** termina una sesión de implementación,
   **Then** informa tareas pendientes sin presentar una revisión final ni declarar
   completa la spec.
2. **Given** todas las tareas verificadas y marcadas, **When** se ejecuta el cierre,
   **Then** se ejecutan los cuatro revisores antes de declarar completa la spec;
   anunciar una invocación no cuenta como ejecutarla.
3. **Given** subagentes disponibles, **When** se revisa una implementación,
   **Then** el autor delega a otro agente con instrucciones y contexto SDD; sin
   esta capacidad realiza cuatro pases separados y comunica la limitación.
4. **Given** un harness sin soporte de invocación automática, **When** intenta
   cerrar, **Then** comunica la limitación y ejecuta la puerta explícitamente;
   si tampoco puede ejecutar los revisores, deja el cierre pendiente.

### User Story 3 - Evidencia vigente y cierre honesto (Priority: P2)

Como mantenedor quiero distinguir revisiones ejecutadas, incompletas y obsoletas
para saber si cubren el estado que realmente se va a cerrar.

**Why this priority**: Los informes antiguos pueden ocultar defectos posteriores.

**Independent Test**: Revisar una spec de ejemplo, modificar un archivo del alcance
y comprobar que la evidencia anterior ya no permite cerrar.

**Acceptance Scenarios**:

1. **Given** un CRITICAL/HIGH abierto, **When** se evalúa la puerta, **Then** bloquea
   el cierre y exige planificar la corrección en SDD antes de cambiar la aplicación.
2. **Given** una revisión faltante, fallida o antigua, **When** se evalúa el cierre,
   **Then** queda pendiente y se identifica la causa.
3. **Given** cuatro revisiones completas y vigentes sin CRITICAL/HIGH abiertos,
   **When** se evalúa el cierre, **Then** permite declarar completa la spec y
   conserva MEDIUM/LOW con disposición explícita y limitaciones de revisión.

### Edge Cases

- Una spec solo documental revisa sus artefactos aplicables sin inventar defectos.
- Faltan spec, plan o tasks, hay tareas mal formadas o no hay tareas: cierre inválido.
- Las tareas históricas sin checkbox siguen pendientes; solo una disposición
  explícita justificada en SDD permite excluir tareas reemplazadas, diferidas o
  opcionales no seleccionadas. Estar en una sección futura no basta.
- Un archivo nuevo sin seguimiento cambia: invalida evidencia como uno rastreado.
- Falta identidad de revisor: no acredita independencia ni revisión ejecutada.
- Corregir un hallazgo exige registrar alcance SDD, verificar y repetir revisiones.
- Las revisiones no sustituyen pruebas, DAST, auditorías ni Copilot para PR.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El repositorio MUST ofrecer cuatro instrucciones especializadas,
  portables y legibles por agentes: código, arquitectura, seguridad y buenas prácticas.
- **FR-002**: Cada revisor MUST usar constitución, contribución, spec, plan, tareas,
  cambios y evidencia pertinentes; MUST mantener la revisión sin modificaciones
  de aplicación ni acciones remotas.
- **FR-003**: El resultado MUST distinguir cobertura, limitaciones, comprobaciones
  ejecutadas y hallazgos con severidad CRITICAL/HIGH/MEDIUM/LOW, ubicación,
  evidencia, impacto y recomendación; MUST admitir cero hallazgos.
- **FR-004**: El flujo MUST activar automáticamente una puerta al terminar todas
  las tareas activas verificadas, incluidas las históricas sin checkbox; solo
  excluye disposiciones explícitas justificadas en SDD. Con pendientes MUST comunicar ese estado sin
  ejecutar revisión de cierre ni afirmar spec completa.
- **FR-005**: La puerta MUST ejecutar y esperar los cuatro revisores; anunciar
  órdenes o carecer de informe MUST NOT contar como ejecución.
- **FR-006**: La revisión MUST ser independiente del implementador si existen
  subagentes; sin esa capacidad MUST indicar la limitación y efectuar cuatro
  pases separados sin atribuir independencia inexistente.
- **FR-007**: El informe MUST identificar spec, estado exacto revisado, revisores,
  especialidades, independencia y resultados; cambios posteriores relevantes
  MUST invalidar su vigencia.
- **FR-008**: CRITICAL/HIGH abiertos MUST bloquear el cierre; revisiones ausentes,
  inválidas, fallidas u obsoletas MUST dejarlo pendiente; MEDIUM/LOW MUST tener
  disposición explícita sin convertirse automáticamente en trabajo implementado.
- **FR-009**: Corregir hallazgos MUST seguir SDD y verificación antes de resolverlos;
  los revisores MUST NOT corregir silenciosamente ni marcar tareas de implementación.
- **FR-010**: Instrucciones compartidas, Copilot y contribución MUST enlazar la puerta
  y describir soporte real y alternativa explícita sin automatización.
- **FR-011**: La revisión MUST funcionar localmente sin exigir red, servicios ni
  proveedor/modelo concreto y sin copiar secretos a informes, comandos o registros.
- **FR-012**: La implementación MUST validar escenarios significativos de despacho,
  tareas pendientes, bloqueo, evidencia parcial e invalidación tras cambios;
  comparar solo texto de instrucciones no acredita comportamiento.

### Key Entities *(include if feature involves data)*

- **Revisión especializada**: especialidad, revisor, independencia, estado,
  cobertura, comprobaciones y limitaciones.
- **Hallazgo**: identificador, severidad, ubicación, evidencia saneada, impacto,
  recomendación y disposición con referencia SDD cuando corresponda.
- **Informe de cierre**: spec, huella del estado revisado, cuatro revisiones y
  decisión derivada de la puerta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los cuatro revisores se invocan desde instrucciones locales sin
  depender de cuenta, modelo o herramientas de un proveedor particular.
- **SC-002**: Todos los escenarios pendientes retienen el cierre; el preparado
  ejecuta y documenta las cuatro especialidades.
- **SC-003**: El 100 % de escenarios CRITICAL/HIGH abiertos, revisión ausente/fallida
  o cambios posteriores impide declarar spec completa.
- **SC-004**: Cada hallazgo contiene evidencia y ubicación revisable; cada pase sin
  hallazgos conserva cobertura y limitaciones, sin inventar resultados ni secretos.
- **SC-005**: Una ejecución con delegación y otra sin subagentes reflejan su
  independencia real y el resultado de la puerta.

## Assumptions

- Esta spec independiente incorpora revisores y una puerta local al flujo SDD;
  no modifica la aplicación ni añade servicios remotos. Puede usarse al cerrar 001.
- La automatización requiere que el harness ejecute reglas del flujo; quien no
  las cargue debe recibirlas como contexto. Los archivos no garantizan ejecución
  universal por sí mismos.
- Marcar tareas verificadas habilita la revisión; la spec solo queda completa
  tras esta puerta y las demás comprobaciones exigidas.
- No hay interfaz pública nueva; los requisitos de UI no aplican.
