# Research: Revisiones al cierre de una spec

## Decisión: skills portables, sin adaptadores por proveedor

**Decision**: Cuatro revisores y un coordinador en `.agents/skills`, con
frontmatter estándar `name` y `description`; AGENTS/Copilot/contribución enlazan
las instrucciones. El principal usa skill-creator durante implementación.

**Rationale**: Otros harness pueden leer SKILL.md como contexto aunque no los
descubran automáticamente. No obliga al usuario a instalar servicios.

**Alternatives considered**: Agentes exclusivos de Copilot o metadata Codex
duplicarían la lógica y no garantizan portabilidad. Un framework LLM añade
dependencias y autorización no solicitadas.

## Decisión: hook oficial y fallback explícito

**Decision**: Registro obligatorio sin condition en `.specify/extensions.yml`,
`hooks.after_implement`, comando `speckit.review.complete`. El coordinador evalúa
si todas las tareas están marcadas. No se edita el skill generado de implement.

**Rationale**: Inspección de fuente oficial local commit
`c43849408ac0de2ca6a52f14eaae71449776057b`:
`templates/commands/implement.md` exige invocar y esperar hooks obligatorios;
`docs/extensions/api.md` sección Hook Configuration documenta registros y limita
conditions. El skill instalado `.agents/skills/speckit-implement/SKILL.md`
además indica conversión de puntos a guiones. Una condition no vacía puede
ocasionar que los templates omitan el hook.

**Alternatives considered**: `auto_execute_hooks` está reservado y no garantiza
ejecución; una condition `tasks_complete` inventada no está soportada. Una bandera
de éxito sin invocación real incumple FR-005. No se presupone soporte universal.

**Procedencia y capacidad comprobadas para T001 (2026-11-09)**: el artefacto local
`.agents/skills/speckit-implement/SKILL.md` se inspeccionó en sus secciones
Pre-Execution Hooks y Mandatory Post-Execution Hooks. Estas describen
`hooks.after_implement`, ignoran una `condition` no vacía y exigen ejecutar y
esperar los hooks obligatorios (`optional: false`). El mismo artefacto documenta
que Spec Kit convierte puntos del comando a guiones al invocarlo. Es evidencia de
las instrucciones que este checkout realmente instala, no evidencia de que el
harness actual tenga un router que despache el nombre, ni de una extensión
`spec-review` instalada. Por eso el flujo debe cargar el coordinador explícitamente
cuando no exista router; registrar el hook no acredita que se haya ejecutado.
La procedencia oficial previamente contrastada en la investigación es el template
de `implement.md` y `docs/extensions/api.md` de Spec Kit, commit
`c43849408ac0de2ca6a52f14eaae71449776057b`; los materiales de documentación de
esa revisión no están presentes en el checkout local actual y no se vuelven a
presentar como archivos inspeccionados en esta tarea.

## Decisión: huella y evaluación local mínima

**Decision**: Helper Node ESM sin dependencias para preparar alcance y evaluar
reporte. La huella cubre todos los archivos rastreados y nuevos no ignorados salvo
informes de revisión y puntero local. Los reviewers reales producen el juicio.

**Rationale**: Un commit no identifica cambios pendientes en el árbol de trabajo.
Excluir solo la propia evidencia evita que escribir el informe lo vuelva obsoleto.
El alcance conservador reduce ambigüedad para un repositorio pequeño.

**Alternatives considered**: Solo HEAD deja huecos; listar rutas manualmente puede
omitir archivos nuevos; generar reseñas con scripts simularía revisión semántica.

## Decisión: verificación proporcional

**Decision**: Pruebas de estados de puerta con repositorios temporales, validación
estática skill-creator y pase conductual independiente cuando haya subagentes.

**Rationale**: Prueba la consecuencia de un archivo cambiado o reporte parcial;
buscar encabezados de instrucciones no prueba revisiones reales.

**Alternatives considered**: No se añaden servicios ni mocks que afirmen revisión
LLM. Resultados de fixtures se etiquetan como sintéticos y no cierran specs reales.

## Hallazgos nuevos posteriores a T012 (2026-11-09)

**Evidence**: El agente principal reprodujo `prepare` sobre la spec 001:
`invalid task disposition for T-007`, cuyo reemplazo usa T-071/T-055. La
inspección del parser confirmó que el formato real checked con ID en negrita
`- [x] **T-051**` tampoco es aceptado. Los cinco skills apuntan actualmente al
modelo/contrato de revisión de la feature activa, pero la 001 tiene un modelo
de dominio y carece del contrato de cierre propio de la 002.

Con un informe JSON mal formado en un fixture temporal, el principal confirmó
que check conserva pending-review pero su error muestra un prefijo de la entrada
privada. Se usó únicamente una cadena sintética; su valor no se reproduce aquí.

**Decision**: Planificar T012a antes de corregir: ampliar solo las variantes reales
del formato de tareas, apuntar los cinco skills al esquema canónico de 002 y
sanear errores de parsing sin contenido del informe. Añadir pruebas conductuales
de regresión antes de las correcciones y conservar evidencia previa como histórica.

**Rationale**: Son defectos concretos de FR-001/004/011/012, no requisitos de una
plataforma nueva. La regularización SDD precede a las modificaciones correctivas;
no se afirma que estas regresiones estuvieran verificadas en T010–T012.

**Alternatives considered**: Copiar contratos a cada spec o reescribir las tareas
001 para acomodar el parser ocultaría el defecto. Devolver mensajes JSON.parse
sin saneamiento incumple la confidencialidad aunque la puerta falle cerrada.
