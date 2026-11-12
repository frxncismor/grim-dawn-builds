# Especificación: Catálogo propio de árboles de maestría

**Feature**: `003-catalogo-arboles-maestria` | **Estado**: Borrador para aprobación | **Fecha**: 2026-11-12
**Base**: `orq/11111619` @ `e95c2f5` (= `mvp/1` @ `f9360e0`, diff vacío)
**Depende de**: `001-mvp-guias-builds` (modelo por guía, render SVG, modelo de derechos) y `002-spec-completion-reviews` (puerta de cierre)

## 0. Decisiones fijas del usuario (2026-11-12)

| Clave                                           | Decisión (texto del usuario, resumido)                                                                                  | Efecto             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `game_copy=legal`                               | Tiene copia legal del juego; **se pueden leer los `.dbr`** de su instalación.                                           | US1, FR-002–FR-006 |
| `wiki_license=respetar_la_declarada`            | Se respeta la licencia que declare la wiki **hoy**; verificarla y citarla antes de planificar.                          | FR-007, SC-006     |
| `third_party_content=datos_sin_texto_ni_imagen` | De las guías del foro se transcriben **solo datos del build**, nunca su texto ni sus imágenes, con **enlace al autor**. | FR-011–FR-014      |

### 0.1 Verificación de la licencia de la wiki (hecha hoy, **contradictoria**)

Comprobado en vivo el 2026-11-12 en `https://grimdawn.miraheze.org/wiki/Project:Copyrights`
(revisión `oldid=82`): el **cuerpo** de la página dice «All textual and graphical content on
Grim Dawn Wiki that we may lawfully license is licensed to you under the Creative Commons
Attribution-ShareAlike **3.0** Unported (CC BY-SA 3.0)», mientras que el **pie de página** del
wiki dice «Content is available under Creative Commons Attribution-ShareAlike **4.0**
International (CC BY-SA 4.0) unless otherwise noted» y muestra la insignia de 4.0.

**Resolución propuesta** (requiere tu confirmación escrita, ver pregunta Q1): aplicar la
licencia **más restrictiva y más explícita para el contenido**, que es la de la página de
derechos (**CC BY-SA 3.0**), y **no copiar** de la wiki ningún contenido hasta que exista
esa confirmación. Las obras derivadas de la wiki quedarían bajo CC BY-SA 3.0 con atribución
y compartición bajo la misma licencia; el catálogo generado solo desde los `.dbr` no
hereda esa obligación.

> **Constancia de derechos**: el arte del juego (iconos, retratos, fondos) es de Crate
> Entertainment y **no** está incluido en esta spec salvo lo que decida la enmienda 1.10.0
> (§VII) sobre iconos de habilidad y retratos de maestría, que el usuario ha pedido
> extender a los retratos en su último mensaje. Lo que sea dato factual del juego (nombre,
> tier, fila, padre, puntos máximos) se usa como hecho con atribución; **no** se versionan
> `.dbr`, `.arc` ni traducciones del juego.

## 1. Resumen y valor

Hoy cada guía dibuja sus propios nodos: `skill_nodes` vive dentro del documento de build
(`packages/domain/src/schema.ts:288`), con `layout.x/y` editoriales en píxeles y un solo
`parent_slug`. No existe un **árbol canónico por maestría**, así que el sitio no puede
mostrar «el árbol de Soldado» de forma visual, ni comparar builds sobre una misma rejilla,
ni ofrecer un planner estilo Maxroll.

Esta feature añade el **catálogo de árboles de maestría**: un dato canónico por maestría
(nodos, rejilla, conexiones, tier, rango máximo, nombres EN/ES) derivado de los `.dbr` de
la copia legal del juego, verificado y versionado, y un **render SVG propio** con estados
de nodo, accesibilidad y presupuesto. Las guías siguen existiendo como hoy; sus
`skill_nodes` pasan a **referenciar** el catálogo (una asignación sobre él) sin perder
compatibilidad.

## 2. Historias de usuario (priorizadas)

### US1 (P1) — Ver el árbol completo de una maestría

Como jugador, abro `/maestrias/soldado` y veo el árbol entero del Soldado con todas sus
habilidades, en la rejilla del juego, con su tier y su rango máximo, sin depender de una
guía concreta, también sin JavaScript.

**Por qué P1**: es el valor que hoy no existe y del que depende todo lo demás (planner,
comparador, árbol de guía sobre rejilla canónica). No necesita permisos de terceros: solo
hechos del juego y SVG propio.

**Prueba independiente**: con el catálogo cargado, la ruta prerenderiza el árbol de una
maestría y muestra un nodo por habilidad con su texto alternativo; el HTML contiene los
nodos sin ejecutar JavaScript.

**Escenarios**:

1. **Dado** que abro `/maestrias/soldado` con JS y sin JS, **cuando** carga, **entonces** veo
   el árbol completo de la maestría con sus nodos posicionados en la rejilla y navego con
   teclado por todos ellos.
