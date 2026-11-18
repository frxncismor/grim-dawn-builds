# Feature Specification: Deuda aplazada de las revisiones de spec004 y spec005 (segunda tanda)

**Feature Branch**: `006-deuda-revisiones-2` (planificación en `orq/11111619-ui-s6-plan`, base `orq/11111619` @ `cc553c3`)

**Created**: 2026-11-17

**Status**: Planificada (2026-11-17). Clarificada por Paco: P33 = A; P34 = a, b y d incluidos, c fuera (ver «Clarifications»).

**Depende de**: `005-deuda-revisiones` (cerrada con la puerta de `002-spec-completion-reviews` en `passed`, `cc553c3`).

**Input**: Decisión de Paco (2026-11-17): una spec que recoja (1) S4-D1 como prioridad, con un helper único que falle cerrado en todas las puertas afectadas; (2) S4-D2 a S4-D7 de `specs/004-rediseno-ui-grim-dawn/reviews/deuda.md`; (3) L1 de `specs/005-deuda-revisiones/reviews/deuda.md` (ids estables en `build-card`); (4) L2 a L4 de spec005; (5) el to-do 134 (base de `/tier-list` de 111 403 B ya aceptada y fila de spec005 en `specs/README.md`); (6) valorar F-002, S-001, S3-T042, S3-T043 y la mediana de `coldStartMs` (to-do 117). Fuera de alcance: cualquier rediseño visual.

## Contexto

spec005 ya convirtió en trabajo hecho buena parte de la deuda que esta petición cita: S4-D1 a S4-D7 (spec005 T001 y T008–T013) y S3-T042/S3-T043 (spec005 T002–T004). Cada elemento se **volvió a localizar en el código de `cc553c3`** antes de planificarlo (evidencia con archivo y línea en [research.md](research.md)). Lo que sigue abierto es:

- **S4-D1, resto**: las dos puertas de crédito ya fallan en vacío, pero la puerta «sin arte del juego con `ASSET_SOURCE=own`» (`assertNoGamePortraits`) **pasa** si falta el artefacto, y la comprobación «el artefacto tiene páginas» está escrita dos veces con criterios distintos (puertas de crédito: ≥ 1 página; puerta de marca: más de un mínimo). No hay un helper único.
- **L1 a L4** de la ronda 3 de spec005.
- **To-do 134** y textos de estado caducos en `specs/README.md`.
- Tres aplazados del punto 6 que Paco incluye (P34): F-002, S-001 y la mediana de `coldStartMs`.

Esta spec no añade producto: no hay pantallas, rutas, cadenas visibles ni estilos nuevos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ninguna puerta sobre el artefacto prerrenderizado pasa en vacío (Priority: P1)

Quien publica una versión necesita que **todas** las puertas que inspeccionan las páginas prerrenderizadas fallen, con un mensaje que diga qué falta, si el artefacto no existe o no tiene páginas, en lugar de dar un verde sin haber mirado nada. Hoy la puerta que impide publicar arte del juego con la fuente de activos propia pasa con un artefacto ausente, y las demás repiten cada una su propia comprobación de «artefacto vacío» con criterios distintos.

**Why this priority**: es una puerta de derechos (constitución §VII): un falso verde en una puerta es peor que no tener puerta. Primera por decisión de Paco.

**Independent Test**: con un artefacto sin carpeta de páginas y otro con carpeta pero sin ninguna página, cada puerta afectada termina con error y un mensaje que nombra la puerta y la causa; con un artefacto válido todas dan la misma salida que hoy.

**Acceptance Scenarios**:

1. **Given** un artefacto sin carpeta de páginas, **When** corre cualquiera de las cuatro puertas afectadas (P33 = A: las dos de crédito, la de arte del juego con fuente propia y la de marca), **Then** falla nombrando la carpeta ausente y la puerta.
2. **Given** una carpeta de páginas sin ninguna página, **When** corren, **Then** fallan nombrando que no hay páginas.
3. **Given** la puerta «sin arte del juego» con la fuente de activos propia y un artefacto ausente, **When** corre, **Then** falla (hoy pasa).
4. **Given** un artefacto válido, **When** corren las puertas, **Then** su resultado y sus mensajes son los de hoy en los dos modos de activos.
5. **Given** un cambio futuro en el criterio de «artefacto vacío», **When** se edita, **Then** se edita en un solo lugar.

