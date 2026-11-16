# Investigación (Fase 0): rediseño de UI estilo Grim Dawn

**Spec**: [spec.md](spec.md) | **Fecha**: 2026-11-15

> Estado: **decisiones cerradas** con las respuestas de Paco del 2026-11-15 (Q11 = B; Q12–Q15 = A;
> ver `spec.md`, «Clarifications»). Nada aquí es una medición nueva salvo donde se cita una salida
> real de spec003 (`verify-final-bab5e34.log`); las cifras marcadas «a validar» las fija una tarea.

## R1 — Punto de partida medido (spec003, `bab5e34`, `pnpm verify` exit 0)

| Ruta                 | HTML (máx. 120 000 B) | CSS gzip (máx. 20 000 B) | JS inicial gzip                |
| -------------------- | --------------------- | ------------------------ | ------------------------------ |
| `/`                  | 16 286 B              | 1 657 B                  | 0 B (límite 90 000 B)          |
| `/tier-list`         | 110 406 B             | 1 657 B                  | 110 834 B (límite vigente 112 000 B) |
| `/maestrias`         | 20 478 B              | 1 657 B                  | 105 367 B (límite 112 000 B)   |
| `/maestrias/soldier` | 79 842 B              | 4 092 B                  | 114 985 B (límite 150 000 B)   |

Consecuencias de diseño:

- **La portada no lleva JS** (0 B, FR-10a de spec001): las tarjetas de portada son HTML y CSS, sin hidratación.
- **`/tier-list` casi no tiene margen de HTML** (≈ 9,6 kB hasta 120 000 B) y de JS (≈ 1,2 kB hasta 112 000 B). El rediseño de tarjetas **no puede** añadir marcado por tarjeta sin medir; es el riesgo principal (R2).
- **El CSS tiene mucho margen** (1,7 kB de 20 kB): el sistema visual puede crecer en CSS crítico, pero los marcos y texturas deben ser archivos estáticos, no CSS inflado.
- La guía no aparece en la salida citada (ruta de borradores locales); en spec003 estaba en ≈ 110,6/120 kB de HTML (Pregunta 9 de `preguntas-ui.md`).

## R2 — Tarjetas sin romper el HTML de `/tier-list`

**Decisión**: una sola pieza de marcado por tarjeta, con dos `<img>` de retrato (dimensiones fijas, `loading="lazy"`, `decoding="async"`) y texto; marcos, texturas y glifos por **CSS y archivos estáticos**, nunca SVG en línea repetido. Las combinaciones sin guía usan una variante compacta (sin retrato grande, sin metadatos largos) o una lista (Q13 = A: sección aparte y plegada).

**Racional**: el presupuesto de HTML es por página y el catálogo ya está al 92 %. Cada byte por tarjeta se multiplica por el número de entradas.

**Alternativas**: (a) subir el presupuesto de HTML — descartado por spec (FR-040); (b) paginar o cargar más al desplazarse — añade JS y rompe la lectura sin JS; (c) `content-visibility: auto` en las tarjetas — no reduce bytes, solo trabajo de render; sí se usa como complemento (precedente: T030).

**Verificación futura**: medir bytes por tarjeta en la primera tarea y fijar un tope (se propone ≤ 600 B por tarjeta compacta y ≤ 1 000 B por tarjeta de build con guía; **cifras a validar con medición**, no medidas).

## R3 — Tooltip junto al nodo

**Estado actual** (código, no medición): el componente `gd-skill-tree` ya mantiene `hoveredId`, `focusedId` y `selectedId` y muestra el detalle en un `<section class="skill-tree__detail">` **bajo el árbol** (`skill-tree.html:207`), con `aria-live`. La navegación con flechas existe (`keyboard-nav.ts`).

**Decisión**: reutilizar esas señales y mostrar un **tooltip HTML** (no `foreignObject`) posicionado de forma absoluta dentro del contenedor del árbol, calculado con una función pura `placeTooltip(anchorRect, tipSize, bounds, gap)` (arriba/abajo/izquierda/derecha con volteo y recorte al viewport). Semántica: `role="tooltip"` y `aria-describedby` en el nodo mientras es visible; en táctil, el estado `selected` actual pasa a mostrar el tooltip fijado con botón de cierre.

**Racional**: es un cambio de presentación sobre la lógica de selección ya probada (spec003 T010–T018); la función pura se prueba con tablas de casos de borde sin navegador. El JS extra es pequeño y vive en el bloque diferido (los árboles ya están fuera del JS inicial en la guía).

**Alternativas descartadas**: (a) _CSS anchor positioning_ — soporte aún desigual entre navegadores objetivo; se puede usar después como mejora progresiva, no como base; (b) librería de _floating UI_ — dependencia nueva sin justificación (Constitución IV); (c) `title` nativo o `popover` — sin control de posición ni contenido estructurado.

**Riesgos**: TBT de las URLs de árbol (medianas hoy 21,5–66 ms bajo carga concurrente, tras T030); el cálculo de posición debe ser por evento y sin _layout thrashing_. WCAG 1.4.13 (descartable, _hoverable_, persistente).

