# Cómo contribuir

Esta guía describe cómo proponer cambios en Grim Dawn Builds: ramas, entorno
local, comandos de verificación, reglas de contenido y lista de comprobación
para pull requests. Aplica a personas y a agentes de implementación.

Si algo de esta guía contradice la constitución o las especificaciones SDD, prevalecen
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) y
[`specs/001-mvp-guias-builds/`](specs/001-mvp-guias-builds/).

## Antes de empezar

Todo agente, subagente o harness que trabaje en el proyecto debe seguir **SDD con
GitHub Spec Kit**, independientemente del proveedor o modelo. Lee las
[instrucciones compartidas](AGENTS.md) y transmítelas a cualquier agente delegado.
Retoma las tareas ya planificadas; el alcance nuevo requiere spec, aclaraciones
necesarias, plan, tareas y análisis antes de implementarse, mediante los comandos
y plantillas de Spec Kit. Si no están disponibles, localiza la instalación antes
de iniciar esa fase. Esto incluye cambios en documentación, configuración e infra.

1. Lee la [constitución](.specify/memory/constitution.md), la
   [especificación](specs/001-mvp-guias-builds/spec.md), el
   [plan](specs/001-mvp-guias-builds/plan.md) y las
   [tareas](specs/001-mvp-guias-builds/tasks.md) de la funcionalidad que vas a tocar.
2. Trabaja **una tarea a la vez**, respetando el orden y las dependencias de
   `tasks.md`. Las tareas marcadas `[UI]` siguen su propio flujo de interfaz.
3. Marca una tarea como `[x]` en `tasks.md` solo cuando sus comprobaciones pasen.
4. Si la especificación o el plan son ambiguos o se contradicen, pregunta antes de
   implementar. No cambies la especificación para hacer encajar el código.

### Puerta de revisión al cierre

Al completar las tareas de implementación de una spec, ejecuta y espera las
cuatro revisiones descritas en [spec002](specs/002-spec-completion-reviews/),
usando el [coordinador](.agents/skills/speckit-review-complete/SKILL.md). Solo
declara completa la spec si el informe real, vigente y completo pasa la puerta.
El hook local puede no ser despachado por un harness sin router: en ese caso
carga el skill explícitamente; si el harness tampoco puede ejecutar las
revisiones, informa que el cierre sigue pendiente. Transmite las reglas de
`AGENTS.md` y el contexto SDD al delegar; un anuncio de invocación no acredita
que las revisiones hayan ocurrido.

## Flujo de ramas (GitFlow)

| Rama        | Función                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `main`      | Versiones estables. Solo recibe pull requests de release desde `develop`.                                                       |
| `develop`   | Integración de la próxima versión. Recibe pull requests desde `mvp/1`.                                                          |
| `mvp/1`     | Rama de integración del MVP. Tras cada especificación Spec Kit completada se registran aquí uno o más commits.                  |
| `feature/*` | Trabajo de una tarea o funcionalidad. Se integra en `mvp/1` mediante pull request.                                              |
| `release/*` | Preparación de una versión. Se integra en `mvp/1` mediante pull request, igual que el resto de ramas de trabajo.                |
| `hotfix/*`  | Corrección urgente. Se integra en `mvp/1` mediante pull request y sigue después el mismo camino (`mvp/1` → `develop` → `main`). |

### Camino de un cambio

1. Crea la rama de trabajo desde `mvp/1`.
2. Implementa el cambio con commits claros y abre un pull request hacia `mvp/1`.
3. Cuando una especificación Spec Kit queda completa, sus commits de cierre van en
   `mvp/1`.
4. Abre un pull request de `mvp/1` hacia `develop`.
5. Cuando `develop` está listo para publicarse, abre un pull request de release de
   `develop` hacia `main`.

### Nombres de rama

- `feature/<id-tarea>-<resumen>`, en minúsculas y con guiones. Ejemplo:
  `feature/t-076-politica-de-ramas`.
- `release/<versión>`. El esquema de versiones todavía no está definido en el
  repositorio; no inventes uno en una rama de release.
- `hotfix/<resumen>`, en minúsculas y con guiones.
- No uses espacios, mayúsculas ni caracteres especiales en los nombres.

### Reglas de integración

- **No hagas push ni merge directo** a `main`, `develop` ni `mvp/1`. Todo cambio
  llega mediante pull request.
- No reutilices una rama ya fusionada para trabajo nuevo; crea una rama nueva.
- Los agentes de planificación no crean ramas, commits, pull requests ni hacen push.
  Esas acciones las ejecuta una persona o un agente de implementación con
  autorización explícita.

### Configuración manual en GitHub

