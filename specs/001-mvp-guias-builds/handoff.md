# Relevo: T-138 cerrada; spec001 sigue abierta

## Estado actual (2026-11-11, 12:30)

La sesión anterior se interrumpió a las 04:24 por `OpenCode Go usage limit
reached` y un reinicio de Windows a las 09:52 cerró las ventanas de Herdr. El
trabajo i18n estaba en disco **sin commit** y el árbol en rojo. Esta sesión lo
retomó y cerró **T-138** (mecánica y UI): `en` en la raíz y `es` bajo `/es`,
catálogos XLF en paridad 290/290, conmutador accesible que conserva ruta y query,
prerender de 12 rutas, `hreflang`/canonical por idioma, 404 por configuración
regional, sitemap de 10 URLs y `robots.txt` sustituido en ambas raíces.

Puertas ejecutadas y verdes: `pnpm test` 299/299; `pnpm test:scripts` 440/442
(2 omitidos preexistentes); `pnpm lint`, `pnpm format:check` y `pnpm lint:md` sin
incidencias; `e2e:a11y` 51/51 con 0 violaciones en inglés y español;
`e2e:journeys` 21/21; `check:performance` 47/47; `/` 0 B y `/tier-list`
111 955 B con techo **112 000 B** autorizado por el usuario (plan §17.51, segunda
excepción) porque `withI18nSupport()` cuesta 1 225 B.

Pendiente registrado, no reclamado como hecho: **T-146** (plan §17.54) para que
`TierListContentSchema` declare `locale` y el catálogo use `name_en`/`lang` según
la configuración regional. **T-144** sigue abierta para recuperar margen gzip y
revertir las dos excepciones. La puerta de cuatro revisiones de spec002 sigue
siendo obligatoria al cierre de la spec001. Sin push ni PR.

---

## Relevo anterior: T-020a ejecutada (PARCIAL, presupuesto bloqueado)

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
Total: **163** tareas; **123** marcadas completas (`[x]`); **40** sin cerrar (`[ ]`).

> Inventario regenerado el 2026-11-11 (T-154 con T-155, T-157, T-158, T-159 y T-160; pasada final con los conteos del archivo) con los comandos de S02; tasks.md es la fuente única. No editar a mano.

| Categoría   | Cantidad |
| ----------- | -------: |
| activa      |       14 |
| externa     |        2 |
| opcional    |        2 |
| diferida    |       22 |
| reemplazada |        0 |

### Categoría: activa

| ID     | Trabajo pendiente según tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-020a | Remediación de T-020: presupuesto del chunk inicial, `404.html` real y FR-16 |
| T-043  | Revisión manual: teclado + NVDA + contraste; checklist en specs/001-mvp-guias-builds/checklists/a11y.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-066b | [LISTA] Pruebas contenedor/Compose en CI: no-root, sin .env/secretos en imagen, db sin ports por defecto, Trivy con **bloqueo desde severidad MEDIA** (MEDIA/ALTA/CRÍTICA), decisión del usuario 2026-11-09; sin ignorar hallazgos no corregidos silenciosamente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T-068  | [LISTA] Prueba de equivalencia (AC-17): sembrados los mismos fixtures en BD, el build prerenderizado con CONTENT\_SOURCE=api es equivalente (HTML, sitemap, JSON-LD) al de fixture                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| T-077  | [LISTA] Job de DAST gratuito en PR (ZAP baseline contra web/API levantadas localmente en el runner, sin secretos ni objetivos remotos); umbral decidido por el usuario: **bloquear desde severidad MEDIA** (MEDIA/ALTA, y CRÍTICA si la herramienta la expone), sin excepciones silenciosas; revisión de Copilot por regla de rama manual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| T-105  | [LISTA, UI] Componente SourceAttribution + JSON-LD isBasedOn en página de build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-106  | [LISTA, UI] Tarjeta \_link-only\_ sin texto/imagen/ranking derivados                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-107  | [LISTA] Reglas puras de la puerta de publicación (checklist plan §15.2) y degradación a \_link-only\_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-108  | [TRAS FASE 8] Migración Drizzle con tablas/CHECK/vistas de data-model «Adaptaciones de terceros»                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T-126  | Completar CI de calidad de toda la spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-128  | Verificar presupuestos backend medibles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-141 | [LISTA] Tests adversariales de contenido, UI y API |
| T-157 | [LISTA, seguimiento] Reducir por grupo los mutantes supervivientes de T-142 en el dominio |
| T-158 | [DX, documental] Traducir a *.es.md los documentos públicos estables |

