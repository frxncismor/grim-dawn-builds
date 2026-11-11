# Relevo: T-020a ejecutada (PARCIAL, presupuesto bloqueado)

Estado al 2026-11-10: T-033, T-135, T-034, T-035, T-036 y T-037 completadas. T-020
tiene planificación vigente en plan §17.43, quedó **PARCIAL**, y su remediación
plan §17.47 (`T-020a`) cerró el `404.html` real (B) y el cableado FR-16 (C) pero
**no** el presupuesto del chunk inicial (A). La spec001 sigue abierta y la puerta
de revisión spec002 queda pendiente. Sin commit, push ni PR.

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
Una tarea a la vez. T-033/T-135/T-034/T-035/T-036/T-037 quedaron completadas; T-020
sigue planificada.

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

## T-037: implementación y evidencia final

`BuildPage` ensamblado según §17.42: componente controlado `OnPush` con
`BuildPageContent = PublicBuild & { authorIsPlaceholder; draft }`, sin
repositorio, HTTP ni storage. RED por `./build.page` ausente y GREEN de **17/17**
pruebas focales y **135/135** en las suites de `features/build`. Mantiene
`activeStepPosition` propio con `linkedSignal` sobre el slug, comparte
`activeIds` entre los dos árboles (`<slug>-tree-a|b`), difiere los SVG con
`@defer (on viewport)` y conserva en `#habilidades`/`#devociones` una alternativa
textual completa (nodos con barra, estado y justificación; pasos con cuerpo y
verificación, incluidos los sin constelación). `SeoService` emite
`Article` + `BreadcrumbList`; los borradores muestran «Borrador · no público» y
`noindex,follow`, sin autor ni fecha. El preview `build-page-preview` prerenderiza
`/` y `/borrador` con `noindex,nofollow`; Playwright + axe dieron **18/18**
combinaciones OK (2 rutas × 3 anchos × 3 modos) y cero violaciones, sin overflow,
foco visible y ancla `#devociones` operativa sin JavaScript. Presupuestos: HTML
65057 B / 11694 gzip, CSS 1657 gzip, SVG diferidos 15.8 kB gzip y sin aviso de
`build.page.css`. Pasan `pnpm lint`, Prettier, `lint:md`, `pnpm build`,
`check:initial-js`, `check:public-build` (175 archivos) y `check:secrets` (415).
Preview eliminado y puerto 4332 libre. Detalle y logs en
[quickstart.md](quickstart.md), sección «T-037».

Modelo realmente usado: `deepseek/deepseek-flash` (rol `sdd-ui`). Sin commit,
push ni PR; T-020/T-040/T-041/T-126 siguen abiertas y la guía pendiente no se
publicó.

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
T-037/T-020 y el cierre integral de spec001 seguían pendientes en esa corrección.
Sin commit, push ni PR; no se modificaron otros componentes ni configuraciones
existentes.

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
Total: **138** tareas; **70** marcadas completas (`[x]`); **68** sin cerrar (`[ ]`).

| Categoría   | Cantidad |
| ----------- | -------: |
| activa      |       38 |
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
| T-086  | [PARCIAL 2026-11-11; SIN PROVEEDOR] CI/DAST sin secretos reales: credenciales efímeras aleatorias y enmascaradas por job, objetivo DAST verificado localhost/127.0.0.1, sin set -x/compose config con valores, artefactos sin .env, forks sin secretos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
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

T-020 tiene implementación parcial y **no está cerrada**. `T-020a` cerró el
`404.html` real y FR-16; queda **A**: el presupuesto del chunk inicial (306.23 kB
frente a 300 kB). Antes de avanzar a T-021/T-025 hay que planificar (nueva tarea
SDD, no ampliar umbrales) cómo sacar ≈6.3 kB del bundle inicial: `withEventReplay`
(10.9 kB) y el runtime de `@defer` de la página de guía son las dos palancas
medidas, ambas fuera del alcance autorizado de §17.47. Después siguen T-021/T-025
y el contacto de T-039. Completar CI/calidad/performance, contenido y
documentación activas del inventario; al final, ejecutar spec002. No ejecutar las
tareas reemplazadas, opcionales o diferidas como si pertenecieran automáticamente
a la entrega. No publicar contenido pending. El destino final de PR autorizado es
develop y solo al terminar toda la spec.

