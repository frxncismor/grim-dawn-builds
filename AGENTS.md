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

- **Delegación automática y jerárquica.** El orquestador del programa (nivel 0) no
  ejecuta: reparte por dominio. Cada **orquestador de dominio** (UI, tests, backend,
  infraestructura, Herdr/DX) descompone su tarea y despacha a **sus propios
  subagentes**. Ningún orquestador implementa lo que puede delegar.
- **Todo agente se lanza visible en Herdr.** Un agente que no se ve no se puede
  supervisar. Regla obligatoria (ver `docs/orchestration/herdr.md`):
  - `hc run --bg --name <nombre> --cwd <repo> --label herdr.space=<id>
    --label herdr.tab=<id> --parent <t> --outlive-parent <harness> ...`
  - **Las dos etiquetas son obligatorias.** Solo con `herdr.space` el terminal se
    queda fuera de la app: aparece en `hc ls` pero no en `herdr-app ls`.
  - El harness debe ser **interactivo** (`opencode --auto --prompt "…"`, `codex`,
    `copilot`), no un modo no interactivo: solo el interactivo reporta estado por
    OSC 7501 y Herdr lo reconoce como agente.
  - Verificación obligatoria tras lanzar: `herdr-app ls` debe mostrar `app` y
    `status` no nulos para ese terminal. Si `status` es `null`, el agente no es
    visible como agente y hay que relanzarlo.
- **El registro de trabajo vive en el To-do de Over9k.** Además de `tasks.md`, las
  tareas pendientes y hechas se mantienen en
  `~/.local/share/over9k/todos/<slug>.md`, el archivo que lee el panel To-do. El
  comando `todo` (wrapper del proyecto) y ese archivo deben reflejar el estado real:
  una tarea cerrada se marca `[x]` también ahí.
- Todo agente devuelve un **reporte con la forma del §3** de `ORCHESTRATION.md`
  (alcance, archivos, verificación con comando y salida, desviaciones, bloqueos,
  siguiente paso). Un anuncio de despacho o una afirmación de «verde» sin salida
  citable **no** acreditan ejecución.
- **Una tarea a la vez por agente.** Dos agentes no tocan los mismos archivos;
  el paralelismo solo con tareas `[P]` de `tasks.md` y archivos disjuntos.
- El orquestador verifica con la salida real (log, artefacto o pantalla de la
  terminal) antes de marcar una tarea, y no acepta el reporte del agente como
  prueba suficiente.
- Cuando un agente corre en una terminal externa y se bloquea por permisos, el
  orquestador lee su pantalla, aprueba **el patrón mínimo** que pide, persiste
  esa aprobación para la misma tarea y **registra la aprobación** en el
  reporte. Una aprobación no es un resultado.
- Si un proveedor agota su cuota, se elige un modelo disponible, se reduce la
  unidad de trabajo y **se consigna en el relevo el modelo realmente usado**.

## Correspondencia de modelos y cadena de fallback

Política vigente (decisión del usuario, 2026-11-10 noche). Sustituye a la cadena
anterior de cuatro escalones.

```text
Primario    → opencode-go/deepseek-v4.1-flash
Fallback 1  → deepseek/deepseek-flash            (crédito directo: ~3 $ restantes)
Fallback 2  → opencode/glm-5.3-flash-free
Fallback 3  → opencode-go/claude-haiku-5-5
```

**Regla de coste**: el crédito directo de DeepSeek es de ~3 $ y se reserva para
cuando `opencode-go` agote su ventana. No se usa como primera opción aunque sea el
mismo modelo: primero la suscripción, después el crédito.

Los proveedores `zai/*` y `anthropic/*` **no están configurados** en esta máquina:
`opencode/glm-5.3-flash-free` es el equivalente real del GLM gratuito y
`opencode-go/claude-haiku-5-5` el del Haiku. No inventar IDs de proveedor.

### Manejo de errores del proveedor (obligatorio)

