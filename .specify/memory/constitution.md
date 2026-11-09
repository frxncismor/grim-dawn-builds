# Constitución del proyecto — Grim Dawn Builds

Plataforma web de guías de builds interactivas de Grim Dawn (estilo Maxroll), en español primero.

## Principios

### I. Contenido editorial verificable y atribuido

Toda guía, tier y dato de juego tiene autor, fuente(s), un estado de revisión (`borrador` → `en_revision` → `publicado`), un estado de contenido (`verificado` / `sin_verificar` / `placeholder`) y un **estado de derechos** (`rights_status`). Nunca se publica contenido sin atribución ni con derechos `pending`. No se presenta como verificado lo que no lo está, ni un `placeholder` como contenido real.

### II. Sin scraping automático en el MVP

La importación es manual y editorial (copiar/transcribir con fuente y revisión). Cualquier ingesta automatizada requiere una enmienda de esta constitución y un spec propio (términos de uso, robots, licencias).

**Hoja de ruta de adquisición (rev. 1.5.0, solo futura, no MVP)**: se admite planificar un carril de ingesta *permitida* con canalización por etapas (plan §14). Esto **no** concede permiso alguno ni relaja este principio: ninguna fuente se ingiere sin entrada en el registro de fuentes con permiso/licencia registrados y verificados (VII); queda prohibido el scraping automático y copiar texto, imágenes o activos de guías de terceros sin permiso explícito; el permiso nunca se presupone por silencio, por ser público ni por `robots.txt`; la atribución externa y el enlace con metadatos propios (*link-only*) son siempre el respaldo. Activarlo exige enmienda + spec propio por fuente. **Rev. 1.6.0**: está prohibido eludir controles de acceso (login, muros, captchas, límites, `robots.txt`/términos que lo prohíban) y hacer scraping de sitios que lo desautoricen; el foro de Grim Dawn es solo una **fuente candidata**: requiere evaluar sus términos de uso y los derechos/permiso de **cada autor** por separado; que una publicación sea pública no la hace reutilizable. No hay importación masiva ahora; la canalización futura (plan §14/§15) queda como diseño.

**Adaptación de builds de terceros (rev. 1.6.0)**: se admite el producto «build adaptada» (una guía externa, p. ej. del foro de Grim Dawn, reexpresada en el formato interactivo nativo) **solo** cuando la licencia de la fuente permite expresamente adaptación/republicación, o el autor/sitio titular concedió permiso registrado que cubre la adaptación. **La atribución visible NO sustituye al permiso**: «Esta build fue adaptada de: [fuente]» es obligatoria pero nunca suficiente. Toda build adaptada exhibe de forma destacada su atribución (UI y datos estructurados) y conserva metadatos de procedencia, evidencia de derechos, editor de la adaptación, alcance de la transformación y versión/revisión/cambios. Sin derechos confirmados, denegados o limitados: solo tarjeta *link-only* con metadatos factuales verificados de forma independiente, sin cuerpo de guía copiado o derivado, imágenes, activos ni afirmaciones de ranking. Ver spec FR-27–FR-33 y plan §15.

### III. SEO y compartibilidad primero (SSG/SSR)

Las páginas públicas se entregan como HTML completo (prerender/SSR) con `<title>`, meta description, canonical, Open Graph/Twitter, JSON-LD y sitemap. El contenido indexable no depende de JavaScript para existir; la interactividad lo mejora (hidratación).

### IV. El rendimiento es un requisito

Presupuestos medibles (definidos en `plan.md`) se verifican en CI. Sin dependencia nueva sin justificación escrita (tamaño, alternativa nativa descartada). Rutas con carga diferida, fuentes autoalojadas y subconjunto, SVG en lugar de imágenes raster para árboles.

### V. Accesibilidad WCAG 2.2 AA

Contraste, foco visible, navegación por teclado completa, `prefers-reduced-motion`, objetivos táctiles ≥ 24×24 CSS px (24 mínimo AA; 44 recomendado en móvil), alternativas textuales para todo SVG interactivo. La información nunca se transmite solo por color.

### VI. Datos tipados, validados y con una sola fuente de verdad

**PostgreSQL es la única fuente de verdad del contenido editorial de producción** desde el inicio del backend; las puertas de publicación, derechos y procedencia de activos se imponen en la base de datos (CHECK/trigger/vistas/roles) y en la API, no solo en la UI. El esquema de BD se define con Drizzle ORM y se cambia solo mediante migraciones versionadas; el contrato de dominio (TypeScript + Zod en `packages/domain`) valida fixtures, API y UI, y un test de paridad impide la deriva entre ambos. Los archivos `content/*.json` son **fixtures de pruebas/desarrollo y material de importación (seed/bootstrap)**, nunca una segunda fuente de producción. Los nombres de juego se guardan en `es` y `en`.

### VII. Legalidad y activos del juego

