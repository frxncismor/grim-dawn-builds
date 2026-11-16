# Feature Specification: Rediseño de UI estilo Grim Dawn, con flujo de guías tipo Maxroll

**Feature Branch**: `004-rediseno-ui-grim-dawn` (trabajo de planificación en `orq/11111619-ui-s4-plan`, base `orq/11111619` @ `1fd7e77`)

**Created**: 2026-11-15

**Status**: Clarified (Q11–Q15 resueltas por Paco, 2026-11-15; ver «Clarifications»). Listo para `tasks`; la publicación de iconos queda bloqueada hasta la enmienda 1.11.0 de §VII (FR-018).

**Depende de**: `001-mvp-guias-builds` (páginas, SEO, presupuestos de §6), `002-spec-completion-reviews` (puerta de cierre) y `003-catalogo-arboles-maestria` (catálogo, árbol SVG en modos catálogo/guía/asignación, retratos, `deferred.css`).

**Input**: User description: "Rediseño de la UI: lo mismo que las guías de Maxroll (Diablo 4) pero para Grim Dawn, de modo que encontrar una build y seguir una guía sea fácil; estilo del juego (fondo oscuro, marcos y tipografía) con assets de la instalación local dentro de lo que permite la constitución §VII; builds como tarjetas en portada y catálogo; iconos de habilidad del juego en el árbol; tooltip junto al nodo y no debajo del árbol; deuda de UI aplazada si encaja."

## 0. Decisiones fijas de Paco (2026-11-13 a 2026-11-15)

| Clave                 | Decisión (resumen)                                                                                                                                                                      | Efecto                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `vision=maxroll_gd`   | El producto es «las guías de Maxroll de Diablo 4, pero para Grim Dawn». Maxroll es la referencia de **estructura, flujo y UX**: encontrar una build y seguir una guía debe ser fácil. | US1, US2, SC-001, SC-002    |
| `no_copiar_maxroll`   | **No** se copia la marca, las imágenes ni los textos de Maxroll. Se copia el _método_ (flujo, jerarquía), no el material.                                                               | FR-030, SC-010              |
| `estilo=juego`        | Fondo oscuro, marcos y tipografía de Grim Dawn, con assets de la instalación local (extractor T028, `.game-assets/textures/`) **dentro de lo que permite la constitución §VII**. Q12 = A: arte propio en el estilo del juego y tipografía OFL. | US5, FR-020–FR-024, Q12  |
| `builds=tarjetas`     | Las builds se muestran como **tarjetas**, fáciles de encontrar y bonitas, en la portada y en el catálogo.                                                                               | US1, FR-001–FR-006          |
| `iconos=juego_publicados` | El árbol muestra los **iconos de habilidad del juego** y se **publican** como los botones de maestría (Q11 = B, 2026-11-15): PNG derivados versionados, manifiesto, atribución y retirada inmediata. Exige antes la enmienda 1.11.0 de §VII y el análisis de riesgos actualizado. | US4, FR-016–FR-019, Q11 |
| `tooltip=junto_nodo`  | El detalle del nodo aparece **junto al nodo** al pasar el ratón, no debajo del árbol; con equivalente accesible por teclado y táctil.                                                   | US3, FR-010–FR-015          |
| `restricciones=§6`    | Siguen vigentes los presupuestos de `001/plan.md` §6, la CSP sin `unsafe-inline`, la paridad EN/ES, la accesibilidad, la lectura sin JS y el contenido fixtures/API sin _fallback_.     | SC-005–SC-009, FR-040–FR-046 |

> **Constancia de derechos** (constitución §VII, 1.10.1): no existe permiso escrito de Crate Entertainment; la base es tolerancia de facto asumida como riesgo por el dueño. La excepción 1 cubre **iconos de habilidad** (hoy solo uso local) y la excepción 2 los **retratos de maestría** (el botón de entrenamiento de 197×41). **Nada más del juego entra**: ni fondos, ni marcos, ni otro arte, ni datos internos (`.dbr`, `.arc`, `.arz`, localización), ni la marca. **Q11 = B** pide publicar los iconos de habilidad: eso **amplía** la excepción 1 y exige la enmienda **1.11.0** y el análisis de riesgos actualizado como **tarea previa** a cualquier publicación (FR-018); el riesgo lo asume Paco, sin permiso escrito de Crate. Marcos, fondos y tipografía del juego **siguen fuera** (Q12 = A).

## 1. Resumen y valor

Hoy el sitio funciona (catálogo, guía, árboles de maestría, EN/ES, presupuestos en verde) pero **se ve y se usa como un prototipo**: portada con texto y un enlace, catálogo como filas de entradas, guía como documento largo, detalle del nodo debajo del árbol (el lector mira el nodo y tiene que bajar la vista para leerlo) y una estética que Paco describe como «AI slop».

