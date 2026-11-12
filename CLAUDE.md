# CLAUDE.md — metodología compartida para Claude Code

Este repositorio se trabaja con la metodología de usuario, sea cual sea el
harness. Claude Code no es una excepción: este archivo remite, no duplica.

## Qué leer primero

1. `AGENTS.md`: reglas de producto, SDD y puertas de este repositorio.
2. `~/.config/orquestacion/METODOLOGIA.md` y `~/.config/orquestacion/README.md`:
   metodología de orquestación de usuario. **En orquestación prevalece sobre
   `AGENTS.md`**.

## Delegación: solo agentes visibles en Herdr

- **Prohibido** delegar con herramientas internas de Claude Code: `Task`,
  subagentes internos, sesiones hijas o worktrees propios de la CLI. No se ven en
  Herdr ni en `hc`, no reportan estado y se acumulan en el espacio equivocado.
- Un orquestador trabaja en **una sola sesión**; si necesita otro agente, lo lanza:
  - áreas: `pwsh -NoProfile -File ~/.config/orquestacion/scripts/Start-Area.ps1 ...`
  - subagentes: `pwsh -NoProfile -File ~/.config/orquestacion/scripts/Start-Subagente.ps1 ...`

## Si te lanzan como sesión única

El trabajo no trivial que se pueda repartir por áreas **no** se hace en solitario:
propón abrir la corrida con
`pwsh -NoProfile -File ~/.config/orquestacion/scripts/Start-Orquestacion.ps1 -RepoPath <repo> -Peticion "<petición>"`.

## Worktrees

Quien edita archivos trabaja en su propio worktree, creado e integrado con
`Orq-Worktree.ps1`; nunca en el repo principal ni en el worktree de otro agente.

## SDD obligatorio

`spec.md`, `plan.md` y `tasks.md` coherentes antes de implementar; una tarea a la
vez; ninguna casilla `[x]` sin evidencia real.

## Reporte

Alcance, archivos, verificación con comando y salida real, desviaciones, bloqueos
y siguiente paso. Un «verde» sin salida citable no acredita ejecución.

## Git y PR

- Commits locales: solo el orquestador de implementación. Sin `--amend`, sin push.
- Push y PR: solo el principal y solo con permiso del usuario.
- Todo PR lleva labels (tipo, área y spec/procedencia); sin labels no se mergea.
  Ver `CONTRIBUTING.md`, sección «Pull request labels».
- Nunca secretos en el repo, en logs ni en artefactos.

## Registro

- Espacios de Herdr: `gdb-Orq-<Área>` y `gdb-Orq-Principal`.
- El To-do de Over9k (`todo`) refleja el estado real de las tareas.
