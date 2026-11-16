# Investigación (Fase 0): rediseño de UI estilo Grim Dawn

**Spec**: [spec.md](spec.md) | **Fecha**: 2026-11-15

> Estado: **decisiones cerradas** con las respuestas de Paco del 2026-11-15 (Q11 = B; Q12–Q15 = A;
> ver `spec.md`, «Clarifications»). R1 es una medición nueva (spec004 T002, `14fc7e3`); el resto cita spec003 o plantea hipótesis; las cifras marcadas «a validar» las fija una tarea.

## R1 — Línea base medida (spec004 T002, commit `14fc7e3`)

**Qué se midió**: el artefacto real de `pnpm build` (no `ng serve`), con `pnpm build`, `pnpm check:initial-js` y `pnpm check:performance` ejecutados el 2026-11-15 en el worktree `orq/11111619-ui-s4-t002`, árbol limpio sobre `14fc7e3` (sin cambios de código respecto a spec003). Entorno: Windows 11, Lighthouse 13.6.0, HeadlessChrome 157, móvil con 4G lento simulado, 3 corridas por ruta (mediana).

Bytes deterministas (misma salida en `pnpm build` y en `pnpm check:performance`):

| Ruta                       | HTML (máx. 120 000 B) | Margen HTML | CSS gzip (máx. 20 000 B)       | JS inicial gzip (límite)            | Margen JS |
| -------------------------- | --------------------- | ----------- | ------------------------------ | ----------------------------------- | --------- |
| `/`                        | 16 286 B              | 103 714 B   | 1 657 B                        | 0 B (90 000)                        | 90 000 B  |
| `/es`                      | 16 484 B              | 103 516 B   | 1 657 B                        | 0 B (90 000)                        | 90 000 B  |
| `/tier-list`               | 110 372 B             | 9 628 B     | 1 657 B                        | 110 834 B (112 000)                 | 1 166 B   |
| `/es/tier-list`            | 107 514 B             | 12 486 B    | 1 657 B                        | 110 834 B (112 000)                 | 1 166 B   |
| `/builds/<slug>` (1)       | 111 577 B             | 8 423 B     | 1 658 B + 2 463 B diferida (2) | ≈ 122 963 B (sin límite propio) (1) | —         |
| `/es/builds/<slug>` (1)    | 112 032 B             | 7 968 B     | 1 658 B + 2 463 B diferida (2) | ≈ 122 963 B (1)                     | —         |
| `/maestrias`               | 20 478 B              | 99 522 B    | 1 657 B                        | 105 367 B (112 000)                 | 6 633 B   |
| `/es/maestrias`            | 20 731 B              | 99 269 B    | 1 657 B                        | 105 367 B (112 000)                 | 6 633 B   |
| `/maestrias/soldier`       | 79 842 B              | 40 158 B    | 4 092 B                        | 114 985 B (150 000)                 | 35 015 B  |
| `/es/maestrias/soldier`    | 81 689 B              | 38 311 B    | 4 092 B                        | 114 985 B (150 000)                 | 35 015 B  |
| `/maestrias/demolition`    | 83 459 B              | 36 541 B    | 4 092 B                        | 114 985 B (150 000)                 | 35 015 B  |
| `/es/maestrias/demolition` | 85 143 B              | 34 857 B    | 4 092 B                        | 114 985 B (150 000)                 | 35 015 B  |

1. **La guía no está en ninguna puerta automática**: `check:performance` y `check:initial-js` no la miden (Lighthouse cubre `/`, `/tier-list`, `/acerca`, `/legal`, `/autores/<slug>`, `/maestrias` y sus ES; el JS inicial cubre `/`, `/tier-list`, `/maestrias` y dos árboles). Las cifras de `/builds/<slug>` son una **medición manual** de este build (slug `chaman-demoledor-golpe-primigenio`): HTML con `wc -c`, y JS sumando con `gzip -6` los `<script src>` y `modulepreload` del HTML (sin scripts en línea; aproximado). Es la ruta crítica de T020: T020 y T023 deben **añadirla a las puertas** antes de cerrar la superficie.
2. La hoja `deferred.css` (15 303 B, 2 463 B gzip) se carga por `<link>` en las rutas con bloques diferidos (guía, árbol); no cuenta como CSS crítico de la puerta, pero pesa en la guía.

