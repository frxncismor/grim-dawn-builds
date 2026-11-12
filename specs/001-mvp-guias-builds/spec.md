# Especificación: MVP de guías de builds de Grim Dawn

**Feature**: `001-mvp-guias-builds` | **Estado**: Revisado (rev. 4: BD como fuente de verdad; Fastify + Drizzle, Node 22, PostgreSQL 17) | **Fecha**: 2026-11-08
**Idioma del contenido**: español | **Fuente a migrar**: `elementalista-golpe-primigenio.html` (fixture local; no publicable mientras `rights_status=pending`)

## 0. Decisiones confirmadas del usuario (rev. 2)

| Clave                                         | Decisión (texto del usuario, resumido)                                                                                                                                                                                                                                                                                                                                                               | Efecto                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `guide_rights=pending`                        | La guía Elementalista/Golpe Primigenio sigue como **borrador no público** hasta confirmar autoría y derechos de republicación. Puede usarse localmente como fixture de migración; la publicación pública se bloquea con un estado de derechos explícito.                                                                                                                                             | FR-13, AC-07, AC-09, T-014, T-044                           |
| `tierlist=all_builds`                         | La tier list debe contener **todas las builds de Grim Dawn**, no solo la del autor. El MVP necesita un marco de catálogo/tier list completo (todas las combinaciones de maestrías); el contenido real exige procedencia, atribución, estado de derechos, estado de revisión y distinguir verificado / sin verificar / placeholder. No se implica que se pueda copiar o raspar contenido sin permiso. | US2, FR-12, FR-14, FR-15, AC-04, A3                         |
| `game_art=official_assets`                    | Iconos/arte oficiales solo si se documenta su fuente/licencia/permiso exactos. Manifiesto de activos con puerta de procedencia; SVG locales como fallback hasta que cada activo la pase. No se asumen derechos concedidos.                                                                                                                                                                           | FR-16, AC-10, §7, T-047–T-048                               |
| `hosting=local_first`                         | Desarrollo y verificación inicial solo locales; proveedor de hosting, secretos y CI de despliegue quedan diferidos. Se conserva la portabilidad.                                                                                                                                                                                                                                                     | A7, FR-17, plan §11, T-004, T-045                           |
| `backend=docker_monorepo` (rev. 3)            | El usuario aceptó un backend contenido en Docker, gestionado como monorepo pnpm en este mismo repositorio. Convención del repo: GitFlow, PRs y checks de CI gratuitos; sin commits/push por agentes.                                                                                                                                                                                                 | FR-18–FR-21, plan §12, T-050–T-070                          |
| `backend_stack=fastify_drizzle_pg17` (rev. 4) | **Fastify** (API), **Drizzle ORM** (persistencia/migraciones), **Node.js 22 LTS**, **PostgreSQL 17**. Sin hosting remoto todavía.                                                                                                                                                                                                                                                                    | FR-18–FR-24, plan §12, B-1–B-3 cerradas                     |
| `db_source_of_truth` (rev. 4)                 | **PostgreSQL es la fuente de verdad desde el principio**, no una proyección de `content/`. Los JSON pueden quedar como fixtures de pruebas/importación; la titularidad editorial de producción y las puertas de publicación/derechos/activos se imponen en BD y API.                                                                                                                                 | FR-22–FR-24, AC-15–AC-17, A12/A13 reemplazadas, B-4 cerrada |
| `git_policy` (rev. 4)                         | Tras cada especificación Spec Kit completada: commit(s) en la rama de integración `mvp/1`; PR `mvp/1` → `develop`; PR de release `develop` → `main` (GitFlow). Puertas de PR: pruebas, lint, DAST y revisión de Copilot. Solo documentado; sin ramas/commits/PR/CI ahora.                                                                                                                            | Constitución (Gobernanza), plan §12.8, T-064, T-076, T-077  |

## 1. Resumen y valor

Los jugadores de Grim Dawn necesitan guías de builds rápidas, claras y compartibles. El MVP entrega: (1) una portada mínima, (2) una tier list filtrable y (3) una página de build interactiva que migra la guía existente «Chamán + Demoledor · Golpe Primigenio» con árboles de habilidades y devociones visuales, orden de compra, filtro de botín, resumen y atribución.

## 2. Historias de usuario (priorizadas)

### US1 (P1) — Leer una guía de build interactiva

Como jugador, abro `/builds/chaman-demoledor-golpe-primigenio` (desde Google o un enlace compartido) y entiendo qué subir primero, en qué orden y por qué.
**Escenarios**:

1. Dado que abro la página en móvil con conexión 4G, cuando carga, entonces veo título, resumen y la tabla de contenidos sin esperar a JavaScript.
2. Dado el bloque «Orden real de compra», cuando selecciono un paso, entonces las habilidades correspondientes se resaltan en el árbol SVG y se muestra el texto del porqué.
3. Dado un nodo de habilidad, cuando lo enfoco/toco/paso el cursor, entonces veo nombre ES/EN, requisito de barra, etiqueta (p. ej. «Transmutador») y justificación; también accesible con teclado.
4. Dado el bloque de devociones, cuando avanzo por los pasos de la ruta, entonces las constelaciones y sus enlaces de poder→habilidad se resaltan, con aviso visible si el paso está `sin_verificar`.
5. Dado el filtro de botín, cuando abro una columna, entonces veo qué marcar/desmarcar y puedo copiar el resumen como texto.
6. Dado que comparto un enlace con ancla (`#devociones`), entonces el destinatario aterriza en esa sección.

### US2 (P1) — Explorar la tier list / catálogo de todas las builds con filtros

Como jugador, veo un catálogo que cubre **todas las combinaciones de maestrías** de Grim Dawn, con builds agrupadas por tier (S/A/B/C/D, más «Sin clasificar») y filtro por maestría(s), tipo de daño, contenido (campaña, Shattered Realm, Crucible, jefes), estilo (melee/rango/pets/híbrido), estado de contenido (verificado / sin verificar / placeholder) y texto. Una combinación sin builds catalogadas aparece como ranura `placeholder` (sin tier, sin guía), nunca como contenido inventado.
**Escenarios**:

