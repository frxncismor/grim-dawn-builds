# Feature Specification: Deuda LOW de spec006 y de la CI (tercera tanda)

**Feature Branch**: `007-deuda-revisiones-3` (planificación en `orq/11111619-ui-s7-plan`, base `orq/11111619` = `mvp/1` @ `81179fc`)

**Created**: 2026-11-18

**Status**: Planificada (2026-11-18). Clarify resuelto por el planificador sin Paco, por instrucción del principal: ningún punto exige decisión de Paco (sin cambio de esquema de BD ni de contrato público). Ver «Clarifications» y «Assumptions».

**Depende de**: `006-deuda-revisiones-2` (cerrada con la puerta de `002-spec-completion-reviews` en `passed`, `c626f26`, fusionada en `mvp/1` en `81179fc`).

**Input**: Decisión del principal (2026-11-18, alcance cerrado): una spec que recoja (1) S6-D1, (2) S6-D2 y (3) S6-D3 de `specs/006-deuda-revisiones-2/reviews/deuda.md`; (4) S-001 y (5) B-002 de la ronda 1 de spec006; (6) el comentario desfasado del trabajo `visual-regression` de `.github/workflows/ci.yml` (visto en T-177); (7) los aplazados A-01, A-03 y C-003 de spec003, comprobando si spec005/spec006 ya los cerraron. Fuera de alcance: rediseño visual, expansiones, T-043 y las tareas `[DIFERIDA]` de spec001.

## Contexto

Cada elemento se **volvió a localizar en el código de `81179fc`** antes de planificarlo (evidencia con archivo y línea en [research.md](research.md)). Lo que sigue abierto es:

- **S6-D1**: tres artefactos de spec006 describen un mecanismo de la siembra (aborto por celda ocupada antes del upsert) que T009 sustituyó por el aparcado de la fila fuera de la rejilla.
- **S6-D2**: `specs/README.md` muestra spec006 «8 de 10» y con la puerta «en curso», aunque está cerrada (10 de 10, puerta `passed`).
- **S6-D3**: la comprobación de unicidad de ids de las tarjetas de la portada pasa siempre, porque el contenido de pruebas solo tiene una guía pública.
- **S-001**: las puertas que recorren el artefacto prerrenderizado ignoran en silencio los enlaces simbólicos.
- **B-002**: la regla «una tarjeta sin enlace no lleva combinación en otro idioma como descripción» solo la cumplen los adaptadores; la tarjeta no la impone.
- **CI**: un comentario de `ci.yml` (y su gemelo en la prueba del flujo) justifica el modo de activos propio con un hecho falso («no hay PNG del juego versionados»).

A-01, A-03 y C-003 de spec003 **ya están cerrados** (spec004 T005 y spec005 T005–T007); se registran como tales y no generan tareas.

Esta spec no añade producto: no hay pantallas, rutas, cadenas visibles ni estilos nuevos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ninguna puerta sobre el artefacto se salta un enlace en silencio (Priority: P1)

Quien publica una versión necesita que las puertas que recorren el artefacto prerrenderizado (la del criterio de «artefacto con páginas» y la que impide arte del juego con la fuente de activos propia) **fallen** si encuentran un enlace simbólico (a una carpeta o a una página), en lugar de no entrar en él y dar un verde sin haberlo mirado.

**Why this priority**: es la única deuda con efecto en una puerta de derechos (constitución §VII). Hoy no es explotable porque la puerta de secretos del release ya rechaza enlaces sobre el mismo artefacto, pero la unidad no falla cerrado por sí sola.

**Independent Test**: con un artefacto válido que contiene una carpeta enlazada o una página `.html` enlazada, cada puerta afectada termina con error y un mensaje que nombra la puerta y el enlace; con un artefacto sin enlaces su resultado es el de hoy.

**Acceptance Scenarios**:

1. **Given** un artefacto cuya carpeta de páginas contiene una carpeta enlazada, **When** corre la comprobación de páginas de cualquier puerta que la usa, **Then** falla nombrando la puerta y la ruta del enlace.
2. **Given** un artefacto con una página `.html` enlazada, **When** corre la misma comprobación, **Then** falla igual.
3. **Given** la fuente de activos propia y un artefacto con una carpeta de retratos enlazada, **When** corre la puerta «sin arte del juego», **Then** falla (hoy pasa).
4. **Given** un artefacto sin enlaces, **When** corren las puertas, **Then** su resultado y sus mensajes son los de hoy en los dos modos de activos.
5. **Given** una plataforma que no permite crear el enlace de la prueba, **When** corren las pruebas, **Then** ese caso se omite con su motivo, sin fallar ni darse por probado.