**CSS**: la hoja global es `styles-GNSRWREQ.css`, 5 088 B (1 658 B gzip); en `/maestrias/<slug>` la puerta mide 4 092 B gzip porque suma las hojas de la ruta. Margen mínimo: 15 908 B gzip de 20 000.

**Fuentes (peso actual)**: 5 archivos `.woff2` de 3 familias, **116 308 B** en total (el tope de §6: 3 familias y 5 archivos).

| Archivo                              | Familia / uso      | Bytes  |
| ------------------------------------ | ------------------ | ------ |
| `karla-latin-wght-normal.woff2`      | Karla (texto)      | 32 116 |
| `karla-latin-ext-wght-normal.woff2`  | Karla (texto)      | 15 232 |
| `oswald-latin-wght-normal.woff2`     | Oswald (rótulos)   | 28 488 |
| `oswald-latin-ext-wght-normal.woff2` | Oswald (rótulos)   | 23 952 |
| `space-mono-latin-400-normal.woff2`  | Space Mono (datos) | 16 520 |

Oswald, la familia que spec004 T007 sustituye, pesa **52 440 B** (45 %). El criterio de T007 («peso total ≤ actual + 20 kB») equivale a **≤ 136 308 B**: una familia de rótulo de peso similar al de Oswald cabe de sobra.

**Lighthouse (`check:performance`, una ejecución completa de 16 min 58 s, 3 corridas por ruta)**: LCP, CLS y los otros cuatro índices pasan en todas las rutas. **Falla TBT** en seis rutas, **con carga concurrente en la máquina** (otros dos agentes ejecutando `verify`), por lo que el TBT está inflado y **no es una línea base fiable**:

| Ruta                       | TBT mediana (corridas)           | Límite | Resultado |
| -------------------------- | -------------------------------- | ------ | --------- |
| `/`                        | 0 ms (19,5 · 0 · 0)              | 150 ms | OK        |
| `/es`                      | 21,5 ms (21,5 · 48,6 · 0)        | 150 ms | OK        |
| `/tier-list`               | 171,5 ms (145,3 · 253,5 · 171,5) | 150 ms | **FALLA** |
| `/es/tier-list`            | 298,6 ms (240,5 · 299,6 · 298,6) | 150 ms | **FALLA** |
| `/maestrias`               | 82 ms (75 · 89,5 · 82)           | 150 ms | OK        |
| `/es/maestrias`            | 112 ms (76 · 112 · 196,5)        | 150 ms | OK        |
| `/maestrias/soldier`       | 286,5 ms (350,6 · 286,5 · 271)   | 150 ms | **FALLA** |
| `/maestrias/demolition`    | 282,5 ms (411,7 · 282,5 · 246)   | 150 ms | **FALLA** |
| `/es/maestrias/soldier`    | 188,5 ms (333 · 188,5 · 48,5)    | 150 ms | **FALLA** |
| `/es/maestrias/demolition` | 416,5 ms (416,5 · 464 · 237,5)   | 150 ms | **FALLA** |

`/acerca`, `/legal` y `/autores/<slug>` dan TBT ≤ 2 ms. Es el patrón que spec003 documentó (T030: TBT de 13 a 350 ms con la máquina cargada y mucho menor en reposo). La conclusión es de método: el TBT de la línea base **no se fija con esta ejecución**; las tareas de superficie lo comparan con una corrida en reposo del mismo commit o repiten `check:performance` hasta tener medianas sin carga concurrente. **Segunda ejecución** (la de `pnpm verify`, mismo commit y misma máquina cargada, 16 min): fallan 4 rutas, `/es/tier-list` 152 ms (152 · 161 · 139,5), `/maestrias/demolition` 288 ms, `/es/maestrias/soldier` 312,5 ms y `/es/maestrias/demolition` 276 ms; `/tier-list` y `/maestrias/soldier` pasan. El mismo commit pasa y falla según la corrida: confirma que el TBT depende de la carga. Solo se hicieron **dos** ejecuciones completas (cada una dura ≈ 17 min), no tres. Los bytes son deterministas y fiables.

Consecuencias de diseño:

