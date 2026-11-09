# Cómo contribuir

Esta guía describe cómo proponer cambios en Grim Dawn Builds: ramas, entorno
local, comandos de verificación, reglas de contenido y lista de comprobación
para pull requests. Aplica a personas y a agentes de implementación.

Si algo de esta guía contradice la constitución o las especificaciones SDD, prevalecen
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) y
[`specs/001-mvp-guias-builds/`](specs/001-mvp-guias-builds/).

## Antes de empezar

1. Lee la [constitución](.specify/memory/constitution.md), la
   [especificación](specs/001-mvp-guias-builds/spec.md), el
   [plan](specs/001-mvp-guias-builds/plan.md) y las
   [tareas](specs/001-mvp-guias-builds/tasks.md) de la funcionalidad que vas a tocar.
2. Trabaja **una tarea a la vez**, respetando el orden y las dependencias de
   `tasks.md`. Las tareas marcadas `[UI]` siguen su propio flujo de interfaz.
3. Marca una tarea como `[x]` en `tasks.md` solo cuando sus comprobaciones pasen.
4. Si la especificación o el plan son ambiguos o se contradicen, pregunta antes de
   implementar. No cambies la especificación para hacer encajar el código.

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
pnpm start
```

Abre `http://localhost:4200/`. Usa `--frozen-lockfile` igual que el CI para no
modificar `pnpm-lock.yaml` sin querer.

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
  (configuración manual) ni a un escáner en pre-commit, que todavía no existe (T-083).
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