1. Dada la tier list, cuando elijo «Rayo» y «Chamán», entonces solo aparecen builds que cumplan ambos (AND entre grupos, OR dentro de un grupo) y el contador se actualiza.
2. Dado un filtro aplicado, cuando copio la URL y la abro, entonces el mismo filtro está activo (estado en query string).
3. Dado que no hay resultados, entonces veo un estado vacío con acción «Limpiar filtros».
4. Dada una entrada con guía publicada, cuando la selecciono, entonces navego a su página; si no tiene guía, se muestra «Guía próximamente» (no enlace roto).
5. Toda entrada muestra tier, fecha de última revisión, versión del juego y su `content_status` (insignia «Verificado», «Sin verificar» o «Placeholder»), con texto, no solo color.
6. Dada una entrada que enlaza a una guía externa, entonces se muestra atribución (autor/sitio), enlace externo (`rel="noopener"`) y el aviso «contenido de terceros, no alojado aquí»; nunca se muestra texto copiado de esa guía.
7. Dado el catálogo, cuando filtro por una combinación de maestrías sin builds, entonces veo la ranura `placeholder` de esa combinación (estado informativo, no «vacío por error»).

### US3 (P2) — Portada mínima

Como visitante, en `/` entiendo qué es el sitio, veo la build destacada, un acceso a la tier list y los criterios editoriales (atribución/revisión).

### US4 (P2) — Atribución y confianza

Como lector, veo autor, fuentes con enlace, fecha de publicación/actualización, versión del juego y estado de revisión en cada guía y tier. Existe `/autores/:slug`.

### US5 (P2) — Flujo editorial manual

Como editor, creo/actualizo una build mediante archivos de contenido validados + importación a la base de datos, con estado de revisión; nada se publica sin autor, ≥1 fuente y revisor.
**Escenarios**: (1) un archivo inválido falla en la validación con mensaje de campo; (2) cambiar a `publicado` exige autor/fuente/revisor **y** `rights_status` aprobado (ni `pending` ni `unknown`); (3) tras publicar, un build local regenera las páginas (el redeploy a un host queda diferido); (4) un activo oficial sin entrada aprobada en el manifiesto falla la validación y se usa el SVG fallback.

### US6 (P2, rev. 6) — Build adaptada con atribución y derechos

Como lector veo, en una build adaptada de un tercero, una atribución destacada («Esta build fue adaptada de: …») con enlace, licencia/permiso y fecha. Como editor, solo puedo publicarla si hay evidencia de derechos que cubra la adaptación; si no, publico una tarjeta _link-only_. Como titular, puedo pedir su retirada. **Escenarios**: (1) sin evidencia de adaptación ⇒ bloqueada; (2) permiso revocado ⇒ pasa a _link-only_/retirada; (3) la fuente cambia ⇒ se abre revisión; (4) solo atribución, sin licencia ⇒ rechazada. Ver FR-27–FR-33.

### US7 (P3, futura, rev. 7) — Guías comunitarias

Como colaborador invitado, creo borradores de guías originales con un editor estructurado, atesto titularidad/licencia y las envío a revisión; solo puedo enviar una adaptación con permiso/licencia documentados. Como moderador, reviso y publico o devuelvo; como lector, solo veo lo revisado y puedo reportar. **No implementada en el MVP** (FR-34–FR-45).

## 3. Requisitos funcionales

