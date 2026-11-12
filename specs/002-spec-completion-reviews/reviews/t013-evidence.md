# Evidencia saneada de T013

Este archivo conserva, dentro del repositorio, extractos literales y saneados de
la validación conductual de T013. Los datos del fixture son sintéticos; no se
incluyen secretos, credenciales ni datos personales.

- **Corrida**: 11111619, 2026-11-12, Node v22.12.0, Windows con PowerShell.
- **Fixture**: `%TEMP%\opencode\t013-fixture`, fuera del repositorio y con tres
  raíces independientes: `feature-pendiente`, `feature-defecto` y
  `feature-documental`. El modo con delegación usó
  `%TEMP%\opencode\t013-fixture\feature-defecto-delegado`.
- **Referencias secundarias** (fuera del repositorio, no versionadas):
  `C:\Users\paco_\.config\orquestacion\runs\11111619\t013-evidence.md` y
  `C:\Users\paco_\.config\orquestacion\runs\11111619\t013-evidence-delegado.md`.
- **Independencia**: el fixture lo construyó un agente y lo evaluó otro distinto,
  sin recibir los defectos esperados ni compartir contexto con el implementador.

## 1. Hook y fallback del harness

El registro local es el mismo que versiona el repositorio:

```yaml
hooks:
  after_implement:
    - extension: spec-review
      command: speckit.review.complete
      enabled: true
      optional: false
```

Comprobaciones reales sobre OpenCode:

| Comprobación | Resultado |
| --- | --- |
| Contenido de `%USERPROFILE%\.config\opencode\opencode.json` | Solo `$schema` y `model`; no define comandos. |
| `Test-Path` de `command`, `commands`, `agent` y `plugin` bajo esa configuración | `False` en los cuatro. |
| `Test-Path .opencode/` en el worktree y en el fixture | `False`. |
| `Select-String 'speckit'` sobre la configuración de OpenCode | Sin coincidencias. |
| Catálogo de skills de la sesión | Solo `opencode` y `report`; no incluye `speckit-review-complete`. |

**Resultado: fallback.** Se cargó explícitamente
`.agents/skills/speckit-review-complete/SKILL.md`, byte-idéntico al del
repositorio, y se siguió su flujo. La entrada YAML, un `EXECUTE_COMMAND` o un
anuncio de despacho no se contaron como ejecución.

**Límite de capacidad**: la metodología de orquestación prohíbe delegar en
subagentes internos de la CLI, así que este escenario usó cuatro auto-revisiones
separadas (`mode: self-review`, `delegationAvailable: false` y
`capabilityReason` en cada `Review`). El despacho automático por un router de
comandos sigue **no verificado**.

## 2. Tarea pendiente: sin despacho

Comando desde `%TEMP%\opencode\t013-fixture\feature-pendiente`:

```text
node scripts/spec-review.mjs prepare --feature specs/feature-pendiente
```

Salida real:

```json
{"status":"pending-tasks","feature":"specs/feature-pendiente","pendingTasks":[{"id":"T-002","line":5}],"excludedTasks":[],"reasons":["active implementation tasks remain unchecked"]}
```

```text
exit 1
```

No se creó `specs/feature-pendiente/reviews/` (`Test-Path` = `False`), no se
despacharon revisiones y el árbol conservó sus 42 archivos. El escenario se
repitió después del resto del trabajo con el mismo JSON, el mismo código de
salida y la misma huella.

## 3. Defecto real: bloqueado

Prepare desde `%TEMP%\opencode\t013-fixture\feature-defecto`:

```text
node scripts/spec-review.mjs prepare --feature specs/feature-defecto
```

```json
{"status":"ready","feature":"specs/feature-defecto","snapshot":"c2a6d6867185444cea4a409144112563b8732cedc47b3f42c78c905d93e0dfd2","pendingTasks":[],"excludedTasks":[],"reasons":[]}
```

```text
exit 0
```

Los cuatro pases fueron `completed` y encontraron, sin conocerlos de antemano:

| ID | Severidad | Ubicación | Defecto |
| --- | --- | --- | --- |
| CD-001 | CRITICAL | `app/api/public.js:20` | La lectura por identificador no aplica la puerta de publicación. |
| SEC-001 | CRITICAL | `app/api/public.js:20` | Un lector no autenticado obtiene material en revisión o sin derechos. |
| AR-001 | HIGH | `app/web/lesson-page.js:2` | La web importa `app/api/internals/catalog.js`, contra la frontera aprobada. |
| AR-002 | HIGH | `app/api/public.js:20` | La lectura por identificador contradice el criterio de publicación del plan. |
| CD-002 | MEDIUM | `tests/content.test.mjs:23` | La suite no cubre la lectura negativa por identificador. |
| BP-001 | MEDIUM | `tests/content.test.mjs:23` | La verificación no cubre CA-001 en el detalle y da una señal engañosa. |

