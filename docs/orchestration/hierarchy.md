# Jerarquía de orquestadores por dominio

Este documento describe la jerarquía de orquestación que usa el proyecto. Es un
resumen operativo de `ORCHESTRATION.md` §12 (`C:/Users/paco_/.copilot/sdd/ORCHESTRATION.md`),
que es la fuente de verdad. No añade niveles ni reglas nuevas: si algo difiere,
manda la metodología.

Origen: tarea T-139 del plan (`specs/001-mvp-guias-builds/plan.md`, §17.49). Las
reglas de agente que lo aplican viven en `AGENTS.md` y en
`~/.copilot/agents/sdd-orchestrator-domain.agent.md`.

## Forma

```text
Orquestador de programa (nivel 0)
  ├── Orquestador de dominio A  →  subagentes  →  tareas
  ├── Orquestador de dominio B  →  subagentes  →  tareas
  └── Orquestador de dominio C  →  subagentes  →  tareas
```

Solo hay dos niveles. Un orquestador de dominio no crea otro nivel debajo de sí:
sus subagentes son ejecutores (`sdd-implement`, `sdd-ui`) o auxiliares
(`sdd-escalation`, `sdd-second-opinion`).

## Nivel 0: orquestador de programa

- Decide el alcance y reparte la tarea por dominio.
- Arbitra los conflictos entre orquestadores de dominio.
- Es el único que habla con el usuario.
- **No ejecuta.** Si se le descubre implementando, ha fallado el estándar.

## Orquestadores de dominio

- Ejecutan y verifican dentro de su dominio.
- Descomponen su tarea en sub-tareas auto-contenidas y las despachan a **sus
  propios subagentes**.
- Tampoco implementan lo que puede delegarse.

### Dominios por defecto

| Dominio                    | Trabajo típico                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| UI                         | Componentes, páginas, accesibilidad y capturas (`sdd-ui`).        |
| Tests y calidad            | Pruebas, propiedades, mutación y verificación de puertas.         |
| Backend                    | Lógica de dominio, API y base de datos (`sdd-implement`).         |
| Infraestructura y CI       | Pipelines, contenedores y secretos.                               |
| Contenido y derechos       | Contenido editorial y reglas de publicación y derechos.           |
| Herramienta y DX           | Herdr, Over9k y el flujo de trabajo del desarrollador.            |
| Acceso remoto              | Acceso a máquinas y servicios fuera del equipo local.             |

## Contrato de reporte

Todo agente devuelve **un** bloque con esta forma exacta y **máximo 12 líneas**
(`ORCHESTRATION.md` §3):

```text
[REPORTE] <rol> · <task-id> · <estado: OK | BLOQUEADO | PARCIAL>
Alcance:      <qué se hizo, 1-3 líneas>
Archivos:     <rutas tocadas>
Verificación: <comando> → <resultado> · <ruta del log o artefacto>
Desviaciones: <ninguna | lista con motivo>
Bloqueos:     <ninguno | qué falta y de quién depende>
Siguiente:    <acción concreta para el orquestador>
```

Reglas:

- `Verificación` cita **comandos ejecutados**, no intenciones. Si una comprobación
  no se ejecutó, no existe.
- `Desviaciones` compara lo ejecutado con lo planificado.
- `Bloqueos` nombra el dueño del bloqueo: el usuario, el proveedor o el entorno.

Un orquestador de dominio no reenvía el reporte de sus subagentes sin más. Lo
**agrega por tarea** en otro bloque con la misma forma, cuyo estado propio es
`OK`, `PARCIAL` o `BLOQUEADO`. Ese bloque agregado es el que recibe el nivel 0.

Un anuncio de despacho («he lanzado el agente») **no** acredita ejecución. Un
«verde» sin salida citable tampoco. El reporte solo cuenta con comando y salida.

## Propiedad de archivos y paralelismo

- Solo se trabaja en paralelo con tareas `[P]` de `tasks.md` y con **archivos
  disjuntos**.
- Si dos dominios necesitan el mismo archivo (`package.json`, `angular.json`,
  `tasks.md`, `handoff.md`), el nivel 0 **serializa** o asigna la edición a un solo
  dominio. Nunca se edita en paralelo.
- **Sin delegación cruzada**: un orquestador de dominio no despacha a otro dominio.
  Si necesita algo de otro dominio, escala al nivel 0, que arbitra.

## Ventanas de Herdr

- **Una ventana (espacio) por dominio y nunca una pestaña en la instancia del
  nivel 0.** Cada orquestador de dominio se abre en un **espacio nuevo** llamado
  `<proyecto>/<especialidad>` (minúsculas y guiones: `grim-dawn-builds/ui`,
  `grim-dawn-builds/tests`), con su propio agente orquestador interactivo y el
  prompt dentro de `argv`. La herramienta es `pnpm herdr:space` (ver
  [herdr.md](./herdr.md)); `--print` muestra el comando sin lanzar nada.
- **Máximo 2 terminales por espacio**. Un tercero abre otro espacio del mismo
  dominio, no una pestaña más en el actual.
- Cada terminal lleva **las dos etiquetas**: `herdr.space` y `herdr.tab`. Con solo
  `herdr.space` el terminal no aparece en la app.
- El harness debe ser **interactivo** (por ejemplo `opencode --auto --prompt "…"`).
  Un modo no interactivo no se reconoce como agente.
- Tras lanzar, `herdr-app ls` debe mostrar `app` y `status` **no nulos** para ese
  terminal. Si `status` es `null`, no es un agente visible y hay que relanzarlo.

El uso de los comandos, los errores conocidos y la supervisión de bloqueos están en
[herdr.md](./herdr.md).