### Categoría: externa

| ID    | Trabajo pendiente según tasks.md                                                                                                                                                                                                                                                                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-044 | **[BLOQUEADA por derechos]** Revisión editorial y publicación de la guía migrada: solo ejecutable cuando el usuario confirme autoría y derechos de republicación (rights\_status pasa de pending a own\_original/licensed/permission\_granted con rights\_confirmed\_by/on); entonces confirmar fuentes, versión del juego, verificación de devociones y pasar a publicado |
| T-110 | [BLOQUEADA, externa] Publicar la primera adaptación real: requiere decisión del usuario sobre fuente/autor, términos del foro revisados (T-103), solicitud enviada (T-101) y permiso/licencia registrado y verificado. Hasta entonces, solo \_link-only\_.                                                                                                                 |

### Categoría: opcional

| ID    | Trabajo pendiente según tasks.md                                                                                                                                                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-067 | [OPCIONAL · PR dedicado · requiere visto bueno del usuario para ejecutarse] Fase C: mover la web de la raíz a apps/web con git mv (src/, public/, angular.json, tsconfig*.json, eslint), ajustar rutas a content//scripts/, scripts raíz delegados con pnpm --filter; sin cambios funcionales |
| T-075 | [OPCIONAL] Reubicar content/ → fixtures/content/ (y manifiesto) para hacer evidente su rol de fixtures; ajustar rutas en scripts/tests                                                                                                                                                        |

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

Sin tareas abiertas en esta categoría (T-007, T-008, T-011 y T-013 están cerradas).

**Nivel de evidencia de los cierres que se apoyan en evidencia local**
(decisión del principal, 2026-11-11; sus estados no cambian): `T-017` local
(tokens, CSS y fuentes autoalojadas en 3 anchos y teclado); `T-020` local y
parcial (FR-16 sigue sin el cableado de descriptores en la API; la prueba
fixture de T-048 no lo acredita); `T-057` local y condicionada (la integración
Compose depende de T-056b); `T-063` local (contrato inicial; la ampliación a
ambos adaptadores no está acreditada); `T-065` CI del PR #4, sin push a un
entorno ni despliegue, con T-066b (Trivy) abierta; `T-134` local (pruebas del
skip link con `Location`). Ninguno de estos cierres acredita release ni
despliegue.

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

## T-045 y T-046: vista previa local, variables y fuera de alcance (2026-11-11)

**Estado**: ambas cerradas. `T-045` cierra únicamente la parte local (vista previa
del artefacto estático, README del flujo editorial y plantilla de variables):
hosting, proveedor, secretos y `deploy.yml` siguen diferidos. `T-046` cierra con
un hueco declarado: las rutas de auth, registro y edición pública quedan en
`T-113` y el arte oficial se sigue comprobando con `pnpm assets:check`.

**Archivos**: `README.md`, `README.es.md`, `.env.example` (nuevo, en la raíz),
`scripts/check-scope.mts` y `scripts/check-scope.test.mts`.

**Evidencia T-045**:

| Comprobación                                        | Salida literal                                    |
| --------------------------------------------------- | ------------------------------------------------- |
| servidor estático documentado, `GET /`              | HTTP 200, 15 413 B                                |
| `GET /no-existe`                                    | HTTP 404 con cuerpo idéntico a `404.html`         |
| `pnpm lint:md`                                      | 54 archivos, 0 incidencias                        |
| `pnpm exec prettier --check README.md README.es.md` | OK                                                |
| `pnpm check:secrets`                                | OK (451 archivos)                                 |
| `.env.example` nuevo en fixture rastreado temporal  | OK, exit 0; contraprueba con placeholder `exit 1` |
| `pnpm check:scope`                                  | OK (245 archivos)                                 |

**Evidencia T-046**:

| Comando                                                                  | Salida literal                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| `node --import tsx --test scripts/check-scope.test.mts`                  | 30/30 (rojo previo 26/30)                         |
| `pnpm check:scope`                                                       | exit 0, `check:scope OK (245 archivos revisados)` |
| `pnpm assets:check`                                                      | OK (0 entradas)                                   |
| `scripts/compose.test.mts`                                               | 20/20                                             |
| `pnpm check:boundaries`                                                  | OK (238)                                          |
| `pnpm check:secrets`                                                     | OK (451)                                          |
| `pnpm check:ci-secrets`                                                  | OK (2 workflows)                                  |
| fixture fuera del repo con `cheerio` y rutas `comentarios`/`calculadora` | 3 incidencias, exit 1                             |

Detalle y salidas literales completas en `quickstart.md` (§ T-046).

**Desviaciones registradas**:

- `README.es.md` se reordenó para paridad de secciones: «Idioma» pasa antes de
  «Licencia», con las 12 secciones `##` en el mismo orden que `README.md`.
- `.env.example` de la raíz es una plantilla de referencia: Angular no carga
  `.env`, así que documenta las variables pero no sustituye la configuración real
  del build.
- La ampliación de `check:scope` se hizo con los dos archivos limpios en ese
  momento, en un árbol compartido por otros agentes.

**Límites**: las rutas de auth, registro y edición pública son `T-113`;
`check:scope` no sustituye una auditoría manual ni DAST; no existe workflow de
deploy y el despliegue sigue fuera de alcance.

Modelo realmente usado: implementación `opencode-go/deepseek-v4.1-flash`;
orquestación `opencode-go/deepseek-v4.1-flash`. Sin commit, push ni PR.

## T-145: TBT de páginas estáticas y puerta de rendimiento (2026-11-11)

- **Estado**: hecha. Plan §17.53; tarea marcada `[x]` en `tasks.md` con evidencia.
- **Archivos**: `scripts/static-home.mts` (finalizador generalizado; portada con
  `gd-static-home`, `/acerca`, `/legal` y `/autores/:slug` con `gd-static-page`),
  `lighthouserc.json` (`numberOfRuns` 3), `scripts/verify-local.mjs` (paso
  `performance` devuelto como último paso tras `public-build`) y
  `scripts/verify-local.test.mjs` (prueba de ausencia sustituida por una positiva).
- **Evidencia**: `pnpm build` exit 0 (`static-home OK`; `/` 0/90000 B, `/tier-list`
  110011/110500 B gzip). `pnpm check:performance` exit 0, `47/47`. TBT medianas
  0 / 54 / 0 / 0 / 0 ms (`/`, `/tier-list`, `/acerca`, `/legal`, `/autores`),
  3 corridas, Lighthouse 13.6.0, móvil. Tabla completa y logs en `quickstart.md`,
  sección «T-145».
- **Límites no ampliados**: TBT 150 ms y presupuestos de plan §6 sin cambios.
- **Desviación**: el primer reporte del subagente afirmó `numberOfRuns=3` cuando
  el archivo tenía 5. El orquestador lo detectó y lo corrigió a 3 antes de medir.
- **Modelos realmente usados**: subagentes `opencode-go/claude-haiku-5-5`;
  orquestación de dominio `opencode-go/deepseek-v4.1-flash`.
