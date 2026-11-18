# Feature Specification: Rediseño de la UI, base visual y página de build (serie 009–013)

**Feature Branch**: `009-rediseno-completo-ui` (planificación en `orq/11111619-ui-s9-plan`, base `orq/11111619` = `mvp/1` @ `28cbcdf`)

**Created**: 2026-11-18

**Status**: Clarified (Preguntas 37–45 respondidas por Paco el 2026-11-18). Base visual sujeta a aprobación de Paco (FR-033). Plan, tareas y analyze hechos (`plan.md`, `tasks.md`, `reviews/analyze.md`). Alcance de esta spec: el de 009 en la partición P42 = A (§5); lo demás del brief está en §6 para 010–013.

**Depende de**: `001-mvp-guias-builds` (páginas, SEO, presupuestos de plan §6, `checklists/a11y.md`, registro de aplazamientos), `002-spec-completion-reviews` (puerta de cierre), `003-catalogo-arboles-maestria` (catálogo de árboles, árbol SVG en modos catálogo/guía/asignación, `deferred.css`), `004-rediseno-ui-grim-dawn` (tokens, marcos, iconos de habilidad del juego, tooltip junto al nodo, `DESIGN.md`) y `005`–`008` (deuda cerrada).

**Input**: Petición de Paco del 2026-11-18 (urgente, prioridad del proyecto), literal en `runs/11111619/tareas/ui.md`, sección «spec009». Resumen: rediseño completo de la UI con mejores prácticas de UI/UX y menos texto a la vista (detalle en tooltip); paleta nueva y elegante de fondo blanco o negro; iconos e imágenes del juego en todo lo que aplique; idioma coherente con la página; página de build con estructura tipo Maxroll (portada pequeña, breadcrumb, chips, título, fecha, changelog, autor, intro, índice fijo con sección activa, resumen de la build final con equipo, componentes/aumentos, skills en barra, devociones clave y pros/contras, checklist arriba, loot filter antes de las notas y notas al final en letra menor); árbol de skills con buscador, tooltip junto al nodo, leveling path por pasos, panel lateral plegable de lista y recomendaciones, maestrías plegables, cierre de detalle discreto y «barra N» comprensible; verificar y corregir que el árbol y el mapa de devociones se vean en la guía; devociones con el mismo tratamiento; catálogo al nivel de la guía; accesibilidad con puertas automáticas, teclado en el árbol nuevo, `checklists/a11y.md` actualizada, T-043 aplazada y T-148 descartada.

## 0. Decisiones fijas de Paco (2026-11-18)

- El rediseño es la prioridad del proyecto. Referencia de producto: Maxroll D4 (estructura, flujo y limpieza), **sin copiar marca, imágenes ni textos** (sigue vigente la regla «No copiar a Maxroll» de spec004 y `scripts/no-maxroll`).
- Estilo fiel a Grim Dawn con sus assets originales, **dentro de la constitución §VII**, que se enmienda para publicar más iconos del juego (P40 = sí; alcance P44 = A, constitución 1.12.0).
- Fondo **blanco o negro**, no la paleta actual (Pregunta 37).
- T-043 (revisión manual de accesibilidad) se **aplaza hasta después de spec009**, motivo: el rediseño cambia la UI que revisaría. T-148 se **descarta** (decisión de Paco, 2026-11-18).
- **Punto de aprobación visual** (Paco, 2026-11-18): la UI elegante es la base de 009 (paleta negra, tipografía, tokens, `DESIGN.md`, tooltip común) y pasa una aprobación visual de Paco **antes** de aplicarse a las páginas: 2–3 propuestas en capturas reales (cabecera de build, una sección, tooltip, tarjeta) hechas con `impeccable` y `ASSET_SOURCE=game`, guardadas en `runs/11111619/propuestas-009/` (fuera del repo). Ninguna tarea de página (cabecera, intro, índice, checklist, build final, loot filter, notas, catálogo) empieza sin ese OK.
- Las capturas de antes/después se hacen con `ASSET_SOURCE=game`, que es lo que publica la CI; la revisión de Paco fue sobre un build local sin esa variable (iconografía propia).

## 1. Resumen y valor

Hoy la guía se lee como una ficha larga de texto: la cabecera no orienta, el checklist de progreso está casi al final y escondido, las notas compiten con el contenido, el «orden real de compra» es brusco, el árbol tiene rótulos crípticos («Barra 5») y Paco no llega a ver el árbol ni el mapa de devociones. El visitante que llega desde una búsqueda tiene que leer demasiado para saber qué build es, dónde empieza y qué tiene que equipar.

spec009 reordena y rediseña la experiencia para que, en el primer pantallazo, el visitante sepa qué build es, para quién y en qué estado, y pueda saltar a cualquier sección con un índice siempre visible; que el resumen de la build final (equipo, componentes/aumentos, skills en barra, devociones clave, pros y contras) se entienda de un vistazo con el detalle en tooltip; y que el árbol y las devociones se usen como en el juego: buscar una skill, ver su tooltip, seguir la ruta de subida paso a paso.

## 2. Referencias visuales: qué patrón toma cada captura

Las ocho capturas de Paco (`runs/11111619/referencias-spec009/01..08-*.png`) son de Maxroll D4. Se toma **solo el patrón** de estructura, flujo y limpieza; ningún texto, marca, imagen, color de marca ni maquetación literal.