Los siguientes controles **no** están versionados en el repositorio. Los configura
el mantenedor en la configuración del repositorio de GitHub y este repositorio
no los verifica automáticamente:

- **Protección de ramas** (`main`, `develop`, `mvp/1`): exigir pull request antes de
  fusionar y bloquear el push directo.
- **Check de CI obligatorio**: marcar como requerido el job `Verify pull request`
  definido en [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
- **Revisión de Copilot obligatoria**: regla de rama que exige la revisión de Copilot
  antes de fusionar.
- **Secret scanning y push protection**: activar en la configuración de seguridad del
  repositorio.

Hasta que el mantenedor los configure, estos controles están pendientes.

## Entorno local

Requisitos:

- Node.js 22. El CI usa la versión 22.12.0.
- pnpm 12.18.0, la versión fijada en el campo `packageManager` de
  [`package.json`](package.json). Actívalo con Corepack:

  ```bash
  corepack enable
  corepack pnpm --version
  ```

Instalación y arranque:

```bash
pnpm install --frozen-lockfile
pnpm setup:gitleaks
pnpm setup:hooks
pnpm start
```

Abre `http://localhost:4200/`. Usa `--frozen-lockfile` igual que el CI para no
modificar `pnpm-lock.yaml` sin querer.

`setup:gitleaks` instala Gitleaks 8.30.1 solo en
`.tools/gitleaks/8.30.1/` (ignorado), para Windows/Linux x64. Descarga el asset
oficial fijado y verifica SHA-256 antes de extraer/ejecutar; no cambia el PATH
global. Otros entornos necesitan esa versión nativa en PATH. `setup:hooks`
activa `.githooks` únicamente en este clon. El hook requiere la versión exacta,
escanea staging con redacción y bloquea si falta la herramienta. La verificación
local también la exige: las pruebas de detección no se omiten silenciosamente.

### API local con PostgreSQL

Prepara los archivos locales ignorados y arranca PostgreSQL y la API:

```bash
pnpm setup:env
docker compose -f infra/docker/compose.yaml up -d --wait
```

En un volumen nuevo, PostgreSQL crea los roles sin login y habilita únicamente
`migrator` y `api_ro` a partir de sus archivos secretos antes de ejecutar la
migración. `importer` y `editor` permanecen `NOLOGIN` hasta sus tareas.
`migrate` recibe solo la credencial `migrator`; la API solo `api_ro`; el secreto
de superusuario se entrega únicamente al contenedor `db`.

Si ya existe el volumen PostgreSQL y cambiaste las credenciales locales, vuelve a
aprovisionar los dos roles sin borrar datos ni recrear el volumen:

```bash
pnpm exec tsx infra/docker/init/provision-roles.mts
```

El aprovisionador es idempotente y no imprime contraseñas. La API lee únicamente
las vistas públicas; no recibe credenciales de migración ni de superusuario.

## Comandos de verificación

`pnpm verify` ejecuta las comprobaciones locales en este orden y se detiene en la
primera que falla: `check:scope`, `check:boundaries`, `check:secrets`, typecheck,
lint y tests del paquete `@gd/domain`, `lint`, `lint:md`, `format:check`, `test`,
`test:scripts`, `assets:check` y `build`.

| Comando                                    | Qué comprueba                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`                              | Todas las comprobaciones locales anteriores. Ejecútalo antes de abrir un PR.                                               |
| `pnpm test`                                | Pruebas unitarias de la web (Angular).                                                                                     |
| `pnpm test:scripts`                        | Pruebas de los scripts de verificación.                                                                                    |
| `pnpm --filter @gd/domain test`            | Pruebas del paquete de dominio `packages/domain`.                                                                          |
| `pnpm --filter @gd/domain typecheck`       | Tipos del paquete de dominio.                                                                                              |
| `pnpm --filter @gd/domain lint`            | Lint del paquete de dominio.                                                                                               |
| `pnpm lint`                                | ESLint de la aplicación web.                                                                                               |
| `pnpm lint:md`                             | markdownlint sobre todo el Markdown rastreado. Solo comprueba.                                                             |
| `pnpm lint:md:fix`                         | Aplica las correcciones automáticas seguras de markdownlint. Revisa `git diff` después y vuelve a ejecutar `pnpm lint:md`. |
| `pnpm format:check`                        | Prettier sobre los archivos incluidos en el script.                                                                        |
| `pnpm format`                              | Prettier con escritura. Revisa el diff antes de confirmar.                                                                 |
| `pnpm content:validate -- --dir <carpeta>` | Valida un conjunto de contenido con el esquema de dominio.                                                                 |
| `pnpm assets:check`                        | Valida el manifiesto de activos oficiales.                                                                                 |
| `pnpm check:scope`                         | Prohibiciones de alcance (p. ej. Redis, colas, auth externa, almacenamiento).                                              |
| `pnpm check:boundaries`                    | Fronteras entre web, API y dominio.                                                                                        |
| `pnpm check:secrets`                       | Secretos y patrones de credenciales en archivos rastreados por git.                                                        |
| `pnpm build`                               | Build de la web.                                                                                                           |

Durante el desarrollo, ejecuta el comando más estrecho que cubra tu cambio (por
ejemplo, `pnpm test` o `pnpm lint:md`) y deja `pnpm verify` para antes del pull
request.

El CI de pull request ejecuta los mismos controles, excepto `pnpm verify` en sí. Además
ejecuta `pnpm content:validate -- --dir scripts/fixtures/content-valid`, que valida
solo el fixture, porque `content/builds` aún no tiene contenido (T-014). El CI
ejecuta `lint:md` solo en modo comprobación; nunca aplica `--fix`.

## Logs de PostgreSQL en Docker

Desde la raíz, consulta los últimos errores y sigue los eventos nuevos:

```bash
docker compose -f infra/docker/compose.yaml logs --tail=100 --timestamps -f db
docker compose -f infra/docker/compose.yaml logs --since=30m db
```

Cada mensaje del servidor incluye fecha UTC, PID, código SQLSTATE, usuario, base,
aplicación, cliente e identificador de sesión. Se registran conexiones y cierres,
esperas de bloqueos superiores a `deadlock_timeout` (por defecto 1 s), checkpoints
y errores. Las conexiones breves de `pg_isready` también aparecen: son del
healthcheck. Para correlacionar fallos del migrador, busca `app=gd-api-migrate`;
la comprobación de disponibilidad usa `app=gd-api-ready`.

Los logs salen por stderr, visibles también en Docker Desktop. El driver `local`
rota hasta tres archivos de 10 MB por contenedor y comprime los rotados. Los
mensajes antiguos se descartan; exporta el intervalo necesario antes de recrear
el contenedor si investigas un incidente.

No se habilita el volcado de sentencias ni de parámetros SQL. La verbosidad
`terse` evita DETAIL, HINT y CONTEXT que pueden incluir valores de filas. El
mensaje principal de un error todavía puede contener datos de la aplicación:
revisa y redacta los logs antes de compartirlos. No actives trazas de todas las
consultas ni registres contraseñas para diagnosticar un fallo.

Para aplicar cambios de configuración recrea solo PostgreSQL, conservando su
volumen (no uses `down -v`):

```bash
docker compose -f infra/docker/compose.yaml up -d --no-deps db
```

## Calidad de código

- **TDD donde corresponda.** Cuando el plan o `tasks.md` pidan pruebas antes del
  código, escríbelas primero, compruébalas fallando por la razón correcta e
  implementa después. La cantidad de pruebas debe ser proporcional al riesgo
  (principio IX de la constitución).
- **Clean Code y SOLID.** Son expectativas de revisión del proyecto, no requisitos
  formales de la constitución: funciones y módulos con una sola responsabilidad,
  nombres claros, dependencias hacia abstracciones (por ejemplo, `ContentRepository`)
  y poca duplicación. No introduzcas refactorizaciones ni funcionalidades que la tarea
  no pida.
- **Alcance mínimo.** Implementa solo lo que pida la tarea y los archivos que liste.
  Si la tarea exige tocar archivos que no figuran en `tasks.md`, detente y pregunta.
- **Dependencias.** No añadas dependencias sin justificación escrita en el PR (tamaño,
  alternativa nativa descartada), según el principio IV.
- **Rendimiento.** Respeta los presupuestos de [`plan.md`](specs/001-mvp-guias-builds/plan.md)
  (§6). Carga diferida del código pesado, evita consultas N+1 y re-renderizados o
  suscripciones innecesarias.
- **Accesibilidad.** WCAG 2.2 AA (principio V): contraste, foco visible, navegación
  completa por teclado, `prefers-reduced-motion` y alternativas textuales para todo
  SVG interactivo.
- **Idioma.** Los textos de la interfaz y el contenido van en español, a través del
  sistema de i18n de Angular (principio X). Los identificadores de código siguen la
  convención del código existente.

## Secretos

Principio XII de la constitución y plan §13.

- **Nunca** commitees secretos: ni en código, Dockerfiles, `ARG`/`ENV` de imagen,
  scripts de `package.json`, fixtures de `content/`, `.env.example`, builds del
  frontend, logs ni artefactos de CI.
- Los archivos `.env` locales (salvo `.env.example`) y las carpetas `secrets/` están
  ignorados por git. No los fuerces con `git add -f`.
- `.env.example` solo contiene nombres de variables y valores por defecto seguros que
  no son secretos. Los campos secretos quedan vacíos.
- Las credenciales locales son de desarrollo y nunca se reutilizan en entornos
  remotos.
- `pnpm check:secrets` falla si git rastrea `.env*`, archivos de `secrets/`, patrones
  de credenciales o URLs con contraseña. **No sustituye** al secret scanning de GitHub
  (configuración manual). Gitleaks complementa esa guardia en pre-commit, CI de PR
  e historial programado (T-083), con reglas predeterminadas y sin excepciones del
  proyecto. Ningún resultado local acredita que los workflows remotos ya corrieron.
- Si un secreto se publica por error, trátalo como comprometido: rótalo o revócalo
  en su proveedor y avisa al mantenedor. Borrar el commit no basta. El runbook completo
  (T-081) está pendiente; ver plan §13.8.

## Contenido, derechos y procedencia

Principios I, II y VII de la constitución, y FR-13 a FR-15 y FR-27 a FR-31 de la
especificación.

- Toda guía, tier y dato de juego tiene **autor**, **fuente(s)**, un
  **estado de revisión** (`borrador` → `en_revision` → `publicado`), un
  **estado de contenido** (`verificado`, `sin_verificar` o `placeholder`) y un
  **estado de derechos** (`rights_status`).
- **Nunca se publica** contenido con derechos `pending` o no aprobados. Tampoco se
  presenta como verificado lo que no lo está, ni un `placeholder` como contenido
  real.
- **No se hace scraping** ni importación automática en el MVP. Las importaciones son
  manuales y editoriales, con fuente y revisión.
- **No se copian** textos, imágenes ni activos de guías de terceros sin permiso
  explícito registrado. El permiso nunca se presupone por ser público, por silencio o
  por `robots.txt`.
- **No se eluden** controles de acceso (inicio de sesión, muros, captchas, límites de
  uso ni `robots.txt` o términos que lo prohíban).
- Una **build adaptada** de terceros solo se publica si la licencia de la fuente o un
  permiso registrado cubre expresamente la adaptación. La atribución visible es
  obligatoria, pero **no sustituye** al permiso. Sin derechos suficientes, solo cabe
  una tarjeta de enlace (_link-only_) con metadatos factuales propios.
- El proyecto no está afiliado con Crate Entertainment ni con GrimTools. Mantén el
  aviso de no afiliación.
- Los archivos de `content/` son fixtures de desarrollo y material de importación, no
  una fuente de producción (principio VI).

## Activos oficiales de Grim Dawn

- Iconos, texturas y arte oficial solo se incluyen si el manifiesto de activos
  (`content/assets/manifest.json`) registra su origen exacto, titular, licencia o permiso
  y prueba, con estado `approved`.
- Mientras no exista esa entrada, se usa arte propio o genérico: los glifos SVG de
  respaldo.
- `pnpm assets:check` valida el manifiesto.

## Alcance y fronteras

- En el MVP no se añaden cuentas, comentarios, calculadora, Redis, colas o workers,
  proveedores de autenticación externos ni almacenamiento de objetos (principio VIII).
  `pnpm check:scope` falla ante estas piezas.
- Las fronteras del monorepo son: web → `@gd/domain`, API → `@gd/domain` y scripts →
  `@gd/domain`. Está prohibido web ↔ API y el dominio no depende de Angular, HTTP ni
  de la base de datos. `pnpm check:boundaries` lo comprueba.
- Mover la aplicación a `apps/web` es un PR dedicado; sigue el orden de
  [plan §12.3](specs/001-mvp-guias-builds/plan.md).

## Documentación Markdown

- Todo archivo Markdown rastreado debe pasar `pnpm lint:md` (markdownlint, según
  las restricciones de calidad de documentación de la constitución).
- La configuración está en [`.markdownlint-cli2.jsonc`](.markdownlint-cli2.jsonc).
  Solo se admiten desactivaciones de **MD013** (longitud de línea) y **MD060**
  (estilo de columnas), cada una con su motivo escrito. No añadas desactivaciones
  puntuales sin motivo.
- Prettier da formato general a los archivos de `format:check`. Si Prettier y
  markdownlint chocan en un `.md`, prevalece markdownlint.

## Pull requests

Usa la plantilla de [`.github/pull_request_template.md`](.github/pull_request_template.md)
y completa cada punto, o márcalo como no aplicable con una justificación.

- Indica la rama de destino: `mvp/1`, `develop` o `main`, según el camino de la sección
  de ramas.
- Enlaza las tareas SDD (`T-xxx`) que cubre el PR.
- Describe qué cambia y por qué, y qué comandos ejecutaste con su resultado.
- Justifica cualquier dependencia nueva y cualquier excepción de alcance.
- El CI de pull request debe estar en verde. Las puertas de DAST y revisión de
  Copilot se exigen según la política de ramas; ver los puntos de la plantilla.
- **DAST**: el escaneo dinámico (DAST) está pendiente de implementar en la tarea T-077.
  Hoy no existe ningún job de DAST en el CI; no lo des por cubierto.

## Documentos SDD relacionados

- [Constitución](.specify/memory/constitution.md): principios, restricciones y política de ramas.
- [Especificación](specs/001-mvp-guias-builds/spec.md): requisitos funcionales y criterios de aceptación.
- [Plan](specs/001-mvp-guias-builds/plan.md): arquitectura, presupuestos (§6), backend y Docker (§12), seguridad y CI (§12.8), markdownlint (§12.14) y secretos (§13).
- [Tareas](specs/001-mvp-guias-builds/tasks.md): tareas, dependencias y orden. Relevantes para este proceso: T-064 (CI de verificación), T-066a (secretos), T-076 (esta guía), T-077 (DAST, pendiente) y T-123 (markdownlint).
- [README](README.md): visión general del proyecto y comandos básicos.
- [Configuración del CI](.github/workflows/ci.yml): controles que se ejecutan en cada pull request.

## Impeccable para las tareas sdd-ui

El rol UI requiere el skill Impeccable. Reprodúcelo desde la raíz con la versión
fijada (solo herramienta del agente, sin dependencia de la web):

```powershell
$env:NPM_CONFIG_CACHE = Join-Path ([IO.Path]::GetTempPath()) 'gd-impeccable-npm-cache'
$env:IMPECCABLE_HOME = Join-Path ([IO.Path]::GetTempPath()) 'gd-impeccable-runtime'
npx --yes impeccable@4.8.1 install --providers=codex --scope=project --no-hooks
```

El payload generado y su binario quedan ignorados exactamente bajo
`.agents/skills/impeccable/`. No se instalan hooks nativos ni se activa confianza
para ejecutar hooks; cargar el SKILL.md explícitamente y ejecutar su detector al
terminar el cambio UI. Cualquier harness puede leer el mismo skill; los comandos
Windows usan su launcher `.cmd`. La instalación no sustituye las cuatro revisiones
obligatorias de cierre de Spec Kit.

Angular vive en la raíz: el contexto UI debe señalar el archivo o ruta web activo,
por ejemplo `context --target src/styles.css`; `apps/api` y `packages/domain` no
son la app visual. Los tokens y el alcance aprobados de la spec prevalecen; una
tarea de estilos sobre ese sistema no requiere reabrir decisiones de producto.
Versiones, integridad y evidencia en
[tooling-provenance.md](specs/001-mvp-guias-builds/tooling-provenance.md).

## Presupuesto JavaScript inicial

El comando canónico `pnpm build` ejecuta Angular, finaliza la portada estática
y ejecuta `check:initial-js`. La portada conserva HTML, SEO, estilos y enlaces
nativos; no arranca JavaScript cliente. El finalizador rechaza controles que
dependan de JS, handlers desconocidos y estructuras incompatibles. Si la portada
necesita nueva interacción, actualizar primero su contrato SDD; no excluirla del
checker ni retirar funciones para conseguir cero bytes.

La puerta mide gzip real nivel 6, máximo 90000 bytes para la portada y 110000 para
el catálogo prerenderizado. Cero solo se acepta con el contrato estático validado.
Las rutas hidratadas incluyen bootstrap, módulo lazy, imports compartidos y
scripts inline ejecutables; JSON-LD y TransferState son datos. El catálogo usa
soporte de hidratación i18n y replay; sus scripts no se retiran.
El límite raw aproximado de Angular (warning 280kB/error 300kB) no sustituye la
medición gzip. Ejecutar solo `pnpm ng build` omite finalización y puerta gzip.

La medición usa `dist/grim-dawn-builds/stats.json`, que queda fuera del directorio
público `browser`; sirve solo `browser` al previsualizar. No publiques los stats
junto con el sitio. Para comprobar un artefacto existente:

```bash
pnpm check:initial-js
```

Este control no acredita presupuestos de guías, CSS/HTML ni Lighthouse. Los
checks de T-042/T-126 completan esa cobertura antes del cierre. El release usa
la misma finalización antes del hash y escanea secretos antes y después.