- **FR-01** Portada, tier list, página de build, página de autor, página «Acerca / criterios editoriales», 404 y páginas legales mínimas (aviso de no afiliación).
- **FR-02** Página de build con secciones estructuradas: resumen/cabecera, prioridades, árboles de habilidades (por maestría), orden de compra, equipo/atributos/notas generales, filtro de botín, Guía Espiritual (reembolso), devociones, video (opcional), fuentes y créditos.
- **FR-03** Renderizador SVG de árbol de habilidades y de devociones (ver §5), generado desde datos, no imágenes.
- **FR-04** Tier list con filtros combinables, estado en URL, orden por tier y búsqueda por texto.
- **FR-05** Cada build y tier tiene autor, ≥1 fuente, `review_state`, `game_version`, `updated_at`.
- **FR-06** Los nombres de habilidades/constelaciones se muestran en español con el inglés secundario; la búsqueda acepta ambos.
- **FR-07** Datos con confianza parcial (afinidades de devoción intermedias de la guía original) se marcan `sin_verificar` y el aviso «verifica en GrimTools antes de gastar» es visible.
- **FR-08** Progreso local opcional (checklist de pasos de compra) en `localStorage`, sin cuenta; se puede borrar.
- **FR-09** SEO: title/description únicos, canonical, Open Graph/Twitter, JSON-LD (`Article`/`BreadcrumbList`, `ItemList` en tier list), `sitemap.xml`, `robots.txt`.
- **FR-10** Tras publicar contenido, las páginas públicas son HTML prerenderizado.
- **FR-10a** La portada mínima conserva todo su contenido, SEO, accesibilidad y navegación sin JavaScript. No ofrece controles que dependan de código cliente. El catálogo y las guías mantienen sus mejoras interactivas hidratadas; acceder desde la portada abre una página completa funcional. Los presupuestos aprobados no aumentan por esta política de entrega.
- **FR-11** Video: campo opcional (URL de YouTube); se carga con «facade» (sin cargar el iframe hasta interacción).
- **FR-12** Catálogo/tier list con marco completo: se generan desde el catálogo de maestrías todas las ranuras de combinación (pares y, si se decide, maestría única) como entradas `placeholder`; el seed añade solo entradas con procedencia documentada (ver A3 y FR-14).
- **FR-13** Estado de derechos `rights_status` (`pending | own_original | licensed | permission_granted | link_only`) en toda build/entrada con contenido propio o de terceros. `pending` (y cualquier valor no aprobado) **bloquea la publicación pública**: la página no se prerenderiza en el build público, no entra en sitemap, y la validación falla si `review_state='publicado'`. Los borradores se pueden ver solo en modo local (`INCLUDE_DRAFTS`) con banner «Borrador · no público» y `noindex`.
- **FR-14** Procedencia por entrada: `source_id` con URL/autor/licencia/`retrieved_on`, `content_status` (`verificado | sin_verificar | placeholder`), `review_state`, `rights_status`, `evaluated_on`. `verificado` exige revisor humano y fuente primaria; `placeholder` no puede tener tier, texto de guía ni enlace de guía.
- **FR-15** Política de contenido para el catálogo (enfoque inicial viable): (a) ranuras `placeholder` generadas mecánicamente (hechos: nombres de maestrías); (b) entradas «enlace» (`link_only`): título, enlace a la guía externa, atribución, y metadatos factuales propios (maestrías, tipo de daño); sin copiar texto, imágenes ni tiers de terceros; (c) tier solo si lo asigna el editor con su criterio propio y fuente; si proviene de una tier list ajena, requiere permiso registrado, si no queda «Sin clasificar»; (d) guías completas solo propias o con licencia/permiso. Sin scraping ni importación automática (Constitución II).
- **FR-16** Activos del juego: manifiesto `content/assets/manifest.json` con por activo: `id`, archivo, origen (URL exacta), titular de derechos, licencia/permiso (texto o enlace a la prueba), fecha, `status` (`pending | approved | rejected`) y `fallback_svg`. La UI solo usa un activo oficial si `status='approved'` con campos completos; en caso contrario renderiza el SVG local de fallback. Ningún activo oficial se incluye en el repositorio mientras no esté aprobado.
- **FR-17** Local-first: todo el MVP es construible, ejecutable y verificable localmente sin cuentas, secretos ni servicios remotos (adaptador de archivos). Hosting, secretos de despliegue y CI de **despliegue** están fuera del alcance inicial; la URL base y el adaptador de datos son configurables para portar a cualquier host después. (rev. 3: los checks de CI de **verificación** en PR sí están permitidos por convención del repo.)
- **FR-18** (rev. 4) Backend: una API **Fastify** en Docker + **PostgreSQL 17** con Docker Compose para desarrollo local, y **fuente de verdad del contenido editorial**. La web se integra como adaptador de `ContentRepository` (`ApiContentRepository`). Sin nuevos requisitos de usuario final: no se añaden cuentas ni escritura pública.
- **FR-19** (rev. 3) La API expone `/health` (liveness, sin dependencias) y `/ready` (readiness: BD alcanzable y migraciones aplicadas), y solo lectura pública de contenido `publicado` con derechos aprobados. La escritura/importación es un proceso local de editor (script) y no un endpoint público en esta fase.
- **FR-20** (rev. 3) Seguridad del backend: imagen no-root, secretos solo vía archivo de entorno local ignorado por git, BD no publicada al host por defecto, sin secretos en imágenes/logs, validación de entrada/salida con el esquema de dominio, CORS restringido a orígenes configurados.
- **FR-21** (rev. 3) Monorepo pnpm con layout objetivo `apps/web`, `apps/api`, `packages/domain`, `infra/docker`; la migración desde la app Angular en la raíz ocurre solo en una tarea/PR dedicada, nunca como efecto lateral de otra tarea.
- **FR-22** (rev. 4) **Una sola fuente de verdad de producción**: PostgreSQL. Los JSON de `content/` son fixtures (pruebas, desarrollo, CI sin Docker) y material de importación; no se editan como fuente de producción ni existe sincronización bidireccional. Hay exactamente dos modos de fuente: `fixture` (solo dev/test/CI) y `api` (único permitido para builds de release/públicos).
- **FR-23** (rev. 4) Las puertas se imponen en BD y API: (a) `review_state='publicado'` exige autor no placeholder, `published_at`, `reviewed_by`, ≥1 fuente y `rights_status` aprobado con `rights_confirmed_by/on` (CHECK/trigger); (b) `pending`/borrador/`en_revision` jamás aparecen en vistas públicas ni en respuestas; (c) un activo solo puede tener `file_path`/ser servido como oficial con `status='approved'` y procedencia completa (origen exacto, titular, licencia/permiso, prueba); si no, solo `fallback_svg`; (d) el rol de la API no puede escribir ni leer tablas base. La validación Zod del dominio es defensa adicional, no la única.
- **FR-26** (rev. 5, **hoja de ruta futura; no MVP, no se implementa**) Carril de adquisición y normalización de información de builds existentes hacia el formato interactivo canónico, solo desde fuentes **permitidas**: envíos de autores con licencia/consentimiento, datos con licencia o exportados por su titular, APIs documentadas o permiso explícito y registrado, y metadatos de solo enlace (_link-only_, datos factuales propios + atribución). **Prohibido**: scraping automático y copia de texto, imágenes o activos de guías de terceros sin permiso. El permiso nunca es implícito. Canalización por etapas en plan §14; toda fila resultante nace como `borrador` y pasa por verificación humana y las puertas de publicación existentes (FR-23). Si falla una etapa o falta permiso, el contenido queda en cola de revisión o degrada a solo enlace con atribución.
- **FR-25** (rev. 5) Gestión de secretos por capas (Constitución XII, plan §13): ningún secreto en el repo, Dockerfiles, scripts, fixtures, builds del frontend, logs o artefactos de CI; `.env.example` solo nombres y valores seguros no secretos; credenciales de BD separadas por rol y por servicio; detección automática (pre-commit + CI); runbook de exposición y rotación; producción diferida con interfaz neutral al proveedor. Sin Vault ni proveedor por ahora.
- **FR-24** (rev. 4, B-7 cerrada 2026-11-09) Ciclo de vida de la BD: migraciones Drizzle versionadas por paso explícito; seed de fixtures solo en `development`/`test`; bootstrap inicial de una sola vez registrado en BD, tras el que se bloquea reimportar fixtures. La escritura posterior usa **CLI local con rol `editor` y validación de dominio**, elegida por el usuario; sin API admin, auth, cuentas ni editor público. Las puertas de publicación y derechos se conservan en dominio/BD.