- **La portada no lleva JS** (0 B, FR-10a de spec001): las tarjetas de portada son HTML y CSS, sin hidratación.
- **`/tier-list` casi no tiene margen** de HTML (9 628 B EN; 12 486 B ES) ni de JS (1 166 B). El rediseño de tarjetas **no puede** añadir marcado por tarjeta sin medir; es el riesgo principal (R2).
- **La guía tiene el menor margen de HTML** de las rutas de contenido (8 423 B EN; 7 968 B ES) y carece de puerta automática (nota 1).
- **El CSS tiene mucho margen** (≥ 15 908 B gzip): el sistema visual puede crecer en CSS crítico, pero los marcos y texturas deben ser archivos estáticos, no CSS inflado.
- **Las fuentes** dejan ≈ 20 kB de holgura para sustituir Oswald (T007).
- **`/maestrias/<slug>`** tiene 35 015 B de margen de JS y 35–40 kB de HTML: los iconos de habilidad por `<img>` (R4, punto 8) caben, sin contar las peticiones de imagen.

## R2 — Tarjetas sin romper el HTML de `/tier-list`

**Decisión**: una sola pieza de marcado por tarjeta, con dos `<img>` de retrato (dimensiones fijas, `loading="lazy"`, `decoding="async"`) y texto; marcos, texturas y glifos por **CSS y archivos estáticos**, nunca SVG en línea repetido. Las combinaciones sin guía usan una variante compacta (sin retrato grande, sin metadatos largos) o una lista (Q13 = A: sección aparte y plegada).

**Racional**: el presupuesto de HTML es por página y el catálogo ya está al 92 %. Cada byte por tarjeta se multiplica por el número de entradas.

**Alternativas**: (a) subir el presupuesto de HTML — descartado por spec (FR-040); (b) paginar o cargar más al desplazarse — añade JS y rompe la lectura sin JS; (c) `content-visibility: auto` en las tarjetas — no reduce bytes, solo trabajo de render; sí se usa como complemento (precedente: T030).

**Margen de partida** (R1, spec004 T002): `/tier-list` conserva 9 628 B de HTML (EN) y 12 486 B (ES), y 1 166 B de JS inicial; la guía, 8 423 B (EN) y 7 968 B (ES) de HTML.

**Verificación futura**: medir bytes por tarjeta en la primera tarea y fijar un tope (se propone ≤ 600 B por tarjeta compacta y ≤ 1 000 B por tarjeta de build con guía; **cifras a validar con medición**, no medidas).

**Resultado de la medición (spec004 T014, base `86a6385`, `pnpm build` del artefacto real)**: prototipo con el componente `gd-build-card` de T015 sustituyendo a `gd-tier-card` en `/tier-list` (fixtures: 45 combinaciones, todas `placeholder` salvo la guía de borradores; 1 destacada + 2 estándar + 42 compactas en el prototipo). Cifras del HTML prerenderizado, sin comprimir:

| Concepto                                          | Antes (`gd-tier-card`) | Prototipo (`gd-build-card`)            |
| ------------------------------------------------- | ---------------------- | -------------------------------------- |
| Tarjeta sin guía (compacta)                       | 874–894 B (media 884)  | 289–311 B (media 297)                  |
| Tarjeta con guía (destacada/estándar, 2 retratos) | —                      | 1 127–1 131 B (hasta 3 hechos de daño) |
| 45 tarjetas, total del bloque                     | 39 793 B               | ≈ 15 900 B                             |
| HTML `/tier-list` EN (máx. 120 000 B)             | 110 724 B              | 84 135 B (margen 35 865 B)             |
| HTML `/es/tier-list` ES                           | 107 862 B              | 84 386 B                               |
| JS inicial `/tier-list` (máx. 112 000 B)          | 110 834 B              | 111 568 B (+734 B; margen 432 B)       |

