# Relevo: T-036 completada

Estado al 2026-11-10: T-033, T-135, T-034, T-035 y T-036 completadas. T-037 y
T-020 tienen planificación vigente en plan §17.42–§17.43. La spec001 sigue
abierta y la puerta de revisión spec002 queda pendiente. Este turno se limitó
a T-036 y no hubo commit, push ni PR.

## Interrupción de la sesión y límite de modelos (2026-11-10)

La sesión se interrumpió por orden expresa del usuario durante la fase de
planificación. El subagente `sdd-plan` que redactaba §17.40–§17.43 fue
interrumpido explícitamente (`POST /api/session/<id>/interrupt`, resultado
`{"interrupted":true}`, `outcome: interrupted`) **después** de escribir las cuatro
secciones y las cuatro líneas de tarea. Lo que quedó a medias:

- **`T-021` (sitemap/robots) NO se planificó**: no existe §17.44 y su línea en
  `tasks.md` conserva la redacción original. Queda pendiente de planificación.
- `quickstart.md` y este `handoff.md` **sí** registran la fase de planificación
  (sección «T-035–T-037/T-020: planificación y análisis — 2026-11-10»).
- No se inició ninguna implementación de T-035/T-036/T-037/T-020: no existen
  `src/app/features/build/video-facade/`, `src/app/features/build/attribution/`,
  `src/app/features/build/toc/` ni `src/app/features/build/build.page.ts`.

Verificación del estado tras la interrupción:

- `node scripts/spec-review.mjs prepare --feature specs/001-mvp-guias-builds`:
  `pending-tasks`, salida 1, 71 tareas pendientes y 4 excluidas
  (T-007/T-008/T-011/T-013). Los artefactos SDD son coherentes y parsean.
- `./node_modules/.bin/markdownlint-cli2.cmd`: 43 archivos, 0 incidencias.
- `pnpm check:contrast`: 12 pares, mínimo 5.811:1 (paleta Cairn de T-135).

### Límite de modelos de pago agotado

Durante esta sesión los proveedores de pago agotaron su saldo:

- `opencode-go/*` (todos los modelos de la tabla de `AGENTS.md`): error
  `OpenCode Go usage limit reached`. Además, los modelos gratuitos de ese
  proveedor (`opencode-go/longcat-2.5-free`) rechazan la región de la cuenta con
  `This OpenCode Go model is hosted outside Europe and the United States`.
- `opencode/*` de pago: error `Insufficient balance` con enlace de recarga en
  `https://opencode.ai/console/org_01M739ZZN930PXT13QR6H0QVBB/billing`.

Modelos libres que sí respondieron y pueden usarse en el siguiente turno:
`opencode/deepseek-v4.1-flash-free` (usado con `#high` para esta planificación),
`opencode/glm-5.3-flash-free`, `opencode/flint-40b-free`,
`opencode/nemotron-3.5-super-vl-free`, `opencode/longcat-2.5-free`.
La tabla de `AGENTS.md` sigue siendo la referencia de los roles; si el turno
siguiente solo dispone de estos modelos libres, `sdd-plan` y `sdd-ui` deben
cumplir su rol con ellos y dejar constancia del modelo realmente usado.

## Lectura y reglas para el siguiente agente

Leer primero AGENTS.md, CONTRIBUTING.md, .specify/memory/constitution.md y los
artefactos spec.md, plan.md y tasks.md de esta carpeta. SDD con GitHub Spec Kit
es obligatorio para cualquier harness/proveedor. Retomar el plan existente,
no regenerarlo ni marcar tareas sin evidencia. Los skills están en .agents/skills;
los roles y la correspondencia de modelos están referenciados por AGENTS.md.
Una tarea a la vez. T-033/T-135/T-034/T-035/T-036 quedaron completadas; T-037 y
T-020 siguen planificadas.

El objetivo completo sigue siendo acabar y validar toda la spec001. Solo después
se autorizó hacer push y abrir una PR hacia develop, nunca solo al cerrar una tarea.
La puerta real de cuatro revisiones de spec002 sigue siendo obligatoria al cierre.

## Planificación T-035–T-037/T-020 (2026-11-10)

Se añadieron a plan.md las secciones densas §17.40 (`T-035`, fachada de video),
§17.41 (`T-036`, atribución/fuentes y TOC), §17.42 (`T-037`, página ensamblada) y
§17.43 (`T-020`, rutas lazy, prerender, resolver y 404 con estado). tasks.md
conserva los cuatro checkboxes abiertos con las listas exactas de archivos y
criterios de aceptación; no se marcó ninguna tarea.