2. **Dado** un nodo, **cuando** lo enfoco o lo leo con lector de pantalla, **entonces**
   anuncio su nombre, tier, rango máximo y de qué habilidad depende.

### US2 (P2) — Explorar catálogo entre maestrías

Como jugador, navego `/maestrias` y veo las diez maestrías con su retrato, número de
habilidades y enlace a su árbol, y cambio de una a otra sin recargar la página completa.

**Prueba independiente**: la página índice lista las diez maestrías desde el catálogo (no
desde una lista escrita a mano) y detecta una maestría añadida o quitada con solo cambiar
el dato.

**Escenarios**:

1. **Dado** el catálogo de diez maestrías, **cuando** abro `/maestrias`, **entonces** veo
   diez tarjetas con retrato y conteo real de habilidades.
2. **Dado** que una maestría no tiene árbol válido, **cuando** abro el índice, **entonces**
   aparece marcada como «sin datos» y no rompe la página.

### US3 (P3) — La guía se dibuja sobre el árbol canónico

Como lector de una guía, veo los nodos que sube el autor resaltados **sobre el mismo árbol
canónico** de la maestría, con sus puntos y su orden, en vez de un esquema propio de cada
guía.

**Prueba independiente**: una guía existente (Chamán + Demoledor) se renderiza desde sus
`skill_nodes` contra el catálogo, con los mismos nodos que hoy y sin cambios de contenido
editorial.

**Escenarios**:

1. **Dado** una guía con `skill_nodes`, **cuando** abro su página, **entonces** cada nodo
   de la guía apunta a un nodo del catálogo y el árbol se dibuja una sola vez por maestría.
2. **Dado** una guía con un nodo que ya no existe en el catálogo (versión distinta del
   juego), **cuando** valido, **entonces** falla la validación con el nodo y el motivo, y
   la guía no se publica en ese estado.

### Casos límite

- Maestría con más nodos de los que caben en el presupuesto de render (límite actual 120 en
  `skill-tree.ts:71`): debe representarse completa y seguir bajo presupuesto; si no cabe,
  decide el plan técnico (virtualización o pantalla dividida), nunca recortar datos.
- Habilidad sin posición en el `.dbr` (mods, contenido comunitario): entra como
  «sin posición» y no rompe la rejilla.
- Rejilla con huecos: el orden lo define el dato, no el azar del diccionario.
- Dos maestrías en una guía: dos árboles, dos rejillas, mismos componentes.
- Versión del juego distinta a la del catálogo: se declara en la página y la guía avisa.
- Nombres ES/EN ausentes: se muestra el idioma disponible con `lang` explícito y no se
  inventa traducción.

## 3. Requisitos

### Requisitos funcionales

- **FR-001** El sistema **DEBE** servir un catálogo de árboles de maestría versionado con
  la versión del juego de la que se derivó.
- **FR-002** El catálogo **DEBE** derivarse de los `.dbr` de la instalación local del juego
  (`records/skills/**`, `records/ui/skills/classXX/*.dbr`, `_classtree_*`, textos de
  localización) mediante un script reproducible, **sin** versionar ningún archivo del juego.
- **FR-003** Cada nodo **DEBE** declarar: `id` estable, nombre EN/ES, `tier` (nivel de barra
  requerido), fila y columna de rejilla, `max_points`, `parent_id` opcional, marca de
  habilidad circular/transmuter y `game_version`.
- **FR-004** El script de extracción **DEBE** registrar hash de los `.dbr` leídos y la
  versión del juego, y **DEBE** ser reproducible (misma entrada ⇒ mismo JSON, con las
  claves ordenadas).
- **FR-005** El catálogo **DEBE** validarse con un validador propio (`pnpm catalog:nodes`)
  con estas reglas: árbol acíclico, todo `parent_id` existe, `tier` monótono desde la raíz,
  `max_points` dentro del rango del juego, `id` único, rejilla sin colisiones y nombres no
  vacíos.
- **FR-006** Los campos **editoriales** (`status` recomendada/meta/omitir, `rationale`,
  `points_label`) **NO** se derivan del juego: se editan a mano y viven en el documento de
  guía, no en el catálogo.
- **FR-007** Si se usa la wiki como contraste, **DEBE** registrarse la licencia aplicada
  (CC BY-SA 3.0/4.0 según Q1), la URL de la revisión y la atribución; cualquier obra
  derivada **DEBE** compartirse bajo la misma licencia. Sin confirmación de la licencia, la
  wiki **NO** se copia.
- **FR-008** El render **DEBE** ser SVG propio, con un componente que reciba el árbol y la
  asignación y dibuje nodos, conexiones y estados, sin imágenes raster ni iconos oficiales
  fuera de la excepción de §VII.
