# Research: spec009, base visual y página de build

Fecha: 2026-11-18. Base: `orq/11111619` = `mvp/1` @ `28cbcdf`. Lectura de código (sin builds pesados ni e2e en la planificación). Decisiones de Paco: Preguntas 37–45 de `runs/11111619/preguntas-ui.md` (ver `spec.md`, «Clarifications»).

## Evidencia

### R1 — «No veo el árbol ni el mapa de devociones»

Tres causas candidatas, detalladas en `spec.md` §3.1:

1. Sin JS solo existe el `@placeholder` de los dos `@defer (on viewport)` (`apps/web/src/app/features/build/build.page.html:65-78`, `:110-125`). Por diseño (§III), pero el respaldo del árbol no avisa de que la vista interactiva requiere JS (el de devociones sí: `devotion-section.html:56-58`).
2. `pnpm start` (`ng serve`, configuración `development`, `apps/web/angular.json:77-91`) no sirve `/assets/deferred.css` (`core/styles/deferred-styles.ts:5`) ni `/assets/mastery-trees/*.json` (`core/content/mastery-tree-assets.ts:9`): los escribe `apps/web/tools/emit-static-assets.mts:21-25`, que solo corre en el `pnpm build` raíz (`package.json:6`). La guía de ejemplo tiene 14 de 14 nodos con `skill_node_id`, así que pide el árbol canónico, falla (`build-skills.ts:59-75`) y cae al modo guía, sin estilos.
3. El índice solo es fijo desde 80rem (`toc/build-toc.css:111-118`).

No se ha reproducido todavía: es la primera tarea (T001), con capturas antes/después en las cuatro combinaciones (`pnpm start`; artefacto `own` y `game`; con y sin JS).

### R2 — Tokens y contraste

`apps/web/src/styles/tokens.css` declara 12 colores con nombres del mundo anterior (`--color-soot`, `--color-panel`, `--color-panel-2`, `--color-bone`, `--color-ash`, `--color-storm`, `--color-ember`, `--color-line` y variantes `-dim`/`-more`). `scripts/check-contrast.mts:32-46` comprueba texto `bone|ash|storm|ember` sobre `soot|panel|panel-2` (≥ 4,5:1) y bordes `ash|storm|ember` sobre `panel|panel-2` (≥ 3:1), leyendo esos nombres. `accessibility.css` (contraste forzado) usa `--color-ash-more`/`--color-line-more`.

### R3 — Datos editoriales

`packages/domain/src/schema.ts:255-305` (`BuildContentSchema`, `.strict()`, `locale: 'es'`) no tiene intro, etapa, changelog, pros/contras, barra ni devociones clave. La tabla `builds` (`apps/api/src/db/schema.ts:293-331`) y la vista `v_public_build_documents` (`apps/api/drizzle/0010_skill_node_id.sql:37-119`) se escriben con `apps/api/src/db/write-content.mts:184-185` y se leen con `apps/api/src/content/map-content.ts`. Hay `published_at`, `reviewed_at`, `game_version`, `playstyle`, `damage_types`, `content_tags`, `author.bio` y `hero_callout_*`. Última migración: `0014_public_skill_icon_id.sql`.

### R4 — Activos del juego

Manifiesto `fixtures/content/assets/manifest.json` con 170 entradas (una por activo: `slug`, `file_path`, `license_or_permission = tolerancia_de_facto_sin_permiso`, `proof_ref`, `fallback_svg`, `provenance.source_path` y `sha256`). Retratos: `apps/web/public/assets/portraits/*.png`, excluidos de la copia de Angular (`angular.json:39`) y emitidos solo con `ASSET_SOURCE=game` por `apps/web/tools/emit-portraits.mts`. La constitución 1.11.1 §VII no cubre portadas, constelaciones, objetos, componentes ni aumentos.

### R5 — Tooltips existentes

Árbol: tooltip junto al nodo con `shared/svg/skill-tree/place-tooltip.ts` y `role="tooltip"` (`skill-tree.html:219-262`). Mapa de devociones: detalle propio. No hay un componente común para chips, iconos de barra ni reglas del loot filter.

### R6 — Idioma de los nombres

`skill-tree.ts:147-148` y `build-summary.ts:81-82` ya eligen por `LOCALE_ID`; el resto no: `build.page.html:32,40` (respaldo del árbol: «name_es (name_en)»), `purchase-stepper.html:33-34` (ídem), `devotion-section`/`devotion-map` (`constellationName`), pasos de devoción con `label` editorial en español.

### R7 — Presupuestos (informativos en 009, P43)

Línea base conocida: HTML de la guía 117 333 B (EN) / 117 662 B (ES) de 120 000; JS inicial de la guía ≈ 123 kB de 150 000; `/tier-list` 111 422 de 112 000 B; CSS gzip 3 434 B (6 164 B con diferido) de 20 000. Se miden en T001 (antes) y T019 (después) y se registran; no bloquean (CI verde en 013).

## Decisiones