---

### User Story 2 - El HTML prerrenderizado de las tarjetas es determinista (Priority: P2)

Quien compara dos builds del sitio (por ejemplo, el de fixtures frente al de la API) necesita que la misma página produzca el mismo HTML. Hoy el identificador que enlaza el título de una tarjeta con su descripción accesible sale de un contador global, así que depende del orden de render y del reparto de rutas entre procesos.

**Why this priority**: no cambia lo que ve ni lo que oye el visitante, pero un HTML no determinista invalida las comparaciones de artefactos y es la única deuda abierta de spec005 con efecto en el código.

**Independent Test**: dos renders de la misma tarjeta, y dos builds del sitio, dan el mismo identificador; en cada página los identificadores siguen siendo únicos y la descripción accesible se sigue leyendo.

**Acceptance Scenarios**:

1. **Given** la misma tarjeta renderizada dos veces (en orden distinto o en otro proceso), **When** se lee su identificador de descripción, **Then** es el mismo y deriva del contenido de la tarjeta.
2. **Given** cualquier página pública con varias tarjetas, **When** se comprueba el HTML, **Then** no hay identificadores duplicados.
3. **Given** una tarjeta cuya combinación está en el idioma del contenido, **When** un lector de pantalla llega al enlace, **Then** la combinación se anuncia como descripción, igual que hoy.
4. **Given** el comentario de la tarjeta que dice «sin estado», **When** se revisa, **Then** es cierto.

---

### User Story 3 - El código y las pruebas de la tarjeta dicen lo que hace la tarjeta (Priority: P3)

Quien mantiene la tarjeta necesita que los comentarios sobre el texto oculto de la combinación describan el comportamiento actual (descripción accesible enlazada, no texto oculto leído antes), que no quede una rama de plantilla que no se ejecuta nunca, y que una prueba de navegador compruebe la descripción accesible.

**Why this priority**: LOW; solo comentarios, una rama muerta y una prueba que falta, pero dejan pistas falsas en el componente más sensible al presupuesto.

**Independent Test**: una prueba de navegador sobre el catálogo y la portada, en EN y ES, verifica que el enlace de la tarjeta tiene una descripción accesible con la combinación cuando corresponde, y que no la tiene cuando no; los comentarios citan el mecanismo real.

**Acceptance Scenarios**:

1. **Given** una tarjeta EN de una guía solo en español, **When** se inspecciona en el navegador, **Then** su enlace tiene descripción accesible con la combinación en `lang="es"`.
2. **Given** una tarjeta sin combinación en otro idioma, **When** se inspecciona, **Then** su enlace no tiene descripción accesible.
3. **Given** la rama de tarjeta sin enlace, **When** se revisa, **Then** no contiene código que ninguna entrada real pueda ejecutar, o una prueba demuestra que sí se ejecuta.

---

### User Story 4 - El registro SDD dice el estado real (Priority: P3)

Quien retoma el proyecto necesita que los artefactos de spec005 y `specs/README.md` reflejen las decisiones ya tomadas: la base de `/tier-list` de **111 403 B** está aceptada por Paco (no «pendiente de confirmación»), la nota de T040 no se contradice, spec004 y spec005 están cerradas con su puerta en `passed`, y S3-T042/S3-T043 están resueltos por spec005.

**Why this priority**: deuda documental pura; sin riesgo de producto.

**Independent Test**: una búsqueda de «pendiente de confirmación» asociada a la base de `/tier-list` en los artefactos de spec005 no devuelve nada; `specs/README.md` muestra spec004 y spec005 cerradas con su commit; `pnpm lint:md` pasa.