- **FR-009** El render **DEBE** ser accesible WCAG 2.2 AA: un elemento enfocable por nodo,
  texto alternativo con nombre/tier/rango/dependencia, foco visible, contraste, y la
  información nunca solo por color (patrón además de color).
- **FR-010** Las páginas `/maestrias` y `/maestrias/<slug>` **DEBEN** prerenderizarse en
  inglés y español con `hreflang`, canonical y sitemap, como el resto del sitio.
- **FR-011** Las guías **DEBEN** poder transcribir **solo los datos** de un build de otra
  fuente (nodos, puntos, orden, devociones) con **enlace al autor y fecha de consulta**;
  **NUNCA** texto ni imágenes de la guía original.
- **FR-012** Una guía adaptada **NO** se publica sin `rights_status` que cubra esa
  transcripción; sin permiso queda como tarjeta _link-only_ con metadatos factuales.
- **FR-013** **NO** se copia ni se consume la base de datos de Grim Tools (sus términos lo
  prohíben); solo se enlaza.
- **FR-014** **NO** se versionan `.dbr`, `.arc`, textos de localización ni iconos del juego
  en el repositorio; solo el JSON derivado y los hashes de procedencia.
- **FR-015** La migración **DEBE** mantener compatibles las guías existentes: los
  `skill_nodes` conservan sus campos y ganan una referencia opcional al nodo del catálogo;
  ninguna guía publicada cambia de contenido al migrar.
- **FR-016** El catálogo **DEBE** alimentar también el modelo de dominio (`packages/domain`)
  con esquemas estrictos y pruebas de propiedad, sin duplicar la regla en web y API.
- **FR-017** El rendimiento **NO** puede empeorar los presupuestos de `plan.md` §6: la ruta
  de árbol entra en el presupuesto de JS inicial y la puerta de Lighthouse sigue en verde.

### Entidades clave

- **MasteryTree**: maestría con `slug`, nombres EN/ES, retrato (según enmienda §VII),
  `game_version`, y su lista de nodos.
- **SkillNode** (catálogo): `id` estable, `name_en`, `name_es`, `tier`, `grid {col,row}`,
  `max_points`, `parent_id`, `kind` (habilidad/modificador/transmuter/circular).
- **BuildSkillAssignment** (guía): `skill_node_id` + `points` + `status` + `rationale`, por
  maestría; sustituye a la posición editorial actual.

## 4. Criterios de éxito medibles

- **SC-001** Las **diez** maestrías del catálogo validan sin errores y sin nodos huérfanos.
- **SC-002** El script de extracción produce el **mismo JSON** en dos ejecuciones seguidas
  sobre la misma instalación (diff vacío).
- **SC-003** `/maestrias/<slug>` responde **200** en `/` y `/es` y su HTML prerenderizado
  contiene **el 100 %** de los nodos (comprobado contando nodos del JSON contra nodos del
  HTML).
- **SC-004** `axe` da **0 violaciones** critical/serious en las rutas nuevas, en inglés y
  español, con y sin JavaScript, en tres viewports.
- **SC-005** La puerta de rendimiento sigue verde y la ruta del árbol respeta el presupuesto
  de JS inicial de §6 sin ampliarlo.
- **SC-006** La licencia de la wiki aplicada queda **citada** con URL y revisión, o se
  declara explícitamente que no se ha usado.
- **SC-007** Una guía existente migra sin cambios visibles de contenido: diff del documento
  limitado a la nueva referencia.

## 5. Supuestos

- El usuario tiene el juego instalado y puede ejecutar el script de extracción en local.
- La API/PostgreSQL siguen siendo la fuente de verdad de producción; el catálogo se sirve
  por la misma vía que el resto del contenido (vistas públicas), no por un camino paralelo.
- Lo que decida la enmienda §VII sobre iconos/retratos aplica a la presentación; **si la
  enmienda no se aprueba**, el catálogo se publica con iconografía propia y sigue siendo
  válido (el fallback es requisito).

## 6. Preguntas abiertas (bloquean solo lo que indican)

- **Q1** Licencia de la wiki: el cuerpo dice **CC BY-SA 3.0**, el pie de página **CC BY-SA
  4.0**. ¿Aplicamos la 3.0 (la del cuerpo, más restrictiva y explícita) y no copiamos nada
  hasta confirmarlo? Bloquea FR-007 y la copia de coordenadas desde la wiki; **no** bloquea
  derivar desde los `.dbr`.
- **Q2** ¿El catálogo incluye solo las diez maestrías del juego base y DLC actual, o también
  maestrías de mods (que no tendrían posición oficial)? Propuesta: solo el juego oficial en
  v1, con hueco declarado para mods.
- **Q3** ¿Se permiten retratos de maestría como arte del juego (lo pediste en tu último
  mensaje) bajo la enmienda §VII, o esperamos a aprobarla? Bloquea la presentación del
  índice, no los datos.