Comprobación conductual directa del defecto:

```json
{"getLessonContent_riego":{"id":"riego-automatico","hasBody":true},"renderLessonPage_status":200,"renderLessonPage_containsBody":true}
```

Check del coordinador:

```text
node scripts/spec-review.mjs check --feature specs/feature-defecto
```

```json
{"status":"blocked","feature":"specs/feature-defecto","reasons":["4 open CRITICAL/HIGH finding(s)"]}
```

```text
exit 1
```

**Recuento exacto del fixture**: 4 hallazgos CRITICAL/HIGH abiertos
(2 CRITICAL: CD-001 y SEC-001; 2 HIGH: AR-001 y AR-002) más 2 MEDIUM abiertos
(CD-002 y BP-001). El veredicto bloqueado lo sostienen los cuatro CRITICAL/HIGH;
los MEDIUM no habilitarían `passed` sin disposición. Este extracto es la fuente
para la corrección del recuento de T013.

## 4. Cambio documental sin hallazgos: pasa

Prepare desde `%TEMP%\opencode\t013-fixture\feature-documental`:

```text
node scripts/spec-review.mjs prepare --feature specs/feature-documental
```

```json
{"status":"ready","feature":"specs/feature-documental","snapshot":"3a7ffe4b625415725da8657122b79826fca1e53d8c41678a35ac683e43de264f","pendingTasks":[],"excludedTasks":[],"reasons":[]}
```

```text
exit 0
```

Los cuatro pases fueron `completed`, con cobertura explícita y **cero**
hallazgos. La comprobación conductual confirma que la lección en revisión ya no
se sirve:

```json
{"getLessonContent_riego":null,"renderLessonPage_status":404,"renderLessonPage_containsBody":false}
```

Check del coordinador:

```text
node scripts/spec-review.mjs check --feature specs/feature-documental
```

```json
{"status":"passed","feature":"specs/feature-documental","snapshot":"3a7ffe4b625415725da8657122b79826fca1e53d8c41678a35ac683e43de264f","reasons":[]}
```

```text
exit 0
```

No se inventaron defectos para justificar el cierre: las cuatro especialidades
describieron su cobertura real y el informe quedó sin hallazgos.

## 5. Modo con delegación externa: bloqueado

Un revisor independiente distinto del implementador emitió los cuatro `Review`
en `mode: independent` y un coordinador distinto consolidó el informe. El
snapshot fue el mismo `c2a6d686…dfd2`.

```text
node scripts/spec-review.mjs check --feature specs/feature-defecto
```

```json
{"status":"blocked","feature":"specs/feature-defecto","reasons":["3 open CRITICAL/HIGH finding(s)"]}
```

```text
exit 1
```

Este escenario tiene 3 CRITICAL/HIGH abiertos (2 CRITICAL: CODE-001 y SEC-001;
1 HIGH: ARCH-001) más 1 MEDIUM (BP-001). No debe confundirse con el recuento de
4 CRITICAL/HIGH del escenario de auto-revisión de la sección 3.

La delegación la ejecutó el orquestador del área al lanzar al revisor separado,
no un subagente interno de la CLI. La limitación queda declarada junto al
resultado.

## 6. No mutación y saneado

| Escenario | Archivos antes | Archivos después | Única escritura |
| --- | --- | --- | --- |
| `feature-pendiente` | 42 | 42 | Ninguna. |
| `feature-defecto` | 42 | 43 | `specs/feature-defecto/reviews/completion-review.json`. |
| `feature-documental` | 42 | 43 | `specs/feature-documental/reviews/completion-review.json`. |

Los hashes de `app/`, `tests/`, `docs/`, los artefactos SDD y el helper no
cambiaron; `prepare` devolvió el mismo snapshot antes y después de escribir los
informes. La búsqueda local de patrones de credenciales y secretos no encontró
coincidencias en los tres escenarios.

## 7. Límites de esta evidencia

- Sin router de comandos, el hook se sustituyó por la carga explícita del
  `SKILL.md`; no se afirma despacho automático.
- El escenario principal usó auto-revisión porque la metodología prohíbe
  subagentes internos de la CLI; el modo con delegación externa se documenta por
  separado.
- Sin DAST, sin auditoría de dependencias, sin navegador/E2E y sin historial Git
  en el fixture; por tanto no hubo diff contra un commit base.
- La validación estructural de `check` no demuestra por sí sola la ejecución de
  los pases; la prueba es la salida real de los comandos y la inspección del
  código.