No se incluyen iconos, texturas ni arte oficial de Grim Dawn salvo que su fuente exacta, titular, licencia/permiso y prueba estén registrados en el manifiesto de activos con estado `approved`; hasta entonces se usa arte propio/genérico (glifos SVG fallback). Los derechos nunca se presuponen. Se incluye aviso de no afiliación con Crate Entertainment. Contenido de terceros (guías, tiers, texto, imágenes) solo con permiso/licencia registrados en `sources`; sin permiso, solo enlace con atribución y metadatos factuales propios. Las adaptaciones exigen además evidencia de derechos que cubra expresamente la adaptación, y están sujetas a retirada (*takedown*) y a revisión por cambios de la fuente (rev. 1.6.0).

### VIII. Simplicidad y mantenibilidad

El repositorio evoluciona a un **monorepo pnpm** (`apps/web`, `apps/api`, `packages/domain`, `infra/docker`) porque el usuario aceptó un backend contenido en Docker (segundo consumidor del esquema de dominio). La app Angular sigue en la raíz hasta una tarea/PR dedicada de migración; no se mueve nada de forma disruptiva antes. El backend (Fastify + Drizzle) se limita a una API + PostgreSQL con Docker Compose: **sin Redis, colas, proveedores de auth externos, almacenamiento de objetos ni microservicios** salvo requisito concreto documentado y enmienda. Sin cuentas, comentarios, calculadora ni workers en el MVP: se diseña para no impedirlos, no para implementarlos (YAGNI). **Hoja de ruta comunitaria (rev. 1.7.0, futura, no MVP)**: se admite *documentar* un carril de guías creadas por la comunidad (identidad, borradores del autor, editor estructurado, moderación; spec FR-34–FR-45, plan §16). No concede ni implementa cuentas, autenticación, editor público ni comentarios ahora; activarlo exige enmienda + spec propio, decisiones del usuario (proveedor de identidad, términos del colaborador, equipo de moderación/SLA) y comenzar con autores invitados/verificados. Las puertas de derechos (I, VII) aplican igual: una guía original requiere atestación de titularidad/licencia; una adaptación solo con permiso/licencia documentados.

### XI. Backend opcional, contenido y seguro por defecto

El backend no es requisito para **desarrollar, probar y verificar en CI** la web: el `FileContentRepository` sobre fixtures se conserva solo para desarrollo, pruebas y checks sin Docker (`CONTENT_SOURCE=fixture`). Todo **build de release/público** debe leer de la API/PostgreSQL (`CONTENT_SOURCE=api`) y **falla** si la fuente no es la API, si la API no está lista o si faltan migraciones; no hay degradación silenciosa a fixtures ni dos fuentes de producción. La API se integra detrás de `ContentRepository` y las puertas de derechos (`rights_status`, `review_state`, procedencia de activos) se imponen en BD y API; `packages/domain` las replica como reglas puras para fixtures y defensa doble. Controles obligatorios: imagen no-root, secretos solo en un archivo de entorno local ignorado por git (`.env.example` solo con nombres y valores por defecto seguros no secretos; ver XII), base de datos no expuesta al host por defecto, sin secretos en imágenes/capas/logs, migraciones versionadas, y `/health` (liveness) y `/ready` (readiness) en la API. Un único esquema de dominio (`packages/domain`) es la fuente de verdad compartida por web, API y scripts.

### IX. Pruebas proporcionales al riesgo

Validación de esquema y lógica de dominio con pruebas unitarias; renderizado SVG con pruebas de componente; flujos críticos con e2e; accesibilidad y rendimiento automatizados en CI.

### X. Español primero, preparado para i18n

Texto de interfaz y contenido en español (es-419 neutro). Las cadenas de UI pasan por el mecanismo de i18n de Angular desde el inicio; el contenido lleva `locale`.

### XII. Gestión de secretos por capas (sin secretos en el repositorio)

Ningún valor secreto se commitea jamás: ni en código, Dockerfiles, `ARG`/`ENV` de imagen, scripts de `package.json`, fixtures, `.env.example`, builds del frontend, logs ni artefactos de CI. Los secretos se separan por capas y por privilegio: **local** (archivos `.env` ignorados por git, credenciales de desarrollo claramente no productivas), **CI** (secretos de GitHub Actions de repositorio/entorno con mínimo privilegio, enmascarados; OIDC en lugar de credenciales de nube de larga vida cuando exista nube) y **producción** (diferida; solo mediante un almacén gestionado detrás de una abstracción neutral al proveedor, con inyección en runtime por archivo/volumen, rotación, auditoría de acceso y *break-glass*). Las credenciales de BD se separan por rol (`migrator`, `importer`, `editor`, `api_ro`) y cada proceso recibe solo la suya. El build público de Angular nunca recibe secretos de servidor: solo configuración pública explícita. Detalle, propiedad, rotación y respuesta a incidentes en `plan.md` §13. No se adopta un servicio de secretos autoalojado (p. ej. Vault) ni proveedor sin enmienda/decisión del usuario.

## Restricciones tecnológicas