- **Verificación de cierre** (ejecutada por el orquestador):
  - `pnpm test:scripts` → exit 0, `# tests 372`, `# pass 370`, `# fail 0`,
    `# skipped 2`. Log `C:\Users\paco_\AppData\Local\Temp\opencode\t145\test-scripts.log`.
  - `pnpm verify` → exit 0, `verify OK (local)`. Orden completo y verde:
    `check-scope`, `check-boundaries`, `check-secrets`, `check-ci-secrets`,
    `domain:*`, `api:*`, `test:rotation`, `lint`, `lint:md`, `format`, `test`,
    `test:scripts`, `assets`, `contrast`, `build`, `public-build` y `performance`.
    Log `C:\Users\paco_\AppData\Local\Temp\opencode\t145\verify-orchestrator.log`.
  - Dentro de `verify`, `check:performance` dio `47/47`, con TBT mediana
    0 / 77 / 0 / 0 / 0 ms (`/`, `/tier-list`, `/acerca`, `/legal`, `/autores`),
    JS inicial `/` 0 B y `/tier-list` 110013/110500 B gzip. Informes en
    `dist/lighthouse-performance/run-20261111-035303-a5a62c`.
  - Chrome 157.0.8103.39 (FileVersion), UA `HeadlessChrome/157.0.0.0`;
    Lighthouse 13.6.0; `numberOfRuns` 3.
- Sin commit, push ni PR.

### Incidente de concurrencia (2026-11-11)

- A las 04:03:33 otro proceso puso `ci.collect.numberOfRuns` en 5. El orquestador
  lo restauró a 3 a las 04:12 y lo dejó así. Comprobado después en
  `lighthouserc.json`: el valor es **5**, no 3. Queda pendiente de decisión del
  orquestador; esta nota no lo modifica.
- La pasada de `pnpm verify` de 04:05 falló SEO 0.920 en `/legal` y
  `/autores/grim-dawn-builds` porque un build ajeno reemplazó `dist/` a mitad de
  medición: `robots.txt` era la plantilla con `__BASE_URL__` sin sustituir y faltaba
  `sitemap.xml`. No es una regresión de T-145.
- Con el artefacto íntegro de 04:13 (build del dominio i18n en curso), la medición
  de T-145 sigue verde: TBT mediana 0/74/0/0/0 ms en `/`, `/tier-list`, `/acerca`,
  `/legal` y `/autores/grim-dawn-builds`; LCP 758.7/675.6/756/755.6/755.8 ms; CLS
  0.000; puntuaciones 1.000. `/tier-list` JS inicial sube a **111346 B > 110500 B**
  por los cambios de i18n en curso, no por T-145, que no toca su JS. Informes:
  `dist/lighthouse-performance/run-20261111-041422-4405a9`.
- Evidencia verde previa sobre la misma base: `pnpm verify` exit 0 a las 03:53 (log
  `C:\Users\paco_\AppData\Local\Temp\opencode\t145\verify-orchestrator.log`), con
  `/tier-list` 110013/110500; `pnpm build` exit 0 y `pnpm test:scripts` exit 0 (372
  pruebas, 0 fallos) entre 03:59 y 04:01 (log
  `C:\Users\paco_\AppData\Local\Temp\opencode\t145\final-t145-gates.log`).
- Recomendación: serializar `build` y `check:performance` entre dominios antes de la
  verificación de programa. T-145 no amplió ningún presupuesto y su código no
  participa en el bundle de `/tier-list`.

## T-139 y T-140: jerarquía de orquestadores y property-based testing (2026-11-11)

- **Estado**: T-140 cerrada con evidencia; T-139 con entregables completos y
  **sin marcar**, porque su aceptación del plan exige un ensayo real con dos
  dominios disjuntos que no se ejecutó en este turno.
- **Alcance**: T-139 documenta la jerarquía vigente de `ORCHESTRATION.md` §12 en
  `docs/orchestration/hierarchy.md` y crea el rol
  `~/.copilot/agents/sdd-orchestrator-domain.agent.md`. T-140 añade tres suites de
  propiedades al dominio (`visibility`, `schema`, `adaptation`), con `fast-check`
  4.10.2 exacto y el script `test:properties`.