- **FR-27** (rev. 6) **Build adaptada** (decisión del usuario: adaptar builds existentes, p. ej. del foro de Grim Dawn, al formato interactivo nativo con atribución visible en una sección «Fuentes», p. ej. «Esta build fue adaptada de: [fuente]»). Solo se publica una adaptación completa si `rights_status ∈ {licensed, permission_granted}` y la evidencia de derechos **cubre expresamente adaptación/republicación** (licencia explícita, o permiso registrado del autor/sitio). **La atribución sola nunca basta.** Modo «adaptación» ≠ modo «solo enlace»: no se mezclan en la misma entrada.
- **FR-28** (rev. 6) Procedencia obligatoria de toda adaptación: URL de origen, título/autor/sitio originales, fecha de captura, evidencia de derechos (tipo, referencia, alcance, vigencia), editor de la adaptación, alcance de la transformación (`estructura`, `traduccion`, `reescritura`, `datos_factuales`; qué se conservó/omitió), y versión/revisión/historial de cambios. Falta cualquier campo ⇒ no publicable.
- **FR-29** (rev. 6) Atribución prominente: bloque «Fuentes» visible sin scroll excesivo cerca del encabezado de la guía y repetido en la sección Fuentes («Esta build fue adaptada de: [título] de [autor] en [sitio]», con enlace, licencia/permiso y fecha), y reflejada en JSON-LD (`isBasedOn`/`citation`/`author`/`license` cuando aplique). No puede ocultarse, colapsarse ni omitirse en tarjetas, vista compartida u OG.
- **FR-30** (rev. 6) Derechos no confirmados, denegados, limitados, caducados o revocados ⇒ **solo tarjeta _link-only_**: título, autor, sitio, URL, fecha y datos factuales (maestrías, tipo de daño) verificados de forma independiente; sin texto/estructura de la guía copiado o derivado, sin imágenes/activos ni afirmaciones de ranking/tier derivadas de la fuente. Es el estado por defecto y el respaldo ante retirada.
- **FR-31** (rev. 6) Flujo editorial de permisos: plantilla de solicitud al autor/sitio (alcance: adaptación, traducción, atribución, vigencia, retirada), registro de respuesta y evidencia; **puerta de verificación y publicación** de adaptaciones: (1) fuente registrada, (2) evidencia revisada por una persona ≠ editor de la adaptación, (3) alcance de la evidencia ⊇ alcance de la transformación, (4) metadatos FR-28 completos, (5) atribución FR-29 renderizada, (6) revisión de juego/contenido. Cualquier fallo ⇒ `borrador` o _link-only_.
- **FR-32** (rev. 6) Retirada (_takedown_) y revocación: canal de contacto publicado; ante solicitud del titular o revocación se **despublica de inmediato** (a _link-only_ si el titular lo acepta, o retirada total), se registra el evento (quién, cuándo, motivo), se invalida caché/sitemap y se purga cualquier captura cruda. Objetivo operativo: ≤ 72 h hasta la retirada efectiva (ajustable por el usuario).
- **FR-33** (rev. 6) Detección de cambios en la fuente: revisión periódica **manual** (o por enlace/HTTP permitido, sin eludir acceso) que compara versión/fecha/hash de lo observado; un cambio abre una revisión editorial y no actualiza lo publicado automáticamente; si la fuente desaparece, cambia de licencia o prohíbe, se aplica FR-32. Prohibido eludir controles de acceso y scrapear sitios que lo prohíban (términos, `robots.txt`, login/muros). El foro de Grim Dawn es **fuente candidata**: requiere revisar sus términos de uso y la evaluación de derechos de **cada autor**; ser público no implica reutilizable.

- **FR-34** (rev. 7, **hoja de ruta futura; no MVP, no se implementa**) Capacidad de **guías de autoría comunitaria**. En el MVP siguen fuera: cuentas públicas, editor público, comentarios. Este bloque (FR-34–FR-45) solo documenta el diseño futuro y sus decisiones pendientes; no habilita código de autenticación ni de aplicación.
- **FR-35** Identidad/cuentas **diferidas**: proveedor de identidad (OIDC propio vs. gestionado), verificación de correo, MFA para moderadores y política de datos personales se deciden después (D-1). Hasta entonces, autores invitados registrados por el equipo editorial (`authors` + rol), sin registro abierto.
- **FR-36** Flujo de **borrador propiedad del autor**: solo el autor (y moderadores/editores) ve y edita su borrador; estados `borrador → enviada → en_revision_editor → cambios_solicitados | aprobada → publicado`, más `retirada` y `rechazada`. Solo se publica tras revisión (nunca autopublicación) con `rights_status` aprobado (Constitución I).
- **FR-37** **Editor estructurado respaldado por BD**: el autor completa el esquema canónico `Build` (maestrías, nodos, prioridades, pasos, notas, devoción) mediante formularios, no HTML libre; texto en subconjunto seguro (sanitizado, sin HTML/JS ni imágenes remotas); guardado en PostgreSQL como fuente de verdad; versiones inmutables por envío.
- **FR-38** **Validación** en tres capas: Zod de dominio (campos, enums, referencias a catálogo), CHECK/trigger en BD (puertas FR-23) y revisión humana; los errores indican campo. No se acepta contenido que referencie activos oficiales sin entrada `approved`.
- **FR-39** **Atestación explícita de licencia/titularidad** en cada envío: (a) _guía original_: el autor declara ser autor y titular, concede la licencia de contribución vigente (términos del colaborador, D-2), garantiza no incluir material de terceros ni activos del juego sin derechos; (b) _adaptación_: además requiere documentar fuente y permiso/licencia (FR-27/FR-28) con evidencia revisada por un moderador distinto del autor; sin evidencia que cubra adaptación el envío se rechaza o se reduce a _link-only_ (FR-30). Se guarda versión de los términos aceptados, fecha y huella de la aceptación.
- **FR-40** **Procedencia/fuentes** por guía comunitaria: tipo (`original` | `adaptacion`), fuentes y referencias, autor, fecha, versión del juego, alcance de la transformación; las originales pueden citar referencias sin copiarlas. Las adaptaciones heredan FR-28/FR-29 (atribución prominente).
- **FR-41** **Roles y revisión**: `autor`, `editor` (revisión de contenido/juego), `moderador` (derechos, abuso, retiradas), `admin`. Separación: nadie aprueba su propia guía; revisor de derechos ≠ editor de la adaptación. Checklist de revisión documentado (extiende plan §15.2).
- **FR-42** **Reportes y retirada**: canal público de reporte de infracción/abuso por guía; mismo flujo de retirada que FR-32; despublicación inmediata cautelar permitida a moderadores; el autor puede retirar su guía.
- **FR-43** **Límites y controles de abuso**: límites de tasa por identidad/IP en guardado/envío/reporte, tamaño máximo por guía, tope de borradores y de envíos pendientes, cuarentena de cuentas nuevas, detección de duplicados/spam, bloqueo/suspensión de autores. Sin comentarios públicos.
- **FR-44** **Auditoría e historial de versiones**: registro append-only de quién/cuándo/qué (creación, edición, envío, decisión de revisión, publicación, retirada, cambios de rol); versiones inmutables con diff; lo publicado es una versión concreta; revertir crea una nueva versión.
- **FR-45** **Visibilidad pública solo tras revisión**: las vistas `v_public_*` exponen únicamente la versión `publicado` aprobada; borradores, `enviada`, `en_revision`, `cambios_solicitados`, evidencias y datos internos nunca son públicos ni se emiten en el build de release.
- **FR-46** (rev. 8) **Calidad de Markdown**: todo `*.md` rastreado (README, `.specify/`, `specs/`, futuros `docs/`) se valida con markdownlint; existe un comando de corrección segura (`--fix`) y la validación es parte de `pnpm verify` y del CI de PR. La configuración no debilita reglas semánticas/estructurales (Constitución, Restricciones tecnológicas).