---

### User Story 2 - La tarjeta impone su propia regla de accesibilidad (Priority: P2)

Quien usa un lector de pantalla necesita oír la combinación de maestrías de cualquier tarjeta, también si en el futuro una tarjeta **sin enlace** recibe una combinación en el idioma del contenido. Hoy esa tarjeta la perdería: la línea visible es oculta para tecnologías de apoyo y la descripción accesible solo existe en los enlaces. La regla vive solo en los adaptadores que construyen las tarjetas.

**Why this priority**: LOW; ninguna entrada real produce ese caso hoy, pero un adaptador futuro la rompería sin que fallara ninguna prueba del componente.

**Independent Test**: una prueba del modelo de la tarjeta con combinación en el idioma del contenido y sin enlace comprueba que no se pide descripción y que la línea visible de la combinación, con su propio idioma, queda expuesta a tecnologías de apoyo; con enlace, el comportamiento es el de hoy.

**Acceptance Scenarios**:

1. **Given** una tarjeta sin enlace con combinación en el idioma del contenido, **When** se construyen sus datos, **Then** no hay descripción enlazada y la línea visible de la combinación queda expuesta a tecnologías de apoyo con su propio idioma.
2. **Given** una tarjeta con enlace (interno o externo) y combinación en el idioma del contenido, **When** se construyen sus datos, **Then** la combinación es la descripción del enlace, igual que hoy.
3. **Given** cualquier página pública real, **When** se compara antes y después, **Then** el nombre accesible, la descripción, el HTML visible y las capturas de la regresión visual no cambian.

---

### User Story 3 - La unicidad de ids de la portada se prueba con varias guías (Priority: P3)

Quien mantiene la portada necesita que la comprobación «los ids de descripción de las tarjetas no se repiten» se ejecute con al menos dos guías públicas, para que falle si dos tarjetas llegaran a compartir id.

**Why this priority**: hueco de cobertura de prueba, sin defecto de producto.

**Independent Test**: una prueba que dibuja la portada con tres guías públicas cuyo contenido está en otro idioma comprueba que hay al menos dos ids de descripción y que son únicos; la prueba de navegador sobre el artefacto deja de poder pasar con cero tarjetas.

**Acceptance Scenarios**:

1. **Given** una portada con tres guías públicas en el idioma del contenido, **When** se dibuja en inglés, **Then** hay al menos dos ids `build-card-combination-…` y ninguno se repite.
2. **Given** dos tarjetas que compartieran clave, **When** corre la prueba, **Then** falla (la prueba no es vacua).
3. **Given** el artefacto público actual (una guía), **When** corre la prueba de navegador de la portada, **Then** exige al menos un id y declara que la unicidad con varias guías se prueba en la prueba del componente.

---

### User Story 4 - El registro SDD y la CI dicen la verdad (Priority: P3)

Quien retoma el proyecto o lee la CI necesita que los artefactos de spec006, `specs/README.md` y los comentarios de `ci.yml` describan el estado real: el mecanismo de aparcado de T009, spec006 cerrada (10 de 10, puerta `passed`) y el motivo real de construir la regresión visual con los activos propios.

**Why this priority**: deuda documental pura; sin riesgo de producto.

**Independent Test**: una búsqueda del aborto por celda ocupada (23505) en los artefactos de diseño de spec006 no lo presenta como el comportamiento vigente; `specs/README.md` muestra spec006 cerrada con su commit; la búsqueda de «no game PNG» en la CI no devuelve nada; `pnpm lint:md` pasa.

**Acceptance Scenarios**:

1. **Given** `data-model.md`, `plan.md` y `research.md` de spec006, **When** se lee el paso de la siembra que trata un nodo ausente aún usado en una celda entrante, **Then** describen el aparcado fuera de la rejilla y la decisión posterior por la poda (T009).
2. **Given** `specs/README.md`, **When** se leen la fila y la sección de spec006, **Then** dicen cerrada, 10 de 10, puerta `passed` (`c626f26`, fusionada en `mvp/1` en `81179fc`), y S-001, B-002, S6-D1, S6-D2 y S6-D3 remiten a spec007.
3. **Given** `.github/workflows/ci.yml` y `scripts/ci-workflow.test.mts`, **When** se lee el motivo del modo `own` de la regresión visual, **Then** no afirma que falten PNG del juego en el repositorio.

---

### Edge Cases

