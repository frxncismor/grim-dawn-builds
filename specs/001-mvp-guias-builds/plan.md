# Plan de implementación — 001-mvp-guias-builds

**Spec**: `spec.md` (rev. 4) | **Datos**: `data-model.md` | **Constitución**: v1.3.1
**Stack (detectado)**: Angular 21 SSR/prerender en la raíz, pnpm 12.18.0 (`pnpm-workspace.yaml` presente, sin `packages:` aún), TypeScript strict, scripts `.mts` con tsx, Vitest, Zod 4. Sin `.github/`, Docker ni `apps/`/`packages/` todavía. Destino: monorepo pnpm con backend Docker (§12).
**Decisiones rev. 2**: `guide_rights=pending`, `tierlist=all_builds`, `game_art=official_assets` (con puerta), `hosting=local_first` (ver spec §0 y plan §11). **Rev. 3**: `backend=docker_monorepo`. **Rev. 4**: Fastify + Drizzle + Node 22 LTS + PostgreSQL 17; **BD = fuente de verdad** (§12).

## 1. Arquitectura
- **App única Angular** (hasta la migración de §12.3 vive en la raíz; después en `apps/web`) (standalone components, signals, `provideRouter` con `withComponentInputBinding`, `provideClientHydration(withEventReplay())`, `@angular/ssr` con `outputMode: 'static'` para prerender).
- **Capa de contenido**: interfaz `ContentRepository` (`getBuild(slug)`, `listBuilds()`, `getTierList()`, `getAuthor(slug)`, `listSlugs()`). Adaptadores (rev. 4): `ApiContentRepository` (**fuente de producción/release**, lee la API Fastify sobre PostgreSQL) y `FileContentRepository` (lee fixtures `content/*.json`; **solo desarrollo, pruebas y CI sin Docker**, `CONTENT_SOURCE=fixture`). `SupabaseContentRepository` queda **descartado** (T-011 reemplazada). Selección por token DI/variable de build; un build de release rechaza `fixture` (§12.10).
- **Puerta de derechos en la capa de contenido**: el repositorio aplica `publicFilter` (excluye `rights_status` no aprobado y `review_state≠publicado`) salvo `INCLUDE_DRAFTS=true` (solo local; banner «Borrador · no público», `noindex`, excluido de sitemap/JSON-LD). `listSlugs()` para `getPrerenderParams` pasa por el mismo filtro.
- **Puerta de activos**: `resolveIcon(id)` solo devuelve el activo oficial si `status='approved'` con procedencia completa; si no, el SVG fallback de `src/assets/icons/*.svg`. Fuente: tabla `assets` en PostgreSQL (la BD rechaza `approved` sin procedencia y `file_path` sin `approved`); en modo fixture, `content/assets/manifest.json`. `validate-content` y `check-assets` siguen validando fixtures y archivos de arte.
- **Catálogo**: `content/masteries.json` → `scripts/gen-catalog.ts` genera las ranuras `placeholder` por combinación (determinista, sin red). Prueba de cobertura.
- **Sin llamadas a API en runtime público**: los datos se incorporan al HTML prerenderizado en build (`TransferState`/resolvers); el cliente no consulta la API en el MVP. En build de release los datos vienen de la API (≤ 6 consultas SQL por petición de la API); en build `fixture` vienen de archivos.
- **Estructura**:
```
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
| Ruta | Estrategia | Notas |
|---|---|---|
| `/` | SSG | Hero, build destacada **si existe una publicada** (si no, CTA al catálogo), CTA tier list, criterios editoriales |
| `/tier-list` | SSG (+ filtros en cliente) | Catálogo completo por combinación; canonical siempre a `/tier-list` (los `?filtros` llevan `noindex,follow` o canonical base) |
| `/builds/:slug` | SSG (`getPrerenderParams` desde `listSlugs()` ya filtrado por derechos) | Anclas: `#resumen #prioridades #habilidades #orden #notas #filtro-de-botin #guia-espiritual #devociones #video #fuentes`. Borradores solo con `INCLUDE_DRAFTS` |
| `/autores/:slug` | SSG | Lista de builds del autor |
| `/acerca` | SSG | Criterios editoriales, revisión, aviso de no afiliación |
| `/legal` | SSG | Aviso legal/derechos |
| `/404` (`**`) | SSG, status 404 | Enlaces a home/tier list |
| `/sitemap.xml`, `/robots.txt` | generados en build (`scripts/gen-sitemap.ts`, en `public/`) | Solo `publicado` |
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
4. Local: `npm run verify` = validate → build/prerender (público y con `INCLUDE_DRAFTS`) → tests → e2e → axe → Lighthouse local. Importación a Supabase y CI: diferidas (§11).
5. Datos dudosos: `content_status: sin_verificar` (visible). Atribución obligatoria; fuente `original` solo con `rights_status=own_original`.
6. Sin scraping: el importador y el validador solo leen `content/`; no hay fetch de terceros. Entradas de catálogo de terceros = solo enlace + atribución + metadatos factuales propios (spec FR-15).
7. Política de listado inicial: (1) generar ranuras placeholder por combinación; (2) añadir entradas `enlace_externo` o `build_propia` una a una, cada una con source/rights/review; (3) los tiers solo con criterio editorial propio documentado o permiso registrado, si no `sin_clasificar`.
8. Manifiesto de activos: alta con `status: pending` → el editor registra origen exacto, titular, licencia/permiso y prueba → revisión → `approved`. Hasta entonces, fallback SVG.