- **D1 — Assets generados en desarrollo**: `pnpm start` genera antes de servir los mismos archivos que `emit-static-assets` (árboles y `deferred.css`) en una carpeta ignorada por git que la configuración `development` sirve como assets; ningún artefacto generado se versiona y el artefacto de producción no cambia. Alternativa descartada: incluir `deferred.css` en `styles` de desarrollo (arregla el estilo pero no los árboles y diverge del artefacto). Si T001 encuentra además un fallo en el artefacto, se corrige en la misma tarea.
- **D2 — Aviso sin JS en el respaldo del árbol**: el `@placeholder` de habilidades añade el mismo tipo de aviso que el de devociones; la lista sigue siendo el contenido indexable.
- **D3 — Tokens con los nombres actuales**: la paleta negra (`spec.md` §4 como punto de partida; valores finales los de la propuesta que apruebe Paco en T004) se aplica **cambiando valores** de los tokens existentes (`soot` = fondo `#0b0b0c`, `panel` = `#151517`, `panel-2` = `#1d1d20`, `bone` = texto `#ecebe7`, `ash` = secundario `#a8a59f`, `storm` = acento `#d9b25c`, `ember` = contras/peligro `#f07a6a`, `line` = filete `#3a3a40`), y se **añaden** `--color-focus` (`#f0d27f`), `--color-control` (borde de control `#75737a`) y `--color-pro` (`#7fc98f`). Evita tocar todos los CSS y mantiene `check:contrast`; T008 añade a la comprobación los tokens nuevos. Los nombres semánticos (renombrado) quedan para 013 si aporta algo.
- **D4 — Campos editoriales**: ver `data-model.md`. Rol = `playstyle` existente; fecha de actualización = última entrada del changelog o `published_at`; resumen del autor = `author.bio` truncado a 2 líneas con el texto completo a demanda. Sin campos nuevos para eso.
- **D5 — Tooltip común**: componente propio en `apps/web/src/app/shared/ui/tooltip/`, sin dependencias, que reutiliza la lógica de colocación de `place-tooltip.ts` (extraída a un módulo compartido sin cambiar su comportamiento en el árbol). Abre con foco, hover y toque; Escape cierra; WCAG 1.4.13; `aria-describedby`; posiciona con CSSOM (no atributos `style`, CSP).
- **D6 — Portada de maestría**: una imagen por maestría base (6), elegida a mano de la copia local del juego (pantallas de carga o arte de la maestría; la elección exacta la documenta T007 con su ruta de origen y Paco la valida en la revisión visual, SC-007), recortada a 1440×360 y comprimida en WebP (objetivo ≤ 40 kB). Una entrada de manifiesto por imagen con `proof_ref` = `specs/009-rediseno-completo-ui/research.md#r8` (mismo formato abreviado que `#r10` de spec004). Se sirve y emite como los retratos (solo con `ASSET_SOURCE=game`); el fallback propio es un fondo CSS con el símbolo SVG de la maestría. La guía usa la portada de `title_a_mastery_slug`. Dimensiones reservadas (`width`/`height`, `aspect-ratio`) para CLS.
- **D7 — Checklist arriba sin duplicar estado**: un componente compacto nuevo reutiliza el almacén de progreso de `purchase-stepper/progress.ts` (misma clave, misma persistencia opcional). La sección «Orden real de compra» se queda donde dice FR-011 hasta que 010 la sustituya.
- **D8 — Composición en una sola tarea**: los componentes nuevos (cabecera, índice, checklist, build final, loot filter) se crean con sus pruebas sin tocar `build.page.html`; una tarea posterior (T016) compone la página, reordena y aplica el estilo de notas. Así las tareas de componentes no chocan en la plantilla.
- **D9 — Registro de T-043 y T-148**: T-043 recibe la marca `[DIFERIDA: …]` que lee `scripts/spec-review.mjs` y una entrada en «Registro de aplazamientos» de spec001; T-148 (`specs/backlog-dx.md`) se marca descartada con fecha y decisión de Paco, y se registra en una subsección «Descartadas». No hace falta ningún ID T-NNN nuevo de spec001.
- **D10 — Áreas**: `apps/web`, `apps/web/tools` y `e2e/` → UI; `packages/*`, `apps/api`, `scripts/`, `fixtures/` → implementación; constitución y artefactos SDD → DOCS.

## R8 — Análisis de riesgos de la enmienda 1.12.0 (`proof_ref` de los activos nuevos)

Alcance (P44 = A, Paco, 2026-11-18): iconos de constelaciones, objetos, componentes y aumentos; una portada por maestría; datos factuales derivados del juego (nombres ES/EN, rareza, tipo, nivel, estadísticas, bonificaciones y descripciones cortas de skills, P45 = A); marcos de tooltip propios. Fuera: texturas de marcos y fondos del juego, lore, la base de datos completa y cualquier ingesta de webs.

| Riesgo                                                | Prob. | Impacto | Mitigación                                                                                                                             |
| ----------------------------------------------------- | ----- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Crate pide retirar activos                            | Baja  | Alto    | Fallback propio conmutable (`ASSET_SOURCE=own`) y retirada inmediata en el mismo cambio (§VII); una entrada de manifiesto por activo.  |
| Ampliación excesiva (copiar la base de datos del juego) | Media | Alto  | Solo lo usado por guías publicadas (P45 = A), sin lore; `check-assets` falla cerrado ante entradas sin manifiesto.                    |
| Confusión de marca o afiliación                       | Baja  | Medio   | Atribución a Crate y aviso de no afiliación en las páginas con arte del juego; marcos y tipografía propios.                             |
| Peso de imágenes (LCP)                                | Media | Medio   | Portada WebP ≤ 40 kB, dimensionada; medida informativa en 009 y obligatoria en 013.                                                     |
| Ingesta automatizada encubierta                       | Baja  | Alto    | Incorporación manual y editorial desde la copia local legal; sin descargas de webs (§II, `check:scope`).                                |

Sin permiso escrito de Crate: riesgo asumido por Paco, como en 1.10.0 y 1.11.0.