## T-020: implementación parcial y bloqueos (2026-11-10)

Se añadieron la ruta lazy `builds/:slug`, el resolver con `TransferState`, la
ruta `**` a `NotFoundPage` y `getPrerenderParams` sobre la fuente activa, con
pruebas primero (RED/GREEN) y suite completa en verde (30 archivos, 280 pruebas).
También se documentó la evidencia y los límites en `quickstart.md` (sección
«T-020: rutas, resolver y 404 con estado»). No se marcó `T-020` y no se tocaron
`BuildPage`, dominio, `apps/api`, dependencias ni umbrales de `angular.json`.

Bloqueos registrados:

1. **Presupuesto:** `pnpm build` falla con 306.11 kB/300 kB (+6.11) y
   `pnpm check:initial-js` deja `/tier-list` en 110981/110000 bytes gzip
   (base 105259). Al enrutar `BuildPage`, el chunk inicial comparte más código de
   `@angular/core`/`common`/`platform-browser`; exige tarea de rendimiento o
   decisión de plan antes de ajustar nada.
2. **404 real:** Angular 21.2.29 omite rutas catch-all del prerender, así que no
   se genera `404.html` en ninguno de los dos builds. La ruta y la página están
   cableadas y probadas, pero el artefacto no se simula (plan §17.43).
3. **FR-16:** falta el endpoint de descriptores públicos de activos aprobados y
   el consumidor server con `resolveIcon`; `apps/api` quedó fuera del alcance de
   este despacho. Sin ese cableado, FR-16 sigue abierto.

Evidencia local en `$env:TEMP/gd-t020-{red,green,full-test,lint,prettier,lint-md,secrets,public-build,drafts-build,initial-js,public-check}.log`
(los artefactos temporales de build se eliminaron). Modelo realmente usado:
`deepseek/deepseek-flash`. Sin commit, push ni PR.

## T-020a: remediación de T-020 — PARCIAL, A bloqueado (2026-11-10)

Se ejecutó la remediación de plan §17.47. **T-020 sigue sin marcar** y esta tarea
queda **PARCIAL**: B y C están cerrados y probados; A está implementado en lo que
el alcance autoriza pero **el build sigue rojo**, así que no se acredita.

**B — `404.html` real: cerrado.** Angular 21.2.29 omite el catch-all del
prerender, así que la misma página estática se prerenderiza en `/404` (ruta lazy
en `app.routes.ts` + `RenderMode.Prerender` en `app.routes.server.ts`) y
`scripts/emit-404.mts` copia `browser/404/index.html` a `browser/404.html`. La
copia valida el contrato antes de escribir: exige `data-not-found`, `h1` de 404,
`robots=noindex` y `base href="/"`, y rechaza la portada 200 (`gd-static-home`) o
un artefacto sin esa página. Encadenado en `build` y `build:release`; prueba en
`scripts/emit-404.test.mts` (5 casos, el de symlink se omite en Windows sin
privilegios). Evidencia: `404.html` de 34 812 bytes con la página 404 real en un
artefacto de verificación (`dist/probe404`, configuración de desarrollo con
optimización, borrado después). Nota para T-021: `/404` es una ruta prerenderizada
con `noindex` y debe excluirse del sitemap igual que `404.html`, y
`browser/404/index.html` no se sirve como página de contenido.

**C — FR-16: cerrado.** `GET /api/v1/assets` (solo lectura) devuelve
descriptores públicos de activos `approved`; `mapAsset/mapAssets` proyectan
`slug`/`file_path`/`fallback_svg` y nunca `origin_url`, `rights_holder`,
`license_or_permission` ni `proof_ref` (objeto Zod estricto y ruta pública
validada). `PostgresContentRepository.listAssets()` lee `v_public_assets` (la
vista ya filtra `approved`; la tabla `assets` no tiene dimensiones, así que el
descriptor no las incluye). En la web, `ApiContentRepository.listAssets()` valida
cada descriptor con un esquema estricto y lo resuelve con
`resolveIcon`/`resolvePublicAssets`: un `pending`/`rejected` cae siempre al SVG
propio y un `file_path` hostil falla cerrado. Pruebas: `map-content.spec.ts`,
`routes/content.spec.ts`, `api.repository.server.test.mts`,
`resolve-icon.server.test.mts` y caso de integración en `content.int.spec.ts`
(requiere Docker; declarado, no ejecutado aquí).

