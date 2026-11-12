# Plan de implementación — 001-mvp-guias-builds

**Spec**: `spec.md` (rev. 8 + adenda de cierre) | **Datos**: `data-model.md` | **Constitución**: v1.8.0
**Stack (detectado, actualizado 2026-11-09)**: Angular 21 SSR/prerender en la raíz, pnpm 12.18.0 con workspaces `apps/*` y `packages/*`, TypeScript strict, scripts `.mts` con tsx, Vitest, Zod 4. `apps/api` usa Fastify/Drizzle/PostgreSQL 17; `packages/domain`, Docker y CI de verificación ya existen. La UI sigue en andamiaje; la migración a `apps/web` continúa opcional y separada.
**Decisiones rev. 2**: `guide_rights=pending`, `tierlist=all_builds`, `game_art=official_assets` (con puerta), `hosting=local_first` (ver spec §0 y plan §11). **Rev. 3**: `backend=docker_monorepo`. **Rev. 4**: Fastify + Drizzle + Node 22 LTS + PostgreSQL 17; **BD = fuente de verdad** (§12).

## 1. Arquitectura

- **App única Angular SSG** (hasta la migración de §12.3 vive en la raíz; después en `apps/web`) (standalone components, signals, `provideRouter` con `withComponentInputBinding`, `provideClientHydration(withEventReplay())`, `@angular/ssr` con `outputMode: 'static'` para prerender). T-133 entrega la portada como documento estático sin bootstrap cliente; catálogo/guías conservan hidratación y replay. No es otra app ni otra fuente de contenido.
- **Capa de contenido**: interfaz `ContentRepository` (`getBuild(slug)`, `listBuilds()`, `getTierList()`, `getAuthor(slug)`, `listSlugs()`). Adaptadores (rev. 4): `ApiContentRepository` (**fuente de producción/release**, lee la API Fastify sobre PostgreSQL) y `FileContentRepository` (lee fixtures `content/*.json`; **solo desarrollo, pruebas y CI sin Docker**, `CONTENT_SOURCE=fixture`). `SupabaseContentRepository` queda **descartado** (T-011 reemplazada). Selección por token DI/variable de build; un build de release rechaza `fixture` (§12.10).
- **Puerta de derechos en la capa de contenido**: el repositorio aplica `publicFilter` (excluye `rights_status` no aprobado y `review_state≠publicado`) salvo `INCLUDE_DRAFTS=true` (solo fixture local; banner «Borrador · no público», `noindex`, excluido de sitemap y de todo HTML/JSON-LD público). T-037 puede comprobar JSON-LD en ese artefacto local aislado; el release rechaza el modo de borradores. `listSlugs()` para `getPrerenderParams` pasa por el mismo filtro.
- **Puerta de activos**: `resolveIcon(id)` solo devuelve el activo oficial si `status='approved'` con procedencia completa; si no, el SVG fallback de `src/assets/icons/*.svg`. Fuente: tabla `assets` en PostgreSQL (la BD rechaza `approved` sin procedencia y `file_path` sin `approved`); en modo fixture, `content/assets/manifest.json`. `validate-content` y `check-assets` siguen validando fixtures y archivos de arte.
- **Catálogo**: `content/masteries.json` → `scripts/gen-catalog.ts` genera las ranuras `placeholder` por combinación (determinista, sin red). Prueba de cobertura.
- **Sin llamadas a API en runtime público**: los datos se incorporan al HTML prerenderizado en build (`TransferState`/resolvers); el cliente no consulta la API en el MVP. En build de release los datos vienen de la API (≤ 6 consultas SQL por petición de la API); en build `fixture` vienen de archivos.
- **Estructura**:

```text
src/app/core/{content,seo,i18n,tokens}
src/app/features/{home,tier-list,build,author,static-pages}
src/app/shared/{ui,svg/{skill-tree,devotion-map}}
src/styles/{tokens.css,base.css}
content/{builds,tier-lists,authors,sources,assets}/*.json  content/masteries.json
src/assets/icons/*.svg (fallbacks propios)
supabase/ (descartado en rev. 4; ver §12)
scripts/{import-content.ts,validate-content.ts,gen-sitemap.ts,gen-catalog.ts,check-assets.ts}
e2e/ , scripts/verify-local (npm run verify); .github/workflows/ diferido
```

## 2. Rutas

| Ruta                          | Estrategia                                                              | Notas                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                           | SSG                                                                     | Hero, build destacada **si existe una publicada** (si no, CTA al catálogo), CTA tier list, criterios editoriales                                               |
| `/tier-list`                  | SSG (+ filtros en cliente)                                              | Catálogo completo por combinación; canonical siempre a `/tier-list` (los `?filtros` llevan `noindex,follow` o canonical base)                                  |
| `/builds/:slug`               | SSG (`getPrerenderParams` desde `listSlugs()` ya filtrado por derechos) | Anclas: `#resumen #prioridades #habilidades #orden #notas #filtro-de-botin #guia-espiritual #devociones #video #fuentes`. Borradores solo con `INCLUDE_DRAFTS` |
| `/autores/:slug`              | SSG                                                                     | Lista de builds del autor                                                                                                                                      |
| `/acerca`                     | SSG                                                                     | Criterios editoriales, revisión, aviso de no afiliación                                                                                                        |
| `/legal`                      | SSG                                                                     | Aviso legal/derechos                                                                                                                                           |
| `/404` (`**`)                 | SSG, status 404                                                         | Enlaces a home/tier list                                                                                                                                       |
| `/sitemap.xml`, `/robots.txt` | generados en build (`scripts/gen-sitemap.ts`, en `public/`)             | Solo `publicado`                                                                                                                                               |

Redirecciones/rutas futuras reservadas (no implementar): `/cuenta`, `/comunidad`, `/calculadora`.

## 3. Estrategia SSR/SSG

- **Prerender total** en build: sin servidor Node en producción (host estático). Si el host elegido permite SSR, el mismo código sirve sin cambios (`outputMode` cambiable).
- **Frescura**: en local-first, publicar = cambiar el estado en la BD local (vía B-7) + `build:release` local contra la API. Antes del cutover solo existe el build `fixture` de desarrollo. El webhook/redeploy y el deploy en `main` quedan diferidos (§11).
- **Hidratación**: `withEventReplay()`; componentes pesados e interactivos (árbol SVG, mapa de devociones, facade de video) con `@defer (on viewport)` + placeholder SSR estático (SVG del estado base ya renderizado en servidor; la hidratación solo añade eventos). Importante: el SVG base se renderiza en servidor → válido sin JS.
- **Tier list**: lista completa renderizada en HTML; filtros ocultan/ordenan en cliente; filtro inicial leído de `?q=`; sin pantalla en blanco.
- **SEO**: servicio `SeoService` fija title/meta/canonical/OG/Twitter/JSON-LD por ruta desde datos; imagen OG estática por build generada en build (SVG→PNG con script, o imagen fija inicial).
- **Navegador-solo** (`isPlatformBrowser`): `localStorage` de progreso, copiar al portapapeles, facade de video.

## 4. Renderizador SVG (requisitos)

**Compartido** (`shared/svg`): componente puro `<gd-graph>` = nodos + aristas + capas de estado; entradas inmutables (`nodes`, `edges`, `activeIds`, `layout`), salida (`nodeSelect`). Sin librerías de gráficos (SVG nativo + Angular templates, ≤ 8 kB gz propio). `viewBox` responsivo, sin dimensiones fijas en px.

1. Render determinista desde datos (mismo input → mismo SVG; snapshot-testeable) y **funciona en SSR**.
2. Nodos: forma por estado (relleno = recomendada, borde punteado = meta, tachado/atenuado = omitir) + etiqueta textual; color de acento por maestría vía token.
3. Aristas padre→hijo; las hijas de nodos con `bar_required` mayor se dibujan con la insignia «barra N».
4. Resaltado por paso activo (`activeIds`) con transición ≤ 200 ms, desactivada con `prefers-reduced-motion`.
5. Teclado: cada nodo es `<g role="button" tabindex>`; flechas mueven foco al vecino lógico (padre/hijo/hermano, orden por `display_order`); Enter/Espacio selecciona; Esc deselecciona; foco visible ≥ 2 px.
6. Panel de detalle (HTML, no SVG) con nombre ES/EN, barra, etiqueta, justificación; `aria-live="polite"`.
7. Alternativa textual: `<ol>` oculto visualmente pero accesible (o visible en móvil como «Vista de lista») con la misma información; `<title>`/`<desc>` por SVG.
8. Móvil 375: viewBox con `layout` vertical (el layout provee `x,y` para `compact`/`wide`; si falta, el renderizador calcula un árbol por niveles); objetivo táctil ≥ 24 px efectivos tras escalado (validar en test).
9. **Devociones** (`devotion-map`): constelaciones como nodos agrupados con aristas de dependencia de afinidad; pasos de la ruta (1..N) enumerados; resalta constelación activa + enlaces poder→habilidad con flecha etiquetada; insignia `sin_verificar`; layout esquemático (A6). Panel lateral con afinidad requerida/otorgada.
10. Iconografía: glifos geométricos propios (círculo/rombo/hex) y SVG fallback por maestría/daño; arte oficial solo vía manifiesto `approved` (FR-16, Constitución VII). El componente `<gd-icon>` reserva dimensiones fijas para evitar CLS al cambiar de fallback a activo.
11. Rendimiento: ≤ 120 nodos por SVG, sin filtros SVG costosos (blur) ni animación continua; render ≤ 16 ms por actualización de paso (prueba de humo).

## 5. Flujo editorial (rev. 4: fixtures hoy, BD como fuente de verdad)

> Rev. 4: los pasos 1–2 describen el flujo de **fixtures** (desarrollo/pruebas y material de bootstrap). La titularidad editorial de producción es la BD (§12.5); la vía de escritura tras el cutover es B-7. Los pasos 3, 5–8 (estados, derechos, procedencia, sin scraping) rigen igual y la BD los impone.

1. Editor crea/edita `content/builds/<slug>.json` (+ `authors`, `sources`). Estado inicial `borrador`.
2. `npm run content:validate` (Zod + reglas: referencias existentes, ciclos en `parent`, bar ≥ 0, ≥1 fuente, nombres ES/EN, enlaces válidos).
3. PR/revisión local = revisión; `en_revision` → `publicado` exige `reviewed_by`, `published_at` y `rights_status` aprobado con `rights_confirmed_by/on`.
4. Local: `pnpm verify` = validate → build/prerender (público y fixture local con `INCLUDE_DRAFTS`) → tests → e2e → axe → Lighthouse. CI de verificación reproduce las puertas; despliegue diferido (§11). Supabase descartado.
5. Datos dudosos: `content_status: sin_verificar` (visible). Atribución obligatoria; fuente `original` solo con `rights_status=own_original`.
6. Sin scraping: el importador y el validador solo leen `content/`; no hay fetch de terceros. Entradas de catálogo de terceros = solo enlace + atribución + metadatos factuales propios (spec FR-15).
7. Política de listado inicial: (1) generar ranuras placeholder por combinación; (2) añadir entradas `enlace_externo` o `build_propia` una a una, cada una con source/rights/review; (3) los tiers solo con criterio editorial propio documentado o permiso registrado, si no `sin_clasificar`.
8. Manifiesto de activos: alta con `status: pending` → el editor registra origen exacto, titular, licencia/permiso y prueba → revisión → `approved`. Hasta entonces, fallback SVG.

## 6. Presupuestos de rendimiento (verificación local y CI bloqueantes)

| Métrica         | Presupuesto (móvil, 4G lento simulado)                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LCP             | ≤ 2.0 s (p. objetivo en Lighthouse CI)                                                                                                                  |
| CLS             | ≤ 0.05                                                                                                                                                  |
| INP/TBT         | INP ≤ 200 ms; TBT ≤ 150 ms                                                                                                                              |
| JS inicial (gz) | `/` ≤ 90 kB; `/tier-list` ≤ 110 kB; `/builds/:slug` ≤ 150 kB (árbol/devoción diferidos aparte ≤ 40 kB)                                                  |
| CSS crítico     | ≤ 20 kB gz                                                                                                                                              |
| HTML por página | ≤ 120 kB sin comprimir                                                                                                                                  |
| Fuentes         | Autoalojadas WOFF2 subconjunto latin+latin-ext, máx. 3 familias/5 archivos, `font-display: swap`, `preload` de la principal; **sustituye Google Fonts** |
| Queries         | 0 en runtime público; ≤ 6 por página en build                                                                                                           |
| Lighthouse      | Perf ≥ 90, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 95                                                                                                     |

Presupuestos en `angular.json` (`budgets`) + `lighthouserc.json`; los checks gzip/HTML y Lighthouse se ejecutan localmente y en CI de PR (T-003/T-042/T-126). axe también corre en CI (T-041/T-126), conforme a Constitución IV/IX. No es CI de despliegue. Dependencias nuevas permitidas (justificadas): `zod` (validación; alternativa descartada: validación manual por tamaño del esquema y mantenimiento; solo en scripts/build, **no** en el bundle cliente salvo tipos), `@angular/ssr`. Dev: Vitest, Playwright (e2e), `@axe-core/playwright` (auditoría automatizada de accesibilidad) y Lighthouse CI (medir los presupuestos; una comprobación de bytes no mide LCP/CLS). Supabase está descartado.

## 7. Tokens de diseño (estética Grim Dawn / Cairn, actualizados en T-135)

```text
--color-soot:#0c0a08  --color-panel:#15110d  --color-panel-2:#1e1812
--color-storm:#d8b15a --color-storm-dim:#4c3b1a
--color-ember:#e07845 --color-ember-dim:#592915
--color-bone:#eadfca  --color-ash:#a3947a  --color-line:#382c1e
--frame-border:1px solid var(--color-line)
--frame-bevel:inset 0 0 0 1px var(--color-storm-dim), inset 0 1px 0 rgba(234,223,202,0.08)
--surface-sheen:linear-gradient(180deg, rgba(216,177,90,0.07) 0%, rgba(21,17,13,0) 100%)
--header-glow:radial-gradient(circle at 50% 0%, rgba(216,177,90,0.14), transparent 70%)
--font-display:Oswald --font-body:Karla --font-mono:"Space Mono"
--space-1..8: 4,8,12,16,24,32,48,64 px   --radius-0:0 (estética angular biselada)
--focus-ring:2px solid var(--color-storm) offset 2px
--bp-sm:375 --bp-md:768 --bp-lg:1280
```

