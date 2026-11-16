---
name: Grim Dawn Builds
description: Guías de build de Grim Dawn con identidad oscura, metálica y ornamentada con sobriedad, hecha con arte propio.
---

<!-- SEED: borrador de impeccable `document` en modo seed (spec004 T006), sin aprobar por Paco. Compromete un mundo y sus invariantes; los valores finales de tokens se fijan en T007/T008 y se capturan después con `document` en modo scan. -->

# Design System: Grim Dawn Builds

> **Estado: borrador con las decisiones de Paco aplicadas (P11–P20), aprobado por Paco el 2026-11-15.** Se escribió sin
> entrevista directa (ver `PRODUCT.md`). Lo que sale de sus decisiones registradas (spec004 §0 y «Clarifications», Q11–Q15;
> `preguntas-ui.md`, P16–P20) está en lenguaje firme; lo que es propuesta de quien redacta lleva **`propuesta`**. Esto es una
> **redefinición**: el
> aspecto actual (tema oscuro genérico que Paco describe como «AI slop») es antireferencia, no base que pulir.

## Overview

**Creative North Star: «El grabado del cartógrafo»** (P16 = A, Paco): un mapa de campaña de posguerra dibujado a mano sobre
metal, donde la información está grabada con precisión y los adornos solo enmarcan.

El sitio se ve como si perteneciera al universo de Grim Dawn: carbón cálido, metal envejecido, bronce y ascua, ornamento
sobrio. La identidad no es «oscuro con acento dorado»: viene de **marcos metálicos dibujados como SVG propio**, una textura
muy sutil de superficie y una **tipografía de rótulo con carácter de grabado**. Todo lo demás es contención, porque el
visitante viene a decidir y a leer, no a admirar un tema.

**Modos por superficie** (impeccable; cada superficie declara el suyo y la expresividad se reparte en consecuencia):

| Superficie                                       | Modo         | Qué significa aquí                                                                                                                                                                                         |
| ------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portada `/`                                      | **Persuade** | Se decide y se entra a una build. Máxima expresividad: la guía destacada rompe la escala, los marcos lucen, la jerarquía lleva el ojo a una acción evidente (abrir la guía). Datos reales, no ilustración. |
| Catálogo `/tier-list` y árbol `/maestrias/:slug` | **Operate**  | Se completa una tarea: filtrar combinaciones, leer un nodo. Escaneo rápido, consistencia, controles claros; la marca vive en detalles precisos (marcos, filetes, iconos), no en adornos.                   |
| Guía `/builds/:slug`                             | **Read**     | Se entiende algo: la build y su orden de compra. Estructura para comprender (resumen, índice, secciones), medida de lectura cómoda y árbol a mano; el ornamento recede.                                    |

**Key Characteristics:**

- Oscuridad cálida (carbón, no negro puro ni gris frío) con una sola luz protagonista: el dorado.
- Marcos y filetes metálicos propios; el ornamento es decorativo, nunca porta información.
- Rótulos con voz de grabado; texto de lectura sobrio y legible; datos en una voz técnica distinta.
- Tarjetas con jerarquía real, no un patrón repetido (excepción declarada abajo).
- Todo cabe en los presupuestos: el estilo se dibuja con CSS y archivos SVG estáticos pequeños, no con peso.

## Colors

Estrategia: **carbón cálido restringido** con un acento dorado de autoridad y un acento ascua para estados; los tonos fríos no
existen salvo que Paco los pida. Los valores de abajo son los **del sistema actual, conservados provisionalmente** (están en
`tokens.css` y T007 los revisa y verifica con `check:contrast`); no son una decisión de color aprobada.

### Primary

- **Oro de bronce** (`#d8b15a`, token actual `--color-storm`): el acento protagonista. Enlaces, foco, estado activo, el filete
  de la tarjeta destacada y el realce de nodos asignados. Se usa en una minoría de cada pantalla; su rareza es el punto.

### Secondary

- **Ascua** (`#e07845`, `--color-ember`): estados que piden atención (aviso, nodo con dependencia no resuelta, estado activo
  pulsado). Nunca decoración.

### Neutral

- **Hollín** (`#0c0a08`, `--color-soot`): fondo de página.
- **Panel de hierro** (`#15110d` y `#1e1812`, `--color-panel`, `--color-panel-2`): superficies elevadas por tono, no por sombra.
- **Hueso** (`#eadfca`, `--color-bone`): texto principal.
- **Ceniza** (`#a3947a`, `--color-ash`): texto secundario y metadatos; sujeto a verificación de contraste al ≥ 4,5:1 sobre sus
  fondos reales.
- **Línea oxidada** (`#382c1e`, `--color-line`): filetes y bordes de 1 px.
- **Bronce apagado** (`#4c3b1a`) y **ascua apagada** (`#592915`): biseles y fondos de estado.

