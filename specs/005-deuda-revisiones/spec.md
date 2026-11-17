# Feature Specification: Deuda aplazada de las revisiones de spec003 y spec004

**Feature Branch**: `005-deuda-revisiones` (planificación en `orq/11111619-ui-s5-plan`, base `orq/11111619` @ `fe77dd6`)

**Created**: 2026-11-16

**Status**: Implementada; puerta de cierre T018 en curso (2026-11-17). Clarificada por Paco (2026-11-16: P23–P27 = A; P28–P31; 2026-11-17: P32 y aceptación de las referencias visuales de 17,7 MB; ver «Clarifications»).

**Depende de**: `003-catalogo-arboles-maestria` y `004-rediseno-ui-grim-dawn` (ambas cerradas con la puerta de `002-spec-completion-reviews` en `passed`).

**Input**: Decisiones de Paco (2026-11-16): (1) una spec que recoja la deuda aplazada en las puertas de cierre. De spec004, `specs/004-rediseno-ui-grim-dawn/reviews/deuda.md` (S4-D1 a S4-D7, con S4-D1 primero). De spec003, S3-T042, S3-T043 y los aplazados A-01, A-03 y C-003 (de `reviews/` de spec003 y del registro de la corrida). (2) Nuevo alcance: la marca pública del sitio es **«Grim Builds»** (historia US6). (3) Nuevo alcance: verificación visual, una revisión de fidelidad con visión y una regresión visual en CI (historias US7 y US8).

## Contexto

Las dos specs anteriores se cerraron con hallazgos LOW (y algún MEDIUM) **aplazados con motivo**: ninguno cambia lo que ve el visitante hoy, pero cada uno deja una puerta, un contrato o un trozo de código más frágil de lo debido. Esta spec los convierte en trabajo planificado, sin ampliar el producto: no hay pantallas nuevas, ni modelo de guías nuevo, ni reglas de derechos nuevas. La única adición de producto es el **nombre público de la marca** («Grim Builds»), que Paco decidió el 2026-11-16 y que cierra el único punto «pendiente de Paco» de `apps/web/PRODUCT.md`.

Cada elemento se **reprodujo o localizó en el código actual** antes de planificarlo (evidencia en [research.md](research.md), con archivo y línea). Un elemento que ya no aplica se saca con su motivo (ver «Fuera de alcance»).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La puerta de crédito falla cuando no tiene nada que comprobar (Priority: P1)

Quien publica una versión necesita que las puertas de crédito a Crate (retratos e iconos de habilidad) **fallen** si el artefacto no tiene lo que deben comprobar, en lugar de pasar sin haber mirado nada. Hoy, si falta la carpeta de páginas prerrenderizadas o no hay ninguna página HTML, ambas salen sin error: un artefacto roto o incompleto «cumple» el crédito.

**Why this priority**: es la única deuda que afecta a una **puerta de derechos** (constitución §VII): un falso verde en una puerta es peor que no tener puerta. Además las dos comprobaciones son copias casi literales, así que arreglar una sola dejaría la otra igual. Va primero por decisión de Paco.

**Independent Test**: con un artefacto de prueba sin carpeta de páginas y otro con carpeta pero sin ningún HTML, ambas puertas fallan con un mensaje que dice qué falta; con un artefacto válido siguen pasando como hoy.

**Acceptance Scenarios**:

1. **Given** un artefacto sin carpeta de páginas, **When** corren las puertas de crédito de retratos y de iconos, **Then** cada una falla nombrando la carpeta ausente.
2. **Given** una carpeta de páginas sin ningún HTML, **When** corren las puertas, **Then** fallan nombrando que no hay páginas.
3. **Given** un artefacto válido con crédito donde hay arte del juego, **When** corren las puertas, **Then** pasan igual que hoy (retratos, iconos, `game` y `own`).
4. **Given** un cambio futuro en las reglas de una de las dos puertas, **When** se edita, **Then** se edita en un solo lugar (la lógica común está compartida, no copiada).
5. **Given** la regla «y solo entonces» que documentan las puertas (el crédito solo debe aparecer con arte del juego), **When** se revisa, **Then** está probada con un caso que falla si se rompe, o se ha retirado del texto y del código.

---

### User Story 2 - El contrato entre el lanzador y el sembrador de contenido tiene una sola fuente (Priority: P2)

Quien mantiene el entorno local necesita que el lanzador (`scripts/`) y el sembrador (`apps/api`) compartan **un único contrato** (línea de éxito, ruta del contenido, lista de códigos de error), y que un error del sembrador llegue al lanzador con su código real. Hoy el contrato está repartido, la prueba importa código de `apps/api` desde `scripts/` por una vía que la comprobación de fronteras no ve, y la lista de códigos de error del lanzador omite diez códigos que el sembrador sí emite (`column`, `conflicting-resource`, `database-result`, `duplicate`, `fixture-read`, `owned-content`, `reference`, `table`, `environment` y `configuration-or-database`), de modo que esos fallos se reportan como un `Seed failed` genérico.