**Acceptance Scenarios**:

1. **Given** `spec.md`, `plan.md`, `quickstart.md` y `tasks.md` de spec005, **When** se lee la base de `/tier-list`, **Then** dice 111 403 B aceptada por Paco el 2026-11-17, sin «pendiente».
2. **Given** la nota de T040 en `tasks.md` de spec005, **When** se lee, **Then** no dice a la vez «pendiente» y «resuelta» sobre el mismo fallo.
3. **Given** `specs/README.md`, **When** se leen las filas de spec004 y spec005, **Then** dicen cerradas con la puerta `passed` y su commit, y la sección de spec003 ya no lista S3-T042/S3-T043 como aplazados.
4. **Given** `specs/README.md`, **When** se busca spec006, **Then** tiene su fila con el estado real.

---

### User Story 5 - Deuda de datos, seguridad local y rendimiento de la API (Priority: P3)

P34 (Paco, 2026-11-17) incluye tres subelementos: F-002 (poda de nodos del catálogo antes de reescribir las guías), S-001 (el contenedor de referencias visuales ve el repositorio entero, secretos locales incluidos) y la mediana de 3 arranques para el presupuesto de arranque en frío de la API (to-do 117).

Quien mantiene el entorno local necesita que una siembra que retira un nodo usado por una guía en la misma pasada no falle con un error genérico; que el contenedor de referencias visuales no vea `.env*` ni `infra/docker/secrets/`, como ya promete `CONTRIBUTING`; y que el presupuesto de arranque en frío de la API no falle por un único arranque lento en una máquina cargada.

**Why this priority**: LOW en sus revisiones; ninguno afecta al producto ni a CI hoy.

**Independent Test**: por subelemento: (F-002) con Postgres real, una siembra que quita un nodo del catálogo y a la vez deja de usarlo en la guía termina bien, y una que lo quita sin dejar de usarlo falla nombrando el nodo o la maestría; (S-001) dentro del contenedor no existe ningún archivo ignorado como secreto; (coldStart) la prueba toma 3 arranques y compara su mediana con el umbral de 5000 ms.

**Acceptance Scenarios**:

1. **Given** (F-002) una maestría conservada pierde un nodo que una guía deja de usar en la misma siembra, **When** se siembra, **Then** termina bien.
2. **Given** (F-002) el nodo retirado sigue usado por una guía, **When** se siembra, **Then** falla cerrado, sin cambios parciales, con un código de la unión y el id afectado.
3. **Given** (S-001) el procedimiento documentado de referencias visuales, **When** corre el contenedor, **Then** ni `.env`, ni `.env.*`, ni `infra/docker/secrets/` son legibles dentro, y un nombre de archivo con `[`, `]`, `*` o `?` se trata literalmente.
4. **Given** (coldStart) un arranque lento aislado entre 3, **When** corre la prueba de rendimiento, **Then** pasa si la mediana cumple el umbral; si la mediana no lo cumple, falla igual que hoy.

---

### Edge Cases

- Fuente de activos distinta de `game` y `own`: las puertas de crédito no deciden nada hoy; la comprobación de artefacto vacío se aplica igual en las puertas afectadas que inspeccionan páginas sin depender del modo (la de marca), y solo en `own` en la de arte del juego (en `game`, `assertGameAssets` responde por el manifiesto).
- Artefacto con la carpeta de páginas como enlace simbólico o como archivo: falla cerrado como «artefacto inválido», nunca pasa.
- Dos tarjetas con el mismo contenido en la misma página (la misma guía en dos listas): el identificador debe seguir siendo único en la página.
- Tarjeta sin enlace (combinación sin guía) y tarjeta externa: el identificador sale de su clave estable, no del título visible.
- Editar artefactos de spec005 desfasa el snapshot de su puerta: es esperado (el snapshot cubre todo el repositorio y caduca con cualquier cambio posterior); la puerta cerrada no se vuelve a ejecutar.
- Un nombre de archivo con comodines en la lista de exclusión del contenedor (S-001, si entra).

