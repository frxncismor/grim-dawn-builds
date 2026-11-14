# Implementation Plan: Catálogo propio de árboles de maestría

**Branch**: `orq/11111619-diseno-catalogo` → integración en `orq/11111619` | **Date**: 2026-11-12
**Spec**: `specs/003-catalogo-arboles-maestria/spec.md`
**Input**: Investigación `runs/11111619/investigacion.md` (Fase 1 y §5.3), `runs/11111619/diseno-investigacion.md`, `specs/001-mvp-guias-builds/*`, `.specify/memory/constitution.md` (1.9.0 + enmienda 1.10.0 en borrador), `AGENTS.md`.
**Estado**: plan técnico borrador para aprobación. **Nada se implementa sin orden.**

## Summary

Derivar de los `.dbr` de la copia legal del juego un **catálogo canónico de árboles de
maestría** (6 maestrías base en v1, decisión de Paco, 2026-11-13), validarlo con reglas propias y renderizarlo con **SVG propio**
accesible, prerenderizado en EN/ES. Las guías dejan de dibujar «su» esquema y pasan a
asignar puntos sobre el árbol canónico. Los iconos/retratos del juego quedan detrás de la
excepción de la constitución (§VII, enmienda 1.10.0 pendiente de aprobación) y **siempre**
con fallback propio conmutable.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS; Angular 21 (SSG con `@angular/localize`); Drizzle + PostgreSQL 17.
**Primary Dependencies**: ninguna nueva de producto. Script de extracción: Node 22 + `zod` (ya presentes). Lectura de `.arz/.dbr`: **parser propio mínimo en TypeScript con builtins de Node y descompresor LZ4 de bloque propio** (sin librería; `ArchiveTool.exe` solo como contraste manual local, fuera del repo y de CI); `gd-utility` (MIT) solo como especificación del formato. Tamaño, licencia y alternativa descartada en [`research.md#t003`](research.md#t003--decisión-de-parser-propio-mínimo-vs-librería).
**Storage**: PostgreSQL = fuente de verdad (`mastery_trees`, `catalog_skill_nodes`, vistas `v_public_*`); fixtures JSON generados para desarrollo/tests (`fixtures/content/mastery-trees/*.json`), nunca `.dbr`.
**Testing**: Vitest/Jest del repo (dominio + API), `node --test` para scripts, Playwright + axe para UI, Lighthouse para presupuesto.
**Target Platform**: web estática prerenderizada servida local (MVP local, §17.58) con API en Docker.
**Project Type**: monorepo pnpm (`apps/api`, `packages/domain`, web en raíz).
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
├── tasks.md           # siguiente entrega
├── research.md        # (Fase 0) decisiones de formato y de parser .dbr
├── data-model.md      # (Fase 1) esquema de catálogo vs guía
├── quickstart.md      # (Fase 1) comandos: extract, catalog:nodes, build, gates
└── contracts/
    └── mastery-tree.md  # (Fase 1) contrato del JSON de catálogo y del componente
```

### Source Code (tocará, cuando se ordene)

```text
packages/domain/src/
├── mastery-tree.ts          # esquemas Zod del catálogo (nuevo)
└── mastery-tree.spec.ts     # pruebas + propiedades (nuevo)

scripts/
├── extract-mastery-trees.mts      # .dbr → JSON canónico (nuevo; lee ruta local, no versiona)
├── check-mastery-catalog.mts      # validador `catalog:nodes` (nuevo)
└── <sus pruebas>.test.mts

fixtures/content/mastery-trees/       # fixtures generados (JSON), versionados
apps/api/drizzle/            # migración nueva: tablas + v_public_mastery_trees, v_public_skill_nodes
apps/api/src/                # repositorio de catálogo (lectura) + pruebas; rutas GET /api/v1/masteries y /api/v1/masteries/:slug (T023)
src/app/
├── features/masteries/      # índice y página por maestría (nuevo; lazy + prerender)
└── shared/svg/skill-tree/   # componente de árbol reutilizado (modificado, no reescrito)
```

**Lo que NO se toca aquí**: `src/` solo cuando se implemente US1/US2/US3 con orden expresa; esta fase entrega documentos.

## Design decisions

1. **Catálogo separado del documento de guía.** `MasteryTree` vive en su propia entidad y
   se sirve por vista pública; la guía referencia `skill_node_id`. Esto rompe la
   duplicación actual sin migración destructiva (FR-015).
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
   la regla de `approved` no cambia). «Retrato» = botón de maestría del juego 197×41, en PNG.
6. **Wiki**: no es fuente por defecto (Q1 resuelta: CC BY-SA 4.0, decisión de Paco,
   2026-11-13); si se usa, artefacto derivado CC BY-SA 4.0 con atribución y aviso de licencia en la propia página/JSON.
7. **Nombres localizados desde los `.arc` de texto (T022).** El script lee también
   `resources/Text_EN.arc` y `resources/Text_ES.arc` (`.arc` v3, mismo LZ4 de bloque que el `.arz`,
   solo builtins de `node:`) y resuelve `skillDisplayName` a `name.en`/`name.es` con el esquema
   `localizedName {en, es}` de T005 sin cambios. Falta en ES ⇒ texto EN y aviso con conteo; falta en
   EN ⇒ error. `--no-localize` mantiene los tags de T006. Los hashes de los dos `.arc` se añaden a
   `source.sha256[]`. Formato y evidencia en [`research.md#t022--textos-de-localización-arc`](research.md#t022--textos-de-localización-arc).
8. **Texturas a PNG ignorado (T028).** `scripts/extract-textures.mts` (`pnpm catalog:textures`) decodifica los `.tex` de `resources/UI.arc` (DDS embebido: DXT1/3/5 y BGR(A)) a **PNG** —WebP no es posible sin dependencias (Constitución IV)— en `.game-assets/textures/`, carpeta gitignorada con `manifest.json`; nada del juego se versiona (FR-014, VII). Formato y evidencia en [`research.md#t028--texturas-tex`](research.md#t028--texturas-tex).

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
- **Fase 1 — Diseño** (`data-model.md`, `contracts/mastery-tree.md`, `quickstart.md`): 1 día.
- **Fase 2 — Tareas** (`tasks.md`) y `speckit-analyze` antes de implementar.