**A — presupuesto: bloqueado con medición.** `content.resolvers.ts` ya no
importa `./repository` ni `@gd/domain` de forma estática: el servidor los carga
con `await import(...)` y el navegador solo lee `TransferState` (prueba de guarda
en `content.resolvers.spec.ts`). Ahorro real: **0.64 kB**. `ng build` sigue en
**306.23 kB / 300 kB** (+6.23). Medición del mismo build con las rutas de HEAD:
**292.47 kB**; la ruta `builds/:slug` cuesta **13.76 kB** y solo hay 7.53 kB de
margen. El coste no es el resolver (887 B) sino código de framework que el
optimizador de chunks arrastra al bundle inicial al compartirse con el chunk lazy
de `BuildPage`: `@angular/core` `_debug_node-chunk` (+7.2 kB), `_effect-chunk2`
(+1.7 kB), `@angular/common` (+1.2 kB), `platform-browser` (+1.0 kB) y el runtime
de `@defer` (≈3.3 kB medido con una página trivial con un solo `@defer`). No se
tocaron `angular.json` ni los umbrales de plan §6.

Palancas reales, todas fuera de los archivos autorizados de §17.47: (1)
`withEventReplay()` en `src/app/app.config.ts` arrastra
`primitives-event-dispatch` (10.9 kB) al chunk inicial; quitarlo exige decisión de
producto sobre hidratación/event replay (T-133). (2) El runtime de `@defer` y
`linkedSignal`/`effect` de `build.page.ts`/`build-toc.ts` (T-036/T-037). (3)
Ampliar el guard raw 280/300 kB, prohibido por §6 y la constitución IV.

Sin marcar T-020: el criterio de cierre exige build verde y `check:initial-js` en
105 259/110 000, y hoy el presupuesto impide además generar el artefacto público
(de ahí que `pnpm check:public-build` falle por `build-failed`).

**Artefactos de verificación** (configuración `development` + `--optimization=true`,
sin presupuesto y sin `static-home`; **no** son artefacto de release): público con
5 rutas (`/`, `/404`, `/acerca`, `/autores/…`, `/tier-list`), sin
`builds/chaman-demoledor-golpe-primigenio` ni su slug/JSON-LD y con `404.html`
(34 869 B); local con `INCLUDE_DRAFTS=true` con 6 rutas, la guía presente
(140 551 B) con banner «Borrador», `noindex`, JSON-LD `Article` y sin campos
privados, también con `404.html`. `check:initial-js` sobre ese artefacto da
`/tier-list` 112 478/110 000 gzip.

Evidencia en
`$env:TEMP/gd-t020a-{red,green,test,test-scripts,build-after-a,prod-nodfeer,prod-defer}.log`.
Artefactos temporales (`dist/probe*`, `dist/t020a-*`, `dist/grim-dawn-builds`)
eliminados. Modelo realmente usado: `deepseek/deepseek-flash`. Sin commit, push ni PR.

## T-020b: presupuesto gzip devuelto, sin holgura para 109 500 (2026-11-10)

`T-020` **sigue sin marcar**: el build ya está en verde, pero `/tier-list` queda en
**109 990/110 000 gzip**, no en el objetivo de holgura de 109 500.

**Hipótesis de §17.48 refutada.** El resolver estático no era el peso:
`chunk-ZFVT2EQO.js` (6 468 gzip) es el chunk de la propia página `/tier-list`
(`tier-components.ts` 10 910 B + `tier-list.page.ts` 4 951 B + `icon`/`registry`),
sin símbolos del resolver ni de la página 404. El resolver solo aportaba 955 B en
`main`. El crecimiento real de T-020 está en el chunk de framework compartido con
el chunk lazy de `BuildPage`: `_debug_node-chunk` +7 163 B, `_effect-chunk2`
+1 701 B y la separación de `platform-browser`/`common` en chunks propios
(+~5,1 kB gzip en total). Coste medido de la ruta `builds/:slug`: **3 886 gzip**
; sin esa ruta el build daría 106 166.