Esta feature rediseña la **capa de presentación** para que ganar una build y seguir su guía se parezca a lo que hace Maxroll en Diablo 4: una portada que enseña builds como **tarjetas**, un catálogo que se filtra con rapidez, una guía que se recorre por secciones con un resumen de la build arriba, y un árbol de habilidades con **iconos y tooltip junto al nodo**. La identidad visual es la de Grim Dawn (oscura, metálica, ornamentada con sobriedad), construida con arte **propio** y con el arte del juego que §VII permite, nunca con arte copiado de Maxroll.

No cambia el modelo de datos de guías ni de catálogo, ni las reglas de derechos, ni la API. Cambia cómo se ven y cómo se recorren.

## 2. Dirección visual (derivada de `impeccable`)

> `impeccable context --target apps/web` informó `NO_PRODUCT_MD` (sin `PRODUCT.md` ni `DESIGN.md`) y pide completar `init` con la persona usuaria. Este agente de planificación no tiene interlocutor: la verdad de producto sale de §0 (palabras de Paco) y de la memoria de proyecto, y **la tarea de implementación de fundación (plan) escribe `PRODUCT.md` y `DESIGN.md`** con Paco antes de tocar componentes. Sustitución declarada, no un `init` ejecutado.

- **Modos por superficie** (impeccable): portada = _Persuade_ (se decide y se entra a una build); catálogo y árbol = _Operate_ (escaneo rápido, consistencia, controles claros); guía = _Read_ (comprensión, estructura, lectura larga). Cada superficie declara su modo en su brief; la expresividad máxima va a la portada y a los marcos, la contención al catálogo y a la guía.
- **Mundo visual comprometido** (no «oscuro genérico»): fondo de carbón cálido con textura propia sutil, marcos metálicos/bronce dibujados como SVG propio, acento dorado ya presente (`--color-storm`) y ascua (`--color-ember`) para estados; tipografía de rótulo con carácter de grabado (serif display o similar) autoalojada, y una de lectura sobria. **No** se usa tipografía del juego (es de Crate y no está bajo §VII).
- **Cosas que la dirección rechaza** (criterios medibles en SC-010): texto con degradado, `border-left`/`border-right` gruesos como acento, tarjetas idénticas anidadas, sombras de bloque sin desenfoque, cristal/desenfoque decorativo, _eyebrows_ sobre los títulos, numeración de secciones sin significado, iconos hechos con emoji o glifos Unicode, ilustraciones SVG que imitan imágenes, fuente de sistema como voz de rótulo.
- **Excepción declarada** (el brief gana, impeccable §«The brief wins»): Paco **pide tarjetas** como estructura de portada y catálogo. Se aceptan tarjetas, pero **no idénticas ni anidadas**: cada tarjeta lleva datos reales distintos (maestrías con su retrato, estado, daño, autor), con jerarquía interna, y la tarjeta destacada rompe el tamaño. Una tarjeta nunca contiene otra.

## Clarifications

### Session 2026-11-15

Respuestas oficiales de Paco (`preguntas-ui.md`, Preguntas 11–15), recogidas por el orquestador de UI.

- Q: ¿Se publican los iconos de habilidad del juego o siguen solo en local? → A: **B, se publican** como los botones de maestría: PNG derivados versionados con manifiesto, atribución y retirada inmediata. Requiere enmienda de §VII a 1.11.0 y actualizar el análisis de riesgos como **tarea SDD de spec004 antes de publicarlos**; sin permiso escrito de Crate, riesgo asumido por Paco. (FR-016–FR-019, SC-009)
- Q: Marcos, fondos y tipografía «de Grim Dawn»: ¿arte propio o enmendar §VII? → A: **A, arte propio** en el estilo del juego (SVG/CSS) y tipografía abierta OFL; solo iconos y botón de maestría vienen del juego. Sin enmienda para marcos. (FR-021, FR-022)
- Q: Combinaciones sin guía: ¿cómo salen? → A: **A**: builds reales como tarjetas; combinaciones sin guía en una sección **aparte y plegada**, con tarjetas compactas, texto «sin guía» y sin tier. (FR-006)
- Q: ¿Cuánto del rediseño de la guía entra? → A: **A**: resumen + índice de secciones + paso a paso del orden de compra, con el paso a paso como historia de menor prioridad dentro de US2 (puede quedar fuera si el presupuesto no cabe, sin bloquear el resto). (FR-009)
- Q: Cambio de maestría «con fluidez»: ¿transición entre documentos o carga en cliente? → A: **A**: _View Transitions_ entre documentos, solo CSS; cada maestría sigue siendo una página prerenderizada. (FR-025)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Encontrar una build como tarjeta desde la portada o el catálogo (Priority: P1)

Como jugadora que busca qué construir, abro `/`, veo builds como **tarjetas** (retratos de sus dos maestrías, nombre de la combinación, estado de contenido y de revisión, tipo de daño, autor, versión del juego), filtro por maestría o daño y llego a la guía en **dos clics o menos** desde la portada, sin necesitar JavaScript para leerlas.

