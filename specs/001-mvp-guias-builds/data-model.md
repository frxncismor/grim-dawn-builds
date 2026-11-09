# Modelo de datos — 001-mvp-guias-builds

PostgreSQL como **destino portable**; en la fase `local_first` la verificación usa los archivos `content/` y `FileContentRepository`; las migraciones SQL se escriben y se prueban solo si hay Supabase local o PostgreSQL en Docker disponible (no bloquea la web). (Rev. 3: el backend propio usa PostgreSQL en Docker; ver «Backend y propiedad de datos» al final.) `uuid` PK con `gen_random_uuid()`; `created_at/updated_at timestamptz`. Slugs únicos en minúsculas ASCII. Todo texto de contenido: `text` (es). Acceso público: solo `SELECT` de filas `review_state='publicado'` con derechos aprobados (y sus hijas) — por RLS en Supabase, o por vistas públicas + rol `api_ro` en el backend propio; escritura solo con el rol del importador (script local).

## Enums

- `review_state`: `borrador | en_revision | publicado`
- `verification`: `verificado | sin_verificar`
- `tier`: ver abajo (rev. 2)
- `damage_type`: `fisico | fuego | frio | rayo | acido | vitalidad | caos | eter | elemental | sangrado | mascotas`
- `playstyle`: `melee | rango | mascotas | hibrido`
- `content_tag`: `campana | shattered_realm | crucible | jefes | farmeo`
- `node_status`: `recomendada | meta | omitir`
- `source_kind`: `original | comunidad | oficial | video | externa_enlace`
- `rights_status` (rev. 2): `pending | own_original | licensed | permission_granted | link_only`. Aprobados para publicar: `own_original | licensed | permission_granted | link_only` (este último solo publica metadatos propios + enlace). `pending` bloquea.
- `content_status` (rev. 2): `verificado | sin_verificar | placeholder`
- `asset_status`: `pending | approved | rejected`
- `tier` (rev. 2): `S | A | B | C | D | sin_clasificar` (`sin_clasificar` obligatorio para `placeholder`)

## Tablas

**authors** — `id, slug UNIQUE, display_name, bio, url, is_placeholder bool`
**sources** — `id, kind, title, url NULL, author_name, license_note, permission_ref NULL (enlace/ID a la prueba de permiso), retrieved_on date, notes`
**masteries** — `id, slug UNIQUE (chaman, demoledor…), name_es, name_en, accent_token (storm|ember|…), fallback_icon text (id de SVG local), asset_id FK NULL` _(catálogo; fuente de las combinaciones)_
**mastery_combinations** — `id, slug UNIQUE ('chaman-demoledor'), mastery_a_id FK, mastery_b_id FK NULL, CHECK(mastery_a_id < mastery_b_id)` _(generada mecánicamente: todos los pares; opcional maestría única; UNIQUE(a,b); cobertura probada)_
**assets** — `id, slug UNIQUE, file_path NULL, origin_url, rights_holder, license_or_permission, proof_ref, recorded_on date, status asset_status DEFAULT 'pending', fallback_svg, CHECK(status='approved' ⇒ origin_url, rights_holder, license_or_permission, proof_ref, file_path NOT NULL)` _(refleja `content/assets/manifest.json`)_
**skills** — `id, mastery_id FK, slug, name_es, name_en, bar_required int, parent_skill_id FK NULL, UNIQUE(mastery_id, slug)` _(catálogo del juego, reutilizable entre builds)_
**constellations** — `id, slug, name_en, name_es NULL, tier_level int (1-3), affinity_required jsonb NULL, affinity_granted jsonb NULL, layout jsonb (nodos/aristas esquemáticos)`