## R4 — Iconos de habilidad publicados (Q11 = B)

**Hechos** (spec003 `research.md` §T028): los 186 iconos de las 6 maestrías base existen en `UI.arc` (`ui/skills/icons/classNN/skillicon_*up.tex`, 32 × 32, BGRA), son 164 `.tex` distintos y se decodifican a PNG con `scripts/extract-textures.mts`. Hoy el catálogo guarda en cada nodo el nombre de la textura (`icon`), pero la vista pública no lo expone (S-004, migración `0013`). Los retratos ya siguen el camino que reutilizamos: PNG versionados en `apps/web/public/assets/portraits/`, entrada en el manifiesto, `ASSET_SOURCE=own|game` explícito en release, `emit-portraits.mts` que los copia solo con `game`, `assertNoGamePortraits` que rechaza un artefacto `own` con ellos y `status: withdrawn`.

**Decisión (Paco)**: publicar los iconos como los botones de maestría: **PNG derivados versionados**, con manifiesto, atribución a Crate y aviso de no afiliación, y retirada inmediata. Sin permiso escrito de Crate; riesgo asumido por Paco. Consecuencias de diseño:

1. **Orden obligatorio (FR-018)**: primero la **enmienda 1.11.0** de §VII y la **actualización del análisis de riesgos** (sección nueva de este `research.md`, §R10, a la que apuntará `proof_ref`), ambas aprobadas por Paco; solo después se puede extraer, versionar o servir un icono. Es una tarea SDD de spec004 con puerta explícita en `tasks.md`.
2. **Identificador público** (S-004): el nodo no puede exponer la ruta interna de textura. Propuesta a validar en la tarea de dominio: `icon_id` público estable, derivado del identificador del nodo o del hash del PNG derivado (no de la ruta del juego), y un mapa `icon_id → archivo` generado al emitir; el manifiesto declara una entrada por icono o, si 164 entradas resultan inmanejables, **una entrada por colección** con la lista de archivos y sus `sha256` (decisión a cerrar con Paco al revisar la enmienda, porque la condición común de §VII habla de «una entrada»).
3. **Tamaño**: 164 PNG de 32 × 32 (del orden de 1–3 kB cada uno; **cifra a medir**, no medida). Se sirven como archivos estáticos con `width`/`height` fijos y `loading="lazy"`; no entran en el HTML ni en el JS. Se evalúa una **hoja de sprites por maestría** (1 PNG por árbol) si el número de peticiones por página penaliza Lighthouse; sería una decisión de medición, no de principio.
4. **CSP**: `img-src 'self'` basta (mismo origen, sin `data:`).
5. **Fallback propio**: un conjunto reducido de SVG (por tipo de habilidad: activa, modificadora, _transmuter_, circular, pasiva, más glifo de maestría) en una hoja `<symbol>` referenciada por `<use>`; se usa con `own`, con un icono `withdrawn` y mientras la enmienda no esté aprobada. El fallback debe estar **terminado antes** de publicar (§VII, excepción 1).
6. **Interruptor**: `ASSET_SOURCE=game` ya está activo en release y CI para los retratos (spec003 T015/T036); los iconos se cuelgan del mismo interruptor para no crear un segundo mecanismo. Con `own` el build sigue sin arte del juego y la prueba de artefacto lo comprueba (SC-009).
7. **Atribución**: el aviso visible a Crate y de no afiliación ya existe en las páginas con retratos; debe cubrir también las de árbol y guía, y `NOTICE.md` listar los iconos.
8. **Riesgo de rendimiento**: 30–33 iconos por árbol. Como `<image>` en el SVG suman ≈ 120 B por nodo (≈ 3–4 kB por árbol; margen de `/maestrias/soldier`: ≈ 40 kB, a medir); las peticiones de imagen no afectan al HTML.

## R5 — Identidad visual y arte propio (Q12 = A)

**Hechos**: `tokens.css` ya define una paleta cálida de carbón (`--color-soot #0c0a08`, `--color-panel #15110d`), acento dorado (`--color-storm #d8b15a`) y ascua (`--color-ember #e07845`); tipografías Oswald (rótulos), Karla (texto) y Space Mono (datos), autoalojadas (116 308 B, 5 archivos, 3 familias: el tope de §6). La CSP exige `img-src 'self'` (sin `data:`), por lo que los marcos con `border-image` deben ser **archivos SVG estáticos de mismo origen** (`/assets/ui/*.svg`), no URIs de datos.

**Decisión (Q12 = A, Paco)**: marcos de 9 cortes (`border-image`) y texturas sutiles como SVG propios en `apps/web/public/assets/ui/`, documentados en `DESIGN.md`; ningún arte de Crate fuera de los iconos y botones de maestría.