**Why this priority**: es el valor que Paco quiere (encontrar una build debe ser fácil) y la puerta de entrada de todo lo demás. Es la historia que más se parece al flujo de Maxroll.

**Independent Test**: con el catálogo de fixtures, `/` y `/tier-list` renderizan las tarjetas en el HTML prerenderizado; un e2e cuenta los clics desde `/` hasta `/builds/<slug>` (≤ 2) y comprueba que las tarjetas de combinaciones sin guía no se presentan como recomendación.

**Acceptance Scenarios**:

1. **Given** el catálogo con al menos una guía publicada, **When** abro `/`, **Then** veo la guía destacada como tarjeta grande y, debajo, un conjunto de tarjetas de builds y accesos por maestría, todo en el HTML sin JS.
2. **Given** el catálogo, **When** abro `/tier-list`, **Then** veo una rejilla de tarjetas con filtros por maestría y daño que combinan (AND entre grupos, OR dentro de un grupo, como hoy) y un contador que anuncia el resultado.
3. **Given** una combinación sin guía (`placeholder`), **When** aparece en el catálogo, **Then** se identifica por **texto** y forma (no solo por color) como «sin guía», sin tier ni sello de recomendación (constitución I).
4. **Given** una tarjeta, **When** la enfoco con teclado, **Then** toda la tarjeta es un solo destino de enlace con nombre accesible completo y foco visible.

---

### User Story 2 - Seguir una guía paso a paso (Priority: P1)

Como lectora de una guía, abro `/builds/<slug>` y entiendo en segundos **qué es la build** (resumen con maestrías, daño, estado, autor, versión), me muevo por secciones (índice lateral o superior), veo en qué sección estoy y recorro el orden de compra de puntos sin perder el árbol de vista.

**Why this priority**: «seguir una guía debe ser fácil» es la mitad de la visión de Paco. Sin esto, las tarjetas llevan a un documento igual de difícil de seguir.

**Independent Test**: la página de la guía de fixtures (Chamán + Demoledor) tiene un bloque de resumen al inicio, un índice de secciones con la sección actual marcada, y se puede leer entera sin JS; un e2e comprueba que el índice enlaza a todas las secciones y que la sección activa cambia al desplazarse (con JS).

**Acceptance Scenarios**:

1. **Given** una guía publicada, **When** abro su página, **Then** veo un resumen de la build (maestrías con retrato, daño, estado, autor, versión, enlace a la fuente) antes del primer bloque de contenido.
2. **Given** una guía larga en escritorio (≥ 1280 px), **When** me desplazo, **Then** el índice de secciones permanece visible y marca la sección actual con texto además de color; en móvil el índice es un control plegable, sin cubrir el contenido.
3. **Given** el orden de compra de puntos, **When** avanzo de paso, **Then** el árbol resalta lo que cambia en ese paso y el paso actual se anuncia a lectores de pantalla.
4. **Given** una guía con `rights_status` que no permite publicar, **When** se construye el sitio público, **Then** la ruta no existe, como hoy (sin cambios de política).

---

### User Story 3 - Tooltip junto al nodo del árbol (Priority: P1)

Como lectora del árbol (en `/maestrias/<slug>` o en una guía), al pasar el ratón por un nodo veo su detalle en un **tooltip pegado al nodo**, sin tener que mirar debajo del árbol; con teclado y en táctil obtengo lo mismo.

**Why this priority**: es un defecto de usabilidad concreto y pedido por Paco: hoy el detalle sale en un panel bajo el árbol (`skill-tree__detail`), lejos de lo que se mira.

**Independent Test**: un e2e pasa el ratón por un nodo y comprueba que el tooltip aparece a ≤ 16 px del nodo y dentro del viewport; repite con foco de teclado (Tab/flechas) y con toque; comprueba Esc para cerrar y que el tooltip no tapa el nodo siguiente cuando se navega.

**Acceptance Scenarios**:

1. **Given** el árbol, **When** paso el ratón sobre un nodo, **Then** aparece un tooltip adyacente al nodo con su nombre (EN/ES), tier, barra requerida, rango máximo, tipo y dependencia, y desaparece al salir (con una pequeña tolerancia para poder entrar al tooltip, WCAG 1.4.13).
2. **Given** el árbol, **When** enfoco un nodo con teclado, **Then** el mismo tooltip aparece, **Esc** lo cierra sin mover el foco y el nombre accesible del nodo sigue describiéndolo para lectores de pantalla.
3. **Given** un dispositivo táctil, **When** toco un nodo, **Then** el tooltip se fija junto al nodo hasta tocar fuera o pulsar su botón de cierre; no hay detalle que dependa de _hover_.
4. **Given** un nodo cerca del borde del árbol o de la pantalla, **When** aparece el tooltip, **Then** se recoloca para quedar completo dentro del viewport sin ocultar el propio nodo.
5. **Given** una guía con asignación, **When** abro el tooltip de un nodo asignado, **Then** muestra además el estado, los puntos y la justificación de la guía.
6. **Given** que se carga sin JavaScript, **When** leo la página, **Then** la lista textual de habilidades sigue disponible (como hoy) y es el equivalente sin JS del tooltip.