## 6. Presupuestos de rendimiento (verificación local bloqueante; CI diferida)
| Métrica | Presupuesto (móvil, 4G lento simulado) |
|---|---|
| LCP | ≤ 2.0 s (p. objetivo en Lighthouse CI) |
| CLS | ≤ 0.05 |
| INP/TBT | INP ≤ 200 ms; TBT ≤ 150 ms |
| JS inicial (gz) | `/` ≤ 90 kB; `/tier-list` ≤ 110 kB; `/builds/:slug` ≤ 150 kB (árbol/devoción diferidos aparte ≤ 40 kB) |
| CSS crítico | ≤ 20 kB gz |
| HTML por página | ≤ 120 kB sin comprimir |
| Fuentes | Autoalojadas WOFF2 subconjunto latin+latin-ext, máx. 3 familias/5 archivos, `font-display: swap`, `preload` de la principal; **sustituye Google Fonts** |
| Queries | 0 en runtime público; ≤ 6 por página en build |
| Lighthouse | Perf ≥ 90, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 95 |
Presupuestos en `angular.json` (`budgets`) + `lighthouserc.json`. Dependencias nuevas permitidas (justificadas): `zod` (validación; alternativa descartada: validación manual por tamaño del esquema y mantenimiento; solo en scripts/build, **no** en el bundle cliente salvo tipos), `@supabase/supabase-js` (solo en build/scripts, no cliente), `@angular/ssr`. Dev: Vitest/Karma según generador, Playwright, `@axe-core/playwright`, Lighthouse CI.

