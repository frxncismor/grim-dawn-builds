# Product

<!-- impeccable:product-schema 1 -->

> **Estado: aprobado por Paco el 2026-11-15 (spec004 T006).** Marca pública: «Grim Builds» (decisión de Paco, 2026-11-16, spec005 US6).
> Historial: borrador redactado sin entrevista directa. `impeccable init` pide entrevistar a la persona usuaria y quien redacta
> esto no puede hablar con Paco. Cada hecho sale de sus decisiones ya registradas (`specs/004-rediseno-ui-grim-dawn/spec.md`
> §0 y «Clarifications», Preguntas 1–15 de `preguntas-ui.md`, `README.md`, constitución §VII) o del código. P16–P20 aplicadas y todo aprobado; no queda ninguna decisión pendiente.
> Sustitución declarada: no es un `init` ejecutado con interlocutor.

## Platform

web

## Users

- **Jugadora o jugador de Grim Dawn que busca qué construir** (hispanohablante o angloparlante; el sitio es EN primero y ES
  completo). Llega con una pregunta concreta: «¿qué build juego con esta combinación de maestrías?» o «¿qué build es buena?».
  Quiere llegar a una guía publicada en pocos clics y no perderse al seguirla.
- **Esa misma persona, ya dentro de una guía, jugando.** Consulta el sitio mientras juega o entre sesiones: abre el árbol de
  habilidades, mira el orden de compra de puntos y vuelve a su partida. Lee en una pantalla al lado del juego o en el móvil.
- **Paco, dueño y editor** del contenido (MVP local-first, un solo autor; las guías se publican solo con autoría, derechos,
  fuentes y revisión validados).
- **Audiencia** (decisión de Paco, 2026-11-15): ambas, jugadores nuevos y veteranos, con el foco en **seguir guías**. Llegan
  por la misma portada; el resumen de build orienta a quien empieza y no estorba a quien ya sabe.

## Product Purpose

Guías de build de Grim Dawn **rápidas, accesibles e interactivas**, con árboles de maestría y devociones como SVG accesible,
equipo, notas y filtros de botín, más un catálogo de combinaciones con procedencia editorial. Existe para que **encontrar una
build y seguir su guía sea fácil**: es la visión «las guías de Maxroll para Diablo 4, pero para Grim Dawn» (decisión de Paco,
`vision=maxroll_gd`).

Éxito (medible, de la spec): desde `/` se llega a una guía publicada en ≤ 2 clics y a cualquier combinación en ≤ 3; el
detalle de un nodo se lee sin apartar la vista del nodo; todo se lee sin JavaScript; los presupuestos de rendimiento siguen
en verde.

## Positioning

Es el sitio de guías de Grim Dawn con **flujo de guía moderno** (tarjetas, resumen de build, índice de secciones, árbol con
iconos y tooltip junto al nodo, paso a paso del orden de compra) **y** rigor editorial verificable: cada guía enseña autoría,
fuente, versión del juego y estado de revisión; una combinación sin guía **se dice sin guía**, sin tier ni recomendación
inventada. Un directorio estático de builds no ofrece ese flujo; un sitio que rellena huecos con rankings sin evidencia no
puede copiar esa honestidad (constitución I).

La referencia de **estructura, flujo y UX** es Maxroll (Diablo 4). Se copia el _método_ (jerarquía, recorrido), **nunca** su
marca, imágenes ni textos (`no_copiar_maxroll`, FR-030). Esa referencia se cita solo en documentación de planificación, nunca
en el producto ni en `apps/web/src` o `apps/web/public`.

## Operating Context

- Contenido tipado: guías, catálogo de 6 maestrías base (≈ 186 nodos de habilidad), combinaciones y autores. Local: fixtures;
  release: API sobre PostgreSQL, **sin _fallback_** entre ambos.
- Sitio estático prerenderizado (Angular 21, SSG), servido en local por ahora; la publicación pública está diferida.
- Cadena de verificación obligatoria: `pnpm verify` (lint, tests, presupuestos de rendimiento, accesibilidad, CSP, paridad
  EN/ES, activos).
- Arte del juego: solo desde la instalación de Paco, extraído a una carpeta ignorada por git y publicado únicamente por la
  vía del manifiesto de activos (§VII).

## Capabilities and Constraints

- **Rutas rediseñadas**: `/` (portada), `/tier-list` (catálogo), `/builds/:slug` (guía), `/maestrias` y `/maestrias/:slug`
  (índice y árbol); las páginas de contenido (`/acerca`, `/legal`, `/autores/:slug`, 404) heredan tokens.
- **Idiomas**: EN primero y ES completo con paridad de cadenas (`check:locale-parity`); texto sin traducción se muestra en el
  idioma base con `lang` explícito.
- **Presupuestos** (`001/plan.md` §6, no se amplían): HTML por página ≤ 120 000 B; JS inicial `/` ≤ 90 kB, `/tier-list` ≤ 110
  kB, `/builds/:slug` ≤ 150 kB; CSS crítico ≤ 20 000 B gzip; TBT ≤ 150 ms; LCP ≤ 2,0 s; CLS ≤ 0,05; Lighthouse Perf ≥ 90 y
  A11y/SEO/BP ≥ 95. Fuentes: ≤ 3 familias y 5 archivos.