---

### User Story 4 - Iconos de habilidad del juego en el árbol (Priority: P2)

Como lectora, veo en cada nodo el **icono de la habilidad** como en el juego, para reconocerla de un vistazo, también en el sitio publicado; si el arte del juego se retira o está desactivado, veo iconografía propia y el árbol sigue completo.

**Why this priority**: sube mucho el atractivo y el reconocimiento, pero es el punto con riesgo de derechos y depende de la enmienda 1.11.0 de §VII (Q11 = B), que debe estar aprobada antes de publicar; el árbol ya funciona con iconografía propia.

**Independent Test**: con `ASSET_SOURCE=own` (por defecto) el árbol muestra iconos propios y el build público pasa `assets:check`; con `ASSET_SOURCE=game` (release y CI, como los retratos) muestra los iconos versionados y falla cerrado si falta la entrada válida del manifiesto.

**Acceptance Scenarios**:

1. **Given** `ASSET_SOURCE=own`, **When** abro el árbol, **Then** cada nodo tiene un icono propio coherente (por tipo de habilidad) y ningún archivo del juego se sirve.
2. **Given** `ASSET_SOURCE=game` y la enmienda 1.11.0 vigente, **When** abro el árbol (local o artefacto de release), **Then** los nodos muestran el icono de su habilidad, servido por el propio sitio con atribución a Crate y aviso de no afiliación visibles, y el manifiesto registra cada uno con `license_or_permission = tolerancia_de_facto_sin_permiso`, `proof_ref` y `fallback_svg`.
3. **Given** un icono sin entrada `approved` en el manifiesto, **When** se construye con `game`, **Then** el build falla cerrado y no degrada en silencio.
4. **Given** una retirada pedida por Crate, **When** se marca `status: withdrawn`, **Then** el sitio muestra el _fallback_ propio en el mismo cambio y el archivo desaparece del repositorio y del artefacto.
5. **Given** el artefacto público con `ASSET_SOURCE=own`, **When** se inspecciona, **Then** no contiene ningún PNG de icono del juego (prueba equivalente a la de retratos de spec003).

---

### User Story 5 - Una identidad visual de Grim Dawn en todo el sitio (Priority: P2)

Como visitante, todas las páginas comparten una identidad **oscura, con marcos y tipografía de carácter** propios del universo de Grim Dawn, no un tema oscuro genérico, y se siguen leyendo con contraste suficiente.

**Why this priority**: es lo que quita el «AI slop» y da cohesión, pero depende de decisiones de §VII (Q12) y no bloquea el flujo de encontrar y seguir una build.

**Independent Test**: el sistema de tokens (`tokens.css`) y la documentación de diseño (`DESIGN.md`) existen; un check de contraste (`check:contrast`) y el detector de impeccable no dan hallazgos en las rutas cambiadas; capturas a 375/768/1280 en EN y ES coinciden con la dirección aprobada.

**Acceptance Scenarios**:

1. **Given** cualquier página pública, **When** se renderiza, **Then** usa los mismos tokens (color, tipografía, espacio, marcos) y ningún color o fuente escrito a mano fuera del sistema.
2. **Given** un marco decorativo, **When** se muestra, **Then** es un SVG o CSS **propio**, no una textura del juego (salvo que Q12 se resuelva con enmienda).
3. **Given** `prefers-reduced-motion`, **When** hay animación, **Then** se reduce o se elimina sin perder información.

---

### User Story 6 - Cambiar de maestría con fluidez (Priority: P3)

Como lectora en `/maestrias/<slug>`, cambio a otra maestría desde un selector junto al árbol sin perder la posición ni sentir una recarga completa. (Aplazado desde spec003 US2; ver Q15.)

**Why this priority**: mejora de fluidez, no de capacidad; cada maestría ya es una página prerenderizada y navegable. Su coste de rendimiento puede no compensar.

**Independent Test**: el selector de maestrías enlaza a las seis rutas y la transición no añade JS al presupuesto inicial; sin JS sigue siendo navegación normal.

**Acceptance Scenarios**:

1. **Given** el selector de maestrías, **When** elijo otra, **Then** llego a `/maestrias/<otra>` conservando el idioma y, donde el navegador lo soporte, con transición suave entre documentos.
2. **Given** un navegador sin esa transición, **When** elijo otra maestría, **Then** la navegación funciona igual, sin transición.

---

### Edge Cases