**Why this priority**: toca la capa de contenido y el arranque local; sin defecto visible, pero cada código nuevo del sembrador hoy exige acordarse de actualizar una copia a mano.

**Independent Test**: cada código de error que el sembrador y el *bootstrap* pueden emitir lo reconoce el lanzador y lo reenvía; añadir un código nuevo en la fuente única lo propaga sin tocar el lanzador; `check:boundaries` ve la dependencia.

**Acceptance Scenarios**:

1. **Given** cada código de error posible del sembrador y del *bootstrap*, **When** el lanzador procesa su salida de error, **Then** reenvía ese código tal cual (hoy los diez códigos citados caen en `Seed failed`).
2. **Given** el módulo compartido, **When** se importa desde `scripts/` y desde `apps/api`, **Then** ninguno de los dos importa código del otro y `check:boundaries` pasa.
3. **Given** una línea de éxito con el formato real que imprime el sembrador, **When** el lanzador la valida, **Then** la acepta; una línea ajena o truncada la rechaza.

---

### User Story 3 - El catálogo de maestrías tiene una sola definición de su lista pública y refleja las retiradas (Priority: P2)

Quien mantiene el catálogo necesita que la forma de la lista pública de maestrías esté definida **una vez** en el dominio y que la web la valide con esa definición (hoy la API la define en su propio módulo y la web la valida a mano campo a campo), y que una maestría **retirada** de las fixtures desaparezca de la base de datos de forma segura en vez de quedarse para siempre.

**Why this priority**: la duplicación de validación es el tipo de deriva que la constitución §VI prohíbe («una sola fuente de verdad»); la maestría fantasma es un residuo que crece con cada retirada. Sin defecto visible hoy.

**Independent Test**: una respuesta de lista inválida la rechazan igual la API y la web con la misma definición; sembrar un catálogo sin una maestría que antes estaba la quita de las tablas del catálogo, o falla cerrado y nombra el motivo si alguna guía la referencia.

**Acceptance Scenarios**:

1. **Given** la definición de la lista pública en el dominio, **When** la API la serializa y la web la lee, **Then** ambas usan esa misma definición y no queda ninguna copia manual de sus campos.
2. **Given** una respuesta con un campo extra, un `node_count` negativo o un `slug` inválido, **When** la web la valida, **Then** falla como falla hoy, con el mismo mensaje de error de usuario.
3. **Given** una maestría presente en la base y ausente de las fixtures, **When** se siembra el catálogo, **Then** se aplica la política de retirada decidida (Q-A = A) y el resultado es observable en una prueba con base de datos real.
4. **Given** esa maestría retirada tiene nodos referenciados por guías, **When** se siembra, **Then** la siembra no deja datos a medias (falla cerrada, sin borrado parcial) y el mensaje nombra la maestría y el motivo.

---

### User Story 4 - La interfaz de tarjetas y portada queda sin aristas (Priority: P3)

Quien usa un lector de pantalla, y quien mantiene los estilos y componentes, necesita cuatro arreglos pequeños de la capa de presentación de spec004: la tarjeta no anuncia su estado dos veces; los estilos globales de la lista de builds no alcanzan por accidente a las tarjetas proyectadas; la lista de la portada no usa un título (no único) como clave; la fecha larga se formatea en un solo lugar; y la tarjeta no declara un campo que nadie usa.

**Why this priority**: es lo más visible de la deuda, pero ninguno rompe nada hoy (el solape de CSS «hoy no tiene efecto visible»). Se hace después de las puertas y el contrato porque no las bloquea ni las desbloquea.

**Independent Test**: a 375 y 1280 px, EN y ES, las capturas de portada y catálogo son idénticas a las de antes; el árbol de accesibilidad de una tarjeta lee el estado una vez; `e2e:a11y` sigue en 0 violaciones; los presupuestos de §6 siguen en verde.

**Acceptance Scenarios**:

1. **Given** una tarjeta cuyo texto accesible ya incluye el estado, **When** un lector de pantalla la recorre, **Then** el estado se anuncia una sola vez.
2. **Given** los estilos de la lista de builds, **When** una tarjeta se proyecta dentro de una fila de la lista, **Then** esos estilos no la alcanzan (selector acotado a los hosts propios) y el comentario que lo afirma es verdad.
3. **Given** dos tarjetas «otras» de la portada con el mismo título, **When** se pinta la lista, **Then** cada una conserva su identidad (la clave es única).
4. **Given** las cuatro vistas que formatean una fecha larga en UTC, **When** se localiza una fecha, **Then** todas usan el mismo formateador y una misma política ante una fecha inválida.
5. **Given** la entrada de una tarjeta, **When** se revisa su tipo, **Then** no contiene el nombre de maestría que nadie dibuja.

---