## 4. Campos migrables de la guía existente

Derivados de `elementalista-golpe-primigenio.html`; ver mapeo a tablas en `data-model.md`.

| Bloque HTML                    | Campos de contenido                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header`                       | eyebrow, título (maestría A + maestría B con color de acento), subtítulo, leyenda de colores (azul = Chamán, naranja = Demoledor)                                                                                                                                               |
| `.slab` «Lee esto primero»     | callout: título + 2 párrafos (barra de maestría ≠ puntos a invertir; ejemplos Clamatormentas 50, Escudo Explosivo 32)                                                                                                                                                           |
| «Qué subir ya mismo» (`.rows`) | lista priorizada: rank, maestría, habilidad, objetivo de puntos (máx/1/12/«después»), nota; fila «Aún no» con 3 habilidades                                                                                                                                                     |
| «Qué tocar en cada árbol»      | por maestría: nombre, rol, nodos: nombre ES, nombre EN, `barra N`, padre (jerarquía), etiqueta (Transmutador), justificación, estado (`recomendada`/`meta`/`omitir`) — p. ej. «Templar · Golpe de Fuego · Granada» = omitir                                                     |
| «Orden real de compra»         | pasos: umbral (maestría + barra, o «Nivel 60+»), título, texto, habilidades y puntos objetivo, color de maestría                                                                                                                                                                |
| «Devociones y lo demás»        | pares clave/valor: Devociones, Nombres, Atributos, Arma, Más adelante, Rotación (→ `notes` tipificadas)                                                                                                                                                                         |
| «Filtro de botín»              | 4 columnas (Calidad, Tipo, Daño, Personaje): descripción, reglas `marcar`/`desmarcar` con texto, avisos («lógica O, no Y»), consejo final                                                                                                                                       |
| «El Guía Espiritual»           | lista de NPCs: acto/orden, nombre, ubicación, detalle; coste y avisos (Sahdina muere en Ashes of Malmouth)                                                                                                                                                                      |
| «Ruta de devoción»             | pasos: etiqueta, constelación (EN + ES), texto, enlaces poder→habilidad (Reckless Tempest→Viento Demoníaco; Elemental Storm→Tótem de Tormenta; Hand of Ultos→Golpe Primigenio), requisitos de afinidad (Ascendente 5; Ultos 22+), advertencia de verificación, paso de limpieza |
| `footer`                       | descargo: nombres y barras del listado en español del juego; cantidades orientativas                                                                                                                                                                                            |
| Metadatos faltantes            | **autor, fuentes, fecha, versión del juego, video**: no existen en el HTML (ver Aclaraciones)                                                                                                                                                                                   |

**Observaciones editoriales a resolver durante la migración** (no bloquean): (a) «Viento Demoníaco → 1 punto, lo subes después» (prioridad 4) vs. «1 punto a barra 10» (orden de compra); (b) las traducciones al español de constelaciones están «sin confirmar», se mantienen los nombres EN como principales; (c) el texto usa primera persona («yo iría primero por Chamán») → conservar y atribuir al autor; (d) la guía usa nombres como Chamán/Demoledor y requisitos de barra que deben cotejarse con la versión del juego.

## 5. UI

### Tokens (estética Grim Dawn / Cairn; ver `plan.md` §Tokens)

Fondo abisal `soot`, paneles de pizarra y cuero oscuro `panel/panel-2`, acento A `storm` (oro/latón arcano de cabeceras y marcos de Grim Dawn), acento B `ember` (ascua/fuego ctónico), texto `bone` (pergamino envejecido) y `ash` (bronce/ceniza cálida), filetes metálicos `line` y tokens de enmarcado biselado (`--frame-*`, `--surface-sheen`, `--header-glow`). Tipografías: Oswald (display), Karla (cuerpo), Space Mono (datos). Los valores hex finales viven en `plan.md` y en CSS custom properties.

### Iconografía

Por defecto, glifos SVG locales (fallback) para maestrías, tipos de daño y estados. Un icono oficial sustituye al fallback solo si su entrada del manifiesto está `approved` (FR-16); el componente de icono siempre mantiene alternativa textual y mismas dimensiones (sin CLS).

### Estados (todos los componentes interactivos)

default, hover, `focus-visible`, active, disabled, loading, empty, error. Específicos: nodo de habilidad (`recomendado`, `meta`, `omitir`, `seleccionado/paso activo`, `bloqueado por barra`); constelación (`activa en paso`, `verificada`, `sin_verificar`); chip de filtro (`off/on`); tarjeta de tier (`con guía`/`próximamente`).

- **loading**: esqueleto en tier list al cambiar filtros con datos remotos futuros (en MVP los datos están en el HTML; loading aplica al facade de video).
- **empty**: sin resultados de filtro; sección sin video oculta.
- **error**: 404; fallo al cargar video; contenido inválido (solo en build, nunca en producción).

### Breakpoints

375 (móvil, 1 columna, árboles con scroll/zoom táctil o vista de lista alternativa), 768 (tablet, 2 columnas en tier list), 1280 (escritorio, TOC lateral sticky + contenido; árbol y detalle lado a lado). Sin scroll horizontal de página en ninguno.

### Accesibilidad (WCAG 2.2 AA)

- Contraste de texto ≥ 4.5:1 y UI ≥ 3:1 (verificar `ash` sobre `soot`/`panel`).
- Todos los SVG con `role="img"` + título/desc o, si son interactivos, nodos como elementos enfocables con `aria-label` y alternativa textual en lista (`<ol>`/`<ul>`) equivalente.
- Navegación por teclado: Tab entre secciones; flechas dentro del árbol; Enter/Espacio activa; Esc cierra detalle.
- Foco visible (≥ 2 px, contraste ≥ 3:1), no oscurecido por TOC sticky (2.4.11).
- Objetivos ≥ 24×24 (2.5.8); `prefers-reduced-motion` desactiva animaciones; enlace «Saltar al contenido».
- Color no es el único indicador (iconos/etiquetas de texto para Chamán/Demoledor, estados con forma/patrón).

## 6. Criterios de aceptación del MVP

- **AC-01** `/`, `/tier-list` y (en modo local con `INCLUDE_DRAFTS`) `/builds/chaman-demoledor-golpe-primigenio` devuelven HTML con su contenido principal y metadatos SEO sin ejecutar JS. En el build público la ruta de la guía migrada **no existe** mientras `rights_status=pending`.
- **AC-02** La página de build contiene el 100 % del contenido de la guía original (verificado por checklist de campos §4) con nombres ES/EN correctos.
- **AC-03** Los árboles de Chamán y Demoledor y la ruta de devoción se renderizan como SVG desde datos, con alternativa textual y operables por teclado.
- **AC-04** Tier list/catálogo: filtros combinables, URL compartible, estado vacío; contiene una ranura por cada combinación de maestrías del catálogo (cobertura 100 % verificada por prueba contra el catálogo de maestrías); toda entrada con `content_status`, procedencia y `rights_status`; ninguna entrada `placeholder` con tier o guía.
- **AC-05** Presupuestos de rendimiento de `plan.md` cumplidos en la verificación local y en CI de verificación (Lighthouse móvil: Performance ≥ 90, LCP, CLS, JS inicial). El despliegue permanece diferido; CI no publica artefactos como sitio.
- **AC-06** 0 violaciones críticas/serias de axe en las 3 rutas a 375/768/1280, automatizado localmente y en CI de verificación.
- **AC-07** Ninguna entrada/guía publicada sin autor, fuente, estado de revisión y `rights_status` aprobado; la validación lo impide (prueba con la guía migrada en `pending` → falla al marcarla `publicado`).
- **AC-09** El build público (sin `INCLUDE_DRAFTS`) no emite HTML, sitemap ni JSON-LD de contenido con derechos no aprobados.
- **AC-10** Ningún archivo de arte oficial en el repo sin entrada `approved` en el manifiesto; la validación del manifiesto y una prueba de la UI con activo `pending` confirman el uso del SVG fallback.
- **AC-08** Sin cuentas, comentarios, calculadora ni scraping en la implementación.
- **AC-11** (rev. 4) `pnpm verify` (lint, tipos, pruebas, validación de fixtures, build de **desarrollo** con `CONTENT_SOURCE=fixture`) funciona **sin** Docker y su artefacto queda marcado `source=fixture` (no es de release). Un build de release con `CONTENT_SOURCE=fixture` falla.
- **AC-12** (rev. 3) `docker compose up` levanta BD + API; `/health` responde 200 aunque la BD esté caída y `/ready` responde 200 solo con BD y migraciones OK (503 si no). La BD no es accesible desde el host sin un perfil explícito de depuración.
- **AC-13** (rev. 3) La API nunca devuelve filas `borrador`/`en_revision` ni con `rights_status` no aprobado; prueba de contrato idéntica a la de `FileContentRepository` (paridad entre adaptadores).
- **AC-14** (rev. 3) La imagen de la API corre como usuario no-root; ningún secreto/`.env` real en el repo ni en capas de la imagen (comprobado por prueba/escaneo).
- **AC-15** (rev. 4) Pruebas de integración contra PostgreSQL 17 real demuestran que la BD rechaza: publicar con `rights_status='pending'`, sin fuente/autor real/`reviewed_by`, y marcar `approved` un activo sin procedencia completa; y que `api_ro` no puede escribir ni leer tablas base.
- **AC-16** (rev. 4) Existe un build de release (`CONTENT_SOURCE=api`) que escribe `build-info.json` (fuente, migración aplicada, fecha) y **falla** si la fuente no es la API, la API no está `ready` o la migración no es la esperada. No existe ruta que produzca un build de release desde `content/`.
- **AC-17** (rev. 4) Tras el bootstrap, el seed/importación de fixtures se rechaza sobre esa BD; en `development`/`test` el seed es idempotente y la BD reconstruible (`down -v` + migrate + seed). Con el mismo contenido, el build `api` y el build `fixture` producen HTML/sitemap/JSON-LD equivalentes (prueba de equivalencia).
- **AC-18** (rev. 5) Secretos: (a) `check-secrets` y gitleaks fallan en pre-commit/CI ante un secreto sintético en código, Dockerfile, `package.json`, `content/` o `.env.example`, y pasan en el repo; (b) `.env.example` solo contiene nombres, valores seguros y campos secretos vacíos; (c) `infra/docker/.env` y `secrets/` están ignorados; (d) la API solo recibe la credencial `api_ro`, `migrate` solo `migrator`, y `docker compose config --no-interpolate` no muestra valores; (e) `dist/` del build público no contiene valores centinela de secretos; (f) el CI de PR corre sin secretos reales, con DAST solo contra `localhost`; (g) existen runbooks de exposición y rotación. Producción/almacén gestionado (T-087–T-090) fuera de este criterio hasta decidir hosting.
- **AC-19** (rev. 5, documental en el MVP) No existe en el repo código de ingesta, scraping, crawlers ni dependencias de parsing de sitios de terceros (`check-scope` lo verifica); FR-26 está únicamente documentado (plan §14, T-091–T-100 diferidas); ninguna fuente figura como habilitada sin entrada de permiso verificada.

- **AC-20** (rev. 6) Modelo/validación: una build adaptada con `rights_status` no aprobado, evidencia que no cubre adaptación, o sin cualquiera de los campos FR-28 es rechazada por Zod y (cuando exista BD) por CHECK/trigger; con derechos no confirmados solo se admite `entry_kind='enlace_externo'` sin campos de cuerpo.
- **AC-21** (rev. 6) UI/SEO: toda página de build adaptada muestra el bloque de atribución (FR-29) y JSON-LD con `isBasedOn`; un test de componente y uno de prerender fallan si falta. Una tarjeta _link-only_ no contiene texto/imagen derivados.
- **AC-22** (rev. 6) Documental: existen plantilla de solicitud de permiso, checklist de la puerta de publicación, runbook de retirada y procedimiento de revisión de cambios de fuente (`docs/content/`).
- **AC-23** (rev. 6) `check-scope` sigue fallando ante scrapers/crawlers; no hay importación masiva ni acceso automatizado al foro; ninguna fuente real figura `habilitada` sin permiso verificado.

- **AC-24** (rev. 7, documental en el MVP) No existe en el repo código de autenticación, cuentas, editor público ni comentarios; `check-scope` falla ante dependencias/rutas de auth, registro o edición pública; FR-34–FR-45 son únicamente diseño (plan §16, T-111–T-122 diferidas salvo las documentales T-111/T-112).
- **AC-25** (rev. 7, aplicable cuando se active la etapa) Pruebas demuestran: un autor no ve ni edita borradores ajenos; nadie publica sin revisión ni aprueba su propia guía; envío sin atestación o sin términos aceptados rechazado; adaptación sin evidencia de permiso rechazada o degradada a _link-only_; contenido no `publicado` ausente de vistas públicas; límites de tasa activos; cada transición queda en la auditoría.

- **AC-26** (rev. 8) `pnpm lint:md` termina en 0 sobre todo el Markdown rastreado y en ≠ 0 ante un `.md` de fixture con una infracción (p. ej. salto de nivel de encabezado, MD001); `pnpm lint:md:fix` aplica solo correcciones seguras y deja `pnpm lint:md` en 0 o con infracciones manuales listadas; `pnpm verify` y el CI de PR (T-064) fallan si `lint:md` falla; `node_modules`, `dist` y carpetas generadas/de sesión quedan excluidos.

## 7. Fuera de alcance (MVP)

**Rev. 7**: cuentas públicas, registro abierto, editor de guías público/autenticado, envío de guías por la comunidad, moderación y comentarios siguen fuera; solo se documenta la hoja de ruta (plan §16).
Cuentas públicas, comentarios, calculadora de build (reparto interactivo de puntos con reglas del juego), scraping masivo/automático, **ingesta automatizada de builds (FR-26, hoja de ruta futura: solo documentada)**, app de escritorio (Rust/Go), workers, **Redis, colas, proveedores de auth externos, almacenamiento de objetos y microservicios (rev. 3: sin requisito concreto)**, endpoints públicos de escritura, edición de contenido vía UI/CMS, múltiples idiomas publicados (solo es), motor de búsqueda global, notificaciones, monetización, uso de iconos/arte oficial **sin** entrada aprobada en el manifiesto (FR-16), importación o copia de GrimTools/Maxroll, del foro de Grim Dawn u otras guías/tier lists de terceros sin licencia/permiso registrado que cubra adaptación, **importación masiva o scraping del foro**, redacción de guías completas para todas las combinaciones (el MVP entrega el marco del catálogo, no el contenido), hosting, secretos de despliegue y CI/CD de despliegue (diferidos).

## 8. Aclaraciones y supuestos (resueltos sin bloquear)

- **A1** (rev. 2) Autor/crédito de la guía migrada: el HTML no lo indica. **Decisión `guide_rights=pending`**: no se asume autoría; `author` placeholder `por-confirmar`, `rights_status=pending`, `review_state=borrador`. Solo fixture local de migración hasta confirmar autoría y derechos de republicación.
- **A2** Versión del juego: se asume la vigente en el momento de la revisión (campo `game_version`, p. ej. «1.2.x»); se confirma al migrar.
- **A3** (rev. 2) Seed del catálogo: (i) todas las ranuras de combinación generadas del catálogo de maestrías como `placeholder` (sin tier, sin guía); (ii) la build migrada como entrada `borrador` con derechos `pending` (no pública); (iii) entradas adicionales solo si traen procedencia y derechos documentados (`link_only` o propias); prohibido sembrar builds/tiers «de memoria» o copiados. Un tier provisional sin fuente no se permite: queda «Sin clasificar». El número de maestrías/combinaciones se toma del catálogo y se verifica contra la versión del juego (confirmada 2026-11-09: diez maestrías, incluida Berserker, 45 pares; fuente primaria en research.md; rama 1.3.x/Fangs of Asterkarn, sin afirmar último parche).
- **A3b** El catálogo es un marco: la completitud del MVP se mide por cobertura de combinaciones, no por cantidad de guías.
- **A4** Tiers: S, A, B, C, D, ordenados; un tier por build (no por contenido) en el MVP; campo opcional futuro por contenido.
- **A5** «Interactivo» = resaltado de pasos en árboles, tooltips/paneles, progreso local, copiar filtro; no hay reparto de puntos con validación (eso es la futura calculadora).
- **A6** Posiciones de nodos en SVG son esquemáticas (layout editorial), no réplica del árbol real del juego.
- **A7** (rev. 2) `hosting=local_first`: sin proveedor, dominio, secretos ni CI de despliegue en esta fase; se verifica con servidor local y artefacto estático local. Portable a cualquier host estático/Node con URL base configurable.
- **A8** Video: ninguno en la guía original; el campo existe y la sección se oculta si está vacío.
- **A9** Idioma de la UI y contenido: es; URLs en español sin prefijo de locale.
- **A10** Analítica: ninguna en el MVP (sin banner de cookies); se evaluará después.
- **A11** (rev. 4) Backend confirmado: Fastify, Drizzle ORM, Node.js 22 LTS, PostgreSQL 17 en Docker. Sin hosting remoto.
- **A12** (rev. 4, reemplaza rev. 3) El sitio público de release depende de la API/BD en tiempo de **build** (prerender sigue siendo estático; 0 consultas en runtime público). `FileContentRepository` queda solo para dev/test/CI sin Docker.
- **A13** La BD es la fuente de verdad editorial; `content/` son fixtures/importación. B-7 quedó resuelta: la CLI local con rol `editor` debe estar implementada/verificada antes del bootstrap/cutover. Esa decisión no confirma derechos: la guía sigue `pending`/borrador (T-044).

## 9. Estado de confirmaciones (rev. 2)

Resueltas (ver §0): hosting local-first, política de arte (manifiesto + fallback), alcance de la tier list (catálogo completo con procedencia), derechos de la guía (`pending` = bloquea publicación).
Pendientes **no bloqueantes** (no frenan el desarrollo local): autor y derechos de la guía migrada (bloquean solo su publicación, T-044); permisos/licencias concretos para cualquier icono oficial (bloquean solo su aprobación en el manifiesto); lista vigente de maestrías para el catálogo (A3); decisión futura de hosting/secretos de despliegue.
Cerradas: B-1 Fastify, B-2 Drizzle, B-3 Node 22/PostgreSQL 17, B-4 BD = fuente de verdad, B-6 consumo API en release. **2026-11-09**: B-5 permite solo `http://localhost:4200` (sin wildcard ni `127.0.0.1:4200`); B-7 elige CLI local con rol `editor` y dominio. Los escaneos DAST/imagen bloquean desde severidad **MEDIA**. T-061/T-072 están activas, con sus dependencias técnicas; no quedan decisiones abiertas de esos cuatro puntos.

