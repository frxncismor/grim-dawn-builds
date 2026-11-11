# Instrucciones del proyecto para GitHub Copilot

Lee y aplica [AGENTS.md](../AGENTS.md) antes de trabajar en este repositorio.
Sus reglas SDD son comunes a todos los agentes y harnesses, incluidos Copilot y
sus subagentes, independientemente del modelo seleccionado.

Todo trabajo debe seguir SDD con GitHub Spec Kit: retomar una tarea existente o
definir spec, aclaraciones necesarias, plan y tareas, y analizar su coherencia
antes de implementar alcance nuevo. Usa los comandos y plantillas instalados;
si faltan, informa y localiza la instalación antes de continuar esa fase.

Respeta la [constitución](../.specify/memory/constitution.md), las reglas de
[contribución](../CONTRIBUTING.md), los archivos y dependencias de la tarea activa
y sus criterios de aceptación. Una tarea solo se completa después de verificarla.
Transmite estas instrucciones y el contexto SDD al delegar trabajo.

La tabla de correspondencia de modelos de OpenCode Go y Codex en `AGENTS.md` solo
aplica cuando ejecutan esos harnesses; Copilot conserva su selección de modelos.

Al terminar las tareas de implementación, ejecuta y espera la puerta de cierre
de [spec002](../specs/002-spec-completion-reviews/) mediante el coordinador
[`speckit-review-complete`](../.agents/skills/speckit-review-complete/SKILL.md).
Debe obtener cuatro resultados reales y verificar la evidencia antes de declarar
completa una spec. Si Copilot no resuelve el hook registrado, carga el skill
explícitamente; si no puede ejecutar las revisiones, deja el cierre pendiente.
Propaga `AGENTS.md` y el contexto SDD a los agentes delegados. El registro del
hook no afirma soporte universal de automatización ni sustituye el resultado.