### User Story 5 - Las reglas y las cifras de la documentación coinciden con el código (Priority: P3)

Quien incorpora trabajo nuevo necesita que la regla de las hojas de estilo globales con prefijo y la huella real de la tarea T052 de spec004 estén escritas donde se consultan, sin alterar el registro de una spec ya cerrada por error.

**Why this priority**: deuda documental pura; el riesgo es tocar artefactos de spec004 y dejar caducado su cierre (Q-D = A).

**Independent Test**: la regla y la huella están documentadas en el lugar decidido y `pnpm lint:md` pasa; el cierre de spec004 sigue válido (o se vuelve a ejecutar si Paco decide editarlo).

**Acceptance Scenarios**:

1. **Given** la regla «una hoja global solo puede llevar selectores con prefijo propio», **When** se busca, **Then** está en el documento decidido en Q-D (= A).
2. **Given** T052 de spec004, **When** se consulta su huella real, **Then** la lista de archivos coincide con lo que tocó.

---

### User Story 6 - El sitio se llama «Grim Builds» y dice que no es de Crate (Priority: P2)

Quien visita el sitio, en inglés o en español, ve siempre el mismo nombre público, **Grim Builds**, en la cabecera, el pie, los títulos de página y lo que ven buscadores y redes (metadatos SEO, Open Graph, datos estructurados), y ve un aviso claro de que el proyecto es independiente y **no está afiliado ni respaldado por Crate Entertainment ni por Grim Dawn**. Hoy el sitio usa el nombre del repositorio, «Grim Dawn Builds», que además sugiere afiliación con el juego; `apps/web/PRODUCT.md` lo deja «pendiente de Paco».

**Why this priority**: es una decisión de Paco ya tomada y es de derechos (constitución §VII: no afiliación) y de identidad; sin ella el resto del rediseño sigue con un nombre provisional. No bloquea las puertas ni los datos, por eso va después de S4-D1 y del contrato.

**Independent Test**: una prueba falla si cualquier cadena de marca del sitio (código, plantillas, `messages.en.xlf`, `messages.es.xlf`, metadatos, datos estructurados, imagen social, contenido visible de las fixtures) contiene «Grim Dawn Builds»; el HTML prerrenderizado de `/` y de `/es/` muestra «Grim Builds» en `<title>`, cabecera, pie y `og:site_name`, y el aviso de no afiliación en EN y ES.

**Acceptance Scenarios**:

1. **Given** cualquier página pública en EN o en ES, **When** se leen su `<title>`, `og:site_name`, `og:title` y JSON-LD (`WebSite`, `publisher`), **Then** la marca es «Grim Builds» y no queda «Grim Dawn Builds».
2. **Given** cualquier página pública, **When** se ve el pie, **Then** hay un aviso visible, en el idioma de la página, de que el sitio es independiente y no está afiliado ni respaldado por Crate Entertainment ni por Grim Dawn.
3. **Given** los catálogos de traducción EN y ES, **When** corre la paridad, **Then** todas las cadenas de marca y de aviso están en ambos y la paridad pasa sin excepciones nuevas para el aviso.
4. **Given** una mención del juego (por ejemplo «Skill icons from Grim Dawn, © Crate Entertainment»), **When** se revisa, **Then** se conserva: «Grim Dawn» sigue nombrando al juego; solo deja de ser parte de la marca del sitio.
5. **Given** `apps/web/PRODUCT.md` y `apps/web/DESIGN.md`, **When** se leen, **Then** la marca es «Grim Builds» y ya no queda «pendiente de Paco» para el nombre.

---

### User Story 7 - Un revisor con visión contrasta el sitio con su sistema de diseño (Priority: P3)

Quien decide si el sitio «parece de Grim Dawn y se usa como las guías de Maxroll» necesita una **revisión de fidelidad** hecha por un revisor con visión sobre capturas reales de las cinco rutas públicas (portada, catálogo, guía, índice de maestrías y maestría), en 375, 768 y 1280 px, en EN y ES, y en los estados del tooltip del árbol, contrastadas con `apps/web/DESIGN.md` y `apps/web/PRODUCT.md` y, cuando existan, con las capturas del propio juego que Paco guarda en `C:\Users\paco_\Pictures\gdb-referencias` (solo referencia: nunca se versionan ni se publican). El resultado es un informe de discrepancias y, para cada una que merezca arreglo, una tarea de corrección.

**Why this priority**: es la única comprobación de que el rediseño de spec004 se parece a lo que Paco pidió; hasta ahora solo se midió presupuesto y accesibilidad, no fidelidad visual.

**Independent Test**: el informe existe en `reviews/`, cubre las 30 combinaciones de ruta, ancho e idioma más los estados del tooltip, cita cada discrepancia con captura, regla de `DESIGN.md`/`PRODUCT.md` incumplida y severidad, y dice explícitamente si usó o no capturas del juego.

**Acceptance Scenarios**:

1. **Given** la carpeta de referencias del juego vacía o inexistente, **When** se hace la revisión, **Then** funciona igual, contrasta solo con `DESIGN.md` y `PRODUCT.md` y el informe declara que no hubo referencias del juego.
2. **Given** capturas del juego en esa carpeta, **When** se hace la revisión, **Then** se usan como referencia visual, ninguna se copia al repositorio ni al informe y el informe no las reproduce.
3. **Given** una discrepancia con el sistema de diseño, **When** se registra, **Then** lleva ruta, ancho, idioma, estado, captura (ruta local no versionada), regla incumplida, severidad y, si procede, la tarea de corrección propuesta.
4. **Given** el informe terminado, **When** el principal lo lee, **Then** las tareas de corrección propuestas están listas para incorporarse a `tasks.md` antes de la regresión visual.

---

### User Story 8 - Un cambio visual no deseado rompe el CI (Priority: P3)

Quien revisa un PR necesita que el CI **falle** si cambia, sin quererlo, el aspecto de las cinco rutas públicas, con referencias de captura versionadas, un entorno fijado (navegador, fuentes, ventana, idioma, fuente de activos propia) y una tolerancia que evite falsos positivos.

**Why this priority**: el rediseño de spec004 se protegió con presupuesto y accesibilidad, pero ningún test detecta que un cambio de CSS descoloque una tarjeta. Va al final de los cambios visuales para no regenerar las referencias.

**Independent Test**: en CI, con el artefacto prerrenderizado con `ASSET_SOURCE=own`, las 30 capturas coinciden con sus referencias dentro de la tolerancia; un cambio deliberado de CSS en una rama de prueba hace fallar la comprobación y nombra la ruta, el ancho y el idioma afectados.

**Acceptance Scenarios**:

1. **Given** el artefacto sin cambios visuales, **When** corre la regresión en CI, **Then** pasa en dos ejecuciones seguidas (determinista).
2. **Given** un cambio de CSS que mueve un elemento, **When** corre, **Then** falla y adjunta la captura esperada, la obtenida y la diferencia.
3. **Given** un cambio visual deseado, **When** se regeneran las referencias con el procedimiento documentado, **Then** la diferencia entre referencias queda en el PR para revisarla y el CI vuelve a pasar.
4. **Given** el procedimiento de actualización, **When** lo sigue una persona sin conocimiento previo, **Then** genera las referencias en el mismo entorno que el CI (no en su máquina), de modo que coinciden.

---

### Edge Cases

- `ASSET_SOURCE=own` con artefacto vacío: la puerta de crédito falla igual (Q-B = A); un artefacto sin páginas no puede ser un release válido en ningún modo.
- Una maestría retirada referenciada por una guía (`build_skill_nodes` apunta al nodo con `ON DELETE restrict`): no puede borrarse sin más; la siembra no debe dejar el catálogo a medias.
- Un código de error nuevo del sembrador que el lanzador no conoce: debe verse como código desconocido explícito, no como un fallo genérico silencioso.
- Fecha larga inválida o ausente en las cuatro vistas: la política es una sola (no cuatro).
- Dos tarjetas de la portada con el mismo título pero distinto destino.
- «Grim Dawn» como nombre del juego (créditos, avisos, descripciones de maestrías) es legítimo y se conserva; la prueba de marca distingue «Grim Dawn Builds» (marca antigua) de las menciones al juego.
- Los identificadores internos (slug `grim-dawn-builds` del autor, nombre del repositorio, rutas) no son marca visible y no cambian: cambiarlos rompería URLs y datos.

## Requirements *(mandatory)*

### Functional Requirements

#### Puertas de crédito (US1, S4-D1)

- **FR-001**: Las puertas de crédito de retratos y de iconos de habilidad MUST fallar, con un mensaje que nombre la causa, cuando el artefacto no tenga carpeta de páginas o la carpeta no contenga ninguna página HTML.
- **FR-002**: Las dos puertas MUST compartir una sola implementación parametrizada (patrón del arte, marcador de crédito, mensajes); la diferencia entre ambas MUST ser datos, no código copiado.
- **FR-003**: La regla de que el crédito solo aparece donde hay arte del juego MUST estar probada con un caso que falla si se rompe, o MUST retirarse del texto de las puertas y del código.
- **FR-004**: Con un artefacto válido, las puertas MUST comportarse exactamente como hoy en `game` y en `own` (sin cambios de salida).

#### Contrato lanzador–sembrador (US2, S3-T042 y S3-T043)

- **FR-005**: La línea de éxito, la ruta de contenido y la lista de códigos de error del sembrador y del *bootstrap* MUST vivir en un único módulo compartido que importen `scripts/` y `apps/api` sin que ninguno importe código del otro.
- **FR-006**: El lanzador MUST reenviar cualquier código de error que el sembrador o el *bootstrap* puedan emitir; la lista MUST derivarse del módulo compartido, no escribirse a mano.
- **FR-007**: Un fallo de sembrado cuyo código el lanzador no reconoce MUST fallar de forma explícita y distinguible (no como éxito, ni como el mensaje genérico).
- **FR-008**: `check:boundaries` MUST ver la dependencia compartida; la prueba del contrato MUST dejar de importar código de `apps/api` mediante un `node -e` opaco.