- Angular (versión estable vigente al iniciar; fijar en `package.json`), TypeScript `strict`, SSR/prerender nativo de Angular.
- PostgreSQL **17** (imagen con versión fijada, sin `latest`) como fuente de verdad, contenida en Docker. Acceso público solo a contenido `publicado` con derechos aprobados mediante vistas y un rol de BD de solo lectura más el filtro de dominio. Fase inicial local-first: sin hosting remoto; hosting, secretos de despliegue y CI de despliegue se deciden después y no se asumen. Supabase deja de ser destino del esquema (sustituido por esta decisión).
- Gestor de paquetes: pnpm (fijado en `packageManager`) con workspaces.
- Backend: **Node.js 22 LTS** (`engines` e imagen fijados) + TypeScript `strict`, **Fastify**, **Drizzle ORM** (esquema TS + `drizzle-kit` para migraciones SQL versionadas, con migraciones SQL personalizadas para CHECK/triggers/vistas/roles), contenido en Docker con Docker Compose. Decisiones confirmadas por el usuario (2026-11-08).
- Calidad en CI: se admiten checks gratuitos de verificación en PR (lint, tipos, pruebas, build, auditoría); el **despliegue** y sus secretos siguen diferidos.
- **Calidad de documentación (confirmada 2026-11-08)**: todo archivo Markdown rastreado (`README.md`, `.specify/**/*.md`, `specs/**/*.md`, futuros `docs/**/*.md` y cualquier otro `*.md` del repo) **debe** pasar `markdownlint` (vía `markdownlint-cli2`, dependencia de desarrollo con versión fijada). El modo seguro `--fix` de markdownlint es el mecanismo del proyecto para correcciones automáticas de Markdown donde aplique; las reglas sin corrección automática se arreglan a mano. Prettier puede seguir usándose para formato general, pero no sustituye a markdownlint y este es obligatorio localmente (`pnpm verify`) y en el CI de PR (T-064). La configuración no puede desactivar reglas semánticas o de estructura (encabezados, listas, enlaces, bloques de código, tablas, HTML) sin una excepción puntual justificada por escrito; solo se admite relajar reglas puramente de presentación con motivo documentado (p. ej. longitud de línea en documentos de una línea por tarea). Se excluyen únicamente `node_modules`, `dist` y carpetas generadas o de sesión.
- Go/Rust: solo para workers futuros; fuera del alcance.

## Gobernanza

Esta constitución prevalece sobre specs y planes. Enmiendas: PR con justificación, versión incrementada y revisión de los artefactos dependientes.

**Política de ramas y fusión (confirmada 2026-11-08; GitFlow)**: tras **cada especificación Spec Kit completada** se crean uno o más commits en la rama de integración **`mvp/1`**; `mvp/1` se fusiona en **`develop` mediante PR**; `develop` se promueve a **`main` mediante un PR de release**. Todo PR exige las puertas de calidad: pruebas, lint, DAST y revisión de Copilot (más los checks de verificación del plan §12.8). Los agentes de planificación no crean ramas, commits, PRs ni hacen push: esas acciones las ejecutan el usuario o agentes de implementación con autorización explícita. Esta política se documenta aquí; su automatización en CI es trabajo de tareas posteriores (T-064, T-076), y la protección de ramas es configuración manual del usuario.

**Versión**: 1.8.0 | **Ratificada**: 2026-11-08 | **Última enmienda**: 2026-11-08 (1.8.0: Restricciones — markdownlint obligatorio para todo Markdown, `--fix` seguro como mecanismo de autocorrección, integrado en `pnpm verify` y CI de PR; Prettier complementario. 1.7.0: VIII — hoja de ruta documental de guías comunitarias, sin cuentas/editor/comentarios en el MVP, por etapas desde autores invitados. 1.6.0: I/II/VII — builds adaptadas de terceros solo con licencia/permiso que cubra adaptación; atribución obligatoria pero insuficiente; link-only como respaldo; takedown, detección de cambios, prohibido eludir accesos/scrapear sitios que lo prohíban; foro de Grim Dawn = fuente candidata por autor. 1.5.0: II declara la hoja de ruta de adquisición permitida (futura, sin permiso implícito). 1.4.0: nuevo principio XII, gestión de secretos por capas; precisa en XI que `.env.example` contiene nombres y valores seguros no secretos. 1.3.1: política de ramas `mvp/1` → `develop` → `main` y puertas de PR (pruebas, lint, DAST, Copilot). 1.3.0: PostgreSQL = única fuente de verdad de producción; `content/` = fixtures/seed; Fastify, Drizzle, Node 22 LTS, PostgreSQL 17 confirmados; builds de release solo desde la API; modifica VI, XI y restricciones. 1.2.0: VIII pasa a monorepo pnpm con backend Docker; nuevo XI backend opcional/seguro; CI de verificación permitido, despliegue diferido. 1.1.0: estado de derechos y `content_status` en I; puerta de activos oficiales en VII; local-first)