- Catálogo con una sola guía publicada y casi todo `placeholder`: la portada no debe parecer vacía ni inflar el catálogo con tarjetas de «sin guía» como si fueran builds (resuelto en FR-006: sección aparte y plegada).
- Nombre de combinación muy largo en EN/ES: la tarjeta no desborda y el nombre completo está en el nombre accesible.
- Tooltip en nodo que cae fuera del viewport (borde derecho/inferior), con zoom 200 % y con el árbol desplazado dentro de su contenedor.
- Dos tooltips: nunca se muestra más de uno a la vez; el de foco prevalece sobre el de _hover_ residual.
- Retrato o icono ausente, retirado o con `ASSET_SOURCE` distinto: la tarjeta y el nodo conservan su tamaño y el _fallback_ (sin saltos de maquetación, CLS ≤ 0,05).
- Contenido en un idioma sin traducción: se muestra el idioma base con `lang` explícito (constitución X).
- Pantalla táctil sin ratón y navegador con el JS bloqueado.
- Texto del juego: las descripciones de habilidades son texto de la localización de Crate y **no** están bajo §VII; el tooltip solo usa datos factuales del catálogo y la justificación editorial de la guía.
- Fuente tipográfica elegida que no cabe en el presupuesto de fuentes (máx. 3 familias/5 archivos): se decide en el plan, nunca se amplía en silencio.

## Requirements _(mandatory)_

### Functional Requirements

#### Tarjetas de builds (US1)

- **FR-001**: La portada (`/`) **DEBE** mostrar builds como tarjetas: una guía destacada y una selección de builds, con acceso al catálogo completo y accesos por maestría, todo en el HTML prerenderizado.
- **FR-002**: El catálogo (`/tier-list`) **DEBE** presentar sus entradas como tarjetas en rejilla responsive, conservando los filtros combinables, el estado en la URL, la búsqueda por texto y el contador de resultados actuales.
- **FR-003**: Cada tarjeta **DEBE** mostrar: las dos maestrías de la combinación con su retrato o _fallback_, el nombre de la combinación (EN/ES), el estado de contenido (`verificado`/`sin_verificar`/`placeholder`), el estado de revisión, el tipo de daño, el autor y la versión del juego; y **NO** debe mostrar tier ni sello de recomendación si la entrada no tiene tier editorial documentado.
- **FR-004**: Toda tarjeta **DEBE** ser un único destino de navegación (un enlace), con nombre accesible que incluya combinación y estado, foco visible y objetivo táctil ≥ 44 × 44 CSS px de área clicable.
- **FR-005**: Las tarjetas **NO DEBEN** anidar otras tarjetas ni repetir un patrón idéntico de icono + título + texto: la jerarquía interna usa los datos reales de la build (impeccable, §2).
- **FR-006**: Las entradas `placeholder` **DEBEN** distinguirse por texto y forma, sin tier, sin guía enlazada y sin afirmaciones de ranking (constitución I; spec001 AC-04); en portada y catálogo se presentan en una **sección aparte y plegada**, con tarjetas compactas que dicen «sin guía» (Q13 = A), después de las builds reales; el marco completo sigue accesible (una ranura por combinación) y el contenido plegado está en el HTML (`<details>`, sin JS).

#### Flujo de guía (US2)

- **FR-007**: La página de guía **DEBE** abrir con un resumen de build (maestrías con retrato, daño, estado, autor, versión del juego, enlace a la fuente y atribución) antes del primer bloque de contenido.
- **FR-008**: La guía **DEBE** ofrecer un índice de secciones que enlace a todas ellas, que marque la sección actual por texto además de color, que sea sticky en escritorio y plegable en móvil y que no dependa de JS para navegar (anclas).
- **FR-009**: El orden de compra **DEBE** poder recorrerse paso a paso con el árbol resaltando lo que cambia en cada paso; el paso actual se anuncia con una región `aria-live` y el control de paso es operable por teclado. Entra en spec004 (Q14 = A) como la historia de menor prioridad dentro de US2: puede quedar fuera, con registro, si no cabe en el presupuesto de §6, sin bloquear resumen ni índice.

#### Tooltip del árbol (US3)

- **FR-010**: Al pasar el ratón por un nodo, el árbol **DEBE** mostrar un tooltip **adyacente al nodo** (distancia ≤ 16 px entre bordes), no en un panel inferior; al retirar el ratón se oculta tras una tolerancia breve que permite entrar al tooltip.
- **FR-011**: El tooltip **DEBE** mostrar solo datos factuales del catálogo (nombre EN/ES, tier, barra requerida, rango máximo, tipo, dependencia, marca circular/transmuter) y, en modo asignación, estado, puntos y justificación de la guía. **NO DEBE** mostrar descripciones ni textos de la localización del juego (constitución VII, FR-014 de spec003).
- **FR-012**: El tooltip **DEBE** cumplir WCAG 1.4.13 (descartable con Esc sin mover el foco, _hoverable_, persistente hasta que se retire el _hover_ o el foco), y el nodo **DEBE** conservar un nombre y descripción accesibles equivalentes para lectores de pantalla.
- **FR-013**: Con teclado, el tooltip **DEBE** aparecer al enfocar el nodo (incluida la navegación por flechas ya existente) y no atrapar el foco; en táctil **DEBE** abrirse al tocar el nodo, fijarse junto a él y cerrarse al tocar fuera o con su botón.
- **FR-014**: El tooltip **DEBE** recolocarse para quedar completo dentro del viewport y del contenedor visible, sin ocultar el nodo que describe, y se muestra como máximo uno a la vez.
- **FR-015**: Sin JavaScript, la lista textual de habilidades **DEBE** seguir siendo el equivalente completo del tooltip; el panel inferior actual se retira como mecanismo principal, no la información.