### Reglas de color

**The One Light Rule.** El oro es la única luz de la pantalla y ocupa una parte pequeña de ella. Si dos cosas brillan, ninguna
destaca. (P17 = A: oro de bronce más ascua, sin tercer acento.)

**The Not-Only-Color Rule.** Ningún estado (verificado, sin verificar, sin guía, sección activa, nodo asignado) se distingue
solo por color: siempre lleva texto o forma. (Constitución V, FR-023.)

**The Own-Texture Rule.** Fondos, marcos y texturas son SVG/CSS dibujados para el proyecto; nunca una textura extraída del
juego (Q12 = A).

## Typography

**Display Font:** serif de grabado clásica de alto contraste, licencia OFL (P18 = A, Paco), subconjunto latin + latin-ext, que
**sustituye** a Oswald; T007 elige la familia concreta con medición; _fallback_ serif del sistema.
**Body Font:** Karla, sans-serif de lectura sobria (actual; se mantiene salvo decisión contraria).
**Label/Mono Font:** Space Mono para datos (puntos, rangos, versión del juego), como hoy.

**Character:** el rótulo habla con la voz de un grabado (formal, con serifas y contraste); la lectura es neutra y cómoda; los
datos suenan técnicos. Tres voces, tres familias, una por función.

### Hierarchy

- **Display** (peso lo fija T007, `clamp(2.5rem, 8vw, 6rem)` actual, interlineado ≈ 1,15): solo el título de la portada y el nombre
  de la guía destacada.
- **Headline** (≈ 2 rem): títulos de sección y de combinación.
- **Title** (≈ 1,25 rem): títulos de tarjeta, de sección de guía y de tooltip.
- **Body** (400, 1 rem, interlineado 1,6, medida máxima 68 ch): texto de guía y de ayuda. No supera la medida de lectura.
- **Label** (0,75 rem, mayúsculas con espaciado moderado solo en etiquetas cortas): estados, filtros y metadatos.

### Reglas de tipografía

**The Engraved Voice Rule.** Los rótulos usan la familia de display; el cuerpo de texto nunca. Una fuente de sistema no es voz de
rótulo.

**The Budget Type Rule.** ≤ 3 familias y ≤ 5 archivos, `font-display: swap`, `preload` de la principal; la serif de rótulo
**sustituye** a Oswald y no se suma (FR-022, plan R5).

## Layout

Contenedor central de hasta `76rem` (`--page-max`), espaciado en escala de 4 px (4, 8, 12, 16, 24, 32, 48, 64). Tres anchos de
referencia de verificación: 375, 768 y 1280 px.

- **Portada (Persuade):** una guía destacada en tarjeta grande que rompe la escala del resto, seguida de una rejilla de tarjetas
  de builds y accesos por maestría. Todo en HTML, sin JS.
- **Catálogo (Operate):** rejilla responsive de tarjetas con filtros combinables (AND entre grupos, OR dentro), contador de
  resultados y, **después** de las builds reales, la sección plegada «sin guía» con tarjetas compactas (Q13 = A, `<details>`
  sin JS).
- **Guía (Read):** resumen de build al abrir; índice de secciones sticky en escritorio (≥ 1280 px) y plegable en móvil sin cubrir
  contenido; medida de lectura de 68 ch; el árbol y el paso a paso del orden de compra no pierden de vista el nodo.
- **Árbol (Operate):** el árbol ocupa el ancho disponible; el tooltip va **junto al nodo** (≤ 16 px entre bordes), recolocado
  para quedar entero en el viewport.
- Móvil primero: sin scroll horizontal de página, gutter de 16 px, objetivos táctiles de 44 px recomendados (24 mínimo).

## Elevation & Depth

Profundidad por **capas tonales y biseles de 1 px**, no por sombras. En reposo las superficies son planas; el bisel
(`inset` de 1 px en bronce apagado) y el filete oxidado separan planos. Las sombras solo aparecen como **respuesta de estado** o
en el tooltip, y siempre **con desenfoque** (ambientales); nunca sombras de bloque sin desenfoque. Sin cristal ni desenfoque de
fondo decorativos.

### Reglas de profundidad

**The Flat-By-Default Rule.** Una superficie en reposo no proyecta sombra; el tono y el filete la separan del fondo.

## Shapes

Esquinas **rectas** (`--radius-0`, radio 0) como sello: la forma del metal cortado, no del software amigable. La identidad
viene de **marcos de 9 cortes** (`border-image`) servidos como SVG estáticos propios del mismo origen (≤ 5 archivos, sin
`data:`), con esquinas ornamentadas sobrias y filetes. Los marcos son decorativos (`aria-hidden`/CSS) y los SVG repetidos se
definen una vez y se referencian. Iconos de habilidad: 32 × 32 (juego, con manifiesto) o símbolo propio por tipo de habilidad
(activa, modificadora, _transmuter_, circular, pasiva), nunca emoji ni glifos Unicode.