**Topes fijados**: **≤ 400 B por tarjeta compacta** (medido ≤ 311 B) y **≤ 1 250 B por tarjeta con guía** (medido ≤ 1 131 B; son pocas por página). Peor caso razonable: 1 guía + 44 compactas ≈ 83 kB de HTML, dentro de 120 000 B con margen > 35 kB; incluso 45 tarjetas con guía de dos retratos (inexistente en el catálogo real) caben (≈ 119 kB). **El HTML cabe: no hace falta variante en lista ni parar.** El riesgo real es el **JS inicial**: con la tarjeta como plantilla sin lógica ni `computed` (etiquetas resueltas en `buildCardData`) y retirando `gd-tier-card`, `gd-content-badge` y `gd-external-attribution`, `/tier-list` sube +734 B (incluye el mapeo temporal del prototipo, que T017 sustituirá). La primera versión del componente, con `computed` y etiquetas dentro, subía +1 244 B y superaba el límite en 78 B: por eso la tarjeta es solo marcado y CSS. Las entradas `enlace_externo` (hoy `gd-external-attribution`) deben resolverse en T017 sin añadir JS.

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
2. **Identificador público** (S-004): el nodo no puede exponer la ruta interna de textura. Propuesta a validar en la tarea de dominio: `icon_id` público estable, derivado del identificador del nodo o del hash del PNG derivado (no de la ruta del juego), y un mapa `icon_id → archivo` generado al emitir; el manifiesto declara **una entrada por icono** (164 entradas, igual que los retratos; decisión de Paco, Pregunta 21 = A, 2026-11-15, fijada en la enmienda 1.11.0 de §VII), cada una con su `sha256`.
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

| ID                                                   | Decisión                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-03 (ronda 1)                                       | **Entra**. La retirada inmediata de iconos (FR-019) exige una sola fuente de verdad del estado de un activo. Propuesta: el manifiesto del repositorio manda en el artefacto; el build de release **falla** si la tabla `assets` y el manifiesto discrepan en `status`. No se borra la tabla. |
| T042 — B-001 (ronda 3)                               | **Entra**. `typecheck:e2e` pasa a `verify` y al CI de PR antes de escribir los e2e nuevos.                                                                                                                                                                                                   |
| A-01 (rondas 1 y 3), C-003, T042 — C-001/F-001, T043 | **Fuera**, con motivo: refactor de dominio/herramientas de BD sin efecto en la UI. Quedan en el backlog técnico (`specs/backlog-dx.md` o To-do).                                                                                                                                             |

## R9 — Medición anti «AI slop» (SC-010)

`impeccable detect --json <objetivos>` es una comprobación mecánica determinista (no sustituye al juicio). Se ejecuta **una vez** al terminar cada superficie, sobre los archivos cambiados. Lo que no detecta el detector (tarjetas anidadas, tarjetas idénticas, _eyebrows_, ilustraciones que imitan imágenes) se cubre con **pruebas de componente** (ninguna tarjeta contiene `.card`, una sola jerarquía de encabezados) y con la revisión visual con Paco (SC-011). Las skills `impeccable` se invocan por ruta absoluta desde el checkout principal porque están gitignoradas (memoria de proyecto).

## R10 — Análisis de riesgos de publicar iconos (`proof_ref`)

Estado: **aprobado por Paco el 2026-11-15** (Pregunta 21 = A; manifiesto: una entrada por icono). Redactado en spec004 T003; habilita spec004 T004 (enmienda 1.11.0). Es el destino de `proof_ref` de los iconos (`specs/004-rediseno-ui-grim-dawn/research.md#r10`). Sigue el patrón del análisis de spec003 (`specs/003-catalogo-arboles-maestria/research.md#t029`), que ya exigía revisar este texto antes de publicar iconos.

> **Constancia literal: no existe permiso escrito de Crate Entertainment. La base del uso es tolerancia de facto de la comunidad, asumida como riesgo por el dueño del repositorio. La atribución no sustituye al permiso.**

### R10.1 — Qué se publica, dónde y bajo qué interruptor

- **Qué**: los iconos de habilidad de las seis maestrías base: 186 referencias de nodo que corresponden a 164 texturas `.tex` distintas de `ui/skills/icons/classNN/skillicon_*up.tex` en `UI.arc` (32 × 32, BGRA; spec003 `research.md` §T028). Cada una se publica como **PNG derivado sin más modificación que la decodificación** `.tex` → PNG de `scripts/extract-textures.mts` (sin recolorear, reescalar ni recortar).
- **Dónde**: versionados en `apps/web/public/assets/skill-icons/` (carpeta bajo `assets/`, vigilada por `pnpm assets:check`) y servidos desde el mismo origen (`img-src 'self'`). No entran en el HTML, ni en el JS, ni como datos en línea.
- **Cómo se identifican**: por un `icon_id` público estable, **nunca** por la ruta de textura del juego (S-004); el JSON emitido y la API no exponen `icon`.
- **Interruptor**: el mismo `ASSET_SOURCE=own|game` de los retratos (por defecto `own`). Con `game` (release y CI, como los botones de maestría) se sirven los PNG; con `own` el artefacto no contiene arte del juego y una prueba lo comprueba (SC-009).
- **Cuándo**: solo tras T003 (este análisis) y T004 (enmienda 1.11.0), ambos aprobados por Paco (puerta G1 de `tasks.md`).