La planificación se contrastó con el código y el esquema vigentes, no con el
resumen de la petición. Hallazgos que condicionan la implementación:

- `AuthorSchema`/`PublicAuthorSchema` no tienen `role_label` ni exponen
  `is_placeholder` en el DTO público: `T-036` recibe un flag `authorPlaceholder`
  calculado por el servidor y no inventa un rol.
- `BuildContentSchema` no tiene `updated_at`: `T-036` muestra `published_at` o
  «Sin fecha» y no simula una fecha de actualización.
- `SourceSchema` no tiene `site`: se deriva el hostname de la URL validada.
- La guía migrada no tiene nota `Descargo`; `T-036` usa `footer_disclaimer` como
  descargo único cuando la nota no existe.
- Los `section_key` reales son `habilidades`, `filtro-de-botin` y
  `guia-espiritual`; los `id` canónicos son los de plan §2.
- `PublicBuild.author` no permite detectar placeholder; `T-020` normaliza la vista
  local y pasa `authorIsPlaceholder` sin filtrar campos privados.
- El snapshot de `TransferState` es por ruta; la navegación cliente entre guías no
  está soportada y no es alcanzable con 0 guías públicas. Límite registrado.

`speckit-analyze` acotado sobre spec.md/plan.md/tasks.md: **0 CRITICAL**, **0 HIGH**,
**1 MEDIUM** y **4 LOW**. El MEDIUM es la ausencia de `updated_at` frente al
subrequisito de fecha de actualización de FR-02: se acota a `published_at`/«Sin
fecha» y se remite a una enmienda de T-006 si el usuario exige esa fecha. Los LOW
son `role_label`, el campo `site`, la nota «Descargo» ausente y los `section_key`
reales; todos quedaron resueltos o acotados explícitamente en §17.40–§17.43.
`T-020` incluye además el cableado FR-16 de descriptores públicos aprobados.
`markdownlint-cli2` pasa en los 43 archivos Markdown.

Esta fase se ejecutó con `opencode/deepseek-v4.1-flash-free#high` porque los
modelos de pago de `opencode-go` habían agotado su límite (ver la sección de
interrupción más arriba). El modelo usado queda registrado para no atribuir a
`gemini-4-argon#high` un trabajo que no ejecutó.
`node scripts/spec-review.mjs prepare --feature specs/001-mvp-guias-builds`
devuelve `pending-tasks` con salida 1, como corresponde a las tareas activas aún
abiertas.

## T-033: implementación y evidencia final

Plan §17.37 fue actualizado para registrar la autorización de reanudación
(2026-11-10). T-033 implementa el componente OnPush controlado y su preview
sintético; no modifica DevotionMap, rutas, dominio, dependencias ni API.

Verificación ejecutada:

- RED antes del componente: `$env:TEMP/gd-t033-red.log` (import de
  `./devotion-section` ausente, salida 1).
- GREEN: builder Angular, componente + DevotionMap intacto, 20/20 pruebas en 2
  suites; log `$env:TEMP/gd-t033-green.log`.
- Dominio y `devotion-section-preview` construidos. Playwright/axe en 375/768/1280:
  cero axe en hidratado y bundles de la app bloqueados, selección teclado/touch,
  foco visible 2px/conservado, filas null, SSR/no-JS, texto 200% sin overflow,
  consola limpia y cero requests externos/API. Capturas inspeccionadas en
  `$env:TEMP/gd-t033-{375,768,1280}.png`.
- `pnpm lint`, `format:check`, `lint:md`, `build`, `check:initial-js`,
  `check:public-build`, `check:secrets`, `check:contrast`, `check:scope`,
  `check:boundaries`, `build:release` (API) y `check:release` pasan. Impeccable
  4.8.1 `detect --json` devolvió `[]`. Comandos completos en [quickstart.md](quickstart.md).
- El artefacto release no emite el preview ni la ruta `/builds`; no contiene los
  textos sintéticos ni los cuerpos de pasos locales. `stats.json` conserva registros
  virtuales de CSS de previews que Angular no emite; no hay salidas JS de preview.
- Se detuvieron el servidor 4306 y se eliminó únicamente
  `dist/devotion-section-preview`. Capturas/logs TEMP se conservan como evidencia.

