# Modelos, fallback y errores del proveedor

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