| Captura                                | Patrón que se toma (no el contenido)                                                                                                                                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-cabecera-breadcrumb-chips-autor`   | Cabecera en capas: banda estática baja con arte del juego, breadcrumb pequeño, título limpio de dos líneas como máximo, fila de chips de categoría, línea de metadatos (fecha de actualización pequeña + acceso al changelog) y bloque de autor compacto con resumen truncado. |
| `02-equipo-final-iconos`               | Resumen del equipo como «muñeco»: casillas por ranura a izquierda y derecha, cada una con icono, nombre coloreado por rareza y tipo en una línea; bloque lateral con los elementos que complementan el equipo; pestañas para cambiar de vista dentro del bloque.               |
| `03-tooltip-item-hover`                | Tooltip de objeto al pasar el ratón o enfocar: marco con aspecto del juego, nombre y rareza, estadísticas en lista y requisitos al pie; aparece junto al objeto sin desplazar la página.                                                                                         |
| `04-runas-skills-pros-contras`         | Bajo el equipo: fila de iconos de los complementos (en Grim Dawn, componentes y aumentos) con rótulo corto, barra de habilidades con los iconos en orden, y dos tarjetas paralelas de pros y contras con listas de tres a cinco puntos.                                          |
| `05-arbol-limpio-buscador`             | Barra de herramientas del árbol: nivel, puntos usados y restantes, buscador de habilidades y conmutador de ruta de subida; árbol limpio con pocos rótulos, nodos con su rango encima, controles de zoom y encuadre a un lado.                                                    |
| `06-leveling-path-switch`              | Al activar la ruta de subida se abre un panel lateral con pasos plegables numerados; cada paso lista las compras en orden (icono, nombre y nivel o modificador) y los pasos ya superados se atenúan.                                                                             |
| `07-tooltip-skill-hover`               | Tooltip de habilidad anclado junto al nodo: icono, nombre, rango actual/máximo, etiquetas de tipo, coste y descripción breve con los valores destacados, requisitos al pie.                                                                                                      |
| `08-toc-fija-secciones`                | Índice numerado fijo a la izquierda que acompaña el scroll y resalta la sección activa; secciones del contenido con títulos claros y separación generosa; menciones de habilidades en el texto con su icono pequeño delante.                                                    |

## 3. Diagnóstico del estado actual (código, solo lectura)

Localización de cada punto del brief en `apps/web` (base `28cbcdf`):

| Punto del brief                         | Dónde está hoy                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orden de las secciones                  | `features/build/build.page.html:19-134`: resumen → resumen de build → prioridades → habilidades (`@defer`) → orden de compra → **notas (`:81`)** → **filtro de botín (`:82`)** → guía espiritual (`:83`) → devociones (`@defer`, `:110-125`) → vídeo → atribución. El orden está fijo en la plantilla.                                                     |
| Cabecera de la build                    | `features/build/sections/build-sections.html:3-16` (h1, subtítulo, antetítulo, recuadro) y `features/build/summary/build-summary.html:1-70` (maestrías, daño, estados de revisión y contenido, autor). Sin portada con arte, sin breadcrumb visible (solo JSON-LD en `build.page.ts:224`), sin chips, sin changelog.                                   |
| Índice (TOC)                            | `features/build/toc/build-toc.html:1-28` (`<details open>`, observador diferido de sección activa) y `toc/build-toc.css:111-118`: **solo es fijo desde 80rem (1280 px)**; por debajo queda arriba y se pierde con el scroll.                                                                                                                              |
| Checklist de progreso                   | `features/build/purchase-stepper/purchase-stepper.html:96-126` («Progress checklist», persistencia opcional y borrado) **al final** de la sección de orden de compra, más una casilla por paso en `:56-79`.                                                                                                                                             |
| Notas                                   | `features/build/sections/build-sections.html:45-61`, mismo tamaño de letra que el contenido, en mitad de la página.                                                                                                                                                                                                                                    |
| Loot filter                             | `features/build/loot-filter/loot-filter.html:1-60`: columnas `<details open>` con todas las reglas desplegadas y texto largo.                                                                                                                                                                                                                           |
| «Real purchase order»                   | `features/build/purchase-stepper/purchase-stepper.html:2-3` («Orden real de compra», `locale/messages.es.xlf:605-607`): lista vertical de pasos con texto, resaltados y botones «Ver habilidades del paso».                                                                                                                                              |
| Árbol: «barra 10 / barra 5»             | `shared/svg/skill-tree/skill-tree.ts:781-782` (`barLabel` = «Barra N») usado en `skill-tree.html:73` (cabecera de cada fila), `:201`, `:233`, `:443-448`, `:486`, `:528`. Es el requisito de puntos en la barra de maestría y no se explica en ningún sitio.                                                                                             |
| Árbol: «Close detail»                   | `skill-tree.html:257-262` (tooltip, modo catálogo/asignación) y `:504-509` (panel de detalle, modo guía): botón de texto completo «Cerrar detalle».                                                                                                                                                                                                       |
| Árbol: lista y recomendaciones          | `skill-tree.html:280-317` y `:517-553`: `<details class="skill-tree__list" open>` **debajo** del árbol, siempre abierto.                                                                                                                                                                                                                               |
| Árbol: buscador, leveling path, plegado | No existen. Navegación por teclado en `shared/svg/keyboard-nav.ts` (flechas, Inicio, Fin), que Paco no pudo usar con soltura en su pasada de T-043.                                                                                                                                                                                                       |
| Devociones                              | Guía espiritual: `build-sections.html:63-80`. Ruta: `features/build/devotion-section/devotion-section.html:1-69` (selector de pasos con texto). Mapa: `shared/svg/devotion-map/devotion-map.html` (283 líneas; listas de constelaciones y ruta en `:208` y `:232`).                                                                                        |
| Idioma de los nombres                   | `skill-tree.ts:147-148` y `summary/build-summary.ts:81-82`: el nombre principal sale del **idioma de la página** (`LOCALE_ID`), no del idioma de la guía. La guía de ejemplo es `locale: es`; en la ruta por defecto (`/`, inglés) el texto de la guía va en español y los nombres de skills en inglés. Además `build.page.html:32,40` y `purchase-stepper.html:33-34` muestran los dos nombres («Nombre (Name)»). |
| Catálogo                                | `features/tier-list/tier-list.page.html:39,51` con `shared/ui/build-card/build-card.ts:27-71`. **No existe una ruta `/builds`** (solo `builds/:slug` en `app.routes.ts:83`); el catálogo es `/tier-list` y la portada.                                                                                                                                   |

### 3.1 Hallazgo: «en la guía no veo el árbol ni el mapa de devociones»

Evidencia de lectura de código; la reproducción con capturas es una tarea posterior (plan/tasks). Tres causas posibles, no excluyentes:

1. **Sin JavaScript (o antes de hidratar) solo se ve la lista de respaldo, por diseño.** El árbol y el mapa están en bloques `@defer (on viewport)` (`build.page.html:65-78` y `:110-125`); el HTML prerenderizado contiene solo el `@placeholder`, que es una lista textual (`:26-63` y `:85-108`). Es el comportamiento acordado (contenido indexable sin JS, constitución §III), pero visualmente «no hay árbol ni mapa».
2. **Con `pnpm start` (`ng serve`) faltan dos recursos que solo crea el build raíz.** `/assets/deferred.css` (`core/styles/deferred-styles.ts:5`) y `/assets/mastery-trees/*.json` (`core/content/mastery-tree-assets.ts:9`) los escribe `apps/web/tools/emit-static-assets.mts:21-25` **después** de `ng build`, solo desde el `pnpm build` raíz (`package.json:6`). La configuración `development` de `angular.json:77-91` sirve `public/` e iconos, y el `build` base solo `src/styles.css` (`angular.json:47`). Resultado en desarrollo: la hoja de estilos de los componentes diferidos da 404 (SVG del árbol y del mapa sin estilos: trazos y textos por defecto, prácticamente invisibles sobre fondo oscuro) y la carga del árbol canónico falla (`features/build/skills/build-skills.ts:59-75` pasa a `failed` y dibuja el modo guía).
3. **El índice no lleva al árbol con anchos menores de 1280 px**, porque solo es fijo desde 80rem (`toc/build-toc.css:111-118`), y el árbol queda tras resumen, prioridades y orden de compra: en una pantalla media hay que desplazarse mucho para que el `@defer (on viewport)` se dispare.

`ASSET_SOURCE=game` no cambia el renderizado del árbol ni del mapa: solo decide si `emit-static-assets` copia retratos e iconos del juego (`emit-static-assets.mts:26-34`); con `own` se dibujan los símbolos propios. La reproducción debe cubrir las cuatro combinaciones: artefacto de `pnpm build` con y sin `ASSET_SOURCE=game`, con y sin JS, y `pnpm start`.

### 3.2 Datos disponibles frente a lo que pide el brief

| Dato                                         | Hoy                                                                                                                                                                                                                                                                       | Falta para el brief                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skills (nombre ES/EN, tier, barra, máximo)   | Sí: catálogo `fixtures/content/mastery-trees/*.json`, extraído de `database.arz` + `Text_EN.arc`/`Text_ES.arc` (**traducción oficial del juego**; ver `NOTICE.md`). Las guías llevan `name_es`/`name_en` por nodo y `skill_node_id` al catálogo (14 de 14 en la guía de ejemplo). | Descripción, coste, valores por rango y etiquetas para un tooltip «como en el juego»: no se extraen (el `NOTICE.md` declara «no descriptive game text»).                                                                                    |
| Iconos de skills                             | Sí, publicados bajo la excepción 1 de §VII con `ASSET_SOURCE=game` (una entrada de manifiesto por icono) y fallback propio.                                                                                                                                                 | Nada para skills.                                                                                                                                                                                                                           |
| Retratos de maestría                         | Sí (excepción 2 de §VII).                                                                                                                                                                                                                                                  | —                                                                                                                                                                                                                                           |
| Devociones (constelaciones, ruta)            | Sí en la guía: `constellations` (nombre ES/EN, tier, afinidades, maquetación) y `devotion_steps`. Sin extracción del juego.                                                                                                                                              | Iconos de constelaciones y arte del mapa: **no** cubiertos por §VII. Efectos de cada estrella para tooltips: no existen.                                                                                                                     |
| Equipo final (objetos)                       | **No existe** en el dominio, los fixtures ni la extracción.                                                                                                                                                                                                                | Modelo de objeto por ranura (nombre ES/EN, rareza, tipo, nivel), estadísticas para el tooltip, iconos. Los iconos y el texto descriptivo de objetos **no** están cubiertos por §VII; requieren enmienda (P40 = se publican; alcance en Pregunta 44) y extracción (Pregunta 45). |
| Componentes y aumentos                       | No existen.                                                                                                                                                                                                                                                               | Igual que objetos.                                                                                                                                                                                                                          |
| Skills en barra                              | Indirecto: `skill_nodes[].status`/`tag`, sin orden de barra.                                                                                                                                                                                                              | Campo editorial de barra (lista ordenada de skills).                                                                                                                                                                                       |
| Pros / contras, intro, changelog, etapa, rol | Parcial: `published_at`, `reviewed_at`, `game_version`, `playstyle`, `damage_types`, `content_tags`, `hero_callout_body`.                                                                                                                                                  | Pros y contras, entradas de changelog con fecha, fecha de última actualización, etapa (subida/final), rol y una intro breve como campos editoriales.                                                                                         |
| Arte de portada (banner)                     | No hay.                                                                                                                                                                                                                                                                   | Arte del juego como fondo: **fuera** de §VII («ni fondos del árbol, ni marcos, ni otro arte»). Requiere enmienda (Pregunta 44) o arte propio.                                                                                                 |

## 4. Paleta negra propuesta (P37 = negro)

Propuesta para el plan (valores a confirmar con `impeccable` y `check:contrast`); contrastes calculados con la fórmula WCAG 2.x:

| Token                | Valor     | Uso                                    | Contraste sobre fondo / superficie / superficie 2 |
| -------------------- | --------- | -------------------------------------- | ------------------------------------------------- |
| Fondo                | `#0b0b0c` | Página                                 | —                                                 |
| Superficie           | `#151517` | Paneles, tarjetas                      | —                                                 |
| Superficie 2         | `#1d1d20` | Tooltips, panel lateral                | —                                                 |
| Texto                | `#ecebe7` | Texto principal                        | 16,49 / 15,29 / 14,10                             |
| Texto secundario     | `#a8a59f` | Metadatos, notas                       | 8,01 / 7,42 / 6,84                                |
| Acento oro           | `#d9b25c` | Enlaces, activo, filete                | 9,81 / 9,09 / 8,39                                |
| Foco                 | `#f0d27f` | Anillo de foco                         | 13,33 / 12,36 / 11,39                             |
| Borde de control     | `#75737a` | Bordes que identifican controles       | 4,21 / — / 3,60 (≥ 3:1, WCAG 1.4.11)              |
| Filete decorativo    | `#3a3a40` | Separadores sin información            | decorativo (no requiere 3:1)                      |
| Peligro / contras    | `#f07a6a` | Contras, errores                       | 7,21 / 6,68 / 6,16                                |
| Éxito / pros         | `#7fc98f` | Pros, completado                       | 9,98 / 9,25 / 8,53                                |
| Rareza mágica        | `#f0e15a` | Nombre de objeto                       | 14,64 / 13,57 / 12,51                             |
| Rareza rara          | `#5fd16a` | Nombre de objeto                       | 10,13 / 9,39 / 8,66                               |
| Rareza épica         | `#6ea8ff` | Nombre de objeto                       | 8,16 / 7,56 / 6,97                                |
| Rareza legendaria    | `#c58cff` | Nombre de objeto                       | 8,03 / 7,44 / 6,86                                |

Todos los textos superan 4,5:1 (AA) y la mayoría 7:1 (AAA). La rareza nunca se transmite solo por color: el tooltip la nombra en texto. Si Paco hubiera elegido blanco, la alternativa equivalente (texto `#18181b`, acento `#8a6414`, foco `#1d5fd0`) está en `preguntas-ui.md`, Pregunta 37.

## 5. Partición: serie 009–013 (P41 = sí, P42 = A)

Reglas de la serie (decisiones de Paco, 2026-11-18): **un solo PR** para todas las specs del rediseño (cada spec se integra en `orq/11111619` y la serie sale junta); en las specs de diseño los **presupuestos de rendimiento son informativos** (se miden y se registran, sin recortar diseño); la **última spec es de optimización** y deja la CI verde, presupuestos incluidos, sin degradar UI/UX. Las puertas de accesibilidad (axe, contraste, journeys) **sí** se mantienen en verde en cada spec.

| Spec                          | Alcance                                                                                                                                                                                                                                                                                                                                                                                                        | Depende de | Por qué va así                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **009** (esta)                | Base visual (con aprobación visual de Paco antes de tocar las páginas, FR-033): paleta negra, tipografía y tokens en todo el sitio, `DESIGN.md` nuevo, componente de tooltip común, enmienda de §VII (Pregunta 44). Página de build: cabecera (portada, breadcrumb, chips, fecha, changelog, autor), intro, índice fijo, checklist arriba, build final sin equipo (skills en barra, devociones clave, pros/contras), loot filter y notas; idioma dinámico de nombres; corrección del hallazgo §3.1 (árbol y mapa no visibles); registro de T-043/T-148. US1, US2, US3 (sin equipo), US7, US8. | —          | Fija lo que reutiliza toda la serie (tokens, tooltip, enmienda, campos editoriales) y arregla primero que Paco no vea el árbol ni el mapa.   |
| **010** árbol y devociones    | Barra de herramientas, buscador, ruta de subida (sustituye al «orden real de compra»), panel lateral plegable de lista y recomendaciones, maestrías plegables, cierre X, rótulo de requisito de barra, teclado libre; guía espiritual, ruta y mapa de devociones con el mismo tratamiento. US4, US5.                                                                                                             | 009        | Es la superficie más interactiva; usa el tooltip y los tokens de 009 y sus datos ya existen.                                                  |
| **011** objetos y tooltips    | Extracción local de objetos, componentes y aumentos (y descripciones de skills y bonificaciones de constelaciones, P45 = A) desde `database.arz` + `Text_EN/ES.arc` (Pregunta 45); modelo de dominio y migración; iconos con una entrada de manifiesto por icono; bloque de equipo por ranuras y tooltip tipo juego; enriquecimiento de los tooltips de 010. US3 (equipo).                             | 009, 010   | Mayor riesgo (extracción, datos, derechos, peso del HTML); no bloquea el resto y enriquece tooltips ya maquetados.                            |
| **012** catálogo              | Tarjetas y listado de `/tier-list` y de la portada al nivel de la guía. US6.                                                                                                                                                                                                                                                                                                                                    | 009        | Otra superficie; usa chips, iconos y tokens cerrados en 009. Puede ir en paralelo a 010/011 si hay agentes libres.                            |
| **013** optimización y cierre | Deja la CI verde con todos los presupuestos de plan §6 (o los que Paco ajuste) sin degradar UI/UX; actualiza `checklists/a11y.md` a la UI final (incluida `/maestrias`, sin la nota desfasada de T-167); deja T-043 lista para la revisión manual.                                                                                                                                                            | 009–012    | Optimizar al final evita medir y recortar dos veces; la checklist manual se escribe sobre la UI definitiva.                                   |

El brief completo no se recorta: lo que no es de 009 queda registrado en §6 con sus historias y requisitos, para que 010–013 lo especifiquen con referencia cruzada.

## 6. Alcance del brief trasladado a 010–013 (P42 = A)

Registro literal de lo que el brief pide y esta spec no implementa; cada spec siguiente lo especifica de nuevo con Spec Kit y referencia a esta sección. Los IDs `FR-0NN` se conservan para la trazabilidad y no se reutilizan en 009.

### Para spec010 (árbol y devociones)

#### Historia: usar el árbol de skills como en el juego

El jugador ve las maestrías de la build en un árbol limpio y rápido con iconos del juego, busca una skill por nombre, ve su tooltip junto al nodo, activa la «ruta de subida» para ver en un panel los pasos de compra en orden, abre o cierra un panel lateral con la lista de skills y recomendaciones, pliega la maestría que no le interesa y entiende qué significa el requisito de barra.

**Why this priority**: es la parte más interactiva de la guía y la que más critica Paco («real purchase order» feo, «barra 10» incomprensible, «close detail» enorme, no ve el árbol).

**Independent Test**: en `/builds/<slug>` con JS, buscar «Fuerza» y comprobar que el nodo se resalta y recibe foco; activar la ruta de subida y recorrer los pasos; abrir y cerrar el panel lateral; plegar una maestría; todo con teclado y con ratón, a 375, 768 y 1280 px.

**Acceptance Scenarios**:

1. **Given** el árbol, **When** se escribe en el buscador, **Then** los nodos que coinciden (en nombre ES o EN, sin distinguir tildes ni mayúsculas) se resaltan, el resto se atenúa, un contador anuncia cuántos hay y Intro lleva el foco al primero.
2. **Given** la ruta de subida activada, **When** se abre un paso, **Then** el panel lista las compras de ese paso en orden (icono, nombre, puntos) y el árbol marca los nodos de ese paso; los pasos anteriores se ven como hechos y los posteriores atenuados. Este panel sustituye a la sección «Orden real de compra».
3. **Given** una skill seleccionada, **When** se quiere cerrar su detalle, **Then** hay un botón compacto con icono X de al menos 24×24 px y nombre accesible «Cerrar», y Escape también lo cierra.
4. **Given** el rótulo de requisito de barra, **When** se lee o se enfoca, **Then** dice en lenguaje claro que es la cantidad de puntos que debe tener la barra de maestría (p. ej. «Requiere 10 puntos en la maestría») y tiene tooltip con la explicación.
5. **Given** el árbol con foco, **When** se usan las flechas, Inicio y Fin, **Then** el foco se mueve libremente entre nodos adyacentes en las cuatro direcciones, sin quedar atrapado, y Tab sale del árbol.

#### Historia: seguir las devociones sin fricción

La guía espiritual, la ruta de devociones y el mapa se presentan con el mismo tratamiento que las skills: limpio, con iconos, tooltips y menos texto.

**Why this priority**: Paco las ve bruscas y feas; dependen de la misma base visual que el árbol.

**Independent Test**: recorrer la ruta de devociones paso a paso con teclado y ratón y comprobar que el mapa marca las constelaciones del paso y que cada constelación tiene tooltip con nombre, tier y afinidades.

**Acceptance Scenarios**:

1. **Given** la sección de devociones, **When** se selecciona un paso, **Then** el mapa resalta sus constelaciones y el texto del paso se reduce a un titular con el detalle en tooltip o desplegable.
2. **Given** una constelación del mapa, **When** recibe foco o hover, **Then** muestra un tooltip con su nombre en el idioma de la guía, tier y afinidades requeridas y otorgadas.
3. **Given** la guía espiritual, **When** se ve, **Then** cada PNJ se presenta como fila compacta (nombre, lugar) con el detalle a demanda.

#### Requisitos del árbol

- **FR-015**: El árbol MUST tener una barra de herramientas con: puntos usados/disponibles, buscador de skills y conmutador de ruta de subida.
- **FR-016**: El buscador MUST filtrar por nombre en ES y EN sin distinguir mayúsculas ni tildes, resaltar coincidencias, anunciar el número de resultados y permitir llevar el foco al primero.
- **FR-017**: La ruta de subida MUST mostrar en un panel los pasos de compra numerados y plegables, con cada compra (icono, nombre, puntos) y su reflejo en el árbol; MUST sustituir a la sección «Orden real de compra» y reutilizar sus datos (`purchase_steps`).
- **FR-018**: La lista de skills y recomendaciones MUST estar en un panel lateral derecho plegable que el usuario abre y cierra (cerrado por defecto en móvil); su estado no debe provocar saltos de maquetación.
- **FR-019**: Cada maestría del árbol MUST poder plegarse y desplegarse de forma independiente.
- **FR-020**: El cierre del detalle de una skill MUST ser un botón X compacto (≥ 24×24 px, nombre accesible «Cerrar»), además de Escape.
- **FR-021**: El requisito de barra MUST rotularse de forma comprensible (puntos en la barra de maestría) y tener tooltip explicativo; el término «Barra N» a secas desaparece.
- **FR-022**: El tooltip de la skill MUST anclarse junto al nodo (comportamiento de spec004 conservado) con nombre, rango, tipo y requisito, con el mismo marco elegante que el tooltip de objeto; el texto descriptivo del juego solo si se aprueba su extracción (Pregunta 45).
- **FR-023**: El árbol MUST navegarse por teclado entre nodos adyacentes en las cuatro direcciones, con Inicio/Fin, sin trampas de foco y saliendo con Tab.

#### Requisitos de devociones

- **FR-026**: Guía espiritual, ruta y mapa de devociones MUST seguir el tratamiento del árbol: menos texto a la vista, iconos (del juego tras la enmienda; propios con `ASSET_SOURCE=own`), tooltips y estado activo claro.

- Caso límite (010): búsqueda sin resultados: mensaje «Sin coincidencias» anunciado y ningún nodo atenuado de forma permanente.
- **SC-002** (010): en una prueba guiada con Paco, encuentra una skill con el buscador y sigue la ruta de subida hasta el tercer paso en menos de 30 s, sin ayuda.

### Para spec011 (objetos y tooltips)

- Equipo final por ranuras con iconos del juego, componentes y aumentos, y tooltip elegante tipo juego (P38, captura 02–04), con los datos de P45 = A extraídos de la copia local legal; enriquecimiento de los tooltips de skills y constelaciones; iconos con una entrada de manifiesto por icono (P44 = A).
- **Objeto de equipo**: ranura, nombre ES/EN, rareza, tipo, nivel requerido, estadísticas, referencia pública de icono (nunca la ruta interna de textura). **Componente / aumento**: nombre ES/EN, ranura de destino, efectos, referencia de icono.

### Para spec012 (catálogo)

#### Historia: elegir una build desde un catálogo al nivel de la guía

Las tarjetas y el listado del catálogo comparten lenguaje visual con la guía: retrato o icono de maestría, título, chips de rol/etapa/versión y estado, con la información secundaria a demanda.

**Why this priority**: coherencia; el catálogo es la puerta de entrada.

**Independent Test**: abrir `/tier-list` y `/es/tier-list` a 375, 768 y 1280 px, filtrar y abrir una guía; las tarjetas usan los mismos tokens, chips e iconos que la cabecera de la guía.

**Acceptance Scenarios**:

1. **Given** el catálogo, **When** se carga sin JS, **Then** las tarjetas y los enlaces se ven completos (filtros deshabilitados como hoy, C-12).
2. **Given** una tarjeta, **When** recibe foco, **Then** el foco es visible y el área de enlace cubre la tarjeta sin anidar controles.

#### Requisitos del catálogo

- **FR-027**: Las tarjetas y el listado de `/tier-list` (y de la portada) MUST usar los tokens, chips e iconografía de la página de build, sin superar el presupuesto de JS inicial de `/tier-list`.

### Para spec013 (optimización y cierre)

- **FR-029**: `specs/001-mvp-guias-builds/checklists/a11y.md` MUST actualizarse a la UI nueva (incluida `/maestrias`, buscador, paneles y tooltips) y perder la nota desfasada de T-167 (`a11y.md:218-222`); en la partición propuesta se hace en 013, sobre la UI final.
- CI verde con todos los presupuestos de plan §6 (o los que Paco apruebe con cifras) sin degradar UI/UX (P43); T-043 lista para su revisión manual.

## Clarifications

### Session 2026-11-18

Clarify asíncrono: las preguntas están en `runs/11111619/preguntas-ui.md`, sección «spec009 (2026-11-18) — clarify». Paco respondió las Preguntas 37–41 y 43 antes de recibir su texto (secciones «spec009: respuestas de Paco»); lo menor se resolvió con supuestos (ver «Assumptions»).

- Q: ¿Fondo blanco o negro? (Pregunta 37) → A: **negro**, elegante (por ahora). Aplicado en FR-001 y en §4 (paleta propuesta).
- Q: ¿Los objetos llevan tooltip tipo juego y qué alcance tienen? (Pregunta 38) → A: **sí**, con tooltip de diseño elegante como en el juego. Aplicado en FR-009 y FR-022; el alcance de datos y su extracción queda en la Pregunta 45.
- Q: ¿En qué idioma salen los nombres de skills, objetos y devociones? (Pregunta 39) → A: **dinámicos según el idioma de la página**: en `/es` en español y en la raíz en inglés. Aplicado en FR-005, US6 y SC-004. Fuente ES: la traducción oficial del juego (`Text_ES.arc`), ya usada por el catálogo (P31 de spec005, «Hoja de la Noche»).
- Q: ¿Se publican iconos e imágenes del juego? (Pregunta 40) → A: **sí se publican**. Como §VII solo cubre iconos de habilidad y retratos de maestría, exige una enmienda de la constitución; su alcance exacto es la Pregunta 44. Aplicado en FR-004 y FR-032.
- Q: ¿Se divide el trabajo en varias specs? (Pregunta 41) → A: **sí**.
- Q: ¿Qué partición concreta? (Pregunta 42) → A: **A**, serie 009–013 en un solo PR (§5). Esta spec queda con el alcance de 009; el resto pasa a §6.
- Q: ¿Qué cubre la enmienda de §VII? (Pregunta 44) → A: **A**, iconos de constelaciones, objetos, componentes y aumentos, una portada por maestría (arte del juego, recortada y comprimida) y los datos factuales derivados del juego; marcos de tooltip propios (CSS/SVG). La enmienda (1.12.0) es una tarea de 009 (FR-032); 009 solo **usa** la portada; los iconos nuevos se incorporan en 010 y 011.
- Q: ¿Qué se extrae del juego? (Pregunta 45) → A: **A**, en 011: objetos/componentes/aumentos (nombre ES/EN, rareza, tipo, nivel, estadísticas), constelaciones (nombre y bonificaciones) y skills (descripción corta y valores por rango); sin lore; solo objetos usados por guías publicadas; ES = `Text_ES.arc` oficial.
- Q: ¿Cuándo se aplica la base visual a las páginas? (decisión de Paco, 2026-11-18) → A: tras un **punto de aprobación visual**: 2–3 propuestas en capturas reales con `impeccable` y `ASSET_SOURCE=game` en `runs/11111619/propuestas-009/`; la elegida se registra aquí y en `DESIGN.md`. Aplicado en FR-033 y SC-008. Propuesta elegida: _pendiente de la aprobación (T004)_.
- Q: ¿Se mueve algún presupuesto de rendimiento? (Pregunta 43) → A: en las specs de diseño (009–012) los presupuestos **no bloquean**: se miden y se registran como informativos, sin recortar diseño; la **última spec de la serie (013) es de optimización** y deja la CI verde, presupuestos incluidos, sin degradar UI/UX. Aplicado en SC-006, §5 y «Assumptions».
- Q: ¿Cómo se entrega la serie? (decisión de Paco, 2026-11-18) → A: **un solo PR** para todas las specs del rediseño; cada spec se integra en `orq/11111619` y la serie sale junta. Aplicado en §5.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Entender la build en el primer pantallazo (Priority: P1)

Un jugador llega a una guía desde una búsqueda o desde el catálogo. Sin desplazarse, ve una portada baja con arte, el breadcrumb, el título, chips con clase/maestrías, rol, etapa y versión del juego, la fecha de actualización, el acceso al changelog, un resumen muy breve del autor y una intro de dos o tres líneas que le dice por dónde empieza la build. El checklist de progreso está a mano al inicio.

**Why this priority**: es lo que decide si el visitante se queda; hoy la cabecera no orienta y el checklist está escondido al final.

**Independent Test**: abrir `/builds/<slug>` y `/es/builds/<slug>` a 375, 768 y 1280 px y comprobar que todos los elementos citados están por encima del primer pliegue a 1280 px y en el orden descrito a 375 px, sin JS y con JS.

**Acceptance Scenarios**:

1. **Given** una guía publicada, **When** se carga a 1280 px, **Then** portada, breadcrumb, título, chips, fecha, changelog, autor e intro se ven sin desplazarse y el checklist aparece antes de la primera sección de contenido.
2. **Given** una guía sin changelog ni fecha de actualización, **When** se carga, **Then** el acceso al changelog no aparece y la fecha mostrada es la de publicación, sin textos de relleno.
3. **Given** una guía con autor marcador de posición, **When** se carga, **Then** el bloque de autor indica el estado pendiente sin enlace (comportamiento actual conservado).

---

### User Story 2 - Navegar la guía con un índice siempre visible (Priority: P1)

Mientras lee, el jugador tiene el índice de secciones a la vista y la sección activa resaltada; las secciones están claramente separadas.

**Why this priority**: la guía es larga; hoy el índice solo acompaña desde 1280 px.

**Independent Test**: desplazarse por la guía a 768 y 1280 px y comprobar que el índice permanece accesible y marca la sección visible; a 375 px, que existe un acceso compacto al índice que no tapa contenido.

**Acceptance Scenarios**:

1. **Given** la guía a 1280 px, **When** se desplaza, **Then** el índice queda fijo a un lado y la entrada de la sección visible lleva `aria-current` y un resalte que no depende solo del color.
2. **Given** la guía a 375 px, **When** se desplaza, **Then** un control compacto abre el índice y, al elegir una sección, el foco va a su título.
3. **Given** JS desactivado, **When** se carga, **Then** el índice es una lista de enlaces que funciona (sin resaltado de sección activa).

---

### User Story 3 - Ver la build final de un vistazo (Priority: P1)

El jugador ve un bloque «Build final» con las skills de la barra en orden, las devociones clave y dos tarjetas de pros y contras. El detalle de cada elemento está en un tooltip al pasar el ratón o enfocar, con aspecto del juego. El equipo por ranuras, componentes y aumentos se añade a este bloque en 011 (§6).

**Why this priority**: es el corazón del patrón de referencia (capturas 02–04) y la forma más rápida de saber qué hay que conseguir.

**Independent Test**: con una guía que tenga datos de barra, devociones clave y pros/contras, comprobar que el bloque los muestra con iconos y que cada icono tiene tooltip accesible por ratón, teclado y toque. El equipo, componentes y aumentos son de 011 (§6).

**Acceptance Scenarios**:

1. **Given** una guía con skills de barra, **When** se ve el bloque, **Then** las skills aparecen en el orden editorial con su icono (del juego con `ASSET_SOURCE=game`, propio en otro caso) y su nombre accesible en el idioma de la guía.
2. **Given** un elemento con tooltip, **When** recibe foco con teclado, **Then** el tooltip aparece junto a él, no tapa el elemento enfocado, se cierra con Escape y su contenido se anuncia (`aria-describedby`).
3. **Given** una guía sin pros/contras o sin un subbloque, **When** se carga, **Then** ese subbloque no aparece (nunca un marcador presentado como contenido real, constitución §I).

---

### User Story 4 - Ver el árbol y el mapa de devociones en la guía (Priority: P1)

Paco abre la guía y no ve el árbol ni el mapa de devociones (§3.1). El jugador debe verlos siempre que tenga JS, en el servidor de desarrollo y en el artefacto publicado, y sin JS debe tener una alternativa legible y un aviso.

**Why this priority**: sin árbol ni mapa la guía pierde su parte interactiva; es la primera tarea de la serie.

**Independent Test**: reproducir las cuatro combinaciones de §3.1 (`pnpm start`; artefacto de `pnpm build` con `ASSET_SOURCE=own` y con `game`; con y sin JS) antes y después de la corrección, con capturas.

**Acceptance Scenarios**:

1. **Given** la guía servida con `pnpm start` o con el artefacto de `pnpm build`, con y sin `ASSET_SOURCE=game`, **When** el árbol entra en pantalla con JS, **Then** el árbol y el mapa de devociones se dibujan con sus estilos (corrección del hallazgo §3.1).
2. **Given** JS desactivado, **When** se carga la guía, **Then** se ve una vista estática legible del árbol (o la lista de respaldo) y un aviso de que la interacción requiere JS; nunca una zona vacía.

---

### User Story 5 - Leer el loot filter y las notas sin ruido (Priority: P3)

El loot filter aparece antes de las notas, con menos texto y tooltips; las notas van al final, con letra menor que el contenido.

**Why this priority**: ordena la lectura; no bloquea las historias anteriores.

**Independent Test**: comprobar el orden de secciones en el HTML prerenderizado y que el tamaño de letra de las notas es menor que el del contenido principal sin bajar del mínimo legible.

**Acceptance Scenarios**:

1. **Given** la guía, **When** se recorre el índice, **Then** el loot filter precede a las notas y las notas son la última sección de contenido antes de fuentes/atribución.
2. **Given** una regla del loot filter, **When** se ve, **Then** muestra un rótulo corto y el detalle en tooltip o desplegable.

---

### User Story 6 - Una página en un solo idioma (Priority: P1)

Todo lo visible está en el idioma de la página: rótulos de la interfaz y nombres de skills, devociones, maestrías y objetos.

**Why this priority**: Paco lo señala como incoherencia evidente (skills en inglés dentro de una guía en español).

**Independent Test**: abrir `/es/builds/<slug>` y `/builds/<slug>` y comprobar que no hay nombres de juego en el otro idioma a la vista (el otro idioma puede ir en tooltip o en `lang` para lectores de pantalla).

**Acceptance Scenarios**:

1. **Given** `/es/builds/<slug>`, **When** se carga, **Then** skills, maestrías y constelaciones salen con su nombre oficial en español del juego y no se muestra el inglés entre paréntesis.
2. **Given** `/builds/<slug>` (inglés) con una guía `locale: es`, **When** se carga, **Then** los nombres de juego salen en inglés (P39), el texto editorial sigue en español con `lang="es"` y se mantiene el aviso «solo en español» de spec005.

### Edge Cases

- Guía sin datos de un bloque (barra, devociones clave, pros/contras, intro, changelog): el bloque y su entrada de índice no aparecen.
- Nombre de juego sin traducción ES en el catálogo: se muestra el nombre EN con `lang="en"` y se registra como pendiente (constitución §X), nunca un nombre inventado.
- `ASSET_SOURCE=own`: todo icono del juego cae al fallback propio sin huecos ni cambios de tamaño (CLS ≤ 0,05).
- Retirada de un activo del juego a petición de Crate: el fallback lo sustituye en el mismo cambio (§VII).
- Tooltip cerca del borde del viewport o en móvil: se recoloca dentro de la pantalla; en táctil se abre con toque y se cierra con un segundo toque o fuera.
- Datos con posiciones duplicadas en pasos (caso existente): selección deshabilitada con aviso, como hoy.
- `prefers-reduced-motion`: paneles y tooltips sin animación.
- Modo de contraste forzado (Windows): bordes y foco visibles (hoja `accessibility.css` existente).

## Requirements _(mandatory)_

### Functional Requirements

#### Global

- **FR-001**: El sitio MUST aplicar una base visual elegante de **fondo negro** (P37), con paleta, tipografía y tokens (propuesta en §4) con contraste AA verificado por `check:contrast`, sustituyendo la paleta carbón/bronce actual en todas las rutas.
- **FR-002**: Cada sección MUST mostrar a la vista solo lo necesario para decidir; el detalle secundario MUST ir en tooltip (hover y foco) o desplegable, nunca solo en hover.
- **FR-003**: Los tooltips MUST ser accesibles: abren con foco y hover (y toque), se cierran con Escape, no tapan el disparador, se anuncian con `aria-describedby` y respetan WCAG 1.4.13 (descartable, persistente al pasar el puntero sobre él).
- **FR-004**: Skills, maestrías y portadas (en 009), constelaciones (en 010) y objetos (en 011), componentes, componentes y aumentos MUST mostrar icono del juego con `ASSET_SOURCE=game` (P40 = se publican, tras la enmienda de FR-032), y el fallback propio en otro caso, con las mismas dimensiones reservadas.
- **FR-005**: Todo nombre de juego visible MUST salir en el idioma de la página (P39): en `/es` el nombre oficial en español del juego y en la raíz el inglés, también dentro de una guía cuyo texto editorial esté en otro idioma; el otro idioma no se muestra entre paréntesis (puede ir en tooltip). Las cadenas de interfaz nuevas MUST tener entrada en `messages.en.xlf` y `messages.es.xlf` (paridad, §X).

#### Página de build (US1, US2, US3, US5)

- **FR-006**: La cabecera MUST incluir: portada estática baja (arte del juego de la maestría principal, P44 = A, con fallback propio con `ASSET_SOURCE=own`), breadcrumb visible (Inicio › Builds › título, coherente con el JSON-LD actual), chips de clase/maestrías, rol, etapa y versión del juego, título, fecha de actualización en tamaño pequeño, acceso al changelog (solo si hay entradas) y resumen breve del autor.
- **FR-007**: Tras la cabecera MUST ir una intro breve (dos o tres frases) que indique dónde empieza la build.
- **FR-008**: El índice MUST quedar accesible durante todo el scroll en los tres puntos de corte (fijo lateral desde 768 px o el corte que fije el plan; control compacto en móvil) y resaltar la sección activa con `aria-current` y una marca no cromática.
- **FR-009**: El bloque «Build final» MUST mostrar, cuando haya datos: skills en barra en orden, devociones clave, pros y contras, cada elemento con icono y tooltip; el equipo, componentes y aumentos con tooltip elegante tipo juego (P38) se añaden en 011 (§6).
- **FR-010**: El checklist de progreso MUST ir al inicio de la build (antes de la primera sección de contenido), compacto, conservando persistencia opcional local, borrado y aviso de privacidad actuales.
- **FR-011**: El orden de secciones MUST ser: cabecera → intro → checklist → build final → habilidades → orden de compra (hasta que 010 lo sustituya por la ruta de subida) → guía espiritual y devociones → loot filter → notas → fuentes/atribución (con el changelog como metadato); prioridades y guía espiritual se colocan donde el plan justifique, sin romper este orden relativo.
- **FR-012**: Las notas MUST ir al final del contenido con un tamaño de letra menor que el del contenido principal y no inferior al mínimo legible del sistema de tipos.
- **FR-013**: El loot filter MUST ir antes de las notas, con rótulos cortos por regla y el detalle en tooltip o desplegable.
- **FR-014**: Las secciones de una misma build MUST separarse con un ritmo vertical y un título claros.

#### Árbol y mapa visibles (US4)

- **FR-024**: Sin JS, la guía MUST mostrar una representación legible del árbol y de las devociones (lista o vista estática) y un aviso; nunca un hueco.
- **FR-025**: El árbol y el mapa de devociones MUST renderizarse con sus estilos en el artefacto de `pnpm build` (con y sin `ASSET_SOURCE=game`) y en `pnpm start`; la causa confirmada del hallazgo §3.1 se corrige en esta spec y se cubre con una prueba.

#### Accesibilidad y registro SDD

- **FR-028**: Las puertas automáticas (`e2e:a11y` con axe, `check:contrast`, `e2e:journeys`) MUST seguir en verde para todas las rutas, incluida `/maestrias`.
- **FR-029**: trasladado a 013 (ver §6).
- **FR-030**: El registro de aplazamientos de spec001 (`specs/001-mvp-guias-builds/tasks.md`, «Registro de aplazamientos») MUST recoger el aplazamiento de T-043 (motivo: rediseño de la serie spec009–013; la revisión manual se hace tras 013) y el descarte de T-148 (decisión de Paco, 2026-11-18) como entradas del registro existente (T-178), sin crear tareas nuevas de spec001; la tarea es de spec009.

#### Restricciones heredadas

- **FR-031**: Se conservan SEO y prerender (§III), el aviso de no afiliación y la atribución a Crate donde haya arte del juego (§VII), el fallback conmutable `ASSET_SOURCE=own|game`, la CSP sin `unsafe-inline` y la regla de no copiar a Maxroll.
- **FR-032**: Antes de publicar cualquier activo del juego que no sea icono de habilidad o retrato de maestría, la constitución MUST enmendarse (§VII, versión nueva) con el alcance aprobado por Paco (P44 = A, versión 1.12.0), manteniendo la condición común (entrada de manifiesto por activo con `tolerancia_de_facto_sin_permiso`, `proof_ref`, `fallback_svg`), la incorporación manual y editorial (§II), la atribución y la retirada inmediata.
- **FR-033**: La base visual (paleta, tipografía, tokens, `DESIGN.md`, tooltip común) MUST pasar la aprobación visual de Paco sobre 2–3 propuestas en capturas reales (cabecera de build, una sección, tooltip y tarjeta, con `ASSET_SOURCE=game`) antes de aplicarse a cualquier página; la propuesta elegida queda registrada en «Clarifications» y en `DESIGN.md`.

### Key Entities _(include if feature involves data)_

- **Metadatos editoriales de la guía** (nuevos; detalle en `data-model.md`): intro breve, etapa (subida, final o ambas), entradas de changelog (fecha + texto), pros y contras (listas cortas), skills de barra (lista ordenada de nodos de la guía) y devociones clave (constelaciones de la guía). Viven en el contrato de dominio y en PostgreSQL (§VI), validados en ambos. La fecha de actualización es la del último changelog o, si no hay, la de publicación; el rol se muestra con el `playstyle` existente; el resumen del autor es su `bio` existente.
- **Portada de maestría** (activo del juego tras la enmienda 1.12.0): una imagen por maestría con su entrada de manifiesto y fallback propio.
- **Paso de orden de compra / checklist**: los `purchase_steps` existentes; el checklist reutiliza su progreso local.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A 1280 px, la cabecera completa (portada, breadcrumb, título, chips, fecha, autor, intro) y el acceso al checklist son visibles sin desplazarse en las dos guías de prueba (ES y EN).
- **SC-002**: trasladado a 010 (ver §6).
- **SC-003**: El árbol y el mapa de devociones se ven con estilos en las cuatro combinaciones de §3.1 con JS; sin JS se ve su alternativa textual; capturas de antes/después con `ASSET_SOURCE=game` adjuntas.
- **SC-004**: 0 nombres de juego en el idioma contrario a la vista en `/es/builds/<slug>` ni en `/builds/<slug>` (comprobación automática sobre el HTML prerenderizado de las dos versiones).
- **SC-005**: 0 violaciones de axe en todas las rutas; `check:contrast` y `e2e:journeys` en verde; todo control nuevo de 009 (índice, checklist, tooltips) se usa con teclado.
- **SC-006**: Presupuestos de plan §6 (LCP ≤ 2000 ms, CLS ≤ 0,05, TBT ≤ 150 ms en mediana de 3; JS inicial `/tier-list` ≤ 112 000 B gzip, `/builds/:slug` ≤ 150 000 B, `/` = 0 B; CSS crítico ≤ 20 000 B gzip; HTML ≤ 120 000 B por ruta): en 009–012 se miden y se registran en cada spec como **informativos** (P43); al cerrar 013 todos pasan en la CI sin degradar UI/UX.
- **SC-007**: Paco aprueba la revisión visual del rediseño (como Pregunta 22 de spec004) antes de la puerta de cierre.
- **SC-008**: Paco elige una de las 2–3 propuestas visuales antes de que empiece ninguna tarea de página (registro con fecha en «Clarifications»).

## Assumptions

- **Alcance de rutas**: «catálogo `/builds`» se interpreta como `/tier-list` y los listados de la portada; no existe una ruta `/builds` y no se crea salvo que Paco lo pida.
- **Presupuestos de rendimiento** (P43): informativos en 009–012 y obligatorios al cerrar 013. Cifras de partida: HTML de la guía 117 333 B (EN) y 117 662 B (ES) de 120 000 (spec005, margen ≈ 2,3–2,7 kB, que el rediseño agota); JS inicial de la guía ≈ 123 kB de 150 000 B; `/tier-list` 111 422 de 112 000 B (spec007 T002, margen 578 B); CSS gzip 3 434 B y 6 164 B con `deferred` de 20 000 B. La interactividad nueva (buscador, ruta de subida, paneles, tooltips) va en bloques diferidos, cuyo JS no cuenta en el inicial.
- **Fuente de traducción ES**: la traducción oficial del juego (`Text_ES.arc`), ya extraída para el catálogo de skills (`fixtures/content/mastery-trees/NOTICE.md`); no se inventan nombres. En 009 los nombres de constelaciones salen de los `name_es`/`name_en` de la guía; su sustitución por la fuente oficial es de 011 (P45 = A).
- **Datos editoriales nuevos** (intro, etapa, changelog, pros/contras, skills de barra, devociones clave; `data-model.md`): se añaden al contrato de dominio y a PostgreSQL con migración versionada; el rol es el `playstyle` existente y el resumen del autor su `bio`; la guía de ejemplo se rellena con contenido propio del sitio (`own_original`); si un campo está vacío, su bloque no se muestra.
- **Tipografía**: se conservan las fuentes autoalojadas actuales salvo que la paleta elegida exija otro peso; el plan lo justifica con bytes.
- **Accesibilidad**: se mantienen las puertas automáticas en cada spec de la serie; la navegación por teclado del árbol es de 010 (FR-023) y la actualización de `checklists/a11y.md` de 013 (FR-029); T-043 queda aplazada hasta después de la serie y T-148 descartada, registradas en el registro de aplazamientos de spec001 por una tarea de 009 (FR-030), sin IDs T-NNN nuevos de spec001.
- **Lenguaje de diseño**: se ejecuta con el skill `impeccable` (modo Read para la guía, Operate para árbol y catálogo); `DESIGN.md` se reescribe porque cambia la paleta (rediseño, no refinamiento).
- **Skills de Spec Kit**: `speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks` y `speckit-analyze` no están en `.agents/skills/` del worktree (están ignoradas por git); se leyeron del repo principal (`C:/Users/paco_/Documents/GitHub/grim-dawn-builds/.agents/skills/`).

## Fuera de alcance

- Cuentas, comentarios, calculadora o editor de builds (§VIII).
- Ingesta automatizada de webs (§II); la extracción local de objetos, constelaciones y descripciones es de 011 (P45 = A).
- Copiar marca, textos, imágenes o maquetación literal de Maxroll.
- Expansiones no publicadas en el catálogo (P29 de spec005: «árbol no disponible»).
- La revisión manual de T-043 (aplazada a después de la serie 009–013).
- Todo lo registrado en §6 (árbol interactivo, devociones, objetos, catálogo, optimización y `checklists/a11y.md`).
