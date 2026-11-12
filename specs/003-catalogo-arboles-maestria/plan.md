# Implementation Plan: Catálogo propio de árboles de maestría

**Branch**: `orq/11111619-diseno-catalogo` → integración en `orq/11111619` | **Date**: 2026-11-12
**Spec**: `specs/003-catalogo-arboles-maestria/spec.md`
**Input**: Investigación `runs/11111619/investigacion.md` (Fase 1 y §5.3), `runs/11111619/diseno-investigacion.md`, `specs/001-mvp-guias-builds/*`, `.specify/memory/constitution.md` (1.9.0 + enmienda 1.10.0 en borrador), `AGENTS.md`.
**Estado**: plan técnico borrador para aprobación. **Nada se implementa sin orden.**

## Summary

Derivar de los `.dbr` de la copia legal del juego un **catálogo canónico de árboles de
maestría** (10 maestrías), validarlo con reglas propias y renderizarlo con **SVG propio**
accesible, prerenderizado en EN/ES. Las guías dejan de dibujar «su» esquema y pasan a
asignar puntos sobre el árbol canónico. Los iconos/retratos del juego quedan detrás de la
excepción de la constitución (§VII, enmienda 1.10.0 pendiente de aprobación) y **siempre**
con fallback propio conmutable.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS; Angular 21 (SSG con `@angular/localize`); Drizzle + PostgreSQL 17.
**Primary Dependencies**: ninguna nueva de producto. Script de extracción: Node 22 + `zod` (ya presentes). Lectura de `.arz/.dbr`: parser propio mínimo o herramienta de Crate **solo en local y fuera del repo**; si se usa una librería comunitaria, preferir una de licencia permisiva ya auditada (`R-Hidayatullah/gd-utility` MIT; `xaviershay/gd-explorer` BSD-3) y justificar tamaño.
**Storage**: PostgreSQL = fuente de verdad (`mastery_trees`, `skill_nodes_catalog`, vistas `v_public_*`); fixtures JSON generados para desarrollo/tests (`content/mastery-trees/*.json`), nunca `.dbr`.
**Testing**: Vitest/Jest del repo (dominio + API), `node --test` para scripts, Playwright + axe para UI, Lighthouse para presupuesto.
**Target Platform**: web estática prerenderizada servida local (MVP local, §17.58) con API en Docker.
**Project Type**: monorepo pnpm (`apps/api`, `packages/domain`, web en raíz).
**Performance Goals**: sin ampliar presupuestos de `plan.md` §6 (JS inicial por ruta, gzip, TBT, CLS); la ruta de árbol debe caber en el presupuesto de su ruta.
**Constraints**: WCAG 2.2 AA; sin dependencias nuevas sin justificación escrita (Constitución IV); inglés primario, español completo (X); nada de arte del juego fuera de §VII y con fallback.
**Scale/Scope**: 10 maestrías × ~25-30 nodos; 2 idiomas; 1 componente de árbol reutilizado por índice, maestría y guía.

## Constitution Check

_GATE: previo a la Fase 0 y re-comprobado tras el diseño._

| Principio                            | Relevancia             | Cómo lo cumple                                                                                                                 |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| I. Contenido verificable y atribuido | Alta                   | Datos del juego con `game_version` y hash de fuente; verificación editorial del catálogo                                       |
| II. Sin scraping                     | Alta                   | La extracción es **local desde la copia legal**; sin descargas de web; la wiki solo si Q1 confirma licencia y con share-alike  |
| III. SEO primero                     | Alta                   | Prerender EN/ES, canonical, `hreflang`, sitemap (FR-010)                                                                       |
| IV. Rendimiento y SVG                | Alta                   | SVG propio, sin raster, presupuesto intacto (FR-017)                                                                           |
| V. Accesibilidad AA                  | Alta                   | Un elemento enfocable por nodo, nombres/estado por texto, contraste, prefer-reduced-motion (FR-009)                            |
| VI. Datos tipados y única fuente     | Alta                   | Esquema Zod en `packages/domain`, PostgreSQL como fuente de verdad, sin duplicar reglas                                        |
| VII. Legalidad y activos             | **Bloqueante parcial** | Iconos/retratos solo por enmienda 1.10.0 + manifest `approved` + fallback; datos del juego como hechos; **nada** de Grim Tools |
| XI. Backend seguro                   | Media                  | Vistas públicas de solo lectura; `api_ro` sin tablas base                                                                      |
| X. Idioma                            | Alta                   | EN/ES de nombres desde los `.dbr`; sin invención de traducciones                                                               |

**Desviación declarada**: la enmienda 1.10.0 (arte del juego bajo tolerancia de facto, sin
permiso escrito) **no está aprobada**; hasta que lo esté, US1/US2 se entregan con
iconografía propia y US3 no cambia. El plan no depende de ella para funcionar.

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

content/mastery-trees/       # fixtures generados (JSON), versionados
apps/api/drizzle/            # migración nueva: tablas + v_public_mastery_trees, v_public_skill_nodes
apps/api/src/                # repositorio de catálogo (lectura) + pruebas
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
   1/5/10/15/20/25/32/40/50 y contrastado con la wiki **si** Q1 lo autoriza.
4. **Un solo componente de árbol** con dos modos (`catálogo` completo / `asignación` de
   guía), accesible por teclado y con estado por texto, no solo color.
5. **Iconos**: `ASSET_SOURCE=own|game` (enmienda §VII), default `own`; con `game` exige
   entradas `approved` cuyo `license_or_permission = tolerancia_de_facto_sin_permiso` y
   `fallback_svg` presente; build falla cerrado si falta.
6. **Wiki**: no se usa como fuente salvo Q1; si se usa, artefacto derivado CC BY-SA 3.0
   con atribución y aviso de licencia en la propia página/JSON.

## Riesgos

| Riesgo                                        | Prob. | Impacto | Mitigación                                                                                                          |
| --------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Parser `.dbr`/`.arz` no estable en 1.3.1.0    | Media | Alto    | Fase 0: prueba de extracción real antes de comprometer el formato; fallback a herramienta oficial de Crate en local |
| Mapeo `tier → bar_required` ambiguo           | Media | Medio   | Contrastar con wiki (si Q1) y con la UI del juego; registrar tabla en `research.md`                                 |
| Presupuesto de JS por el árbol completo       | Media | Alto    | Render estático + islas; medir con `check:initial-js` antes de integrar la ruta                                     |
| Derechos de arte                              | Alta  | Alto    | Fallback propio obligatorio; enmienda aparte; nada de Grim Tools                                                    |
| Divergencia entre catálogo y guías existentes | Media | Medio   | Validador cruzado y prueba de migración con la guía actual                                                          |
| Licencia de la wiki (3.0 vs 4.0)              | Alta  | Medio   | Q1 escrita antes de usar                                                                                            |

## Fuera de alcance

- Planner interactivo de builds (guardar/compartir builds) — spec futura.
- Devociones y constelaciones como catálogo canónico (solo builds existentes).
- Iconos/retratos sin la enmienda 1.10.0 aprobada.
- Cualquier ingestión automatizada del foro, de Grim Tools o de la wiki.
- Nuevos hosting/publicación (sigue MVP local).

## Fases

- **Fase 0 — Investigación de formato** (`research.md`): probar extracción real, fijar
  campos, mapear tier, decidir parser. 1-2 días.
- **Fase 1 — Diseño** (`data-model.md`, `contracts/mastery-tree.md`, `quickstart.md`): 1 día.
- **Fase 2 — Tareas** (`tasks.md`) y `speckit-analyze` antes de implementar.