## Requirements *(mandatory)*

### Functional Requirements

#### Puertas sobre el artefacto (US1, S4-D1)

- **FR-001**: MUST existir una sola comprobación de «el artefacto prerrenderizado existe y tiene páginas» que termine con error y un mensaje que nombre la puerta y la causa (carpeta ausente, carpeta inválida o sin páginas).
- **FR-002**: Las cuatro puertas que leen las páginas prerrenderizadas (P33 = A: crédito de retratos, crédito de iconos de habilidad, «sin arte del juego» con fuente propia y marca antigua) MUST usar esa comprobación y MUST NOT conservar una copia propia del criterio de vacío; el mínimo de páginas de la puerta de marca MUST pasar como parámetro. Las puertas que ya fallan cerrado con otra unidad (comparación de builds, huella del release, escaneo de secretos, JS inicial, rendimiento) MUST NOT cambiar.
- **FR-003**: La puerta que impide arte del juego con la fuente de activos propia MUST fallar con un artefacto ausente o sin páginas.
- **FR-004**: Con un artefacto válido, cada puerta MUST conservar su resultado y sus mensajes actuales en `game` y en `own`.
- **FR-005**: Cada puerta afectada MUST tener pruebas de artefacto ausente y de artefacto sin páginas que fallan antes del cambio cuando hoy pasa en vacío.

#### Tarjeta de build (US2 y US3, L1 a L3)

- **FR-006**: El identificador de la descripción accesible de una tarjeta MUST derivarse de una clave estable de su contenido (guía, entrada del catálogo o destino), MUST ser igual en dos renders de la misma tarjeta y MUST ser único en cada página pública.
- **FR-007**: MUST NOT quedar estado de módulo en la tarjeta; su documentación MUST describir el componente tal cual es.
- **FR-008**: Los comentarios sobre el texto accesible de la combinación MUST describir el mecanismo actual (descripción enlazada) y MUST retirarse la rama de plantilla que no ejecuta ninguna entrada real, o probarse que se ejecuta.
- **FR-009**: MUST existir una prueba de navegador que compruebe la descripción accesible de la tarjeta en EN y ES (con y sin combinación en otro idioma).
- **FR-010**: Ninguna tarea MUST cambiar lo visible, el nombre accesible de las tarjetas, la paridad EN/ES, la CSP ni las capturas de la regresión visual; `/tier-list` MUST seguir ≤ 112 000 B de JS inicial (base aceptada 111 403 B, margen 597 B).

#### Registro SDD (US4, L4 y to-do 134)

- **FR-011**: La base de `/tier-list` MUST figurar como 111 403 B aceptada por Paco el 2026-11-17 en `spec.md`, `plan.md`, `quickstart.md` y `tasks.md` de spec005, sin «pendiente de confirmación».
- **FR-012**: La nota de T040 en `tasks.md` de spec005 MUST dejar de contradecirse.
- **FR-013**: `specs/README.md` MUST reflejar spec004 y spec005 cerradas con su puerta `passed` y su commit, MUST retirar S3-T042/S3-T043 de los aplazados de spec003 (resueltos por spec005 T003/T004) y MUST incluir la fila de spec006.
- **FR-014**: MUST NOT editarse ningún artefacto de `specs/003-*` ni `specs/004-*` (cerradas sobre su snapshot; el registro vivo es `specs/README.md`).

#### Aplazados del punto 6 (US5, P34)

- **FR-015**: (F-002) La siembra MUST podar los nodos del catálogo ausentes de las fixtures **después** de reescribir las guías, o traducir la violación de clave ajena a un error de la unión que nombre la maestría; MUST fallar cerrado sin cambios parciales.
- **FR-016**: (S-001) El procedimiento de referencias visuales MUST impedir que el contenedor lea archivos ignorados como secretos, y la exclusión MUST tratar los nombres literalmente; `CONTRIBUTING{,.es}.md` MUST describir la frontera real.
- **FR-017**: (coldStart) La prueba de rendimiento de la API MUST medir 3 arranques en frío y comparar su mediana con el umbral actual (5000 ms), informando las 3 muestras.