T-033 está marcada `[x]` en tasks.md tras verificar sus criterios. T-034 se autorizó
en el relevo posterior; esta nota conserva únicamente el cierre histórico de T-033.
La spec001 permanece abierta.

## T-034: implementación y evidencia final

RED por módulo `./loot-filter` ausente y GREEN 12/12 pruebas: logs
`$env:TEMP/gd-t034-red.log` y `gd-t034-green.log`. Las pruebas cubren paridad de
fixtures, orden/inmutabilidad, columnas y reglas, labels de acción, notas,
visibilidad/vacío, posiciones duplicadas, SSR, IDs, escape y Clipboard API.

`@gd/domain` y `loot-filter-preview` compilan. El preview es sintético, prerenderizado
y aislado; no importa la build editorial pendiente. El CSS del filtro pasa el
warning de 4 kB configurado en su build. Playwright/axe en 375/768/1280: 0
violaciones hidratado y con bundles app bloqueados; el DOM con JavaScript desactivado
se comprobó aparte. Teclado Enter/Espacio en `<summary>`, copia con Enter, clipboard,
texto 200 % y cero overflow pasan. Capturas TEMP `gd-t034-{375,768,1280}.png`
inspeccionadas; servidor 4314 detenido y `dist/loot-filter-preview` eliminado.

Pasan lint, format, markdownlint, check:secrets, build, initial-js, public-build,
build:release desde API y check:release. Impeccable 4.8.1 `detect --json`: `[]`.
Detalle y logs en [quickstart.md](quickstart.md). Sin cambios fuera de los archivos
autorizados, dependencias ni datos de producción.

## T-035: implementación y evidencia final

Fachada y preview sintético verificados según §17.40. RED por ausencia del
módulo y GREEN de 24 pruebas. Axe dio cero violaciones en el preview hidratado
y con bundles bloqueados a 375/768/1280. Se verificaron también el DOM sin JS,
la activación por teclado, el bloqueo real CSP y los checks de build y release.
Detalles, comandos y capturas en [quickstart.md](quickstart.md).

La implementación inicial se ejecutó en la sesión principal de Codex. Tras
recibir la instrucción de orquestación, `sdd-ui` (`gpt-6-luna`, razonamiento
`high`) corrigió el nombre accesible duplicado de las regiones del preview.
La sesión principal recompiló, repitió las pruebas y verificó el resultado en
Chrome. Se autorizaron ejecuciones fuera del sandbox para el test, el build y
los checks afectados por los permisos de Windows.

## T-036: implementación y evidencia final

Atribución, fuentes y TOC verificados según §17.41. RED por ausencia de ambos
módulos y GREEN de 46 pruebas (32 de atribución y 14 de TOC). El preview
`build-meta-preview` prerenderizó dos instancias sintéticas; Playwright + axe
dieron 18/18 combinaciones OK y cero violaciones, con sticky a 1280, `details`
plegable, foco de 2 px, ancla no tapada y sin overflow ni con texto al 200 %.
El CSS de los componentes mide 4023/1788 bytes. Pasan `pnpm lint`, `pnpm build`,
`check:initial-js`, `check:public-build` (175 archivos), `check:secrets` (126),
`lint:md` (44) e Impeccable `[]`; `format:check` global falla solo por
`AGENTS.md`, archivo previo ajeno a la tarea. El primer `check:public-build`
falló por el preview sintético aún presente en `dist`; se retiró y se repitió.
Detalle, comandos y logs en [quickstart.md](quickstart.md).

La implementación y verificación se ejecutaron con
`opencode/deepseek-v4.1-flash-free` (modelo realmente usado; los proveedores de
pago seguían agotados). Sin cambios fuera de los archivos autorizados,
dependencias ni datos de producción.

## Procesos y árbol de trabajo

### Corrección verificada de anclas T-036 (2026-11-10)

La reserva de desplazamiento dejó de depender de JavaScript: CSS del TOC aplica
`scroll-margin-block-start` con tokens a secciones y los diez ids canónicos en
su `main`; el padding hidratado permanece como refuerzo. El encargo identificó
seis fallos reales en `placeholder` sin bundles/JS; el runner original ahora
registra **18/18 OK, cero fallos** (no 12 combinaciones: esa cifra del encargo
no coincide con la matriz existente). RED/GREEN de regresión y **47/47** pruebas,
lint/formato/Markdown, build, JS inicial, guardia pública y presupuestos pasan;
preview retirado y puerto 4331 libre. Evidencia vigente en `quickstart.md`,
sección «T-036: regresión de anclas sin JavaScript», y
`$env:TEMP/gd-t036-anchor-*.log`.