#### Iconos de habilidad (US4)

- **FR-016**: Cada nodo del árbol **DEBE** mostrar un icono: el propio con `ASSET_SOURCE=own` y el de la habilidad del juego con `ASSET_SOURCE=game` cuando la entrada del manifiesto es válida. Los iconos del juego se versionan como PNG derivados (32 × 32) y se sirven con el mismo interruptor y la misma retirada que los retratos (spec003 T015/T036).
- **FR-017**: Cada icono del juego **DEBE** tener entrada en `fixtures/content/assets/manifest.json` con `origin_url`, `rights_holder`, `license_or_permission = tolerancia_de_facto_sin_permiso`, `proof_ref` y `fallback_svg` no vacío (constitución VII); sin entrada válida, el build con `game` **DEBE** fallar cerrado.
- **FR-018**: **Antes de versionar o servir cualquier icono del juego** **DEBE** estar aprobada la enmienda **1.11.0** de §VII (excepción 1: de «uso local ahora» a publicación con la condición común) y actualizado el análisis de riesgos que cita `proof_ref`, como **tarea SDD de esta spec** (Q11 = B). Hasta entonces, ninguna tarea añade PNG de iconos al repositorio ni a un artefacto. La publicación exige además el _fallback_ propio terminado y la atribución visible a Crate Entertainment con aviso de no afiliación en las páginas donde aparezcan. No existe permiso escrito de Crate; el riesgo lo asume Paco.
- **FR-019**: La retirada inmediata **DEBE** funcionar para los iconos igual que para los retratos (`status: withdrawn`, _fallback_ en el mismo cambio, archivo eliminado) y una prueba **DEBE** fallar si un artefacto `own` contiene arte del juego. La vista pública y el JSON emitido **NO DEBEN** exponer la ruta interna de textura del juego (`icon`, hallazgo S-004 de spec003): el nodo se asocia a su icono por un identificador público estable definido en el plan.

#### Identidad visual (US5)

- **FR-020**: El sistema de diseño **DEBE** documentarse (`PRODUCT.md` y `DESIGN.md`, fruto de `impeccable init`/`document` con Paco) y vivir en tokens CSS (`tokens.css`); ningún color, fuente, espaciado o marco queda fuera de los tokens.
- **FR-021**: Marcos, fondos y texturas **DEBEN** ser arte **propio** (SVG/CSS dibujado para el proyecto) (Q12 = A); el arte del juego se limita a iconos de habilidad y retratos/botón de maestría. Ampliar a marcos o fondos del juego exigiría otra enmienda y otra decisión de Paco, no prevista.
- **FR-022**: La tipografía **DEBE** ser autoalojada, con licencia abierta, sin la tipografía propietaria del juego, dentro del presupuesto de fuentes (máx. 3 familias y 5 archivos, `font-display: swap`, `preload` de la principal) o con enmienda explícita del presupuesto en el plan.
- **FR-023**: El tema **DEBE** respetar `prefers-reduced-motion`, `prefers-contrast` y no transmitir información solo por color; contraste de texto ≥ 4,5:1 y de texto grande/controles ≥ 3:1, verificado con `check:contrast`.
- **FR-024**: Los marcos y ornamentos **DEBEN** ser decorativos (`aria-hidden`/CSS) y no aumentar el HTML por encima del presupuesto; cualquier SVG repetido se define una vez y se referencia.

#### Navegación entre maestrías (US6)

- **FR-025**: La página de maestría **DEBE** incluir un selector de maestrías (las seis de v1, derivado del catálogo, no escrito a mano) que enlace a cada ruta conservando el idioma. La transición usa _View Transitions_ entre documentos (`@view-transition`, solo CSS, mejora progresiva; Q15 = A) y **NO DEBE** ampliar el JS inicial ni cargar árboles en cliente.

#### No copiar a Maxroll

- **FR-030**: **NO DEBE** haber en el código, estilos, activos ni textos del sitio imágenes, marca, logotipo, nombres de producto ni textos de Maxroll; la referencia se cita solo en documentación de planificación (esta spec) y no en el producto.

#### Restricciones heredadas (aceptación)