- Un enlace simbólico **fuera** de `browser/` pero dentro del artefacto (p. ej. en `server/`): la puerta «sin arte del juego» recorre el artefacto entero y también lo rechaza; la comprobación de páginas solo mira `browser/`.
- Un *junction* de Windows: Node lo informa como enlace simbólico; se trata igual que un enlace.
- Una entrada que no es ni archivo ni directorio (socket, FIFO): artefacto inválido, igual que un enlace.
- Plataforma sin permiso para crear enlaces de archivo (Windows sin modo desarrollador): la prueba de página enlazada se omite con motivo; la de carpeta usa *junction*, como la prueba existente.
- Tarjeta externa con URL insegura (`external.url = null`): no es enlace; si llevara combinación en otro idioma, se trata como tarjeta sin enlace.
- Editar artefactos de spec006 desfasa el snapshot de su puerta: es esperado (el snapshot cubre todo el repositorio y caduca con cualquier cambio posterior); la puerta cerrada no se vuelve a ejecutar.

## Requirements *(mandatory)*

### Functional Requirements

#### Puertas sobre el artefacto (US1, S-001)

- **FR-001**: La comprobación única de páginas prerrenderizadas MUST fallar, con un mensaje que nombre la puerta y la ruta, si bajo la carpeta de páginas hay un enlace simbólico (a carpeta o a archivo) o una entrada que no sea ni archivo ni directorio.
- **FR-002**: La puerta «sin arte del juego» con la fuente de activos propia MUST fallar con el mismo criterio en su recorrido del artefacto completo.
- **FR-003**: Con un artefacto sin enlaces, cada puerta MUST conservar su resultado y sus mensajes actuales en `game` y en `own`; las puertas que ya rechazan enlaces con su propia unidad (escaneo de secretos, huella del release) MUST NOT cambiar.
- **FR-004**: Cada caso de enlace MUST tener una prueba que falla antes del cambio; donde la plataforma no permita crear el enlace, la prueba MUST omitirse con su motivo.

#### Tarjeta de build (US2, B-002)

- **FR-005**: La regla «solo una tarjeta con enlace describe su enlace con la combinación en el idioma del contenido» MUST imponerla la construcción de los datos de la tarjeta, sea cual sea el adaptador; una tarjeta sin enlace MUST exponer la combinación a tecnologías de apoyo con su propio idioma (constitución V, WCAG 2.2 3.1.2), sin duplicarla en el texto oculto.
- **FR-006**: MUST existir una prueba del modelo de la tarjeta con combinación en el idioma del contenido y sin enlace, y otra con enlace externo.
- **FR-007**: Ninguna tarea MUST cambiar lo visible, el nombre ni la descripción accesibles de las tarjetas reales, la paridad EN/ES, la CSP ni las capturas de la regresión visual; `/tier-list` MUST seguir ≤ 112 000 B de JS inicial (hoy 111 395 B, margen 605 B).

#### Cobertura de la portada (US3, S6-D3)

- **FR-008**: La unicidad de los ids de descripción de las tarjetas de la portada MUST probarse con al menos dos guías públicas cuya combinación esté en el idioma del contenido.
- **FR-009**: La prueba de navegador de la portada MUST NOT poder pasar sin ningún id de descripción y MUST declarar dónde se prueba la unicidad con varias guías.
- **FR-010**: MUST NOT añadirse guías al contenido público ni regenerarse las referencias visuales para cubrir FR-008.

#### Registro SDD y CI (US4, S6-D1, S6-D2, comentario de CI)

- **FR-011**: `data-model.md`, `plan.md` y `research.md` de spec006 MUST describir el aparcado de la fila de T009 en lugar del aborto por celda ocupada, conservando la decisión original como histórico.
- **FR-012**: `specs/README.md` MUST mostrar spec006 cerrada, 10 de 10, puerta `passed` con su commit, y remitir sus aplazados a spec007.
- **FR-013**: El comentario del trabajo `visual-regression` de `.github/workflows/ci.yml` y su gemelo en `scripts/ci-workflow.test.mts` MUST explicar el modo `own` sin afirmar que no haya PNG del juego versionados; MUST NOT cambiar ningún paso ni variable de la CI.
- **FR-014**: MUST NOT editarse ningún artefacto de `specs/001-*` a `specs/005-*` (el registro vivo es `specs/README.md`).

#### Transversales

- **FR-015**: Cada tarea de código MUST empezar por una prueba que falla (constitución IX) y MUST registrar comando y salida reales al marcarse.
- **FR-016**: spec007 MUST numerar sus tareas desde T001 e incluir la tarea de cierre con la verificación de integración y la puerta de spec002 (`speckit-review-complete`) más T-136, como en spec006.
- **FR-017**: MUST NOT incluirse ningún cambio de rediseño visual, expansión, T-043 ni tareas `[DIFERIDA]` de spec001.