## 10. Adenda de cierre integral y recuperación SDD (2026-11-09)

El objetivo autorizado es completar y verificar todos los requisitos activos de esta especificación, incluidos backend/API, release desde PostgreSQL, UI, adaptaciones con fixtures sintéticos, documentación y controles de calidad. Un build fixture con la portada de andamiaje o el cierre de T-057 no constituyen el cierre integral. Las fases 0–7 pueden desarrollarse sin Docker; ello no dispensa AC-12–AC-18 ni la integración de la fase 8 al cerrar la spec.

Se mantienen las exclusiones y decisiones externas: T-044 conserva la guía migrada como borrador `pending`; T-110 no publica adaptaciones reales sin permiso. T-067/T-075 son opcionales. T-087–T-090, T-092–T-100 y T-114–T-122 siguen diferidas según sus condiciones; T-091 y T-111–T-113 conservan su parte documental/guarda activa. Hosting, scraping, cuentas y editor público no se activan por esta adenda. B-5/B-7 y umbrales quedan resueltos según §9; T-061/T-072 y la CLI editorial forman parte del cierre.

La vista local de la guía pendiente usa únicamente fixtures, `INCLUDE_DRAFTS` y `noindex`; puede emitir JSON-LD local para comprobar T-037. Ese HTML, sus datos y su JSON-LD jamás forman parte del build público/release ni de su sitemap. El release solo admite API/PostgreSQL, sin acceso público a borradores.

