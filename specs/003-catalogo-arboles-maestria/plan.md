# Implementation Plan: Catálogo propio de árboles de maestría

**Branch**: `orq/11111619-diseno-catalogo` → integración en `orq/11111619` | **Date**: 2026-11-12
**Spec**: `specs/003-catalogo-arboles-maestria/spec.md`
**Input**: Investigación `runs/11111619/investigacion.md` (Fase 1 y §5.3), `runs/11111619/diseno-investigacion.md`, `specs/001-mvp-guias-builds/*`, `.specify/memory/constitution.md` (1.10.1), `AGENTS.md`.
**Estado**: aprobado e implementado (T001–T034); la puerta de cierre (T021) sigue abierta tras las correcciones T035–T038 y la ronda 2 (T039–T041). Actualizado 2026-11-14.

## Summary

Derivar de los `.dbr` de la copia legal del juego un **catálogo canónico de árboles de
maestría** (6 maestrías base en v1, decisión de Paco, 2026-11-13), validarlo con reglas propias y renderizarlo con **SVG propio**
accesible, prerenderizado en EN/ES. Las guías dejan de dibujar «su» esquema y pasan a
asignar puntos sobre el árbol canónico. Los iconos/retratos del juego quedan detrás de la
excepción de la constitución (§VII, enmienda 1.10.0 aprobada; ratificada en 1.10.1) y **siempre**
con fallback propio conmutable.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS; Angular 21 (SSG con `@angular/localize`); Drizzle + PostgreSQL 17.
**Primary Dependencies**: ninguna nueva de producto. Script de extracción: Node 22 + `zod` (ya presentes). Lectura de `.arz/.dbr`: **parser propio mínimo en TypeScript con builtins de Node y descompresor LZ4 de bloque propio** (sin librería; `ArchiveTool.exe` solo como contraste manual local, fuera del repo y de CI); `gd-utility` (MIT) solo como especificación del formato. Tamaño, licencia y alternativa descartada en [`research.md#t003`](research.md#t003--decisión-de-parser-propio-mínimo-vs-librería).
**Storage**: PostgreSQL = fuente de verdad (`mastery_trees`, `catalog_skill_nodes`, vistas `v_public_*`); fixtures JSON generados para desarrollo/tests (`fixtures/content/mastery-trees/*.json`), nunca `.dbr`.
**Testing**: Vitest/Jest del repo (dominio + API), `node --test` para scripts, Playwright + axe para UI, Lighthouse para presupuesto.
**Target Platform**: web estática prerenderizada servida local (MVP local, §17.58) con API en Docker.
**Project Type**: monorepo pnpm (`apps/web`, `apps/api`, `packages/domain`).
**Performance Goals**: sin ampliar presupuestos de `plan.md` §6 (JS inicial por ruta, gzip, TBT, CLS); la ruta de árbol debe caber en el presupuesto de su ruta.
**Constraints**: WCAG 2.2 AA; sin dependencias nuevas sin justificación escrita (Constitución IV); inglés primario, español completo (X); nada de arte del juego fuera de §VII y con fallback.
**Scale/Scope**: 6 maestrías base (v1) × ~25-30 nodos; 2 idiomas; 1 componente de árbol reutilizado por índice, maestría y guía.

## Constitution Check

_GATE: previo a la Fase 0 y re-comprobado tras el diseño._

| Principio                            | Relevancia | Cómo lo cumple                                                                                                                                     |
| ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Contenido verificable y atribuido | Alta       | Datos del juego con `game_version` y hash de fuente; verificación editorial del catálogo                                                           |
| II. Sin scraping                     | Alta       | La extracción es **local desde la copia legal**; sin descargas de web; la wiki solo con CC BY-SA 4.0 (Q1 resuelta) y share-alike                   |
| III. SEO primero                     | Alta       | Prerender EN/ES, canonical, `hreflang`, sitemap (FR-010)                                                                                           |
| IV. Rendimiento y SVG                | Alta       | SVG propio, sin raster, presupuesto intacto (FR-017)                                                                                               |
| V. Accesibilidad AA                  | Alta       | Un elemento enfocable por nodo, nombres/estado por texto, contraste, prefer-reduced-motion (FR-009)                                                |
| VI. Datos tipados y única fuente     | Alta       | Esquema Zod en `packages/domain`, PostgreSQL como fuente de verdad, sin duplicar reglas                                                            |
| VII. Legalidad y activos             | Alta       | Retratos (y iconos, solo local) por enmienda 1.10.0 aprobada + manifest `approved` + fallback; datos del juego como hechos; **nada** de Grim Tools |
| XI. Backend seguro                   | Media      | Vistas públicas de solo lectura; `api_ro` sin tablas base                                                                                          |
| X. Idioma                            | Alta       | EN/ES de nombres desde los `.dbr`; sin invención de traducciones                                                                                   |

**Enmienda 1.10.0 aprobada** (Paco, 2026-11-13, T029): arte del juego bajo tolerancia de
facto, sin permiso escrito de Crate; retratos de maestría versionados y servidos, iconos de
habilidad solo en local. El plan no depende de ella para funcionar: US1/US2 se entregan con
iconografía propia por defecto (`ASSET_SOURCE=own`).

## Project Structure

### Documentation (this feature)

```text
specs/003-catalogo-arboles-maestria/
├── spec.md            # hecho
├── plan.md            # este archivo
├── tasks.md           # tareas y evidencia
├── research.md        # decisiones de formato, parser, derechos (§T001–§T029) y de cada tarea
├── quickstart.md      # comandos y salidas reales de cierre (T021/T034): verify, speckit-analyze
└── reviews/           # puerta de cierre (spec-review) cuando se ejecuta
```

El contrato del catálogo (esquema `MasteryTree`/`CatalogSkillNode`, reglas de aciclicidad, tier
y rejilla) **no** vive en un `data-model.md` ni en `contracts/`: la fuente de verdad es el
código en `packages/domain/src/mastery-tree.ts` (Constitución VI). Se retiraron del plan esos
dos entregables (hallazgo A-05 de la revisión de cierre; I1 de `speckit-analyze`).

### Source Code (estructura real)

```text
packages/domain/src/
├── mastery-tree.ts{,.spec.ts}      # esquemas Zod del catálogo + propiedades
├── skill-node-refs.ts{,.spec.ts}   # validación de skill_node_id de la guía contra el catálogo
└── asset.ts, schema.ts             # activos y `withdrawn` (T015)

scripts/
├── extract-mastery-trees.mts       # .dbr → JSON canónico (lee ruta local, no versiona)
├── extract-textures.mts            # .tex → PNG en carpeta ignorada (T028)
├── check-mastery-catalog.mts       # validador `catalog:nodes`
├── validate-content.mts            # `content:validate` (guías + referencias al catálogo)
└── <sus pruebas>.test.mts

fixtures/content/mastery-trees/     # fixtures generados (JSON), versionados
fixtures/content/assets/            # manifiesto y NOTICE de los retratos
apps/api/drizzle/                   # 0009 catálogo + vistas, 0010 skill_node_id, 0011 asset withdrawn,
                                    # 0012 skill_node_id único por guía + revalidación (T035), 0013 vista pública sin icon (T036)
apps/api/src/                       # repositorio de catálogo (lectura) y rutas GET /api/v1/masteries[/:slug]
apps/web/
├── src/app/features/masteries/     # índice y página por maestría (lazy + prerender)
├── src/app/shared/svg/skill-tree/  # componente de árbol reutilizado (modos catálogo y asignación)
├── src/app/core/content/           # lectura del catálogo, retratos, estáticos de árboles
├── src/styles/deferred.css         # estilos de los componentes diferidos (T033)
└── tools/                          # emit-mastery-trees, emit-deferred-styles, emit-portraits (T036), emit-static-assets
```

**Lo que NO se toca aquí**: la web vive en `apps/web` (no en `src/` de la raíz); este plan ya
está implementado salvo lo que `tasks.md` mantenga abierto.

## Design decisions

1. **Catálogo separado del documento de guía.** `MasteryTree` vive en su propia entidad y
   se sirve por vista pública; la guía referencia `skill_node_id`. Esto rompe la
   duplicación actual sin migración destructiva (FR-015).
   En BD (T031) la referencia es `build_skill_nodes.skill_node_id` (nullable, FK al nodo del
   catálogo con `ON DELETE RESTRICT` y comprobación de maestría) y `v_public_build_documents`
   la sirve en `skill_nodes[]`; `db:seed` carga el catálogo antes que las guías.
2. **Derivación reproducible.** El script lee solo lo necesario y emite JSON con claves
   ordenadas y `source {game_version, sha256[]}`; dos ejecuciones ⇒ mismo byte (SC-002).
   La extracción corre en la máquina del usuario; el repo guarda el resultado, no el input.
3. **Rejilla canónica = `bitmapPositionX` (tier/columna) e `bitmapPositionY` (fila)**,
   mapeada a una cuadrícula declarada `grid {col,row}`; `tier → bar_required` con los hitos
   1/5/10/15/20/25/32/40/50 y contrastado con la wiki **si** se usa (CC BY-SA 4.0, Q1 resuelta).
4. **Un solo componente de árbol** con dos modos (`catálogo` completo / `asignación` de
   guía), accesible por teclado y con estado por texto, no solo color.
5. **Iconos y retratos**: `ASSET_SOURCE=own|game` (enmienda §VII 1.10.0), default `own`; con
   `game` exige entradas `approved` cuyo `license_or_permission = tolerancia_de_facto_sin_permiso`
   y `fallback_svg` presente; build falla cerrado si falta. Los retratos viven en
   `apps/web/public/assets/portraits/<slug>.png` (la carpeta que `assets:check` ya vigila) y
   se declaran en `fixtures/content/assets/manifest.json` (`file_path = public/assets/portraits/…`,
   `proof_ref = specs/003-catalogo-arboles-maestria/research.md#t029`). Su atribución
   vive en `fixtures/content/assets/NOTICE.md` (fuera de `public/` para no servirse como activo
   sin manifiesto). La retirada pone `status: withdrawn` (`ASSET_STATUSES` ya lo incluye, T015;
   la regla de `approved` no cambia). «Retrato» = botón de maestría del juego 197×41, en PNG. Release y CI usan `ASSET_SOURCE=game` (decisión de Paco, 2026-11-13); el build local, `own`.
6. **Wiki**: no es fuente por defecto (Q1 resuelta: CC BY-SA 4.0, decisión de Paco,
   2026-11-13); si se usa, artefacto derivado CC BY-SA 4.0 con atribución y aviso de licencia en la propia página/JSON.
7. **Nombres localizados desde los `.arc` de texto (T022).** El script lee también
   `resources/Text_EN.arc` y `resources/Text_ES.arc` (`.arc` v3, mismo LZ4 de bloque que el `.arz`,
   solo builtins de `node:`) y resuelve `skillDisplayName` a `name.en`/`name.es` con el esquema
   `localizedName {en, es}` de T005 sin cambios. Falta en ES ⇒ texto EN y aviso con conteo; falta en
   EN ⇒ error. `--no-localize` mantiene los tags de T006. Los hashes de los dos `.arc` se añaden a
   `source.sha256[]`. Formato y evidencia en [`research.md#t022--textos-de-localización-arc`](research.md#t022--textos-de-localización-arc).
8. **Texturas a PNG ignorado (T028).** `scripts/extract-textures.mts` (`pnpm catalog:textures`) decodifica los `.tex` de `resources/UI.arc` (DDS embebido: DXT1/3/5 y BGR(A)) a **PNG** —WebP no es posible sin dependencias (Constitución IV)— en `.game-assets/textures/`, carpeta gitignorada con `manifest.json`; nada del juego se versiona (FR-014, VII). Formato y evidencia en [`research.md#t028--texturas-tex`](research.md#t028--texturas-tex).

9. **Árboles del catálogo como estáticos del sitio para la guía (T017).** La guía necesita los
   árboles completos de sus maestrías en el navegador, pero llevarlos en `TransferState`
   rompe el presupuesto de HTML de `/builds/:slug` (dos árboles añaden ≈ +25 kB de `ng-state`; el
   límite es 120 000 B). **Enmienda de la regla de T012 «el navegador nunca abre una fuente de
   datos»** (decisión de Paco, Pregunta 9, 2026-11-14): el navegador **sí** puede pedir
   **estáticos propios del sitio generados en build** (mismo origen, `connect-src 'self'` sin
   cambios); **nunca** la API ni terceros. `apps/web/tools/emit-mastery-trees.mts` escribe en el
   artefacto `/assets/mastery-trees/<slug>.json` (árbol validado con `MasteryTreeSchema`) y
   `/assets/mastery-trees/index.json` (`{ "<id de maestría>": "<slug>" }`, para casar el prefijo
   de `skill_node_id`, p. ej. `class06`, con su fichero) desde el mismo catálogo que prerenderiza
   `/maestrias/:slug` (fixtures en local, API en release, sin _fallback_; si la fuente falla, el
   build falla). Los ficheros no se versionan: nacen en `dist`. El bloque diferido de la
   guía los pide al entrar en el viewport; si la petición falla, o algún nodo de la guía no
   lleva `skill_node_id` o los ids apuntan a más de una maestría por árbol, la guía usa el modo
   guía actual (FR-015, SC-007). Sin JS se lee el _fallback_ textual de la guía. El HTML de
   la guía no cambia de tamaño.

10. **Estilos de los componentes diferidos como hoja propia (T033).** La CSP del artefacto
    (`style-src 'self'` más hashes, sin `unsafe-inline`) bloquea el `<style>` que Angular inyecta
    en el cliente para los componentes de bloques `@defer`. **Decisión del principal (Pregunta 10,
    2026-11-14)**: opción b (hoja `'self'`); la opción a (CSS en la hoja global) se descarta por
    medida, porque supera el error de 320 kB del presupuesto `initial` de Angular (321,39 kB con
    +14,7 kB); la opción c (`unsafe-inline`, nonces) queda descartada. Los componentes diferidos
    (`gd-skill-tree`, `gd-devotion-map`, `gd-devotion-section`, `gd-build-skills`) usan
    `ViewEncapsulation.None` sin estilos de componente; su CSS lo emite
    `apps/web/tools/emit-deferred-styles.mts` como `/assets/deferred.css` (fuente
    `apps/web/src/styles/deferred.css`) y lo enlaza `DeferredStyles` en la cabecera de las páginas
    que los usan (guía y `/maestrias/`+`<slug>`), también en el prerender. Un solo paso de build,
    `apps/web/tools/emit-static-assets.mts`, emite los árboles (decisión 9) y la hoja, en `build` y
    dentro de `runRelease`.

11. **Correcciones de la revisión de cierre (T035, T036, T038).** T035: `validateSkillNodeRefs` rechaza
    un `skill_node_id` repetido en una guía y la migración `0012` añade el índice único parcial
    `(build_id, skill_node_id) WHERE skill_node_id IS NOT NULL` y triggers diferidos que revalidan
    «misma maestría» también al cambiar `masteries`, `mastery_trees`, `catalog_skill_nodes` o
    `skills`. T036: `angular.json` ya no copia `assets/portraits/**` (el desarrollo los conserva);
    `apps/web/tools/emit-portraits.mts` los emite solo con `ASSET_SOURCE=game`; la migración `0013`
    recrea `v_public_skill_nodes` sin `icon` y el JSON público y la API usan `PublicMasteryTreeSchema`
    (S-004); `build:release` exige `ASSET_SOURCE` explícito y `assertNoGamePortraits` rechaza un
    artefacto `own` con PNG. T038: el snapshot de `spec-review` pliega CRLF a LF en archivos de
    texto (contrato de spec002).

## Riesgos

| Riesgo                                        | Prob. | Impacto | Mitigación                                                                                                          |
| --------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Parser `.dbr`/`.arz` no estable en 1.3.1.0    | Media | Alto    | Fase 0: prueba de extracción real antes de comprometer el formato; fallback a herramienta oficial de Crate en local |
| Mapeo `tier → bar_required` ambiguo           | Media | Medio   | Contrastar con wiki (CC BY-SA 4.0) y con la UI del juego; registrar tabla en `research.md`                          |
| Presupuesto de JS por el árbol completo       | Media | Alto    | Render estático + islas; medir con `check:initial-js` antes de integrar la ruta                                     |
| Derechos de arte                              | Alta  | Alto    | Enmienda 1.10.0 (sin permiso escrito de Crate), retirada inmediata, fallback propio obligatorio; nada de Grim Tools |
| Divergencia entre catálogo y guías existentes | Media | Medio   | Validador cruzado y prueba de migración con la guía actual                                                          |
| Licencia de la wiki (3.0 vs 4.0)              | Baja  | Bajo    | Q1 resuelta: CC BY-SA 4.0 (Paco, 2026-11-13)                                                                        |

## Fuera de alcance

- Planner interactivo de builds (guardar/compartir builds) — spec futura.
- Devociones y constelaciones como catálogo canónico (solo builds existentes).
- Arte del juego fuera de la enmienda 1.10.0 (fondos, marcos, otro arte, datos internos) y publicar iconos de habilidad (solo local).
- Cualquier ingestión automatizada del foro, de Grim Tools o de la wiki.
- Nuevos hosting/publicación (sigue MVP local).
- Maestrías de expansiones (AoM, FG, FoA) y mods: después de v1 (decisión de Paco, 2026-11-13).

## Fases

- **Fase 0 — Investigación de formato** (`research.md`): probar extracción real, fijar
  campos, mapear tier, decidir parser. 1-2 días.
- **Fase 1 — Diseño**: el contrato vive en `packages/domain/src/mastery-tree.ts`; `quickstart.md` recoge los comandos y salidas de cierre (sin `data-model.md` ni `contracts/`): 1 día.
- **Fase 2 — Tareas** (`tasks.md`); `speckit-analyze` se ejecutó al cierre (T021/T034), no antes de implementar.