### Key Entities

- **Entrada del artefacto**: archivo, directorio o enlace bajo el artefacto prerrenderizado; solo los archivos y directorios reales son válidos.
- **Datos de la tarjeta**: vista de presentación de una tarjeta (texto accesible, descripción enlazada, enlace); la regla de la combinación se decide aquí.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un enlace simbólico bajo la carpeta de páginas, las 4 puertas que usan la comprobación única terminan con error (hoy, 0 de 4); con una carpeta de retratos enlazada y la fuente propia, la puerta «sin arte del juego» termina con error (hoy pasa).
- **SC-002**: 0 tarjetas sin enlace pierden la combinación para tecnologías de apoyo, también con entradas sintéticas; 0 cambios en el HTML de las páginas reales.
- **SC-003**: La unicidad de ids de la portada se comprueba con ≥ 2 ids (hoy, 1).
- **SC-004**: 0 menciones del aborto por celda ocupada como comportamiento vigente en el diseño de spec006; 0 estados «en curso» de specs cerradas en `specs/README.md`; 0 apariciones de «no game PNG» en la CI.
- **SC-005**: `/tier-list` ≤ 112 000 B de JS inicial; la regresión visual pasa con las 30 referencias actuales, sin regenerarlas.
- **SC-006**: la puerta de spec002 de spec007 termina en `passed`.

## Fuera de alcance

- **A-01, A-03 y C-003 de spec003**: ya cerrados (evidencia en [research.md](research.md) §R7–R9): A-01 por spec005 T005/T006 (`1e6451c`, `087807e`), A-03 por spec004 T005 (`aa75798`), C-003 por spec005 T007 (`314ef34`).
- Cualquier rediseño visual, expansiones, T-043 y las tareas `[DIFERIDA]` de spec001 (decisión del principal).
- Añadir guías al contenido público o un artefacto e2e nuevo para S6-D3 (más caro; research §R3).
- Editar artefactos de spec001 a spec005.

## Clarifications

### Session 2026-11-18

Resuelto por el planificador con defaults razonables, sin preguntar a Paco, por instrucción del principal (este ciclo avanza sin Paco salvo que sea imprescindible). Ninguna respuesta cambia esquema de BD ni contrato público.

- Q: ¿Dónde se impone la regla de B-002, en `packages/domain`, en el tipo de la entrada o en la construcción de los datos de la tarjeta? → A: en la construcción de los datos de la tarjeta (`buildCardData`, punto único por el que pasan todos los adaptadores), con prueba; el dominio no conoce tarjetas ni enlaces (research §R5). Si el coste en bytes superase el tope de `/tier-list`, se pasa al tipo de la entrada (0 B en cliente).
- Q: ¿Qué hace la regla con una tarjeta sin enlace y combinación en el idioma del contenido? → A: no se pide descripción y la línea visible de la combinación deja de estar oculta a tecnologías de apoyo, con su `lang` (FR-005). Se descartó meterla en el texto oculto: se leería sin su idioma (WCAG 3.1.2; hallazgo C1 de analyze).
- Q: ¿Con qué datos se prueba la unicidad de ids de la portada con 2+ guías? → A: con una prueba del componente de la portada con tres guías públicas sintéticas; el artefacto de borradores no sirve (la portada solo lista guías publicadas) y añadir guías públicas cambia el sitio y las 30 referencias visuales (research §R3).
- Q: ¿Qué se hace con un enlace simbólico en el artefacto? → A: artefacto inválido, falla cerrado; nunca se sigue el enlace (FR-001, FR-002).

## Assumptions

- La base de `/tier-list` es 111 395 B (evidencia de spec006 T008/T010, `quickstart.md`); el tope de 112 000 B no cambia.
- El snapshot de la puerta de spec006 caduca con cualquier cambio del repositorio; editar sus artefactos no reabre la puerta.
- La regresión visual (30 referencias) se ejecuta en el contenedor Docker local equivalente al CI con el procedimiento vigente de `CONTRIBUTING.md`.
- Node informa los *junctions* de Windows como enlaces simbólicos (`Dirent.isSymbolicLink()`), como ya usa la prueba existente de `scripts/artifact-pages.test.mts:41`.
- En una tarjeta sin enlace con combinación en el idioma del contenido (caso que ninguna entrada real produce), exponer la línea visible es el único cambio de marcado, y en ninguna página real se activa (FR-007).
- El orden de las tareas lo decide el reparto por áreas de `plan.md`; no hay prioridad de Paco entre elementos.