**builds** — `id, slug UNIQUE, locale='es', title_a_mastery_id FK, title_b_mastery_id FK NULL, eyebrow, subtitle, summary text (meta/OG), damage_types damage_type[], playstyle, content_tags content_tag[], game_version, author_id FK, review_state, rights_status DEFAULT 'pending', rights_notes text NULL, rights_confirmed_by NULL, rights_confirmed_on NULL, content_status DEFAULT 'sin_verificar', reviewed_by NULL, reviewed_at NULL, published_at NULL, video_url NULL, footer_disclaimer, hero_callout_title, hero_callout_body text[]`
**build_sources** — `build_id FK, source_id FK, role ('principal'|'referencia'), PK(build_id, source_id)`
**build_masteries** — `build_id FK, mastery_id FK, position int, role_text, PK(build_id, mastery_id)` _(p. ej. «Tu daño…», «Soporte…»)_
**build_skill_nodes** — `id, build_id FK, skill_id FK, status node_status, tag NULL ('Transmutador'), rationale text, max_points_hint int NULL, points_label NULL ('máximo','1 ahora, 11 después'), layout_x numeric, layout_y numeric, display_order int` _(capa de build sobre el catálogo; `layout_*` esquemático)_
**build_priorities** — `id, build_id, rank int NULL, group_label ('1 · Chamán'|'Devoción'|'Aún no'), headline, note, skill_node_ids uuid[]`
**build_purchase_steps** — `id, build_id, position, threshold_label ('barra Chamán → 10'), mastery_id NULL, title, body, highlights jsonb [{node_id, points}]`
**build_notes** — `id, build_id, kind ('devociones'|'nombres'|'atributos'|'arma'|'mas_adelante'|'rotacion'|'general'), label, headline, detail, position`
**build_devotion_steps** — `id, build_id, position, label ('Paso 3 · primer poder'), constellation_id FK NULL, title_override NULL, body, bindings jsonb [{power_en, skill_node_id}], accent (storm|ember), verification, kind ('ruta'|'verificacion'|'limpieza')`
**loot_filter_columns** — `id, build_id, position (1-4), name ('Calidad'|'Tipo'|'Daño'|'Personaje'), subtitle`
**loot_filter_rules** — `id, column_id FK, action ('marcar'|'desmarcar'|'aviso'), label, detail, position`
**build_guides_npcs** — `id, build_id, position, group_label ('Acto 1'|'Después'|'Coste'|'Aviso'), name NULL, location NULL, detail`
**build_sections_meta** — _(opcional)_ orden/visibilidad de secciones por build: `build_id, section_key, position, visible`
**tier_lists** — `id, slug ('principal'), title, game_version, review_state, author_id`
**tier_entries** — `id, tier_list_id FK, combination_id FK (siempre), build_id FK NULL, display_name (si no hay build), entry_kind ('placeholder'|'enlace_externo'|'build_propia'), tier, mastery_ids uuid[], damage_types[], playstyle, content_tags[], note, content_status, rights_status, review_state, external_url NULL, external_author NULL, source_id FK NULL, evaluated_on date NULL, position int` _(CHECKs: build_id NOT NULL OR display_name NOT NULL; `entry_kind='placeholder'` ⇒ tier='sin_clasificar', build_id NULL, external_url NULL, content_status='placeholder', source_id NULL permitido; `enlace_externo` ⇒ external_url, external_author, source_id NOT NULL, rights_status='link_only', sin campos de texto de guía; `tier<>'sin_clasificar'` ⇒ source_id y evaluated_on NOT NULL)_

## Índices y restricciones

- `builds(slug)`, `tier_entries(tier_list_id, tier, position)`, GIN en arrays de filtro (innecesarios con ≤ 100 filas pero baratos).
- CHECK de publicación: `review_state='publicado'` ⇒ `author_id` not placeholder, `published_at`, `reviewed_by`, ≥1 fila en `build_sources` **y `rights_status` ∈ {own_original, licensed, permission_granted, link_only} con `rights_confirmed_by/on` (trigger o validación en importador + prueba SQL)**. La guía migrada vive con `rights_status='pending'`, `review_state='borrador'`.
- RLS/exportación pública (rev. 4: vistas `v_public_*` + rol `api_ro`, sin Supabase): filas con `rights_status='pending'` nunca son visibles públicamente ni se emiten en el build de release.
- `tier_entries`: UNIQUE cobertura — cada `mastery_combinations.id` tiene ≥1 entrada (placeholder si no hay otra); prueba de cobertura.
- `parent_skill_id` misma maestría (CHECK por trigger).