**Tipografía**: Oswald es condensada sin carácter de grabado; la identidad pide un rótulo serif de inspiración clásica. Debe sustituir a Oswald (mismo número de archivos), con licencia OFL, subconjunto latin + latin-ext y `preload` de la principal. **El candidato concreto y su peso se deciden en la tarea de fundación con medición**; el criterio de aceptación es «no superar 3 familias ni 5 archivos y ≤ el peso actual + 20 kB» (cifra a validar, no medida). Sin tipografía del juego.

**Alternativas descartadas por Paco**: B (enmienda de §VII para marcos locales) y C (publicar marcos y fondos del juego). La enmienda 1.11.0 de esta spec cubre **solo** los iconos de habilidad (R4); marcos, fondos y tipografía siguen fuera de §VII.

## R6 — Flujo de guía (Q14 = A)

**Hechos**: la página de guía ya tiene `build/toc` (índice), `build/purchase-stepper` (orden de compra), `build/sections`, `build/skills` (árbol) y `build/attribution`. El rediseño añade **un resumen de build** y reordena; no escribe lógica de contenido nueva.

**Decisión (Q14 = A, Paco)**: (1) bloque de resumen al principio, con retratos, daño, estado, autor, versión, fuente; (2) índice sticky en escritorio y plegable en móvil, con sección activa por `IntersectionObserver` en el bloque diferido; (3) enlazar el paso del `purchase-stepper` con el resaltado del árbol (modo asignación). El HTML de la guía está al ≈ 92 % del presupuesto: el resumen debe sustituir marcado existente, no sumarse; si no cabe, se mueve a un estático diferido o se aplaza el punto (3).

## R7 — Fluidez entre maestrías (Q15 = A)

**Decisión (Q15 = A, Paco)**: `@view-transition { navigation: auto; }` en la hoja global (CSS puro, mejora progresiva) y un selector de maestrías con enlaces normales. Sin JS adicional y sin cambiar el router.

**Descartado por Paco (Q15 = A)**: carga en cliente de los JSON estáticos al elegir (más JS inicial en `/maestrias/*`, estados de carga/error y riesgo de TBT).

## R8 — Deuda de spec003 que entra

| ID                      | Decisión                                                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-03 (ronda 1)          | **Entra**. La retirada inmediata de iconos (FR-019) exige una sola fuente de verdad del estado de un activo. Propuesta: el manifiesto del repositorio manda en el artefacto; el build de release **falla** si la tabla `assets` y el manifiesto discrepan en `status`. No se borra la tabla. |
| T042 — B-001 (ronda 3) | **Entra**. `typecheck:e2e` pasa a `verify` y al CI de PR antes de escribir los e2e nuevos.                                                                                                                                                                     |
| A-01 (rondas 1 y 3), C-003, T042 — C-001/F-001, T043 | **Fuera**, con motivo: refactor de dominio/herramientas de BD sin efecto en la UI. Quedan en el backlog técnico (`specs/backlog-dx.md` o To-do).                                                                                                |

## R9 — Medición anti «AI slop» (SC-010)

`impeccable detect --json <objetivos>` es una comprobación mecánica determinista (no sustituye al juicio). Se ejecuta **una vez** al terminar cada superficie, sobre los archivos cambiados. Lo que no detecta el detector (tarjetas anidadas, tarjetas idénticas, _eyebrows_, ilustraciones que imitan imágenes) se cubre con **pruebas de componente** (ninguna tarjeta contiene `.card`, una sola jerarquía de encabezados) y con la revisión visual con Paco (SC-011). Las skills `impeccable` se invocan por ruta absoluta desde el checkout principal porque están gitignoradas (memoria de proyecto).

## R10 — Análisis de riesgos de publicar iconos (`proof_ref`; **pendiente de redactar en T003**)

Esta sección es el destino de `proof_ref` de los iconos. **No se redacta aquí**: es el entregable de la tarea de enmienda (T003) y debe quedar aprobado por Paco antes de cualquier tarea que versione iconos. Contenido mínimo exigido:

- Qué se publica (164 PNG 32 × 32, derivados sin modificar de `UI.arc`), dónde y bajo qué interruptor.
- Base de uso: tolerancia de facto de la comunidad, **sin permiso escrito de Crate**; la atribución no sustituye al permiso (§VII); riesgo asumido por Paco el 2026-11-15.
- Escenarios de riesgo (reclamación de Crate, retirada, difusión por terceros) y su mitigación: retirada inmediata (`withdrawn`), fallback propio ya terminado, aviso de no afiliación, prueba de artefacto `own`.
- Qué **no** se publica: texto de localización, descripciones, fondos, marcos, otro arte, `.dbr`/`.arc`/`.arz`.
- Reversibilidad: pasos y tiempo de retirada (referencia a `docs/content/takedown-runbook.md`).
- Decisión del dueño (cita de la respuesta a la Pregunta 11 de `preguntas-ui.md`).

## R11 — Lo que no se investiga aquí

Detalle de maquetación de cada pantalla (se decide en `shape`/`DESIGN.md` con Paco), elección final de la tipografía (R5) y los números de bytes por tarjeta (R2): son tareas de medición del plan, no de esta fase.