- **FR-040**: Los presupuestos de `001/plan.md` §6 **DEBEN** mantenerse sin ampliarse: HTML por página ≤ 120 000 B; JS inicial `/` ≤ 90 kB, `/tier-list` ≤ 110 kB, `/builds/:slug` ≤ 150 kB (diferidos aparte ≤ 40 kB gz); CSS crítico ≤ 20 000 B gzip; TBT mediana ≤ 150 ms; LCP ≤ 2,0 s; CLS ≤ 0,05; Lighthouse Perf ≥ 90, A11y/SEO/BP ≥ 95. Cualquier ampliación es una excepción explícita, registrada y aprobada por Paco, nunca una consecuencia silenciosa del rediseño.
- **FR-041**: La CSP **DEBE** seguir sin `unsafe-inline` (`style-src 'self'` más hashes); los estilos de los componentes diferidos siguen en `deferred.css` (T033) o en un mecanismo equivalente que no la debilite; una prueba e2e **DEBE** fallar si hay violaciones de CSP en consola en portada, catálogo, guía y maestría.
- **FR-042**: Toda cadena nueva **DEBE** tener entrada en EN y ES con paridad (`check:locale-parity`); el contenido sin traducción se muestra en el idioma base con `lang` explícito.
- **FR-043**: La accesibilidad **DEBE** cumplir WCAG 2.2 AA: 0 violaciones critical/serious de axe en las rutas cambiadas, EN/ES, con y sin JS, a 375/768/1280; teclado completo; foco visible; objetivos táctiles ≥ 24 × 24 CSS px (44 recomendado en móvil).
- **FR-044**: El contenido indexable **DEBE** seguir siendo legible **sin JavaScript** (tarjetas, resumen, índice, lista de habilidades) y las páginas conservan prerender, canonical, `hreflang`, JSON-LD y sitemap.
- **FR-045**: El contenido **DEBE** seguir viniendo de fixtures en local y de la API en release, **sin _fallback_** entre ellos; el rediseño no añade lecturas ni cambia `ContentRepository`.
- **FR-046**: Toda dependencia nueva **DEBE** justificarse por escrito (tamaño, alternativa nativa descartada; constitución IV). La posición del tooltip, el índice sticky y las transiciones se resuelven primero con CSS nativo y JS mínimo.

### Key Entities _(include if feature involves data)_

- **BuildCard (vista)**: proyección de una entrada del catálogo para la tarjeta: combinación (dos maestrías con retrato/_fallback_), nombre EN/ES, estado de contenido, estado de revisión, tipo de daño, autor, versión del juego, destino (guía o catálogo). No es una entidad de dominio nueva: se deriva de `CatalogEntry`.
- **SkillTooltip (vista)**: datos del nodo del catálogo (nombre EN/ES, tier, barra, rango, tipo, padre, circular) más, en modo asignación, estado/puntos/justificación de la guía. Sin texto del juego.
- **SkillIcon (activo)**: icono de habilidad con entrada en el manifiesto de activos (§VII, excepción 1) y _fallback_ propio; seleccionado por `ASSET_SOURCE`.
- **DesignTokens**: color, tipografía, espacio, marcos y movimiento definidos una vez (`tokens.css`) y descritos en `DESIGN.md`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Desde `/`, una persona llega a una guía publicada en **≤ 2 clics** y a cualquier combinación del catálogo en **≤ 3** (e2e de recorrido, EN y ES).
- **SC-002**: En la guía de fixtures, el resumen de la build y el índice de secciones están presentes en el HTML sin JS y el índice enlaza al **100 %** de las secciones (conteo de secciones contra enlaces).
- **SC-003**: El tooltip de cualquier nodo aparece a **≤ 16 px** del nodo y **100 % dentro del viewport** en 375/768/1280 px y con zoom 200 %, por ratón, teclado y toque (e2e sobre el árbol completo de cada maestría de v1).
- **SC-004**: **0** violaciones critical/serious de axe en `/`, `/tier-list`, `/builds/<slug>`, `/maestrias` y `/maestrias/<slug>`, EN y ES, con y sin JS, a 375/768/1280.
- **SC-005**: Los presupuestos de §6 siguen en verde: `check:performance` (todas las comprobaciones), `check:initial-js` y `build` sin excepciones nuevas; TBT mediana ≤ 150 ms en las URLs de árbol bajo carga concurrente.
- **SC-006**: CSS crítico ≤ 20 000 B gzip y HTML ≤ 120 000 B en **todas** las rutas, medidos sobre el artefacto real.
- **SC-007**: 0 violaciones de CSP en consola en las cinco rutas, EN y ES (e2e).
- **SC-008**: `check:locale-parity` verde: las mismas secciones y cadenas en EN y ES.
- **SC-009**: Con `ASSET_SOURCE=own`, el artefacto público contiene **0** archivos de arte del juego (test de artefacto); con `game` y una entrada inválida el build **falla** (test); con `game`, cada icono servido tiene entrada `approved` en el manifiesto y el artefacto no expone rutas internas de textura. La enmienda 1.11.0 y el análisis de riesgos quedan registrados **antes** de la primera tarea que versione un icono (orden verificable en `tasks.md`).
- **SC-010**: Criterios anti «AI slop» medibles sobre los CSS/HTML cambiados: `impeccable detect` sin hallazgos de sus reglas deterministas (texto con degradado, `border-left`/`right` > 1 px, sombras de bloque sin desenfoque, glifos/emoji como icono, fuente de sistema como rótulo); ninguna tarjeta contiene otra tarjeta; ninguna cadena ni activo coincide con la lista de marca de Maxroll (FR-030).
- **SC-011**: Revisión visual con Paco de capturas a 375/768/1280 en EN y ES de las cinco rutas y de los tres estados del tooltip (ratón, teclado, toque): aprobadas o con lista de cambios cerrada antes del cierre de la spec.