- **Archivos**: `docs/orchestration/hierarchy.md` (nuevo),
  `packages/domain/src/visibility.property.spec.ts`,
  `packages/domain/src/schema.property.spec.ts`,
  `packages/domain/src/adaptation.property.spec.ts` (nuevos),
  `packages/domain/package.json` (dependencia exacta + script),
  `pnpm-lock.yaml` (+16 líneas: `fast-check` y `pure-rand@8.4.2`) y
  `~/.copilot/agents/sdd-orchestrator-domain.agent.md` (nuevo, fuera del repo).
  Ningún archivo de `src/`, `apps/api/`, `e2e/`, `scripts/` ni de la puerta de
  rendimiento fue tocado por este dominio.
- **Evidencia**: `pnpm --filter @gd/domain test:properties` exit 0 (3 archivos,
  10 pruebas, 10 líneas `[property]` con `numRuns` y `seed`). `pnpm --filter
@gd/domain test` exit 0: 122 pruebas (antes 112), cobertura 99.69 / 98.84 / 100 /
  99.65 (antes 98.15 / 96.92 / 100 / 98.61). `domain:typecheck` 0, `domain:lint` 0,
  `check:boundaries` 0 (243 archivos), `pnpm test:scripts` exit 0 (`# tests 374`,
  `# pass 372`, `# fail 0`, `# skipped 2`), `markdownlint` 0 incidencias en 55
  archivos. Tabla de propiedades, semillas y comandos en `quickstart.md`.
- **Modelos realmente usados**: subagentes `opencode-go/claude-haiku-5-5#medium`;
  orquestación de dominio `opencode-go/deepseek-v4.1-flash`.
- **Desviación**: el plan incluye «round-trip de filtros» y «orden estable». El
  codec `serializeFilter`/`parseFilter` vive en
  `src/app/features/tier-list/filter.ts` (zona web, fuera de los archivos
  autorizados e importable solo en dirección web → dominio); el orden lo imponen
  los adaptadores de repositorio. El round-trip se cubre sobre el DTO público del
  dominio; el del codec de filtros queda como seguimiento del dominio UI.
- **Pendiente**: (1) ensayo real de T-139 con dos orquestadores de dominio (UI y
  tests) sobre una tarea pequeña; (2) propiedades del codec de filtros en la zona
  web cuando esa tarea se planifique.
- Sin commit, push ni PR.

## T-104 y T-113: derechos/adaptaciones en dominio y guardia de auth (2026-11-11)

- **Estado**: T-104 y T-113 cerradas con evidencia; ambas sin commit, push ni PR.
- **Alcance**: T-104 añade a `packages/domain` los tipos Zod de derechos y
  adaptaciones (`SourceRightsEvidence`, `BuildAdaptation`,
  `AdaptationPublication`, `PermissionRequest`, `TakedownEvent`,
  `SourceChangeEvent`, enums y helpers), con `entry_kind='build_adaptada'` como
  `ADAPTATION_ENTRY_KIND` sin tocar `ENTRY_KINDS` (el enum SQL llega en T-108 y
  T-058 compara ambos lados). T-113 amplía `check-scope` con dependencias de
  sesión/auth y una regla nueva `out-of-scope-route` para rutas de auth, registro,
  cuenta y edición pública (AC-24), con detección contextual y comparación por
  segmento exacto.
- **Archivos**: `packages/domain/src/adaptation.ts` y `adaptation.spec.ts`
  (nuevos), `packages/domain/src/index.ts`, `packages/domain/src/index.spec.ts`,
  `scripts/domain-runtime.test.mts` (solo la lista esperada de exports, con
  autorización explícita del usuario), `scripts/check-scope.mts`,
  `scripts/check-scope.test.mts`. No se tocó `src/**`, `apps/**`, `e2e/**`,
  `package.json` raíz, `pnpm-lock.yaml`, `lighthouserc.json` ni
  `scripts/verify-local.*`.