#### Transversales

- **FR-018**: Cada tarea de código MUST empezar por una prueba que falla (constitución IX) y MUST registrar comando y salida reales al marcarse.
- **FR-019**: spec006 MUST numerar sus tareas desde T001 e incluir la tarea de cierre con la puerta de spec002 (`speckit-review-complete`) como en spec005.
- **FR-020**: MUST NOT incluirse ningún cambio de rediseño visual.

### Key Entities

- **Puerta sobre el artefacto**: comprobación de release o de CI que lee las páginas prerrenderizadas; tiene un nombre, un criterio y un mensaje.
- **Clave estable de tarjeta**: dato del contenido que identifica una tarjeta en su página (guía, entrada de catálogo o destino); de ella sale el identificador de su descripción.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con artefacto ausente o sin páginas, el 100 % de las puertas afectadas terminan con error (hoy, una de ellas pasa).
- **SC-002**: El criterio de «artefacto vacío» está escrito en 1 lugar (hoy, 2 copias con criterios distintos más 1 puerta sin él).
- **SC-003**: Dos builds del sitio sin cambios de contenido dan 0 diferencias en los identificadores de las tarjetas, y 0 identificadores duplicados por página.
- **SC-004**: `e2e:a11y` mantiene 0 violaciones e incluye al menos 1 caso de descripción accesible de tarjeta por idioma.
- **SC-005**: 0 apariciones de «pendiente de confirmación» asociadas a la base de `/tier-list` en los artefactos de spec005; `specs/README.md` sin estados «en curso» para specs cerradas.
- **SC-006**: `/tier-list` ≤ 112 000 B de JS inicial; la regresión visual pasa con las referencias actuales, sin regenerarlas.
- **SC-007**: F-002, S-001 y la mediana de `coldStartMs` cumplen su prueba independiente de US5 (con Postgres real, Docker y la suite de BD, respectivamente).

## Fuera de alcance

- **S4-D2 a S4-D7**: ya resueltos por spec005 T008–T013 (evidencia en [research.md](research.md) §R2–R7).
- **S3-T042 y S3-T043**: ya resueltos por spec005 T002–T004 (research §R11); solo se corrige su mención en `specs/README.md` (P34 c = fuera).
- Cualquier rediseño visual (decisión de Paco: la deuda primero; el rediseño será otra spec).
- Editar artefactos de spec003 o spec004.
- Ejecutar por primera vez en GitHub los trabajos `visual-regression` y `visual-baselines` (depende del push, que decide Paco).

## Clarifications

### Session 2026-11-17

- Q: (P33, S4-D1) ¿Qué puertas usan el helper único de artefacto vacío? → A: A, las cuatro que leen páginas prerrenderizadas (dos de crédito, `assertNoGamePortraits` y la de marca, con su mínimo como parámetro); las que ya fallan cerrado con otra unidad no cambian (FR-002).
- Q: (P34, punto 6) ¿Qué aplazados entran en spec006? → A: a) F-002 incluido (FR-015); b) S-001 incluido (FR-016); c) S3-T042/S3-T043 fuera, ya hechos por spec005; d) `coldStartMs` como mediana de 3 arranques con umbral 5000 ms, incluido (FR-017).

## Assumptions

- La base de `/tier-list` de 111 403 B (margen 597 B) está aceptada por Paco el 2026-11-17 (to-do 134); el límite de 112 000 B no cambia.
- El snapshot de la puerta de spec005 caduca con cualquier cambio del repositorio; editar sus artefactos no reabre la puerta.
- Las pruebas con base de datos real (`*.int.spec.ts`) corren con el Postgres de la corrida o en CI, y se declara cuál.
- Docker está disponible en local para comprobar S-001; si no, la tarea lo declara antes de marcarse.
- La regresión visual (30 referencias de spec005 T017) se ejecuta en el contenedor Docker local equivalente al CI.