## Assumptions

- La API/PostgreSQL y los fixtures siguen como hoy; esta spec no toca datos, esquema ni contratos (FR-045).
- El catálogo tiene pocas guías publicadas (hoy una) y muchas combinaciones `placeholder`; el diseño de tarjetas debe funcionar bien con ambos extremos.
- Los iconos de habilidad se obtienen con el extractor de texturas de spec003 (T028) a `.game-assets/textures/` (ignorado por git); una extensión del extractor emite los PNG derivados que se versionan **solo después** de la enmienda 1.11.0 (Q11 = B), con su manifiesto.
- Paco usa el sitio en local (MVP local-first, sin hosting); la publicación pública sigue diferida.
- El tooltip puede resolverse con JS mínimo y CSS (posicionamiento), sin librería nueva; si no, se justifica por escrito (FR-046).
- `impeccable` (v4.8.1) está instalado solo en el repo principal y se invoca por ruta absoluta desde worktrees.

## Fuera de alcance

- Cambios en el modelo de datos, la API, la autenticación o los derechos (constitución I, II, VI, XI).
- Maestrías de expansiones y mods; planner interactivo de builds; comparador; cuentas o comentarios.
- Texto de la localización del juego (descripciones de habilidades), fondos o marcos del juego, tipografía del juego o su logotipo, salvo enmienda nueva de §VII.
- Publicación o despliegue (hosting sigue diferido).
- Reescribir contenido editorial de las guías.

## Deuda de spec003 considerada (disposición)

| ID                                | Qué es                                                                                                 | Disposición en spec004                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 (ronda 1) / B-008            | `MasterySummarySchema` fuera de `packages/domain`; regla maestría↔árbol triplicada                     | **Fuera**: refactor de dominio sin efecto visual; backlog técnico.                                                                                                                      |
| A-03 (ronda 1)                    | Estado de activos con doble fuente en release (archivo del repo vs. tabla `assets`); retirada en BD   | **Dentro**: spec004 añade iconos, y la retirada inmediata (FR-019) exige una sola fuente de verdad del estado de un activo. Entra como tarea de fundación de activos.                    |
| C-003                             | `writeCatalogRows` no borra maestrías retiradas                                                        | **Fuera**: dato/API sin efecto en la UI de v1 (seis maestrías fijas); backlog.                                                                                                          |
| T042 — B-001 (ronda 3)            | `typecheck:e2e` no está en `verify`/CI                                                                 | **Dentro**: spec004 añade muchos e2e (tooltip, recorrido, CSP); sin tipado en la puerta se degradan. Entra como tarea de herramientas.                                                  |
| T042 — C-001/F-001 (ronda 3)      | Códigos de error de `seed-content` (precisión del mensaje del lanzador)                                | **Fuera**: herramientas de BD, sin relación con la UI; backlog.                                                                                                                         |
| T043 — A-01 (ronda 3)             | Contrato lanzador–seeder repartido entre `scripts/` y `apps/api`                                       | **Fuera**: refactor entre zonas sin efecto visual; backlog.                                                                                                                             |
| spec003 US2 (fluidez)             | «Cambio de maestría sin recarga» reformulado a navegación por documento (A-02 de la revisión de cierre) | **Dentro, P3**: US6 y Q15.                                                                                                                                                              |

## 9. Preguntas de clarify (cerradas)

Q11–Q15 respondidas por Paco el 2026-11-15; el detalle está en «Clarifications» y la trazabilidad en `plan.md` y `tasks.md`. No quedan marcadores de aclaración pendientes.

| Pregunta | Respuesta                                                         | Requisitos afectados   |
| -------- | ----------------------------------------------------------------- | ---------------------- |
| Q11      | B: publicar iconos de habilidad (enmienda 1.11.0 y riesgos antes) | FR-016–FR-019, SC-009  |
| Q12      | A: arte propio y tipografía OFL                                   | FR-021, FR-022         |
| Q13      | A: sin guía en sección aparte y plegada                           | FR-006                 |
| Q14      | A: resumen + índice + paso a paso                                 | FR-009                 |
| Q15      | A: _View Transitions_ entre documentos                            | FR-025                 |