**Cambios aplicados** (sin tocar `angular.json` ni los umbrales de §6):
`src/app/app.routes.ts` carga los resolvers de build y autor con `import()`
dinámico y restaura el contexto de inyección con `runInInjectionContext`; así
`content.resolvers.ts` (437 gzip) y `author.state` (489 gzip) salen del grafo
inicial. `src/app/core/seo/seo.service.ts` elimina ramas muertas (`image` siempre
existe) y valida el JSON-LD sobre los registros antes de serializar (−27 gzip).
`app.routes.spec.ts` sustituye la aserción de identidad del resolver por una
prueba de comportamiento. Ganancia total: **1 006 gzip** (110 996 → 109 990).

**Por qué no se llega a 109 500 dentro de §17.48**: los 3 886 gzip de
`/builds/:slug` son código de framework compartido, no resolver; recortarlos exige
tocar `build.page.ts`/`tier-components.ts` o el chunking, fuera de los archivos
autorizados. Palancas medidas fuera de alcance: quitar `Location` de
`site-layout.ts` ahorra solo 50 gzip (el router mantiene `platform-location`), y
`withNoHttpTransferCache()` no ahorra nada porque `platform-browser` importa
`@angular/common/http` de forma estática.

Verificación: `pnpm build` exit 0 con `check:initial-js OK /tier-list
(109 990/110 000)`; `pnpm test` 30 archivos/281 pruebas; `pnpm lint`,
`prettier --check` de los archivos tocados, `pnpm lint:md`,
`pnpm check:public-build` (204 archivos) y `pnpm check:secrets` (422) en verde.
Build público sin la guía `pending` y con `404.html`; build `INCLUDE_DRAFTS=true`
con 6 rutas, la guía de borrador con banner «Borrador» y `noindex`. Evidencia en
`$env:TEMP/gd-t020b-{build,build-final,drafts,test,lint,prettier,lintmd,public,secrets}.log`.
Modelo realmente usado: `deepseek/deepseek-flash`. Sin commit, push ni PR.

## T-039: `/legal` implementada, puerta de presupuesto inicial bloqueada (2026-11-10)

Decisión del usuario: el canal real de contacto es GitHub Issues del repositorio
(`https://github.com/frxncismor/grim-dawn-builds/issues`), para retirada y contacto
general. No se inventó correo, responsable, servicio ni SLA.

Estado de partida verificado: `/autores/:slug` y `/acerca` ya existían
(`features/author/*`, `static-pages/about.page.*`, `editorial.css`) con 5 pruebas
verdes y prerender; el enlace «Aviso legal» del pie ya estaba en
`site-layout.html` y su prueba. Lo que faltaba era la propia `/legal`.

### Añadido

- `src/app/features/static-pages/legal.page.{ts,html}`: página estática sin
  JavaScript de interacción, `h1` único, seis bloques con `aria-labelledby`
  (titularidad, atribución, fuentes y activos, retirada, privacidad, no
  afiliación), `SeoService` con `WebPage` y canonical, enlace a Issues con
  `target="_blank"` y `rel="noopener noreferrer"`, estilos con `editorial.css` y
  tokens existentes (cero colores o tamaños hardcodeados).
- `legal.page.spec.ts`: 7 pruebas (bloques, hechos, canal único, ausencia de
  correo/teléfono inventado, SEO/JSON-LD, ausencia de `innerHTML` con espía del
  setter, y ruta cliente lazy + prerender).
- `app.routes.ts`: ruta `legal` lazy. `app.routes.server.ts`: `legal` en
  `RenderMode.Prerender`.

**Cada dato factual es rastreable**: licencia no declarada y derechos reservados
(`README.md` §License), registro de fuentes (`content/sources/`), atribución y
adaptación (`CONTRIBUTING.md`, constitución I/II/VII), manifiesto de activos
`approved` y SVG propios (`content/assets/manifest.json` vacío + VII), progreso
opcional del checklist con botón «Borrar progreso» (`purchase-stepper`), y no
afiliación con Crate Entertainment ni GrimTools (README, CONTRIBUTING).

**TDD**: rojo en `$env:TEMP/gd-t039-red.log` (módulo `./legal.page` inexistente),
verde en `$env:TEMP/gd-t039-green.log` (7/7). Suites de `static-pages` + `author` +
`app.routes.spec.ts`: **19 pruebas, 4 archivos, verde** (`gd-t039-suites2.log`).