## 7. Tokens de diseño (mínimo, de la guía)
```
--color-soot:#0f1218  --color-panel:#171c25  --color-panel-2:#1e242f
--color-storm:#79d0f5 --color-storm-dim:#2d4a5c
--color-ember:#f0873f --color-ember-dim:#5c3a1e
--color-bone:#e4dfd2  --color-ash:#8e8b7e  --color-line:#2a313d
--font-display:Oswald --font-body:Karla --font-mono:"Space Mono"
--space-1..8: 4,8,12,16,24,32,48,64 px   --radius-0:0 (estética angular)
--focus-ring:2px solid var(--color-storm) offset 2px
--bp-sm:375 --bp-md:768 --bp-lg:1280
```
Verificación de contraste obligatoria: `ash` (#8e8b7e) sobre `panel` ≈ 4.5:1 límite; si falla, definir `--color-ash-strong` y usarlo para texto pequeño. El texto de 9.5–11 px de la guía original sube a ≥ 12 px.

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
| Riesgo | Mitigación |
|---|---|
| Datos de devoción sin verificar | `sin_verificar` visible, aviso, tarea de revisión editorial |
| Layout esquemático impreciso | Declarado (A6); validación visual |
| Derechos de arte/guía | Gate `rights_status` + manifiesto de activos con fallback SVG; sin arte oficial hasta `approved`; guía migrada en `pending` |
| Catálogo percibido como copia/scraping | FR-15: solo ranuras, enlaces con atribución y metadatos factuales; sin texto/tiers ajenos sin permiso |
| Catálogo vacío de valor (todo placeholder) | Declarado: el MVP entrega el marco; mide cobertura, no guías; insignias claras |
| Cambio de lista de maestrías del juego | `content/masteries.json` versionado con `game_version`; combinaciones generadas, no escritas a mano |
| Dependencia de Supabase en build | `FileContentRepository` es el adaptador por defecto; Supabase portable/diferido |
| Presupuesto JS con Angular + hidratación | `@defer`, rutas lazy, medición temprana en T-012 |
| Tier seed no verificada | Prohibida: sin fuente → `sin_clasificar` |

## 10. Fuera de alcance
Ver spec §7. Se reservan las abstracciones (repositorio, esquema, i18n) pero no se implementa auth, comentarios, calculadora, scraping ni workers Go/Rust.

## 11. Local-first y portabilidad (decisión `hosting=local_first`)
- **Ahora**: `ng serve`/`ng build` locales, `docker compose` local (PostgreSQL 17 + API Fastify), Playwright/axe/Lighthouse contra `http://localhost`, sin secretos con claves ni proveedor remoto. Sin Docker, `pnpm verify` usa fixtures (marcado `source=fixture`).
- **Diferido (no implementar)**: proveedor de hosting, dominio, BD remota, secretos de despliegue, workflows de CI/**deploy**. (Los workflows de **verificación** en PR son admisibles, §12.8.)
- **Portabilidad preservada**: salida estática independiente del host; `BASE_URL` configurable; repositorio de contenido tras interfaz; PostgreSQL estándar (sin APIs de proveedor); nada en el código asume un dominio.
- **Reglas**: ningún secreto en el repositorio; `.env.example` solo con nombres de variables y valores por defecto seguros no secretos (rev. 5, ver §13.2).

## 12. Backend en Docker y monorepo pnpm (rev. 3)

### 12.1 Alcance y principios
Backend = **una** API **Fastify** (Node.js 22 LTS) + **una** PostgreSQL 17 con **Drizzle ORM**, orquestadas con Docker Compose. Sin Redis, colas, auth externa, almacenamiento de objetos ni microservicios. **PostgreSQL es la fuente de verdad** (Constitución VI/XI): las puertas de derechos/publicación/activos se imponen en la BD y la API; `packages/domain` replica las reglas puras como defensa doble y para validar fixtures. La web **no** lee BD directamente; el build de release lee la API.

### 12.2 Layout objetivo
```
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
| Capa | Responsabilidad | Prohibido |
|---|---|---|
| `apps/web` | UI, SSR/SSG, SEO, accesibilidad; consume solo `ContentRepository` | Hablar con BD; conocer columnas SQL; llamar a la API fuera del adaptador `ApiContentRepository` |
| `apps/api` | HTTP (rutas de solo lectura), validación con `@gd/domain`, acceso a BD con Drizzle, `/health` `/ready` | Reglas de negocio divergentes de `@gd/domain`; escritura pública; servir contenido no publicable; SQL concatenado |
| `packages/domain` | Esquemas Zod, tipos, reglas puras (publicación, derechos, activos, tier checks, filtros) | Dependencias de Angular, Fastify, Drizzle/drivers de BD, E/S |
| Persistencia | Esquema Drizzle + migraciones SQL versionadas, CHECK/triggers/vistas/roles; rol de BD de solo lectura para la API | Lógica de negocio en triggers más allá de las puertas de publicación/derechos/activos |
| `content/` (fixtures) | Datos de pruebas, desarrollo y material de importación | Ser fuente de producción; ser modificado por la API; importarse sobre una BD ya «bootstrapped» |
Dependencias permitidas: web→domain; api→domain; scripts→domain. Nunca web→api (en código; solo vía HTTP en el adaptador) ni api→web. Regla verificable con una comprobación de importaciones (T-052).

### 12.5 Propiedad de datos y ciclo de vida (rev. 4)
- **Fuente de verdad de producción: PostgreSQL**. `content/*.json` = fixtures. Nunca hay sincronización bidireccional ni lectura de producción desde archivos.
- **Modos de fuente** (`CONTENT_SOURCE`): `fixture` (dev/test/CI sin Docker; artefacto marcado `source=fixture`, nunca release) y `api` (único para release).
- **Ciclo de vida de la BD**:
  1. `db:migrate` — aplica migraciones Drizzle (rol `migrator`) antes de arrancar la API; tabla de control de Drizzle (`__drizzle_migrations`); `/ready` compara la última migración esperada con la aplicada.
  2. `db:seed` — carga fixtures validados con `@gd/domain`; **solo `APP_ENV=development|test`**; idempotente (upsert por slug); rechaza ejecutarse si existe la marca de bootstrap. BD desechable (`docker compose down -v` → migrate → seed).
  3. `db:bootstrap` (una vez, **diferido a B-7**) — carga el contenido real inicial en una BD vacía y escribe una fila única en `content_origin` (`bootstrapped_at`, hash de la carga, versión de migración); desde entonces el seed/import de fixtures se rechaza sobre esa BD (a nivel de script y con trigger que impide tocar filas con `origin='bootstrap'` desde el rol `importer`).
  4. Escrituras editoriales posteriores: vía B-7 (CLI editorial con rol `editor` validando con `@gd/domain`, o API admin con spec propio). Hasta resolver B-7 no hay edición de producción ni cutover.
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

### 12.6 Contrato de API (mínimo, solo lectura, sin versionar aún bajo `/api/v1`)
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

### 12.9 Decisiones (rev. 4)
| ID | Decisión | Estado |
|---|---|---|
| B-1 | Framework API | **Cerrada: Fastify** |
| B-2 | Acceso a datos/migraciones | **Cerrada: Drizzle ORM + drizzle-kit** (SQL personalizado para puertas) |
| B-3 | Versiones | **Cerrada: Node.js 22 LTS, PostgreSQL 17** (fijar tag/digest exacto al implementar T-054/T-056) |
| B-4 | BD vs `content/` | **Cerrada: BD = fuente de verdad; `content/` = fixtures/importación** |
| B-5 | CORS/orígenes | Abierta (bloquea solo T-061): local `http://localhost:4200` |
| B-6 | Consumo de la API desde la web | **Cerrada por implicación**: el build de release lee la API (T-062/T-074) |
| B-7 | Vía de escritura editorial tras el cutover (CLI `editor` vs API admin) | **Abierta**; bloquea solo T-072 (bootstrap) y la edición de producción |

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
| ID | Riesgo | Mitigación |
|---|---|---|
| R-M1 | Mover la web rompe rutas relativas/CI | Fase C aislada, reversible, con diff de build; puede diferirse |
| R-M2 | Retraso de valor: la API es ahora necesaria para release | Fases M0–M4 pequeñas; `fixture` sigue permitiendo desarrollar la UI sin Docker |
| R-M3 | Dos fuentes de producción (fixtures y BD) | FR-22; release solo `api`; bootstrap marcado en BD y seed bloqueado tras él; test de release (AC-16/17) |
| R-M4 | Fuga de secretos o BD expuesta | §12.8, T-066a/b, `compose config` en CI |
| R-M5 | Deriva Drizzle ↔ Zod ↔ migraciones | T-058 + check `drizzle-kit generate` sin diff en CI |
| R-M6 | Windows + Docker (rutas/finales de línea) | `.gitattributes` con `eol=lf` para scripts/SQL/Dockerfile (T-050) |
| R-M7 | Puertas solo en la UI/dominio y no en BD | CHECK/triggers/vistas/roles en migración personalizada + pruebas AC-15 |
| R-M8 | `drizzle-kit push` o edición manual de SQL rompe el historial | Prohibido `push` fuera de BD desechable; CI de diff de generate |
| R-M9 | Secreto commiteado, filtrado en logs/imagen/bundle web o credencial compartida entre roles de BD | §13 (capas, escaneo, roles separados, runbook), T-078–T-090 |
| R-M10 | Ingesta futura copia contenido sin permiso o lo da por permitido implícitamente | §14: registro de fuentes, puerta de permiso por fuente, `borrador` obligatorio, link-only por defecto, T-091–T-100 diferidas, AC-19 |
| R-M11 | Cutover sin vía de escritura (B-7) | Bootstrap bloqueado hasta resolver B-7; sin «producción» real antes |

## 13. Gestión de secretos por capas (rev. 5)

Principio: Constitución XII. Todo lo de esta sección que **no depende de un proveedor** es implementable ya (marcado [SIN PROVEEDOR]); lo que sí depende queda [DIFERIDO-HOSTING] y no se implementa ni se elige proveedor.

### 13.1 Categorías, propietario y ciclo de vida
| Categoría | Ejemplos | Capa | Propietario | Rotación | Revocación |
|---|---|---|---|---|---|
| C1 Credenciales de BD por rol | `DB_PASSWORD_MIGRATOR`, `_IMPORTER`, `_EDITOR`, `_API_RO`, `POSTGRES_PASSWORD` (superusuario del contenedor, solo init) | local / prod | Mantenedor (usuario) | Local: al recrear volumen o ante sospecha. Prod: ≤ 90 días o ante incidente, sin downtime (doble credencial/`ALTER ROLE`) | `ALTER ROLE … PASSWORD`/`NOLOGIN`, reiniciar consumidores |
| C2 Credenciales de CI | secretos de entorno de GitHub Actions (si hiciera falta alguno) | CI | Mantenedor | ≤ 90 días; preferir OIDC (sin secreto) | Borrar secreto en GitHub y revocar en origen |
| C3 Credenciales de despliegue/nube | tokens de registro, rol de despliegue | prod (diferido) | Mantenedor | OIDC con credenciales efímeras; si no, ≤ 90 días | Revocar rol/token en el proveedor |
| C4 Secretos de aplicación | claves de firma, tokens de API admin (solo si B-7 los crea) | prod (diferido) | Mantenedor | ≤ 180 días o ante incidente | Rotar y reiniciar |
| C5 **No secretos** (config pública) | `BASE_URL`, `CONTENT_SOURCE`, `CORS_ORIGINS`, `API_BASE_URL` pública, puertos | cualquiera | — | — | — |

Regla: el nombre de variable declara la categoría (`*_PASSWORD`, `*_TOKEN`, `*_KEY`, `*_SECRET` ⇒ C1–C4). Todo secreto nuevo se registra en `docs/secrets-inventory.md` (nombre, categoría, consumidor, propietario, rotación; **nunca valores**).

### 13.2 Capa local (desarrollo) [SIN PROVEEDOR]
- `infra/docker/.env` y cualquier `.env*` quedan ignorados; solo `.env.example` se rastrea.
- `.env.example` contiene **únicamente** nombres, valores por defecto seguros (`CONTENT_SOURCE=fixture`, `POSTGRES_DB=gd_dev`, `POSTGRES_USER`/roles con nombres, `API_PORT=3000`, `CORS_ORIGINS=http://localhost:4200`) y **los campos secretos vacíos** (`DB_PASSWORD_API_RO=`), sin marcadores tipo secreto (nada de `changeme`, `password`, `xxx`, `<your-key>`, ni cadenas con forma de clave) para no entrenar el hábito de copiar valores débiles ni disparar falsos positivos.
- `pnpm setup:env` (script local, T-079) copia `.env.example` → `infra/docker/.env` y **genera** contraseñas aleatorias (≥ 24 bytes, `crypto.randomBytes`) por rol, sin imprimirlas. Resultado: credenciales de desarrollo únicas por máquina, claramente no productivas (BD `gd_dev`, usuarios con sufijo `_dev`), y la API falla al arrancar si recibe una contraseña vacía o un valor de una lista de contraseñas prohibidas.
- Docker Compose recibe valores solo desde `infra/docker/.env` (interpolación/`env_file`) o, preferible, como **archivos de secretos** (`secrets:` con `file:` bajo `infra/docker/secrets/`, ignorado) montados en `/run/secrets/*`; la API admite `<VAR>_FILE`. Sin valores literales en `compose.yaml`.
- Puertos: `db` sin `ports` (ya en §12.7); `api` publicada solo en `127.0.0.1`; `compose.debug.yaml` publica BD solo en `127.0.0.1`. Ningún servicio en `0.0.0.0` salvo decisión documentada.
- Prohibido en dev: reutilizar una credencial de dev en cualquier entorno remoto; la BD de dev no contiene datos reales de producción.

### 13.3 Separación de credenciales de BD [SIN PROVEEDOR]
Cuatro credenciales independientes, cada una con `LOGIN` y `GRANT` mínimo (plan §12.7, data-model): `migrator` (DDL; solo en el job `migrate`, nunca en el runtime de la API), `importer` (seed/bootstrap, solo local/herramienta puntual), `editor` (reservado B-7; no existe hasta entonces), `api_ro` (única credencial presente en el contenedor de la API). Cada servicio recibe únicamente su variable/archivo; Compose no usa `env_file` común con todas. `POSTGRES_PASSWORD` (superusuario) solo se entrega al contenedor `db` en la inicialización y la aplicación no la usa. La creación de roles y contraseñas ocurre en un paso de aprovisionamiento (script de init que lee los archivos de secretos), nunca con valores escritos en migraciones SQL versionadas: las migraciones crean roles `NOLOGIN` y un paso externo asigna `LOGIN PASSWORD` desde el secreto. Prueba: la API con `api_ro` no puede DDL ni leer tablas base (T-073); el contenedor de la API no contiene variables de otros roles.

### 13.4 Capa CI (GitHub Actions) [SIN PROVEEDOR de hosting]
- Hoy los jobs de verificación no necesitan secretos (§12.8): las credenciales de PostgreSQL del servicio de contenedor y de DAST son valores **efímeros generados en el job** (`openssl rand`/`crypto`), enmascarados con `::add-mask::`, nunca reutilizados.
- Si se necesitara un secreto: secreto de **entorno** de GitHub (no de repositorio, con revisores requeridos para entornos sensibles) y de **repositorio** solo para cosas no sensibles/de verificación; jamás disponibles para PR de forks (no `pull_request_target`; los PR de forks corren sin secretos).
- `permissions: contents: read` por defecto; permisos adicionales por job (`id-token: write` solo en el job que use OIDC). Acciones fijadas por SHA.
- Sin secretos en logs/artefactos: no `set -x`, no `docker compose config` con valores resueltos en logs (usar `--no-interpolate` o redactar), no subir `.env`/volcados como artefactos, `docker history`/escaneo de imagen sin secretos, retención corta de artefactos.
- OIDC: cuando exista nube/registro, usar federación OIDC de GitHub en lugar de claves de larga vida [DIFERIDO-HOSTING].
- **DAST**: objetivo exclusivamente efímero local en el runner (web + API + BD recién creadas con credenciales aleatorias de job); sin credenciales de producción, sin URLs remotas; verificación automática de que el objetivo es `localhost`/`127.0.0.1` (T-077/T-086).

### 13.5 Capa producción [DIFERIDO-HOSTING]: interfaz del almacén gestionado
Producción sigue diferida; no se elige proveedor. Se define solo el contrato al que cualquier proveedor debe ajustarse:
- **Abstracción `SecretSource`** (en `apps/api`, solo lectura, sin dependencias nuevas): resuelve `NOMBRE` desde (1) archivo `${NOMBRE}_FILE`/`/run/secrets/<nombre>` (preferido), (2) variable de entorno (solo dev/CI). Devuelve valores a la configuración Zod, que los marca como sensibles (nunca se registran; `toJSON`/log redactan). Un proveedor futuro se integra *fuera del proceso* (agente/sidecar/orquestador que escribe el archivo), no con SDK de proveedor en la API.
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
- **GitHub**: activar *secret scanning* y *push protection* (acción manual del usuario; documentada en T-076).
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
| Ya (sin proveedor) | Diferido (con hosting) |
|---|---|
| T-078 política/inventario, T-079 `setup:env`, T-080 `.env.example` + ignore, T-066a ampliado, T-083 gitleaks pre-commit+CI, T-084 test de no filtración en frontend, T-085 `SecretSource`+config sensible, T-086 DAST/CI sin secretos, T-081 runbook de incidente, T-082 rotación local | T-087 almacén gestionado + break-glass + auditoría, T-088 OIDC de CI a nube, T-089 inyección en orquestador, T-090 calendario de rotación en producción |

## 14. Hoja de ruta futura: adquisición y normalización de builds existentes (rev. 5; NO MVP, no implementar)

Cumple Constitución II/VII y FR-26. Este apartado es diseño documental: no habilita ninguna fuente, no concede permiso y no añade código, dependencias ni servicios (Constitución VIII; `check-scope`, AC-19).

### 14.1 Fuentes: permitidas vs. prohibidas
| Clase | Estado | Condición |
|---|---|---|
| A. Envío del autor (el autor entrega su build) | Permitida | Licencia/consentimiento escrito y registrado, atribución acordada |
| B. Datos con licencia o exportados por el titular (archivo de exportación, dataset con licencia abierta compatible) | Permitida | Licencia verificada y versionada en el registro |
| C. API documentada o permiso explícito del titular | Permitida | Términos citados, alcance/frecuencia acotados, prueba del permiso archivada |
| D. Solo enlace (*link-only*): título, autor, URL, fecha, clase/maestrías y datos factuales propios | Permitida sin permiso de contenido | Sin copiar texto, imágenes ni estructura de la guía; atribución visible |
| E. Scraping automático de sitios de terceros | **Prohibida** | Ni con `robots.txt` permisivo ni por ser público |
| F. Copia de texto de guías, imágenes, iconos, capturas o arte sin permiso | **Prohibida** | — |
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
| Modo | Condición | Qué se publica |
|---|---|---|
| **Adaptación** (`entry_kind='build_adaptada'`) | `rights_status ∈ {licensed, permission_granted}` + evidencia vigente cuyo alcance cubre adaptación/republicación | Build nativa interactiva + atribución prominente + procedencia |
| **Solo enlace** (`enlace_externo`, `link_only`) | Derechos `pending`/denegados/limitados/caducados/revocados, o duda | Tarjeta: título, autor, sitio, URL, fecha, maestrías/daño verificados de forma independiente. Sin cuerpo, imágenes, activos ni ranking derivado |
Atribución sin evidencia ⇒ modo solo enlace. Licencias que permiten ver/compartir pero no derivados (p. ej. «no derivatives») ⇒ solo enlace. Términos del sitio y permiso del autor se evalúan por separado y el más restrictivo prevalece.

### 15.2 Puerta de verificación y publicación (checklist)
1. Fuente en `sources` + `source_rights_evidence` (tipo: licencia explícita | permiso escrito; referencia/archivo de prueba privado; alcance; vigencia).
2. Revisor de derechos ≠ editor de la adaptación; registra `rights_confirmed_by/on`.
3. Alcance de la evidencia ⊇ `transformation_scope` de la adaptación.
4. Metadatos FR-28 completos (data-model `build_adaptations`).
5. Atribución renderizada (bloque superior + sección Fuentes + JSON-LD) verificada por test.
6. Revisión de contenido contra el juego (`reviewed_by`).
7. Cualquier fallo ⇒ `borrador` o *link-only*. La puerta se impone en dominio (Zod/reglas puras) y, con BD, por CHECK/trigger (T-055).

### 15.3 Plantilla de solicitud de permiso (`docs/content/permission-request-template.md`, T-101)
Contenido: identificación del editor y del sitio; build y URL concretas; qué se pide (adaptar a formato interactivo, traducir al español, reescribir/estructurar, mostrar atribución prominente, enlazar al original); qué **no** se hará (sin imágenes/activos salvo permiso, sin implicar patrocinio); vigencia y derecho de retirada ≤ 72 h; cómo y dónde se registra la respuesta; respuesta explícita requerida (el silencio no es permiso). Registro de respuestas en `permission_requests`.

### 15.4 Retirada / takedown (`docs/content/takedown-runbook.md`, T-102)
Canal público de contacto; triaje en 24 h; despublicar primero, evaluar después; cambiar a *link-only* o retirar; registrar `takedown_events`; invalidar caché/sitemap/JSON-LD; purgar capturas; notificar al solicitante; revisar otras adaptaciones de la misma fuente/autor; revocar `permission_granted` marca la evidencia `revocada`, lo que bloquea publicación por la puerta.

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

## 16. Hoja de ruta futura: guías de autoría comunitaria (rev. 7; NO MVP, no implementar)

Cumple Constitución VIII (v1.7.0) y FR-34–FR-45. Diseño documental: sin código de auth ni de app, sin dependencias, sin cuentas públicas, editor público ni comentarios.

### 16.1 Decisiones pendientes (bloquean la activación, no el MVP) — [NEEDS CLARIFICATION]
| ID | Decisión | Opciones / nota |
|---|---|---|
| D-1 | Proveedor de identidad | OIDC gestionado vs. autoalojado vs. cuentas propias con correo + MFA; implica enmienda de VIII/XI (sin auth externo hoy) y XII (secretos) |
| D-2 | Términos del colaborador y licencia | Licencia que el autor concede al sitio (no exclusiva, revocable/retirada), licencia pública de las guías (p. ej. CC BY-SA vs. «todos los derechos reservados + licencia al sitio»), política de IA/plagio, edad mínima, privacidad; revisión legal recomendada |
| D-3 | Equipo de moderación y SLA | Quién modera, cobertura, SLA de revisión (p. ej. 7 d) y de retirada (≤ 72 h), escalado |
| D-4 | Sanitización/formato del texto | Subconjunto Markdown vs. campos estructurados puros |
| D-5 | Almacenamiento/retención de evidencias de permiso | Privado, acceso por rol, retención |
| D-6 | Cuotas y umbrales de abuso | Valores iniciales de tasa/tamaño/cuarentena |

### 16.2 Hoja de ruta por etapas
| Etapa | Alcance | Precondiciones |
|---|---|---|
| **E0 (MVP, hoy)** | Contenido editorial interno; documentos de política (T-111/T-112) | — |
| **E1 — Autores invitados (sin autoservicio)** | El equipo da de alta autores verificados (`authors` + rol); el autor envía su guía por un canal manual (archivo de contenido validado) con atestación firmada; revisión editorial; sin cuentas públicas | D-2, D-3 mínimas; plan §15 operativo |
| **E2 — Editor estructurado para invitados** | Identidad (D-1) solo para invitados; borradores en BD, editor estructurado, validación, versiones, auditoría, reportes; publicación solo tras revisión | D-1, D-4, D-5; enmienda constitucional + spec propio; Fase 8 completa |
| **E3 — Registro con verificación y cuarentena** | Altas por solicitud/aprobación; límites, cuarentena de cuentas nuevas, herramientas de moderación | D-6; capacidad de moderación (D-3) demostrada |
| **E4 — Apertura gradual** | Registro más abierto, reputación/promoción de autores; comentarios solo si se decide aparte | Métricas de abuso y SLA cumplidos; spec propio |
Cada etapa exige su propia enmienda/spec y no se salta la anterior. Nunca hay publicación abierta sin revisión.

### 16.3 Flujo y permisos
Estados: `borrador` (solo autor) → `enviada` (congelada como versión N) → `en_revision_editor` → `cambios_solicitados` (vuelve al autor) | `aprobada` → `publicado`; terminales/alternos: `rechazada`, `retirada`. Matriz: autor (CRUD de sus borradores, enviar, retirar la propia), editor (revisar contenido), moderador (derechos, reportes, retirada, suspensión), admin (roles). Regla de separación: aprobador ≠ autor; verificador de derechos ≠ editor de la adaptación. Cada transición se audita.

### 16.4 Contribuciones: original vs. adaptación
- **Original**: atestación de autoría y titularidad + aceptación de términos (versión/fecha/huella) + declaración de que no incluye material de terceros ni activos oficiales sin `approved`. `rights_status` ⇒ `own_original` (el titular es el autor; moderador verifica indicios de plagio).
- **Adaptación**: todo lo anterior más fuente (URL, título, autor, sitio, fecha), evidencia que cubra adaptación (plan §15), alcance de la transformación y atribución prominente. Sin evidencia revisada ⇒ no se puede enviar como adaptación; solo *link-only*.

### 16.5 Seguridad y abuso (resumen de diseño)
Autorización por rol y propiedad en API y BD (RLS/vistas, sin confiar en la UI); validación Zod+CHECK; sanitización del texto, sin HTML crudo ni imágenes remotas (XSS, tracking, derechos); límites de tasa y de tamaño; cuarentena de cuentas nuevas; reporte/retirada; auditoría append-only; secretos de identidad bajo §13; datos personales mínimos con política de privacidad; DAST ampliado. Presupuesto: el editor se carga diferido (ruta lazy) sin afectar el bundle público; páginas públicas siguen SSG/SSR.

### 16.6 Implementable vs. bloqueado
- **Implementable ya (documental)**: política de contribución, borrador de términos (a revisar legalmente), checklist de moderación, matriz de roles/estados, enmienda (T-111, T-112), guarda `check-scope` de no-auth (T-113).
- **Bloqueado hasta decisiones**: todo lo demás (T-114–T-122): requiere D-1/D-2/D-3 y enmienda + spec por etapa. Nada de ello ocurre en el MVP.