| Situación                       | Acción                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **503 / servicio sobrecargado** | Reintentar con backoff exponencial 5 s → 15 s → 45 s. Al cuarto intento, cambiar a Fallback 1. Quinto intento fallido con Fallback 1: pasar a Fallback 2. **Nunca detener la tarea por un 503.** |
| **429 / límite de tasa**        | Respetar `retry-after`. Sin cabecera: esperar 10 s. Máximo 3 reintentos y luego cambiar de fallback.                                                                                             |
| **401 / 403 / auth**            | **No reintentar.** Reportar al usuario que la credencial es inválida.                                                                                                                            |
| **Timeout**                     | Reintentar una vez con el timeout duplicado. Si vuelve a fallar, cambiar de fallback.                                                                                                            |

Reglas de orquestación asociadas:

- Máximo **5 intentos totales** por sub-tarea y **3 iteraciones** antes de escalar
  al usuario.
- Si una sub-tarea falla dos veces con el mismo modelo, se cambia de modelo y se
  reintenta.
- Si el subagente entrega código que no compila, se le devuelve **con el error
  concreto**; no se re-ejecuta a ciegas.
- Cada sub-tarea se despacha **auto-contenida**: el subagente no depende de otro.
- No se cambia el modelo del **orquestador**; solo el de los subagentes. Si el GLM
  disponible no fuese el 5.3, se usa el GLM 5.x más cercano disponible.

| Agente                     | GitHub Copilot (`github-copilot/`) | Codex (`openai/`)    | OpenCode Go (`opencode-go/`) | DeepSeek (`deepseek/`) | Razonamiento |
| -------------------------- | ---------------------------------- | -------------------- | ---------------------------- | ---------------------- | ------------ |
| **Orquestador**            | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-flash#high`  | `high`       |
| `sdd-plan`                 | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-flash#high`  | `high`       |
| `sdd-implement`            | `claude-haiku-5.5#medium`          | `gpt-6-luna#medium`  | `claude-haiku-5-5#medium`    | `deepseek-flash#high`  | `medium`     |
| `sdd-ui`                   | `gpt-5.6-luna#high`                | `gpt-6-luna#high`    | `gpt-6-luna#high`            | `deepseek-flash#high`  | `high`       |
| `sdd-escalation`           | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-v4-pro#high` | `high`       |
| `sdd-second-opinion`       | `gpt-5.6-terra#high`               | `gpt-6.1-terra#high` | `grok-4.7#high`              | `deepseek-v4-pro#high` | `high`       |
| **Revisión final de spec** | el modelo más potente disponible   | —                    | —                            | —                      | ver `T-136`  |

La tabla **no** es la cadena de fallback: fija el modelo preferido por rol cuando
ese proveedor está sano. La cadena de fallback de arriba es la que se aplica
cuando el primario falla.

### Estado observado de cada escalón (2026-11-10, tarde)

| Escalón           | Estado                  | Evidencia                                                                                                                                                                                                          |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Copilot    | **agotado**             | `You have exceeded your monthly quota` en `claude-sonnet-5.5` y `gpt-6-luna`                                                                                                                                       |
| Codex (`openai/`) | **disponible**          | `gpt-6.1-sol#high` responde                                                                                                                                                                                        |
| OpenCode Go       | **disponible otra vez** | Consola: ventana de 5 h al 0 %, semanal 40 % usado (reinicia en 4 d 21 h), mensual 20 % usado (reinicia en 29 d 18 h), 0,00 $ de crédito; suscripción «Cancelled» activa 29 d 18 h. `gemini-4-argon#high` responde |
| DeepSeek          | **disponible**          | `deepseek-flash#high` y `deepseek-v4-pro#max` responden; `deepseek-v4.1-flash-free` se sobrecargó una vez                                                                                                          |

La cuota de OpenCode Go se recupera por la **ventana de 5 horas**, no por el día.
El error `OpenCode Go usage limit reached` no indica la hora de reinicio: se
consulta en la consola.

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
