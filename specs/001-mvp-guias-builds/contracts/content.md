# Contrato de contenido — cierre de spec 001

El esquema canónico y las relaciones están en [data-model.md](../data-model.md) y spec §4. `packages/domain` valida el documento íntegro: no descarta secciones de guía, nombres ES/EN, fuentes, autor, estado, fechas, procedencia ni derechos. Los adaptadores devuelven tipos derivados del mismo esquema.

## Documento editorial y DTO públicos derivados

`BuildDocumentSchema`/`BuildDocument` representan el documento editorial completo para almacenamiento, fixtures locales y CLI; `BuildSchema` puede conservarse como alias compatible. Sus puertas de publicación requieren revisor, confirmación de derechos y demás metadatos editoriales. `PublicBuildSchema`/`PublicBuild` se derivan por selección explícita de campos Zod públicos del mismo contrato y reutilizan validadores comunes; igual para autor, fuentes y tier list. No se crean contratos públicos escritos a mano que puedan divergir del documento canónico.

La representación pública conserva contenido de guía completo, atribución del autor/fuente, `review_state`, `rights_status`, `content_status`, fechas públicas y licencias/URLs públicas cuando procedan. Valida publicado/derechos aprobados sin requerir identidades editoriales privadas. No contiene ni acepta `reviewed_by`, `rights_confirmed_by`, `rights_confirmed_on`, notas internas, `evidence_ref`, rutas de pruebas privadas, contactos privados ni evidencia cruda, tampoco dentro de fuentes/adaptaciones anidadas. El mapeador proyecta por lista permitida; el esquema público rechaza campos privados inesperados, en lugar de aceptar un documento privado y ocultar silenciosamente una fuga. No se rellenan firmantes falsos ni nulls para validar respuestas con el esquema editorial.

publicFilter opera sobre estados públicos seguros. Las vistas BD que selecciona api_ro ya imponen las puertas completas de publicación y, mediante T-127, deben incluir estados suficientes para la segunda defensa en API sin exponer los firmantes. Esta derivación no sustituye la validación editorial ni permite publicar un documento que no la pasó.

## Adaptadores y límites de serialización

`link_only` permite únicamente metadatos propios y enlace, conforme a data-model.
No autoriza emitir un DTO de guía con cuerpo completo: `PublicBuildSchema` lo
rechaza. Los enlaces se representan con las entradas `enlace_externo` de la tier
list. T-010/T-060/T-127 deben mantener esa separación al proyectar y consultar,
sin convertir una referencia externa en una guía republicada.

Para T-006, el documento de build anida `author` y `sources`, además de sus
referencias `author_slug`/`source_slugs`; se comprueba su coherencia. La forma
pública del autor selecciona `slug`, `display_name`, `bio` y `url`. La fuente
pública selecciona `slug`, `kind`, `title`, `url`, `author_name`, `license_note`
y `retrieved_on`; `permission_ref` y `notes` pertenecen al documento editorial.
`PublicBuildSchema` rechaza esos campos privados anidados, no los oculta mediante
strip. El DTO conserva las secciones de guía y metadatos públicos comunes; las
selecciones derivan de los esquemas canónicos, sin duplicar definiciones manuales.
Estos nombres concretan la serialización para implementar el contrato ya
especificado, no añaden una segunda representación de contenido de producción.

`ContentRepository`: `listBuilds`, `findBuild(slug)`, `getTierList(slug)`, `getAuthor(slug)`, `listSlugs`. Los resultados ausentes son null; entradas de listas y slugs tienen orden determinista. El contrato compartido prueba builds completos, catálogo, autores, referencias y exclusión de borradores/pending. El adaptador fixture permite borradores solo en modo local explícito; el adaptador API nunca los permite.

La API y el modo público de FileContentRepository devuelven DTO públicos; el modo fixture local de borradores devuelve documentos editoriales completos. Los tipos del puerto distinguen esos modos y comparten los campos públicos; el contrato compara la proyección pública entre fixture y API, sin exigir que API devuelva campos privados del fixture. Solo las pruebas locales de borrador comparan el documento editorial completo. El prerender público, TransferState y JSON-LD reciben exclusivamente el DTO público. T-006 prepara estos tipos y fixtures; implementar las lecturas/proyecciones de adaptadores corresponde a T-010/T-063/T-062, y las vistas SQL a T-127.

API GET: `/api/v1/builds`, `/api/v1/builds/:slug`, `/api/v1/tier-lists/:slug`, `/api/v1/authors/:slug`, `/api/v1/slugs`. Detalle inexistente/no público → 404; respuestas 200 validadas por dominio. La API usa exclusivamente vistas públicas con rol api_ro; sin tablas base, campos internos, evidencias privadas ni escritura. Máximo seis consultas por petición; sin consultas API en runtime del cliente prerenderizado.

`/health` 200 sin dependencias. `/ready` 200 solo con BD alcanzable y journal de migraciones compatible/completo; si no, 503 sin trazas. `build:release` requiere fuente API explícita y readiness correcta, nunca acepta borradores ni fallback a fixture. B-5 permite solo origen `http://localhost:4200`.

CLI local B-7: rol editor por secreto propio, valida dominio antes de transacción parametrizada y no cambia fixtures de producción. Publicación exige todos los controles de autor/fuentes/revisor/derechos; el comando no concede derechos por defecto. No HTTP admin ni autenticación pública. Bootstrap solo una vez después de verificar la CLI y bloquea reimportaciones fixture.

### Carga fixture T-010

El lector de archivos existe solo en la configuración servidor. Lee JSON de
`builds`, `tier-lists`, `authors` y `sources`; resuelve recursos separados por slug
y comprueba coherencia con los anidados. Colecciones ausentes equivalen a vacías;
JSON inválido, duplicados y referencias rotas fallan sin imprimir documentos.
Autores públicos requieren contenido visible y no pueden ser placeholder.
Entradas `build_propia` requieren una guía visible; las demás conservan el filtro
público de estados. El modo editorial conserva íntegros los documentos locales.
`BUILD_MODE=release` rechaza siempre el adaptador fixture, incluso sin borradores;
`INCLUDE_DRAFTS=true` solo se acepta con modo local y fuente fixture. La selección
API y su puerta integral se completan en T-062/T-074, sin fallback silencioso.

### Datos desconocidos de la transcripción

T-130 precisa null en highlights.points y constellations.tier_level como dato
numérico no indicado. Devotion bindings conserva una referencia de nodo existente
o una mención explícita {skill_node_slug: null, skill_name_es} con power_en y paso
sin_verificar. No se sustituye una referencia rota por una mención automáticamente.
El DTO público derivado preserva estas variantes y sus advertencias. Los grupos
omitidos y las filas informativas de NPC son notas generales con el texto original.