- **Evidencia**: `pnpm --filter @gd/domain test` exit 0 (6 archivos; 112 pruebas en
  la primera medición, 122 tras las suites de T-140; cobertura
  98,15/96,92/100/98,61 → 99,69/98,84/100/99,65), `pnpm --filter @gd/domain
typecheck` 0, `pnpm --filter @gd/domain lint` 0, `prettier --check` 0,
  `node --import tsx --test scripts/check-scope.test.mts` 39/39, fixture propio en
  `$TEMP` con `passport` y `path: 'login'` → salida 1 con `[external-auth]` y
  `[out-of-scope-route]`, `pnpm check:scope` 0 (246 archivos),
  `pnpm test:scripts` exit 0 (383 pruebas, 381 pasan, 2 omitidas, 0 fallos),
  `pnpm check:boundaries` 0 (243 archivos).
- **Modelos realmente usados**: subagentes `opencode-go/deepseek-v4.1-flash`
  (primario de la cadena, sin fallback); orquestación de dominio
  `opencode-go/deepseek-v4.1-flash`.
- **Desviaciones**: (1) `pnpm domain:test` no existe en el `package.json` raíz y
  ese archivo está prohibido en este turno, así que la verificación se hizo con
  `pnpm --filter @gd/domain test` (`pnpm domain:test` devuelve
  `Command "domain:test" not found`); (2) se sincronizó la lista de exports de
  `scripts/domain-runtime.test.mts` con autorización del usuario; (3)
  `scripts/check-scope.mts` ya contenía las reglas de T-046/T-069b
  (comentarios/calculadora y `scraping`) cuando el subagente lo releyó: se
  absorbieron sin revertirlas.
- **Pendiente**: T-107 (checklist completo de la puerta y degradación a
  _link-only_), T-108 (migración SQL y enum `build_adaptada`), T-105/T-106 (UI).
- Sin commit, push ni PR.

## T-139 cerrada y T-141 parcial con dos hallazgos reales (2026-11-11)

- **T-139 cerrada**: el nivel 0 confirmó el ensayo real con cinco orquestadores de
  dominio en paralelo (derechos2, calidad, i18n, ci y rendimiento), archivos
  disjuntos, contrato de reporte idéntico en los dos niveles y dos serializaciones
  arbitradas (`scripts/check-scope.*` a derechos2 y `package.json` raíz a ci).
  Registrado en `docs/orchestration/hierarchy.md` y `quickstart.md`; `tasks.md` y
  el To-do de Over9k marcados `[x]`.
- **T-141 parcial**: `packages/domain/src/adversarial.spec.ts` (nuevo) cubre las 10
  clases de ataque con 151 pruebas verdes y 2 `it.fails` que documentan defectos
  reales. `pnpm --filter @gd/domain test` exit 0 (`Tests 151 passed | 2 expected
fail (153)`), cobertura 99.69 / 98.84 / 100 / 99.65; `typecheck`, `lint`,
  `check:boundaries` (244 archivos) y Prettier en verde.
- **Hallazgo 1 (derechos)**: `AuthorSchema` acepta URLs con credenciales
  (`https://usuario:clave@…`), confirmado también con `tsx`
  (`credenciales_aceptadas= true`). Afecta al `httpUrl` compartido (`source.url`,
  `video_url`, `external_url`, `origin_url` de activos).
- **Hallazgo 2 (publicación)**: `BuildSchema` acepta `publicado` con
  `rights_status: 'link_only'` porque su gate usa `APPROVED_RIGHTS` (que lo
  incluye). La vista pública lo bloquea, así que no hay filtración, pero el gate
  editorial no falla cerrado.
- **No se tocó** `packages/domain/src/schema.ts`: pertenece al dominio derechos2.
  Los dos hallazgos necesitan una tarea de corrección con prueba de regresión;
  quedan propuestos al nivel 0 (no se inventa número de tarea).