#### Catálogo de maestrías (US3, A-01 y C-003)

- **FR-009**: La definición de la entrada de la lista pública de maestrías (`id`, `slug`, `name`, `game_version`, `node_count`, sin campos extra) MUST vivir en `packages/domain` y MUST ser la que usen la API y la web.
- **FR-010**: La web MUST validar la lista pública con esa definición y MUST dejar de repetir sus campos a mano, conservando el error de usuario actual ante una respuesta inválida o duplicada.
- **FR-011**: La siembra del catálogo MUST aplicar la política de retirada decidida en Q-A (= A) a las maestrías que están en la base y no en las fixtures, de forma transaccional y sin dejar datos a medias.
- **FR-012**: Si una maestría retirada está referenciada por guías, la siembra MUST fallar cerrada nombrando la maestría y el motivo; MUST NOT borrar nada parcialmente.

#### Presentación (US4, S4-D2 a S4-D6)

- **FR-013**: Los estilos globales de la lista de builds MUST estar acotados a sus hosts propios, de modo que no alcancen a las tarjetas proyectadas; el comentario del archivo MUST ser cierto.
- **FR-014**: El estado de una tarjeta MUST anunciarse una sola vez a un lector de pantalla (Q-C = A: `aria-hidden` en el estado visible).
- **FR-015**: La lista de tarjetas «otras» de la portada MUST usar una clave única (`href`) en vez del título.
- **FR-016**: Las cuatro copias del formateador de fecha larga en UTC MUST sustituirse por un formateador común en `apps/web/src/app/shared/` con una sola política de validación.
- **FR-017**: El tipo de entrada de la tarjeta MUST dejar de declarar `masteries[].name` y sus usos en pruebas y en la portada MUST retirarse.

#### Documentación (US5, S4-D7)

- **FR-018**: La regla de hojas globales con prefijo MUST quedar escrita en el lugar decidido en Q-D (= A).
- **FR-019**: La huella real de T052 MUST corregirse en el lugar decidido en Q-D (= A).

#### Marca pública (US6)

- **FR-023**: El nombre público del sitio MUST ser «Grim Builds» en inglés y en español: cabecera, pie, `<title>` de todas las páginas (también el de `index.html`), `og:site_name`, `og:title`, texto alternativo de la imagen social, datos estructurados (`WebSite`, `publisher`) y la imagen social `og/site.svg`/`site.png`.
- **FR-024**: El sitio MUST mostrar en el pie de todas las páginas un aviso visible de que es independiente y no está afiliado ni respaldado por Crate Entertainment ni por Grim Dawn, en EN y ES, con paridad de `messages.en.xlf` y `messages.es.xlf`.
- **FR-025**: `apps/web/PRODUCT.md` y `apps/web/DESIGN.md` MUST usar «Grim Builds» y MUST dejar de marcar el nombre como «pendiente de Paco».
- **FR-026**: MUST existir pruebas que fallen si «Grim Dawn Builds» queda como marca en el código, las plantillas, los catálogos de traducción, los metadatos, el contenido visible de las fixtures, la imagen social o el HTML prerrenderizado.
- **FR-027**: Las menciones a «Grim Dawn» como nombre del juego (créditos de Crate, avisos de no afiliación, descripciones) MUST conservarse.
- **FR-028**: Los nombres de autor y de revisor visibles de las fixtures («Grim Dawn Builds» como `display_name`, `author_name`, `reviewed_by`) MUST pasar a «Grim Builds»; el slug `grim-dawn-builds` y las rutas MUST NOT cambiar.
- **FR-029**: Si el sitio publica un manifiesto de aplicación, MUST llevar el nombre nuevo; hoy no existe (`apps/web/public` no tiene manifiesto), así que MUST NOT crearse uno.

#### Verificación visual (US7, US8)