Modelo realmente usado en esta corrección: `openai/gpt-6.1-sol`, rol `sdd-ui`.
Al iniciar esta sesión `tasks.md` ya tenía T-036 marcada y el inventario ya la
declaraba completada, a diferencia del estado descrito en el encargo; no se
atribuyen esas marcas a esta corrección. El resultado actual permite mantener
T-036 completada, pendiente de la comprobación de primera mano del orquestador.
T-037/T-020 y el cierre integral de spec001 permanecen pendientes. Sin commit,
push ni PR; no se modificaron otros componentes ni configuraciones existentes.

Histórico del primer relevo: el agente /root/t031_ui había sido interrumpido y el
agente de planificación había terminado.
Se localizaron dos procesos antiguos node.exe ejecutando gd-t048-browser.mjs,
PIDs39428 y21912. Se detuvieron ambos y sus descendientes:10 procesos del grupo;
la comprobación inmediata mostró0 supervivientes. No se identificó por duración
un proceso concreto de58min: estos son los procesos relacionados encontrados.
No se encontraron procesos Node de devotion-section ni servidores preview430x
persistentes en esa inspección. No se detuvieron PostgreSQL/API ni se borraron datos.

Rama actual `mvp/1`, HEAD `62cb319` (comprobado tras T-033). Árbol amplio compartido
sin commit: no resetear, limpiar ni atribuir todos los cambios a T-033. El hook
pre-commit ya estaba staged antes de esta tarea; preservar modo `100755` y LF. Los
archivos T-033/T-034 quedan sin commit junto con los cambios previos. No añadir secretos.

## Última evidencia verificada antes de T-033

- T-030 cerrada:24 e2e SVG, verify general y release/API verdes.
- T-031 cerrada:8 tests,9 combinaciones de navegador,6 axe sin violaciones,
  capturas3anchos y release/guardias. Secciones estáticas aún sin ruta de guía.
- T-032 cerrada:18 tests nuevos y8 SkillTree intactos;9 combinaciones de navegador,
  6 axe sin violaciones y4 casos de storage corrupto/denegado. Opt-in, persistencia,
  borrado y aislamiento de guías/revisiones comprobados. Corrección final de
  marcadores desktop y espacio ES/EN verificada con prueba roja/verde y capturas.
- Último release desde API y check:release pasan: gd-t032-release-final.log.
  Home0/tier105096bytes gzip, guard público127 archivos; no preview en artefacto.
- Último escaneo antes de iniciar T-033: 380 fuentes, guard0/Gitleaks nativo0,
  14 outputs browser sin Zod/resolver de servidor/preview. Ese resultado no
  acreditaba el trabajo nuevo; la verificación T-033 está registrada arriba.

Evidencia detallada y comandos en quickstart.md. Logs/capturas locales bajo
$env:TEMP/gd-t030-_, gd-t031-_ y gd-t032-*; son temporales, no parte del repo.
Playwright guarda el informe T-030 ignorado en playwright-report/svg/index.html.
Los servidores4304/4305 y sus directorios preview se limpiaron tras verificarlos.
El artefacto de release desde API quedó conservado.

## Entorno para retomar

PowerShell, Node22.12.0 y pnpm12.18.0; package.json/lockfile son la referencia.
En esta máquina las herramientas se usaron desde $env:TEMP/gd-t057-tools:

```powershell
$env:PATH=(Join-Path $env:TEMP 'gd-t057-tools')+';'+$env:PATH
$env:NG_BUILD_MAX_WORKERS='2'
$env:SPECIFY_FEATURE_DIRECTORY=(Resolve-Path 'specs/001-mvp-guias-builds').Path
$env:SPECIFY_FEATURE_NO_PERSIST='1'
.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks
```

Chromium local está en $env:TEMP/gd-ui-browser-binaries; establecer
PLAYWRIGHT_BROWSERS_PATH para reutilizarlo. Playwright1.65.0 y axe-core4.14.0
ya están fijados como devDependencies. No añadir imports desde TEMP al repositorio.
Si faltan cachés, instalar herramientas desde sus fuentes oficiales; no inventar
que las pruebas anteriores volvieron a ejecutarse. Gitleaks nativo8.30.1 se prepara
con pnpm setup:gitleaks. No necesita excepciones amplias ni mostrar secretos.

## Decisiones y límites que se conservan

