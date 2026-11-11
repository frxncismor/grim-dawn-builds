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

La metodología de orquestador y agentes por rol está en
[`C:/Users/paco_/.copilot/sdd/ORCHESTRATION.md`](C:/Users/paco_/.copilot/sdd/ORCHESTRATION.md)
(nivel usuario, transversal a este y futuros proyectos). Reglas que aplican aquí:

- El **orquestador** (esta sesión principal) decide, despacha, verifica de
  primera mano y consolida. Delega la ejecución; no la suplanta.
- Todo agente devuelve un **reporte con la forma del §3** de `ORCHESTRATION.md`
  (alcance, archivos, verificación con comando y salida, desviaciones, bloqueos,
  siguiente paso). Un anuncio de despacho o una afirmación de «verde» sin salida
  citable **no** acreditan ejecución.
- **Una tarea a la vez.** Dos agentes no tocan los mismos archivos; el
  paralelismo solo con tareas `[P]` de `tasks.md` y archivos disjuntos.
- El orquestador verifica con la salida real (log, artefacto o pantalla de la
  terminal) antes de marcar una tarea, y no acepta el reporte del agente como
  prueba suficiente.
- Cuando un agente corre en una terminal externa y se bloquea por permisos, el
  orquestador lee su pantalla, aprueba **el patrón mínimo** que pide, persiste
  esa aprobación para la misma tarea y **registra la aprobación** en el
  reporte. Una aprobación no es un resultado.
- Si un proveedor agota su cuota, se elige un modelo disponible, se reduce la
  unidad de trabajo y **se consigna en el relevo el modelo realmente usado**.

## Correspondencia de modelos por proveedor y orden de prioridad

Al usar los agentes SDD configurados previamente para Copilot, conservar sus
responsabilidades, instrucciones y límites, y elegir el modelo disponible según
este **orden de prioridad por disponibilidad** (decisión del usuario,
2026-11-10):

```text
1. GitHub Copilot   (github-copilot/*)
2. Codex            (openai/*)
3. OpenCode Go      (opencode-go/*)
4. DeepSeek         (deepseek/*)
```

Se usa el primero de la lista **cuyo modelo responda**. Si el primero agota su
cuota, se baja un escalón sin degradar la verificación y se registra el modelo
realmente usado.

| Agente                     | GitHub Copilot (`github-copilot/`) | Codex (`openai/`)    | OpenCode Go (`opencode-go/`) | DeepSeek (`deepseek/`) | Razonamiento |
| -------------------------- | ---------------------------------- | -------------------- | ---------------------------- | ---------------------- | ------------ |
| **Orquestador**            | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-flash#high`  | `high`       |
| `sdd-plan`                 | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-flash#high`  | `high`       |
| `sdd-implement`            | `claude-haiku-5.5#medium`          | `gpt-6-luna#medium`  | `claude-haiku-5-5#medium`    | `deepseek-flash#high`  | `medium`     |
| `sdd-ui`                   | `gpt-5.6-luna#high`                | `gpt-6-luna#high`    | `gpt-6-luna#high`            | `deepseek-flash#high`  | `high`       |
| `sdd-escalation`           | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-v4-pro#high` | `high`       |
| `sdd-second-opinion`       | `gpt-5.6-terra#high`               | `gpt-6.1-terra#high` | `grok-4.7#high`              | `deepseek-v4-pro#high` | `high`       |
| **Revisión final de spec** | el modelo más potente disponible   | —                    | —                            | —                      | ver `T-136`  |

### Estado observado de cada escalón (2026-11-10)

| Escalón           | Estado         | Evidencia                                                                    |
| ----------------- | -------------- | ---------------------------------------------------------------------------- |
| GitHub Copilot    | **agotado**    | `You have exceeded your monthly quota` en `claude-sonnet-5.5` y `gpt-6-luna` |
| Codex (`openai/`) | **disponible** | `gpt-6.1-sol#high` responde; cuota semanal de Codex era 4 % a las 19:52      |
| OpenCode Go       | **agotado**    | `OpenCode Go usage limit reached`; el error no expone hora de reinicio       |
| DeepSeek          | **disponible** | `deepseek-flash#high` y `deepseek-v4-pro#max` responden                      |

Este cuadro caduca: se actualiza cuando cambie la disponibilidad, no se asume.

### Reglas de la cadena de prioridad

- Se consigna siempre en `handoff.md` el modelo **realmente usado**, no el
  planificado.
- Cuando el escalón usado es `deepseek-flash`, el orquestador **sube la
  profundidad de verificación**: repite él mismo las comprobaciones de
  accesibilidad y capturas que el agente declare, en lugar de fiarse del log.
- Cuando vuelva a haber cuota, **no se reinicia** el trabajo en curso: se termina
  la tarea con el modelo actual y el cambio se aplica a la tarea siguiente.
- La segunda opinión debe venir de una **familia distinta** a la de planificación
  cuando ambas estén disponibles en el mismo escalón.
- Alternativa sin coste: `opencode/deepseek-v4.1-flash-free#high` es el mismo
  modelo DeepSeek por la ruta gratuita; se prefiere el proveedor `deepseek`
  porque no comparte cuota con los modelos gratuitos.

## Uso

- Antes de utilizar un rol, leer su definición en
  `C:/Users/paco_/.copilot/agents/<agente>.agent.md`. Si falta, informar al usuario;
  no inventar sus instrucciones.
- Esas definiciones son instrucciones de trabajo de Copilot, no configuraciones
  nativas de OpenCode ni de Codex. Aplicar la correspondencia anterior al delegar
  desde OpenCode o Codex; sus campos `model` y la referencia a
  `~/.copilot/sdd/models.json` corresponden exclusivamente a Copilot.
- En **OpenCode**, iniciar cada subagente en una sesión hija limpia (sin
  `sessionID`) mediante la herramienta `subagent` con `agent: "general"` y el
  parámetro `model` exacto de la columna OpenCode Go (que ya incluye proveedor y
  variante `#<razonamiento>`). En **Codex**, iniciarlo con `fork_turns: "none"`,
  el `model` y `reasoning_effort` de la tabla. En ambos casos, incluir en su
  encargo las instrucciones del rol, estas reglas de `AGENTS.md`, la tarea y el
  contexto SDD necesario.
- Conservar el trabajo de una tarea a la vez y los protocolos de escalamiento:
  implementación y UI pueden llamar a `sdd-escalation` según sus disparadores;
  planificación puede llamar a `sdd-second-opinion` según sus disparadores.
  Los dos agentes auxiliares no delegan.
- Mantener la segunda opinión en una familia de modelo distinta a la de
  planificación (`opencode-go/grok-4.7#high` frente a
  `opencode-go/gemini-4-argon#high` en OpenCode Go).
- No cambiar el modelo de la conversación principal automáticamente. Esta tabla
  se aplica a los subagentes que se utilicen para ejecutar esos roles.
- Si un modelo deja de estar disponible, informar antes de sustituirlo.
- Respetar `.specify/memory/constitution.md` y `CONTRIBUTING.md`, incluidos los
  límites de alcance, la verificación y las restricciones de los agentes de
  planificación.