Verificación de contraste obligatoria (`pnpm check:contrast`): las cuatro tintas (`bone`, `ash`, `storm`, `ember`) sobre las tres superficies (`soot`, `panel`, `panel-2`) superan 4.5:1 sin redondear (mínimo `ash` #a3947a sobre `panel-2` #1e1812 > 5.2:1; ver §17.38). El texto de 9.5–11 px de la guía original sube a ≥ 12 px.

## 8. Estrategia de pruebas

- **Unitarias** (Vitest/Jasmine): esquemas Zod (casos válidos/ inválidos), reglas de publicación, filtro de tier list (función pura AND/OR), layout por niveles, mapeo de seed → tipos, SeoService.
- **Componente**: `skill-tree` y `devotion-map` (snapshot SVG, estados, teclado, `aria`), `tier-filter`, `purchase-stepper`, `loot-filter`.
- **Integración/contenido**: `validate-content` sobre `content/` en CI; paridad de migración: test que verifica que cada nodo/paso/fila del HTML original (lista fixture extraída) existe en el JSON (checklist §4 del spec).
- **SQL/RLS**: prueba con rol `anon` (no ve `borrador`; no escribe).
- **E2E (Playwright)**: US1–US2–US3 en 375/768/1280; filtros por URL; ancla; teclado en árbol; HTML sin JS (`javaScriptEnabled:false`) contiene título, h1, secciones y JSON-LD.
- **A11y**: axe en las 3 rutas × 3 viewports; revisión manual de teclado y lector de pantalla (NVDA) una vez.
- **Rendimiento**: Lighthouse CI con presupuestos; `ng build` budgets.
- **SEO**: test de `sitemap.xml`, canonical, meta únicos.
- **Derechos/activos/catálogo (rev. 2)**: pruebas unitarias de `publicFilter` (pending nunca sale), de la regla `publicado ⇒ rights aprobado`, de `resolveIcon` (pending→fallback, approved→activo, aprobado incompleto→error de validación), de cobertura de combinaciones y de CHECKs de `tier_entries` (placeholder sin tier/guía). E2E: build público no contiene la ruta de la guía migrada ni su JSON-LD.
- Umbral: lógica de dominio ≥ 85 % cobertura; pruebas antes del código en tareas de dominio/esquema/filtros.

## 9. Riesgos

| Riesgo                                     | Mitigación                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Datos de devoción sin verificar            | `sin_verificar` visible, aviso, tarea de revisión editorial                                                                 |
| Layout esquemático impreciso               | Declarado (A6); validación visual                                                                                           |
| Derechos de arte/guía                      | Gate `rights_status` + manifiesto de activos con fallback SVG; sin arte oficial hasta `approved`; guía migrada en `pending` |
| Catálogo percibido como copia/scraping     | FR-15: solo ranuras, enlaces con atribución y metadatos factuales; sin texto/tiers ajenos sin permiso                       |
| Catálogo vacío de valor (todo placeholder) | Declarado: el MVP entrega el marco; mide cobertura, no guías; insignias claras                                              |
| Cambio de lista de maestrías del juego     | `content/masteries.json` versionado con `game_version`; combinaciones generadas, no escritas a mano                         |
| Dependencia de Supabase en build           | `FileContentRepository` es el adaptador por defecto; Supabase portable/diferido                                             |
| Presupuesto JS con Angular + hidratación   | `@defer`, rutas lazy, medición temprana en T-012                                                                            |
| Tier seed no verificada                    | Prohibida: sin fuente → `sin_clasificar`                                                                                    |

## 10. Fuera de alcance

Ver spec §7. Se reservan las abstracciones (repositorio, esquema, i18n) pero no se implementa auth, comentarios, calculadora, scraping ni workers Go/Rust.

## 11. Local-first y portabilidad (decisión `hosting=local_first`)

- **Ahora**: `ng serve`/`ng build` locales, `docker compose` local (PostgreSQL 17 + API Fastify), Playwright/axe/Lighthouse contra `http://localhost`, sin secretos con claves ni proveedor remoto. Sin Docker, `pnpm verify` usa fixtures (marcado `source=fixture`).
- **Diferido (no implementar)**: proveedor de hosting, dominio, BD remota, secretos de despliegue, workflows de CI/**deploy**. (Los workflows de **verificación** en PR son admisibles, §12.8.) **Decisión cerrada el 2026-11-11 (S11, §17.58): MVP local; el hosting queda fuera del MVP por decisión del usuario.**
- **Portabilidad preservada**: salida estática independiente del host; `BASE_URL` configurable; repositorio de contenido tras interfaz; PostgreSQL estándar (sin APIs de proveedor); nada en el código asume un dominio.
- **Reglas**: ningún secreto en el repositorio; `.env.example` solo con nombres de variables y valores por defecto seguros no secretos (rev. 5, ver §13.2).

## 12. Backend en Docker y monorepo pnpm (rev. 3)

### 12.1 Alcance y principios

Backend = **una** API **Fastify** (Node.js 22 LTS) + **una** PostgreSQL 17 con **Drizzle ORM**, orquestadas con Docker Compose. Sin Redis, colas, auth externa, almacenamiento de objetos ni microservicios. **PostgreSQL es la fuente de verdad** (Constitución VI/XI): las puertas de derechos/publicación/activos se imponen en la BD y la API; `packages/domain` replica las reglas puras como defensa doble y para validar fixtures. La web **no** lee BD directamente; el build de release lee la API.

### 12.2 Layout objetivo

```text
apps/web/            Angular (hoy en la raíz: src/, angular.json, tsconfig*.json, public/)
apps/api/            Fastify + Drizzle + Dockerfile
  src/db/schema.ts   esquema Drizzle (pgEnum, tablas, índices)
  drizzle/           migraciones SQL versionadas: generadas por drizzle-kit + personalizadas (CHECK, triggers, vistas v_public_*, roles/GRANT)
  src/db/{migrate,seed}.mts   migrador one-shot y seed (guardado por APP_ENV)
packages/domain/     Zod + tipos + reglas puras (publicFilter, rights, assets, tier checks), sin Angular/Fastify/Drizzle/E-S
infra/docker/        compose.yaml, compose.debug.yaml, .env.example
content/             FIXTURES de pruebas/desarrollo y material de importación (no fuente de producción; renombrable a fixtures/content, T-075 opcional)
scripts/             validate-content, check-assets, gen-*, verify-local, check-release (importan de @gd/domain)
pnpm-workspace.yaml  packages: [apps/*, packages/*]  (conservar allowBuilds)
```

Nombres de paquete propuestos (renombrables): `@gd/web`, `@gd/api`, `@gd/domain`. Dependencias nuevas justificadas (Constitución IV): `fastify`, `drizzle-orm`, `drizzle-kit` (dev), driver `pg` (o `postgres`) — solo en `apps/api`; **no** se añade `drizzle-zod` (la paridad se prueba, T-058).

### 12.3 Estrategia de migración (sin movimiento disruptivo)

Cada paso es un PR independiente, verde con `pnpm verify` antes de fusionar (GitFlow, rama de feature → PR):

1. **Fase A — aditiva (sin mover la web)**: declarar `packages: ['packages/*', 'apps/api']` en `pnpm-workspace.yaml` y crear `packages/domain`. La raíz sigue siendo el paquete de la web y **sigue funcionando**. Se extrae `schema.ts` y reglas puras a `@gd/domain` (`workspace:*`); la web importa de ahí con un alias/ruta; no se cambia `angular.json`.
2. **Fase B — backend aditivo**: `apps/api` e `infra/docker` se crean sin tocar la web ni `content/`.
3. **Fase C — mover la web (un único PR dedicado)**: `git mv` de `src/`, `public/`, `angular.json`, `tsconfig*.json`, config de eslint y `dist` → `apps/web`; ajustar rutas relativas a `content/` y `scripts/`; la raíz pasa a ser el «paquete raíz» con scripts delegados (`pnpm -r`/`--filter`). Aceptación: build prerender idéntico (mismos HTML/sitemap por hash o diff) y `pnpm verify` verde. Puede **diferirse** indefinidamente sin bloquear las fases A, B ni la integración de la API (ver riesgo R-M1).
4. Reversible: cada PR se puede revertir sin dejar el repo a medias.

### 12.4 Fronteras

| Capa                  | Responsabilidad                                                                                                   | Prohibido                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | UI, SSR/SSG, SEO, accesibilidad; consume solo `ContentRepository`                                                 | Hablar con BD; conocer columnas SQL; llamar a la API fuera del adaptador `ApiContentRepository`                   |
| `apps/api`            | HTTP (rutas de solo lectura), validación con `@gd/domain`, acceso a BD con Drizzle, `/health` `/ready`            | Reglas de negocio divergentes de `@gd/domain`; escritura pública; servir contenido no publicable; SQL concatenado |
| `packages/domain`     | Esquemas Zod, tipos, reglas puras (publicación, derechos, activos, tier checks, filtros)                          | Dependencias de Angular, Fastify, Drizzle/drivers de BD, E/S                                                      |
| Persistencia          | Esquema Drizzle + migraciones SQL versionadas, CHECK/triggers/vistas/roles; rol de BD de solo lectura para la API | Lógica de negocio en triggers más allá de las puertas de publicación/derechos/activos                             |
| `content/` (fixtures) | Datos de pruebas, desarrollo y material de importación                                                            | Ser fuente de producción; ser modificado por la API; importarse sobre una BD ya «bootstrapped»                    |

Dependencias permitidas: web→domain; api→domain; scripts→domain. Nunca web→api (en código; solo vía HTTP en el adaptador) ni api→web. Regla verificable con una comprobación de importaciones (T-052).

### 12.5 Propiedad de datos y ciclo de vida (rev. 4)

- **Fuente de verdad de producción: PostgreSQL**. `content/*.json` = fixtures. Nunca hay sincronización bidireccional ni lectura de producción desde archivos.
- **Modos de fuente** (`CONTENT_SOURCE`): `fixture` (dev/test/CI sin Docker; artefacto marcado `source=fixture`, nunca release) y `api` (único para release).
- **Ciclo de vida de la BD**:
  1. `db:migrate` — aplica migraciones Drizzle (rol `migrator`) antes de arrancar la API; tabla de control de Drizzle (`__drizzle_migrations`); `/ready` compara la última migración esperada con la aplicada.
  2. `db:seed` — carga fixtures validados con `@gd/domain`; **solo `APP_ENV=development|test`**; idempotente (upsert por slug); rechaza ejecutarse si existe la marca de bootstrap. BD desechable (`docker compose down -v` → migrate → seed).
  3. `db:bootstrap` (una vez, T-072 activa) — carga inicial en BD vacía y fila única `content_origin` (`bootstrapped_at`, hash, migración); desde entonces seed/import fixture rechazado por script y BD; `importer` no altera filas `origin='bootstrap'`. Requiere CLI editorial T-129 verificada antes del cutover.
  4. Escrituras editoriales posteriores: **CLI local con rol `editor` validando con `@gd/domain`**, decisión B-7 confirmada 2026-11-09. Transacción, consultas parametrizadas, credencial por archivo, sin DDL ni administración de roles; no expone endpoints, cuentas ni auth. No confirma derechos automáticamente ni modifica fixtures como fuente de producción.
- **Puertas en BD (migración personalizada)**: CHECK/trigger de publicación (`publicado` ⇒ autor no placeholder, `published_at`, `reviewed_by`, ≥1 fuente, `rights_status` aprobado con `rights_confirmed_by/on`); CHECK de `tier_entries` (data-model); activos: `approved` ⇒ `origin_url`, `rights_holder`, `license_or_permission`, `proof_ref` NOT NULL y `file_path` NOT NULL ⇒ `approved`; vistas `v_public_*` (solo `publicado` + derechos aprobados + `assets` aprobados; campos internos excluidos); `GRANT` solo SELECT de vistas a `api_ro`.
- **Esquema**: Drizzle (`schema.ts`) define tablas; Zod (`@gd/domain`) define el contrato; test de paridad (T-058) compara enums/nulabilidad/CHECK de publicación y falla ante deriva.
- **Datos de usuario**: ninguno.

### 12.5b Implicaciones para generado/estático

- El prerender sigue siendo estático. El build de release (`pnpm build:release`) exige `CONTENT_SOURCE=api`, API `ready` y migración esperada; escribe `dist/build-info.json` (`source`, `migration`, `builtAt`, `contentHash`) y `check-release` lo valida. Sin API → falla explícito (sin degradación a fixtures).
- Artefactos generados (`sitemap.xml`, `robots.txt`, catálogo placeholder, OG) se derivan de la fuente activa; los derivados de fixtures no se versionan como producción.
- `gen-catalog.ts` y los placeholders: en BD, el catálogo de combinaciones se siembra por seed/bootstrap con la misma generación determinista.
- Modo local `INCLUDE_DRAFTS` (borradores con banner/`noindex`) solo en `fixture` o con el rol de desarrollo contra BD local; nunca en release.

### 12.5c Migración desde el adaptador de archivos (sin doble fuente)

Fases (cada una un PR): **M0** hoy: solo `fixture`. **M1** BD + API en dev, seed de fixtures; web aún en `fixture`. **M2** `ApiContentRepository` + contrato común + equivalencia fixture↔api (misma data sembrada). **M3** puerta de release (`build:release` solo `api`). **M4** (tras B-7) bootstrap/cutover; `content/` queda como fixtures de test (o se mueve a `fixtures/`). Antes de M4 no existe «producción» real (local-first, guía `pending`), por lo que no hay dos fuentes de producción en ningún momento; desde M3 ningún camino de release lee archivos.

### 12.6 Contrato de API pública de solo lectura (`/api/v1`)

`GET /health` (200, sin tocar BD) · `GET /ready` (200 si BD alcanzable y última migración aplicada = esperada; si no 503) · `GET /api/v1/builds` · `/builds/:slug` · `/tier-lists/:slug` · `/authors/:slug` · `/slugs`. Mapean 1:1 a `ContentRepository`. Respuestas validadas con `@gd/domain` antes de salir; `publicFilter` aplicado en consulta **y** en dominio (defensa doble). Errores sin trazas internas. Contrato descrito como esquemas del dominio (no se añade OpenAPI salvo decisión posterior).

### 12.7 Docker Compose local, salud y migraciones

- `infra/docker/compose.yaml`: servicios `db` (**`postgres:17.x`** con versión fijada, **sin `ports:`**, volumen nombrado, `healthcheck` con `pg_isready`), `migrate` (one-shot, `depends_on: db healthy`, rol `migrator`) y `api` (`depends_on: migrate: service_completed_successfully`, `healthcheck` sobre `/health`, `ports` solo a `127.0.0.1`). Seed por comando explícito (`docker compose run --rm api-tools db:seed`/script de dev), nunca automático. `env_file` → `infra/docker/.env` (ignorado; `.env.example` solo nombres y valores seguros no secretos; las contraseñas de BD las genera el desarrollador localmente, §13.2). Sin `latest`. Hasta añadir un cuarto servicio se mantiene «una app + una BD» más el job one-shot `migrate` (check-scope lo permite explícitamente).
- Depuración de BD: override `compose.debug.yaml`/perfil `debug` que publica el puerto solo en `127.0.0.1`; nunca por defecto.
- Imagen API: multi-etapa sobre **`node:22-<variante-slim>`** con versión fijada, `pnpm deploy --filter @gd/api --prod`, etapa final mínima, `USER` no-root (UID fijo), `read_only` + tmpfs cuando sea viable, sin herramientas de compilación, `.dockerignore` que excluye `.env*`, `node_modules`, `.git`, `dist`, `content/`. `engines.node` = `>=22 <23` y `.nvmrc`.
- **Migraciones (Drizzle)**: `drizzle-kit generate` produce SQL desde `schema.ts`; `drizzle-kit generate --custom` para CHECK, triggers, vistas, roles y `GRANT`. Se commitean `drizzle/*.sql` + `meta/`. Se aplican con el migrador programático de `drizzle-orm` en el job `migrate` (no por el proceso de la API). Hacia delante solamente; `push` de drizzle-kit **prohibido** salvo BD desechable local. Un check de CI falla si `drizzle-kit generate` produce un diff (esquema y migraciones desalineados).
- **Roles de BD**: `migrator` (DDL), `importer` (seed/bootstrap, solo local, fuera del runtime), `editor` (reservado a B-7), `api_ro` (SELECT solo sobre `v_public_*`). La API arranca únicamente con `api_ro`. Supabase/RLS ya no aplican (T-007/T-008 reemplazadas).

### 12.8 Seguridad

- Secretos únicamente en `infra/docker/.env` local ignorado (o archivos de secretos ignorados); detalle por capas en §13; `.gitignore` incluye `.env`, `.env.*` (excepto `.env.example`); prueba/escaneo que falla si hay `.env` rastreado o patrones de secretos (T-066a, T-066b, T-083).
- Sin secretos en `ARG`/capas/logs; la config se lee por variables en runtime y se valida al arrancar con Zod (fallo rápido, sin imprimir valores).
- Contenedor: no-root, `cap_drop: [ALL]`, `no-new-privileges`, sin `privileged`, sin montar el socket de Docker, límites de memoria/CPU razonables en Compose.
- HTTP: CORS con lista explícita de orígenes (B-5), límites de tamaño/rate-limit básico, cabeceras de seguridad, solo métodos GET/HEAD/OPTIONS públicos, consultas parametrizadas, sin concatenación SQL.
- Dependencias: `pnpm audit` y revisión de licencias en CI; cada dependencia nueva con justificación (Constitución IV). Escaneo de imagen (p. ej. Trivy, gratuito) como check de PR.
- **Política de ramas y puertas de PR (confirmada)**: tras cada spec completada, commit(s) en `mvp/1`; PR `mvp/1` → `develop`; PR de release `develop` → `main` (GitFlow). Puertas obligatorias en todo PR: **pruebas, lint, DAST y revisión de Copilot**, además de los checks de abajo. DAST = escaneo dinámico contra la web/API levantadas localmente en el job (p. ej. OWASP ZAP baseline, gratuito) sin secretos ni objetivos remotos; la herramienta concreta y el umbral se fijan en T-064/T-077. La revisión de Copilot se configura como regla de la rama (manual del usuario). Los agentes de planificación no ejecutan ramas/commits/PR.
- **CI de verificación (gratuito, GitHub Actions)**, convención del repo, sin despliegue ni secretos: `lint`, `typecheck`, `test` (unit/contrato), `build` web, `content:validate`, `assets:check`, `check-scope`, `drizzle-kit generate` sin diff, validación de `compose config`, build de imagen API (sin push) + escaneo, prueba de integración con PostgreSQL 17 (servicio de contenedor), DAST. Permisos mínimos del workflow (`contents: read`), acciones fijadas por versión/SHA, sin `pull_request_target`. Protección de ramas (`main`/`develop`/`mvp/1`) y revisión obligatoria de Copilot: configuración manual del usuario.

- **Markdown con markdownlint (rev. 8, obligatorio)**: ver §12.14. El check `lint:md` forma parte de la lista de checks del CI de PR y de `pnpm verify`.

### 12.9 Decisiones (rev. 4)

| ID  | Decisión                                   | Estado                                                                                            |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| B-1 | Framework API                              | **Cerrada: Fastify**                                                                              |
| B-2 | Acceso a datos/migraciones                 | **Cerrada: Drizzle ORM + drizzle-kit** (SQL personalizado para puertas)                           |
| B-3 | Versiones                                  | **Cerrada: Node.js 22 LTS, PostgreSQL 17** (fijar tag/digest exacto al implementar T-054/T-056)   |
| B-4 | BD vs `content/`                           | **Cerrada: BD = fuente de verdad; `content/` = fixtures/importación**                             |
| B-5 | CORS/orígenes                              | **Cerrada 2026-11-09**: solo `http://localhost:4200`; no wildcard ni `127.0.0.1:4200`             |
| B-6 | Consumo de la API desde la web             | **Cerrada por implicación**: el build de release lee la API (T-062/T-074)                         |
| B-7 | Vía de escritura editorial tras el cutover | **Cerrada 2026-11-09**: CLI local con rol `editor` y dominio; T-129 antes de T-072; sin API admin |

### 12.10 Integración web ↔ API

`ApiContentRepository` implementa `ContentRepository` (misma interfaz y `publicFilter`); selección por token DI/variable de build `CONTENT_SOURCE=fixture|api`. **Sin valor por defecto en release**: `build:release` exige `api` explícito; `pnpm verify`/`ng serve` de desarrollo usan `fixture`. Con `api`, si la API no responde o `/ready` ≠ 200, el build **falla de forma explícita**. Prueba de contrato compartida ejecutada contra ambos adaptadores con los mismos datos (AC-13) y prueba de equivalencia de builds (AC-17).

### 12.11 Pruebas

- Dominio: unitarias (≥ 85 %), ya definidas; se mueven a `packages/domain`.
- API: unitarias de rutas con `fastify.inject` sin red; **integración** con PostgreSQL 17 real (migraciones desde cero; CHECK/triggers de publicación y activos rechazan estados ilegales (AC-15); `api_ro` sin escritura ni acceso a tablas base; público no ve `borrador`/`pending`); `/health` con BD caída y `/ready`.
- Contrato: suite común `ContentRepository` (fixture vs API) con los mismos datos sembrados; equivalencia de builds (AC-17).
- Release: `check-release` falla con `source=fixture`, API caída o migración distinta (AC-16).
- Contenedor: `USER` no-root, sin `.env`/secretos en la imagen, BD sin puertos publicados (`compose config`).
- Migración de monorepo: diff de salida de build antes/después (Fase C).

### 12.12 Presupuestos del backend

`/health` p95 ≤ 50 ms; `/ready` ≤ 200 ms; lecturas de contenido p95 ≤ 150 ms local con el catálogo completo (≤ 100 filas por lista) y ≤ 6 consultas SQL por petición; imagen de runtime objetivo ≤ 200 MB (a medir y ajustar tras B-1/B-3); arranque en frío ≤ 5 s. Sin dependencias nuevas en el bundle del cliente.

### 12.13 Riesgos (rev. 3)

| ID    | Riesgo                                                                                             | Mitigación                                                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R-M1  | Mover la web rompe rutas relativas/CI                                                              | Fase C aislada, reversible, con diff de build; puede diferirse                                                                       |
| R-M2  | Retraso de valor: la API es ahora necesaria para release                                           | Fases M0–M4 pequeñas; `fixture` sigue permitiendo desarrollar la UI sin Docker                                                       |
| R-M3  | Dos fuentes de producción (fixtures y BD)                                                          | FR-22; release solo `api`; bootstrap marcado en BD y seed bloqueado tras él; test de release (AC-16/17)                              |
| R-M4  | Fuga de secretos o BD expuesta                                                                     | §12.8, T-066a/b, `compose config` en CI                                                                                              |
| R-M5  | Deriva Drizzle ↔ Zod ↔ migraciones                                                                 | T-058 + check `drizzle-kit generate` sin diff en CI                                                                                  |
| R-M6  | Windows + Docker (rutas/finales de línea)                                                          | `.gitattributes` con `eol=lf` para scripts/SQL/Dockerfile (T-050)                                                                    |
| R-M7  | Puertas solo en la UI/dominio y no en BD                                                           | CHECK/triggers/vistas/roles en migración personalizada + pruebas AC-15                                                               |
| R-M8  | `drizzle-kit push` o edición manual de SQL rompe el historial                                      | Prohibido `push` fuera de BD desechable; CI de diff de generate                                                                      |
| R-M9  | Secreto commiteado, filtrado en logs/imagen/bundle web o credencial compartida entre roles de BD   | §13 (capas, escaneo, roles separados, runbook), T-078–T-090                                                                          |
| R-M10 | Ingesta futura copia contenido sin permiso o lo da por permitido implícitamente                    | §14: registro de fuentes, puerta de permiso por fuente, `borrador` obligatorio, link-only por defecto, T-091–T-100 diferidas, AC-19  |
| R-M11 | Cutover antes de verificar la CLI editorial elegida                                                | T-129 implementa B-7 antes de T-072; conserva derechos pending y controles BD                                                        |
| R-M12 | La config de markdownlint se relaja hasta no validar nada, o `--fix` altera el contenido semántico | §12.14: solo se desactivan MD013 (y MD060 si procede) con motivo escrito; `--fix` solo con reglas seguras y revisión del diff; T-123 |

### 12.14 Calidad de Markdown: markdownlint (rev. 8)

- **Herramienta**: `markdownlint-cli2` (devDependency raíz, versión exacta fijada con pnpm 12.18.0; justificación según Constitución IV: es el linter estándar y no entra en el bundle del cliente). Configuración en `.markdownlint-cli2.jsonc` (config + `globs` + `ignores`).
- **Alcance (globs)**: `README.md`, `**/*.md` rastreados; en particular `.specify/**/*.md`, `specs/**/*.md` y futuros `docs/**/*.md`. **Excluidos** (`ignores`): `node_modules/**`, `dist/**`, `.angular/**`, `coverage/**`, `.copilot/**` y carpetas de sesión/generadas (p. ej. `**/session-state/**`, `playwright-report/**`, `test-results/**`). Los `.md` dentro de `.specify/` sí se validan (incluidas plantillas); si una plantilla de Spec Kit infringe una regla, se corrige la plantilla o se documenta una excepción puntual (comentario `markdownlint-disable-next-line` con motivo), no una desactivación global.
- **Reglas**: configuración por defecto (`default: true`) conservando todas las reglas semánticas y de estructura (MD001 niveles de encabezado, MD022/MD031/MD032 espacios en blanco, MD024, MD025, MD033 HTML, MD040 lenguaje en bloques de código, MD042/MD051/MD052/MD053 enlaces/referencias, MD055–MD058 tablas, MD047 salto final). Solo se admiten estas relajaciones, cada una con motivo en la config: **MD013** (longitud de línea) desactivada porque los artefactos usan una línea por tarea/FR/AC; **MD060** (estilo de columnas de tabla) desactivada o en modo `any` si la versión fijada la incluye y el estilo compacto `|---|` ya existente la dispara. Cualquier otra desactivación requiere enmienda del plan. MD036/MD041 se evalúan al ejecutar: si fallan se corrige el documento antes que la regla.
- **Scripts** (`package.json`): `lint:md` = `markdownlint-cli2` (sin argumentos: usa `globs` de la config; falla con ≠ 0 ante infracciones); `lint:md:fix` = `markdownlint-cli2 --fix` (solo aplica las correcciones automáticas seguras que markdownlint define; no usa Prettier ni reescrituras propias; tras ejecutarlo se revisa `git diff` y se vuelve a correr `lint:md`). Prettier se mantiene para el formato general; en caso de solape (tablas, listas) prevalece lo que acepte markdownlint y no se ejecuta Prettier sobre `.md` si choca con él.
- **Integración**: `pnpm verify` (`scripts/verify-local.mjs`) ejecuta `lint:md` junto a `lint`; el job de lint del CI de PR (T-064) ejecuta `pnpm lint:md` (solo comprueba, nunca `--fix`, para no modificar el árbol en CI); se añade al checklist de PR (T-076) y a la lista de checks requeridos (manual del usuario).
- **Cobertura de «todo Markdown rastreado»**: el check usa los globs, pero T-123 añade una verificación (`git ls-files '*.md'`) de que ningún `.md` rastreado queda fuera de los globs salvo las exclusiones declaradas.
- **Cambio previo no solicitado en `plan.md`** (solo espaciado de tablas): se **conserva**; no cambia el significado. Se formatea/valida como parte de T-123 con `pnpm lint:md:fix` y se revisa su diff junto al resto; si markdownlint lo acepta, no requiere acción adicional.

## 13. Gestión de secretos por capas (rev. 5)

Principio: Constitución XII. Todo lo de esta sección que **no depende de un proveedor** es implementable ya (marcado [SIN PROVEEDOR]); lo que sí depende queda [DIFERIDO-HOSTING] y no se implementa ni se elige proveedor.

### 13.1 Categorías, propietario y ciclo de vida

| Categoría                           | Ejemplos                                                                                                                | Capa            | Propietario          | Rotación                                                                                                                  | Revocación                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| C1 Credenciales de BD por rol       | `DB_PASSWORD_MIGRATOR`, `_IMPORTER`, `_EDITOR`, `_API_RO`, `POSTGRES_PASSWORD` (superusuario del contenedor, solo init) | local / prod    | Mantenedor (usuario) | Local: al recrear volumen o ante sospecha. Prod: ≤ 90 días o ante incidente, sin downtime (doble credencial/`ALTER ROLE`) | `ALTER ROLE … PASSWORD`/`NOLOGIN`, reiniciar consumidores |
| C2 Credenciales de CI               | secretos de entorno de GitHub Actions (si hiciera falta alguno)                                                         | CI              | Mantenedor           | ≤ 90 días; preferir OIDC (sin secreto)                                                                                    | Borrar secreto en GitHub y revocar en origen              |
| C3 Credenciales de despliegue/nube  | tokens de registro, rol de despliegue                                                                                   | prod (diferido) | Mantenedor           | OIDC con credenciales efímeras; si no, ≤ 90 días                                                                          | Revocar rol/token en el proveedor                         |
| C4 Secretos de aplicación           | claves de firma, tokens de API admin (solo si B-7 los crea)                                                             | prod (diferido) | Mantenedor           | ≤ 180 días o ante incidente                                                                                               | Rotar y reiniciar                                         |
| C5 **No secretos** (config pública) | `BASE_URL`, `CONTENT_SOURCE`, `CORS_ORIGINS`, `API_BASE_URL` pública, puertos                                           | cualquiera      | —                    | —                                                                                                                         | —                                                         |

Regla: el nombre de variable declara la categoría (`*_PASSWORD`, `*_TOKEN`, `*_KEY`, `*_SECRET` ⇒ C1–C4). Todo secreto nuevo se registra en `docs/secrets-inventory.md` (nombre, categoría, consumidor, propietario, rotación; **nunca valores**).

### 13.2 Capa local (desarrollo) [SIN PROVEEDOR]

- `infra/docker/.env` y cualquier `.env*` quedan ignorados; solo `.env.example` se rastrea.
- `.env.example` contiene **únicamente** nombres, valores por defecto seguros (`CONTENT_SOURCE=fixture`, `POSTGRES_DB=gd_dev`, `POSTGRES_USER`/roles con nombres, `API_PORT=3000`, `CORS_ORIGINS=http://localhost:4200`) y **los campos secretos vacíos** (`DB_PASSWORD_API_RO=`), sin marcadores tipo secreto (nada de `changeme`, `password`, `xxx`, `<your-key>`, ni cadenas con forma de clave) para no entrenar el hábito de copiar valores débiles ni disparar falsos positivos.
- `pnpm setup:env` (script local, T-079) copia `.env.example` → `infra/docker/.env` y **genera** contraseñas aleatorias (≥ 24 bytes, `crypto.randomBytes`) por rol, sin imprimirlas. Resultado: credenciales de desarrollo únicas por máquina, claramente no productivas (BD `gd_dev`, usuarios con sufijo `_dev`), y la API falla al arrancar si recibe una contraseña vacía o un valor de una lista de contraseñas prohibidas.
- Docker Compose recibe valores solo desde `infra/docker/.env` (interpolación/`env_file`) o, preferible, como **archivos de secretos** (`secrets:` con `file:` bajo `infra/docker/secrets/`, ignorado) montados en `/run/secrets/*`; la API admite `<VAR>_FILE`. Sin valores literales en `compose.yaml`.
- Puertos: `db` sin `ports` (ya en §12.7); `api` publicada solo en `127.0.0.1`; `compose.debug.yaml` publica BD solo en `127.0.0.1`. Ningún servicio en `0.0.0.0` salvo decisión documentada.
- Prohibido en dev: reutilizar una credencial de dev en cualquier entorno remoto; la BD de dev no contiene datos reales de producción.

### 13.3 Separación de credenciales de BD [SIN PROVEEDOR]

Cuatro credenciales independientes y privilegios mínimos: `migrator` (DDL solo en job migrate), `importer` (seed/bootstrap local), `editor` (CLI local B-7/T-129), `api_ro` (única credencial del runtime API). Cada proceso recibe solo su archivo; sin `env_file` compartido. Superusuario solo `db`; nunca aplicación. Aprovisionamiento desde secretos ignorados prepara LOGIN antes de conectar migrate; migraciones mantienen creación idempotente NOLOGIN, sin contraseñas versionadas. Para volúmenes existentes, paso local explícito idempotente, sin borrar datos. T-056b cuenta con autorización expresa del usuario para roles persistentes LOGIN y secretos Compose separados. T-073 verifica no DDL/tablas base con api_ro. El detalle prevalece sobre la mención histórica de env_file en §12.7, que no debe implementarse como archivo compartido.

### 13.4 Capa CI (GitHub Actions) [SIN PROVEEDOR de hosting]

- Hoy los jobs de verificación no necesitan secretos (§12.8): las credenciales de PostgreSQL del servicio de contenedor y de DAST son valores **efímeros generados en el job** (`openssl rand`/`crypto`), enmascarados con `::add-mask::`, nunca reutilizados.
- Si se necesitara un secreto: secreto de **entorno** de GitHub (no de repositorio, con revisores requeridos para entornos sensibles) y de **repositorio** solo para cosas no sensibles/de verificación; jamás disponibles para PR de forks (no `pull_request_target`; los PR de forks corren sin secretos).
- `permissions: contents: read` por defecto; permisos adicionales por job (`id-token: write` solo en el job que use OIDC). Acciones fijadas por SHA.
- Sin secretos en logs/artefactos: no `set -x`, no `docker compose config` con valores resueltos en logs (usar `--no-interpolate` o redactar), no subir `.env`/volcados como artefactos, `docker history`/escaneo de imagen sin secretos, retención corta de artefactos.
- OIDC: cuando exista nube/registro, usar federación OIDC de GitHub en lugar de claves de larga vida [DIFERIDO-HOSTING].
- **DAST**: objetivo exclusivamente efímero local en el runner (web + API + BD recién creadas con credenciales aleatorias de job); sin credenciales de producción, sin URLs remotas; verificación automática de que el objetivo es `localhost`/`127.0.0.1` (T-077/T-086).

### 13.5 Capa producción [DIFERIDO-HOSTING]: interfaz del almacén gestionado

Producción sigue diferida; no se elige proveedor. Se define solo el contrato al que cualquier proveedor debe ajustarse:

- **Abstracción `SecretSource`** (en `apps/api`, solo lectura, sin dependencias nuevas): resuelve `NOMBRE` desde (1) archivo `${NOMBRE}_FILE`/`/run/secrets/<nombre>` (preferido), (2) variable de entorno (solo dev/CI). Devuelve valores a la configuración Zod, que los marca como sensibles (nunca se registran; `toJSON`/log redactan). Un proveedor futuro se integra _fuera del proceso_ (agente/sidecar/orquestador que escribe el archivo), no con SDK de proveedor en la API.
- Almacén candidato (sin decidir): GitHub Environments (CI/despliegue) + gestor de secretos de la nube elegida, o Vault/OpenBao; requisitos: cifrado en reposo, versionado, control de acceso por identidad (mínimo privilegio por rol C1/C4), **registro de auditoría de acceso**, rotación programable, revocación inmediata.
- **Entrega a contenedores**: runtime por archivo/volumen de secretos (`/run/secrets`, `tmpfs`, modo 0400, usuario no-root) o variable inyectada por el orquestador solo si el archivo no es viable. **Prohibido**: `ARG`, `ENV` en Dockerfile, `COPY` de `.env`, secretos en capas o en `docker-compose.yaml` versionado, secretos en la línea de comandos (visibles en `ps`/historial).
- **Rotación**: procedimiento documentado, sin downtime (crear nueva credencial → desplegar → revocar la anterior); calendario por categoría (§13.1); la rotación es un runbook probado en local (T-082).
- **Auditoría de acceso**: cada lectura de secreto en producción queda registrada por el almacén; revisión trimestral del acceso y de identidades con permiso.
- **Break-glass**: una cuenta/procedimiento de emergencia de acceso temporal (caducidad ≤ 1 h, doble factor, registro y rotación de lo accedido tras su uso); se define en T-087 y se ejercita antes del primer despliegue.

### 13.6 Frontend y repositorio [SIN PROVEEDOR]

- El build público de Angular solo recibe variables de una **lista blanca pública** (`BASE_URL`, `CONTENT_SOURCE`, `API_BASE_URL` pública). `build:release` ejecuta con entorno mínimo (`env -i`-equivalente) y un test (T-084) falla si el `dist/` contiene valores de cualquier variable C1–C4 de un entorno centinela o patrones de secretos; `CONTENT_SOURCE=api` lee la API por HTTP público, sin credenciales (la API pública es `api_ro` detrás de vistas).
- Dockerfiles: sin `ARG`/`ENV` secretos, `.dockerignore` excluye `.env*`, `secrets/`; `package.json`: scripts sin credenciales literales ni URLs con usuario:clave; fixtures (`content/`): sin tokens ni credenciales (escaneo incluido). `check-secrets` (T-066a) cubre estos tres sitios.

### 13.7 Controles de detección [SIN PROVEEDOR]

- **Pre-commit**: gitleaks (o equivalente gratuito, p. ej. `secretlint`) vía hook local (`.githooks/pre-commit` con `core.hooksPath`, instalable con `pnpm setup:hooks`; el hook es ayuda, no garantía).
- **CI** (obligatorio, no omitible): gitleaks sobre el diff del PR y escaneo periódico de todo el historial; `check-secrets` (T-066a); escaneo de imagen (T-066b). Configuración con allowlist mínima y justificada (`.gitleaks.toml`).
- **GitHub**: activar _secret scanning_ y _push protection_ (acción manual del usuario; documentada en T-076).
- Regla de falsos positivos: se corrigen por allowlist con comentario y revisión en PR; nunca desactivando la regla.

### 13.8 Incidente por exposición accidental (runbook, T-081)

1. **Contener** (minutos): tratar el secreto como comprometido aunque el commit sea reciente o esté en una rama local; no borrar el commit como única acción.
2. **Revocar/rotar primero** en el origen (rol de BD, token, secreto de GitHub), antes de limpiar el historial.
3. **Evaluar alcance**: qué puede hacer la credencial (C1–C4), logs/auditoría de uso desde la exposición; si se usó, escalar a incidente de datos.
4. **Limpiar**: reescribir historial (`git filter-repo`) solo con coordinación y forzando invalidación de forks/clones; cachés, artefactos de CI y logs afectados se eliminan; no se confía en la limpieza como mitigación.
5. **Verificar** con escaneo del historial completo; **registrar** postmortem breve (causa, control que falló) en `docs/security/incidents/` sin incluir el valor; añadir regla/prueba que habría evitado la fuga.

### 13.9 ¿Vault autoalojado ahora? — Recomendación: **no todavía**

- **Justificación**: producción está diferida, hay un solo mantenedor, una API de solo lectura y ~4 credenciales; Vault/OpenBao añadiría un servicio con su propio ciclo de sellado/unseal, respaldo, alta disponibilidad y superficie de ataque, contradiciendo la Constitución VIII (sin servicios extra sin requisito) y el alcance Compose «app + BD». Los archivos de secretos locales + secretos de GitHub + `SecretSource` por archivo cubren el riesgo actual sin lock-in.
- **Reevaluar cuando** ocurra cualquiera: despliegue de producción real; > 1 operador con acceso a secretos; necesidad de credenciales dinámicas de BD de vida corta, auditoría de acceso con requisitos de cumplimiento o ≥ 2 entornos remotos. Entonces comparar un gestor gestionado del proveedor elegido frente a Vault/OpenBao autoalojado (coste operativo incluido) en un spec propio y una enmienda constitucional. Ninguna decisión de proveedor se toma aquí.

### 13.10 Qué se puede hacer ya y qué se difiere

| Ya (sin proveedor)                                                                                                                                                                                                                                                                      | Diferido (con hosting)                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-078 política/inventario, T-079 `setup:env`, T-080 `.env.example` + ignore, T-066a ampliado, T-083 gitleaks pre-commit+CI, T-084 test de no filtración en frontend, T-085 `SecretSource`+config sensible, T-086 DAST/CI sin secretos, T-081 runbook de incidente, T-082 rotación local | T-087 almacén gestionado + break-glass + auditoría, T-088 OIDC de CI a nube, T-089 inyección en orquestador, T-090 calendario de rotación en producción |

## 14. Hoja de ruta futura: adquisición y normalización de builds existentes (rev. 5; NO MVP, no implementar)

Cumple Constitución II/VII y FR-26. Este apartado es diseño documental: no habilita ninguna fuente, no concede permiso y no añade código, dependencias ni servicios (Constitución VIII; `check-scope`, AC-19).

### 14.1 Fuentes: permitidas vs. prohibidas

| Clase                                                                                                               | Estado                             | Condición                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| A. Envío del autor (el autor entrega su build)                                                                      | Permitida                          | Licencia/consentimiento escrito y registrado, atribución acordada           |
| B. Datos con licencia o exportados por el titular (archivo de exportación, dataset con licencia abierta compatible) | Permitida                          | Licencia verificada y versionada en el registro                             |
| C. API documentada o permiso explícito del titular                                                                  | Permitida                          | Términos citados, alcance/frecuencia acotados, prueba del permiso archivada |
| D. Solo enlace (_link-only_): título, autor, URL, fecha, clase/maestrías y datos factuales propios                  | Permitida sin permiso de contenido | Sin copiar texto, imágenes ni estructura de la guía; atribución visible     |
| E. Scraping automático de sitios de terceros                                                                        | **Prohibida**                      | Ni con `robots.txt` permisivo ni por ser público                            |
| F. Copia de texto de guías, imágenes, iconos, capturas o arte sin permiso                                           | **Prohibida**                      | —                                                                           |

Regla: el permiso es explícito, por fuente y por alcance; el silencio, la ausencia de prohibición o un `robots.txt` no son permiso. Ante duda, la fuente degrada a clase D.

### 14.2 Canalización por etapas (cada etapa falla de forma segura)

1. **Registro de fuentes y procedencia**: toda fuente existe en `sources` (extendida) con clase A–D, URL, titular, términos/licencia, prueba (`proofRef`), alcance, caducidad y estado `habilitada|suspendida|revocada`. Sin entrada habilitada no avanza nada.
2. **Puerta de permiso/derechos**: verificación humana de la prueba y del alcance; produce `rights_status` por lote. `pending` o caducado ⇒ solo clase D. Revocación ⇒ retirada/despublicación y purga de la captura cruda.
3. **Captura cruda con retención acotada**: solo para clases A–C, almacenamiento privado (fuera del repo y de imágenes Docker; sin secretos ni datos personales), cifrado en reposo cuando haya almacén, hash + fecha + versión de fuente; retención máxima definida por la licencia (por defecto ≤ 30 días tras la verificación) y purga demostrable; nunca se sirve públicamente.
4. **Parser/mapeador al esquema canónico**: función pura determinista (`packages/domain`) que convierte la entrada a `Build` (maestrías, habilidades, constelaciones, tiers) validada por Zod; campos no mapeables se marcan `sin_verificar`/`placeholder`, nunca se inventan; el texto de terceros no se conserva salvo cita permitida por la licencia.
5. **Verificación editorial humana**: revisión contra el juego y la fuente; cuenta de revisor (`reviewed_by`) distinta del importador; contenido nace `borrador`.
6. **Puerta de publicación**: las mismas de FR-23 (autor real, fuentes, `reviewed_by`, derechos aprobados); la ingesta no puede saltarlas ni escribir `publicado`.
7. **Versionado y seguimiento de cambios**: cada importación crea una versión (`source_revision`, hash, diff contra la versión previa); cambios de la fuente reabren revisión, no actualizan lo publicado automáticamente.
8. **Fallo seguro y cola de revisión**: errores de parseo, validación, permiso o hash inesperado envían el lote a una cola de revisión (`cuarentena`) sin publicar; la guía existente sigue intacta; el respaldo final es enlace con atribución (D).

### 14.3 Principios transversales

- Atribución externa conservada en cada guía derivada (autor original, URL, licencia, fecha de captura) y visible en la UI (US4).
- Ejecución manual disparada por un editor (sin crawlers ni programaciones) hasta que un spec por fuente lo apruebe; sin Redis/colas (VIII): la «cola de revisión» es una tabla/estado en PostgreSQL.
- Credenciales de la fuente (si una API las exige) son secretos C3/C4 (§13) y nunca van al repositorio.
- Se reutilizan: `sources`, `rights_status`, `review_state`, `content_origin`/`origin` (nuevo valor `'import'`), puertas SQL (T-055) y API de solo lectura; la API pública no expone capturas ni cola.

### 14.4 Preguntas abiertas (deciden antes de activar cualquier fuente)

Qué fuentes concretas se piden (con quién se negocia permiso); si habrá formato de envío para autores; retención de captura por licencia; quién actúa como revisor. **[NEEDS CLARIFICATION]** no bloquean el MVP.

## 15. Builds adaptadas de terceros: derechos, atribución y operación (rev. 6)

Cumple Constitución I/II/VII (v1.6.0) y FR-27–FR-33. Diseño y artefactos editoriales; **no** añade scraping ni importación masiva.

### 15.1 Dos modos, nunca mezclados

| Modo                                            | Condición                                                                                                        | Qué se publica                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adaptación** (`entry_kind='build_adaptada'`)  | `rights_status ∈ {licensed, permission_granted}` + evidencia vigente cuyo alcance cubre adaptación/republicación | Build nativa interactiva + atribución prominente + procedencia                                                                                  |
| **Solo enlace** (`enlace_externo`, `link_only`) | Derechos `pending`/denegados/limitados/caducados/revocados, o duda                                               | Tarjeta: título, autor, sitio, URL, fecha, maestrías/daño verificados de forma independiente. Sin cuerpo, imágenes, activos ni ranking derivado |

Atribución sin evidencia ⇒ modo solo enlace. Licencias que permiten ver/compartir pero no derivados (p. ej. «no derivatives») ⇒ solo enlace. Términos del sitio y permiso del autor se evalúan por separado y el más restrictivo prevalece.

### 15.2 Puerta de verificación y publicación (checklist)

1. Fuente en `sources` + `source_rights_evidence` (tipo: licencia explícita | permiso escrito; referencia/archivo de prueba privado; alcance; vigencia).
2. Revisor de derechos ≠ editor de la adaptación; registra `rights_confirmed_by/on`.
3. Alcance de la evidencia ⊇ `transformation_scope` de la adaptación.
4. Metadatos FR-28 completos (data-model `build_adaptations`).
5. Atribución renderizada (bloque superior + sección Fuentes + JSON-LD) verificada por test.
6. Revisión de contenido contra el juego (`reviewed_by`).
7. Cualquier fallo ⇒ `borrador` o _link-only_. La puerta se impone en dominio (Zod/reglas puras) y, con BD, por CHECK/trigger (T-055).

### 15.3 Plantilla de solicitud de permiso (`docs/content/permission-request-template.md`, T-101)

Contenido: identificación del editor y del sitio; build y URL concretas; qué se pide (adaptar a formato interactivo, traducir al español, reescribir/estructurar, mostrar atribución prominente, enlazar al original); qué **no** se hará (sin imágenes/activos salvo permiso, sin implicar patrocinio); vigencia y derecho de retirada ≤ 72 h; cómo y dónde se registra la respuesta; respuesta explícita requerida (el silencio no es permiso). Registro de respuestas en `permission_requests`.

### 15.4 Retirada / takedown (`docs/content/takedown-runbook.md`, T-102)

Canal público de contacto; triaje en 24 h; despublicar primero, evaluar después; cambiar a _link-only_ o retirar; registrar `takedown_events`; invalidar caché/sitemap/JSON-LD; purgar capturas; notificar al solicitante; revisar otras adaptaciones de la misma fuente/autor; revocar `permission_granted` marca la evidencia `revocada`, lo que bloquea publicación por la puerta.

### 15.5 Detección de cambios en la fuente (`docs/content/source-change-review.md`, T-103)

Revisión manual periódica (p. ej. al publicar y cada 90 días, ajustable) o mediante enlace/HTTP permitido y sin eludir accesos. Se registra `source_change_events` (observado el, huella/fecha editada, tipo: edición, licencia, eliminación, bloqueo). Un cambio ⇒ estado `revision_pendiente` y revisión editorial; lo publicado no se actualiza solo. Eliminación/prohibición/cambio de licencia ⇒ §15.4. Respetar términos, `robots.txt`, login y muros: no se evade ningún control de acceso.

### 15.6 Foro de Grim Dawn (fuente candidata)

Antes de cualquier solicitud: leer y registrar sus términos de uso/política de contenido y de contacto; evaluar por autor (licencia indicada en el post, firma, perfil, permiso). Ninguna publicación del foro se asume reutilizable. Estado inicial de toda entrada del foro: `pending` ⇒ solo enlace con metadatos verificados manualmente. Sin scraping; la lectura es manual por un editor.

### 15.7 UI y SEO (`## UI` de la spec aplica)

Componente `SourceAttribution` (bloque «Esta build fue adaptada de: …») usando tokens existentes; estados default/focus-visible del enlace, y variante error si falta evidencia (solo en vista de editor/validación, no pública); 375/768/1280; WCAG 2.2 AA (enlace con texto descriptivo, contraste, no solo color). JSON-LD `Article` con `isBasedOn` (URL original), `author`, `license`/`citation`. Presupuesto: sin dependencias nuevas; sin impacto en LCP/CLS (texto estático prerenderizado).

### 15.8 Implementable vs. bloqueado

- **Implementable ya**: modelo de dominio y Zod (T-104), componente de atribución + JSON-LD (T-105), tarjeta link-only (T-106), reglas puras de la puerta (T-107), documentos/plantillas (T-101–T-103), `check-scope` (T-069b), fixtures sintéticos propios.
- **Implementable tras Fase 8 (BD)**: migraciones/CHECK de nuevas tablas (T-108).
- **Bloqueado**: publicar cualquier adaptación real del foro u otro sitio (necesita permiso/licencia registrado por fuente y autor, T-044-análogo externo); toda ingesta automatizada/importación masiva (T-092–T-100, enmienda + spec por fuente); cualquier acceso automatizado al foro.

## 17. Adenda de coherencia y cierre integral (2026-11-09)

### 17.1 Constitution Check y alcance de cierre

Revisada Constitución v1.8.0, sin enmiendas. I/II/VII: guía pendiente como fixture local, permisos no supuestos, fallback propio, adaptaciones sintéticas para checks. III: HTML prerender y SEO, borradores locales noindex aislados del release. IV/IX: T-003/T-040–T-042/T-126/T-128 verifican rendimiento, e2e y accesibilidad local y en CI; quedan corregidas las menciones anteriores de CI de rendimiento diferida. V/X: WCAG 2.2 AA, teclado/NVDA y español/i18n. VI/XI: dominio completo, BD única producción, API solo vistas, release fail-closed. VIII: raíz Angular conservada y sin nuevos servicios/auth. XII: credenciales por rol/archivo, sin secretos en repo/build/logs. La revisión posterior al diseño no encuentra excepción constitucional autorizada ni necesaria.

El cierre exige requisitos activos completos, incluidos UI y fase 8; `pnpm verify` actual o T-057 aislada no bastan. T-044/T-110 conservan bloqueos externos de publicación y aceptan borrador/link-only; no impiden entregar el resto verificado. T-067/T-075 siguen opcionales; hosting/ingesta/comunidad permanecen diferidos. La implementación trabaja una tarea por vez; los controles finales se registran con evidencia de ejecución, no por mera presencia de archivos o checks históricos.

### 17.2 Contrato, dependencias y decisiones cerradas

T-006/T-010 completan el contrato de spec §4/data-model antes de seed/API/UI; el test T-063 debe ampliarse, conservando la evidencia histórica de su versión mínima. T-127 crea vistas públicas adicionales para hijos/fuentes/catálogos sin otorgar acceso a tablas base; T-060 reconstruye y valida el contrato con ≤ 6 consultas. Contrato canónico en [contracts/content.md](contracts/content.md); verificación en [quickstart.md](quickstart.md).

**Adenda previa a T-006 — documento editorial y DTO público:** `packages/domain` mantiene un único contrato canónico compuesto por campos comunes y extensión editorial privada. `BuildDocumentSchema`/`BuildDocument` validan almacenamiento, fixtures e importación/CLI, incluidas las puertas que requieren `reviewed_by` y `rights_confirmed_by/on`; el nombre existente `BuildSchema` puede conservarse como alias del documento para compatibilidad. `PublicBuildSchema`/`PublicBuild` y los DTO públicos anidados de autor/fuentes/tier list se derivan de esos mismos campos Zod con selección explícita de campos públicos y reglas comunes reutilizadas, sin duplicar esquemas manualmente. El DTO público valida los estados `publicado` y derechos aprobados, referencias/contenido íntegro y los datos de atribución públicos, pero no exige ni acepta firmantes, identidad del revisor, evidencia privada, rutas de prueba o notas internas. No se falsean esos campos con nulls, cadenas o identidades ficticias para pasar el esquema editorial.

La puerta completa de publicación permanece en dominio editorial y BD; la API solo lee vistas que ya la impusieron. publicFilter depende de `review_state`/`rights_status` (y estados de contenido aplicables), no de campos de auditoría omitidos. T-127 expondrá esos estados seguros sin revelar firmantes. T-006 prepara esquemas/tipos/fixtures; no cambia SQL ni adelanta T-127. `FileContentRepository` usa documentos completos para borradores locales; su modo público proyecta el DTO público. T-010/T-063/T-062 precisarán los tipos de retorno según modo y comprobarán paridad contra proyecciones públicas, comparando documentos completos exclusivamente en modo fixture local. Ningún documento editorial privado se serializa a TransferState, HTML, JSON-LD o bundle del artefacto público.

Los fixtures consumidores enumerados en T-006 se actualizan con contenido sintético propio explícito, sin defaults vacíos para eludir campos obligatorios; el fixture inválido conserva la causa específica de rechazo. Las pruebas prueban que faltantes siguen fallando y que inyectar un campo privado en un DTO público se rechaza, incluso anidado. Esto implementa Constitución VI/XI y la privacidad ya definida en data-model; no introduce una segunda fuente de verdad ni cambia requisitos de publicación.

T-056 andamiaje → T-056b (secretos/roles autorizados) → T-057 (migración/readiness/build) → comprobación completa T-056/T-073. No hay dependencia de T-056b respecto de T-056 ya healthy: evita ciclo. No se usa el superusuario como migrador. Los archivos ya modificados y comprobaciones anteriores de T-057 quedan registrados en tasks/blockers sin presentarlos como planificación previa.

B-5: solo `http://localhost:4200`; otros orígenes y wildcard rechazados. B-7: CLI local con rol `editor`, dominio/transacción y permisos mínimos (T-129), antes de bootstrap T-072. No API admin ni cuentas. La indicación histórica de B-7 pendiente en §12.5c queda reemplazada por la dependencia técnica T-129. DAST/Trivy bloquean desde severidad MEDIA, según usuario; no umbral por decidir. Ninguna decisión confirma derechos de contenido.

### 17.3 Recuperación oficial Spec Kit (T-124)

Origen: [github/spec-kit](https://github.com/github/spec-kit/tree/c43849408ac0de2ca6a52f14eaae71449776057b), commit `c43849408ac0de2ca6a52f14eaae71449776057b`, CLI `1.3.3.dev0`. Recuperación inicial: clon temporal con profundidad 1; comprobar y fijar ese commit para reproducir, sin asumir que HEAD futuro coincide. Python 3.15 en venv temporal; `PYYAML_FORCE_LIBYAML=0` al instalar el checkout con pip. Ejecutar `specify init <directorio-temporal-unico> --non-interactive --integration codex --script ps --ignore-agent-tools --integration-options='--events false'`. Comparar inventario/hashes; copiar solo destinos inexistentes tras preflight de todos, excluyendo `.specify/memory/*` para preservar constitución. Conservar licencia MIT upstream en `.specify/LICENSE.spec-kit` y registrar los 27 archivos recuperados en `tooling-provenance.md` al implementar T-124; no inventar lista o hash sin comprobarlos.

Las nueve skills oficiales generadas `.agents/skills/speckit-*/SKILL.md` se conservan idénticas a su fuente en disco local y se excluyen del tracking y lint mediante patrón limitado a esos archivos generados. Ninguna skill propia/reviewer queda excluida; todo Markdown rastreado, incluidas plantillas oficiales, conserva markdownlint. No se relajan reglas semánticas. La recuperación ya realizada y autoformato previo de skills son hechos retrospectivos; T-124 exige restaurar fuente exacta y comprobar procedencia. No se reescriben instrucciones oficiales. No se vuelve a inicializar sobre la raíz con `--force`.

### 17.4 Regularización retrospectiva de logging (T-125)

Logging de PostgreSQL y documentación se implementaron antes de planificar ese alcance, desviación reconocida en blockers.md. Esta adenda no acredita planificación previa. Configuración a revisar: stderr sin collector, UTC y prefijo con SQLSTATE/sesión, eventos conexión/desconexión/checkpoint/lock wait; `log_statement=none`, parámetros y duración desactivados, errores sin sentencia SQL; driver Docker local con 10 MiB × 3. Probar error controlado en PostgreSQL 17 efímero y presencia de metadatos, ausencia de centinelas SQL/parámetros/contraseñas, config Compose y pruebas automatizadas; no borrar volumen persistente ni imprimir valores de credenciales. La evidencia histórica se conserva y cualquier cambio adicional se implementa después de esta regularización.

## 16. Hoja de ruta futura: guías de autoría comunitaria (rev. 7; NO MVP, no implementar)

Cumple Constitución VIII (v1.7.0) y FR-34–FR-45. Diseño documental: sin código de auth ni de app, sin dependencias, sin cuentas públicas, editor público ni comentarios.

### 16.1 Decisiones pendientes (bloquean la activación, no el MVP) — [NEEDS CLARIFICATION]

| ID  | Decisión                                          | Opciones / nota                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | Proveedor de identidad                            | OIDC gestionado vs. autoalojado vs. cuentas propias con correo + MFA; implica enmienda de VIII/XI (sin auth externo hoy) y XII (secretos)                                                                                                                      |
| D-2 | Términos del colaborador y licencia               | Licencia que el autor concede al sitio (no exclusiva, revocable/retirada), licencia pública de las guías (p. ej. CC BY-SA vs. «todos los derechos reservados + licencia al sitio»), política de IA/plagio, edad mínima, privacidad; revisión legal recomendada |
| D-3 | Equipo de moderación y SLA                        | Quién modera, cobertura, SLA de revisión (p. ej. 7 d) y de retirada (≤ 72 h), escalado                                                                                                                                                                         |
| D-4 | Sanitización/formato del texto                    | Subconjunto Markdown vs. campos estructurados puros                                                                                                                                                                                                            |
| D-5 | Almacenamiento/retención de evidencias de permiso | Privado, acceso por rol, retención                                                                                                                                                                                                                             |
| D-6 | Cuotas y umbrales de abuso                        | Valores iniciales de tasa/tamaño/cuarentena                                                                                                                                                                                                                    |

### 16.2 Hoja de ruta por etapas

| Etapa                                           | Alcance                                                                                                                                                                                                 | Precondiciones                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **E0 (MVP, hoy)**                               | Contenido editorial interno; documentos de política (T-111/T-112)                                                                                                                                       | —                                                                     |
| **E1 — Autores invitados (sin autoservicio)**   | El equipo da de alta autores verificados (`authors` + rol); el autor envía su guía por un canal manual (archivo de contenido validado) con atestación firmada; revisión editorial; sin cuentas públicas | D-2, D-3 mínimas; plan §15 operativo                                  |
| **E2 — Editor estructurado para invitados**     | Identidad (D-1) solo para invitados; borradores en BD, editor estructurado, validación, versiones, auditoría, reportes; publicación solo tras revisión                                                  | D-1, D-4, D-5; enmienda constitucional + spec propio; Fase 8 completa |
| **E3 — Registro con verificación y cuarentena** | Altas por solicitud/aprobación; límites, cuarentena de cuentas nuevas, herramientas de moderación                                                                                                       | D-6; capacidad de moderación (D-3) demostrada                         |
| **E4 — Apertura gradual**                       | Registro más abierto, reputación/promoción de autores; comentarios solo si se decide aparte                                                                                                             | Métricas de abuso y SLA cumplidos; spec propio                        |

Cada etapa exige su propia enmienda/spec y no se salta la anterior. Nunca hay publicación abierta sin revisión.

### 16.3 Flujo y permisos

Estados: `borrador` (solo autor) → `enviada` (congelada como versión N) → `en_revision_editor` → `cambios_solicitados` (vuelve al autor) | `aprobada` → `publicado`; terminales/alternos: `rechazada`, `retirada`. Matriz: autor (CRUD de sus borradores, enviar, retirar la propia), editor (revisar contenido), moderador (derechos, reportes, retirada, suspensión), admin (roles). Regla de separación: aprobador ≠ autor; verificador de derechos ≠ editor de la adaptación. Cada transición se audita.

### 16.4 Contribuciones: original vs. adaptación

- **Original**: atestación de autoría y titularidad + aceptación de términos (versión/fecha/huella) + declaración de que no incluye material de terceros ni activos oficiales sin `approved`. `rights_status` ⇒ `own_original` (el titular es el autor; moderador verifica indicios de plagio).
- **Adaptación**: todo lo anterior más fuente (URL, título, autor, sitio, fecha), evidencia que cubra adaptación (plan §15), alcance de la transformación y atribución prominente. Sin evidencia revisada ⇒ no se puede enviar como adaptación; solo _link-only_.

### 16.5 Seguridad y abuso (resumen de diseño)

Autorización por rol y propiedad en API y BD (RLS/vistas, sin confiar en la UI); validación Zod+CHECK; sanitización del texto, sin HTML crudo ni imágenes remotas (XSS, tracking, derechos); límites de tasa y de tamaño; cuarentena de cuentas nuevas; reporte/retirada; auditoría append-only; secretos de identidad bajo §13; datos personales mínimos con política de privacidad; DAST ampliado. Presupuesto: el editor se carga diferido (ruta lazy) sin afectar el bundle público; páginas públicas siguen SSG/SSR.

### 16.6 Implementable vs. bloqueado

- **Implementable ya (documental)**: política de contribución, borrador de términos (a revisar legalmente), checklist de moderación, matriz de roles/estados, enmienda (T-111, T-112), guarda `check-scope` de no-auth (T-113).
- **Bloqueado hasta decisiones**: todo lo demás (T-114–T-122): requiere D-1/D-2/D-3 y enmienda + spec por etapa. Nada de ello ocurre en el MVP.

### 17.4 Fidelidad de la fuente local antes de T-014

La transcripción de spec §4 conserva datos presentes sin inventar valores de juego.
T-130 completa el contrato para objetivos de puntos desconocidos (null), niveles
de constelación no indicados (null) y vínculos a habilidades mencionadas que no
aparecen en el árbol. Un vínculo sin nodo exige skill_node_slug=null y
skill_name_es no vacío, solo en un paso sin_verificar; un slug no null sigue
requiriendo nodo existente. Las variantes son estrictas, sin aceptar referencias
rotas como válidas ni degradar la puerta de derechos/publicación.

El HTML contiene 14 habilidades con ES/EN y una tarjeta de grupo omitido. Esa
tarjeta se conserva como nota general «Omitir · Demoledor», con título y razón
exactos; no es una habilidad del catálogo. Sus cuatro NPC se conservan como tales,
y las filas Coste/Aviso se conservan como notas generales de Guía Espiritual.
No se inventan dos personas adicionales para satisfacer una cifra histórica.
El objetivo «máximo» mantiene highlights.points=null y su texto en el paso.
El vínculo Elemental Storm conserva «Tótem de Tormenta» sin añadir una habilidad
con barra/nombre inglés no documentados. Las afinidades desconocidas y los nombres
ES de constelaciones no confirmados permanecen null. La versión del juego se
rotula «Sin confirmar»; la transcripción no acredita una versión actual del juego.

Constitución I/II/VII: fiel, sin scraping, sin inventar datos ni confirmar derechos;
VI: mismo dominio para almacenamiento/CLI/DTO; sin dependencia nueva. T-127 hace
nullable constellations.tier_level en migración nueva, sin editar la histórica,
antes de seed T-059. No cambia permisos ni puertas de publicación.

### 17.5 Catálogo inicial verificable (T-016)

La lista oficial consultada el 2026-11-09 enumera diez maestrías, incluida
Berserker (research.md). Sembrar los 45 pares distintos, sin maestrías únicas.
No copiar nombres de clases combinadas de terceros: cada rótulo es «Maestría A +
Maestría B», con los nombres EN oficiales y rótulos ES editoriales del proyecto,
identificados como tales en la atribución pública. No son traducciones oficiales
verificadas salvo las presentes en el HTML; no se inventan descripciones o tiers.
La rama del catálogo es 1.3.x (Fangs of Asterkarn), sin afirmar el último parche.
La guía migrada conserva por separado su versión Sin confirmar.

La autoría de las ranuras generadas es Grim Dawn Builds (el proyecto real), con
fuente oficial y derechos own_original sobre su estructura/rotulado propio.
Cada placeholder es publicado/sin_clasificar/placeholder, sin guía ni enlace,
y refiere esa fuente factual. La entrada de la guía migrada conserva exactamente
borrador/pending/sin_verificar y su fuente; no reemplaza la ranura pública. No se
inventan confirmantes de derechos ni revisores humanos para el catálogo.

Generación pura con Zod canónico: ordenar maestrías por slug ASCII, producir pares
únicos y una ranura por par, añadir builds por slug sin alterar metadatos, rechazar
catálogos duplicados/referencias incompatibles y fuentes con el mismo slug y datos
contradictorios. Los cuerpos link_only no se convierten en guías nativas. Sin red,
reloj ni lectura de BD. La CLI escribe solo el fixture principal y --check falla
ante diferencia sin escribir. Un seed regenerado es fixture de desarrollo; nunca
se usa como producción/release (T-074). Pruebas Node antes de implementación y
lectura por adaptador servidor: 45 ranuras públicas sin cuerpo/autor pendiente,
46 entradas locales incluida la guía borrador. Sin dependencias nuevas.

### 17.6 Herramienta de revisión visual para sdd-ui (T-131)

El rol local sdd-ui exige Impeccable antes de editar UI. No estaba instalado.
Fuente oficial inspeccionada: pbakaus/impeccable, commit
f866ce13beb3a065fabfce90f8c784eedad84117, paquete 4.8.1, licencia Apache-2.0.
Instalación de proyecto para Codex con versión fijada y --no-hooks; se carga y
se usa explícitamente el skill, sin instalar permisos/hooks nativos ni alterar
configuración global. El instalador soporta --no-hooks según su ayuda oficial.
La caché npm y el engine se guardan en el temporal de esta sesión.

El payload de proveedor es generado/regenerable y se ignora exactamente en
.agents/skills/impeccable; se preserva upstream, sin reescribirlo para markdownlint.
Las cinco skills propias y sus cuatro revisiones obligatorias de cierre siguen
versionadas y lintadas. Documentar reproducción y versión efectiva instalada,
verificar skill/contexto y conservar la spec/plan como autoridad sobre colores,
fuentes, alcance, derechos y arquitectura. Ninguna dependencia nueva de runtime.

### 17.7 Base visual existente y T-017

Aplicar spec §5 y los tokens §7 como sistema aprobado (Read/Operate), usando
Impeccable como refinamiento acotado de esa identidad. No hay decisión nueva de
producto/estética ni se inicia un rediseño. Paleta intacta: ash supera 4.5:1 sobre
soot/panel/panel-2 (mínimo calculado 4.556...), así que no hace falta ash-strong.
line es separador decorativo; controles y foco deben usar ash/storm con contraste.

Precisar tokens de escala: text-small .75rem, text-base 1rem, text-large 1.25rem,
text-heading 2rem, text-hero clamp(2.5rem,8vw,6rem); line-body 1.6,
line-heading 1.15; peso de cuerpo 400 y énfasis 600, display 400. Foco 2px y offset
2px, radio 0 y espacios §7. Las cifras nuevas son tokens, no valores dispersos
en componentes. Base semántica con box-sizing, márgenes, enlaces subrayados,
fuente heredada en controles, foco visible y respeto de reduced-motion/forced-colors.
La estructura/navegación/header/footer corresponde a T-019, no a este paso.

Fuentes autoalojadas sin dependencia npm de la app: archivos seleccionados de
Fontsource 5.3.0, tarballs npm verificados por SHA-512 y licencias OFL-1.1 con
copyright preservadas. Oswald y Karla variables (latin + latin-ext, cuatro WOFF2)
y Space Mono regular latin (un WOFF2; cubre el texto español/ASCII de datos).
Cinco archivos, tres familias, 116308 bytes; no variantes/itálicas no requeridas.
CSS unicode-range del paquete y font-display swap, preload local de Karla latin
y Oswald latin. Documentar procedencia/hashes en docs/fonts.md. No copiar arte
oficial ni usar CSS/solicitudes de Google Fonts en runtime.

Script de contraste lee colores reales de tokens.css, verifica las cuatro tintas
bone/ash/storm/ember sobre las tres superficies oscuras con fórmula WCAG y umbral
sin redondear. Pruebas con colores conocidos, bajo contraste y error de entrada;
verificación local lo ejecuta antes del build. Verificación visual del andamiaje a
375/768/1280 con navegador temporal, red para fuentes solo local y contraste
real; registrar las carencias de layout pendientes sin acreditarlas como resueltas.
Después de los cambios, ejecutar detector Impeccable y pases acotados de revisión.
No se agrega Playwright/axe al manifiesto de la app en esta tarea; herramientas de
verificación temporales, integración duradera por T-040/T-041/T-126.

### 17.8 Servicio SEO y configuración pública (T-018)

SeoService actualiza title/description/canonical, OG/Twitter, robots y JSON-LD
por ruta sin duplicados ni residuos de la ruta anterior. Metadatos de imagen
opcionales hasta que T-038 cree el PNG social propio: si no hay imagen real,
no emitir URL rota; el servicio admite path/alt/dimensiones de imagen existente.
Canonical omite query/fragmento y solo admite rutas internas, preservando el
prefijo de una BASE_URL configurada. ROOT local-first usa <http://localhost:4200/>.

SITE_BASE_URL valida http(s), sin userinfo, query ni fragmento. El servidor lee
únicamente BASE_URL de su entorno y transfiere únicamente la URL normalizada
mediante TransferState; el cliente usa ese mismo valor al hidratar, evitando
sustituir una URL configurada por el default local. Valores inválidos fallan con
mensaje constante sin imprimir la entrada. No serializar el entorno completo.

JSON-LD tiene @context schema.org y @type explícitos, se serializa antes de mutar
el head y escapa <, >, &, U+2028/U+2029. No usar innerHTML. Rechazar claves privadas
editoriales anidadas (firmantes, evidencia, reviewed_by y notas de derechos), no
convertir un documento editorial entero en JSON-LD. Los futuros mapeadores de
T-025/T-037 seleccionan datos públicos; los borradores locales requieren noindex,
y su ausencia del artefacto público se impone por rutas/repo, no por SEO solo.

Pruebas primero: URL/estado transferido, contenido/limpieza del head, cambio de
ruta con/sin imagen, cadena que incluye cierre de script y datos no serializables,
rechazo de claves privadas. Consumidor mínimo HomePage invoca SeoService y emite
WebSite para probar prerender/hidratación; la portada real sigue en T-038. Verificar
HTML sin JS y navegador con BASE_URL distinta del default. No dependencia nueva.

### 17.9 Estructura común de navegación (T-019)

SiteLayout proyecta la página dentro de un único main con id main y tabindex -1.
App envuelve RouterOutlet en ese layout; HomePage deja de crear otro main. Cabecera
con marca textual propia, navegación Inicio/Catálogo/Acerca siempre visible y
flexible; RouterLink y estado NavigationEnd/signal con aria-current para página activa (T-132). Pie con
aviso de no afiliación a Crate Entertainment y enlaces Legal/Criterios editoriales.
Los destinos de catálogo/estáticas se implementan en sus tareas; este paso no
acredita rutas ausentes como funcionales. Sin botones/hamburguesa innecesarios.

Saltar al contenido es el primer enlace: visible al enfocar, href #main, foco
real por teclado sobre el main, con JS y sin él. Cabecera/pie en flujo, sin tapar
contenido ni fijar alturas que recorten texto. Contenedor máximo 76rem y márgenes
laterales de space-5, flex-wrap para navegación; foco contenido dentro del viewport.
Añadir únicamente token page-max:76rem; resto usa paleta/fuentes/espaciado §7.
Texto UI y etiquetas aria con i18n Angular. Marca sin arte oficial ni iconos ajenos.

Pruebas de composición/landmarks, enlaces y estado activo; build y navegador
375/768/1280 con capturas, tabulación, skip link y axe. Conservar la misma identidad
visual fijada por la spec, sin rediseño ni decisiones de producto pendientes.
No dependencia nueva. Medir el bundle resultante contra el presupuesto existente.

### 17.10 Medición de gzip para desbloquear T-019 (T-132)

El layout con RouterLink/RouterLinkActive activa el límite aproximado anterior de
260kB raw: Angular informa 279.51kB raw y transferencia estimada 79.98kB. El
presupuesto aprobado §6 es JS gzip por ruta, no 260kB raw. No sustituir el control
con un incremento aislado: medir gzip real (zlib nivel 6), incluir el bootstrap y
la entrada lazy de HomePage con sus imports estáticos compartidos, sin duplicarlos.
El límite de portada sigue siendo 90000 bytes, sin contar CSS como JavaScript.

Stats esbuild se genera solo para producción en la raíz de dist, fuera de browser.
El checker resuelve las entradas script del HTML y la entrada HomePage del metafile,
recorre imports estáticos y falla cerrado ante metadatos/archivos faltantes o
ambigüedad. Los demás imports dinámicos pertenecen a sus rutas/defer: T-042/T-126
siguen obligadas a medir sus presupuestos 110/150/40kB, CSS, HTML y Lighthouse.
Este chequeo no acredita esas rutas ni métricas aún no implementadas.

Tras medir, angular.json conserva un guard aproximado raw con warning 280kB y
error 300kB, acompañado inseparablemente de la puerta gzip exacta de 90000 bytes
al final de pnpm build. No se cambian los umbrales aprobados de §6. Probar con
fixtures que excedan gzip, imports compartidos, lazy Home, archivos ausentes y
referencias externas; CLI falla ante exceso. Sin dependencias nuevas ni navegador
necesario para el checker; comparar una vez con recursos solicitados por el navegador.
T-019 queda sin marcar hasta pasar build y sus verificaciones de layout.

Precisión T-132 antes de optimizar: gzip nivel 6 real mide 90967 bytes, incluidos
los cuatro scripts solicitados para Home; la estimación Angular era menor y no
se usa como prueba de cumplimiento. Reducir estado activo del layout mediante
una sola suscripción NavigationEnd y signal, con DestroyRef para liberar recursos,
en lugar de RouterLinkActive genérico. Mantener RouterLink y comportamiento
observable/aria-current; pruebas verifican inicio/catálogo/query, sin cambios de
diseño. Esta corrección de consumidor pertenece al alcance explícito T-132 y
mantiene el límite 90000. T-019 continúa pendiente de verificación visual final.

T-019: el namespace gd de componentes compartidos ya está definido en spec/plan
(gd-icon/gd-skill-tree), mientras app se mantiene para raíz/features. Ampliar
únicamente los prefijos permitidos del selector ESLint a app/gd; no desactivar la
regla ni el resto del lint. Corrección del consumidor de configuración antes de
cerrar T-019, sin cambio de comportamiento/render.

## 17.11. Verificación de filtros existentes (T-022/T-023)

Las funciones y las pruebas ya existen en el historial (38f2f8e); no se acredita
retroactivamente un ciclo rojo/verde. Verificar la aceptación actual antes de
marcar las tareas. Ampliar únicamente filter.spec.ts para comprobar búsqueda
inglesa en los campos textuales, round-trip de todos los grupos, normalización
de tildes/espacios, caracteres reservados en texto y entradas congeladas. La
búsqueda usa displayName/note: el mapper de T-025 debe incluir los nombres ES/EN
del DTO en esos campos, sin cambiar el contrato ni descargar datos en runtime.
No se atribuye a esta verificación la futura integración UI/URL de T-025.

## 17.12. Verificación de utilidades SVG existentes (T-026/T-027)

layout.ts, keyboard-nav.ts y layout.spec.ts ya existen. Aplicar la misma
regularización explícita de pruebas heredadas: no afirmar un rojo histórico.
Antes de cerrar, ampliar layout.spec.ts con bosque vacío, desempate estable por
id, datos congelados, cadena de 120 nodos, ciclo desconectado junto a raíces
válidas y navegación por esa jerarquía. Mantener coordenadas y orden existentes;
no implementar componentes SVG ni afirmar accesibilidad visual de T-028/T-030.
Prueba de humo de 120 nodos <16ms, más lint y pruebas del módulo. Los componentes
limitan el tamaño según §3; estas funciones no leen ni descargan contenido.

## 17.13. Proyección PostgreSQL completa (T-127)

Migración nueva 0002_public_content generada desde Drizzle y ampliada con SQL
personalizado; conservar 0000/0001 sin cambios. Registrar snapshot nuevo para
que db:generate posterior no repita alteraciones. sources.slug único/not-null
resuelve la identidad del contrato: filas anteriores reciben `legacy-<uuid>`,
sin atribuirles títulos o identidades editoriales inventadas. El importador
posterior usa el slug real. Añadir build_constellations (build/constellation,
posición) para preservar también menciones sin paso, y position en prioridades
para preservar orden sin depender de rank nullable. Migrar asociaciones conocidas
desde pasos existentes; no inferir menciones que no estaban almacenadas.

constellations.tier_level pasa a nullable. v_public_builds excluye link_only y
añade estados/fechas seguros; listas/entradas añaden estados y referencias slug.
v_public_sources expone solo fuentes referenciadas por contenido visible y omite
permission_ref/notes; autores solo vinculados a guías/listas visibles. Catálogos
de maestrías/combinaciones son públicos. proof_ref de activos nunca se entrega:
mantener columna compatible redaccionada a NULL para no romper vistas existentes.

v_public_build_documents agrega un JSONB por guía pública: lista permitida de
campos canónicos, fuentes/autor públicos, todas las colecciones hijas ordenadas,
UUID internos convertidos a slugs y prioridades resueltas solo entre nodos de
esa misma guía. JSON highlights/bindings se almacena en forma canónica por los
futuros importador/editor (sin claves privadas); la proyección selecciona solo
sus claves canónicas. No usar row_to_json sobre tablas editoriales completas.
GRANT SELECT explícito por vista; api_ro sin tablas base ni escritura. Nueva
tabla concedida a importer como las demás hijas; editor se configura en T-129.

Antes del SQL, ampliar pruebas de paridad y PostgreSQL reales: null de tier,
slug, DTO completo validable sin firmantes falsos, contenido de todos los hijos,
guías ocultas/link_only, eliminación de visibilidad al despublicar, fuentes y
autores no referenciados, evidencia privada canaria, permisos SELECT y denegación
de escritura/base. Aplicar migraciones según journal, no una lista duplicada.
Readiness ya deriva hashes del journal: comprobar que reconoce la nueva entrada.
Archivos adicionales necesarios dentro de T-127: drizzle/meta/0002_snapshot.json
(nombre real según generador), migration-state.spec.ts y data-model.md. Sin
dependencias nuevas, sin API/seed ni alteraciones de contraseñas.

Escalamiento acotado T-127: el revisor sdd-escalation reprodujo dos tests
históricos desactualizados y no modificó archivos. Antes de corregirlos ampliar
alcance a src/db/schema.spec.ts (inventario exhaustivo incluye la nueva relación
y la clasifica como join con PK compuesta) y src/db/migrations.spec.ts (journal
continuo y correspondencia exacta SQL, sin límite fijo de dos entradas). Mantener
los controles de entidades, integridad de 0000 y generación sin diff. El backfill
de fuentes se verifica también con marca bootstrap dentro de rollback: desactivar
y reactivar únicamente gates_sources_fixture durante esa actualización de esquema
como propietario; no relajar la puerta permanente ni ejecutar seed.

## 17.14. Seed editorial local y transaccional (T-059)

seed.mts carga únicamente colecciones locales explícitas de content, valida todos
los recursos con el dominio antes de conectar y comprueba referencias/coherencia
entre archivos y documentos anidados. Sin imports de Angular/web ni dependencias
nuevas. JSON/errores Zod no imprimen contenido. APP_ENV debe ser development o
test, comprobado antes de leer archivos o secretos. Credencial propia importer
por SecretSource; ninguna credencial migrator/api_ro/admin. CLI no acepta URLs
ni contraseñas como argumentos. Puerto local solo mediante debug opt-in o ejecución
explícita en la red Docker; no publicar BD en Compose por defecto. Habilitación
operativa de importer permanece un prerrequisito que debe verificarse antes de
dar por utilizable el comando, sin usar la contraseña de otro rol.

Transacción: verificar current_user importer sin atributos privilegiados; bloquear
content_origin en SHARE ROW EXCLUSIVE y rechazar marca bootstrap antes de UPSERT.
El bloqueo serializa también un INSERT de bootstrap concurrente. Actualizar raíces
por slug preservando UUID; solo filas origin fixture, nunca sobreescribir editor
o bootstrap. Catálogos se validan y resuelven primero; pares físicos se ordenan
por UUID por CHECK existente (son combinaciones sin orden; el DTO de T-060 puede
normalizar los dos slugs). Reemplazar hijos solo de las guías/listas del lote en
orden de FK, con prioridades resueltas a los nuevos UUID de nodos de esa guía.
Conservar arrays/JSON/unknown null/atribución/estados completos; no aprobar derechos.
Rechazar conflictos de catálogos en un mismo lote y referencias fuera del lote.
Ninguna migración, DDL, cambio de roles o bootstrap desde seed. Rollback y cierre
de cliente ante fallo; salida solo contadores/códigos sin SQL, valores o trazas.

Ampliación de archivos de T-059 antes de implementar: apps/api/src/db/seed.mts,
apps/api/src/db/seed.spec.ts, apps/api/test/seed.int.spec.ts, apps/api/package.json,
package.json. Pruebas primero de entorno, validación, redacción y atomicidad;
PostgreSQL 17 desechable con puerto aleatorio solo loopback para usar pg real,
rol importer aislado: dos cargas mantienen conteos/contenido, pending no público,
bootstrap y producción abortan, error revierte, reconstrucción desde vacío.
No usar down -v sobre el volumen del usuario; destruir solo el fixture de prueba.

Hallazgo de integración T-059: 45 placeholders terminaron con playstyle hibrido
inventado por NOT NULL heredado. El escalamiento confirmó la causa sin editar.
Ampliar T-059 antes de corregir: schema.ts/schema.spec.ts, migración nueva
0003_unknown_catalog_playstyle.sql con snapshot/journal, schema-parity.spec.ts
y data-model.md. Quitar únicamente NOT NULL de tier_entries.playstyle y guardar
null sin build; builds.playstyle sigue obligatorio y su enum no cambia. No editar
0000–0002. Renumerar la futura migración T-129 como 0004_editor_permissions.
La prueba real debe pasar sin alterar la expectativa de datos desconocidos.

Verificación T-059: el ESLint raíz solo seleccionaba .ts, dejando seed.mts y
los entrypoints existentes fuera de api:lint. Añadir eslint.config.js al alcance
antes del cambio y extender el mismo bloque/rules a .mts, sin desactivar reglas.
Corregir solo incidencias de los archivos ya incluidos en esta tarea; si aparecen
incidencias ajenas, registrar su alcance antes de modificarlas. No acreditar
lint sobre un entrypoint omitido por el selector.

Estado tras verificación T-059: implementación y PostgreSQL aislado pasan; no
marcar cierre operativo todavía. Consulta de solo lectura a instancia del usuario
confirma esquema público vacío y ausencia de importer/editor. T-082 debe coordinar
activación/rotación explícita de importer mediante su archivo secreto propio antes
de ejecutar el comando local completo. No usar admin en seed ni abrir puerto por
defecto para salvar esa dependencia. No es un bloqueo externo del objetivo: queda
trabajo autorizado de infraestructura y operación para resolverlo.

## 17.15. Rotación y activación local de roles (T-082)

Completar T-082 para migrator/api_ro/importer/editor, lista cerrada de roles.
Activación de importer/editor solo con opción explícita --activate; rotar no
habilita por defecto roles NOLOGIN. El gestor local usa la conexión administrativa
Unix del contenedor exclusivamente para administración de roles, no para seed.
Negocio/seed reciben solo su propio archivo secreto. Transporte de contraseña
exclusivamente por stdin a psql/password y sondas TCP dentro del contenedor;
ningún valor en argv, stdout, stderr o archivos rastreados. No puerto host nuevo.

Preflight: .env y archivo de rol ignorados/no rastreados, sin symlinks, valores
coherentes; rol existente sin atributos privilegiados y estado LOGIN conocido.
Bloqueo por rol y registro de recuperación 0600 dentro de secrets/ ignorado antes
de mutar PostgreSQL. Cambiar contraseña, activar si corresponde, persistir archivo
y .env, recrear API solo para api_ro, comprobar nueva credencial válida y anterior
inválida. Si falla, compensar contraseña, LOGIN, archivos y consumidor; conservar
registro si la compensación falla. --recover explícito restaura desde registro,
sin imprimirlo. Fallo de limpieza se distingue de fallo de rotación. La rotación
local de api_ro puede tener una interrupción breve durante recreación; el diseño
sin downtime de §13.5 sigue reservado a producción diferida.

Archivos T-082 ampliados antes de implementar: scripts/rotate-secret.mts,
scripts/rotate-secret.test.mts, docs/security/rotation.md, package.json,
apps/api/test/rotation.int.spec.ts. Primero pruebas de protocolo: rol inválido,
NOLOGIN sin --activate, fallos antes/después de escritura, compensación, recuperación
fallida y renovación del consumidor; sin depender solo de mocks para cierre.
Integración Docker aislada debe autenticar por contraseña (no trust), invalidar
la anterior, conservar una fila canaria y reconectar API después de rotar api_ro.
No marcar T-082 ni T-059 por pruebas unitarias del protocolo solamente.

Precisiones operativas antes de integrar: bloqueo global en secrets/ porque los
roles comparten .env. Archivo del secreto se reescribe con fsync preservando inode
para que los bind mounts del contenedor db también vean el valor nuevo; .env se
reemplaza atómicamente y el journal permite reparar una escritura interrumpida del
secreto. La sonda de rechazo exige un error de autenticación/NOLOGIN reconocible,
no acepta un error de red como prueba de que la contraseña vieja quedó revocada.
La integración detectó localhost trust en pg_hba: las sondas usan el hostname db
(dirección del bridge, regla host SCRAM), no 127.0.0.1, para probar contraseñas.

Corrección de ubicación tras check-boundaries: la integración pertenece a scripts,
no a la zona API que solo puede importar dominio. Mover a
scripts/rotate-secret.int.spec.mts, mantener import local al gestor y ejecutarla
con Vitest explícito mediante test:rotation. Ampliar alcance a verify-local.mjs y
verify-local.test.mjs para incluir esa puerta sin modificar la matriz de límites.
La ejecución sin RUN_ROTATION_TESTS queda omitida explícitamente; el cierre exige
la ejecución opt-in real, y CI debe activarla en T-065/T-126.

T-082 verificada: 13 pruebas de protocolo y tres integraciones Docker reales,
incluida recuperación de proceso interrumpido. Verificación general pasa con
RUN_DB_TESTS/RUN_ROTATION_TESTS; guardia de límites sin excepciones. Instancia
local actualizada conservando el volumen: roles reprovisionados por hook existente,
cuatro migraciones aplicadas por servicio one-shot, API ready 200 e importer
activado con archivo propio. Seed aislado de un solo uso ejecutado dos veces
contra esa instancia conserva 1 borrador pending, 46 entradas y 45 públicas.

## 17.16. Lanzador local de seed sin publicar PostgreSQL (cierre T-059)

Retomar T-059 tras T-082. Añadir scripts/seed-content.mts y su .test.mts al alcance
antes de implementar. El comando raíz db:seed debe lanzar el mismo seed compilado
en un contenedor de un solo uso, con imagen local ya construida (sin pull implícito),
solo content readonly y archivo importer, sin secretos de API/migrator/admin.
Obtener red y nombre de BD del contenedor db mediante metadatos públicos; no leer
ni pasar .env completo al proceso de negocio. No puerto host ni servicio permanente
nuevo. Exigir APP_ENV explícito development/test antes de archivos/Docker; producción
rechazada. Límites de recursos/hardening iguales al job probado manualmente.
El script del workspace API conserva la entrada directa para entornos que ya
inyectan su conexión/credencial propia. El comando raíz funciona con el Compose
normal y no depende de activar debug. Pruebas de entorno/argumentos y ejecución
real de pnpm db:seed deben pasar antes de marcar T-059.

## 17.17. API pública de contenido (T-060)

Implementar únicamente los GET del contrato, con repositorio inyectable y SQL
estático parametrizado sobre v_public_*. Sin archivos fixture en runtime API.
Builds usan v_public_build_documents; tier list se reconstruye en una sola consulta
con subconsultas JSON de vistas públicas (un único snapshot), catálogos ordenados,
pares normalizados por slug independientemente del orden físico UUID, entradas en
orden editorial y fuentes públicas referenciadas. El mapper usa esquemas derivados
y publicFilter(false): omite estados ocultos/link_only para cuerpos de guía, filtra
entradas ocultas/referencias a builds no públicos y fuentes sin referencia; no
elimina silenciosamente claves privadas inesperadas en DTO de contenido visible.

Pool pg existente, máximo cuatro conexiones y timeouts; configuración api_ro
reutiliza el resolver de readiness. Configuración perezosa conserva /health sin BD.
Exigir nombre api_ro, comprobar rol sin atributos privilegiados y transacción
readonly antes de cada lectura. Solo SELECT de vistas, sin migraciones/escrituras.
Una consulta de control de rol + una de datos, más la sonda de readiness de ruta:
como máximo tres consultas SQL por petición (límite aprobado seis). Cerrar pool
con Fastify; fallos de pool/config/SQL/DTO devuelven 503 constante sin causas.

Slugs validados con esquema canónico antes de E/S; inválido → 400, inexistente o
no público → 404; /slugs ordenado/deduplicado, sin estado editorial serializado.
Rutas comprueban readiness, validan respuesta derivada de dominio y devuelven
objetos JSON directos del contrato, sin wrappers de datos inventados. App factory
sigue sin conectar a BD: server.ts inyecta adaptador y cierra su lifecycle.
Errores no se entregan al logger de Fastify ni incluyen SQL, documentos o trazas.
CORS/rate limits/cabeceras corresponden a T-061, no adelantar ese alcance.

Pruebas antes del código: mappers (guía completa, filtros, claves privadas,
catálogo/enlaces, sin valores falsos), rutas mediante inject (200/400/404/503,
errores redaccionados y métodos sin escritura). Después PostgreSQL aislado con
rol api_ro, seed canónico y contrato compartido T-063; comprobar cada colección,
publicación/retirada, ausencia de campos privados y conteo real de consultas.
Los tests de contrato pueden normalizar recursos privados anidados que representan
la misma fuente global, conservando sus campos públicos y canarios privados;
no relajar prepareSeed ni las reglas productivas para acomodar fixtures de tests.
Mantener alcance de archivos de T-060; sin dependencias nuevas ni migración.

## 17.18. Endurecimiento HTTP local (T-061)

CORS_ORIGINS acepta exclusivamente el literal `http://localhost:4200` aprobado;
no wildcard, CSV con otros orígenes, null ni 127.0.0.1. Sin Origin se permiten
clientes de build/CLI. Preflight solo GET/HEAD/OPTIONS y encabezados Accept y
Content-Type; sin credenciales. Origen rechazado 403 antes de readiness/SQL;
otros métodos 404 constante, sin llegar al repositorio. Vary y cabeceras CORS
solo para el origen exacto, también en errores del cliente aprobado.

Sin dependencias nuevas: hooks nativos Fastify para esta política pequeña.
Cabeceras en toda respuesta: nosniff, DENY, no-referrer, CSP default-src none /
frame-ancestors none / base-uri none, Permissions-Policy sin cámara/micrófono/
geolocalización, CORP same-site, no-store y noindex. Sin HSTS en HTTP local.
Errores y 404 constantes; serializadores de log solo método/ruta registrada y
tipo de error, sin URL cruda/query/headers/body/causas. Mantener redacciones previas.

bodyLimit nativo y chequeo temprano de Content-Length: 16384 bytes por defecto,
configurable API_BODY_LIMIT_BYTES entre 1024 y 65536. GET/HEAD/OPTIONS no aceptan
cuerpo: tamaño excesivo 413, otro cuerpo o transferencia chunked 400; cerrar esa
conexión. Timeouts de conexión/petición 10s, keep-alive 5s. No consumir ni registrar
payloads rechazados. API_RATE_LIMIT 120 solicitudes por minuto/IP por defecto,
rango permitido 1–10000, ventana fija con reloj monotónico; trustProxy false,
ignorar X-Forwarded-For. Map limitado a 1024 IPs, limpieza de expirados y rechazo
de nuevas IPs si se llena; 429 con Retry-After. Incluye solicitudes inválidas y
health/ready, sin tocar BD al exceder el límite. Documentar capacidad/ventana.

Además del alcance original, añadir infra/docker/compose.yaml antes de editar:
pasar explícitamente solo estas variables públicas al servicio API. No env_file
compartido ni cambios de secretos, roles o puertos. Configuración inválida falla
con nombres/códigos sin valores. Tests antes del código: CORS exacto y preflight,
headers en éxito/error, métodos y cuerpos, rate/reset/capacidad/XFF, ausencia de
consultas en rechazos y canarios de URL/error no presentes en logs/respuestas.
Después verificar imagen/HTTP reales y regresión general con PostgreSQL activado.

Escalamiento T-061: typecheck detectó un consumidor con AppConfig de tres campos
en src/config/secrets.spec.ts. Ampliar a ese archivo antes de modificarlo y usar
loadConfig sin quitar comprobaciones de redacción. Corregir tipos de serializer
con FastifyRequest y campos de error constantes; estrechar unknown en handler.
No desactivar strict ni hacer opcionales los límites de seguridad para salvar
el consumidor histórico. Las pruebas HTTP/config ya pasan; repetir tipos y
regresión de redacción después de las correcciones.

### 17.19 T-062: adaptador HTTP exclusivo del prerender

Antes de implementar, ampliar el alcance a api.repository.ts y su prueba Node
api.repository.server.test.mts, content-source.server.ts y su prueba Node,
app.config.server.ts, package.json, apps/api/test/content-fixture.ts,
apps/api/test/content.int.spec.ts y tests/integration/api-content.int.spec.ts.
Todos los paths web parten de src/app/core/content salvo la configuración.
La selección local por defecto es fixture; release exige source api explícita;
rechazar modos/fuentes desconocidos y borradores en API. API_BASE_URL pública
HTTP(S), sin userinfo/query/fragmento; default local `http://127.0.0.1:3000`.
El adaptador usa fetch nativo solo desde configuración server, timeout 5 s,
redirect error, credentials omit y DTO canónico estricto; errores constantes
sin causa ni cuerpo/URL. 404 solo significa null en métodos singulares; otros
estados, JSON inválido y DTO no público hacen fallar la lectura.
Un initializer espera ready y listSlugs aun si home no consume el puerto;
TransferState publica solo source y el flag local includeDrafts. La transferencia
por página pertenece a T-020 y el informe completo de release a T-074.

Escalamiento por archivos fuera del alcance original: no importar web desde
apps/api ni API desde web, tampoco en tests. El orquestador explícito bajo
tests/integration conecta las dos zonas solo en verificación, mediante HTTP TCP
contra imagen API y PostgreSQL en contenedores aislados. Extraer preparación
canónica de fixtures compartida desde T-060 a content-fixture.ts para reutilizar
normalización sin duplicar dominio. No modificar las aristas permitidas de la
guardia. Unitarias primero; contrato público T-063 sin capacidad de drafts,
regresión T-060, guardia, build fixture sin Docker, build API sano y API caída.
Registrar comandos y resultados en quickstart.md antes de marcar la tarea.

### 17.20 T-074: puerta verificable de release

Alcance previo: scripts/check-release.mts y package.json originales; añadir
scripts/build-release.mts, scripts/check-release.test.mts,
scripts/build-release.test.mts, apps/api/src/app.ts y app.spec.ts, server.ts,
apps/api/src/db/migration-state.ts y migration-state.spec.ts; registrar evidencia
en quickstart.md. Escalamiento confirma ausencia de identidad de migración remota.
No cambiar DTO/body de readiness: X-Content-Migration solo tras ready exitosa;
fallo al calcular la huella devuelve 503 saneado, nunca SQL ni hashes individuales.
Receta v1: SHA256(JSON.stringify(array ordenado de hashes SHA256 de SQL UTF-8
originales en orden del journal Drizzle)); scripts validan journal, tags y archivos,
rechazan historial vacío y no importan código API/web. Probar mismo vector conocido.

build:release exige CONTENT_SOURCE=api explícito y no drafts; impone BUILD_MODE
release y entorno público permitido más variables necesarias del sistema operativo.
Rechazar URL con credenciales/query/fragmento, redirects y timeout 5 s. Comparar
ready/header con huella local antes/después de Angular, sin usar header como valor
esperado. Invalidar dist/build-info.json anterior antes de validar o construir;
Angular genera en staging aislado, conserva presupuesto gzip, solo promover tras
validación. Hash de contenido v1 = SHA256(JSON.stringify(pares ruta POSIX/hash
SHA256 de cada archivo público regular en orden lexicográfico)); rechazar symlinks.
Comprobar marcador TransferState api/sin borradores en index.html. builtAt ISO UTC;
check-release valida cuatro campos, fecha, huella esperada, contenido real y API
ready actual. Escribir reporte atómicamente solo al éxito. Pruebas primero para
fuente inválida, API caída/drift/header ausente, build fallido, reporte previo,
archivo alterado y secretos excluidos del entorno hijo. T-084 conserva su test de
centinelas y guardia amplia; T-068 espera páginas/sitemap completos para equivalencia.

### 17.21 T-129: edición editorial local por slug

Contrato previo: `db:edit --kind build|tier-list --slug <slug> --file <JSON>`.
Archivo envolvente estricto con document canónico completo, dependencies opcionales
(authors/sources/masteries/assets canónicos) y createMissingDependencies boolean
false por defecto. El slug/tipo coincide con document; no admite otras builds o
listas ni campos desconocidos. BuildDocumentSchema o TierListSchema y todos los
recursos se validan antes de conectar. Crear dependencias ausentes requiere el
flag explícito y metadatos suficientes; existentes se comparan sin reescribir ni
cambiar origin. Conflicto devuelve código constante, sin valores. Referencias de
listas a builds existentes se resuelven por slug y estados en transacción; no se
exige reimportar documentos ajenos para editar una lista. Targets compartidos
universales no son requisito de esta tarea; no actualizar catálogos por accidente.

Escalamiento por alcance: añadir apps/api/src/db/write-content.mts (mapping
relacional compartido, helpers SQL parametrizados y error/tipos compartidos),
apps/api/src/db/seed.mts y seed.spec.ts, apps/api/test/seed.int.spec.ts,
scripts/editor-content.mts y editor-content.test.mts,
apps/api/drizzle/meta/0004_snapshot.json y quickstart.md a los archivos originales
T-129. seedData conserva transacción, rol fijo importer, bloqueo de bootstrap y
protección atómica de raíces fixture. El writer compartido conserva íntegramente
secciones/IDs/FKs y permite políticas explícitas de raíz/dependencias/parent de
skills, sin decisiones de credenciales. Editor posee su transacción y rol fijo,
actualiza solo el target con origin editor, deja dependencias existentes intactas,
acepta crear las declaradas y revierte todo ante error. No accede mutablemente a
content_origin ni usa DDL/roles/otros secretos. Validación no inventa autor,
revisor ni confirmaciones; estados de publicación provienen del documento.

Migración personalizada nueva 0004 mediante Drizzle, sin editar historial:
DML explícito del editor en tablas editoriales y nada en content_origin/DDL/roles;
reforzar protección posterior al marker bloqueando DML del importer en todas las
tablas de contenido aunque intente cambiar origin o borrar hijos. Sin habilitar
LOGIN desde SQL de migración. Activación local editor por secrets:rotate existente
solo al verificar la CLI; el usuario eligió expresamente CLI con ese rol.
Root launcher usa Docker local sin puerto DB ni entorno compartido; monta solo
archivo de entrada y archivo secreto editor de lectura, límites 256MB/0.5 CPU,
cap_drop/no-new-privileges/read_only; sanitiza salida a contadores/códigos.
Pruebas antes de cambios: validar sin conectar, rechazo pending/sinfuentes/autor
placeholder, rol incorrecto, rollback, todos los campos preservados, dependencias
ajenas intactas/conflictos, edición tras marker e importer sin poder modificarlo,
regresión de seed/contrato/readiness y Drizzle sin diff. No publicar guía pendiente.

T-129 detalle de ejecución local: APP_ENV debe ser development o test explícito,
antes de leer entrada o credencial; no implica publicar la guía ni un despliegue.
El secreto editor se acepta solo mediante DB_PASSWORD_EDITOR_FILE; no contraseña
literal ni secreto de otro rol. La envolvente JSON permite crear dependencias
canónicas completas referenciadas con createMissingDependencies=true; nunca
cambiar las compartidas existentes como efecto lateral del target.
T-129 ajuste de privilegios mínimo tras integración: los triggers existentes son
invoker y leen content_origin. Editor requiere SELECT de ese marcador para poder
actualizar raíces; no recibe INSERT/UPDATE/DELETE/TRUNCATE sobre él. El alcance
sin acceso mutable permanece intacto; la lectura no autoriza cambiar bootstrap.

### 17.22 T-072: bootstrap atómico solo en base vacía

El plan §12.5 exige carga inicial en BD vacía. Rechazar cualquier contenido o
marker existente; no adoptar ni borrar la base editorial local actual. Positivo
real en BD aislada; negativo no destructivo contra la principal. No cambiar
estados ni publicar la guía pending.

Alcance previo ampliado tras escalamiento: apps/api/src/db/bootstrap.mts y su
.spec.ts, apps/api/test/bootstrap.int.spec.ts, scripts/bootstrap-content.mts y
.test.mts, scripts/seed-content.mts y seed-content.test.mts (launcher de importación
compartido con wrappers seed/bootstrap fijos), apps/api/drizzle/0005_bootstrap_permissions.sql,
meta/0005_snapshot.json y meta/_journal.json, ambos package.json,
docs/content/bootstrap.md y quickstart.md. Los paths de migraciones parten de
apps/api/drizzle; no modificar SQL histórico ni el writer compartido.
0005 concede importer solo USAGE drizzle/SELECT journal para verificar historial;
bootstrap usa exclusivamente su credencial importer, sin DDL/otros secretos.

Validar/revalidar SeedData canónico antes de conectar/BEGIN; rechazar material sin
builds ni listas. Payload SHA256 de JSON con claves recursivamente ordenadas y
orden de arrays preservado, sin UUID/reloj generados. Transacción READ COMMITTED,
rol real importer sin privilegios, lock_timeout/statement_timeout locales.
Bloquear content_origin en SHARE ROW EXCLUSIVE y luego las tablas de contenido
en orden estable, derivadas del schema tipado y con nombres internos citados.
Comprobar vacío después de locks, comparar todos los hashes aplicados por orden
con readExpectedHashes, sin número fijo ni expectativa tomada de BD. Escribir
con writeContentRows existente, cambiar las cinco tablas con origin a bootstrap,
insertar marker singleton con hash/fingerprint y fecha actual, y COMMIT. Ninguna
escritura de contenido después del marker; rollback/cierre/errores saneados.

Launcher raíz comparte metadatos públicos/montajes importer de seed, con entrypoint
bootstrap fijo; no puerto DB/env compartido. Pruebas primero: rol, validación
antes de I/O, vacío de todas las tablas, drift, hash estable, locks antes de vacío,
rollback sin marker y concurrencia con seed/editor; bootstrap repetido e importer
DML rechazados después, CLI editor permitida. Verificar migraciones sin diff,
regresión completa, imagen y comando raíz; preservar volumen editorial existente.
T-072 launcher compartido: conservar UID/GID no root del host en Linux para
archivos locales owner-only y limitar también memory-swap a 256 MB. Relatar solo
contadores de éxito o códigos de error de una lista fija; no stderr crudo. Seed
conserva su entrypoint fijo y pruebas históricas.
T-072 consumidor de regresión detectado antes de editarlo: ampliar alcance a
apps/api/test/gates.int.spec.ts. Su fixture aplica SQL de cada migración a mano,
sin crear el journal que Drizzle prepara antes del primer SQL; 0005 falla ahí
con 42P01. Preparar el journal bajo migrator en ese fixture con la estructura
real del motor antes de aplicar SQL; no omitir 0005, no relajar grants ni ejecutar
migraciones como superusuario. Esta corrección conserva la aceptación original
T-073 y las migraciones de producción.

### 17.23 T-084: frontend público sin secretos

Ampliar alcance antes de implementar: scripts/check-public-build.mts y su
.test.mts, scripts/public-build-env.mts, scripts/build-release.mts y su .test.mts,
package.json, scripts/verify-local.mjs y .test.mjs, quickstart.md. Escalamiento
confirma helper compartido con dos modos públicos cerrados: fixture/local y
api/release, ambos sin borradores. runRelease conserva exigencia source api
explícito; comandos locales de desarrollo mantienen INCLUDE_DRAFTS y su etiqueta
fixture, sin convertirse en un release autorizado por esta tarea.

Extraer whitelist existente: solo BASE_URL/API_BASE_URL públicas, CONTENT_SOURCE
y controles fijos del build, además de variables mínimas del sistema operativo.
Nunca NODE_OPTIONS u overrides de ejecutables. Verificar URLs sin userinfo/query/
fragmento. El helper no lee archivos secretos. Guardar API/release como wrapper
compatible publicBuildEnv de T-074 para no cambiar su contrato.

check:public-build genera canarios en memoria C1 (las cinco credenciales DB), C2
CI_TOKEN, C3 DEPLOY_TOKEN, C4 SIGNING_KEY y un secreto con nombre nuevo; no activa
proveedores ni registra secretos reales. Ejecuta Angular real en fixture público
con entorno permitido, salida aislada bajo dist y stdout/stderr del hijo descartados.
Incluir en los valores vigilados cualquier variable sensible del entorno y referencias
_FILE privadas; no leer credenciales ni imprimir nombres/rutas/valores contaminados.
Escanear nombres relativos y bytes de todos los archivos, incluidos binarios/maps,
server/stats y build-info existente; sin exclusiones por extensión. Buscar valores
raw y representaciones JSON/URL/base64/UTF16 y patrones existentes mediante
check-secrets con nombre sintético neutro, para no heredar exclusiones de paths.
Errores solo códigos/contadores; ilegibles/symlinks/artefacto vacío fallan cerrado.

Integrar la misma guardia en runRelease sobre staging completo y JSON del reporte
antes de promoverlo, conservando readiness/identidad/gzip/reporte atómico. Evitar
ciclos de imports: scanner/helper no importan runRelease. verify añade el comando
offline tras build. Pruebas primero: bundle/filename/binario/build-info con canario,
patrón secreto sintético, desconocidos excluidos, symlink, limpieza aislada y
rechazo del release contaminado sin informe válido. Después build Angular real
offline y release real con canarios (API local), regresión y guardia de repo.
T-084 alcance del artefacto: comprobar también todo dist existente además del
output nuevo, para que archivos residuales fuera de browser/report no queden
sin analizar. La salida nueva debe contener archivos por sí misma; contenido
viejo no acredita éxito de un build vacío. No borrar archivos ajenos/residuales:
un hallazgo bloquea y se informa solo código. La limpieza del output propio
mantiene redacción si falla.

### 17.24 T-083: Gitleaks local, hook real y escaneos sin omisiones

El hook/config/CI/workflow histórico/tests ya existían antes de retomar esta tarea;
no hay evidencia de su rojo original ni validación CLI local. Conservar esa
procedencia y verificar comportamiento real ahora. Scope ampliado tras escalamiento:
.githooks/pre-commit, .gitleaks.toml, ambos workflows ci.yml/secret-scan.yml,
scripts/secret-scan.test.mts, scripts/setup-gitleaks.mts y .test.mts, package.json,
.gitignore, .gitattributes, CONTRIBUTING.md, tooling-provenance.md y quickstart.md.
La adición de gitattributes cubre el hook sin extensión, hoy w/crlf: fijar LF y
modo ejecutable del hook. Tras verificar, staging solo de ese archivo con chmod
+x es reversible; no commit/push/PR hasta cerrar toda la spec según usuario.

Instalación dev local en /.tools/gitleaks/8.30.1/ ignorada exactamente, Windows/Linux
x64. Descargar solo asset HTTPS oficial fijado; verificar SHA256 antes de extraer
un único binario plano/ejecutarlo, comprobar versión exacta y promover atómicamente.
Rechazar plataforma/rutas/symlinks no soportados y limpieza fuera del directorio
propio. No PATH global ni dependencias JS/productivas nuevas. Metadata oficial
verificada 2026-11-09/10: Windows zip SHA256
d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e;
Linux x64 tar.gz SHA256
551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb.
Misma versión que CI; no actualizar versión silenciosamente.

Hook resuelve binario nativo local primero y PATH después; ambos versión exacta.
Falta/error/versión incorrecta bloquean con setup:gitleaks, nunca no-verify. Tests
usan mismo orden/binarios absolutos, hooks mediante Git real (Git for Windows no
expone sh al PATH del host) y fixtures temporales con .tools ignorado. La prueba
de disponibilidad se ejecuta siempre, sin omisión local; setup:gitleaks es requisito
previo a verify, CI conserva su instalación SHA verificada. Detección staged,
commit/rango PR/historia, casos limpios y redacción con secretos sintéticos solo
en TEMP. Guardar salidas/informes siempre --redact; cleanup Windows valida parent
absoluto/prefijo antes de borrar repos de prueba. Activar setup:hooks en este clon
solo después de pruebas y confirmar core.hooksPath (actualmente sin valor).

Escanear historia real y snapshot temporal de todos los archivos tracked/untracked
no ignorados; no leer/copiar .env/archivos secretos ignorados ni binarios instalados.
No allowlist amplia: hallazgos se corrigen o se registra bloqueo real. Escaneo no
publica datos ni envía mensajes; no reclamar que workflows remotos ejecutaron aún.

### 17.25 T-048: iconografía propia y descriptor público

Scope previo: `src/assets/icons/*.svg` y `src/app/shared/ui/icon/*`; ampliar antes de
implementar a angular.json (assets y configuración icon-preview aislada),
package.json (prueba Node del resolver server) y quickstart.md. En carpeta icon:
registry.ts, resolve-icon.server.ts/.test.mts, icon.ts/.spec.ts, preview.component.ts,
preview.browser.ts, preview.server.ts y fixtures/approved-preview.svg. No modificar
app.routes ni agregar diagnóstico a rutas de producción. Preview tiene entradas
browser/server propias, SSR/SSG e hidratación; output dist/icon-preview separado.

Mundo visual heredado: dark soot/panel, bone/storm/ember existentes, geometría
nítida con trazo consistente; 10 maestrías, 11 daños, 6 estados y 2 genéricos.
SVG autoría propia, 24x24 viewBox, sin scripts/filtros/animación/arte copiado.
Como img externo no hereda currentColor, hornear únicamente bone aprobado del
token existente (y storm para el fixture propio), sin inventar paleta. Componente
reserva 24/32 CSS px desde space-5/space-6, width/height intrínsecos y object-fit
contain; error cambia a fallback sin mover caja. No es un control interactivo:
no tab stop ni hover/disabled/loading artificiales; estado vacío usa generic.
Label explícita produce role img/aria-label; sin label es decorativo aria-hidden.
Nombres/contenido de preview en español, i18n para su copy de interfaz.

Resolver server usa AssetSchema completo: absent/pending/rejected -> SVG local;
approved incompleto/path inseguro -> error constante sin causa/valores. Solo
public/assets/official rutas locales normalizadas sin traversal/query/hash/URL ni
backslash; src público assets/official sin prefijo public. No usar fallback_svg
arbitrario del documento: registro propio finito. Descriptor serializable solo
{id,src,fallbackSrc}; proof_ref/firmantes/evidencia nunca inputs/HTML/browser.
Cliente valida descriptor/path y nunca importa AssetSchema/Zod ni resolver server.
Approved de prueba es SVG propio copiado únicamente por icon-preview, no al
manifiesto ni al output normal. Real release actual usa fallback; la entrega de
metadatos aprobados desde API debe completarse/verificarse junto a los resolvers
T-020 antes de cerrar integración FR-16, no se acredita por el test aislado.

Pruebas antes de código: todos IDs/paths, gate pending/approved/incompleto,
rutas hostiles/desconocidos, descriptor sin evidencia, semántica y tamaños,
fallo imagen y cambio de source, sin foco. Luego preview real SSR/no-JS/JS,
375/768/1280, axe, overflow, dimensiones antes/después de carga/error, detector
Impeccable y revisión visual propia. No crítica dual formal ni resultados fingidos.
Build normal/release y stats prueban ausencia de preview/fixture/Zod en cliente;
conservar gzip. Config preview no incorpora credenciales ni datos editoriales.

### 17.26 T-024: componentes de catálogo y filtros

Antes de código: alcance src/app/features/tier-list/**, angular.json (tier-preview
aislado) y quickstart.md (evidencia); ampliación revisada por sdd-escalation.
Archivos: tier-components.ts/.css/.spec.ts, tier-preview.component.ts,
tier-preview.browser.ts, tier-preview.server.ts. Reutilizar Icon/T-048 y tokens
existentes; modo Operate/Read dentro del mundo visual aprobado, sin identidad nueva.
Sin rutas de producto, repositorios, fetch, URL de filtros ni nuevos paquetes;
integración de página queda T-025 y metadatos aprobados API queda T-020.

Componentes OnPush controlados: ContentBadge (texto + icono), TierCard (entry,
combinación y guía pública opcional), TierRow (heading y contenido proyectado),
ExternalAttribution (metadata pública), FilterChip (botón aria-pressed), FilterBar
(grupos fieldset/legend, búsqueda label, reset, output inmutable), EmptyState.
TierCard solo enlaza guía validada pública cuyo slug coincide; placeholder no
tiene enlace ni ranking inventado; link-only no recibe cuerpo/imagen de guía,
conserva autor/fuente/licencia y aviso visible. Enlaces externos solo HTTP(S),
sin credenciales y con noopener/noreferrer si abren otra pestaña; URL inválida
queda texto. No usar innerHTML. Tipos dominio import type, sin Zod en cliente.

Estados: selección textual y aria, foco/hover/active, disabled nativo; sin loading
ficticio porque catálogo está en HTML. Empty con reset; error de página queda
T-020. Controles mínimo 32px desktop y 48px móvil con space-6/space-7; target ≥24.
Filtrado controlado emite estado nuevo sin mutar props; no anuncia conteos que no
conoce. Etiquetas UI i18n y nombres de contenido provienen de datos.

Pruebas Angular antes de implementación: placeholder, enlace guía pública y
ocultación pendiente, link-only y URL insegura, badge, selección/disabled/reset,
inputs inmutables. Preview sintético propio explícitamente diagnóstico en
dist/tier-preview, con bootstrap SSR/hidratación propios. Verificar JS/no-JS,
teclado, axe, overflow y targets en 375/768/1280, detector y polish visual propios;
sin afirmar crítica dual formal. Build de producción excluye preview/fixtures,
preserva presupuesto inicial. Marcar tarea solo tras evidencia completa.

### 17.27 T-025: página real del catálogo

Alcance previo a implementación, revisado por sdd-escalation: carpeta tier-list
(tier-list.page.ts/.html/.css/.spec.ts, catalog.model.ts/.spec.ts y catalog.test-data.ts,
tier-components.ts/.spec.ts para metadatos de tarjeta); core/content/catalog.server.ts/
.test.mts y catalog.resolver.ts/.spec.ts; app.routes.ts, app.config.server.ts,
package.json (pruebas Node) y quickstart.md. Solo registrar ruta lazy /tier-list;
T-020 conserva rutas de guías/autores/404, getPrerenderParams y gate de activos API.

El initializer server prepara una vez por documento un snapshot público mínimo:
getTierList(principal) y listBuilds en paralelo desde repositorio seleccionado.
Proyectar explícitamente datos de catálogo, enlaces/resumen de guía y atribución;
sin cuerpos de guías, activos, firmantes ni evidencia privada. Revalidar DTOs y
publicación/derechos antes de proyectar, aun en fixture INCLUDE_DRAFTS=true.
Errores y catálogo principal ausente hacen fallar build sin fallback silencioso.
TransferState conserva snapshot en todos los documentos para RouterLink desde home
y atrás/adelante sin API browser; medir HTML de home y catálogo ≤120000 bytes.
Resolver consume ese estado, no usa fetch ni importa Zod en cliente.

Modelo puro agrega combinaciones sin entrada pública como placeholders sin daño,
estilo, tier ni fecha inventados; omitir placeholder si existe entrada pública de
esa combinación. Catálogo ordenado S/A/B/C/D/Sin clasificar y nombre estable.
Filtros controlados T-023/T-024: seis grupos, AND entre grupos/OR dentro, contador,
estado vacío/reset. SSR/primer render muestran lista completa; query se aplica
tras hidratación, sincronizada con router/queryParamMap. Selección/reset hacen
push para historial; texto continuo/normalización usan replaceUrl. Reload y
atrás/adelante conservan selección sin red de contenido. Canonical siempre base
/tier-list; ItemList solo entradas públicas con URLs reales de guías/enlaces,
placeholders como Thing sin fingir guía ni ranking. Fechas conocidas se muestran
como fechas; ausentes «Revisión no informada»; versión real de guía o catálogo.

Pruebas antes de código: servidor con fixtures reales y publicación sintética
propia temporal, canarios privados ausentes, source API sin fallback; modelo de
combinaciones/múltiples builds/filtros/orden; resolver y página con router real,
SEO/JSON-LD y filtros URL/historial. Verificar aplicación real fixture y API,
desde home y directamente, JS/no-JS375/768/1280/axe, presupuesto Home90k/tier110k
gzip, HTML120k, sin requests API browser. Publicación de guía original sigue
bloqueada. Enlaces de guías públicas se verifican integralmente al completar
T-020/T-037; mantener T-025 abierta si esa aceptación aún no puede acreditarse.

La primera medición con loadChildren añadió código de soporte de módulos al
bootstrap y superó90k gzip. Registrar la página con loadComponent, igual que home,
y resolver pequeño síncrono desde TransferState; eliminar wrapper de rutas hijo.
No elevar presupuesto para acomodar el cambio; volver a medir el artefacto real.

Medición posterior: loadComponent por sí solo no resolvió el JS (94841 bytes);
HTML del catálogo134542 por snapshot con datos derivados duplicados. Transferir
CatalogInput público validado y construir CatalogSnapshot en resolver lazy reduce
la duplicación manteniendo todas las entradas y metadatos. No subir presupuestos
ni retirar requisitos funcionales; mantener gate pendiente si excede aún.

Segunda alternativa de JS dentro del mismo alcance: esperar ApplicationRef.whenStable
solo en browser en vez de registrar afterNextRender, manteniendo primer render
SSR completo y subscripción destruible. Comparar medición real y restaurar si no
mejora; no aceptar cambio de semántica de filtros/hidratación para ahorrar bytes.

La alternativa whenStable no resolvió el límite y se restauró afterNextRender.
Polish dentro de tokens: título de catálogo usa text-heading también desktop
(no hero de portada); evitar repetir nombre de combinación si ya es el título
de la tarjeta. Browser/API conserva45 entradas públicas, filtros y navegación.
Medición final API: Home95098/90000 gzip, tier102995/110000; HTML30750/103647
respectivamente, ambos≤120000. T-025 permanece abierta por rendimiento Home y
enlaces de guía pendientes T-020/T-037; no elevar límite ni afirmar release verde.

### 17.28 T-133: entrega estática de portada, hidratación donde hay interacción

Decisión previa a código: FR-10a preserva funciones/SEO y presupuestos. La portada
T-038 solo tendrá texto, imágenes y enlaces nativos; su HTML Angular SSG no necesita
arrancar cliente. Catálogo y guías siguen hidratados con replay. Dev ng serve puede
hidratar todas las rutas; el pipeline público aplica esta política explícita.
Una segunda opinión Terra, limitada a los extractos suministrados (sin lectura
independiente del árbol), la consideró compatible si hay guardas y prueba browser;
no prueba que optimizar Angular de otra forma sea imposible. Sustituye para Home
la obligación de bootstrap de §17.10; los límites90/110/150/40 no cambian.

Archivos: scripts/static-home.mts/.test.mts, scripts/fixtures/static-home.html,
scripts/check-initial-js.mts/.test.mts, scripts/build-release.mts/.test.mts,
scripts/check-public-build.mts, package.json, CONTRIBUTING.md y quickstart.md.
Sin editar UI, dependencias, fuente editorial ni configuración global. Parser HTML
oficial @angular/compiler ya instalado, solo dev/scripts; no regex sobre contenido
editorial ni nueva librería. Rechazar parseo ambiguo, controles JS (button/input/
canvas/media/form/roles interactivos), handlers inline, custom elements ajenos a
shell/Home y enlaces sin href real. Exigir app-home-page, un main/h1 y metadata.
Dejar cualquier futura interacción Home como fallo que exige nueva planificación.

Finalizador modifica solo browser/index.html de output regular sin symlinks;
quita módulos bootstrap/preloads de script, conserva contenido/estilos/SEO/JSON-LD
y marcador público gd-content-source mínimo (sin snapshot innecesario). No aceptar
inline ejecutable desconocido, scripts remotos ni tipos ambiguos. Añadir marcador
static-home verificado por parser; idempotencia comprobada. Otros HTML intactos.
No permitir que el marcador excuse script faltante en ruta interactiva.

Checker conserva ruta hidratada legacy, pruebas de gzip real y fallos de metadatos;
Home sin scripts solo vale con marcador + estructura estática válida. Medir cero
solo cuando no puede solicitar JS, incluyendo modulepreload/inline/events. Extender
medición actual a tier-list110000 al estar prerenderizada, recorriendo entry e
imports estáticos reales. Ficheros ausentes y rutas interactivas sin bootstrap
fallan; extensión al resto/CSS/HTML/Lighthouse permanece T-042/T-126.

Pipeline: pnpm build finaliza antes de medir. Release escanea staging ANTES de
transformar para no ocultar secretos, finaliza, mide, hashea bytes definitivos y
conserva probes API/reporte atómico/fallos cerrados. Guard público real escanea
output previo y posterior con canarios; inyección de build en tests sigue siendo
doble aislado, sin afirmar que procesa Angular real. No usar marcador static-home
para sustituir prueba API requerida por release. No tocar archivos fuera de output.

Pruebas primero: HTML canónico mantiene copy/SEO/enlaces/datos fuente; controles,
handlers, scripts externos/inline, markup malformado, marcador falsificado y
Home estático en tier fallan. FS symlink/archivo ajeno, idempotencia; wrappers y
hash posteriores a transformación. Browser real375/768/1280: Home sin requests JS
con scripting activo y desactivado; navegación nativa al catálogo, controles allí
hidratados/URL/replay, axe/foco/skiplink, métricas y paridad de texto/SEO. Release
API y guard canarios, lint/tests/build. Solo entonces T-133[x]; T-025 sigue abierta
por integración de guías. Revisión4pases solo al cierre completo de spec.

Hallazgo del primer build real: Angular critical-CSS genera link stylesheet
media=print onload="this.media='all'". Convertir únicamente ese patrón exacto a
media=all sin handler, conservando href/atributos y CSS inline; no aceptar otros
onload. Así CSS también funciona con scripting activo sin código de activación.

Ampliación previa a código de configuración: src/app/app.config.ts añade
withI18nSupport junto a withEventReplay. La prueba browser roja detectó2 componentes
ngSkipHydration,0 jsaction y ausencia de _ejsas en catálogo; botones SSR se
desprendían al retener el chunk lazy, por lo que la configuración anterior no
acreditaba replay real. API instalada Angular21.2 expone soporte oficial i18n.
Escalamiento T-133 solicitado una vez por alcance; no produjo revisión por límite
de uso. El agente principal registra esta ampliación necesaria para el contrato
ya aprobado; no se la atribuye a un revisor ni sustituye el modelo auxiliar.
Validación funcional en navegador antes/después, no test que copie providers.
Volver a medir JS/HTML. Si Home recibe el bootstrap de captura estándar Angular,
su finalizador puede retirar solo el script identificado ng-event-dispatch-contract
y el inicializador Angular correspondiente con identificación exacta, conservando
rechazo de cualquier inline desconocido. Documentar/evaluar dicho formato antes
de ampliar su aceptación; catálogo/guías conservan toda la captura/hidratación.

Formato observado tras withI18nSupport: contrato inline id ng-event-dispatch-contract
coincide byte a byte (trim) con el export oficial instalado
@angular/core/event-dispatch-contract.min.js (SHA256 actual86a5d41c86600f3aa2b20da02e4747cb5c862b3e7d59fc6832f24db9e984e1cb),
seguido de window.__jsaction_bootstrap(document.body,"ng",["click"],[]).
Home puede retirar exclusivamente ese contenido verificado y llamada literal
con appId seguro/evento click/capture vacío; ids o código distintos fallan. Las
rutas interactivas conservan ambos y la medición suma también gzip de scripts
inline ejecutables, sin contar JSON-LD/TransferState como JavaScript.

La hidratación i18n real expuso TypeError hasAttribute en el p de noscript dentro
del template del catálogo: browser con scripting representa su contenido como
texto, distinto al árbol SSR. Añadir antes de corregir a alcance
src/app/features/tier-list/tier-list.page.html: aviso estático normal, veraz con
y sin JS, sin noscript dentro del componente hidratado. La captura de console.error
es obligatoria en prueba browser: el ErrorHandler de Angular puede registrar el
fallo sin emitir pageerror. No afirmar que recuento de tarjetas equivale a hidratación.

El cierre T-133 actualiza además blockers.md como registro de resolución de la
puerta Home; no cierra T-025 ni sus requisitos de navegación a guías pendientes.

### 17.29 T-038: portada editorial mínima y social propio

Alcance previo a código confirmado por sdd-escalation: home.page.ts/.html/.css/
.spec.ts, featured-guide.ts/.spec.ts en features/home; public/og/site.svg/.png;
core/seo/seo.service.ts/.spec.ts y quickstart.md. Default social global requiere
ampliar ambos archivos SEO, no solo pasar una imagen desde Home. Sin nuevas
dependencias/proveedores/rutas ni datos privados, sin tocar el manifiesto oficial.

Portada OnPush consume CatalogInput público existente de TransferState; falta de
snapshot falla explícitamente. No fetch/API browser. Selector puro toma guías
publicadas con derechos own_original/licensed/permission_granted, slug y fecha
válidos; excluye pending/link_only, orden fecha descendente+slug y no muta input.
Renderiza solo título/slug/versión/fecha. Estado real inicial sin publicaciones
ofrece CTA al catálogo, no finge guía o ranking. Caso propio sintético prueba
selección/render; navegación de guía integral espera T-020/T-037.

Mundo visual heredado soot/panel, bone/storm/ember, Oswald/Karla, geometría nítida.
Extensión precisa de portada ya especificada, sin otra identidad ni torneo de
conceptos. Hero tipográfico legible y CTA nativo /tier-list; ancla #criterios;
sección de publicación reciente o vacío honesto y criterios editoriales en dl.
Enlaces nativos, foco/touch y copy i18n. Sin controles JS ni animación necesaria,
sin crear loading/error ficticio; fallo de datos aborta build. Conserva FR-10a y
guard estático T-133. No nuevas afirmaciones sobre derechos de la guía pendiente.

SVG social propio1200×630 con paleta y tipografías existentes, composición de
nombre/catálogo/estados y geometría original, sin arte del juego. PNG exportado
en Chromium desde SVG tras cargar fuentes locales; comprobar dimensiones y
legibilidad. Canonical SVG conservado; recipe/evidencia en quickstart. Default
SeoService /og/site.png, alt,1200×630 y summary_large_image para todas las páginas;
overrides válidos se mantienen y vuelven al default al navegar sin override.
BASE_URL con prefijo sigue respetándose; sin etiquetas duplicadas ni datos privados.

Pruebas antes de código: selección derechos/fecha/desempate/inmutabilidad, estado
sin guía y positivo sintético, snapshot ausente, SEO override→default. Después
browser375/768/1280 JS/no-JS/axe/foco/anclas/enlace al catálogo; OG GET200 y tamaño,
Home0JS y catálogo hidratado. Cinco muestras LCP de caché fría en Chromium móvil
con CDP slow4G (150ms,1.6Mbps down,750kbps up) y CPU4x, viewport375×812/DPR1;
registrar entorno/valores frente a≤2s. No atribuir score Lighthouse global/T-126.
HTML≤120000 y gzip Home90000/tier110000, verify/release API y scanner completos.
Detector Impeccable y audit/polish propios, sin crítica dual formal; máximo3pasadas
visuales por pantalla. Marcar T-038 solo tras evidencia de su alcance.

### 17.30 T-039: perfiles públicos y páginas de confianza

Ampliación confirmada por sdd-escalation antes de código: `features/author/*` y
`features/static-pages/*`; app.routes.ts, app.routes.server.ts, app.config.server.ts;
core/content/catalog.server.ts (extraer documentos/proyección sin cambiar wrapper
loadCatalogData), core/content/author-pages.server.ts/.test.mts; package.json y
quickstart.md. No cambios al contrato canónico/API/SQL ni dependencias nuevas.
La página legal usa el **canal de contacto decidido el 2026-11-10**: GitHub Issues
del repositorio (`https://github.com/frxncismor/grim-dawn-builds/issues`), para
retiradas y contacto general. No inventar correo, responsable, servicio ni SLA.
Ese canal desbloquea `/legal` y `T-102`. Autor/acerca ya existen y verifican;
`T-039` se cierra con la página legal y el enlace del pie.

loadPublicSiteData comparte lecturas públicas tier/builds ya existentes; deriva
perfiles desde PublicBuild.author y resuelve solo propietario de tier restante
con≤1 getAuthor, sin N+1. Rechazar placeholders antes de proyectar, perfiles
contradictorios/URL con credenciales, faltante de propietario y errores sanitizados.
Snapshot mínimo: profile público (slug/display_name/bio/url), guideSlugs y
ownsCatalog. Reutilizar metadata de guías en CATALOG_STATE; sin cuerpo, evidencia,
notas ni flags privados. CatalogInput permanece sin cambios. Wrapper anterior
mantiene sus2lecturas; loader nuevo registra2o3peticiones constantes, sin afirmar
que ese conteo equivale a SQL total (T-128 conserva presupuestos medidos de API).

Provider server de loader devuelve promesa memoizada por contexto SSR, nunca
caché global entre fuente/modo. Initializer y getPrerenderParams comparten esa
promesa. AUTHORS_STATE y CATALOG_STATE quedan en cada documento para navegación
SPA sin API browser. /autores/:slug prerender solo slugs de perfiles públicos,
fallbackNone. Resolver cliente combina snapshot+slugs; ausente falla, desconocido
renderiza no-encontrado/noindex; no afirmar que estado cliente es HTTP404. Status
SSR puede fijarse con RESPONSE_INIT opcional; HTTP404 global permanece T-020.

Perfil: nombre/bio reales, sitio externo seguro si existe, guías publicadas con
título/versión/fecha y enlace al catálogo si lo administra; vacío honesto. About:
propósito, estados, criterios, derechos/no scraping, no afiliación y responsable
real del catálogo enlazado. Legal: derechos, atribución, fuentes/activos, canal de
retirada real y privacidad de funciones actuales; no afirmar ausencia de logs del
hosting aún no definido. Sin texto legal inventado ni datos personales supuestos.
SEO ProfilePage/WebPage con default social propio; no adivinar Person/Organization
del esquema Author sin tipo. Datos como texto, sin innerHTML. Tokens existentes,
tipografía editorial legible, enlaces nativos/foco/3anchos; sin interacción JS nueva.

Pruebas antes de código: fixture drafts no expone autor privado; lecturas2+≤1;
reutilización de perfiles/conflictos/placeholders/URL hostil, snapshot sin cuerpos;
resolver/página/SEO/vacío/enlaces y estados desconocidos. Build real comprueba
parámetros/prerender; browser JS/no-JS375/768/1280/axe/teclado/navegación sin red;
fuente API y canarios/gzip/HTML. T-039 sigue abierta hasta completar legal y canal,
sin usar existencia de archivos para cerrar integración aún pendiente.

### 17.31 T-134: skip link en rutas internas

Dependencia descubierta en prueba browser T-039: href=#main junto a base href=/
lleva a Home desde /acerca o /autores, destruyendo contexto en vez de enfocar main.
Suspender cierre T-039 y corregir solo layout.ts/.html/.spec.ts y quickstart.
Resolver ruta completa sin fragmento anterior mediante Location.prepareExternalUrl;
signal actualizada en cada NavigationEnd, incluidos cambios de query en misma ruta.
Href nativo conserva destino en SSR/no-JS; usar baseHref de Angular sin inventar URL.
No handler JS ni cambio de estilos. Host estático puede redirigir URL canónica a
su variante con slash: comprobar foco después de esa navegación, sin confundir
redirect del servidor de prueba con fallo de aplicación. Estado JS conserva query;
SSR estático no conoce query futura de una solicitud, catálogo no-JS sigue completo.
Pruebas primero: href Home, ruta interna+query y sustitución de fragmento; después
browser JS/no-JS3anchos main enfocado, sin volver a Home. No screenshots nuevos si
solo cambian hrefs invisibles. Presupuestos/gates vigentes se repiten al cerrar.

### 17.32 T-028: árbol de habilidades controlado y verificable

Planificación previa de la tarea existente, sin ampliar la guía ni sus rutas.
Depende de T-027 (layout y navegación), T-017 (tokens) y T-048 (fallbacks propios).
Archivos exactos: src/app/shared/svg/skill-tree/skill-tree.ts, skill-tree.html,
skill-tree.css, skill-tree.spec.ts, preview.component.ts, preview.browser.ts y
preview.server.ts; angular.json solo para configuración skill-tree-preview y
quickstart.md solo para evidencia. Los siete archivos indicados viven bajo
src/app/shared/svg/skill-tree/. Sin paquetes nuevos ni cambios de dominio,
repositorios, rutas de producto, fuentes, límites de rendimiento o arte oficial.
T-029 conserva devociones, T-032 conecta el stepper/progreso; T-020/T-037 integran
la guía. No extraer ahora gd-graph genérico de §4: el renderizador específico usa
las utilidades existentes; una extracción se evaluará al implementar T-029.

Componente standalone OnPush con entradas inmutables: mastery derivada de
`PublicBuild['masteries'][number]`, nodes de `PublicBuild['skill_nodes'][number]`,
activeIds readonly y currentBar opcional (entero no negativo cuando conocido).
Importar tipos con import type; no cargar esquemas Zod en navegador. Cada árbol
filtra por mastery_slug; no mezcla nodos ni IDs DOM con otra maestría/instancia.
Mantener selección local de detalle separada del resaltado externo activeIds;
no mutar entradas, inferir barra por paso, calcular puntos ni persistir progreso.
Nombres ES/EN, estado, tag, rationale, bar_required y etiquetas/puntos conocidos
proceden del DTO, sin completar null con números. Copy de interfaz mediante
i18n/$localize de Angular. Aviso visible de esquema editorial, no simulación
del juego (spec A5/A6); los datos de diagnóstico se identifican como sintéticos.

Adaptar slug/parent_slug a GraphNode para layoutForest; el índice del array
canónico fija order, pues SkillNodeSchema no tiene display_order. Reutilizar
aristas y orden lógico deterministas y createKeyboardNav sin cambiar esos módulos.
El dominio exige layout{x,y}: respetar sus posiciones relativas en SVG y calcular
viewBox/márgenes para etiquetas y targets; no inventar variantes compact/wide ni
sobrescribir coordenadas editoriales con el fallback lógico. Scroll interno nativo
si hace falta para conservar targets ≥24px efectivos tras escalado, recomendado
44px móvil; nunca desbordar la página ni añadir zoom/pan propio. Máximo120 nodos,
sin blur ni animación continua; actualización de activeIds ≤16ms (humo), SVG
propio ≤8kB gzip y presupuesto diferido combinado ≤40kB según §4/§6. La integración
diferida real en ruta/SSR queda T-037; el preview comprueba SVG base sin @defer.

Estados recomendada/meta/omitir con forma/patrón y texto, más barra N visible,
aristas padre→hijo, etiqueta transmutador cuando exista y glifos propios. Omitir
es recomendación editorial, permite consultar detalle. currentBar ausente no
presenta bloqueo; si es menor que bar_required muestra advertencia textual de
barra insuficiente, sin impedir leer/seleccionar el nodo. Hover y focus-visible
tienen señal visible; seleccionado y paso activo se distinguen con texto/aria,
sin depender solo de color. Transición ≤200ms, ninguna con reduced-motion.
Sin loading ficticio ni estado disabled que impida leer consejo. Array vacío
muestra mensaje honesto; datos con IDs/padres/ciclos inválidos muestran error
local accesible y lista textual disponible, sin lanzar excepción de SSR ni
corregir el dato silenciosamente. Validación completa de contenido sigue en build.

SVG con title/desc y semántica de grupo que conserva botones de nodos accesibles
(evitar role=img que oculte hijos interactivos). Un tabstop itinerante por árbol;
flechas/Home/End usan el resolvedor existente, no cambian selección; Enter/Espacio
o click/touch abren detalle. Esc cierra/deselecciona y restituye foco al nodo de
origen; cierre con botón HTML equivalente. Panel HTML no modal con ES/EN, barra,
tag/justificación y anuncio polite; hover no roba foco ni exige tooltip para leer.
Lista HTML equivalente en details/summary nativo, abierta por defecto y presente
en HTML SSR; orden y textos iguales, incluidos todos los detalles sin JS.
Puede plegarse nativamente; no depender de un botón JS para acceder a ella.
Evitar duplicar controles de nodos en la lista; SVG ofrece la interacción, lista
ofrece lectura. Foco ≥2px/contraste ≥3:1, texto ≥4.5:1 y asociaciones aria únicas.

Pruebas Angular primero en skill-tree.spec.ts: snapshot estructural determinista
de SVG/aristas/estados con fixture propia mínima; nombres largos ES/EN, propiedades
congeladas, coordenadas suministradas, dos maestrías y dos instancias con IDs sin
colisión; currentBar ausente/insuficiente/suficiente, activeIds externos sin
selección implícita; teclado completo, click/cierre/foco, lista equivalente,
vacío y error sin caída. Añadir humo120 nodos/actualización sin repetir pruebas
internas de layout ya cubiertas. Después ejecutar pnpm test y pnpm lint y registrar
resultado real, sin atribuir a JSDOM medidas de foco/targets o render de Chromium.

Preview igual al patrón T-024/T-048: entradas browser/server propias, hidratación
con replay, SSR/SSG y output dist/skill-tree-preview separados, datos propios
sintéticos mínimos en preview.component.ts, nunca guía pending ni fixture editorial.
Configuración angular.json skill-tree-preview; build con
pnpm exec ng build --configuration skill-tree-preview. Browser real375/768/1280:
inspeccionar SVG/lista/detalle, targets efectivos, overflow, hover/touch/teclado,
foco y reduced-motion, incluyendo pasos sintéticos que cambian activeIds sin
implementar purchase-stepper. Comprobar HTML sin JS estricto aparte; axe sobre
app hidratada y sobre HTML con bundles de app bloqueados, sin afirmar axe con
scripting global desactivado. Registrar capturas/reportes y revisión Impeccable
en quickstart; cerrar servidor/navegador y limpiar solo output preview comprobado.
pnpm build/check:initial-js y stats deben conservar presupuestos públicos actuales
y excluir preview, datos sintéticos y Zod del cliente. T-028 solo se marca tras
evidencia; no acredita páginas de guía, stepper, lector humano global o cierre
de spec001, que conserva su puerta de cuatro revisiones pendiente.

### 17.33 T-029: mapa de devociones desde información documentada

Plan previo de la tarea existente. Archivos exactos bajo
src/app/shared/svg/devotion-map/: devotion-map.ts, devotion-map.html,
devotion-map.css, devotion-map.spec.ts, preview.component.ts, preview.browser.ts
y preview.server.ts; angular.json solo para devotion-map-preview y quickstart.md
solo para evidencia. Reutilizar tokens, SVG/glifos propios y patrón accesible de
T-028; createKeyboardNav existente recibe el orden plano de grupos para resolver
navegación. No extraer gd-graph: los grupos de constelaciones y sus edges internos
no son el bosque padre/hijo de habilidades. Sin necesidad demostrada de módulo
común nuevo, no modificar T-028 ni utilidades. T-030 conserva su e2e compartido,
T-033 implementa stepper y T-020/T-037 rutas/ensamblado; sin backend, persistencia,
derechos ni dependencias nuevas. T-039 permanece pendiente de contacto real.

El canon usa constellations/devotion_steps, no devotion_nodes/devotion_route.
Componente standalone OnPush con mapId requerido y entradas readonly derivadas
mediante import type de `PublicBuild['constellations'][number]`,
`PublicBuild['devotion_steps'][number]` y `PublicBuild['skill_nodes'][number]`;
activeStepPosition opcional identifica un paso sin mutar ni avanzar la ruta.
Selección local del detalle separada del paso activo externo. Conservar position,
label, title_override, body, accent, kind y verification; UI i18n/$localize.
Nombre ES null conserva el nombre EN identificado como tal, sin traducción
inventada; tier_level null y afinidades null muestran «Sin datos», nunca cero.
Mapas vacíos explícitos se distinguen de null; claves/cifras de afinidad se
muestran tal cual, sin asumir nombres o colores que el contrato no documenta.

§4/T-029 «aristas de afinidad» se concreta como umbral documentado→constelación,
con etiqueta de requisito (clave y cantidad). No existe relación canónica entre
constelaciones proveedoras y receptoras: ni affinity_granted ni el orden de pasos
acreditan causalidad o un proveedor exclusivo. No dibujar esas dependencias,
sumar afinidades, calcular viabilidad ni construir una calculadora. Requisitos
null no producen umbrales/aristas; otorgada se expone como información separada.
IDs de umbral incluyen mapId+constellation.slug+clave, aunque la misma clave
aparezca en varios grupos. Este alcance representa fielmente datos disponibles,
no completa afinidades desconocidas ni acredita dependencias ausentes.

Un grupo interactivo por constelación, orden editorial estable según su array;
distribución esquemática por grupos, sin afirmar posición real del juego. Dentro
de cada grupo respetar diferencias x/y de layout.nodes y dibujar exclusivamente
layout.edges registrados. Esos edges pueden cerrar figuras: no pasar el grafo
interno por validación de bosque/ciclos ni inferir edges faltantes. Nodos internos
son glifos pasivos; el foco recorre grupos, no cada estrella. La lista lógica de
teclado conserva el orden editorial y parentId=null; validar IDs duplicados con
Set sin construir un bosque cuyos nodos nunca tienen padres. Este ajuste previo
a código elimina trabajo y código genérico innecesarios sin cambiar orden,
geometría ni validaciones; lo motivó la medición AOT de T-029. Reservar
márgenes para rótulos, umbrales y bindings; etiquetas visibles de hasta dos líneas
con nombre completo en aria/lista/panel, como T-028. Scroll interno nativo conserva
objetivos≥24px efectivos, recomendado44 móvil, sin scroll de página ni pan/zoom.

Mostrar posiciones de pasos que mencionan cada grupo, con resaltado del paso
activo separado del detalle seleccionado. Cada binding lleva power_en→nombre de
habilidad ES/EN resuelto por skill_node_slug, flecha etiquetada y número de paso;
los destinos son referencias textuales, no un nuevo nodo real del árbol ni enlace
a una ruta aún inexistente. La variante skill_node_slug=null usa skill_name_es
y etiqueta de mención externa, solo en paso sin_verificar; referencia no-null
inexistente muestra error y no se convierte en mención externa. Constellation_slug
null conserva íntegro el paso y sus bindings en el bloque textual de ruta, sin
crear constelación ficticia. Se conservan ruta/verificacion/limpieza aunque no
haya paso activo ni grupo seleccionado; no presentar limpieza como dependencia.
Estados de verificación pertenecen al paso: no declarar verificada una constelación
porque otro paso lo esté. Para sin_verificar mostrar texto e insignia y el aviso
«verifica en GrimTools antes de gastar», también en lista/detalle del paso.

Detalle HTML no modal con nombre/tier, afinidad requerida y otorgada y sus datos
desconocidos, pasos asociados y bindings; hover/foco permiten consultar sin robar
foco, click/touch/Enter/Espacio seleccionan; Esc/botón cierra y devuelve foco.
Un tabstop itinerante de grupos, flechas arriba/abajo y Home/End mediante utilidades;
izquierda/derecha equivalen a anterior/siguiente en este mapa sin jerarquía.
SVG title/desc y grupo con botones accesibles, sin role=img que oculte hijos.
Nombres/IDs únicos por mapId, constelación, nodo/binding/paso; mismo ID local en
dos constelaciones no colisiona. Texto/forma/patrón y aria distinguen activo,
seleccionado y sin_verificar; contraste/foco según §5 de spec, transición≤200ms
desactivada por reduced-motion. Lista HTML equivalente en details/summary nativo
abierto por defecto: constelaciones, afinidades y ruta completa, accesibles sin JS
ni selección. Array vacío muestra mensaje; referencias locales de edges rotas o
IDs duplicados no derriban SSR, muestran error accesible y texto íntegro. No hay
loading ficticio ni nodos deshabilitados que impidan consultar información.

Pruebas primero en devotion-map.spec.ts: snapshot estructural SVG/edges/umbrales
determinista; posiciones relativas locales, figuras cerradas válidas, ausencia de
dependencias inventadas y de umbrales para null; vacíos frente a desconocidos,
nombres largos/EN sin ES, entrada congelada; IDs repetidos entre grupos/instancias
y claves de afinidad compartidas sin colisión. Probar binding real y externo,
referencia rota, múltiples pasos por grupo, constelación sin paso, paso sin
constelación y verificación/limpieza; aviso exacto, selección separada del paso,
flechas/Home/End/Enter/Espacio/Esc/cierre/foco y lista SSR completa. Errores/vacíos
conservan lectura. Humo≤120 nodos gráficos totales/actualización≤16ms; no atribuir
a JSDOM tamaños táctiles/render de Chromium. pnpm test y pnpm lint incluyen
regresión T-028 aunque no se cambie; los fallos se registran antes de implementar.

Preview propio mínimo y explícitamente sintético bajo configuración aislada
devotion-map-preview, output dist/devotion-map-preview y bootstrap SSR/hidratación
con replay/withI18nSupport como T-028; nunca guía original pending. Incluir umbral
conocido, afinidad desconocida, edge interno, binding real/externo, paso sin grupo,
limpieza/verificación y controles diagnósticos de activeStepPosition (sin stepper
de producto). pnpm exec ng build --configuration devotion-map-preview; comprobar
DOM sin scripting estricto y, por separado, axe con app hidratada y con bundles
app bloqueados. Chromium375/768/1280: teclado/hover/touch/foco, reduced-motion,
targets efectivos y ningún overflow de página; capturas/reportes e Impeccable en
quickstart. Cerrar helpers/servidor y limpiar solo output preview comprobado.
Build público/stats sin preview, datos sintéticos ni Zod browser; presupuestos
§4/§6 intactos (SVG propio≤8kB gzip, combinado diferido≤40kB cuya integración queda
T-037). Medir contribución completa AOT/HTML/CSS/utilidades como T-028, no solo
geometría; no introducir otro límite agregado ni elevar los existentes. pnpm build
y check:initial-js deben seguir pasando. Evidencia de esta tarea no cierra rutas,
T-033, lector humano global ni la puerta final de spec001. T-029 sigue sin marcar
hasta verificar sus criterios; analizar consistencia acotada antes del handoff.

### 17.34 T-030: verificación SVG reproducible en el repositorio

T-028/T-029 ya tienen evidencia local; sus helpers TEMP no sustituyen el archivo
e2e solicitado. Antes de código, ampliar el alcance de T-030 a
e2e/svg-responsive.spec.ts, playwright.svg.config.ts, tsconfig.e2e.json,
scripts/run-svg-e2e.mts, scripts/serve-svg-preview.mts,
scripts/svg-preview.test.mts, package.json, pnpm-lock.yaml, .gitignore y quickstart.md.
No modificar componentes ni rutas de producto en esta tarea; un defecto nuevo
requiere alcance planificado antes de corregirlo. No cerrar T-040/T-041/T-126.

Dependencias de desarrollo exactas: @playwright/test1.65.0 y axe-core4.14.0,
versiones del motor/axe ya verificadas en las pruebas locales y compatibles con
Node22. Son las herramientas de e2e/a11y autorizadas en §8; axe-core se inyecta en
el navegador directamente, sin wrapper adicional ni dependencia de cliente.
No usar rutas del caché TEMP como import del repo ni añadir binarios de navegador.
pnpm-lock registra integridad; instalar navegadores mediante CLI oficial si faltan.

pnpm e2e:svg construye dominio y ambos previews secuencialmente desde el código
actual, limita NG_BUILD_MAX_WORKERS a2, comprueba tipos e2e y ejecuta Playwright.
Un fallo previo impide lanzar pruebas contra un output antiguo. Subprocesos Node
con argumentos separados, shell=false y windowsHide=true; no interpolar argv en
una shell. Playwright workers1, Chromium a375/768/1280 y alturas declaradas,
sin reusar servidores externos. Controles diagnósticos sintéticos ya existentes;
sin Docker, API, fixtures editoriales ni publicación de contenido pendiente.

Servidor HTTP auxiliar Node nativo, solo127.0.0.1 y raíces de preview conocidas
en dist; puertos4310/4311. GET/HEAD, MIME correctos y no-store, sin listar carpetas
ni registrar URL, cuerpo o causas. Validar ruta decodificada antes de normalizar,
rechazar segmentos ocultos/traversal y comprobar realpath dentro de la raíz para
no seguir enlaces fuera. Error constante400/403/404/405 según caso, sin trazas.
Playwright gestiona inicio/fin de estos procesos. No editar Compose ni secretos.
Pruebas Node primero para lectura/HEAD, traversal codificado, método, ausencia y
escape por enlace; orquestador prueba que un fallo de compilación corta la ejecución.

El test e2e cubre ambos SVG en los tres anchos: HTML sin JS y lista nativa completa,
desplegar/plegar; app hidratada con navegación por flechas/Home/End, Enter/Espacio,
Esc/cierre/foco, hover sin robar foco y cambio del paso sin cambiar selección.
Mide targets efectivos≥24px, tipografía efectiva≥12px, etiquetas dentro de sus
grupos y ausencia de overflow de página; toque/arrastre sintetizados en Chromium
cuando el diagrama excede su contenedor, sin atribuir dispositivo físico.
Axe WCAG A/AA/2.1/2.2 sobre hidratado y app bloqueada, DOM sin scripting estricto
aparte; cero violaciones. Capturas PNG adjuntas al informe, fuentes listas y sin
errores de consola en hidratación ni requests API/externos. Fixtures inválidos y
límites120 pertenecen a las suites de componente; no repetirlos en e2e.

Generados playwright-report/ y test-results/ ignorados, sin imágenes golden que
dependan del SO. Documentar instalación, ejecución y recuperación de capturas;
artefactos locales no acreditan CI remoto. Test Node y tipos integrados en sus
comandos existentes/propios; pnpm verify conserva el alcance actual hasta el
cableado de flujos completos T-040/T-126. Verificar e2e:svg, tipos, lint/formato,
tests y build público/release/API y guardias de secretos antes de marcar T-030.
No crear PR/push ni invocar cierre global mientras falten requisitos de spec001.

### 17.35 T-031: secciones editoriales estáticas controladas

**Alcance previo a código (2026-11-10)**: concretar FR-02, FR-06, FR-10,
AC-02/AC-06 y §4 únicamente para cabecera, «Lee esto primero», prioridades,
notas y Guía Espiritual. T-006/T-017/T-048 proporcionan contrato/tokens/iconos;
T-030 ya está verificada. No existe todavía features/build. No añadir dependencia,
ruta pública, repositorio, storage, SEO, stepper, devociones, filtro, video ni TOC;
esas integraciones pertenecen a T-020/T-032–T-037. No cerrar la spec con esta tarea.

**Archivos exactos**: src/app/features/build/sections/build-sections.ts,
build-sections.html, build-sections.css, build-sections.spec.ts,
preview.component.ts, preview.browser.ts y preview.server.ts (todos dentro de
esa misma carpeta), angular.json y specs/001-mvp-guias-builds/quickstart.md.
angular.json añade únicamente configuración build-sections-preview con entradas
browser/server anteriores y salida dist/build-sections-preview, siguiendo los
previews existentes. Mantener configuración production y assets públicos.
No escribir nuevas clases de dominio ni modificar esquema, fixtures editoriales,
package.json, lockfile, rutas, estilos globales o infraestructura.

**Contrato**: un componente standalone OnPush gd-build-sections, sin inyección
de ContentRepository. Exportar en su .ts un tipo BuildSectionsContent mediante
Pick de PublicBuild de @gd/domain (import type): eyebrow, title, subtitle,
hero_callout_title, hero_callout_body, priorities, notes, guide_npcs y sections_meta.
Los mismos campos de BuildDocument satisfacen ese Pick sin auditoría privada;
no importar esquema/Zod en runtime. Entrada content requerida e inmutable y
entrada section requerida, unión resumen/prioridades/notas/guia-espiritual.
Una instancia renderiza un solo bloque; el futuro padre podrá intercalar los
otros componentes de la guía sin reestructurar esta tarea. El preview instancia
los cuatro bloques una vez. No duplicar título desde nombres de maestrías ni
inventar resumen, autor, versión, fecha o datos de juego.

**Contenido/paridad**: renderizar cadenas con interpolación Angular, nunca
innerHTML, parsing de HTML ni texto editorial hardcodeado. Conservar puntuación,
ES/EN, cifras, primera persona y advertencias. resumen contiene eyebrow, h1 title,
subtitle (incluye leyenda textual) y callout hero_callout_title como h2, con cada
elemento de hero_callout_body en su propio párrafo. prioridades conserva el orden
del array (rank admite null): group_label/headline/note para las11 filas, incluidas
Devoción y Aún no; no inferir numeración del índice ni convertir referencias a
skill_node_slugs en enlaces aún inexistentes. notes y guide_npcs se ordenan sobre
copias por position, estable ante empate; no mutar entradas ni ordenar por texto.

El esquema actual almacena textos auxiliares en notes generales y no ofrece un
discriminador de sección. Usar una selección explícita por kind=general y label
exacta del contrato editorial actual, documentada/prueba en el mismo componente:
«Qué subir ya mismo» y «El Guía Espiritual» aportan sus detail como introducciones,
sin imprimir el marcador técnico «Introducción 1». «Guía Espiritual · Coste» y
«Guía Espiritual · Aviso» siguen a los cuatro guide_npcs en el mismo bloque,
conservando label/headline/detail completos. Las seis notas tipificadas
devociones/nombres/atributos/arma/mas_adelante/rotacion y «Omitir · Demoledor»
permanecen en notas, con label/headline/detail. Ningún consejo se declara verificado.
Las notas con labels «Orden real de compra», «Filtro de botín», «Ruta de devoción»,
«Esquemas de habilidades y devociones», «Referencias de devoción» y «Qué tocar en
cada árbol» quedan reservadas a sus secciones futuras; no eliminarlas del dato.
Toda otra nota general no reservada se muestra en notas como fallback, conservando
contenido nuevo sin inferir significado. No usar números position como identidad.

**Semántica/estados**: cada bloque tiene el id estable de su section y respeta
sections_meta.visible=false; ausencia de metadato permite renderizar. El orden
global por sections_meta.position será responsabilidad del padre futuro.
Un h1 por guía, h2 para callout y secciones; filas como listas HTML con textos
de etiqueta/cabecera/detalle, sin convertir cada fila en un heading. En Guía
Espiritual, name y location son textos distintos, no todos los registros son NPC.
Listas visibles vacías muestran mensaje UI localizado «Sin información disponible»;
callout sin párrafos no crea párrafos vacíos. Datos inválidos se rechazan antes por
el contrato; este componente no añade validadores ni estados async. Es contenido
estático: hover/focus-visible/active/disabled/loading no requieren controles
nuevos; empty se comprueba y error pertenece al cargador de página posterior.

**UI y entrega**: reutilizar soot/panel/panel-2/storm/ember/bone/ash/line, espacios
y fuentes de src/styles/tokens.css/base.css; color nunca sustituye nombre o texto.
Jerarquía editorial coherente con home/tier-list, sin copiar estilos inline del
original. Columna fluida a375, etiquetas y detalle pueden alinearse a768/1280;
texto largo y zoom200% envuelven sin scroll horizontal de página. No añadir
animación, imágenes oficiales ni peticiones externas. Todo texto UI propio pasa
por i18n Angular; el contenido conserva locale es a través del contrato padre.
HTML completo sin JS y equivalente tras hidratación; no window/document/storage
en lógica de producto. Sin fetch ni cambio de fuente de verdad.

**Pruebas primero**: build-sections.spec.ts puede importar solamente en test
content/builds/chaman-demoledor-golpe-primigenio.json y
e2e/fixtures/original-guide.json, usando sus campos estructurados como oráculo
de paridad local; jamás importarlos desde componente/preview o entradas públicas.
Registrar rojo antes del componente por ausencia del comportamiento esperado.
Comparar texto normalizado solo en espacios, por campo/fila, no snapshots vacíos:
cabecera,2 párrafos,11 prioridades completas,6 notas tipificadas+omitidos,
introducciones de prioridades/Guía y4 NPC+Coste/Aviso. Las cantidades corresponden
al original local, no límites del componente. Probar además rank null, reordenación
por position, arrays congelados, visibility=false, listas vacías, nota general
desconocida y texto semejante a HTML que se muestre escapado. Pruebas independientes
con contenido sintético verifican que no se depende del slug ni de nombres reales.

**Preview/verificación**: contenido propio pequeño escrito expresamente en
preview.component.ts, que satisfaga el Pick y cubra todos los campos/estados;
no clonar/cambiar nombres al draft ni simular que sus derechos son aprobados.
Raíz con RouterOutlet/hidratación y noindex siguiendo preview skill-tree; sin
conexión a repositorio/API, ni banner que afirme publicar la guía pendiente.
Construir dominio y preview actual antes de inspeccionar SSR/no-JS y navegador.
Capturar a375/768/1280 y comprobar hidratación sin errores, orden/encabezados,
contraste, textos largos, ausencia de overflow, y axe WCAG A/AA/2.1/2.2 sin
violaciones sobre hidratado y con scripting bloqueado; HTML sin scripting estricto
se comprueba aparte. Sin nuevos e2e/dependencias: usar Playwright/axe existentes
y runner temporal local, registrar comando y ruta de evidencias en quickstart.
Inspeccionar visualmente capturas, no atribuir lectores humanos ni CI remoto.

Preservar íntegramente presupuestos §6 y excepciones de ruta ya aprobadas, sin
introducir límites alternativos, dependencia/runtime nueva ni elevar warnings/errors.
Ejecutar suite
acotada, lint/formato de archivos tocados, lint:md y build/check:initial-js;
comprobar output público sin preview, contenido original pending ni Zod mediante
stats/búsqueda y guardias existentes. El release sigue exclusivamente API;
la prueba de paridad local no habilita INCLUDE_DRAFTS público. T-031 permanece
sin marcar hasta evidencia real en quickstart. Revisión global se conserva pendiente.

### 17.36 T-032: compra por pasos y progreso local opcional

**Alcance previo a código**: US1, FR-02/03/06/08/10 y AC-02/03/06/09 para
orden de compra, selección que resalta habilidades y checklist local opcional.
T-028 y T-031 ya están verificadas. Mantener una tarea; no modificar SVG/secciones,
dominio, rutas T-020/T-037, repositorio, API, progreso de devociones T-033 ni SEO.
Sin dependencia nueva. Preservar §6 y excepciones de ruta vigentes íntegramente.

**Archivos exactos**: src/app/features/build/purchase-stepper/purchase-stepper.ts,
purchase-stepper.html, purchase-stepper.css, purchase-stepper.spec.ts, progress.ts,
progress.spec.ts, preview.component.ts, preview.browser.ts y preview.server.ts,
todos en esa carpeta; angular.json y specs/001-mvp-guias-builds/quickstart.md.
angular.json añade solo purchase-stepper-preview con sus entradas browser/server
y dist/purchase-stepper-preview, siguiendo los previews actuales. No tocar
package.json/lockfile, rutas, scripts, e2e persistentes ni infraestructura.
progress.ts contiene funciones puras de clave/revisión/validación del progreso;
sin servicio global, store, máquina de estados ni abstracción de persistencia nueva.

**Contrato/datos**: standalone OnPush gd-purchase-stepper recibe content requerido,
un Pick<PublicBuild, 'slug' | 'game_version' | 'purchase_steps' | 'skill_nodes' |
'masteries' | 'notes' | 'sections_meta'> mediante import type de @gd/domain.
BuildDocument satisface ese Pick; no recibe ni serializa auditoría editorial.
Pasos ordenados sobre copia por position, estable ante empate, sin mutar entradas;
position es la identidad editorial y nunca el índice. El esquema no garantiza
unicidad de position: si hay duplicados, conservar la lista legible y desactivar
selección/checklist/guardado con aviso de datos inconsistentes, sin generar IDs
alternativos ni tocar dominio. No leer/escribir progreso en ese estado.
Mostrar threshold_label,
title, body y cada highlight con nombre ES/EN resuelto por skill_node_slug y points.
points=null significa objetivo sin cifra: texto localizado «Objetivo sin cifra»;
0 se conserva como0. No sustituir por máximo, puntos calculados o dato inventado.
Introducción: notes kind=general,label=«Orden real de compra», detail ordenado por
position, sin mostrar el marcador técnico de headline. Respetar visible=false
de sections_meta orden; ausencia permite renderizar. Lista vacía muestra estado
localizado, sin controles activables ni excepción.

**Conexión controlada**: selección inicial null (ningún resaltado). Un botón
«Ver habilidades del paso» por fila selecciona position y emite selectionChange
con { position, activeIds }; activeIds son exactamente highlights.skill_node_slug
existentes, sin duplicados, en orden editorial. El padre alimenta SkillTree.activeIds;
preview.component.ts implementa esa conexión real con un árbol por maestría.
No incrustar árboles dentro del stepper: la integración futura puede situarlos
en #habilidades y el stepper en #orden sin duplicación. Cambiar paso reemplaza
activeIds, sin sumar pasos anteriores, marcar completado o alterar selectedId/foco
interno del SVG. mastery_slug=null no limita highlights: el último paso local
resalta sus3habilidades repartidas entre ambos árboles. No filtrar por la maestría
de la fila ni inventar un origen de puntos. currentBar se deja undefined en ambos
árboles: threshold_label es texto libre; no parsearlo ni usar max(bar_required)
como barra alcanzada. Cada habilidad conserva bar_required únicamente como dato.
Sin referencias conocidas: lista conserva texto del paso, salida activeIds vacía;
un slug desconocido no se convierte en enlace roto ni en habilidad inventada.

**Checklist/persistencia**: checkbox nativo independiente por paso; seleccionado
no equivale a completado y completar no implica completar anteriores. Estado
en memoria funciona tras hidratación sin persistir por defecto. Checkbox separado
«Guardar progreso en este navegador» expresa opt-in; explicación indica solo este
navegador, sin cuenta/sin sincronización. Al activarlo guardar completados actuales;
al desactivarlo eliminar únicamente la clave actual, conservando checklist en memoria.
«Borrar progreso» vacía checklist y elimina esa clave, sin cambiar paso seleccionado
ni mover foco; conserva la opción activada si el almacenamiento sigue disponible,
y no recrea registro vacío hasta otra acción del usuario. Nunca localStorage.clear.

Clave estable por guía gd:purchase-progress:{slug codificado con encodeURIComponent};
sin una clave distinta por revisión, sin enumerar storage ni acumular revisiones.
Payload JSON mínimo { version:1, revision:string, completed:number[] }. revision es
una huella determinista sin dependencia, no criptográfica, sobre game_version y
serialización canónica de pasos ordenados y todos sus campos. La huella invalida
progreso, nunca es mecanismo de seguridad. Un cambio de texto/orden/highlight/versión
invalida el registro anterior y se ignora hasta el siguiente opt-in/guardado que
lo sustituye; no migrar posiciones ni borrar claves de otra guía. Borrar elimina
todo progreso guardado de esta guía con una sola removeItem. Sin título/cuerpo,
autor, fuentes, credenciales ni datos del árbol en payload. Validar antes de usar:
string≤16Ki caracteres, objeto plano de claves exactas, version===1,
revision coincide con la huella actual, array sin
duplicados de enteros positivos que existan en los pasos actuales, longitud≤pasos.
Rechazar el payload entero ante corrupción/tipos/posiciones extrañas; no mergear
objetos arbitrarios ni iterar como código. Persistir solo posiciones ordenadas.

Acceso a localStorage únicamente dentro del navegador, tras afterNextRender,
incluida la lectura de su propiedad (puede lanzar SecurityError). SSR e hidratación
inicial comparten checklist vacío y selección null; ningún acceso en import,
constructor o render servidor. Un registro válido restaura completados y opt-in
porque fue creado por consentimiento anterior; inválido se ignora sin escribir.
Proteger getter/getItem/setItem/removeItem con try/catch; denied/cuota/error
dejan checklist en memoria y aviso localizado no intrusivo de guardado no disponible,
sin console/log de payload ni excepción. No afirmar borrado persistido si removeItem
falla: mensaje indica que solo se borró en esta vista. No reenviar nada a API.
Al cambiar content de guía/revisión en la misma instancia, resetear memoria y
selección, emitir activeIds vacíos y leer únicamente su clave/huella en navegador;
jamás guardar el estado anterior como el de otra guía/revisión. No hace falta
listener multi-tab.

**HTML/UI**: section#orden con h2 «Orden real de compra», introducción y ol completo;
texto de todos los pasos y objetivos presente en SSR/no-JS. Botones/checkboxes de
mejora permanecen disabled hasta hidratación, con texto breve que explica que el
guardado requiere JavaScript. Usar aria-pressed en el botón seleccionado, labels
explícitos para checkboxes y estado textual «Completado» además del color. No usar
role=tab ni roving tabindex para una lista editorial; Tab/Enter/Espacio nativos,
foco permanece en el control accionado. Ningún avance mueve el foco al árbol.
Un live region polite puede anunciar cambios/borrado/error, sin repetir cuerpo
completo ni anunciar estado SSR. Todos los textos UI pasan por i18n Angular y
contenido por interpolación escapada; conservar nombres ES/EN. Tokens/fuentes
existentes, reduced-motion, focus-visible, targets≥24px y contraste WCAG2.2AA.
A375 una columna; a768/1280 distribución flexible sin cortar texto o producir
overflow de página, zoom200%. Estados default/hover/focus/active/disabled/empty/error
definidos por controles y aviso; no carga remota ni spinner innecesario.

**Pruebas antes de código**: progress.spec.ts cubre clave estable/aislamiento y
revisión, payload válido/vacío/hostil/corrupto/excesivo/duplicado/desconocido; pruebas
de componente cubren selección y emisión, puntos0/null, posiciones no contiguas/duplicadas,
entradas congeladas, cross-mastery, visibilidad/vacíos, escape, checklist separado,
opt-in/restauración/borrar, getter/lectura/escritura/borrado denegados, cambio de
guía sin fuga y SSR sin storage. Registrar rojo por comportamiento ausente y verde.
Paridad de6pasos y su introducción con fixture original y draft solo en spec.ts,
como T-031; no importar original ni copiarlo en preview/producto. Mantener suite
SkillTree existente sin cambios para probar que selección/foco del SVG se conservan.

Preview sintético propio con dos maestrías, pasos cruzados y points null/0,
RouterOutlet, hidratación con soporte i18n y noindex; sin repositorio/API. E2E local
con Playwright/axe ya disponibles y runner temporal: construir código actual antes;
375/768/1280, SSR/JS/no-JS, click/teclado/touch seleccionan paso y actualizan los dos
SVG, checklist persiste al recargar solo con opt-in y borrar elimina el registro;
guías/revisiones no comparten progreso y storage denegado no rompe lectura.
Capturas inspeccionadas, axe WCAG A/AA/2.1/2.2 cero violaciones en hidratado y bundles
bloqueados, scripting estricto comprobado aparte, cero errores consola y requests
externos/API. Comprobar targets/foco/no overflow. Registrar comandos/artefactos
en quickstart; no atribuir CI remoto ni lectura humana. Ejecutar suite acotada,
lint/formato/Markdown y build/check:initial-js/guardia pública; verificar stats y
browser output excluyen preview, original pending y Zod. Sin aumentar presupuestos
§6 ni reclamar LCP/CLS por medir bytes. T-032 solo se marca tras evidencia; spec001
y T-033–T-037 permanecen abiertas.

### 17.37 T-033: selección controlada de la ruta de devoción

**Alcance previo a código**: US1.4, FR-02/03/06/07/10, AC-02/03/06/09 y §4 para
ruta de devoción con selección de pasos, verificación y limpieza. T-029/T-031 y
T-032 ya están verificadas. FR-08 limita persistencia al checklist de compra:
esta tarea no usa localStorage/sessionStorage, cookies ni progreso de devociones.
Sin nuevas dependencias, rutas T-020/T-037, API, SEO, Docker o alcance T-034.
Conservar presupuestos §6 y excepciones vigentes, sin introducir variantes laxas.

**Archivos exactos**: src/app/features/build/devotion-section/devotion-section.ts,
devotion-section.html, devotion-section.css, devotion-section.spec.ts,
preview.component.ts, preview.browser.ts y preview.server.ts, todos en esa carpeta;
angular.json y specs/001-mvp-guias-builds/quickstart.md. angular.json añade solo
devotion-section-preview con esas entradas browser/server y salida
dist/devotion-section-preview, siguiendo los previews existentes. No modificar
DevotionMap ni sus tests/CSS/plantilla/API, rutas, dominio, package.json/lockfile,
scripts, e2e persistentes ni infraestructura. El leaf T-029 ya ocupa7989/8000bytes
gzip propios según su evidencia: esta tarea conserva sus límites y su contrato.

**Decisión de composición**: DevotionMap ya admite constellations, steps,
skillNodes, activeStepPosition y mapId, y contiene en details abierto toda la
ruta textual (body, kind, verification, bindings), incluso pasos sin constelación.
Crear un solo componente OnPush gd-devotion-section que renderiza introducción,
notas editoriales y una lista breve de botones de selección, seguida de exactamente
un DevotionMap. El leaf es la única lista de lectura completa: no copiar cuerpos,
afinidades o bindings en el stepper ni crear otro detalle para el paso activo.
El detalle transitorio ya existente del mapa conserva su responsabilidad y foco.
Siempre pasar todos los pasos/constelaciones/nodos, nunca solo el paso activo ni
filtrar datos al seleccionar. Así se mantienen alternativa no-JS y vínculos de
pasos no activos sin cambios al leaf. No ocultar la lista del mapa mediante CSS.

**Contrato**: exportar DevotionSectionContent como Pick<PublicBuild, 'slug' |
'constellations' | 'devotion_steps' | 'skill_nodes' | 'notes' | 'sections_meta'>,
con import type de @gd/domain; BuildDocument satisface los mismos campos sin
auditoría privada. Entradas content y mapId requeridas, sectionId con valor por
defecto devociones, activeStepPosition opcional number|undefined; salida
activeStepPositionChange emite la position seleccionada, sin mutar content ni
mantener selección duplicada. El padre es dueño del valor; preview usa signal
undefined inicial y enlaza entrada/salida. El futuro padre cambia selección a
undefined al cambiar de guía/datos. sectionId/mapId distinguen instancias y IDs;
no IDs derivados de textos, títulos o traducciones. Respetar visible=false para
devociones en sections_meta; ausencia permite renderizar la sección.

Ordenar copia de devotion_steps por position estable ante empate; no usar índice
como identidad editorial. Selector de cada paso muestra position, label y
title_override cuando existe, sin repetir label cuando ambos textos coinciden;
los títulos y cuerpo completos siguen en la lista del mapa. Emite exactamente
esa position al activar; no acumula pasos anteriores, completa constelaciones,
calcula afinidad, altera selectedSlug del mapa ni mueve foco al SVG. Estado efectivo
del mapa es la entrada si coincide con una position existente; undefined/valor
desconocido conserva estado neutral, sin inventar primer paso. Si position se
duplica (el esquema lo permite), mantener texto/leaf completo y desactivar botones
con aviso localizado de datos inconsistentes, usando estado activo undefined.
Lista vacía: mensaje localizado y sin botones activables; el mapa mantiene sus
propios estados de constelaciones/ruta vacías. Sin spinner o carga remota.

**Pasos sin destino y verificación**: kind ruta/verificacion/limpieza se conserva
sin inferir posición, tipo o constelación desde title_override. Seleccionar los
pasos locales10/11 (constellation_slug=null) resalta su fila nativa del mapa y no
activa un grupo SVG. No mapear limpieza a Crossroads ni verificación a GrimTools.
El aviso literal del leaf «verifica en GrimTools antes de gastar» queda visible
para cada sin_verificar y en su aviso global; no esconderlo al cambiar a otro paso.
Mantener verification original; el control nuevo no declara verificado nada ni
genera enlace calculador/iframe. El padre pasa activeStepPosition sin alterar
constellations, skillNodes o bindings.

**Paridad y textos auxiliares**: todos los11pasos de la fuente local, sus labels,
title_override, body, kind, accent, verification y5bindings;13constelaciones con
nombres EN/ES, tier_level, affinity_required/granted y layout íntegros. Las cifras
del cuerpo no completan el esquema: «22+» no se convierte en afinidad calculada;
null sigue «Sin datos», mapa vacío explícito sigue distinto de null, name_es=null
usa EN identificado como tal. Los destinos reales mantienen nombre ES/EN; binding
externo Elemental Storm→Tótem de Tormenta conserva skill_node_slug=null y su nombre
ES como mención externa sin inventar barra/EN/nodo. Ghoul/Behemoth conservan sus
etiquetas originales, sin añadir nombre supuesto del poder o arista entre grupos.

notes kind=general,label=«Ruta de devoción» aporta detail introductorio en orden
position, sin marcador técnico «Introducción 1». Las notas reservadas
«Esquemas de habilidades y devociones» y «Referencias de devoción» se muestran
una vez con label/headline/detail completos junto a la introducción, sin resumir
sus cautelas. No consumir notas de filtro/árboles ni volver a imprimir notes ya
consumidas por T-031/T-032. Usar interpolación Angular escapada; sin HTML libre,
copias editoriales hardcodeadas, renombres o correcciones del consejo original.

**Semántica/UI**: section con sectionId y h2 «Ruta de devoción», navegación de
selección etiquetada, ol de botones nativos y DevotionMap con mapId propio y todos
sus encabezados/listas. Los botones enlazan aria-controls al host del mapa con id
mapId y aria-pressed al paso activo; sin tabs/roving/flechas añadidas. Tab pasa por
controles; Enter/Espacio y toque seleccionan. Mantener foco en el botón pulsado;
teclado del SVG y Esc/cierre/foco existentes permanecen independientes. Botones de
mejora desactivados hasta afterNextRender; texto explica que seleccionar requiere
JavaScript, pero la lectura completa ya está en HTML. Sin acceso browser-only en
SSR, incluso si storage está denegado o lanza al leerse: esta tarea no lo usa.
Todo texto UI nuevo con i18n/$localize; no repetir anuncio del cuerpo en live region.

Tokens/fuentes existentes, nombres/etiquetas además del color, estados
default/hover/focus-visible/active/disabled/empty/error proporcionados por controles
y fallback. Sin animación nueva; conservar reduced-motion. Targets≥24px, contraste
WCAG2.2AA y foco visible no tapado. Una columna a375 y distribución flexible de
controles a768/1280, texto largo y zoom200% sin overflow de página; scroll interno
del mapa existente cuando corresponde. No redibujar geometría ni añadir arte.

**Pruebas primero**: devotion-section.spec.ts prueba host controlado con el leaf
real: selección/emisión/resaltado, cambio de paso sin mutar ni perder datos,
pasos null, estado neutral, posiciones no contiguas/duplicadas, frozen inputs,
visibilidad/vacíos, aislamiento de instancias/IDs, escape y SSR sin storage.
Paridad con content/builds/chaman-demoledor-golpe-primigenio.json y
e2e/fixtures/original-guide.json solo importados desde spec.ts: comprobar campos
de11pasos/5bindings/13constelaciones y las3notas de esta tarea. En el estado inicial
cada body aparece una vez en la lista nativa del leaf, nunca en los controles;
la lista conserva todos los pasos tras cada selección. No repetir pruebas unitarias
de geometría que ya cubre T-029. Registrar rojo válido antes de código y verde;
la suite DevotionMap existente pasa sin cambios.

Preview propio sintético, sin original/draft ni consejos de juego, con pasos ruta,
verificacion y limpieza, destinos null, verificado/sin_verificar, nombres/afinidades
null y vínculos reales/externos. Raíz RouterOutlet, SSR/hidratación con i18n,
noindex y padre controlado; sin repositorio/API. Construir dominio y preview actual
antes de e2e temporal local con Playwright/axe existentes. A375/768/1280 verificar
click/Enter/Espacio/touch, foco conservado, activo SVG/fila textual correcta,
aviso persistente, lista completa SSR/no-JS, consola sin errores y cero requests
externos/API. Axe WCAG A/AA/2.1/2.2 cero violaciones en hidratado y bundles bloqueados;
DOM sin scripting estricto aparte. Capturas inspeccionadas, targets/texto/no overflow.
Registrar comandos y artefactos quickstart, sin atribuir CI remoto o lector humano.
Suites acotadas, lint/formato/Markdown, build/check:initial-js/guardia pública y
stats sin preview, Zod ni contenido pending; conservar §6 y límites del leaf.
No marcar T-033 antes de evidencia ni cerrar T-034/T-037/spec001 con esta tarea.

**Cierre y relevo documental solicitado por el usuario**: incluir también
specs/001-mvp-guias-builds/handoff.md entre los archivos autorizados de esta tarea.
Escribirlo al terminar T-033 verificada, antes de detenerse, con inventario derivado
del tasks.md vigente (no de memoria): IDs/cantidad de tareas pendientes,
separando activas, bloqueadas por decisión externa, opcionales y diferidas;
documentar dependencias/criterios de reanudación, estado pendiente de la puerta
spec002, evidencias actuales y riesgos/límites relevantes sin secretos. Contar
también tareas pendientes del formato antiguo sin checkbox; no tratarlas como
completadas ni confundir diferidas con alcance activo. No ejecutar otra tarea,
crear funcionalidad ni declarar cierre global. El informe final comunica cantidad
y enlace al relevo y se detiene conforme a la instrucción expresa del usuario.

Instrucción posterior del usuario (pausa histórica): se interrumpió T-033 para
documentar el relevo e inventario en handoff.md. Reanudación autorizada por el
usuario (2026-11-10): retomar y completar T-033 con todas sus pruebas, preview,
verificaciones visuales/accesibilidad, guardias de build/release y registro de
evidencia en quickstart.md y handoff.md antes de marcar T-033 como completada.

### 17.38 T-135: estética Grim Dawn en tokens, layout y secciones de build

**Alcance previo a código (2026-11-10)**: petición expresa del usuario para que
el diseño de las páginas de builds y superficies asociadas adopte los colores y
la estética dark-fantasy propia de Grim Dawn (hierro carbonizado, pizarra/cuero
oscuro, marcos biselados de bronce/latón arcano, pergamino cálido y ascua
ctónica), sustituyendo la paleta fría azulada inicial de T-017 sin romper
contratos TS/HTML, pruebas existentes ni presupuestos §6.

**Archivos exactos**: `src/styles/tokens.css`, `src/styles/base.css`,
`src/app/shared/ui/layout/site-layout.css`, `src/app/features/home/home.page.css`,
`src/app/features/tier-list/tier-list.page.css`,
`src/app/features/tier-list/tier-components.css`,
`src/app/features/build/sections/build-sections.css`,
`src/app/features/build/purchase-stepper/purchase-stepper.css`,
`src/app/features/build/devotion-section/devotion-section.css`,
`src/app/shared/svg/skill-tree/skill-tree.css`,
`src/app/shared/svg/devotion-map/devotion-map.css`, `src/assets/icons/*.svg`,
`specs/001-mvp-guias-builds/quickstart.md` y
`specs/001-mvp-guias-builds/handoff.md`. No modificar `scripts/check-contrast.mts`
ni contratos TypeScript/plantillas HTML.

**Tokens de color y enmarcado (`src/styles/tokens.css`)**:

- Conservar exactamente los 10 nombres `--color-*` que inspecciona
  `scripts/check-contrast.mts` (cada uno hexadecimal de 6 dígitos declarado una
  sola vez):
  - `--color-soot: #0c0a08` (hierro carbonizado / fondo abisal de Cairn)
  - `--color-panel: #15110d` (pizarra/cuero oscuro de ventana de Grim Dawn)
  - `--color-panel-2: #1e1812` (panel interior elevado / piedra sombría)
  - `--color-bone: #eadfca` (pergamino envejecido / marfil cálido — ratio > 12:1)
  - `--color-ash: #a3947a` (ceniza cálida / bronce envejecido — ratio > 5.2:1 sobre `#1e1812`)
  - `--color-storm: #d8b15a` (oro/latón arcano de cabeceras y marcos de Grim Dawn — ratio > 7.5:1 sobre `#1e1812`)
  - `--color-storm-dim: #4c3b1a` (bronce bruñido oscuro)
  - `--color-ember: #e07845` (ascua / fuego ctónico — ratio > 5.3:1 sobre `#1e1812`)
  - `--color-ember-dim: #592915` (ascua profunda)
  - `--color-line: #382c1e` (filete metálico de hierro y bronce)
- Añadir tokens de composición/enmarcado con prefijos distintos de `--color-*`
  (para que `checkTokenContrast` evalúe únicamente los tokens de color):
  `--frame-border`, `--frame-accent-border`, `--frame-bevel`, `--surface-sheen`,
  `--header-glow` y `--panel-shadow`.
- Actualizar `stroke="#e4dfd2"` a `stroke="#eadfca"` en los 29 iconos propios
  `src/assets/icons/*.svg` para mantener la paridad exacta con `--color-bone`
  exigida por `src/app/shared/ui/icon/resolve-icon.server.test.mts`.

**Aplicación visual y límites**:

- `base.css` y `site-layout.css`: fondo oscuro con resplandor superior sutil
  (`--header-glow`), barras de cabecera y pie con filete doble/bisel de bronce
  (`--frame-bevel`, `--surface-sheen`), botones e inputs con borde metálico y
  realce ámbar/latón en `:hover` y `:active`.
- `build-sections.css`, `purchase-stepper.css`, `devotion-section.css`,
  `skill-tree.css` y `devotion-map.css`: bloques de guía, cabecera de resumen,
  callout «Lee esto primero», tarjetas/filas de prioridades, pasos de compra,
  selector de devociones y paneles de detalle/lienzo SVG enmarcados como placas y
  grimorios de interfaz de Grim Dawn (superficies `--color-panel`/`--color-panel-2`,
  bordes biselados, insignias de rango/umbral en bronce y ascua).
- `home.page.css`, `tier-list.page.css` y `tier-components.css`: tarjetas del
  catálogo, filas de tier, barra de filtros y hero alineados con el mismo marco
  biselado y jerarquía cromática de Cairn.
- Preservar todos los presupuestos §6: cada hoja de estilo de componente por
  debajo del límite de error de 8 kB de `angular.json` (mantener hojas no SVG
  bajo el warning de 4 kB) y CSS inicial ≤ 20 kB gz; sin imágenes oficiales ni
  solicitudes externas.

**Verificación obligatoria antes de marcar `T-135`**: `pnpm check:contrast`
(12 pares ≥ 4.5:1 sin redondear), prueba Node `resolve-icon.server.test.mts`,
suites unitarias Angular, `pnpm e2e:svg`, inspección Playwright + axe WCAG 2.2 AA
a 375/768/1280 sobre `build-sections-preview` y rutas de portada/catálogo con 0
violaciones y sin overflow horizontal, detector Impeccable 4.8.1 `[]`,
`pnpm build`, `pnpm check:initial-js` y `pnpm check:public-build`.

### 17.39 T-034: sección controlada de filtro de botín (`gd-loot-filter`)

**Alcance previo a código (2026-11-10)**: US1.5, FR-02/06/10, AC-02/06/09 y
spec §4 («Filtro de botín»: 4 columnas Calidad, Tipo, Daño y Personaje,
descripción/introducción, reglas `marcar`/`desmarcar`/`aviso` con texto, aviso
«lógica O, no Y», consejo final «Aprieta el filtro poco a poco» y botón «Copiar
resumen»). Sigue el patrón exacto de `T-031`/`T-032`/`T-033`, después de `T-135`.
Sin dependencias nuevas, sin persistencia en `localStorage`, sin rutas públicas
(`T-020`/`T-037`), sin repositorio ni API en navegador.

**Archivos exactos**: `src/app/features/build/loot-filter/loot-filter.ts`,
`src/app/features/build/loot-filter/loot-filter.html`,
`src/app/features/build/loot-filter/loot-filter.css`,
`src/app/features/build/loot-filter/loot-filter.spec.ts`,
`src/app/features/build/loot-filter/preview.component.ts`,
`src/app/features/build/loot-filter/preview.browser.ts`,
`src/app/features/build/loot-filter/preview.server.ts`, `angular.json`
(configuración `loot-filter-preview` con salida `dist/loot-filter-preview`),
`specs/001-mvp-guias-builds/quickstart.md` y
`specs/001-mvp-guias-builds/handoff.md`.

**Contrato y datos**:

- Componente standalone OnPush `gd-loot-filter`. Exportar `LootFilterContent`
  como `Pick<PublicBuild, 'slug' | 'title' | 'loot_filter_columns' | 'notes' | 'sections_meta'>`
  mediante `import type` desde `@gd/domain` (sin importar esquemas Zod en el
  bundle del navegador; `BuildDocument` satisface el mismo `Pick`).
- Entradas: `content = input.required<LootFilterContent>()` y
  `sectionId = input<string>('filtro-de-botin')` (coincidente con el ancla
  `#filtro-de-botin` de plan §2 y `section_key: 'filtro-de-botin'` de
  `content/builds/chaman-demoledor-golpe-primigenio.json`).
- Visibilidad (`isVisible`): comprueba `sections_meta` para `section_key` igual a
  `sectionId()`, `'filtro-de-botin'` o `'filtro'`; si `visible === false`, no
  renderiza la sección; si no existe entrada en `sections_meta`, renderiza por
  defecto.
- Orden e inmutabilidad: ordenar copia de `loot_filter_columns` por `position`
  ascendente y, dentro de cada columna, copia de `rules` por `position`
  ascendente, sin mutar las colecciones de entrada. Detectar posiciones
  duplicadas de columnas o de reglas dentro de una misma columna
  (`hasDuplicatePositions`): si existen duplicados, conservar la lectura íntegra
  y desactivar la acción de copiado mostrando una advertencia accesible de datos
  inconsistentes.
- Notas auxiliares de `notes` (`kind === 'general'` y `label === 'Filtro de botín'`,
  ordenadas por `position` ascendente):
  - **Introducciones**: aquellas cuyo `headline` coincide con
    `/^Introducci[óo]n\s+\d+$/i` (p. ej. «Introducción 1»: «El botón está en el
    HUD, a la izquierda de la barra de vida…») se muestran como párrafos
    introductorios usando `detail`, sin imprimir el marcador técnico
    `Introducción 1`.
  - **Consejos/notas finales**: aquellas cuyo `headline` no es marcador de
    introducción (p. ej. `headline: "Aprieta el filtro poco a poco"`,
    `detail: "Pasado el nivel 25 ya puedes activar las columnas de daño de rayo…"`)
    se renderizan al pie de las columnas conservando tanto `headline` como
    `detail`. No consumir ni repetir notas de otras secciones (`T-031`–`T-033`).

**Acordeón accesible, reglas y botón «Copiar resumen»**:

- Cada columna se presenta mediante `<details class="loot-column" open>` nativo
  (abierto por defecto en SSR/no-JS para que el 100 % del contenido esté visible
  sin JavaScript y sea plegable/desplegable con teclado `Enter`/`Espacio` y
  click/touch en `<summary>`). `<summary>` incluye posición/nombre (`column.name`)
  y subtítulo (`column.subtitle`), con altura mínima táctil ≥ 44 px y foco
  visible.
- Cada regla muestra una insignia textual explícita según `rule.action`
  (`Marcar`, `Desmarcar` o `Aviso` en español vía i18n, además de atributo
  `[attr.data-action]="rule.action"` y estilo diferenciado por forma/borde),
  seguida de `rule.label` y `rule.detail`. Nunca se transmite `marcar`,
  `desmarcar` o `aviso` solo por color (Constitución V, spec §5). La tercera
  columna conserva íntegra la regla `action: 'aviso'` («Ojo con la lógica»:
  «El filtro es un O, no un Y…»).
- Botón «Copiar resumen»:
  - Desactivado (`disabled`) en SSR y antes de `afterNextRender`, cuando la lista
    de columnas está vacía o cuando `hasDuplicatePositions()` es `true`. Junto al
    botón, mientras `!browserReady()`, se muestra una nota breve indicando que
    copiar al portapapeles requiere JavaScript y que el resumen completo ya está
    visible en la página.
  - Construye un resumen en texto plano determinista (`buildSummaryText()`) que
    incluye el encabezado de la sección, las introducciones, cada columna en
    orden (`name — subtitle`), cada regla en orden con su acción/etiqueta/detalle
    (`- [Acción] label: detail`) y los consejos finales (`headline: detail`), de
    modo que el texto copiado coincida fielmente con el contenido mostrado.
  - Invoca `navigator.clipboard.writeText(summary)` dentro de `try/catch` (solo
    en navegador hidratado). Actualiza una región `role="status"` con
    `aria-live="polite"` confirmando que el resumen fue copiado o informando un
    error comprensible si el portapapeles no está disponible o rechaza la
    escritura, sin lanzar excepciones no capturadas.

**Pruebas primero y verificación**:

- `loot-filter.spec.ts` primero en rojo antes de implementar el componente:
  paridad local contra `content/builds/chaman-demoledor-golpe-primigenio.json` y
  `e2e/fixtures/original-guide.json` (importados únicamente en el test): las 4
  columnas, sus 8 reglas totales (`marcar`/`desmarcar`/`aviso`, incluido «El
  filtro es un O, no un Y»), la introducción «El botón está en el HUD…» sin el
  marcador «Introducción 1» y el consejo final «Aprieta el filtro poco a poco».
- Probar además orden por `position` sin mutar entradas congeladas, acordeones
  `<details>` abiertos en SSR y plegables, etiquetas de acción explícitas,
  visibilidad `sections_meta`, estado vacío («Sin información disponible»),
  posiciones duplicadas, escape de cadenas tipo HTML, botón desactivado antes de
  hidratación, texto exacto enviado a `navigator.clipboard.writeText` y mensaje
  de estado accesible tanto en éxito como ante fallo/ausencia del portapapeles.
- Preview sintético propio en `preview.component.ts` (sin importar el borrador
  `pending`), compilado con `ng build --configuration loot-filter-preview`.
  Verificación Playwright + axe WCAG 2.2 AA a 375/768/1280 (hidratado, bundles
  bloqueados y DOM sin JS estricto), teclado/foco/copiado, zoom 200 % sin
  overflow, detector Impeccable 4.8.1 `[]`, `pnpm build`, `pnpm check:initial-js`,
  `pnpm check:public-build` y actualización de `quickstart.md` y `handoff.md`.

### 17.40 T-035: fachada de video (`gd-video-facade`) y ausencia honesta

**Alcance previo a código (2026-11-10)**: US1, FR-02/FR-11 y AC-01/AC-02/AC-06/AC-09;
spec §4 (video opcional) y §5 (estados `loading`/`error`, sección sin video oculta).
La guía migrada tiene `video_url: null` y `sections_meta` con
`{ section_key: 'video', visible: false }`, por lo que la página pública no debe
mostrar ni un contenedor vacío. Sigue el patrón de T-031/T-034 y depende de
T-017/T-135 (tokens), T-031 (orden de secciones) y T-034 (preview aislado).
Sin dependencias nuevas, sin ruta pública (`T-020`/`T-037`), sin repositorio, API,
SEO, storage ni cambios de esquema. Conservar presupuestos §6: CSS de componente
bajo el warning de 4 kB y error de 8 kB, sin CSS global nuevo.

**Archivos exactos**: `src/app/features/build/video-facade/video-facade.ts`,
`video-facade.html`, `video-facade.css`, `video-facade.spec.ts`,
`preview.component.ts`, `preview.browser.ts` y `preview.server.ts` en esa misma
carpeta; `angular.json` (solo configuración `video-facade-preview` con entradas
browser/server y salida `dist/video-facade-preview`),
`specs/001-mvp-guias-builds/quickstart.md` y
`specs/001-mvp-guias-builds/handoff.md`. No modificar `gd-build-sections`,
`gd-loot-filter`, `gd-devotion-section`, rutas, dominio, `package.json`/lockfile,
scripts, e2e persistentes ni infraestructura.

**Contrato**: exportar
`VideoFacadeContent = Pick<PublicBuild, 'slug' | 'title' | 'video_url' | 'sections_meta'>`
con `import type` desde `@gd/domain`; `BuildDocument` satisface el mismo `Pick`.
Entradas `content = input.required<VideoFacadeContent>()` y
`sectionId = input<string>('video')`. El componente expone
`hasRenderableVideo()` (URL válida y sección visible) y `isVisible()`
(`sections_meta` sin `visible: false` para `'video'`). La plantilla no emite nada
cuando no hay video. El host tampoco debe quedar en el DOM público: `T-037` envuelve
`<gd-video-facade>` en `@if (hasRenderableVideo())`, de modo que el caso migrado
produce exactamente cero nodos, no un `display:none`. La prueba debe cubrir ambos
niveles: componente sin hijos y página sin `<gd-video-facade>`.

**Validación estricta de URL**: aceptar solo HTTPS y hosts de YouTube de confianza
(`youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`,
`www.youtube-nocookie.com` y `youtube-nocookie.com`), con rutas
`/watch?v=<id>`, `/embed/<id>` o `youtu.be/<id>` y un `id` de 11 caracteres
`[A-Za-z0-9_-]`. Rechazar mayúsculas de host no canónicas que suplanten el dominio
(`youtube.com.evil`, `evil-youtube.com`), puertos, credenciales, `http:`,
`javascript:`, `data:`, `blob:`, rutas relativas, cadenas vacías o solo espacios y
cualquier URL malformada. No normalizar a partir de `URL.hostname` sin comparar la
lista exacta. La URL aceptada se normaliza a
`https://www.youtube-nocookie.com/embed/<id>`; no se conservan parámetros de
seguimiento. URL inválida o no fiable: estado de error accesible con `role="alert"`,
texto localizado, sin `<iframe>` y sin enlace externo (el enlace también sería
inseguro). No usar `bypassSecurityTrustHtml` ni interpolar HTML.

**Fachada, activación y fallback**: contenedor con `aspect-ratio: 16 / 9` fijo para
CLS 0, superficie y marco Cairn con `--frame-border`, `--frame-bevel`,
`--surface-sheen` y `--header-glow`; glifo de reproducción en SVG inline estático y
decorativo (`aria-hidden="true"`), título visible y botón nativo
`<button type="button">` con texto «Cargar video» localizado. El botón está
deshabilitado en SSR y antes de `afterNextRender`; una nota breve explica que
cargar el video requiere JavaScript. Siempre se ofrece un
`<a rel="noopener noreferrer" target="_blank">` al video original HTTPS para
quien no ejecuta JavaScript o no activa la fachada. Solo tras activación explícita
se monta un único
`<iframe loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allowfullscreen title="...">`;
antes de ese instante no existe ninguna petición a YouTube. El `title` del iframe
incluye el título del video y no se duplica como texto visible. Estados `loading`
(mientras carga el iframe) y `error` (iframe bloqueado o fallido) con texto y
`role="status"`/`role="alert"` según corresponda; un cambio de `content().slug`
desactiva la fachada y vuelve al estado inicial. No autoplay, cookies de terceros
antes de activar ni carga de scripts de YouTube.

**Semántica/UI**: `section` con `[id]="sectionId()"` y `aria-labelledby` a un `h2`
localizado; botón con foco visible de 2 px, estados default/hover/focus-visible/
active/disabled/loading/error y objetivo táctil ≥ 24 px (recomendado 44 px). Sin
overflow horizontal a 375/768/1280, texto al 200 % sin recorte, contraste WCAG 2.2
AA y `prefers-reduced-motion` respetado (sin animación propia). Todo texto nuevo con
`$localize`; nada de copiar descripciones editoriales ni inventar metadatos del
video.

**Pruebas primero**: `video-facade.spec.ts` en rojo antes del componente:
`video_url` nulo, vacío o con espacios; `sections_meta` `visible: false`; host sin
nodos y `hasRenderableVideo()` falso; variantes inválidas (host suplantado, `http:`,
`javascript:`, `data:`, credenciales, puerto, id corto, URL malformada) sin iframe y
con alerta; las cuatro formas válidas normalizadas a `youtube-nocookie.com/embed/<id>`;
botón deshabilitado en SSR; activación única (un iframe, sin duplicados); el iframe
no existe antes del clic; enlace de fallback con `target`/`rel` correctos; error de
carga y error de bloqueo; reinicio al cambiar de guía; escape de títulos y títulos
maliciosos; sin acceso a storage ni a red. La prueba de página de `T-037` verificará
que el caso `video_url: null` no deja nodos.

**Preview**: `preview.component.ts` sintético propio, sin la guía pendiente, con un
video ficticio válido, un estado de error por URL inválida y texto de aviso que
aclare que no es contenido real. Compilar `ng build --configuration
video-facade-preview`; Playwright + axe a 375/768/1280 en hidratado, bundles de la
aplicación bloqueados y contexto sin JavaScript: cero violaciones, foco y teclado,
objetivo ≥ 24 px, sin overflow, sin peticiones externas antes de activar y consola
limpia. Tras activar, interceptar la red y comprobar que la única petición es al
dominio `youtube-nocookie.com`; si la red no está disponible, verificar `src` y
estado de error sin declarar éxito de carga remota. Capturas inspeccionadas y
servidor/preview eliminados al terminar. Registrar comandos y artefactos en
`quickstart.md`; no atribuir CI remoto ni lector humano.

**Cierre**: `pnpm lint`, `pnpm format:check`, `pnpm lint:md` sobre los archivos
tocados, `pnpm build`, `pnpm check:initial-js`, `pnpm check:public-build` y
presupuestos de componente. Marcar `T-035` solo con evidencia; no marcar `T-036`,
`T-037` ni `T-020` desde esta tarea, y no publicar la guía migrada.

### 17.41 T-036: atribución, fuentes y tabla de contenidos (`gd-build-attribution` + `gd-build-toc`)

**Alcance previo a código (2026-11-10)**: US1, FR-02/FR-06/FR-14 y AC-02/AC-06,
con la prominencia de FR-29 para adaptaciones delegada en T-105; spec §2 (anclas
`#resumen`, `#prioridades`, `#habilidades`, `#orden`, `#notas`,
`#filtro-de-botin`, `#guia-espiritual`, `#devociones`, `#video`, `#fuentes`), §4
(autor/fuentes) y §5 (insignias con texto, no solo color); WCAG 2.2 AA y 2.4.11
(foco no oscurecido por el TOC sticky). Depende de T-017/T-135 (tokens), T-019
(layout y skip link corregido en T-134), T-031/T-032/T-033/T-034 (secciones ya
existentes) y T-018 (SEO se consume en T-037). Sin cambios de esquema, dominio,
dependencias, API, rutas ni CSS global.

**Archivos exactos**: `src/app/features/build/attribution/build-attribution.ts`,
`build-attribution.html`, `build-attribution.css`, `build-attribution.spec.ts`;
`src/app/features/build/toc/build-toc.ts`, `build-toc.html`, `build-toc.css`,
`build-toc.spec.ts`; `src/app/features/build/attribution/preview.component.ts`,
`preview.browser.ts` y `preview.server.ts`; `angular.json` (solo
`build-meta-preview` con salida `dist/build-meta-preview`),
`specs/001-mvp-guias-builds/quickstart.md` y
`specs/001-mvp-guias-builds/handoff.md`. No modificar componentes de sección,
`core/content`, `core/seo`, rutas, `package.json`/lockfile ni infraestructura.

**Contrato de `gd-build-attribution`**: exportar
`BuildAttributionContent = Pick<PublicBuild, 'slug' | 'title' | 'author' | 'sources' | 'game_version' | 'review_state' | 'content_status' | 'published_at' | 'footer_disclaimer' | 'notes' | 'sections_meta'>`.
Entrada `content` requerida y `authorPlaceholder = input<boolean>(false)`.
`PublicAuthorSchema` **no incluye** `is_placeholder` ni `role_label`: el DTO público
solo tiene `slug`, `display_name`, `bio` y `url`. No inventar un rol ni añadir
campos al contrato; el flag de placeholder lo calcula el servidor desde el documento
local y lo pasa la página. El enlace a `/autores/:slug` se renderiza solo cuando
`!authorPlaceholder()` y `author.slug !== 'por-confirmar'`; en caso contrario se
muestra una insignia textual «Autor por confirmar» con `aria-label`, sin enlace
roto. Mostrar `display_name`, `bio` si existe y `game_version`; `published_at`
formateado de forma determinista en UTC (`es-ES`) o «Sin fecha» cuando es `null`.
**No existe `updated_at` en el esquema**: no se muestra ni se simula una fecha de
actualización; la carencia se registra como límite parcial de FR-02 y, si el usuario
exige esa fecha, requiere una enmienda de T-006/dominio fuera de T-036. No se
corrige aquí ni se marca cobertura total de ese subrequisito.

**Insignias y fuentes**: `review_state` se muestra con texto (`borrador`,
`en_revision`, `publicado`) y `content_status` con texto (`verificado`,
`sin_verificar`, `placeholder`), siempre acompañados de forma/borde además del
color. Las fuentes respetan el orden recibido, sin mutar el array; cada una muestra
`title`, `author_name`, `license_note`, la etiqueta localizada de `kind`
(`original`, `comunidad`, `oficial`, `video`, `externa_enlace`), la fecha
`retrieved_on` y, solo si `url` es HTTP(S) sin credenciales, un enlace externo con
`rel="noopener noreferrer"` y texto descriptivo. **No existe campo `site`**: se
puede derivar el hostname de la URL validada y mostrarlo como sitio, sin inventar un
nombre editorial. URL inválida: se muestra el texto de la fuente sin enlace.
«Descargo»: se busca una nota con `kind === 'general'` y `label === 'Descargo'`,
ordenada por `position`; si no existe (caso de la guía migrada), se renderiza una
sola vez `footer_disclaimer` como bloque de descargo, porque el contenido lo exige y
AC-02 no permite omitirlo. No duplicar notas ya consumidas por T-031–T-034.

**Contrato de `gd-build-toc`**: exportar
`BuildTocContent = Pick<PublicBuild, 'title' | 'video_url' | 'sections_meta' | 'sources' | 'notes' | 'priorities' | 'skill_nodes' | 'purchase_steps' | 'loot_filter_columns' | 'devotion_steps' | 'guide_npcs'>`.
Entrada `content` requerida. La lista se deriva de `sections_meta` ordenada por
`position`, pero solo se incluyen las secciones presentes y visibles: `'resumen'`,
`'prioridades'`, `'habilidades'`, `'orden'`, `'notas'`, `'filtro-de-botin'`,
`'guia-espiritual'`, `'devociones'`, `'video'` y `'fuentes'`. Aceptar como alias
defensivos `'arboles'`, `'filtro'` y `'guia_espiritual'`, pero los `id` emitidos son
siempre los canónicos de plan §2. `video` solo aparece si `video_url` produce una
URL reproducible con el mismo validador puro exportado por T-035; `fuentes` solo si
hay fuentes o descargo; una sección con `visible: false` nunca aparece. Los `href`
se construyen con `Location.prepareExternalUrl(router.url.split('#')[0]) + '#' + id`,
preservando `baseHref`, ruta y query y descartando cualquier fragmento anterior, con
la misma técnica de T-134; no usar `RouterLink` para no romper el no-JS. No usar
`innerHTML`; los títulos se interpolan escapados.

**Layout, foco y semántica**: `nav` con `aria-label` localizado y lista de enlaces
reales. A partir de `80rem` (1280 px) el TOC es una columna lateral sticky
(`position: sticky`, `inset-block-start` con holgura para la cabecera) sin solapar el
contenido; por debajo, un `<details open>` nativo y plegable con `<summary>`
«Contenido». `details` abierto en SSR garantiza que el TOC sea legible sin
JavaScript (US1.1). Para 2.4.11, `toc.ts` ajusta en navegador
`scroll-padding-block-start` del elemento de scroll tras `afterNextRender` con la
altura real de la cabecera/TOC (operación guardada por plataforma y reversible); no
se tocan hojas globales. Verificar que al enfocar un destino con teclado el foco no
queda tapado. Estados default/hover/focus-visible/active con contraste AA, foco de
2 px, objetivos ≥ 24 px, sin overflow a 375/768/1280 y texto al 200 %. Todo texto con
`$localize`; sin animación nueva y con `prefers-reduced-motion`.

**Pruebas primero**: `build-attribution.spec.ts` y `build-toc.spec.ts` en rojo antes
de los componentes. Atribución: autor público con enlace; placeholder sin enlace y
con insignia; `por-confirmar` sin enlace; insignias con texto y no solo color;
`published_at` nulo y fecha; orden de fuentes sin mutación; URL válida, inválida y
con credenciales; etiquetas `kind`; nota «Descargo» y fallback a
`footer_disclaimer`; ausencia de `updated_at`/`role_label` sin errores; escape de
textos; SSR. TOC: solo secciones visibles y presentes, alias, ausencia de video,
orden por `position`, `href` con `baseHref` y query (incluido el caso de T-134),
`<details open>` en SSR, teclado nativo, ausencia de HTML inyectado y de duplicados.
No repetir pruebas de geometría ni de secciones ya cubiertas.

**Preview**: `build-meta-preview` sintético con autor real ficticio, un autor
placeholder, dos fuentes (una con URL válida y otra inválida) y un descargo; el TOC
con video presente y ausente según la instancia. Sin guía pendiente ni contenido
editorial real. Playwright + axe a 375/768/1280 en hidratado, bundles bloqueados y
sin JavaScript: cero violaciones, foco no tapado al navegar anclas, sticky a 1280,
`details` operable, sin overflow, zoom 200 % y consola limpia. Capturas y limpieza de
servidor/preview; registrar evidencia en `quickstart.md`.

**Cierre**: lint, formato, markdownlint, build, `check:initial-js`,
`check:public-build`, presupuestos de componente y CSS inicial. Marcar `T-036` solo
con evidencia; no marcar `T-037`/`T-020` ni afirmar que la página pública existe.

### 17.42 T-037: página `/builds/:slug` ensamblada (`BuildPage`)

**Alcance previo a código (2026-11-10)**: US1, FR-02/FR-06/FR-10/FR-11/FR-14/FR-29,
AC-01/AC-02/AC-03/AC-06/AC-09, spec §2 (composición y anclas), §4 y §5; presupuestos
§6 (`/builds/:slug` ≤ 150 kB gz inicial, SVG diferidos ≤ 40 kB, HTML ≤ 120 kB,
CSS crítico ≤ 20 kB gz). Depende de T-031, T-032, T-033, T-034, T-035, T-036,
T-135 y del contrato aprobado de T-018. Sin repositorio, fetch, storage ni API en el
navegador; sin dependencias nuevas; sin rutas ni prerender (T-020) y sin cambios de
dominio.

**Archivos exactos**: `src/app/features/build/build.page.ts`, `build.page.html`,
`build.page.css`, `build.page.spec.ts`; `src/app/features/build/preview.component.ts`,
`preview.browser.ts` y `preview.server.ts`; `angular.json` (solo
`build-page-preview` con salida `dist/build-page-preview`),
`specs/001-mvp-guias-builds/quickstart.md` y
`specs/001-mvp-guias-builds/handoff.md`. No modificar componentes de sección,
resolvers, rutas, `core/content`, `core/seo` ni backend.

**Contrato**: `BuildPage` es un componente controlado OnPush que recibe
`content = input.required<BuildPageContent>()`. `BuildPageContent` es la proyección
pública normalizada que produce el resolver de T-020: todos los campos de
`PublicBuild` necesarios para renderizar, más `authorIsPlaceholder: boolean` y
`draft: boolean`; nunca incluye `reviewed_by`, `rights_confirmed_by/on`,
`permission_ref`, notas privadas ni evidencia. La página no inyecta
`CONTENT_REPOSITORY`, no llama a `fetch`/`HttpClient`, no lee storage y no decide
derechos: si recibe un documento `pending` solo puede ser la vista local de
borradores de T-020. El ensamblado sigue el orden de `sections_meta` y el orden
canónico de plan §2: `gd-build-sections` (`resumen`), `prioridades`, los dos
`gd-skill-tree` de `habilidades`, `gd-purchase-stepper` (`orden`), `notas`,
`guia-espiritual`, `gd-loot-filter` (`filtro-de-botin`), `gd-devotion-section`
(`devociones`), `gd-video-facade` (`video`) y `gd-build-attribution` (`fuentes`),
con `gd-build-toc` en el aside. No duplicar el `h1` ni los cuerpos de sección.

**Estado de devociones y árboles**: la página es dueña de
`activeStepPosition` mediante `linkedSignal({ source: () => content().slug,
computation: () => undefined })` (o equivalente sin escritura en `effect`), de modo
que cambiar de guía lo reinicia a `undefined`; lo pasa a `gd-devotion-section` y
escucha su salida. Para los árboles, mantiene la selección emitida por
`gd-purchase-stepper` (`activeIds` compartidos por las dos instancias, `treeId`
estables `slug + '-tree-a'`/`'-tree-b'`), sin calcular barras ni puntos ni mutar
`content`. Ambos `gd-skill-tree` reciben solo los nodos de su maestría, con orden
estable; no se inventan nodos, barras ni relaciones.

**Diferido sin perder el no-JS**: los SVG pesados (`gd-skill-tree` y el mapa dentro
de `gd-devotion-section`) se envuelven en `@defer` con estrategia de viewport/idle.
El `@placeholder` y el `@loading` no son solo esqueletos: contienen la alternativa
textual esencial del bloque diferido (nombres ES/EN, barra, estado y justificación de
los nodos; posición, etiqueta, cuerpo y verificación de los pasos de devoción,
incluidos los pasos sin constelación) para que el HTML prerenderizado y el modo sin
JavaScript conserven AC-02/AC-03. Los esqueletos Cairn usan tokens existentes y
`aria-hidden` cuando son decorativos; no se anuncia dos veces la misma lista. No se
asume hidratación incremental (`@defer (hydrate ...)`) sin verificarla en el builder;
si no está disponible, el placeholder textual es la garantía contractual. No diferir
el `h1`, el resumen, prioridades, notas, filtro, atribución ni el TOC.

**SEO, borradores y anclas**: `SeoService.setPage` emite title, description,
canonical, OG/Twitter y JSON-LD `Article` + `BreadcrumbList` con solo datos públicos
(título, autor público, fechas, `isBasedOn`/`citation` y licencia cuando existan).
Con `draft` o `INCLUDE_DRAFTS` se muestra en la parte superior el banner textual
«Borrador · no público» (`role="status"`), se usa `noindex,follow` y no se afirma
publicación ni autoría verificada. La página pública no incluye la ruta mientras
`rights_status` sea `pending`: esa exclusión pertenece a T-020/T-062 y se defiende
también en el resolver, no con un `if` de plantilla. Las anclas `#resumen`,
`#prioridades`, `#habilidades`, `#orden`, `#notas`, `#filtro-de-botin`,
`#guia-espiritual`, `#devociones`, `#video` y `#fuentes` deben existir cuando su
sección es visible; `#devociones` debe funcionar sin JavaScript. El HTML sin JS
contiene `h1`, las diez secciones y el JSON-LD; no se acepta un 200 vacío.

**Pruebas primero**: `build.page.spec.ts` en rojo antes de la página, con contenido
sintético y con `content/builds/chaman-demoledor-golpe-primigenio.json` importado
solo desde el test. Comprobar: orden de secciones, dos árboles con nodos filtrados,
selección del stepper reflejada en ambos, `activeStepPosition` propio y reinicio al
cambiar `content().slug`, salida de devoción, `video_url: null` sin nodo de fachada,
TOC presente, banner y `noindex` en borrador, ausencia de banner y `index` en
público, JSON-LD `Article`/`BreadcrumbList` sin claves privadas, anclas y `h1`
únicos, escape de textos, ausencia de dependencias de repositorio/HTTP/storage
(construir el TestBed sin proveerlas debe funcionar) y `@defer` con contenido
textual en el placeholder. Verificar que el `h1` no se duplica y que no hay
`innerHTML`.

**Preview**: `build-page-preview` con una guía sintética completa (dos maestrías,
árboles, pasos de compra, filtro, devociones, video válido, autor y fuentes
ficticios) y sin la guía pendiente. `noindex` en el preview. Playwright + axe a
375/768/1280 en hidratado, bundles bloqueados y sin JavaScript: cero violaciones,
`h1` y secciones presentes, anclas y TOC operables, foco no tapado, placeholders
legibles, sin overflow, zoom 200 %, sin peticiones externas antes de activar el
video y consola limpia. Medir gzip/HTML de la ruta y confirmar que los SVG quedan en
chunks diferidos. Capturas, servidor y preview limpiados; evidencia en
`quickstart.md`.

**Cierre**: lint, formato, markdownlint, suites acotadas, `pnpm build`,
`pnpm check:initial-js`, `pnpm check:public-build`, presupuestos §6 y ausencia del
preview en el artefacto público. Marcar `T-037` solo con evidencia; no marcar
`T-020` (rutas/prerender/404) ni `T-040`/`T-041`/`T-126`, y no publicar la guía.

### 17.43 T-020: rutas lazy, `getPrerenderParams`, resolvers y 404 con estado

**Alcance previo a código (2026-11-10)**: FR-10/FR-10a, AC-01/AC-09, AC-16, spec §2
(`/builds/:slug` SSG y anclas) y plan §2. Depende de T-010 (repositorio y
`listSlugs` filtrado), T-018 (SEO), T-037 (página ensamblada), T-048 (descriptor de
iconos), T-062/T-060 (adaptador API) y T-135. Sin borradores en API; sin cambios de
contenido editorial; sin despliegue ni CI de hosting.

**Archivos exactos**: `src/app/app.routes.ts`, `src/app/app.routes.server.ts`,
`src/app/core/content/content.resolvers.ts`,
`src/app/core/content/content.resolvers.spec.ts`,
`src/app/features/build/build.page.spec.ts` (ampliación de aserciones de ruta),
`src/app/features/static-pages/not-found.page.ts` (no existía y es imprescindible
para el 404; plantilla y estilos inline pequeños),
`specs/001-mvp-guias-builds/quickstart.md` y
`specs/001-mvp-guias-builds/handoff.md`. No modificar `T-037` salvo las aserciones
de ruta indicadas, ni componentes, dominio, backend, dependencias o infraestructura
para esta tarea.

**Rutas y prerender**: añadir a `app.routes.ts` la ruta lazy
`builds/:slug` con `loadComponent` y `resolve: { build: resolveBuildPage }`, y una
ruta `**` lazy a `NotFoundPage`; conservar intactas las rutas existentes. En
`app.routes.server.ts`, declarar `builds/:slug` como `RenderMode.Prerender` con
`fallback: PrerenderFallback.None` y `getPrerenderParams()` que devuelve
`{ slug }` desde `CONTENT_REPOSITORY.listSlugs()` ya filtrado por derechos.
`getPrerenderParams` reutiliza la fuente inicializada por el
`provideAppInitializer` de `app.config.server.ts` (no se modifica ese archivo ni se
crea un segundo cargador); si el orden del builder no garantiza la inicialización,
se registra el bloqueo y no se consulta la API directamente desde la ruta.
Con `INCLUDE_DRAFTS=true` (solo local) el repositorio incluye la guía `pending` y
prerenderiza `/builds/chaman-demoledor-golpe-primigenio` con banner y `noindex`; con
el build público/release `listSlugs()` no la devuelve y la ruta no se genera. No
duplicar el repositorio, no abrir una segunda fuente y no habilitar borradores en
API. Mantener la ruta `**` en `RenderMode.Prerender` para producir `404.html`; si el
builder no lo emite, la tarea queda bloqueada y se documenta, no se simula el
artefacto.

**Resolver y transferencia**: `content.resolvers.ts` define
`BUILD_PAGE_STATE = makeStateKey<BuildPageData | null>('gd-public-build')` y
`resolveBuildPage(route)`. En servidor (`isPlatformServer`) inyecta
`CONTENT_REPOSITORY`, valida el slug con la misma expresión que el dominio y llama a
`findBuild(slug)`. Normaliza el resultado a `BuildPageData` (`BuildPageContent` de
T-037 + `draft` + `authorIsPlaceholder`), sin copiar campos privados, y lo guarda en
`TransferState`. En navegador lee únicamente `TransferState`; si falta, devuelve
`null` sin fetch. Un documento no `publicado` solo se acepta si el build es local
con `INCLUDE_DRAFTS`; con `rights_status` no aprobado y sin borradores locales se
devuelve `null` (defensa de AC-09). Un slug inválido, inexistente o incoherente
produce `null`, nunca una página 200 con datos ajenos. El snapshot es por ruta: la
navegación cliente entre dos guías no está soportada por este contrato y no es
alcanzable en el MVP (0 guías públicas; la borrador no se enlaza); si en el futuro
se enlazan varias, T-025/T-038 deberán ampliar el snapshot o forzar carga completa,
fuera de T-020. Se registra como límite, no como deuda silenciosa.

**404 con estado real**: `NotFoundPage` es estática, con `h1` localizado, enlace a
`/` y `/tier-list`, `noindex,follow` y sin dependencias de datos. La ruta `**` debe
renderizarla y el artefacto prerenderizado debe contener `404.html` con ese HTML (no
un index 200). La verificación local incluye: existencia de `404.html`; respuesta
HTTP 404 con ese cuerpo desde el servidor estático local usado para evidencias; y
que el `index.html` de un slug inexistente no se sirve como éxito. El estado HTTP
real al desplegar es responsabilidad de la configuración del hosting, diferida; no
se declara resuelta por el artefacto solo. No añadir un guard que convierta 404 en
200 ni un `redirectTo` silencioso.

**FR-16 antes de cerrar**: T-020 no puede acreditar FR-16 solo con la prueba fixture
de T-048. Antes de marcarla, el adaptador API debe exponer descriptores públicos de
activos aprobados (slug, `file_path`, `fallback_svg` y dimensiones si existen) desde
una ruta de solo lectura, sin `origin_url`, `rights_holder`, `license_or_permission`
ni `proof_ref`; el consumidor server los valida con `resolveIcon` y los pasa a la
vista. Esto exige ampliar, en el mismo cierre: `apps/api/src/routes/content.ts`,
`apps/api/src/content/map-content.ts`, `apps/api/test/content.int.spec.ts`,
`packages/domain/src/asset.ts`, `src/app/core/content/api.repository.ts`,
`src/app/core/content/api.repository.server.test.mts`,
`src/app/shared/ui/icon/resolve-icon.server.ts` y
`src/app/shared/ui/icon/registry.ts`. Sin ese cableado, FR-16 sigue abierto y T-020
no se marca aunque rutas y 404 pasen.

**Pruebas primero**: `content.resolvers.spec.ts` en rojo antes del resolver:
fixture público excluye la guía `pending`; fixture local con `INCLUDE_DRAFTS`
la incluye; normalización sin campos privados; `authorIsPlaceholder` y `draft`
correctos; `rights_status` no aprobado devuelve `null` sin borradores; slug inválido,
inexistente y con mayúsculas/espacios; lectura de `TransferState` en navegador sin
repositorio; no hay fetch ni acceso a storage. `build.page.spec.ts` añade las
aserciones de ruta: `builds/:slug` es lazy y tiene `resolve`; `**` apunta a
`NotFoundPage`; `NotFoundPage` no importa contenido ni repositorio. Prueba de
artefacto: el build público no contiene `builds/chaman-demoledor-golpe-primigenio` y
sí `404.html`; el build local con `INCLUDE_DRAFTS=true` contiene esa ruta con
banner/noindex y `404.html`; ambos sin JSON-LD de contenido pendiente en público.

**Verificación**: `pnpm build` público y build local con `INCLUDE_DRAFTS=true` en
directorios aislados, inspección de `404.html`, `pnpm check:initial-js` (ruta
`/builds/:slug` dentro de 150 kB gz), `pnpm check:public-build`, `pnpm lint`,
formato, markdownlint y suite acotada. Para FR-16, pruebas de contrato y de
integración API. Registrar comandos, rutas y artefactos en `quickstart.md` y
`handoff.md`; no atribuir despliegue ni CI remoto.

**Cierre**: marcar `T-020` solo con rutas, prerender, 404 y FR-16 verificados; no
marcar `T-021` (sitemap/robots), `T-040`/`T-041`/`T-126` ni el cierre de spec001.
No publicar la guía `pending` ni cambiar `T-044`.

### 17.44 T-136: revisión final con el modelo más potente antes de cerrar la spec

**Origen**: requisito explícito del usuario (2026-11-10): «antes de marcar esta
spec como terminada, que un modelo de pago (el más potente disponible) revise el
código de lo que se trabajó en esta spec».

**Alcance**: puerta de calidad **adicional** a la puerta de spec002, no un
sustituto. spec002 exige cuatro revisores (código, arquitectura, seguridad,
buenas prácticas) con evidencia vigente; T-136 añade que el **revisor de código
sea el modelo de pago más potente disponible en ese momento** y que su informe
quede registrado antes de cualquier declaración de cierre.

**Archivos**: `specs/001-mvp-guias-builds/quickstart.md` (resultado saneado de la
revisión), `specs/001-mvp-guias-builds/handoff.md` (estado de la puerta) y, si la
revisión produce hallazgos, las tareas nuevas que se registren en `tasks.md`
antes de corregirlos. No modifica código por sí misma.

**Procedimiento**:

1. Comprobar disponibilidad real de los modelos de pago. Orden de preferencia:
   `opencode-go/gemini-4-argon#high`, `opencode-go/kimi-k3.1-pro#high`,
   `opencode-go/grok-4.7#xhigh`, `deepseek/deepseek-v4-pro#max`. Si ninguno está
   disponible, **no se ejecuta** y el cierre queda pendiente; no se sustituye por
   un modelo flash ni por el ejecutor.
2. Determinar el alcance real a revisar: los archivos que las tareas cerradas de
   la spec tocaron, según su lista autorizada y `git status`, más la evidencia de
   `quickstart.md`.
3. Ejecutar una revisión **independiente del implementador** con el skill
   `.agents/skills/review-code/SKILL.md` y el contrato de
   `specs/002-spec-completion-reviews/contracts/review-gate.md`.
4. Registrar en `quickstart.md`: modelo usado, identificador de la revisión,
   alcance revisado, cobertura, hallazgos con severidad y ubicación, y
   limitaciones. Sin secretos ni valores sensibles.
5. Un hallazgo CRITICAL/HIGH bloquea el cierre y exige planificar la corrección
   en SDD antes de tocar código.

**Si solo está disponible `deepseek/deepseek-v4.1-flash-1017`**: es un modelo de
pago (`deepseek/deepseek-flash`, $0,15/$0,60), pero de la misma clase que el
orquestador y los ejecutores, así que su independencia es de actor y no de
capacidad. En ese caso:

- Se permite ejecutarlo **solo** con estas tres condiciones: sesión nueva sin
  contexto del implementador, uso del skill `review-code` y del contrato de
  revisor, y **una segunda pasada con una familia de modelo distinta**
  (`opencode/glm-5.3-flash-free` o `opencode/nemotron-3.5-super-vl-free`) para
  cubrir los sesgos propios de la familia DeepSeek.
- El informe se registra con la etiqueta **«modelo de continuidad; no es el más
  potente disponible»** y el orquestador verifica cada hallazgo de primera mano.
- Si el usuario exige el requisito literal, la puerta queda **pendiente** hasta
  que vuelva un modelo de gama superior; no se declara cumplida con un flash.

No se admite como revisor el propio implementador ni una sesión que herede su
contexto.

**Aceptación**: existe una revisión de código real, ejecutada por un modelo de
pago distinto del implementador, registrada con modelo y alcance, sobre los
archivos de la spec; cero hallazgos CRITICAL/HIGH abiertos o correcciones
planificadas. Si no hubo modelo de pago disponible, la tarea queda pendiente con
la causa registrada.

**Cierre**: marcar `T-136` solo con la revisión registrada. No sustituye a
`T-013`/`T-014` de spec002 ni a `T-040`–`T-043`, `T-126` o `T-128`.

### 17.45 T-138: inglés primario y español como configuración regional completa

**Origen**: enmienda 1.9.0 del principio X y petición del usuario (2026-11-10): el
proyecto es open source, así que el inglés es el idioma primario del sitio y el
español una opción completa, no un añadido.

**Alcance**: configuración regional en Angular. El sitio hoy usa `$localize` y
declara `<html lang="es-419">` sin catálogos: hay una sola configuración regional
implícita. Esta tarea la convierte en dos reales.

**Archivos**: `angular.json` (configuraciones `en` y `es` con `localize` e
`i18nMissingTranslation: error`), `src/index.html`, `src/locale/messages.en.xlf`,
`src/locale/messages.es.xlf`, un conmutador de idioma accesible en el layout,
`scripts/check-locale-parity.mts` y su prueba, `package.json`,
`scripts/verify-local.mjs`, `specs/001-mvp-guias-builds/quickstart.md`.

**Contrato**: `en` es la configuración regional por defecto y la que se sirve en la
raíz; `es` se sirve bajo `/es` (o subdominio decidido en el plan de hosting, que
sigue diferido). El conmutador es un enlace real navegable sin JavaScript que
conserva ruta y query, nunca un botón con handler. Cada configuración regional
prerenderiza las mismas rutas. `hreflang` recíproco y `canonical` propio por
configuración regional. Los enlaces internos se generan con la configuración
regional activa, sin perder `baseHref`.

**Puerta de paridad**: `check:locale-parity.mts` compara los dos catálogos XLF y
falla si una cadena existe en uno y no en el otro, o si alguna traducción está
vacía. Con `i18nMissingTranslation: error`, una cadena sin traducir rompe el build
en vez de publicarse en silencio. Las pruebas comprueban que ambas configuraciones
renderizan el mismo conjunto de secciones y los mismos `id` de anclaje.

**Contenido**: los textos editoriales llevan `locale`; el contenido sin traducción
se muestra en su idioma original con `lang` explícito, nunca traducido por
invención. Los nombres de juego ya se guardan en `es` y `en` (principio VI).

**Límite**: no migra `spec.md`, `plan.md`, `tasks.md` ni la documentación
operativa, que siguen en español hasta su propia tarea. No cambia el idioma de los
mensajes de commit históricos.

**Cierre**: marcar `T-138` solo con ambas configuraciones construidas, paridad en
verde, axe sin violaciones en las dos y presupuestos de `plan.md` §6 conservados.

### 17.46 T-021: sitemap y robots derivados de la fuente activa

**Alcance previo a código**: FR-11/FR-13 y AC-09/AC-13; índice y descubrimiento
públicos sin exponer contenido no publicable. Depende de T-020 (rutas y prerender
reales), T-010/T-062 (fuente de contenido) y T-018 (URL base validada). No añade
dependencias, no toca el backend y no publica la guía migrada.

**Archivos exactos**: `scripts/gen-sitemap.mts`, `scripts/gen-sitemap.test.mts`,
`public/robots.txt` (plantilla versionada), `.gitignore` (solo si el sitemap se
genera y no se versiona), `package.json` (script `sitemap:generate` y su inclusión
en `build`/`build:release`), `scripts/verify-local.mjs`,
`specs/001-mvp-guias-builds/quickstart.md`.

**Regla de oro**: el sitemap **se deriva de la fuente activa del build**, no de un
archivo escrito a mano. Con `CONTENT_SOURCE=fixture` se genera para desarrollo y el
artefacto queda marcado como no publicable; con `CONTENT_SOURCE=api` se genera desde
la API. Nunca se versiona un `sitemap.xml` con contenido: se genera en `dist/`.

**Entradas incluidas**: exactamente las rutas prerenderizadas que el build produjo,
leídas del propio artefacto (no de una lista paralela que pueda divergir):

- `/`, `/tier-list`, `/acerca`.
- `/autores/:slug` solo para autores con contenido visible y sin `is_placeholder`.
- `/builds/:slug` solo para builds con `review_state=publicado` y
  `rights_status` aprobado.

Si una ruta está en el sitemap y no existe en `dist/`, la tarea falla: es la forma
de detectar que el filtro público y el prerender divergen.

**Entradas excluidas, con prueba**: `borrador`, `en_revision`, `rights_status`
`pending`/denegado/revocado, `link_only` sin cuerpo publicado, rutas de preview
(`*-preview`), `404.html` y cualquier ruta con `noindex`.

**robots.txt**: plantilla versionada en `public/robots.txt` con `User-agent: *`,
`Allow: /` y la línea `Sitemap: <BASE_URL>/sitemap.xml` sustituida en build. El
build **falla** si `BASE_URL` no es una URL absoluta válida, reutilizando el
validador de `src/app/core/seo/site-url.ts` (misma regla, sin duplicarla). El build
público no incluye `Disallow` hacia rutas inexistentes ni `noindex` global.

**Determinismo**: orden estable por ruta, sin fechas del reloj de la máquina; si se
incluye `lastmod`, se toma de la fecha pública del contenido
(`published_at`/`updated_at` cuando exista), no de `Date.now()`. Dos ejecuciones
seguidas sobre la misma fuente producen bytes idénticos (prueba de idempotencia).

**Pruebas primero**: `gen-sitemap.test.mts` en rojo antes del script, con fixtures
sintéticos propios:

1. Incluye las rutas publicadas y excluye cada estado no publicable.
2. Falla si una ruta del sitemap no existe en el artefacto de build.
3. `robots.txt` recibe la `BASE_URL` absoluta; una URL relativa, con credenciales,
   query o fragmento falla.
4. Dos ejecuciones producen el mismo hash.
5. El sitemap no contiene `*-preview`, `404` ni rutas con `noindex`.

**Verificación**: `pnpm sitemap:generate` sobre el build de fixtures y sobre el
build de release; inspección del `sitemap.xml` y del `robots.txt` resultantes;
`check:public-build` confirma que el artefacto público no filtra rutas pendientes.
Registrar comandos y artefactos en `quickstart.md`.

**Cierre**: marcar `T-021` solo con la generación desde la fuente activa, las
exclusiones probadas y el artefacto público verificado. No publica la guía
`pending`, no cambia `T-044` y no sustituye a `T-040`/`T-041`/`T-126`.

### 17.47 T-020a: remediación de T-020 (presupuesto, 404 real y FR-16)

**Origen**: `T-020` se ejecutó y quedó **PARCIAL** (2026-11-10). No se marcó. Tres
bloqueos verificados por el orquestador:

1. `pnpm build` **falla**: `bundle initial exceeded maximum budget. Budget 300.00 kB
was not met by 6.11 kB with a total of 306.11 kB` (log
   `%TEMP%\gd-t020-verify-build.log`).
2. Angular 21.2.29 **no emite `404.html`** con el catch-all del prerender.
3. **FR-16 sigue abierto**: falta el endpoint de descriptores públicos de activos
   aprobados y su consumidor con `resolveIcon`.

**Causa del presupuesto**: `content.resolvers.ts` importa `CONTENT_REPOSITORY`
desde `./repository` de forma **estática**. El resolver es estático por naturaleza
(lo importa `app.routes.ts`), así que arrastra el repositorio y el dominio al chunk
inicial. La base pasaba con 300 kB; el añadido son 6,11 kB.

**Regla que no se puede romper**: los presupuestos de `plan.md` §6 **no se amplían
para conseguir verde** (constitución IV y las tareas T-003/T-132/T-133). La solución
es sacar el peso del chunk inicial, no subir el límite.

**Archivos autorizados**: `src/app/core/content/content.resolvers.ts`,
`content.resolvers.spec.ts`, `src/app/app.routes.server.ts`, `app.routes.spec.ts`,
`src/app/features/build/build-route.page.ts`, `src/app/features/static-pages/not-found.page.ts`,
`scripts/emit-404.mts`, `scripts/emit-404.test.mts`, `package.json`
(encadenar el emisor en `build`/`build:release`), `apps/api/src/routes/content.ts`,
`apps/api/src/content/map-content.ts`, `apps/api/test/content.int.spec.ts`,
`src/app/core/content/api.repository.ts`, `src/app/shared/ui/icon/resolve-icon.server.ts`,
`specs/001-mvp-guias-builds/quickstart.md`, `handoff.md`, `tasks.md`.

**Arreglo 1 — presupuesto**: el resolver no debe importar el repositorio ni el
dominio de forma estática. Solo `TransferState` en el navegador; en servidor, carga
diferida (`await import(...)`) del repositorio y del validador. Criterio: `pnpm
build` vuelve a verde **sin** tocar `angular.json`, `check:initial-js` vuelve a
105 259/110 000 gzip en `/tier-list` y el chunk inicial queda bajo 300 kB.

**Arreglo 2 — `404.html` real**: script de post-build
`scripts/emit-404.mts` que toma el HTML del comodín prerenderizado y escribe
`404.html` en la raíz del artefacto, con prueba que falla si el archivo no existe o
si su contenido no es la página 404. Se encadena en `build` y `build:release`. No se
inventa un 200 disfrazado: el archivo existe y el host lo sirve con su estado.

**Arreglo 3 — FR-16**: endpoint de solo lectura que devuelve los descriptores
públicos de activos `approved` (sin evidencia privada) y consumidor en la web que
llama `resolveIcon`. Prueba de contrato: un activo `pending` produce fallback SVG y
nunca el activo oficial; un `approved` completo produce el descriptor público.

**Aceptación**: los tres arreglos verificados con evidencia; `pnpm verify` verde;
build público sin la ruta de la guía `pending` y con `404.html`; build local con
`INCLUDE_DRAFTS` con banner y `noindex`; presupuestos intactos.

**Cierre**: `T-020` solo se marca **después** de que esta remediación pase. Mientras
tanto sigue abierta, con su estado PARCIAL registrado en `handoff.md`.

**Excepción autorizada de presupuesto (2026-11-10)**: el usuario autorizó subir el
budget raw del bundle inicial de `280/300 kB` a `300/320 kB` en `angular.json` para
desbloquear `T-020`, tras comprobar que el exceso de 6,23 kB viene de framework
compartido con el chunk lazy de `BuildPage` y no de código propio evitable. Es una
excepción **explícita y registrada**, no un relajamiento silencioso: los presupuestos
gzip de §6 (`90 000` portada, `110 000` catálogo) **siguen intactos** y se miden
después del arreglo. Cualquier nuevo exceso gzip se corrige recortando peso, no
subiendo el límite.

### 17.48 T-020b: devolver `/tier-list` a su presupuesto gzip sin tocar límites

**Origen**: tras autorizar el budget raw a `300/320 kB`, `T-020` sigue fallando en la
puerta gzip: `check:initial-js FALLÓ /tier-list (110 996/110 000 bytes gzip nivel 6)`.
Antes de `T-020` la cifra era **105 259**. El exceso es de **996 bytes** y el
crecimiento atribuible a `T-020` ronda **5,7 kB**.

**Restricción**: el techo de `110 000` bytes gzip **no se toca**. Se recorta peso.

**Diagnóstico verificado**: `/tier-list` precarga once chunks, entre ellos
`chunk-XUCRLYTB.js` (64 648 gzip), `chunk-23EENDPT.js` (20 464 gzip) y
`chunk-ZFVT2EQO.js` (6 468 gzip). El resolver de `/builds/:slug` se importa de forma
estática desde `app.routes.ts`, así que su código entra en el grafo inicial y se
precarga en todas las rutas, incluida `/tier-list`.

**Objetivo**: identificar qué chunk creció por `T-020` y sacarlo del grafo inicial
sin perder la ruta, el prerender ni el 404.

**Archivos autorizados**: `src/app/app.routes.ts`, `src/app/core/content/content.resolvers.ts`,
`src/app/features/static-pages/not-found.page.ts`, `src/app/core/seo/seo.service.ts`
(solo si el peso viene de ahí), `scripts/check-initial-js.mts` (solo lectura; no
relajar la medición), `specs/001-mvp-guias-builds/{quickstart,handoff}.md`.

**Aceptación**: `pnpm build` en verde con `check:initial-js` mostrando
`/tier-list` ≤ 110 000 gzip y `/` en 0; ningún cambio en `angular.json` ni en los
umbrales de §6; la ruta `/builds/:slug` sigue prerenderizándose en modo borradores y
sigue ausente del build público.

**Cierre**: marcar `T-020` solo cuando esta tarea y `T-020a` estén verdes.

### 17.49 Fase de calidad multiagente y orquestación jerárquica

**Origen**: petición del usuario (2026-11-10): tests adversariales,
property-based testing, mutation testing, contexto de herdr documentado y una
jerarquía de orquestadores por dominio (UI, tests, backend, infraestructura).

Estas tareas **no bloquean** el cierre del MVP; se ejecutan después del hito de
cierre, salvo `T-143`, que ya está hecha.

#### T-139 — Jerarquía de orquestadores por dominio

**Problema**: hoy hay un único orquestador que despacha a todos los roles. Con más
dominios (UI, tests, backend, infraestructura, contenido) eso produce dos fallos
conocidos: el orquestador pierde contexto de dominio y verifica con menos criterio
del que el dominio exige.

**Diseño**: dos niveles.

```text
Orquestador de programa (nivel 0)
  ├── Orquestador de UI          → sdd-ui
  ├── Orquestador de tests       → pruebas, property-based, mutación
  ├── Orquestador de backend     → sdd-implement + API/BD
  └── Orquestador de infra/CI    → pipelines, contenedores, secretos
```

Reglas del modelo:

1. **El nivel 0 no ejecuta**: decide alcance, reparte entre dominios, arbitra
   conflictos entre orquestadores y es el único que habla con el usuario.
2. **Cada orquestador de dominio** tiene: un conjunto de tareas, sus propias
   puertas de verificación y sus propios agentes «empleados».
3. **Contrato de reporte idéntico** al de `~/.copilot/sdd/ORCHESTRATION.md` §3. Un
   orquestador de dominio devuelve el mismo bloque que un agente, agregando por
   tarea.
4. **Sin delegación cruzada**: un orquestador de dominio no despacha a otro
   dominio; escala al nivel 0.
5. **Propiedad de archivos**: si dos dominios necesitan el mismo archivo, el nivel 0
   serializa. Nunca en paralelo.
6. **Presupuesto de modelos**: cada orquestador declara el modelo con el que trabaja;
   el nivel 0 aplica la cadena de fallback del `AGENTS.md`.

**Entregables**: este diseño en `ORCHESTRATION.md` §12, una definición
`sdd-orchestrator-domain` en `~/.copilot/agents/`, y un ensayo real con dos dominios
(UI y tests) sobre una tarea pequeña.

**Aceptación**: dos orquestadores de dominio trabajando en tareas disjuntas,
reportes agregados correctamente por el nivel 0, y cero ediciones cruzadas.

#### T-140 — Property-based testing

**Objetivo**: cubrir las funciones puras del dominio con propiedades, no con casos.

**Alcance**: `packages/domain` (`publicFilter`, reglas de derechos y publicación,
filtros del catálogo, serialización de filtros a query). Biblioteca `fast-check`
como dependencia de desarrollo, versión fijada y justificada.

**Propiedades mínimas**:

- `publicFilter` es idempotente y su resultado nunca contiene `borrador`,
  `en_revision` ni derechos no aprobados.
- La serialización de filtros hace round-trip exacto con la deserialización.
- Cualquier build publicado satisface las mismas invariantes que el esquema Zod.
- El orden de las colecciones es estable ante permutaciones de la entrada.

**Aceptación**: `pnpm --filter @gd/domain test:properties` en verde, con semillas
reportadas y sin falsos positivos; los contadores por propiedad quedan en el log.

#### T-141 — Tests adversariales

**Objetivo**: probar el sistema con entradas hostiles, no con las amables.

**Alcance**:

- Contenido: JSON con campos de más y de menos, tipos cambiados, `rights_status`
  falsificado, referencias cruzadas rotas, ciclos de `parent`, textos con HTML/JS,
  URLs con credenciales, Unicode RTL y homoglifos.
- UI: payloads con HTML inyectado en cada campo interpolado, listas vacías, valores
  `null` donde el esquema los permite, y números fuera de rango.
- API: rutas con traversal, parámetros gigantes, cabeceras malformadas y métodos no
  permitidos.

**Regla**: cada caso adversario debe fallar **cerrado** (rechazo explícito o valor
seguro), nunca degradar en silencio ni filtrar datos privados.

**Aceptación**: suite adversarial en CI, con un caso por clase de ataque y evidencia
de que cada uno falla cerrado.

#### T-142 — Mutation testing

**Objetivo**: medir si las pruebas detectan defectos reales, no solo si pasan.

**Alcance**: `packages/domain` completo y las guardas de publicación/derechos.
Herramienta Stryker, versión fijada, ejecución **no bloqueante en PR** y umbral
inicial conservador.

**Método**: línea base medida y registrada; el umbral sube solo cuando el número
real lo justifica, nunca se declara por deseo.

**Aceptación**: informe de mutantes con _score_ real, mutantes supervivientes
listados con su ubicación, y una tarea de seguimiento por cada grupo de mutantes
supervivientes que revele una prueba faltante.

**Límite**: la mutación se mide en el dominio, no en la UI; un _score_ alto en
plantillas no aporta.

#### T-143 — Contexto de herdr para el orquestador (hecha)

`docs/orchestration/herdr.md` documenta binario, comandos, conceptos (`space`,
`parent`, `keep`, `blocked`), lanzamiento de agentes, supervisión de bloqueos,
detección de cuelgues por PID y límites conocidos.

**Aceptación**: cubierta por el documento; no requiere código.

**Orden sugerido**: `T-143` (hecha) → `T-140` → `T-141` → `T-142` → `T-139`.
La jerarquía va al final porque necesita que las suites de calidad existan para
repartirlas entre orquestadores.

### 17.50 Bloque documental de derechos y fuentes (T-091, T-101, T-102)

**Origen**: tareas activas del MVP, sin sección de plan propia. Son documentales:
no tocan código, no publican contenido y no habilitan ninguna fuente.

**Archivos**: `docs/content/source-policy.md` (T-091),
`docs/content/permission-request-template.md` (T-101) y
`docs/content/takedown-runbook.md` (T-102). Sin dependencias ni cambios de código.

**Reglas de contenido**, derivadas de la constitución I, II y VII:

- Ninguna fuente se considera permitida por ser pública, por silencio del autor ni
  por `robots.txt`. El permiso es explícito, por fuente y por alcance.
- La atribución es obligatoria y **nunca sustituye** al permiso.
- Sin derechos confirmados solo cabe la tarjeta _link-only_ con metadatos
  factuales propios.
- Prohibido eludir controles de acceso y raspar sitios que lo prohíban.
- El canal de retirada es **GitHub Issues** del repositorio (decisión del
  2026-11-10). No se inventa correo, responsable, servicio ni SLA.

**T-091 — política de fuentes**: clases A–F con criterio de permiso, estado
inicial `pending`, y flujo de solicitud. Debe ser operativa: para cada clase, quién
puede aprobarla y qué evidencia se exige.

**T-101 — plantilla de solicitud**: cubre alcance (adaptación, traducción,
atribución, vigencia, retirada), exige respuesta explícita y registra la evidencia.
Incluye un cuerpo en español y otro en inglés (idioma primario del repo).

**T-102 — runbook de retirada**: pasos, plazos (≤ 72 h hasta la retirada efectiva),
registro del evento, despublicación cautelar, canal por GitHub Issues y qué se
conserva como evidencia. No promete plazos que el hosting no esté definido para
cumplir: se declara el objetivo operativo, no una garantía legal.

**Aceptación**: los tres documentos pasan `markdownlint`, no contienen correos ni
datos personales inventados, citan la constitución y no afirman derechos que no
existan.

### 17.51 Excepción autorizada del techo gzip del catálogo (2026-11-11)

`/tier-list` quedó en **110 011 B gzip** con techo `110 000` al añadir la ruta
`/legal`, que aporta **21 B** a `main.js` (la página en sí es un chunk lazy de
2,00 kB y no entra en el inicial). El margen previo era de **10 B**, así que
cualquier ruta nueva rompía la puerta.

El usuario **autorizó subir el techo a 110 500 B** (0,45 %) como excepción
explícita. Se implementa como constante `CATALOG_JS_LIMIT` en
`scripts/check-initial-js.mts`, con el motivo escrito junto a ella, para que el
número no vuelva a estar disperso.

Alcance de la excepción: **solo** el techo de `/tier-list`. La portada mantiene
`INITIAL_JS_LIMIT = 90 000` y su regla de 0 B con contrato estático válido. `T-144`
sigue abierta para recuperar holgura real; si se consigue, el techo se vuelve a
bajar y esta excepción se retira.

**Segunda excepción autorizada (2026-11-11, T-138)**: el sitio pasa a inglés
primario con español regional y el grafo inicial gana el soporte de hidratación
i18n (`withI18nSupport()`, 1 225 B gzip) más el conmutador de idioma. El artefacto
medido cierra en **111 949 B** y el usuario autorizó subir el techo a
**112 000 B** (1,36 % sobre 110 500). Se mantiene como constante
`CATALOG_JS_LIMIT`; `T-144` sigue siendo la vía para recuperar margen y revertir
las dos excepciones. La portada sigue en 0 B.

### 17.52 Bloque de calidad E2E, axe y Lighthouse (T-040, T-041, T-042)

**Estado de partida**: no existe `playwright.config.ts` ni `lighthouserc.json`. Solo
hay `playwright.svg.config.ts` y `e2e/svg-responsive.spec.ts`, que cubren los SVG,
no las rutas.

**Rutas objeto**: `/`, `/tier-list`, `/acerca`, `/legal`, `/autores/:slug` y
`/builds/:slug` en modo borradores (`INCLUDE_DRAFTS=true`), más el build público que
**no** contiene la guía `pending`.

**T-040 — E2E de recorrido**: `playwright.config.ts` con un `webServer` que sirve el
artefacto prerenderizado, y `e2e/journeys.spec.ts` cubriendo navegación real entre
portada → catálogo → guía → autor, filtros por URL con recarga e historial, ancla
`#devociones`, y el mismo recorrido con `javaScriptEnabled: false` comprobando que el
contenido esencial sigue en el HTML. Tres viewports (375/768/1280).

**T-041 — axe**: `e2e/a11y.spec.ts` con `@axe-core/playwright` sobre las rutas
anteriores en los tres anchos, en hidratado y con JS desactivado. Criterio: **cero
violaciones** de impactos `critical` y `serious`; las moderadas se listan con
justificación. No sustituye a la revisión manual de `T-043`.

**T-042 — Lighthouse y presupuestos**: `lighthouserc.json` con configuración móvil,
`scripts/check-performance.mts` y su prueba, midiendo LCP, CLS, TBT, JS/CSS/HTML y
las puntuaciones de `plan.md` §6. Falla si se incumple cualquiera. Debe medir sobre
el artefacto real, no sobre el servidor de desarrollo.

**Regla común**: medir el artefacto, no la intención. Un informe sin cifras no
acredita la puerta. Los tres integran en CI mediante `T-126`.

**Aceptación**: los tres comandos existen, fallan con un fixture que viola el
umbral y pasan con el artefacto actual; las cifras quedan registradas en
`quickstart.md` con fecha y entorno.

### 17.53 T-145: el TBT de las páginas estáticas y el gate de rendimiento

`T-042` construyó el gate de Lighthouse y lo ejecutó sobre el artefacto real. Las
cifras (Chrome 157.0.8103.39, Lighthouse 13.6.0, móvil, 1 pasada) dejan la puerta en
rojo por tres rutas:

| Ruta         | TBT        | Límite   | Resto                                                      |
| ------------ | ---------- | -------- | ---------------------------------------------------------- |
| `/`          | 12,9 ms    | ≤ 150 ms | LCP 906 ms, CLS 0,000, puntuaciones 1,000, JS 0 B          |
| `/tier-list` | 15,5 ms    | ≤ 150 ms | JS 110 011/110 500, CSS 8 111/20 000, HTML 111 665/120 000 |
| `/acerca`    | **260 ms** | ≤ 150 ms | LCP 790 ms, CLS 0,000, rendimiento 0,950                   |
| `/autores`   | **230 ms** | ≤ 150 ms | LCP 787 ms                                                 |
| `/legal`     | **171 ms** | ≤ 150 ms | —                                                          |

La portada ya demuestra la solución: se emite sin bootstrap cliente y su JS inicial
es 0 B. Las tres rutas lentas también son contenido estático y hoy hidratan el
bundle completo, así que el TBT viene de la hidratación, no del contenido.

**Decisión**: el límite **no se amplía**. Hasta que `T-145` corrija las páginas, el
paso `performance` queda **fuera** de `scripts/verify-local.mjs` para que un fallo
conocido no oculte regresiones nuevas; `pnpm check:performance` sigue disponible y
es el comando que mide. Una prueba en `scripts/verify-local.test.mjs` afirma que el
paso no está en `verify`, de modo que devolverlo exige borrar esa prueba a
propósito.

**Cierre de T-145**: las tres rutas bajo 150 ms de TBT, el paso `performance`
devuelto a `verify-local.mjs` y la prueba de ausencia eliminada en el mismo cambio.

**Estado 2026-11-11 (medición del orquestador de dominio de calidad)** — esta
nota corrige lo que la medición posterior desmiente. El historial de arriba se
conserva tal cual; lo que sigue es la lectura vigente.

- **Las cifras de 171–260 ms de TBT no se reproducen.** Eran pasadas sueltas bajo
  carga, y el TBT de Lighthouse depende de la contención de CPU del host. Con
  **mediana de 5 pasadas manuales** por ruta, las cifras del 2026-11-11 son `/acerca`
  44 ms, `/legal` 35 ms, `/autores` 26 ms y `/tier-list` 117,5 ms en la tanda
  peor, con un máximo de 350 ms en una corrida suelta y 60–82 ms de mediana en
  las demás tandas. Ninguna de las tres rutas «lentas» del diagnóstico original
  supera el límite de 150 ms.
- **La puerta decide por mediana de 3 (`numberOfRuns: 3`, valor rastreado en
  `lighthouserc.json`) y los umbrales siguen intactos.** No se
  amplió ningún límite de plan §6; la mediana es la que evita que un pico aislado
  de CPU se lea como regresión (misma ruta y artefacto dieron 305,7 ms en una
  pasada y 48 ms en otra).
- **El paso `performance` sí está en `scripts/verify-local.mjs`** como último
  paso, tras `build` y `public-build`, tal como exige T-042. La decisión anterior
  de dejarlo fuera queda sustituida; la prueba que afirmaba su ausencia se
  reemplazó por una positiva.
- **T-145 queda cerrada**
  (manda `tasks.md`, 2026-11-11): la emisión estática resolvió el TBT de las tres
  rutas y el paso `performance` volvió a `verify`. El margen estrecho de
  `/tier-list` queda como **observación**, sin tarea nueva y sin ampliar el
  límite de TBT.

La medición que acredita la puerta quedó en **47/47, exit 0** sobre el artefacto
finalizado; la segunda (46/47) falló solo por `robots.txt` con `__BASE_URL__` sin
sustituir en un artefacto transitorio de otro trabajo en curso. Evidencia
completa, tablas y límites en `quickstart.md`, sección «Evidencia ejecutada -
Rendimiento T-042 (2026-11-11)».

### 17.54 T-146: el contenido editorial y su `locale` explícito

**Origen**: contrato «Contenido» de T-138 (§17.45). La mecánica de idioma quedó
cerrada, pero el catálogo sigue pintando `title` y `name_es` en ambos idiomas:
la portada inglesa y la española muestran el mismo título de catálogo y las
mismas etiquetas de maestría. La guía (`BuildContentSchema`) ya declara
`locale: 'es'`; el catálogo no.

**Alcance**: añadir `locale` al contenido del catálogo y elegir el nombre de
maestría según la configuración regional activa (`name_en` en `en`, `name_es` en
`es`). El texto editorial sin versión inglesa se muestra en su idioma original
con `lang` explícito y nunca se traduce por invención. No cambia el esquema
público de builds ni la puerta de derechos.

**Archivos**: `packages/domain/src/schema.ts` y su prueba,
`content/tier-lists/principal.json`, `src/app/features/tier-list/catalog.model.ts`
y su prueba, `src/app/core/content/catalog.server.ts`,
`src/app/core/content/catalog.resolver.ts`, migración y vistas públicas en
`apps/api/drizzle/**`, `apps/api/test/schema-parity.spec.ts` y
`specs/001-mvp-guias-builds/data-model.md`.

**Aceptación**: esquema y migración en paridad; el catálogo inglés muestra
`name_en` y el español `name_es`; el título sin traducción lleva `lang`; pruebas
de dominio, API y UI en verde; sin cambios en los presupuestos de §6.

**Cierre**: no reabre T-138. Se marca cuando la paridad de esquema y la UI de
ambos idiomas lo acrediten.

### 17.55 T-144: recuperar holgura real en el JS inicial de `/tier-list`

**Origen**: T-138 dejó el catálogo en **111 955/112 000 B gzip** (45 B de
margen) tras la segunda excepción de §17.51. Cualquier cadena nueva vuelve a
romper la puerta. T-144 sigue abierta con el objetivo de ≥ 1 000 B de holgura sin
tocar umbrales ni quitar `withEventReplay()`.

**Diagnóstico** (stats de producción del artefacto del 2026-11-11): el grafo
inicial de `/tier-list` está dominado por Angular (core `_debug_node` 119 442 B
de salida, router 74 136 B, platform-browser 22 923 B); el código propio son
~26 KB de salida repartidos en la página y componentes (15,5 KB), el modelo de
catálogo y filtros (5,5 KB) y SEO (4,8 KB). El icono compartido
(`icon.ts` 1 485 B + `registry.ts` 1 183 B) entra en el inicial solo por la
insignia de estado del catálogo; el resto de páginas que lo usan son lazy o no
lo usan.

**Alcance**: sacar del grafo inicial el componente `gd-icon` y su registro en la
insignia de estado, sustituyéndolo por una imagen con la misma ruta pública
(`assets/icons/status-*.svg`), el mismo fallback (`generic`) y la misma
semántica accesible (icono decorativo + texto). Si no basta para ≥ 1 000 B,
evaluar en segundo lugar el JSON-LD (`catalogItemList`) en un módulo diferido
solo de servidor, sin perder el `ItemList` del HTML prerenderizado.

**Archivos**: `src/app/features/tier-list/tier-components.ts`,
`src/app/features/tier-list/tier-components.css`,
`src/app/features/tier-list/tier-components.spec.ts`,
`scripts/check-initial-js.mts` (solo lectura/medición).

**Aceptación**: `pnpm build` verde; `check:initial-js` con `/tier-list`
≤ 111 000 B (≥ 1 000 B de holgura bajo 112 000) y `/` en 0 B; paridad visual y
accesible de la insignia (texto + icono decorativo, fallback `generic`); pruebas
de `tier-components` y `pnpm verify` en verde; sin cambiar umbrales ni
`withEventReplay()`.

**Estado 2026-11-11: hecha.** El artefacto cierra en **110 996/112 000 B**:
**1 004 B de holgura** (antes 45 B). Cambios medidos: la insignia de estado del
catálogo deja de importar `gd-icon` y su registro (1 485 + 1 183 B de salida) y
pinta la misma ruta pública (`assets/icons/status-*.svg`) con el mismo fallback
`generic`; `applyFilter` pasa a ser genérico y elimina el map/set intermedio de
la página; el conmutador se integra en `SiteLayout`, que ya trackea la URL, y
desaparece el componente extra. Sin tocar umbrales, `withEventReplay()` ni el
contrato accesible de la insignia (texto + icono decorativo). Verificado con
`pnpm verify` OK, `pnpm test` 297/297, `e2e:a11y` 51/51 y `e2e:journeys` 21/21.
La excepción de 112 000 B se mantiene porque el coste estructural de i18n
(1 225 B) impide bajar a 110 500: recuperar esa cifra exigiría otros ~500 B y
queda como trabajo posterior, no como cambio de umbral.

**Estado 2026-11-11: hecha.** `TierListContentSchema` y `PublicTierListSchema`
declaran `locale: 'es'`; `CatalogInput` lo transporta y `buildCatalog(input,
locale)` resuelve nombres de maestría y combinaciones según el idioma activo
(`name_en` en inglés, `name_es` en español). El catálogo expone `contentLocale`
para que el `<h1>` lleve `lang="es"` solo cuando el contenido no está en el
idioma de la página. En base de datos, la migración `0006` añade `locale` a
`tier_lists` (default `es`), `v_public_tier_lists` lo publica al final de la
vista y `TIER_QUERY` lo proyecta; no se tocaron derechos, DTO privados ni
presupuestos de §6. Evidencia: `content:validate`/`catalog:check` OK, dominio
151/151 (2 `it.fails` preexistentes), API 257/257 (48 integraciones omitidas),
app 299/299, `test:scripts` 440/442, `pnpm verify` OK, `e2e:a11y` 51/51 y
`e2e:journeys` 21/21. JS inicial: **111 111/112 000 B** (889 B de holgura).

### 17.56 T-147: espacios de Herdr por orquestador, nunca pestañas en la instancia actual

**Origen**: corrección del usuario (2026-11-11). El procedimiento documentado
creaba la pestaña con los ids del **espacio y pestaña activos** (`$s.space`,
`$s.tab`), así que un orquestador de dominio acababa como pestaña dentro de la
misma instancia del nivel 0, con dos autores sobre el mismo espacio y sin la
separación que exige la jerarquía.

**Contrato**: cada orquestador de dominio se abre en un **espacio nuevo** de
Herdr. El nombre del espacio es `<proyecto>/<especialidad>` en minúsculas con
guiones (`grim-dawn-builds/ui`, `grim-dawn-builds/tests`). El espacio arranca
con un agente orquestador interactivo (`opencode --auto` con el prompt dentro de
`argv`) que recibe la tarea y despacha sub-tareas a **sus propios subagentes**.
El nivel 0 no crea pestañas de dominio en su propia instancia.

**Herramienta**: `scripts/herdr-space.mts` construye y ejecuta
`herdr-app do space.new --name <proyecto>/<especialidad> --folder <repo>
--tab <especialidad> --argv '["opencode","--auto","--prompt","<una línea>"]'`.
Valida el nombre (segmentos `[a-z0-9][a-z0-9-]*`), exige carpeta absoluta
existente, une el prompt en una sola línea y falla cerrada. `--print` muestra el
comando sin lanzar nada; la verificación de esta tarea usa `--print`, no abre
ventanas.

**Archivos**: `AGENTS.md`, `docs/orchestration/herdr.md`,
`docs/orchestration/hierarchy.md`, `scripts/herdr-space.mts`,
`scripts/herdr-space.test.mts`, `package.json` y el documento transversal
`C:/Users/paco_/.copilot/sdd/ORCHESTRATION.md`.

**Aceptación**: el procedimiento y las reglas compartidas prohíben la pestaña en
la instancia actual; la herramienta produce el espacio `proyecto/especialidad`
con el prompt en `argv` y falla con nombres o carpetas inválidos; pruebas de la
herramienta y `markdownlint-cli2` en verde; ningún agente real lanzado durante
la verificación.
**Estado 2026-11-11: hecha.** La política de `AGENTS.md`, `herdr.md`,
`hierarchy.md` y `~/.copilot/sdd/ORCHESTRATION.md` prohíbe abrir pestañas de
dominio en la instancia actual y fija el nombre `<proyecto>/<especialidad>`.
`scripts/herdr-space.mts` (+5 pruebas) construye el `space.new` con el prompt
dentro de `argv`, valida nombre y carpeta absoluta y falla cerrada; `--print`
muestra el comando sin lanzar nada. Ensayo `--print`: `space:
"grim-dawn-builds/ui"`, sin `--task` posicional. Evidencia: 5/5 pruebas de la
herramienta, `test:scripts` 445/447 (2 omitidos preexistentes), `lint:md` 0
incidencias y `format:check` limpio. No se lanzaron agentes reales.

### 17.57 T-148: este PC como host SSH para Herdr remoto

**Origen**: petición del usuario (2026-11-11): conectar al Herdr de este equipo
desde otra computadora y desde la app móvil.

**Diagnóstico verificado**: `hc server status` muestra el core `mamalona` vivo
(0.1.20, 1 terminal). OpenSSH Server está registrado (`sshd` Stopped/Manual,
binario en `C:\Windows\System32\OpenSSH\sshd.exe`) pero **falta**
`C:\ProgramData\ssh\sshd_config` y no hay claves de host, así que no puede
aceptar conexiones. El usuario `paco_` está en Administradores y tiene
contraseña; `%USERPROFILE%\.ssh\authorized_keys` ya tiene su clave. LAN
`192.168.100.35`; firewall TCP 22 habilitado en los tres perfiles; sin
Tailscale; NordVPN instalado con el servicio detenido.

**Alcance**: documentar el procedimiento y dejar un script idempotente para
PowerShell elevada (`scripts/setup-ssh-remote.ps1`) que instala/repara OpenSSH
Server, crea `sshd_config` desde la plantilla de Windows, genera claves de host,
arranca `sshd` al inicio, asegura la regla de firewall y autoriza claves
públicas (archivo de administradores y del usuario, con ACL correcta). La otra
computadora se empareja con `hc machine add paco_@192.168.100.35 --name
mamalona --install`; el móvil usa el mismo host en LAN o una IP de malla
(NordVPN Meshnet/Tailscale). Sin abrir el 22 a Internet.

**Archivos**: `docs/orchestration/remote-access.md`,
`scripts/setup-ssh-remote.ps1`, este plan y `tasks.md`.

**Aceptación**: el documento y el script parsean; el paso elevado queda
explícito; `sshd` escuchando en 22 tras ejecutarlo; desde el otro equipo
`ssh paco_@192.168.100.35` y `hc machine ls` muestran `mamalona` alcanzable; la
app móvil lista la máquina. **Estado 2026-11-11**: el host SSH está operativo. `sshd` quedó
`Running/Automatic`, escuchando en `0.0.0.0:22` y `[::]:22`, con la clave del
usuario autorizada y `ssh paco_@192.168.100.35 "echo hc-remote-ok"` respondiendo;
`hc machine add paco_@127.0.0.1` identifica «este core», lo que valida el
handshake de hc por SSH. El script restringe DACL y propietario de claves y
configuración, y fue suficiente para arrancar el servicio. Queda emparejar la
laptop y el móvil y verificar `hc machine ls` desde ellos. No se declara
cerrada hasta entonces.

### 17.58 S11: decisión de publicación del MVP — local (2026-11-11)

**Origen**: hallazgo C3 del informe externo. El plan difería hosting, dominio,
secretos y despliegue (§11) y el README lo confirmaba («Hosting is still deferred
and out of scope», `README.md:175-179`). Existían un build de release
(`pnpm build:release`, `pnpm check:release`) y una guarda del artefacto
(`pnpm check:public-build`) sin destino ni runbook, y la decisión estaba abierta.

**Decisión del usuario (2026-11-11)**: MVP local; el hosting queda fuera del MVP por
decisión del usuario (2026-11-11). El entregable es el artefacto estático que hoy
produce el build y se sirve en local. No hay proveedor, dominio, certificado,
pipeline de publicación ni credenciales de despliegue, y ninguno se añade.

**Tareas cerradas como fuera de alcance**: T-087 (almacén gestionado de secretos
y _break-glass_), T-088 (OIDC de GitHub Actions hacia el proveedor), T-089
(inyección de secretos en el orquestador de producción) y T-090 (calendario de
rotación en producción) salen del MVP en `tasks.md`. Si algún día se decide
publicar, continúan como backlog y se abren con su propio spec de despliegue:
workflow `deploy.yml` disparado solo por tag `v*` en `main` que ejecute
`build:release`, `check:release` y `check:public-build`; secretos únicamente en
GitHub Environments con `scripts/check-ci-secrets.mts` vigente; y runbook
`docs/release.md` con versionado, publicación, reversión y verificación posterior
(`/` y `/es`, sitemap y 404).

**Lo que no cambia**: T-126 (CI de calidad) y las tareas de verificación siguen
vigentes: verifican el artefacto, no lo publican. Se conservan la salida estática
independiente del host, `BASE_URL` configurable y la portabilidad de §11, de modo
que publicar más adelante no exige rehacer el build. La API se consume solo en
tiempo de build (`CONTENT_SOURCE=api`, §12.1), así que el MVP local no necesita
servirla en ninguna red distinta de la local.

**Consecuencia**: §11 conserva su redacción y remite a esta decisión; el estado
definitivo del MVP es local y no queda ninguna tarea de hosting abierta.

### 17.59 T-167: fachada con `lite-youtube-embed` bajo CSP

**Origen**: MEDIUM-2 de la revisión de spec001. La CSP del repo no declaraba
`frame-src`, de modo que el iframe de §17.40 caía bajo `default-src 'self'` y
quedaba bloqueado; además la fachada se quedaba en `loading` si el iframe no
cargaba.

**Cambio de enfoque (sustituye lo descrito en §17.40 para el iframe)**: el
`<iframe>` propio se sustituye por el custom element `lite-youtube` del paquete
npm `lite-youtube-embed`, importado de forma diferida (`import()`) solo en
navegador, tras la hidratación, para no subir el JS inicial. §17.40 mantiene
vigentes la validación estricta de URL, la normalización a
`youtube-nocookie.com/embed/<id>`, la ausencia de video, el reinicio por slug y la
semántica; solo cambia el mecanismo de activación y de carga.

- **Sin peticiones antes de activar**: póster local (sin petición a
  `i.ytimg.com`) y sin cookies de terceros; el iframe solo se crea tras la
  activación por clic o teclado.
- **Sin YouTube IFrame API**: `needsYTApi=false`; el script de YouTube queda fuera
  de la CSP.
- **CSP**: `frame-src https://www.youtube-nocookie.com` en
  `scripts/serve-artifact.mts` y en `infra/hosting/security-headers.conf`, en
  sincronía (la prueba de sincronía existente debe pasar).
- **Fallback**: estados `loading` → `loaded` al emitir `load` el iframe; →
  `error` si no hay `load` en 10 s o si se dispara `securitypolicyviolation` de
  `frame-src`. El enlace «Open on YouTube» se conserva siempre.
- **Accesibilidad e i18n**: la activación del botón de `lite-youtube` tiene nombre
  accesible localizado (`@@videoFacade.activate`); `@@videoFacade.playerTitle` se
  retira si ya no se usa, con paridad de catálogos.
- **Pruebas**: unitarias del componente, `scripts/serve-artifact.test.mts` y e2e de
  la fachada **bajo la CSP real** del servidor de artefacto (0 violaciones, iframe
  `youtube-nocookie.com/embed/<id>` interceptado con `page.route`, y caso de
  fallback).

**Archivos exactos**: `apps/web/package.json`, `pnpm-lock.yaml`
(`lite-youtube-embed`), `apps/web/src/app/features/build/video-facade/**`
(incluido `lite-youtube-embed.d.ts`), `scripts/serve-artifact.mts`,
`scripts/serve-artifact.test.mts`, `infra/hosting/security-headers.conf`, `e2e/**`
y los catálogos de `apps/web/src/locale/**` si aplica. Esto añade una dependencia
que §17.40 excluía («sin dependencias nuevas»); la excepción es de T-167.