- **Pendiente de T-141**: UI (`src/app/**/*.adversarial.spec.ts`), API
  (`apps/api/test/adversarial.int.spec.ts`) y fixtures
  (`scripts/fixtures/adversarial/**`), fuera del alcance asignado a este dominio.
- **Modelos realmente usados**: subagentes `opencode-go/claude-haiku-5-5#medium`;
  orquestación de dominio `opencode-go/deepseek-v4.1-flash`.
- Sin commit, push ni PR.

## T-126: CI de calidad de la spec (infraestructura/CI, 2026-11-11)

- **Archivos**: `.github/workflows/ci.yml`, `scripts/ci-workflow.test.mts`,
  `scripts/verify-local.mjs`, `scripts/verify-local.test.mjs`,
  `specs/001-mvp-guias-builds/quickstart.md` y `tasks.md`. Sin cambios en
  `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `lighthouserc.json`,
  `e2e/**` ni `src/**`: no hicieron falta.
- **Pasos añadidos al job `verify`** (tras los controles de T-064): validación del
  fixture real (`content:validate -- --dir content`), `catalog:check`, build de
  borradores aislado (`ng build --output-path dist/e2e-drafts` con
  `INCLUDE_DRAFTS=true`), instalación de Playwright Chromium, `e2e:journeys`
  (T-040), `e2e:a11y` (T-041), paso de reporte de fuente que falla si un build de
  PR emite `dist/build-info.json` (exclusivo de `build:release`, T-074) e informa
  la fuente efectiva, y `check:performance` (T-042) con
  `CHROME_PATH=/usr/bin/google-chrome`. Job a 45 minutos, sin deploy, sin
  secretos y sin acciones nuevas.
- **Pruebas estáticas**: `ci-workflow.test.mts` valida el YAML sin dependencia
  externa (sangría par, entradas de `steps:`, `runs-on:` por job), exige los
  comandos nuevos, prohíbe `ng serve`, el build hacia el directorio público, un
  `timeout-minutes` insuficiente y `--update-snapshots`, y añade 13 regresiones
  de mutación (26 en total). `verify-local` valida el fixture real y el catálogo
  antes del build de la web, sin mover `performance` de su última posición.
- **Evidencia local**: `ci-workflow.test.mts` 32/32 y `verify-local.test.mjs`
  11/11 (exit 0); `pnpm test:scripts` 398 pruebas, 396 pasan, 2 `skipped`
  preexistentes, 0 fallos; YAML parseado con PyYAML (`jobs=['verify']`,
  37 pasos); `content:validate --dir content` y `catalog:check` OK; build de
  borradores aislado (`Prerendered 7 static routes`) sin sobrescribir
  `dist/grim-dawn-builds`; Playwright Chromium 158.0.8127.18 instalado;
  `pnpm run e2e:a11y` 27/27 con 0 violaciones y el fixture negativo
  `image-alt (critical)`.
- **Sin demostrar (bloqueo ajeno)**: la ejecución real del runner (no hay push ni
  PR autorizados) y las puertas de build, journeys y Lighthouse sobre un árbol
  sano. En esta sesión `pnpm run build` sale 1 con `404.html inválido` porque
  `not-found.page.ts` ya renderiza inglés y `scripts/emit-404.mts` exige «no
  encontrada»; `e2e:journeys` da 18 fallos por el texto español esperado y
  `check:performance` 44/47 (SEO 0.920 por `robots.txt` sin regenerar; JS
  `111 346/110 500 B` por el bundle en curso). Es el trabajo de i18n (T-138), no
  T-126; el nivel 0 re-ejecutará la puerta completa cuando i18n cierre.
- **`lighthouserc.json` cambió a 5 corridas** por otro dominio durante la sesión:
  el workflow y `check:performance` leen `numberOfRuns` del archivo y no lo fijan.
- **Modelos**: orquestador de dominio `opencode-go/deepseek-v4.1-flash`;
  subagentes `general` del harness con el modelo predeterminado (no se fijó
  `model` explícito). Sin commit, push ni PR; sin deploy ni secretos reales.