- **Seguridad**: CSP sin `unsafe-inline` (`style-src 'self'` con hashes; `img-src 'self'`, sin `data:`).
- **Lectura sin JavaScript**: tarjetas, resumen, índice y lista textual de habilidades deben estar en el HTML.
- **Terminología** (se mantiene en ambos idiomas): _build_, _guía_, _combinación_, _maestría_, _devoción_, _árbol de
  habilidades_, _orden de compra_. Estados de contenido: `verificado`, `sin_verificar`, `placeholder` («sin guía»).
- **Fuera de alcance**: cambios de modelo de datos, API, autenticación o derechos; maestrías de expansiones y mods; planner
  interactivo; comparador; cuentas o comentarios; texto de localización del juego; publicación y hosting.
- **Marca pública**: «Grim Builds» (decisión de Paco, 2026-11-16). El nombre del repositorio y el slug `grim-dawn-builds` no
  cambian. Sin logotipo; el sitio es independiente y no afiliado ni respaldado por Crate Entertainment ni por Grim Dawn.

## Brand Commitments

- **Identidad de Grim Dawn con arte propio.** Estilo del juego (fondo oscuro, marcos metálicos, tipografía de carácter) hecho
  con SVG/CSS dibujados para el proyecto y tipografía abierta OFL (Q12 = A). **Del juego solo entran** los iconos de habilidad
  (publicables tras la enmienda 1.11.0, Q11 = B) y el botón de maestría de 197 × 41. **No entran** fondos, marcos, otro arte,
  tipografía, logotipo, datos internos (`.dbr`, `.arc`, `.arz`) ni textos de localización.
- **Atribución a Crate Entertainment y aviso de no afiliación** visibles en las páginas con arte del juego. No existe permiso
  escrito de Crate: la base es tolerancia de facto y **el riesgo lo asume Paco**; con retirada inmediata (`withdrawn`) y
  _fallback_ propio siempre terminado.
- **Cero material de Maxroll** (marca, imágenes, textos, nombres de producto).
- Cambios en estos compromisos exigen decisión de Paco y, en lo que toca a §VII, enmienda de la constitución.
- **Voz** (P20 = B, Paco): algo ambientada en el universo del juego, sobria y sin ficción añadida; los datos e instrucciones
  siempre literales.
- **Referencias visuales** (P19 = A): capturas del juego de Paco en `C:\Users\paco_\Pictures\gdb-referencias`, fuera del repo, solo como referencia
  local; nunca se copian ni se publican.

## Evidence on Hand

- Una guía real migrada: **Chamán + Demoledor** (`shaman` + `demolition`), hoy en `borrador` con `rights_status: pending`, así
  que el build público no incluye ninguna guía publicada. El catálogo completo tiene una ranura por combinación; casi todas
  son `placeholder`.
- 6 maestrías base con árboles extraídos del juego (nombres EN/ES reales, sin descripciones) y 164 texturas de icono
  distintas (32 × 32) extraíbles con el extractor T028; botones de maestría ya publicados bajo la enmienda 1.10.0.
- **Ausencias que el trabajo futuro no debe fabricar**: no hay guías de otras personas ni reseñas, ni métricas de uso, ni
  tiers editoriales documentados (sin tier salvo evidencia), ni capturas de referencia del juego en el repositorio, ni
  logotipo, ni permiso escrito de Crate.

## Product Principles

1. **Primero lo verificable.** Toda tarjeta, resumen o tooltip muestra de dónde sale el dato (estado, autor, versión, fuente);
   lo que no está documentado se rotula «sin guía» o «sin clasificar», nunca se rellena con un ranking.
2. **Encontrar y seguir, en pocos pasos.** Cada pantalla tiene un siguiente paso evidente (de portada a guía en ≤ 2 clics;
   del resumen al índice y al orden de compra) y el árbol nunca obliga a apartar la vista del nodo que se lee.
3. **Se lee sin JavaScript y sin ratón.** El contenido indexable está en el HTML; ratón, teclado y toque obtienen lo mismo.
4. **El mundo del juego, con material propio.** La identidad evoca Grim Dawn con arte y tipografía del proyecto; el arte del
   juego es la excepción documentada, reversible y atribuida.
5. **El presupuesto es un requisito, no un deseo.** El rediseño cabe en §6; ampliar un presupuesto es una excepción
   registrada y aprobada por Paco, nunca una consecuencia silenciosa.

## Accessibility & Inclusion

- WCAG 2.2 AA como mínimo (constitución V): 0 violaciones critical/serious de axe en las cinco rutas, EN y ES, con y sin JS,
  a 375/768/1280 px y con zoom 200 %.
- Contraste de texto ≥ 4,5:1 y de texto grande/controles ≥ 3:1; la información nunca se transmite solo por color (estado de
  una build, sección activa, nodo asignado: siempre texto o forma además).
- Teclado completo con foco visible; objetivos táctiles ≥ 24 × 24 CSS px (44 recomendado en móvil); tooltips conforme a WCAG
  1.4.13 (descartables con Esc, _hoverable_, persistentes).
- Respeto de `prefers-reduced-motion` y `prefers-contrast`.
- Idioma: EN y ES completos; contenido sin traducción en el idioma base con `lang` explícito (constitución X).