- Nunca subir tokens, contraseñas, archivos .env/secrets ni volcarlos a argv/logs.
- PostgreSQL es fuente editorial de producción. Release requiere CONTENT_SOURCE=api;
  fixture solo desarrollo/test/CI. API pública de solo lectura, editor CLI local.
- Conservar grim-dawn-builds-pgdata: nunca down -v sobre el entorno principal.
  Hay6 migraciones hasta0005. La guía original sigue borrador/pending;0 guías públicas.
- Roles separados migrator/api_ro/importer/editor y secretos en archivos ignorados.
  No registrar SQL/parámetros sensibles. Diagnóstico PostgreSQL ya configurado.
- Límite WSL/Docker de RAM4GB ya aplicado; MemTotal observado4104323072bytes.
  No confundir memoria con un nuevo límite de CPU.
- CORS autorizado únicamente `http://localhost:4200`. B-5/B-7 ya resueltas.
- ZAP/Trivy deben bloquear desde severidad MEDIA, decisión expresa del usuario.
- /legal y T-102 esperan un canal real de contacto: ya se preguntó correo/URL,
  sin respuesta; no inventarlo ni elegir GitHub Issues por cuenta propia.
- Sin confirmar derechos no publicar la guía ni la primera adaptación real.
  T-044/T-110 tienen disposición externa y no autorizan enviar mensajes a terceros.
- No mover Angular a apps/web ni implementar comunidad/ingesta/hosting diferidos.
- Todos los presupuestos de plan §6 permanecen; DevotionMap está en7989/8000bytes
  gzip propios según T-029. No ampliar límites para conseguir verde.

## Puntos de revisión pendientes, no defectos confirmados

- AuthorPage lee snapshot de ruta: comprobar reutilización al navegar entre autores
  antes de cerrar T-039; no dar por correcto ese caso sin prueba.
- SVG Esc solo cierra cuando hay selección: reproducir si también debe cerrar
  detalle de foco/hover conforme a spec. selectNode sí restablece detailDismissed.
- Medir límite de6queries POR PÁGINA en build al integrar T-020/T-037: las3SQL por
  petición API no demuestran el presupuesto por página. No reinterpretar el límite.
- T-020 aún debe transportar descriptores de activos aprobados desde API;
  la prueba fixture de T-048 no acredita ese cableado.
- Anclas TOC: T-036 verificó ruta/query y base href con pruebas y Playwright;
  T-134 corrigió skip-link.
- Las pruebas DB/rotación opt-in omitidas por verify no equivalen a ejecución real;
  NVDA humano, Lighthouse, CI remoto y las cuatro revisiones globales siguen pendientes.

## Inventario de tareas de spec001

Recuento mecánico de las líneas de tareas de tasks.md vigente, con todos los
ítems pendientes normalizados al formato `- [ ] **T-xxx**`. Un checkbox abierto
cuenta como no cerrado; puede haber implementación parcial que requiere
verificación, no rehacerla a ciegas. Los checkboxes históricos tampoco sustituyen
la auditoría final de requisitos.
Total: **138** tareas; **69** marcadas completas (`[x]`); **69** sin cerrar (`[ ]`).

| Categoría   | Cantidad |
| ----------- | -------: |
| activa      |       39 |
| externa     |        2 |
| opcional    |        2 |
| diferida    |       22 |
| reemplazada |        4 |

### Categoría: activa