### R10.2 — Base de uso sin permiso escrito

- No hay licencia ni permiso de Crate. La base es la **tolerancia de facto** de la comunidad con los fansites, tal como la valoró spec003 («media-baja» probabilidad de petición de retirada). Es una estimación, **no** un derecho ni una prueba de permiso: puede cambiar en cualquier momento.
- **No es una licencia**: el manifiesto lo declara con el valor literal `license_or_permission = tolerancia_de_facto_sin_permiso`; la atribución a Crate y el aviso de no afiliación son obligatorios pero **no sustituyen al permiso** (§VII).
- **Qué cambia respecto a spec003**: spec003 ya publica los seis botones de maestría (197 × 41) bajo la misma base. Publicar los iconos **multiplica el volumen** (de 6 a 164 archivos) y la **visibilidad** (aparecen en cada árbol y guía), no la naturaleza del riesgo. spec003 ya fijó que publicar iconos exigía revisar este análisis.
- **Quién lo asume**: el dueño del repositorio (Paco), el 2026-11-15 (R10.6). El proyecto no afirma ante terceros tener autorización.
- **Vía de mejora**: pedir permiso escrito a Crate sigue siendo posible y preferible (`docs/content/permission-request-template.md`); si llegara, cambiaría `license_or_permission` y este análisis, no el diseño.

### R10.3 — Escenarios de riesgo y mitigación

| Escenario                                                     | Probabilidad (estimación, no medida) | Impacto                                                  | Mitigación decidida                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crate pide retirar** los iconos (o el sitio)                | Media-baja                           | Medio: se pierde el reconocimiento por icono en el árbol | Retirada inmediata (R10.5): `status: withdrawn`, archivo borrado y fallback propio (`skill-icons.svg`) **en el mismo cambio**; objetivo operativo ≤ 72 h del runbook.                 |
| **Mayor exposición** al publicar 164 archivos en vez de 6     | Alta                                 | Medio                                                    | Solo iconos de habilidad, sin otro arte; atribución y no afiliación visibles en `/maestrias/*` y en la guía; `NOTICE.md` los lista; sin ingesta automatizada.                         |
| **Confundir tolerancia con licencia** (en el texto o la UI)   | Alta                                 | Alto (deuda ética/legal)                                 | Constancia literal en §VII, manifiesto y `NOTICE.md`; ningún texto del sitio dice «con permiso» ni «oficial»; revisión de textos en spec004 T028.                                     |
| **Difusión por terceros** (reutilizan el PNG, forks, espejos) | Media                                | Medio: repositorio y archivos son públicos               | No se puede impedir. Se limita lo ofrecido (solo PNG 32 × 32 derivados, sin `.tex`, `.arc` ni `.arz`) y se mantiene la procedencia y titularidad en `NOTICE.md`. Ver riesgo residual. |
| **Fallo técnico**: `game` activo sin entrada válida           | Baja                                 | Alto: se publica algo sin respaldo en el manifiesto      | El build falla cerrado si falta una entrada `approved` (`assertGameAssets`); `assets:check` rechaza archivos sin entrada; prueba de artefacto `own` sin PNG del juego.                |
| **Ampliar por inercia** a marcos, fondos u otro arte          | Media                                | Alto                                                     | §VII y la enmienda 1.11.0 acotan a iconos de habilidad; marcos y fondos son propios (Q12 = A); toda ampliación exige enmienda nueva.                                                  |
| **Contaminación** con Grim Tools o texto del juego            | Media                                | Alto                                                     | §VII lo prohíbe; el esquema de fuentes no cambia; incorporación manual y editorial; ningún texto de localización viaja con los iconos.                                                |

**Riesgo residual aceptado** (se declara, no se oculta): (1) el **historial de git conserva** los PNG tras una retirada; borrar el archivo no reescribe la historia, y reescribirla en un repositorio público es una decisión aparte; (2) cachés de navegador, CDN y espejos de terceros pueden conservar copias; (3) la tolerancia puede revocarse sin aviso.