**Bloqueo: presupuesto del chunk inicial.** `pnpm build` sale **1** únicamente en
`check:initial-js`: `/tier-list` **110 011/110 000 gzip** (11 B de exceso;
`gd-t039-build3.log`). La atribución está medida, no supuesta: al eliminar la
entrada `legal` del `main` construido su gzip pasa de 2 345 a 2 324 B (−21), que
devuelve el total a los 109 990 de T-020b. Es decir, el cuerpo de la página
(5,46 kB crudos / 2,00 kB gzip en `chunk-YNCZLHBL.js`, chunk lazy propio) **no**
entra en el inicial; lo que cuesta son los 21 B de la propia entrada de ruta (hash
del chunk y nombre de la ruta/clase). El techo tiene 10 B de holgura, así que la
puerta es inalcanzable con cualquier ruta lazy nueva.

Probado y descartado, con medición sobre el `main` real: deduplicar el cargador de
`404`/`**` en un `const` **empeora** +13 B (gzip comprime mejor la repetición que
una referencia), export por defecto del componente ahorra 3 B, compartir chunk con
`/acerca` unos 8 B (y rompe el requisito de chunk propio). Ninguna combinación baja
de 11 B, y todas las palancas grandes (`withEventReplay()`, `@defer`, `Location` en
`site-layout.ts`) están fuera de los archivos autorizados de T-039.

**Artefacto**: el build completa `ng build` + `static-home` + `emit-404` antes de
fallar la puerta; `dist/grim-dawn-builds/browser/legal/index.html` existe
(37 362 B), contiene el enlace a Issues, `canonical` y el `WebPage`. 6 rutas
prerenderizadas.

**Accesibilidad medida** (Playwright 1.65 + axe-core 4.14 sobre el artefacto
servido en `127.0.0.1:4319`, 375/768/1280 con JS y con `javaScriptEnabled:
false`): 0 violaciones (wcag2a/2aa/21a/21aa/22aa), 0 overflow, `h1` único, seis
`h2`, enlace «Aviso legal» del pie alcanzable con Tab, `outline: 2px solid`
visible y activación con Enter; desde `/acerca` el enlace navega a `/legal` con y
sin JS (`gd-t039-nav.log`). Evidencia: `$env:TEMP/gd-t039-a11y.log`; capturas
`$env:TEMP/gd-t039-{375,768,1280}.png` (y variantes `-nojs`) inspeccionadas
visualmente.

**Puertas en verde**: `pnpm lint`, `prettier --check` de los archivos tocados,
`pnpm lint:md` (49 archivos), `pnpm check:public-build` (208 archivos) y
`pnpm check:secrets` (433 archivos). Logs: `gd-t039-lint.log`,
`gd-t039-public-build.log`.

**Decisión pendiente para cerrar T-039** (no se marca la tarea):

1. Autorizar +21 B en el techo de `/tier-list` (`scripts/check-initial-js.mts`),
   con la medición de esta entrada como justificación; requiere la autorización
   explícita que T-132 exige.
2. Tarea de seguimiento: emitir `/legal` como HTML estático sin bootstrap con el
   patrón de `scripts/static-home.mts` y enlace nativo en el pie. Coste 0 B en el
   chunk inicial y es la opción recomendada, porque un aviso legal no necesita
   hidratación.

Modelo realmente usado: `opencode-go/deepseek-v4.1-flash`. Sin commit, push ni PR.

## T-041: puerta axe en 4 rutas x 3 viewports (2026-11-11)

**Alcance**: `playwright.config.ts` y `e2e/a11y.spec.ts` nuevos, y el script
`e2e:a11y` en `package.json`. Sin cambios en `src/**`, `angular.json`,
`playwright.svg.config.ts`, `e2e/svg-responsive.spec.ts` ni dependencias
(`@playwright/test` 1.65.0 y `axe-core` 4.14.0 ya estaban fijadas).

**Servidor del artefacto**: `webServer` sirve `dist/grim-dawn-builds/browser` con
un Node estático mínimo, nunca `ng serve`. El script vive en
`%TEMP%\gd-t041-serve-artifact.mjs` (lo escribe el propio `playwright.config.ts`)
porque el alcance autorizado no incluye un `scripts/*.mts` nuevo. Devuelve 404
real con el cuerpo de `404.html` del artefacto, de modo que una ruta ausente rompe
la prueba en lugar de saltarse.