- **FR-030**: MUST existir un procedimiento reproducible que capture, con Playwright sobre el artefacto prerrenderizado, las cinco rutas públicas (`/`, `/tier-list`, `/builds/chaman-demoledor-golpe-primigenio`, `/maestrias`, `/maestrias/soldier`) en 375, 768 y 1280 px, en EN y ES, y los estados del tooltip del árbol (reposo, ratón, foco de teclado, fijado por toque y volteo en el borde), con salida fuera del control de versiones.
- **FR-031**: El informe de fidelidad MUST contrastar esas capturas con `apps/web/DESIGN.md` y `apps/web/PRODUCT.md`, usar las capturas de `C:\Users\paco_\Pictures\gdb-referencias` solo cuando existan, funcionar y declararlo cuando esa carpeta esté vacía, y MUST NOT copiar, versionar ni publicar ninguna captura del juego.
- **FR-032**: El informe MUST listar cada discrepancia con ruta, ancho, idioma, estado, regla incumplida y severidad, y proponer una tarea de corrección por cada una que deba arreglarse; el principal las incorpora a `tasks.md` antes de la regresión visual.
- **FR-033**: La regresión visual MUST usar `toHaveScreenshot` sobre las cinco rutas, en 375, 768 y 1280 px, en EN y ES, contra el artefacto construido con `ASSET_SOURCE=own`, con el navegador fijado por `package.json`, solo las fuentes locales del sitio, ventana de 900 px de alto, factor de escala 1, animaciones y cursor desactivados, `reducedMotion: reduce`, zona horaria UTC y la tolerancia fijada en `plan.md`.
- **FR-034**: Las referencias MUST estar versionadas en el repositorio fuera de `__screenshots__/` (ignorado), MUST generarse solo en un entorno Linux equivalente al del CI (Ubuntu 24.04, la misma versión de Playwright y el mismo Node): el flujo manual `visual-baselines` de GitHub o, por decisión de Paco (2026-11-17), el contenedor Docker local `mcr.microsoft.com/playwright:v1.65.0-noble` (`scripts/visual-baselines-docker.sh`), nunca con un navegador nativo de Windows o macOS, y MUST ser actualizables con un procedimiento documentado que deje la diferencia visible en el PR.
- **FR-035**: La regresión visual MUST correr en el CI de PR como un trabajo propio y paralelo a la verificación, sin alterar el artefacto que miden las demás puertas.
- **FR-036**: La regresión MUST fallar con un mensaje que nombre la ruta, el ancho y el idioma, y adjuntar esperada, obtenida y diferencia.
- **FR-037**: La regresión MUST ejecutarse después de la marca (T015) y de todos los cambios visuales de S4-D* y de las correcciones de la revisión de fidelidad, para no regenerar las referencias.
- **FR-038**: Cuando una guía no tenga contenido en el idioma de la página (hoy, la guía solo está en español y la página es EN), la página MUST mostrar al inicio un aviso visible («This guide is only available in Spanish»), MUST marcar el contenido con `lang="es"` y su tarjeta (portada y catálogo) MUST usar los nombres de maestría del idioma de la página; MUST NOT traducirse el contenido en esta spec. Decisión de Paco P28 = A (2026-11-16). Corrige F-02.
- **FR-039**: Cada maestría MUST tener un único nombre en cada idioma, con una sola fuente de la que lean el árbol, el catálogo, los chips, los filtros, las combinaciones y las etiquetas de icono; MUST existir una prueba que falle si dos fuentes difieren. El nombre ES de Nightblade es «Hoja de la Noche» (el del juego; decisión de Paco P31, 2026-11-16). Los identificadores internos (slug `filo-nocturno`, id y archivo del icono) MUST NOT cambiar. Corrige F-20.
- **FR-040**: Las maestrías sin árbol (Berserker, Oathkeeper, Inquisitor y Necromancer) MUST mostrar «árbol no disponible» (EN y ES) sin enlace allí donde el sitio enlazaría un árbol, y toda maestría enlazada MUST abrir un árbol. Decisión de Paco P29 = A (2026-11-16). Corrige F-19.

#### Transversales

- **FR-020**: Ninguna tarea MUST cambiar el comportamiento visible de las páginas públicas (salvo la marca y el aviso de US6, T015 y T014, y las correcciones de fidelidad de US7 que Paco aceptó, FR-038 a FR-040 y T020–T033), los presupuestos de §6 (`/tier-list` cerró spec004 con 111 206/112 000 B de JS inicial, 794 B de margen; la línea base se vuelve a medir en T008 y, tras las correcciones de US7, la fija la decisión P32: ver SC-008), la CSP, la paridad EN/ES ni las reglas de derechos; cualquier regresión de presupuesto bloquea la tarea.
- **FR-021**: Cada tarea MUST empezar por una prueba que falla (constitución IX) y MUST registrar comando y salida reales al marcarse.
- **FR-022**: spec005 MUST numerar sus propias tareas desde T001 y MUST NOT reabrir ni editar `tasks.md`, `plan.md` ni `spec.md` de spec003 o spec004 salvo lo que decida Q-D (el cierre de spec004 está hecho sobre un snapshot).

### Key Entities