### R10.4 — Qué **no** se publica

- Texto de localización del juego (los nombres ya versionados en fixtures son texto factual aparte, spec003 T025, y no viajan con los iconos).
- Descripciones o valores internos de habilidades, `.dbr`, `.arc`, `.arz` y cualquier dato interno de la copia del juego.
- Fondos del árbol, marcos, botones de selección de clase, pestañas, cursores, tipografía del juego y cualquier otro arte de `UI.arc` (marcos y texturas son SVG propios; Q12 = A).
- La base de datos de Grim Tools y la marca Grim Dawn como propia.
- Las **texturas de origen** (`.tex`): se extraen a una carpeta gitignorada; solo el PNG derivado de un icono con entrada `approved` entra en el repositorio.
- Iconos de otras maestrías o expansiones sin entrada: el alcance son las seis maestrías base de este catálogo.

### R10.5 — Reversibilidad y tiempo de retirada

Procedimiento: el de `docs/content/takedown-runbook.md` (canal: GitHub Issues del repositorio; **objetivo operativo de despublicar en ≤ 72 h** desde que la solicitud es verificable, que no es una garantía contractual; «despublicar primero, discutir después»), aplicado a los iconos así:

1. Registrar la solicitud (fecha, canal, solicitante, activos afectados) y verificar la titularidad sin retrasar la retirada ante duda razonable.
2. En **un solo cambio**: cada entrada afectada pasa a `status: withdrawn` (sin `file_path`), se borran los PNG de `apps/web/public/assets/skill-icons/`, se registra en `handoff.md` y el nodo muestra el fallback propio.
3. Alternativa inmediata y global: fijar `ASSET_SOURCE=own` en `build:release` y en la CI; el artefacto vuelve a no contener arte del juego (comprobado por la prueba de artefacto).
4. Regenerar el build público, comprobar que `dist/` no conserva los archivos, responder al solicitante y registrar el cierre.

No es reversible por este procedimiento: el historial de git y las copias de terceros (riesgo residual de R10.3). La retirada no deja la web sin iconos porque el fallback propio es condición previa de publicar.

### R10.6 — Decisión del dueño

Respuesta de Paco (2026-11-15) a la Pregunta 11 de `preguntas-ui.md` (spec004 clarify, corrida 11111619), citada literalmente:

> **P11: B, publicar los iconos de habilidad** como los botones de maestría: PNG derivados versionados con manifiesto, atribución y retirada inmediata. Requiere enmienda de §VII (1.11.0) y actualizar el análisis de riesgos, como tarea SDD de spec004 antes de publicarlos. Sin permiso escrito de Crate; riesgo asumido por Paco.

Alternativas descartadas por Paco: **A** (solo local, recomendada por el área) y **C** (solo iconos propios, sin riesgo).

**Aprobación de este análisis**: **Aprobado por Paco el 2026-11-15 (Pregunta 21 = A); manifiesto: una entrada por icono.** Aprobación por escrito de Paco recogida por el principal en `preguntas-ui.md` (corrida 11111619). Esto habilita spec004 T004 (enmienda 1.11.0 de §VII), que la cita como `proof_ref`; publicar sigue condicionado a R10.7.

### R10.7 — Condiciones previas a publicar

| Condición                                                                   | Tarea de spec004 |
| --------------------------------------------------------------------------- | ---------------- |
| Este análisis aprobado por Paco                                             | T003             |
| Enmienda 1.11.0 de §VII aprobada, con la granularidad del manifiesto fijada | T004             |
| Fallback propio terminado (`skill-icons.svg`, un símbolo por tipo)          | T024             |
| `icon_id` público sin ruta de textura del juego                             | T025             |
| Entradas `approved` en el manifiesto con `proof_ref` a `research.md#r10`    | T027             |
| Prueba de artefacto `own` sin PNG del juego y retirada con `withdrawn`      | T028             |

## R11 — Lo que no se investiga aquí

Detalle de maquetación de cada pantalla (se decide en `shape`/`DESIGN.md` con Paco), elección final de la tipografía (R5) y los números de bytes por tarjeta (R2): son tareas de medición del plan, no de esta fase.