## Contrato de contenido (fixtures en `content/`; rev. 4)

`content/builds/<slug>.json`, `content/tier-lists/principal.json` y `content/assets/manifest.json` son **fixtures** validados con Zod (`packages/domain`; hoy `src/app/core/content/schema.ts`) que reflejan estas tablas. `content/masteries.json` es la fuente de las combinaciones; `scripts/gen-catalog.ts` genera las ranuras placeholder (determinista). Los fixtures entran a la BD solo por `db:seed` (dev/test) o `db:bootstrap` (una vez, B-7); en modo `fixture` la UI los lee vía `FileContentRepository` (nunca en release). Tipos TS derivados de Zod (`z.infer`) son los que consume la UI; la UI **no** conoce nombres de columnas.

## Tipos de la UI (resumen)

`Build { slug, title, masteries[], summary, callout, priorities[], skillTrees[{mastery, role, nodes[{id, nameEs, nameEn, bar, parentId?, status, tag?, rationale, layout{x,y}}]}], purchaseSteps[], notes[], lootFilter[], spiritGuides[], devotion{steps[], constellations[]}, videoUrl?, author, sources[], reviewState, rightsStatus, contentStatus, gameVersion, updatedAt }`
`TierEntry { tier, entryKind, build?, displayName, masteries[], damageTypes[], playstyle, contentTags[], contentStatus, rightsStatus, reviewState, external?{url, author}, source? }`
`Asset { id, status, filePath?, originUrl, rightsHolder, licenseOrPermission, proofRef, fallbackSvg }` — resolutor `resolveIcon(id)` devuelve activo solo si `approved`, si no el SVG fallback.

## Guías comunitarias (rev. 7; FUTURO, plan §16, no MVP)

Modelo diferido (T-114+); no se crean tablas ahora. Reutiliza `authors`, `builds`, `sources`, `build_adaptations`, `source_rights_evidence`, `takedown_events`.
Enums: `submission_state`: `borrador | enviada | en_revision_editor | cambios_solicitados | aprobada | publicado | rechazada | retirada`; `contribution_type`: `original | adaptacion`; `user_role`: `autor | editor | moderador | admin`; `report_status`: `abierto | en_triaje | resuelto | desestimado`.
**contributors** — `id, author_id FK, identity_ref (proveedor+sub, D-1; NULL hasta decidir), role user_role, status (invitado|activo|en_cuarentena|suspendido), invited_by, verified_by NULL, verified_on NULL`
**build_versions** — `id, build_id FK, version int, content jsonb (esquema canónico validado), content_hash, created_by FK contributors, created_at, state submission_state, UNIQUE(build_id, version)`; inmutable tras `enviada`; `builds` apunta a `published_version_id`.
**contributor_attestations** — `id, build_version_id FK, contribution_type, terms_version, accepted_at, acceptance_fingerprint, statement_original bool, statement_no_third_party bool, statement_no_game_assets bool, adaptation_evidence_id FK NULL` — CHECK: `adaptacion` ⇒ `adaptation_evidence_id NOT NULL` y evidencia con `covers_adaptation`, vigente; `original` ⇒ `statement_original` y `statement_no_third_party`.
**review_decisions** — `id, build_version_id FK, reviewer_id FK, kind (contenido|derechos|moderacion), decision (aprobar|cambios|rechazar), notes, decided_at` — CHECK: `reviewer_id <> created_by` de la versión; `kind='derechos'` ≠ editor de la adaptación.
**content_reports** — `id, build_id FK, reporter_contact NULL, reason, status report_status, received_at, handled_by, outcome, takedown_event_id FK NULL`
**audit_log** — `id, occurred_at, actor_id, action, entity_type, entity_id, before_hash, after_hash, meta jsonb` — append-only (sin UPDATE/DELETE para todos los roles salvo migrador).
**rate_limit_policies / abuse_flags** — configuración y marcas de abuso (cuarentena, suspensión); sin datos personales innecesarios.
Publicación: `state='publicado'` ⇒ al menos una `review_decisions` de contenido y de derechos `aprobar` por revisores ≠ autor, atestación válida y `rights_status` aprobado. Vistas públicas: solo `published_version_id` y campos públicos (nunca atestaciones, evidencias, reportes ni auditoría). Roles de BD adicionales a definir con la etapa E2.

