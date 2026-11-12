# Instrucciones del proyecto para GitHub Copilot

Lee y aplica [`AGENTS.md`](../AGENTS.md) antes de trabajar en este repositorio: sus
reglas de producto, SDD y puertas son comunes a todos los agentes y harnesses,
incluidos Copilot y sus subagentes, sea cual sea el modelo elegido.

## Metodología de orquestación

La orquestación sigue la metodología de usuario, común a todos sus proyectos:
`~/.config/orquestacion/METODOLOGIA.md` y `README.md`. Este repositorio no define
otra.

- Áreas con `~/.config/orquestacion/scripts/Start-Area.ps1` y subagentes con
  `Start-Subagente.ps1`; **nunca** se delega con subagentes, sesiones hijas ni
  `Task` internos de la herramienta. Un orquestador trabaja en una sola sesión.
- Quien edita archivos trabaja en su propio worktree (`Orq-Worktree.ps1`), nunca en
  el repo principal ni en el worktree de otro agente.
- Modelos por rol, cadena de fallback y errores del proveedor:
  [`docs/orchestration/modelos.md`](../docs/orchestration/modelos.md). Copilot
  conserva su propia selección de modelos.

## Reglas que no cambian

- **SDD con GitHub Spec Kit**: retoma la tarea planificada o define spec,
  aclaraciones, plan y tareas antes de implementar alcance nuevo. Al cerrar una
  spec, ejecuta su puerta de revisiones
  ([spec002](../specs/002-spec-completion-reviews/)) con el coordinador
  [`speckit-review-complete`](../.agents/skills/speckit-review-complete/SKILL.md);
  si Copilot no resuelve el hook, carga el skill explícitamente y deja el cierre
  pendiente si no puede ejecutar las revisiones.
- **Reporte con evidencia**: alcance, archivos, verificación con comando y salida
  real, desviaciones, bloqueos y siguiente paso. Un «verde» sin salida citable no
  acredita nada.
- **Git**: sin push ni PR sin permiso del usuario; todo PR lleva labels (tipo, área
  y spec/procedencia), ver [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- El **To-do de Over9k** (`todo`) refleja el estado real de las tareas.
- Respeta la [constitución](../.specify/memory/constitution.md) y las reglas de
  [contribución](../CONTRIBUTING.md), y transmite `AGENTS.md` y el contexto SDD a
  los agentes delegados.

Para otros harnesses: [`CLAUDE.md`](../CLAUDE.md) es el hermano de este archivo.