**Puerta**: `/`, `/tier-list`, `/acerca` y `/legal` x 375/768/1280 x 2 pases
(`JavaScript activo` y `HTML sin JavaScript`) = **24 auditorías**, más la prueba
negativa del fixture en los 3 viewports (27 pruebas). Criterio: 0 violaciones de
impacto `critical`/`serious`; `moderate`/`minor` se imprimen sin fallar.

**Medición** (2026-11-11, Windows 11, Node 22.12.0, Chromium de Playwright
1.65.0, axe-core 4.14.0, artefacto de `pnpm build`): **27/27 en verde**, 0
violaciones de cualquier impacto, 14-16 reglas WCAG 2.1/2.2 A/AA en verde por
ruta y 1 incompleta (`color-contrast`, cubierta por `pnpm check:contrast`: 12
pares, mínimo 5,811:1). La portada se publica sin JS (contrato de 0 B de
`check:initial-js`), así que su pase "JavaScript activo" audita el HTML estático y
el log lo dice.

**La puerta no es vacía** (`$env:TEMP/gd-t041-negative.log`):

- fixture con `<img>` sin `alt` en las 4 rutas: 4 fallos con
  `image-alt (critical) en img`, salida 1.
- artefacto sin `/legal`: fallo con `HTTP 404` y la ruta marcada como ausente
  ("La ruta /legal NO existe en el artefacto servido en el puerto de prueba"),
  salida 1.

**Desviaciones registradas**:

1. `plan.md` §17.52 y la línea de `tasks.md` mencionan también `/autores/:slug` y
   `/builds/:slug` con borradores. El encargo acotó la puerta a las 4 rutas
   públicas y el artefacto público no contiene la guía `pending`, así que la guía
   borrador sigue sin auditar aquí (T-037/T-040 tienen su preview propio).
2. axe **no puede ejecutarse** con `javaScriptEnabled: false`: sus temporizadores
   quedan bloqueados y `run()` nunca resuelve (verificado). El pase sin JS abre la
   ruta en un contexto con JS desactivado y audita ese mismo HTML sin `<script>`
   en un contexto aparte con JS activo, con guardas de CSS cargado (>0 hojas) y de
   bundles sin fallos HTTP.

**Puertas**: `pnpm build` salida 0 (`/tier-list` 110 011/110 500 gzip, sin
cambio), `pnpm e2e:a11y` 27/27, `pnpm lint` limpio, `pnpm typecheck:e2e` limpio,
`pnpm lint:md` limpio (49 archivos) y `prettier --check` limpio en
`playwright.config.ts`, `e2e/a11y.spec.ts`, `package.json` y `tasks.md`/`handoff.md`
(`quickstart.md` mantiene el fallo preexistente de finales de línea del checkout,
igual que `spec.md`; el gate `format:check` del repositorio no cubre `specs/*.md`).

Modelo realmente usado: `opencode-go/deepseek-v4.1-flash`. Sin commit, push ni PR.

## T-040: recorridos E2E en 3 viewports con y sin JavaScript (2026-11-11)

**Alcance**: `e2e/journeys.spec.ts` nuevo, ampliación de `playwright.config.ts`
(`testMatch` array y segundo `webServer` opcional por entorno), etiquetas `@a11y`
en `e2e/a11y.spec.ts` y los scripts `e2e:a11y`/`e2e:journeys` en `package.json`.
Sin cambios en `src/**`, `angular.json`, `playwright.svg.config.ts`,
`e2e/svg-responsive.spec.ts` ni dependencias.

**Recorridos** (títulos `@journeys`, 6 casos × 375/768/1280 = **18/18**):
portada → catálogo → portada por enlaces reales; enlaces del pie (aviso legal y
autoría desde `/acerca`); filtros de `/tier-list` que cambian la URL, se
reconstruyen al recargar y siguen atrás/adelante; ancla `#devociones` en el
artefacto de borradores (con recarga del enlace compartido); el mismo recorrido y
ancla con `javaScriptEnabled: false`; y 404 real de la guía pendiente en el
público.