## Adaptaciones de terceros (rev. 6; plan §15, FR-27–FR-33)

Enums nuevos: `entry_kind` suma `build_adaptada`; `evidence_type`: `licencia_explicita | permiso_escrito`; `evidence_status`: `vigente | caducada | revocada`; `transformation_scope[]`: `estructura | traduccion | reescritura | datos_factuales`; `adaptation_state`: `borrador | en_revision | publicado | revision_pendiente | retirada`. `rights_status` se mantiene: adaptación exige `licensed | permission_granted`; `link_only` jamás tiene cuerpo.

**source_rights_evidence** — `id, source_id FK, evidence_type, evidence_ref (ID/ruta privada a la prueba), license_name NULL, license_url NULL, covers_adaptation bool, covers_translation bool, covers_images bool DEFAULT false, scope_notes, granted_by (autor/sitio titular), recorded_on, valid_until NULL, status evidence_status, verified_by, verified_on`
**build_adaptations** — `build_id PK/FK, source_id FK, evidence_id FK, source_url, original_title, original_author, original_site, retrieved_on date, adaptation_editor (≠ rights verifier), transformation_scope[], transformation_notes (qué se conservó/omitió), adaptation_version int, source_revision_ref NULL, last_reviewed_on, reviewed_by, change_log jsonb, attribution_text` — CHECK: `covers_adaptation=true`, evidencia `vigente` y `rights_status ∈ {licensed, permission_granted}` para `publicado`; `adaptation_editor <> evidence.verified_by`; `images` en alcance ⇒ `covers_images`.
**permission_requests** — `id, source_id FK, author_contact_ref, requested_on, scope_requested, status (enviada|concedida|denegada|limitada|sin_respuesta), response_ref NULL, responded_on NULL` — `sin_respuesta` ≠ permiso.
**takedown_events** — `id, build_id/tier_entry_id FK, requested_by, received_on, action (link_only|retirada_total|rechazada), executed_on, executed_by, notes`
**source_change_events** — `id, source_id FK, build_id FK NULL, observed_on, change_type (edicion|licencia|eliminacion|bloqueo|sin_cambios), fingerprint NULL (hash/fecha editada), reviewed_by NULL, outcome (sin_accion|revision_abierta|retirada)`
**tier_entries** (link-only): `entry_kind='enlace_externo'` ⇒ sin `note` derivada de la fuente ni `tier<>'sin_clasificar'` basado en la fuente; metadatos factuales con verificación independiente (`facts_verified_by/on`).
**Vistas públicas**: `v_public_*` exponen `build_adaptations` solo con `source_url, original_title/author/site, attribution_text, retrieved_on, evidence license` (nunca `evidence_ref`, notas internas ni capturas). Adaptación `retirada`/`revision_pendiente` con evidencia no vigente ⇒ no visible como adaptación.
Las tablas se materializan en T-108 (tras Fase 8); mientras tanto, equivalentes Zod en `content/` fixtures sintéticos.

## Backend y propiedad de datos (rev. 4)