- **Entrada de la lista pública de maestrías**: una maestría con su identificador, su `slug`, su nombre en inglés y español, la versión del juego y su número de nodos. Hoy se define en la API y se revalida a mano en la web; pasa a una definición única en el dominio.
- **Contrato lanzador–sembrador**: línea de éxito de cada operación (`seed`, `bootstrap`), ruta de montaje del contenido y conjunto cerrado de códigos de error con su significado.
- **Marca pública**: el nombre «Grim Builds» y su aviso de no afiliación; aparece en el código, los catálogos de traducción, los metadatos y el contenido visible.
- **Maestría del catálogo (retirada)**: una maestría presente en la base y ausente en las fixtures; su ciclo de vida lo fija Q-A = A.
- **Entrada de tarjeta de build**: los datos que pinta `gd-build-card`, sin el nombre de maestría que no se dibuja.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el artefacto vacío (sin carpeta de páginas o sin ningún HTML), el 100 % de las puertas de crédito terminan con error y mensaje (hoy 0 de 2).
- **SC-002**: El número de códigos de error del sembrador y del *bootstrap* que el lanzador reenvía con su código real pasa de los 8 actuales a todos los emitidos (los diez omitidos hoy incluidos), con una prueba que enumera el conjunto y falla si se añade uno sin reenviar.
- **SC-003**: Una definición única de la lista pública de maestrías: 0 copias manuales de sus campos fuera de `packages/domain` (hoy 2 definiciones).
- **SC-004**: Tras sembrar un catálogo sin una maestría previamente sembrada, 0 filas fantasma de esa maestría en las tablas del catálogo (o un fallo cerrado nombrado si hay guías que la usan), comprobado contra una base real.
- **SC-005**: El estado de una tarjeta se anuncia 1 vez (hoy 2).
- **SC-006**: Las copias del formateador de fecha larga bajan de 4 a 1.
- **SC-007**: `pnpm verify` sale con 0, `e2e:a11y` mantiene 0 violaciones de axe y las capturas a 375 y 1280 px, EN y ES, son idénticas a las de antes de spec005.
- **SC-010**: El informe de fidelidad cubre las 30 combinaciones de ruta, ancho e idioma y los estados del tooltip, y 0 capturas del juego se versionan (comprobado con `git ls-files`).
- **SC-011**: La regresión visual compara 30 capturas, pasa en dos ejecuciones consecutivas sin cambios y falla con un cambio deliberado. Por decisión de Paco (2026-11-17) las referencias se generaron, y las dos pasadas verdes y la roja se ejecutaron, en contenedores Docker locales equivalentes al CI (T017); la **primera ejecución del trabajo `visual-regression` y del flujo `visual-baselines` en GitHub queda pendiente** hasta que Paco permita el push, y se anota como seguimiento, no como cumplida.
- **SC-008**: `/tier-list` no supera los 112 000 B de JS inicial ni baja del margen de HTML medido en T008; el resto de rutas conserva su margen. La base de JS de `/tier-list` ya no es la de spec004 (111 206 B, margen 794 B): con T020–T031 Paco aceptó 111 292 B (Pregunta 32, 2026-11-17); al cierre de T018 la medición era 111 251 B y, tras T037, **111 343 B** (margen 657 B). Paco aceptó el 2026-11-17 (ronda 2 de T018, B-08) **111 343 B como nueva base** de SC-008 y de P32, sin cambiar el límite de 112 000 B. La corrección de T052 frente a F-002 en T040 (descripción con `aria-describedby`) añade 60 B: **111 403 B** (margen 597 B), medidos con el `pnpm build` raíz; Paco la aceptó el 2026-11-17 como base vigente: **111 403 B (margen 597 B), aceptada por Paco el 2026-11-17**.
- **SC-009**: 0 apariciones de «Grim Dawn Builds» como marca en el código, los catálogos EN/ES, las fixtures visibles, la imagen social y el HTML prerrenderizado (hoy 39 archivos fuera de `specs/` contienen la cadena; los históricos de README, CONTRIBUTING y docs quedan fuera de alcance), y el aviso de no afiliación presente en las rutas de EN y ES.

## Fuera de alcance

- **A-03 de spec003 (doble fuente del estado de los activos)**: ya resuelto por spec004 T005 (`assertAssetStatusParity`, `scripts/check-assets.mts:118`, ejecutada por `runRelease` en `scripts/build-release.mts:87`; el manifiesto manda y el build de release falla cerrado si la tabla `assets` discrepa). Evidencia completa en [research.md](research.md) §R8.
- Corregir las discrepancias que encuentre la revisión de fidelidad: cada una será su propia tarea, decidida por el principal tras el informe.
- Cambios de producto distintos de la marca: pantallas, tipografía, tokens, rutas, contenido editorial o reglas de derechos.
- Renombrar el repositorio, el paquete, el slug `grim-dawn-builds` o los documentos históricos o de ingeniería (specs 001–004 y los documentos históricos; el título de la constitución, README y CONTRIBUTING sí cambian de marca por la enmienda 1.11.1, T019, aprobada por Paco el 2026-11-16), que citan el nombre del repositorio y no son marca visible.
- Los hallazgos de spec003 y spec004 ya corregidos o con otra disposición (T035–T041 de spec003, T047–T054 de spec004).
- El Q11 (publicación de iconos) y sus riesgos: cerrados en spec004 con la enmienda 1.11.0.