**Artefacto de borradores**: `$env:INCLUDE_DRAFTS='true'; npx ng build
--output-path dist/e2e-drafts` (aislado, no sobrescribe `dist/grim-dawn-builds`;
7 rutas prerenderizadas). El servidor lo sirve en `E2E_DRAFTS_PORT` (4322) solo si
existe; si falta, los casos de guía fallan con el comando exacto.

**Medición**: `pnpm e2e:journeys` 18/18 (27,3 s), `pnpm e2e:a11y` 27/27 sin
regresión, `pnpm build` salida 0 con `/tier-list` 110 011/110 500 gzip (sin
cambio de producto), `pnpm lint`, Prettier y `pnpm lint:md` limpios. **La puerta
no es vacía**: sirviendo el artefacto de borradores como público, la prueba de
404 falla con `Expected 404 · Received 200` en los 3 anchos. Logs:
`$env:TEMP/gd-t040-journeys.log`, `gd-t040-a11y.log`, `gd-t040-negative.log`,
`gd-t040-build.log` y `gd-t040-drafts-build.log`.

**Límite registrado**: la guía sigue `borrador`/`pending` (T-044) y ningún
artefacto enlaza `/builds/:slug` desde el catálogo («Guía próximamente»), así que
el paso de guía se verifica por su URL prerenderizada y su TOC; el caso de enlace
seguirá el enlace en cuanto exista, sin simularlo. Con JS desactivado los
`requestAnimationFrame` del documento no corren: la espera se hace desde el
runner.

Modelo realmente usado: `opencode-go/deepseek-v4.1-flash`. Sin commit, push ni
PR. `T-042`, `T-126` y el registro del To-do de Over9k siguen pendientes.

## T-021: sitemap y robots desde el artefacto (2026-11-11)

**Estado**: cerrada en el alcance autorizado (`scripts/gen-sitemap.mts`,
`scripts/gen-sitemap.test.mts`, `public/robots.txt` y `package.json`). **Release no
verificado**: `build:release` no encadena el generador, así que un release deja
`robots.txt` con `__BASE_URL__` sin sustituir y sin `sitemap.xml` hasta que una
tarea con acceso a `scripts/build-release.mts` mueva la generación antes del
fingerprint.

**Evidencia** (detalle en `quickstart.md`, sección T-021):

- `node --import tsx --test scripts/gen-sitemap.test.mts`: 19/19, exit 0 ·
  `$env:TEMP/gd-t021-green-exclusions.log`.
- `pnpm test:scripts`: exit 0, 362 tests, 360 pass, 2 omitidas, 0 fail ·
  `$env:TEMP/gd-t021-test-scripts-orchestrator.log`.
- `pnpm build`: exit 0 · `$env:TEMP/gd-t021-build-orchestrator.log`; `/tier-list`
  110011/110500 bytes gzip.
- `sitemap.xml`: 5 entradas, 389 B,
  SHA-256 `B03391D9E3E74F09B000FDE04CC5FA52961D3D6D36533DBC17056E0534430F20`.
- `robots.txt`: 67 B,
  SHA-256 `D65FF8F7F54E8544F91391AA8FF72FFA70E419073779DE5BBC168AFB35622555`.
- Segunda ejecución de `pnpm sitemap:generate`: mismos hashes.
- `pnpm check:boundaries` OK (238 archivos); `pnpm check:public-build` OK (211
  archivos, no acredita T-021).

**Desviación registrada**: el validador de `BASE_URL` está duplicado en el script
porque `pnpm check:boundaries` prohíbe `scripts → src`. Las pruebas comprueban la
equivalencia con `normalizeSiteUrl`.

**Archivos no tocados**: `scripts/verify-local.mjs` (intacto; `build` ya ejecuta el
generador), `scripts/build-release.mts`, `.gitignore` y el resto de archivos
prohibidos.

Modelo realmente usado: implementación `opencode-go/claude-haiku-5-5#medium`;
orquestación y verificación `opencode-go/deepseek-v4.1-flash`. Este flujo no
ejecutó commit, push ni PR. **Desviación externa detectada**: durante la sesión
apareció el commit `77faa52` con los archivos de T-021, ya presente en
`origin/feature/i18n-bilingual-docs`; no lo creó ni lo publicó este orquestador y
no se reescribió la historia. Sin PR.