## Escalado al nivel 0

Un orquestador de dominio para y escala al nivel 0 cuando:

- La especificación es ambigua o dos artefactos SDD se contradicen.
- La tarea exige tocar archivos que `tasks.md` no autoriza.
- Cambia el alcance, el contrato o la constitución.
- Hay una decisión de negocio o depende de un tercero.
- La verificación exige credenciales, acceso o una máquina que no existe en el entorno.
- Hay un riesgo que solo el nivel 0 puede aceptar.

Límites: máximo **5 intentos totales** por sub-tarea y **3 iteraciones** antes de
escalar al usuario. El escalado lleva la lista exacta de lo que falta.

## Presupuesto de modelos

- Cada orquestador de dominio declara el modelo con el que trabaja.
- El nivel 0 aplica la cadena de fallback de `AGENTS.md` cuando el primario falla.
- El modelo **realmente usado** se consigna en `handoff.md`, no el planificado.
- No se cambia el modelo del orquestador sin avisar; el cambio afecta a los
  subagentes.

## Registro

- `tasks.md` es la verdad de las tareas. Solo el nivel 0 o el orquestador que posea
  ese archivo lo escribe.
- El To-do de Over9k (`~/.local/share/over9k/todos/<slug>.md`) refleja lo mismo: una
  tarea cerrada se marca `[x]` también ahí.
- `handoff.md` registra el estado, los modelos usados y los límites del entorno.

## Prueba de que el estándar se cumple

El nivel 0 demuestra el cumplimiento con tres hechos, no con intenciones:

1. Cada dominio activo tiene su propia ventana de Herdr y un orquestador
   identificable.
2. Cada orquestador de dominio despachó al menos una sub-tarea a un subagente
   propio, con reporte.
3. El nivel 0 verificó esos reportes con comandos y salida real.

## Resumen: nivel 0 frente a orquestador de dominio

| Aspecto                  | Nivel 0 (programa)                            | Orquestador de dominio                                                |
| ------------------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| Decide / ejecuta         | Decide alcance y reparto. **No ejecuta.**     | Ejecuta y verifica su dominio. Tampoco implementa lo delegable.       |
| Delega                   | Reparte por dominio.                          | Despacha sub-tareas auto-contenidas a **sus propios subagentes**.     |
| Habla con el usuario     | Sí, es el único.                              | No. Escala al nivel 0.                                                |
| Verifica                 | Los reportes agregados de cada dominio.       | Los reportes de sus subagentes, con comandos y salida.                |
| Cierra la tarea en `tasks.md` | Sí, tras verificar el reporte agregado.  | No la marca en `tasks.md`; reporta al nivel 0.                        |
| Modelo                   | Aplica la cadena de fallback de `AGENTS.md`.  | Declara el modelo con el que trabaja.                                 |

## Ensayo real con orquestadores de dominio (2026-11-11)

Esta sección registra el ensayo real que cumple la prueba de la sección
[Prueba de que el estándar se cumple](#prueba-de-que-el-estándar-se-cumple). Corrió
con cinco orquestadores de dominio en paralelo, en ventanas y sesiones distintas de
Herdr, con archivos disjuntos:

| Dominio (ventana) | Archivos de su propiedad                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| derechos2         | `packages/domain` (contratos de derechos/adaptaciones) y `scripts/check-scope.*`                               |
| calidad           | `packages/domain/src/*.property.spec.ts`, `docs/orchestration/**`, `specs/001-mvp-guias-builds/{quickstart,handoff,tasks}.md` |
| i18n              | `angular.json` y `src/app/**`                                                                                  |
| ci                | `.github/workflows/**` y `playwright.config.ts`                                                                |
| rendimiento       | Cerrado con T-145 (puerta de rendimiento).                                                                     |

Hechos registrados:

1. **Contrato de reporte idéntico en los dos niveles.** El mismo bloque `[REPORTE]`
   del §3 que devuelve un subagente es el que agrega el orquestador de dominio, con
   su propio estado.
2. **Dos serializaciones reales, arbitradas por el nivel 0:**
   - `scripts/check-scope.mts` y `scripts/check-scope.test.mts`: la edición quedó
     asignada a **derechos2**; el dominio de calidad/docs no los tocó.
   - `package.json` (raíz): la edición quedó asignada a **ci**; calidad no lo tocó. La
     dependencia de pruebas (`fast-check`) se declaró en `packages/domain/package.json`,
     verificado con `git diff -- package.json` vacío.
3. **Cero ediciones cruzadas.** El diff final del dominio de calidad no contiene
   ningún archivo de `src/app`, `apps/api`, `.github`, `angular.json`,
   `scripts/check-scope.*` ni de la puerta de rendimiento.
4. **Verificación por el nivel 0.** La verificación la hizo el nivel 0 sobre los
   reportes agregados, no sobre las afirmaciones de los agentes.

Con estos tres hechos del §12 quedan cumplidos: cada dominio tiene su ventana y su
orquestador, cada orquestador despachó a sus subagentes con reporte, y el nivel 0
verificó esos reportes con salida real. Con esta evidencia, T-139 queda cerrada.

## Referencias

- Plan, §17.49 (T-139): `specs/001-mvp-guias-builds/plan.md`.
- Metodología, §12 (estándar de delegación paralela): `C:/Users/paco_/.copilot/sdd/ORCHESTRATION.md`.
- Reglas del repositorio: `AGENTS.md`, secciones «Orquestación y reporte al orquestador»,
  «Correspondencia de modelos y cadena de fallback» y «Uso».
- Operación de Herdr: [herdr.md](./herdr.md).
