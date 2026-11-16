# Implementation Plan: Rediseño de UI estilo Grim Dawn, con flujo de guías tipo Maxroll

**Branch**: `004-rediseno-ui-grim-dawn` (planificación en `orq/11111619-ui-s4-plan`) | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-rediseno-ui-grim-dawn/spec.md`; investigación en [research.md](research.md); `.specify/memory/constitution.md` (1.10.1); `AGENTS.md`; `CONTRIBUTING.md`; `specs/003-catalogo-arboles-maestria/{spec,plan,tasks}.md`.

**Estado**: **clarify cerrado** (Paco, 2026-11-15): Q11 = **B** (publicar iconos de habilidad, con enmienda 1.11.0 de §VII y análisis de riesgos **antes**), Q12–Q15 = A. Las tareas están en [tasks.md](tasks.md).

## Summary

Rediseñar la **capa de presentación** del sitio: portada y catálogo con **tarjetas de builds**, guía con resumen e índice, árbol de maestría con **tooltip junto al nodo** e **iconos de habilidad**, y una identidad visual de Grim Dawn con arte propio y los activos que permite §VII. No cambia datos, API ni derechos. Todo dentro de los presupuestos de `001/plan.md` §6, con CSP sin `unsafe-inline`, EN/ES, accesibilidad y lectura sin JS. La referencia de UX es Maxroll (Diablo 4) por estructura y flujo, sin copiar su material.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 22 LTS; Angular 21 (SSG con `@angular/localize`). CSS nativo; sin preprocesador.

**Primary Dependencies**: **ninguna nueva de producto** (FR-046). Posición del tooltip con una función pura propia; índice sticky con CSS; sección activa con `IntersectionObserver`; transiciones entre documentos con `@view-transition`. Tipografía: una familia OFL autoalojada que **sustituye** a Oswald (R5). Dev: nada nuevo; `typecheck:e2e` se incorpora a la puerta (R8).

**Storage**: N/A (sin cambios de modelo). Manifiesto de activos `fixtures/content/assets/manifest.json`: entradas para los iconos publicados (Q11 = B) e identificador público de icono que no expone la ruta de textura (R4, S-004). Sin cambios de modelo de guías ni catálogo.

**Testing**: Vitest/Angular (componentes, funciones puras), `node --test` (scripts), Playwright + axe (`e2e:a11y`, `e2e:journeys`, nuevo e2e de tooltip y CSP), Lighthouse CI (`check:performance`), `check:contrast`, `check:locale-parity`, `check:initial-js`, `impeccable detect` (una vez por superficie).

**Target Platform**: web estática prerenderizada servida local (MVP local-first, sin hosting) con API en Docker para release.

**Project Type**: monorepo pnpm; esta feature solo toca `apps/web` y herramientas/`scripts` de activos.

**Performance Goals**: presupuestos de §6 intactos (FR-040). Margen real medido en spec003: `/tier-list` HTML 110 406/120 000 B y JS 110 834/112 000 B; `/` JS 0 B; CSS gzip 1 657/20 000 B (R1).

**Constraints**: CSP `img-src 'self'` y `style-src 'self'` más hashes (sin `data:`, sin `unsafe-inline`); fuentes ≤ 3 familias/5 archivos; WCAG 2.2 AA; EN/ES con paridad; contenido fixtures/API sin _fallback_; constitución VII (solo iconos de habilidad —publicables tras la enmienda 1.11.0— y retratos/botón de maestría del juego).

**Scale/Scope**: 5 rutas públicas rediseñadas (`/`, `/tier-list`, `/builds/:slug`, `/maestrias`, `/maestrias/:slug`), más las páginas de contenido (`/acerca`, `/legal`, `/autores/:slug`, 404) por herencia de tokens; 6 maestrías; ≈ 186 nodos; 2 idiomas.

## Constitution Check

_GATE: previo a Fase 0, re-comprobado tras el diseño._

| Principio                            | Relevancia | Cómo lo cumple                                                                                                                                                                      |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Contenido verificable y atribuido | Alta       | Las tarjetas muestran estado de contenido y de revisión por texto; sin tier ni recomendación en `placeholder`; atribución visible en resumen de guía.                                |
| II. Sin scraping                     | Media      | Ninguna ingesta. Maxroll es solo referencia de UX; nada de su material (FR-030).                                                                                                    |
| III. SEO y compartibilidad           | Alta       | Todo el contenido (tarjetas, resumen, índice, lista de habilidades) en el HTML prerenderizado; canonical, `hreflang`, JSON-LD y sitemap intactos.                                   |
| IV. Rendimiento                      | Alta       | §6 sin ampliar; sin dependencias nuevas; tipografía en el tope de archivos; marcos como SVG estático.                                                                                |
| V. Accesibilidad AA                  | Alta       | Tarjeta = un enlace; tooltip WCAG 1.4.13 con equivalente de teclado y táctil; foco visible; no solo color; `prefers-reduced-motion`.                                                 |
| VI. Datos tipados                    | Baja       | Sin cambios de modelo de guías; vistas de presentación derivadas. Identificador público de icono y forma del manifiesto en `packages/domain` (T025).                                  |
| VII. Legalidad y activos             | Alta       | **Publicar iconos (Q11 = B) amplía la excepción 1**: exige la enmienda 1.11.0 y el análisis de riesgos aprobados **antes** (T003, T004 = puerta G1). Marcos, fondos y tipografía **propios** (Q12 = A), sin enmienda. Fallback propio terminado antes de publicar. |
| VIII. Simplicidad                    | Media      | Sin librerías de UI, sin cambios de arquitectura; componente nuevo `gd-build-card` sustituye a `gd-tier-card`.                                                                       |
| IX. Pruebas proporcionales           | Alta       | Funciones puras con tablas de borde; e2e de tooltip, recorrido, CSP; axe y Lighthouse en el verify.                                                                                  |
| X. Inglés primero / ES completo      | Alta       | Cadenas nuevas con EN y ES; `check:locale-parity` en verde.                                                                                                                         |
| XI. Backend opcional                 | Media      | `CONTENT_SOURCE=fixture\|api` sin cambios; ningún _fallback_ nuevo entre ellos.                                                                                                     |
| XII. Secretos                        | Baja       | No se tocan secretos.                                                                                                                                                                |

**Sin violaciones**, con una **condición de gobernanza**: Q11 = B contradice hoy la letra de §VII (excepción 1 limita los iconos a uso local). Por eso el plan **no versiona, extrae a carpeta servida ni publica ningún icono** hasta que T003 y T004 (análisis de riesgos y enmienda 1.11.0, aprobadas por Paco) estén hechas; las tareas dependientes lo declaran como G1. Todo lo demás (tooltip, tarjetas, guía, identidad, selector) no depende de la enmienda.

## Project Structure

### Documentation (this feature)

```text
specs/004-rediseno-ui-grim-dawn/
├── spec.md          # specify (+ clarify abierto)
├── plan.md          # este archivo
├── research.md      # Fase 0 (decisiones y alternativas)
├── quickstart.md    # Fase 1 (comandos y salidas esperadas de cierre)
├── checklists/
│   └── requirements.md
└── tasks.md         # 37 tareas en 9 fases (puerta G1 para iconos)
```

No se crean `data-model.md` ni `contracts/`: la feature no añade entidades persistentes ni interfaces externas; las «entidades» de la spec son vistas de presentación definidas en código (lección I1/A-05 de spec003). El identificador público de icono y la forma del manifiesto se documentan en `research.md` §R4 y viven en `packages/domain` (Constitución VI).

### Source Code (estructura prevista)

```text
apps/web/src/
├── styles/
│   ├── tokens.css                 # tokens revisados (color, tipografía, marcos, movimiento)
│   ├── fonts.css                  # familia nueva que sustituye a Oswald (R5)
│   ├── base.css, lang.css         # ajustes de base y @view-transition (R7)
│   └── deferred.css               # estilos del tooltip y de lo diferido (T033)
├── app/
│   ├── features/home/            # portada: destacado + tarjetas + accesos por maestría (sin JS)
│   ├── features/tier-list/        # catálogo: gd-build-card (sustituye a gd-tier-card), filtros, sección de sin guía
│   ├── features/build/            # resumen de build, índice sticky y paso a paso con árbol
│   ├── features/masteries/        # selector de maestrías, árbol con tooltip
│   ├── shared/svg/skill-tree/     # tooltip (placeTooltip), iconos de nodo, retirada del panel inferior
│   └── shared/ui/                 # build-card, marcos, símbolos de iconos propios
├── public/assets/ui/              # marcos y texturas SVG propios (9 cortes), mismo origen
└── public/assets/skill-icons/     # PNG derivados 32×32 (solo tras G1; manifiesto y NOTICE)
scripts/
├── extract-textures.mts           # (Q11=B, tras G1) PNG derivados de iconos de habilidad → .game-assets/
├── check-assets.mts               # entradas de iconos; cruce manifiesto↔BD (A-03)
└── verify-local.mjs               # typecheck:e2e en la puerta (T042/B-001)
e2e/                               # tooltip, recorrido, CSP en consola
PRODUCT.md, DESIGN.md              # raíz de apps/web (impeccable init/document, con Paco)
```

## Design decisions

1. **Tarjeta de build única, sin tarjetas anidadas** (`gd-build-card`): enlace único; dos retratos; combinación, estado de contenido y de revisión (texto + forma), daño, autor, versión. Variante «destacada» (portada) y variante «compacta» (sin guía). Sustituye a `gd-tier-card` conservando filtros, estado en URL y JSON-LD de lista (R2).
2. **Portada sin JS**: tarjetas y accesos por maestría como HTML/CSS; sin hidratación (preserva FR-10a y el 0 B de JS inicial).
3. **Catálogo por secciones** (Q13 = A): builds reales primero, combinaciones sin guía en una sección aparte y plegada, preservando una ranura por combinación (spec001 AC-04).
4. **Tooltip HTML posicionado por función pura** sobre las señales `hovered/focused/selected` existentes; `role="tooltip"` más `aria-describedby`; táctil con `selected` fijado; panel inferior retirado como mecanismo, no su información (R3).
5. **Iconos publicados (Q11 = B)**: nodo con `<image>`/`<use>`: propio con `own` (conjunto reducido por tipo, terminado antes de publicar), del juego con `ASSET_SOURCE=game` y manifiesto válido, por el mismo interruptor y la misma retirada que los retratos; falla cerrado; sin exponer rutas internas (R4). **Puerta G1**: análisis de riesgos y enmienda 1.11.0 primero.
6. **Identidad visual**: `PRODUCT.md`/`DESIGN.md` primero (con Paco), después tokens, fuente, marcos SVG estáticos y rollout por superficie; `impeccable detect` una vez por superficie (R5, R9).
7. **Guía**: resumen que **sustituye** marcado existente (presupuesto de HTML), índice sticky/plegable, sección activa por `IntersectionObserver` diferido, paso a paso enlazado al resaltado del árbol (Q14 = A) (R6).
8. **Fluidez de maestría**: `@view-transition` CSS más selector de enlaces (Q15 = A) (R7).
9. **Deuda**: entran A-03 (fuente única de estado de activos) y T042/B-001 (`typecheck:e2e`); el resto queda fuera con motivo (R8).
10. **Medición antes de componer**: la primera tarea de cada superficie mide la línea base del artefacto real; el rediseño no se integra sin `check:performance` en verde.

## Riesgos

| Riesgo                                                    | Prob. | Impacto | Mitigación                                                                                                                                   |
| --------------------------------------------------------- | ----- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML de `/tier-list` y de la guía supera 120 000 B        | Alta  | Alto    | Medir bytes por tarjeta antes de componer; variante compacta o lista para sin guía; resumen que sustituye marcado; sin subir presupuestos.    |
| JS de `/tier-list` supera 112 000 B                       | Media | Alto    | Tarjeta sin lógica; tooltip y observer solo en bloques diferidos; `check:initial-js` por tarea.                                              |
| TBT > 150 ms por el tooltip en el árbol                   | Media | Alto    | Cálculo por evento, sin _layout thrashing_; `content-visibility` ya aplicado; medir con carga concurrente (como T030).                       |
| Tipografía nueva rompe el presupuesto de fuentes          | Media | Medio   | Sustituir Oswald (no añadir); medir; fallo explícito si pasa de 5 archivos.                                                                  |
| Arte del juego fuera de §VII por entusiasmo               | Media | Alto    | Prueba de artefacto `own` sin arte del juego; revisión de derechos en la puerta de cierre; marcos propios.                                   |
| Riesgo legal de publicar iconos (Q11 = B, sin permiso escrito de Crate) | Alta  | Alto    | Decisión y riesgo asumidos por Paco; análisis de riesgos (R10) y enmienda 1.11.0 **antes** de versionar (G1); fallback propio terminado; retirada inmediata ya probada para retratos; prueba de artefacto `own`. |
| Publicar iconos antes de la enmienda por error de orden   | Media | Alto    | T027 exige T003 y T004 hechas y el orden verificable en el historial; `assets:check` no admite entradas de iconos sin `proof_ref` a R10.    |
| 164 PNG penalizan Lighthouse por peticiones               | Media | Medio   | Medir en T029; hoja de sprites por maestría si hace falta; `loading="lazy"`.                                                                |
| «AI slop» no detectado por la herramienta                 | Media | Medio   | Criterios de componente (sin tarjetas anidadas), revisión visual con Paco (SC-011), `DESIGN.md` como referencia.                              |
| Esfuerzo mayor que el estimado                            | Alta  | Medio   | Historias independientes y priorizadas (P1 → P3); cada una entrega valor sola; P3 y el paso a paso pueden quedar fuera sin bloquear.        |

## Fuera de alcance

Ver [spec.md](spec.md), «Fuera de alcance». En particular: texto de localización del juego, fondos o marcos del juego, tipografía del juego, planner, comparador, cuentas, expansiones y hosting.

## Fases (resumen de `tasks.md`)

- **Fase 0 — Gobernanza y puerta** (T001–T005): `typecheck:e2e` en `verify`; línea base medida; **análisis de riesgos (T003) y enmienda 1.11.0 de §VII (T004) = puerta G1**; fuente única del estado de activos (A-03).
- **Fase 1 — Fundación visual** (T006–T008): `PRODUCT.md`/`DESIGN.md` con Paco, tokens y tipografía OFL que sustituye a Oswald, marcos SVG propios.
- **Fase 2 — US3 tooltip** (T009–T013, P1, independiente de G1 y del tema).
- **Fase 3 — US1 tarjetas** (T014–T019, P1): tope de bytes medido, `gd-build-card`, portada sin JS, catálogo con «sin guía» plegada.
- **Fase 4 — US2 guía** (T020–T023, P1; el paso a paso T022 es P3 dentro de la historia).
- **Fase 5 — US4 iconos publicados** (T024–T029, P2): fallback propio sin G1; el resto tras G1.
- **Fase 6 — US5 rollout visual** (T030–T032, P2), con revisión visual de Paco.
- **Fase 7 — US6 maestrías** (T033–T034, P3): selector y `@view-transition`.
- **Fase 8 — Cierre** (T035–T037): `verify` completo, puerta spec002 y registro SDD.

`speckit-analyze` se ejecuta con `tasks.md` presente, **antes** de implementar (a diferencia de spec003, que lo corrió al cierre); sus hallazgos están en el reporte del agente.