- **Fuente de verdad**: PostgreSQL 17. El esquema se define en Drizzle (`apps/api/src/db/schema.ts`) y se migra con SQL versionado (`drizzle/`), incluida una migración personalizada con CHECK/triggers/vistas/roles. `content/*.json` = **fixtures** de pruebas/desarrollo y material de importación; nunca fuente de producción (plan §12.5).
- **Contrato**: Zod en `packages/domain` valida fixtures, API y UI; el test de paridad (T-058) compara enums, nulabilidad y CHECK de publicación con el esquema Drizzle. Los enums de este documento son la referencia común.
- **Tabla nueva `content_origin`** (fila única): `bootstrapped_at, payload_hash, migration_version`; su existencia bloquea seed/importación de fixtures. Columna `origin` ('fixture'|'bootstrap'|'editor') en tablas editoriales para trazabilidad (la puerta de reimportación depende de ella).
- **Activos** (`assets`): `status='approved'` ⇒ `origin_url, rights_holder, license_or_permission, proof_ref` NOT NULL; `file_path` NOT NULL ⇒ `status='approved'`; si no, solo `fallback_svg`. Se impone por CHECK en BD y por `resolveIcon`.
- **Roles**: `migrator` (DDL), `importer` (seed/bootstrap, local), `editor` (reservado a B-7), `api_ro` (SELECT únicamente sobre vistas `v_public_*` que ya aplican `publicado` + derechos aprobados; sin tablas base ni campos internos `rights_notes`, `rights_confirmed_by`, `reviewed_by`).
- **Credenciales de BD (rev. 5, plan §13.3)**: una credencial independiente por rol (`migrator`, `importer`, `editor` reservado, `api_ro`), más `POSTGRES_PASSWORD` solo para la inicialización del contenedor `db`. Las migraciones versionadas crean los roles `NOLOGIN` y **nunca** contienen contraseñas; un paso de aprovisionamiento asigna `LOGIN PASSWORD` desde archivos de secretos. Ningún secreto se almacena en tablas de contenido; no se añaden tablas para secretos.
- **Ingesta futura (plan §14, FR-26; rev. 5, no MVP)**: reutiliza `sources`, `rights_status`, `review_state`, `origin`. Cambios **diferidos** (T-092–T-094): `sources` + `source_class` (A–D), `permission_proof_ref`, `scope`, `expires_at`, `status` (`habilitada|suspendida|revocada`); `origin='import'`; tablas `import_batches` (fuente, hash, `source_revision`, estado, retención hasta) e `import_review_queue` (cuarentena, motivo); la captura cruda **no** se guarda en tablas públicas ni en el repo. La publicación sigue regida por las CHECK existentes. No se implementa en el MVP.
- **Retención**: en desarrollo, la BD es desechable (`down -v` → migrate → seed). Tras el bootstrap la BD pasa a ser dato editorial a respaldar (estrategia de respaldo local: decisión futura junto con B-7). Sin datos personales.
- **Datos que la API nunca devuelve**: filas `borrador`/`en_revision`, `rights_status` no aprobado, `assets` con `status≠approved` (solo `fallback_svg`), campos de auditoría interna.

## Mapeo semilla de la guía (extracto)

- Chamán: Golpe Primigenio(5) → Golpe Atronador(10, Transmutador), Torrente(15), Corriente de Tormenta(25); Viento Demoníaco(10) → Tempestad Furiosa(20); Tótem Wendigo(20); Pacto de Mogdrogen(5) → Pacto de Clamatormentas(50, meta).
- Demoledor: Tocado por las Llamas(5), Llama Vengativa(10), Granada Cegadora(1) → Escudo Explosivo(32, meta), Mina de Termita(32, meta), grupo omitido (Templar · Golpe de Fuego · Granada).
- Devoción: Crossroads/Eel (ya tienes) → Empty Throne → Lizard → Tempest → Scholar's Light → Rhowan's Crown → Ghoul·Behemoth → Kraken → Ultos; + verificación y limpieza (Quill/Owl).