La recuperación de comandos, scripts, plantillas y skills oficiales de Spec Kit restaura la capacidad de seguir SDD; su procedencia y reproducción se registran en T-124. No se reescriben instrucciones oficiales para hacerlas pasar checks. Las skills oficiales generadas son material regenerable local y no se rastrean; los Markdown propios y las plantillas/scripts versionados siguen sujetos a los checks aplicables.

**Regularización retrospectiva, no planificación previa**: los cambios de logging de PostgreSQL en Compose y su documentación se implementaron antes de contar con planificación SDD para ese alcance. `blockers.md` conserva la desviación y evidencia previa; T-125 registra la revisión y comprobaciones pendientes antes de ampliar o cerrar ese trabajo. Se requiere diagnóstico local visible con SQLSTATE/metadatos de sesión y rotación de logs, sin texto SQL, parámetros ni secretos.

### Precisión de paridad local (2026-11-09)

Para cumplir §4 y AC-01/AC-07, conservar las 14 habilidades con ES/EN, el grupo
omitido como nota editorial y las seis filas de Guía Espiritual (cuatro NPC y dos
notas Coste/Aviso) que realmente existen en el HTML. Los objetivos máximos sin
cifra, niveles de constelación y referencias fuera del árbol no autorizan datos
inventados: se representan explícitamente como desconocidos/no verificados según
plan §17.4 y T-130. Esto no verifica los consejos de la fuente ni sus derechos.
