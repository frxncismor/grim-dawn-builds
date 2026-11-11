# Instrucciones para todos los agentes y harnesses

Estas instrucciones aplican a todo trabajo en este repositorio, sin importar el
modelo, proveedor, editor o harness: OpenCode, Codex, GitHub Copilot, agentes
principales, subagentes y automatizaciones que implementen cambios. SDD con
GitHub Spec Kit es obligatorio para todos ellos; no es una preferencia exclusiva
de ningún proveedor.

El agente principal debe transmitir esta regla, la spec y la tarea activa a cada
subagente, incluso si este no hereda el historial. Delegar no elimina las puertas
de planificación, alcance y verificación. Un harness que no cargue `AGENTS.md`
automáticamente debe recibirlo como contexto antes de trabajar.

## SDD obligatorio

Todo trabajo sigue Spec-Driven Development con GitHub Spec Kit. Incluye specs,
tareas, correcciones, refactorizaciones, pruebas, documentación, infraestructura
y configuración, incluso peticiones directas durante otra implementación.
Para trabajo ya planificado se retoma la tarea vigente; no se regenera la spec
innecesariamente. Para alcance nuevo se planifica antes de implementar.

1. Identificar la spec y tarea existentes que cubren la solicitud. Si no existen,
   pasar primero por `sdd-plan`: specify → clarify (si hay dudas) → plan → tasks
   → analyze, usando los comandos y plantillas de Spec Kit instalados.
2. Antes de implementar, disponer de `spec.md`, `plan.md` y `tasks.md` coherentes,
   con alcance, archivos, dependencias y aceptación verificable. Leerlos junto
   con la constitución y `CONTRIBUTING.md`. Resolver ambigüedades y hallazgos
   CRITICAL antes de continuar.
3. Implementar una tarea a la vez con `sdd-implement`, o `sdd-ui` para `[UI]`.
   Una petición nueva no amplía silenciosamente la tarea activa: registrar su
   alcance y dependencias en los artefactos SDD antes de modificar código o infra.
4. Verificar los criterios de aceptación y registrar evidencia. Marcar `[x]`
   solo después de pasar las comprobaciones; informar bloqueos y pendientes.
5. Si faltan comandos, skills o plantillas de Spec Kit, informar la carencia y
   localizar la instalación antes de iniciar la fase correspondiente. No inventar
   su formato ni afirmar que se ejecutó una fase que no se ejecutó.
6. Si se detecta trabajo implementado sin planificación previa, reconocer y
   registrar la desviación; regularizarlo mediante SDD antes de ampliarlo. La
   documentación retrospectiva no acredita planificación previa.

## Revisión antes de cerrar una spec

Al terminar las tareas de implementación, ejecuta y espera la puerta de cierre
descrita en [specs/002-spec-completion-reviews](specs/002-spec-completion-reviews/).
El registro local `hooks.after_implement` solicita el coordinador
[`speckit-review-complete`](.agents/skills/speckit-review-complete/SKILL.md), que
despacha cuatro revisiones reales de código, arquitectura, seguridad y buenas
prácticas y comprueba su evidencia vigente. No declares completa la spec si la
puerta queda pendiente, inválida o bloqueada.

La configuración del hook no garantiza que todo harness tenga un router para
invocarlo. Si no existe, carga el skill explícitamente y ejecuta el mismo flujo;
si tampoco puede ejecutarse, registra el cierre como pendiente. Transmite al
coordinador y a cada revisor estas reglas compartidas y el contexto SDD, y no
interpretes anuncios de dispatch como resultados de revisión.

## Orquestación y reporte al orquestador

La orquestación sigue la metodología de usuario de Paco, común a todos sus proyectos:
`~/.config/orquestacion/METODOLOGIA.md` y `README.md`. Este repo no define otra.

- Espacios de Herdr: `gdb-Orq-<Área>` y el principal `gdb-Orq-Principal`.
- Lanzamiento solo con `~/.config/orquestacion/scripts/Start-Agente.ps1`; los modelos por nivel están en
  `~/.config/orquestacion/proveedores.local.json` de cada máquina.
- Reglas propias de este repo que siguen vigentes:
  - Todo agente devuelve un reporte con alcance, archivos, verificación con comando y salida, desviaciones,
    bloqueos y siguiente paso. Un "verde" sin salida citable no acredita ejecución.
  - Una tarea a la vez por agente; paralelismo solo con tareas `[P]` y archivos disjuntos.
  - Todo agente que edita trabaja en su propio worktree (`Orq-Worktree.ps1`); nunca en el repo principal.
  - El orquestador verifica con la salida real antes de marcar `[x]`.
  - El To-do de Over9k refleja el estado real de las tareas (`todo`).
  - Se consigna en `handoff.md` el modelo realmente usado.
- Modelos preferidos por rol, fallback y manejo de errores del proveedor: `docs/orchestration/modelos.md`.

## Uso

- Los roles y su lanzamiento los define la metodología de usuario; ver la sección de Orquestación.
- Modelos por rol, segunda opinión y escalamiento: ver `docs/orchestration/modelos.md` y la metodología de usuario (`~/.config/orquestacion/METODOLOGIA.md`).
- Conservar el trabajo de una tarea a la vez y los protocolos de escalamiento:
  implementación y UI pueden llamar a `sdd-escalation` según sus disparadores;
  planificación puede llamar a `sdd-second-opinion` según sus disparadores.
  Los dos agentes auxiliares no delegan.
- Mantener la segunda opinión en una familia de modelo distinta a la de
  planificación (`opencode-go/grok-4.7#high` frente a
  `opencode-go/gemini-4-argon#high` en OpenCode Go).
- Si un modelo deja de estar disponible, informar antes de sustituirlo.
- Respetar `.specify/memory/constitution.md` y `CONTRIBUTING.md`, incluidos los
  límites de alcance, la verificación y las restricciones de los agentes de
  planificación.