## Components

Esta sección se omite en el borrador: no hay componentes implementados todavía. Cuando existan (`gd-build-card`, resumen de
build, índice de guía, tooltip del nodo), `impeccable document` en modo scan los capturará. Compromisos ya decididos:

- **Tarjeta de build** (excepción declarada, «el brief gana»): Paco pide tarjetas en portada y catálogo. Se aceptan, **no
  idénticas ni anidadas**: cada una lleva datos reales distintos (maestrías con retrato, estado de contenido y de revisión,
  tipo de daño, autor, versión del juego), la destacada rompe el tamaño y una tarjeta nunca contiene otra (FR-003–FR-006).
  Es **un único enlace** con nombre accesible completo (combinación y estado).
- **Tooltip de nodo:** solo datos factuales del catálogo (nombre EN/ES, tier, barra, rango, tipo, dependencia) y, en guía, estado,
  puntos y justificación; nada de texto de localización del juego (FR-011).

## Do's and Don'ts

### Do

- **Do** declarar el modo de cada superficie antes de diseñarla: portada _Persuade_, catálogo y árbol _Operate_, guía _Read_.
- **Do** dibujar marcos, fondos y texturas como SVG/CSS propios y definirlos como tokens (ningún color, fuente, espacio o marco
  fuera de `tokens.css`).
- **Do** rotular los estados con texto y forma además de color, y mantener contraste ≥ 4,5:1 (texto) y ≥ 3:1 (texto grande y
  controles), verificado con `pnpm check:contrast`.
- **Do** dar a cada tarjeta jerarquía interna con sus datos reales y a la tarjeta destacada otro tamaño.
- **Do** respetar `prefers-reduced-motion` y `prefers-contrast`; la animación nunca porta información única.
- **Do** mantener el arte del juego como excepción documentada: solo iconos de habilidad y botón de maestría, con manifiesto,
  atribución a Crate Entertainment, aviso de no afiliación y _fallback_ propio terminado.

### Don't

Rechazos de spec004 §2 con su criterio verificable (SC-010, medidos sobre los CSS/HTML cambiados; `impeccable detect` cubre solo
los marcados «detector»):

- **Don't** usar **texto con degradado** (`background-clip: text`). _Detector._
- **Don't** usar **`border-left`/`border-right` gruesos como acento** (> 1 px). _Detector._
- **Don't** usar **sombras de bloque sin desenfoque** (`box-shadow` con desenfoque 0). _Detector._
- **Don't** usar **cristal o desenfoque decorativo** (`backdrop-filter`, fondos translúcidos como adorno). _Revisión._
- **Don't** usar **fuente de sistema como voz de rótulo**. _Detector._
- **Don't** usar **emoji o glifos Unicode como icono**. _Detector._
- **Don't** anidar tarjetas ni repetir tarjetas idénticas de icono + título + texto. _Prueba de componente: ninguna tarjeta
  contiene otra tarjeta; revisión visual._
- **Don't** poner **_eyebrows_** sobre los títulos ni **numeración de secciones sin significado**. _Revisión._
- **Don't** dibujar **ilustraciones SVG que imitan imágenes** (retratos, paisajes, escenas); el SVG propio es ornamento y
  símbolo, no pintura. _Revisión._
- **Don't** copiar la marca, imágenes, textos ni nombres de Maxroll: ninguna cadena ni activo de `apps/web/src` ni
  `apps/web/public` coincide con su lista de marca (FR-030, SC-010). _Prueba (T031)._
- **Don't** usar fondos, marcos, texturas, otro arte, tipografía o logotipo de Grim Dawn (§VII; Q12 = A).
- **Don't** usar símbolos cargados (militarismo, supremacía, odio) como ornamento, aunque el mundo del juego sea bélico.
- **Don't** transmitir información solo por color ni ampliar un presupuesto de §6 en silencio.

## Referencias visuales

Paco aportará capturas del juego como **referencia local** en `C:\Users\paco_\Pictures\gdb-referencias` (fuera del repo; hoy vacía; P19 = A).
**No se copian al repositorio ni se publican**, ni se usan como activo del sitio (§VII): sirven para observar proporciones de
marcos, filetes y jerarquía, y el arte se dibuja propio. Ninguna referencia es de Maxroll.

## Portada y voz

La portada **no lleva ilustración** (P20 = B): la expresividad la llevan la tarjeta destacada, los marcos y la tipografía. La
voz de los textos es **algo ambientada en el universo del juego, sobria y sin ficción añadida** (sin «fanfiction»): el rótulo
puede evocar, el dato y la instrucción son siempre literales y factuales.

## Pendiente de Paco

Solo el **nombre público de la marca** (ver `PRODUCT.md`); se decide más tarde y no bloquea el sistema visual.