| ID     | Trabajo pendiente según tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-001  | Generar app Angular (standalone, SSR/prerender estático, strict, CSS, i18n) en la raíz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T-002  | Configurar lint/format, .editorconfig, .gitignore, scripts npm (content:validate, content:import, test, e2e, lhci)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| T-003  | Presupuestos de bundle en angular.json según plan §6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-004  | Verificación local unificada (lint, test, build público y con INCLUDE\_DRAFTS) como pnpm verify; **CI de despliegue diferida** (hosting=local\_first); el CI de verificación en PR se trata en T-064                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-012  | Medición base de presupuesto: página vacía con hidratación, Lighthouse CI **local**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| T-020  | Rutas lazy de `/builds/:slug`, `getPrerenderParams` filtrado por derechos, resolver con `TransferState`, 404 real y cableado FR-16 de descriptores públicos; plan §17.43.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| T-021  | Generador de sitemap.xml y robots.txt solo con publicado y derechos aprobados; BASE\_URL configurable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-025  | [UI] Página /tier-list con SSG, catálogo por combinación, filtros hidratados desde ?, canonical base, JSON-LD ItemList (solo entradas públicas)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-037  | [UI] Página `/builds/:slug` ensamblada con `@defer` y placeholder textual, estado de devociones, SEO `Article`/`BreadcrumbList`, banner y `noindex` de borrador; plan §17.42.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-039  | [UI] /autores/:slug, /acerca, /legal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-040  | E2E completos US1–US3 × 3 viewports + HTML sin JS (US1 en modo local INCLUDE\_DRAFTS; además, e2e del build público sin la guía migrada)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| T-041  | axe en 3 rutas × 3 viewports local y CI de verificación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-042  | Lighthouse local con presupuestos y medición gzip/HTML (plan §6), integrado en CI de verificación por T-126                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T-043  | Revisión manual: teclado + NVDA + contraste; checklist en specs/001-mvp-guias-builds/checklists/a11y.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-045  | [LISTA; solo hosting diferido] Vista previa local del artefacto estático y README del flujo editorial/local; documentar variables (BASE\_URL, INCLUDE\_DRAFTS) sin secretos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T-046  | Verificación de fuera de alcance: no existen auth, comentarios, calculadora, scraping, workers, ni archivos de arte oficial sin aprobar, ni secretos/workflows de **deploy**; (rev. 3) tampoco Redis, colas, proveedores de auth externos, almacenamiento de objetos ni más de un servicio de aplicación + una BD en Compose (grep sobre dependencias/rutas/public/src/assets/infra/)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-077  | [LISTA] Job de DAST gratuito en PR (ZAP baseline contra web/API levantadas localmente en el runner, sin secretos ni objetivos remotos); umbral decidido por el usuario: **bloquear desde severidad MEDIA** (MEDIA/ALTA, y CRÍTICA si la herramienta la expone), sin excepciones silenciosas; revisión de Copilot por regla de rama manual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| T-066b | [LISTA] Pruebas contenedor/Compose en CI: no-root, sin .env/secretos en imagen, db sin ports por defecto, Trivy con **bloqueo desde severidad MEDIA** (MEDIA/ALTA/CRÍTICA), decisión del usuario 2026-11-09; sin ignorar hallazgos no corregidos silenciosamente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T-065  | [LISTA] Jobs de CI del backend: tests de integración con PostgreSQL (servicio de contenedor), docker compose config, build de imagen sin push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-068  | [LISTA] Prueba de equivalencia (AC-17): sembrados los mismos fixtures en BD, el build prerenderizado con CONTENT\_SOURCE=api es equivalente (HTML, sitemap, JSON-LD) al de fixture                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| T-070  | [LISTA, parcial] Documentar monorepo y flujo local en README.md: layout objetivo, comandos pnpm, GitFlow/PR/CI, cómo funciona el fallback de archivos; la parte de docker compose se añade al cerrar T-056                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-086  | [SIN PROVEEDOR] CI/DAST sin secretos reales: credenciales efímeras aleatorias y enmascaradas por job, objetivo DAST verificado localhost/127.0.0.1, sin set -x/compose config con valores, artefactos sin .env, forks sin secretos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| T-091  | [LISTA, documental] Política de fuentes permitidas/prohibidas (clases A–F) y flujo de solicitud de permiso                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-069b | [LISTA] Ampliar check-scope para fallar ante crawlers/scrapers o parsers de sitios de terceros (p. ej. puppeteer, cheerio, playwright fuera de tests e2e, crawler) en dependencias/código de ingesta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-101  | [LISTA, documental] Plantilla de solicitud de permiso                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-102  | [LISTA, documental] Runbook de retirada/takedown y canal de contacto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-103  | [LISTA, documental] Procedimiento de revisión de cambios de la fuente + evaluación del foro de Grim Dawn (términos y rights por autor)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T-104  | [LISTA] Tipos Zod/dominio: SourceRightsEvidence, BuildAdaptation, PermissionRequest, TakedownEvent, SourceChangeEvent, entry\_kind='build\_adaptada'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-107  | [LISTA] Reglas puras de la puerta de publicación (checklist plan §15.2) y degradación a \_link-only\_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-105  | [LISTA, UI] Componente SourceAttribution + JSON-LD isBasedOn en página de build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-106  | [LISTA, UI] Tarjeta \_link-only\_ sin texto/imagen/ranking derivados                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-108  | [TRAS FASE 8] Migración Drizzle con tablas/CHECK/vistas de data-model «Adaptaciones de terceros»                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T-109  | [LISTA] Extender check-scope (T-069b): falla ante acceso HTTP automatizado a dominios de foros/guías, y ante fuentes habilitada sin evidencia (AC-23).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T-111  | [LISTA, documental] Política de contribución y borrador de términos del colaborador (original vs. adaptación, atestación, retirada)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| T-112  | [LISTA, documental] Matriz de roles/estados, checklist de moderación, SLA y decisiones D-1–D-6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| T-113  | [LISTA] Ampliar check-scope: falla ante dependencias/rutas de auth, registro o edición pública (AC-24)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T-123  | [LISTA] markdownlint obligatorio para todo Markdown, con --fix seguro, integrado en pnpm verify y en el CI de PR (T-064). Cambios: (1) añadir markdownlint-cli2 como devDependency con versión exacta (pnpm add -D -E markdownlint-cli2); (2) crear .markdownlint-cli2.jsonc con config (default: true; solo MD013 desactivada y, si la versión la incluye y se dispara por el estilo compacto de tablas, MD060; cada excepción con comentario de motivo), globs (README.md, **/\*.md) e ignores (node\_modules/**, dist/**, .angular/**, coverage/**, .copilot/**, **/session-state/**, playwright-report/**, test-results/**); (3) scripts lint:md (markdownlint-cli2) y lint:md:fix (markdownlint-cli2 --fix); (4) añadir lint:md a pnpm verify; (5) añadir el paso pnpm lint:md (sin --fix) al job de lint de T-064; (6) corregir las infracciones existentes con pnpm lint:md:fix + arreglos manuales de las que no tengan autocorrección, **conservando** el cambio previo de espaciado de tablas en plan.md y revisando git diff para confirmar que no cambia el sentido de ningún documento; (7) documentar el comando en CONTRIBUTING.md/README.md si existen (T-076). |
| T-126  | Completar CI de calidad de toda la spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-128  | Verificar presupuestos backend medibles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Categoría: externa

| ID    | Trabajo pendiente según tasks.md                                                                                                                                                                                                                                                                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-044 | **[BLOQUEADA por derechos]** Revisión editorial y publicación de la guía migrada: solo ejecutable cuando el usuario confirme autoría y derechos de republicación (rights\_status pasa de pending a own\_original/licensed/permission\_granted con rights\_confirmed\_by/on); entonces confirmar fuentes, versión del juego, verificación de devociones y pasar a publicado |
| T-110 | [BLOQUEADA, externa] Publicar la primera adaptación real: requiere decisión del usuario sobre fuente/autor, términos del foro revisados (T-103), solicitud enviada (T-101) y permiso/licencia registrado y verificado. Hasta entonces, solo \_link-only\_.                                                                                                                 |

### Categoría: opcional

| ID    | Trabajo pendiente según tasks.md                                                                                                                                                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-075 | [OPCIONAL] Reubicar content/ → fixtures/content/ (y manifiesto) para hacer evidente su rol de fixtures; ajustar rutas en scripts/tests                                                                                                                                                        |
| T-067 | [OPCIONAL · PR dedicado · requiere visto bueno del usuario para ejecutarse] Fase C: mover la web de la raíz a apps/web con git mv (src/, public/, angular.json, tsconfig*.json, eslint), ajustar rutas a content//scripts/, scripts raíz delegados con pnpm --filter; sin cambios funcionales |

### Categoría: diferida

| ID    | Trabajo pendiente según tasks.md                                                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-087 | [DIFERIDA-HOSTING] Almacén gestionado (proveedor por decidir) detrás de SecretSource, auditoría de acceso, procedimiento y simulacro de \_break-glass\_ (caducidad ≤ 1 h, rotación posterior) |
| T-088 | [DIFERIDA-HOSTING] OIDC de GitHub Actions hacia el proveedor (sin credenciales de larga vida) y secretos de entorno con revisores requeridos                                                  |
| T-089 | [DIFERIDA-HOSTING] Inyección en runtime en el orquestador (archivos/volumen 0400, no-root; nunca ARG/ENV de imagen)                                                                           |
| T-090 | [DIFERIDA-HOSTING] Calendario de rotación en producción (C1 ≤ 90 d, C4 ≤ 180 d), revisión trimestral de accesos; reevaluar Vault/OpenBao según plan §13.9.                                    |
| T-092 | [DIFERIDA] Registro de fuentes extendido (clase, prueba, alcance, caducidad, estado) en esquema Drizzle + CHECK: fuente no habilitada ⇒ sin lotes                                             |
| T-093 | [DIFERIDA] Puerta de permiso: lote exige fuente habilitada con rights\_status aprobado y vigente; revocación suspende y marca lotes                                                           |
| T-094 | [DIFERIDA] import\_batches + import\_review\_queue + origin='import'; versionado y diff entre revisiones                                                                                      |
| T-095 | [DIFERIDA] Captura cruda privada con retención y purga verificable (fuera de repo/imagen; sin secretos/PII)                                                                                   |
| T-096 | [DIFERIDA] Mapeador puro a Build canónico en packages/domain con fixtures sintéticos propios (no de terceros)                                                                                 |
| T-097 | [DIFERIDA] Verificación editorial: importador ≠ revisor; lote nace borrador; no se puede escribir publicado desde la ingesta                                                                  |
| T-098 | [DIFERIDA] Fallo seguro: errores ⇒ cuarentena; degradación a solo enlace con atribución en la UI                                                                                              |
| T-099 | [DIFERIDA] Adaptadores por fuente de clase A/B/C, uno por spec y decisión del usuario (primero un envío de autor manual)                                                                      |
| T-100 | [DIFERIDA] Operación y revisión de revocación/caducidad de permisos; credenciales de API de fuente bajo §13.                                                                                  |
| T-114 | [DIFERIDA, D-1/E2] Identidad y roles (proveedor decidido) con autorización por propiedad/rol                                                                                                  |
| T-115 | [DIFERIDA, E1] Alta de autores invitados y envío manual con atestación firmada                                                                                                                |
| T-116 | [DIFERIDA, E2] Migración: contributors, build\_versions, contributor\_attestations, review\_decisions, audit\_log + CHECK/triggers                                                            |
| T-117 | [DIFERIDA, E2] API de borradores (propiedad del autor) y editor estructurado [UI] lazy-loaded                                                                                                 |
| T-118 | [DIFERIDA, E2] Atestación de licencia/titularidad + puerta original/adaptación (reutiliza T-107).                                                                                             |
| T-119 | [DIFERIDA, E2] Flujo de revisión editor/moderador con separación de funciones + historial/diff de versiones.                                                                                  |
| T-120 | [DIFERIDA, E2] Reportes y retirada (reutiliza T-102/FR-32) con despublicación cautelar.                                                                                                       |
| T-121 | [DIFERIDA, E3] Límites de tasa, cuarentena, antispam, suspensión (D-6).                                                                                                                       |
| T-122 | [DIFERIDA, E2] Vistas públicas solo de la versión publicada + pruebas de no filtración de borradores (FR-45).                                                                                 |

### Categoría: reemplazada

| ID    | Trabajo pendiente según tasks.md                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T-007 | [REEMPLAZADA por T-071/T-055; no ejecutar] Migración SQL portable Supabase                                                              |
| T-008 | [REEMPLAZADA por T-073; no ejecutar] Políticas RLS de Supabase                                                                          |
| T-011 | [REEMPLAZADA por T-062; no ejecutar] SupabaseContentRepository descartado (rev. 4); el adaptador de producción es ApiContentRepository. |
| T-013 | [REEMPLAZADA por T-059/T-072] Importador a Supabase/Postgres: sustituido por db:seed (dev/test) y db:bootstrap (una vez, B-7).          |

## Puerta de revisión y spec002

Además de las 40 tareas activas de spec001, spec002 tiene 2 tareas pendientes:
T013 (validación conductual real de coordinador/revisores) y T014 (verificación,
evidencia final y cierre real de esa spec). Su tasks.md es la referencia.
No simular independencia ni resultados de revisión a partir de tests del script.

Al terminar la implementación completa de spec001, ejecutar el coordinador
speckit-review-complete y esperar cuatro revisiones reales: código, arquitectura,
seguridad y buenas prácticas, con evidencia vigente/hash del árbol actual.
Cualquier edición posterior invalida el cierre que dependa de ese hash.
No hubo revisión final global ni autorización para saltarse la puerta.

## Siguiente tarea, sin autorización implícita

T-037 es la siguiente tarea planificada (§17.42), seguida por T-020.
Después siguen T-021/T-025 y el contacto de T-039.
Completar CI/calidad/performance, contenido y documentación activas del inventario;
al final, ejecutar spec002. No ejecutar las tareas reemplazadas, opcionales o
diferidas como si pertenecieran automáticamente a la entrega. No publicar contenido
pending. El destino final de PR autorizado es develop y solo al terminar toda la
spec.