## Clarifications

### Session 2026-11-16

- Q: (Q-A, Pregunta 23, C-003) ¿Qué hace la siembra con una maestría retirada de las fixtures? → A: A, borrar nodos y maestría en la misma transacción y fallar cerrado si alguna guía referencia sus nodos.
- Q: (Q-B, Pregunta 24, S4-D1) ¿Las puertas de crédito fallan con artefacto vacío también con `ASSET_SOURCE=own`? → A: A, sí, en los dos modos.
- Q: (Q-C, Pregunta 25, S4-D3) ¿Cómo se evita el doble anuncio del estado de la tarjeta? → A: A, `aria-hidden` en el estado visible porque el texto accesible del enlace ya lo incluye.
- Q: (Q-D, Pregunta 26, S4-D7) ¿Dónde se documenta la regla de hojas globales y la huella de T052? → A: A, en un documento vivo (`apps/web/DESIGN.md`) y como nota en `specs/005-deuda-revisiones/reviews/`, sin editar spec004 (su snapshot de cierre sigue válido).
- Q: (Q-E, Pregunta 27, S3-T043) ¿Dónde vive el módulo del contrato lanzador–sembrador? → A: A, en `packages/domain` como entrada propia.
- Decisión de alcance (Paco, 2026-11-16, sin pregunta): la marca pública es «Grim Builds» (US6, FR-023 a FR-029).
- Decisión de alcance (Paco, 2026-11-16, sin pregunta): verificación visual con una revisión de fidelidad (US7) y una regresión visual en CI (US8), FR-030 a FR-037.
- Q: (P28, F-02) ¿Qué se hace con la guía solo en español en las páginas EN? → A: A, aviso visible «This guide is only available in Spanish», `lang="es"` en el contenido y nombres EN de maestría en la tarjeta, sin traducir (FR-038; T023).
- Q: (P30) ¿Qué correcciones de la revisión de fidelidad van antes de T017? → A: A, HIGH y MEDIUM (F-01 a F-15 y F-20) y las LOW por ser baratas (F-16 a F-19); las sugerencias S-01 a S-04 quedan como deuda anotada sin ID en `reviews/fidelity.md` (T020–T033).
- Q: (P31, F-20) ¿Nombre oficial ES de Nightblade? → A: «Hoja de la Noche», el del juego, con una sola fuente de nombres ES (FR-039; T024).
- Q: (P29, F-19) ¿Qué se hace con las maestrías sin árbol? → A: A, las cuatro de expansión muestran «árbol no disponible» sin enlace (FR-040; T033, antes de T017).
- Decisión de Paco (2026-11-17, T017): las 30 referencias visuales se generan en Docker local equivalente al CI y no en GitHub (FR-034, SC-011); la primera ejecución en GitHub queda pendiente.
- Q: (P32) ¿Se acepta el coste de JS de las correcciones de US7 en `/tier-list`? → A: sí, 111 292 B como base de SC-008 (el presupuesto de 112 000 B no cambia; medido al cierre de T018: 111 251 B). **Actualizada el 2026-11-17 (decisión de Paco, ronda 2 de T018, B-08): la base pasa a 111 343 B, medidos tras T037 (+92 B por el título del panel de filtros), margen 657 B; el límite de 112 000 B no cambia.**
- Decisión de Paco (2026-11-17): se aceptan los 17,7 MB (17 668 946 B) de las 30 referencias visuales; el plan estimaba 3–8 MB.
- Decisión del principal (2026-11-17, opción A): se corrigen todos los hallazgos de la ronda 1 de la puerta T018 en cuatro tareas, T036–T039 (`tasks.md`, Fase 10).

## Assumptions

- La carpeta `C:\Users\paco_\Pictures\gdb-referencias` está hoy vacía; la revisión de fidelidad no la necesita para funcionar.
- El CI de PR corre en `ubuntu-24.04`; las referencias visuales se generan allí.
- El artefacto con `ASSET_SOURCE=own` no lleva los PNG del juego, así que la regresión no depende de activos que el repositorio no versiona.
- Los presupuestos de §6, la CSP, la paridad EN/ES y la constitución 1.11.1 siguen vigentes sin cambios.
- Las especificaciones 003 y 004 permanecen cerradas; cualquier cambio en sus artefactos requiere decisión de Paco (Q-D).
- Las pruebas con base de datos real corren en CI (los `*.int.spec.ts`); en local las tareas que las necesiten usan el Postgres del entorno de la corrida o dejan constancia de que solo corren en CI.
- Con `pnpm verify` completo, el único fallo tolerado es el TBT de Lighthouse; en ese caso se repite `pnpm check:performance` sola y se citan las cifras.
- Las cuatro copias del formateador de fecha (`home.page.ts:36`, `build-summary.ts:82`, `build-attribution.ts:74`, `source-attribution.ts:57`) siguen separadas en el HEAD de esta rama.
