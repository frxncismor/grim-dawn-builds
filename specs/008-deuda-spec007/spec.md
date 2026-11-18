# Feature Specification: Deuda de spec007 (erratum DV1/DV2, registro y recorrido único del artefacto)

**Feature Branch**: `008-deuda-spec007` (planificación en `orq/11111619-ui-s8-plan`, base `orq/11111619` = `mvp/1` @ `1375dda`)

**Created**: 2026-11-18

**Status**: Planificada (2026-11-18). Clarify resuelto por el planificador sin Paco, por instrucción del principal: ningún punto exige decisión de Paco (sin cambio de esquema de BD, de contrato público ni de producto). Ver «Clarifications» y «Assumptions».

**Depende de**: `007-deuda-revisiones-3` (cerrada con la puerta de `002-spec-completion-reviews` en `passed` en `95f18de`, snapshot `bf9dac85…`, fusionada en `mvp/1` en `1375dda`, PR #13).

**Input**: Decisión del principal (2026-11-18, to-do 144, alcance cerrado): una spec008 mínima con tres puntos: (1) el erratum DV1/DV2 de spec007 (B-101 = A-101 de la ronda 2), sin editar artefactos de spec007 fuera de `reviews/`; (2) `specs/README.md` con spec007 cerrada y la fila de spec008 al cerrar; (3) S-003 = A-002 de la ronda 1 de spec007: un único recorrido del artefacto que valide los enlaces y entradas no regulares y devuelva las entradas validadas, sin doble lectura del directorio y sin cambiar mensajes ni comportamiento observable. Fuera de alcance: todo lo demás (rediseño, expansiones, T-043, `[DIFERIDA]`).

## Contexto

Cada punto se **volvió a localizar en `1375dda`** antes de planificarlo (evidencia con archivo y línea en [research.md](research.md)):

- **Erratum DV1/DV2**: el criterio (4) de T007 de spec007 (`specs/007-deuda-revisiones-3/tasks.md:68`) llama DV1 a la regla de la tarjeta y DV2 a la prueba de 3 guías, al revés que la tabla vigente de `specs/007-deuda-revisiones-3/plan.md:135-136` y que `reviews/analyze.md:11-12`. La ronda 2 de la puerta lo aplazó (B-101 = A-101) porque corregir `tasks.md` cambiaba el snapshot.
- **Registro**: `specs/README.md:14` muestra spec007 «Implementada; puerta spec002 en curso», aunque la puerta dio `passed` (`95f18de`) y la spec está fusionada en `mvp/1` (`1375dda`). La entrada 2 de `specs/007-deuda-revisiones-3/reviews/deuda.md` lo aplazó por la misma razón.
- **S-003 = A-002**: la comprobación de enlaces del artefacto es un recorrido aparte del que lee las entradas: cada puerta lee el árbol dos veces (validar y después listar), y una puerta futura podría recorrerlo sin validar. Hoy una puerta de páginas lee el directorio 2 veces por llamada y la puerta «sin arte del juego» 4 veces.

Esta spec no añade producto: no hay pantallas, rutas, cadenas visibles, estilos ni bytes de cliente nuevos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cada puerta del artefacto mira lo mismo que valida (Priority: P1)

Quien publica una versión necesita que cada puerta que recorre el artefacto prerrenderizado lo lea **una sola vez** y trabaje sobre las entradas ya validadas (sin enlaces ni entradas no regulares), de modo que lo que la puerta examina sea exactamente lo que validó y que ninguna puerta nueva pueda recorrer el artefacto sin validarlo.

**Why this priority**: es la única deuda de spec007 con efecto en código de las puertas de derechos (constitución VII); el resto es registro.

**Independent Test**: un espía de la lectura de directorios cuenta las lecturas por llamada de cada puerta (hoy 2 en las de páginas y 4 en la de arte del juego con la fuente propia; después 1); los casos de enlace, artefacto vacío y artefacto válido dan los mismos mensajes que hoy.

**Acceptance Scenarios**:

1. **Given** un artefacto válido, **When** corre cualquier puerta que lista sus páginas, **Then** el directorio se lee una sola vez por llamada y el resultado es el de hoy.
2. **Given** un artefacto válido y la fuente de activos propia, **When** corre la puerta «sin arte del juego», **Then** el artefacto se lee una sola vez y el resultado es el de hoy; con la fuente `game` no se lee.
3. **Given** un enlace bajo `browser/`, uno fuera de `browser/` o una entrada no regular, **When** corren las puertas, **Then** fallan con el mismo mensaje, la misma ruta y el mismo orden de comprobaciones que hoy.
4. **Given** un artefacto sin `browser/` o sin páginas, **When** corren las puertas, **Then** fallan con el mismo mensaje que hoy, también si además hay un enlace fuera de `browser/`.
5. **Given** una plataforma que no permite crear el enlace de la prueba, **When** corren las pruebas, **Then** ese caso se omite con su motivo, sin fallar ni darse por probado.

---

### User Story 2 - El registro de spec007 dice la verdad (Priority: P2)

Quien retoma el proyecto necesita que el registro SDD describa el estado real de spec007: qué desviación es DV1 y cuál DV2, que la spec está cerrada y fusionada, y que su deuda pasó a spec008.

**Why this priority**: deuda documental pura, sin riesgo de producto.

**Independent Test**: el erratum de spec008 fija DV1 y DV2 remitiendo a la tabla de `plan.md` de spec007; `reviews/deuda.md` de spec007 marca cerradas sus entradas con remisión a spec008; `specs/README.md` muestra spec007 cerrada con su commit; `pnpm lint:md` pasa.

**Acceptance Scenarios**:

1. **Given** el criterio (4) de T007 de spec007, **When** se busca su corrección, **Then** el erratum de spec008 dice que DV1 = S6-D3 (caso de componente de 3 guías, T003) y DV2 = B-002 (regla en `buildCardData`, T002), que manda la tabla de `plan.md:135-136` de spec007 y que `tasks.md:68` queda sin editar a propósito.
2. **Given** `specs/007-deuda-revisiones-3/reviews/deuda.md`, **When** se leen las entradas de la ronda 2 y la de S-003, **Then** cada una dice cerrada por spec008 y su tarea.
3. **Given** `specs/README.md`, **When** se leen la fila y la sección de spec007, **Then** dicen cerrada, 7 de 7, puerta `passed` en `95f18de`, fusionada en `mvp/1` en `1375dda`, y remiten su deuda a spec008; al cerrar spec008, su fila dice cerrada con su commit.

---

### Edge Cases

- Un enlace **fuera** de `browser/` y un `browser/` sin páginas a la vez: hoy gana el mensaje de artefacto vacío (la puerta comprueba primero las páginas); después también.
- Un enlace bajo `browser/` en la puerta «sin arte del juego»: hoy la ruta del mensaje es relativa a `browser/` (`browser/<ruta>`); después también, aunque la lectura sea la del artefacto completo.
- Varias entradas no regulares a la vez: se informa la primera en el orden de la lectura, con el mismo formato de mensaje (ninguna prueba depende de cuál).
- Una puerta con la fuente de activos `game` o vacía: no lee el artefacto, igual que hoy.
- Editar `specs/README.md` o cualquier archivo fuera de `specs/*/reviews/**` desfasa el snapshot de la puerta de spec007 (`check` en `stale`): es lo esperado, como spec007 hizo con spec006; la puerta cerrada no se reabre.
- Las puertas que ya validan en su propia lectura (escaneo de secretos del build público, huella del release, comparador de builds) no tienen el doble recorrido y no cambian.

## Requirements *(mandatory)*

### Functional Requirements

#### Recorrido único del artefacto (US1, S-003 = A-002)

- **FR-001**: MUST existir un único criterio y una única lectura del artefacto por llamada que valide los enlaces y las entradas no regulares y devuelva las entradas validadas; las puertas que listan páginas MUST consumir esas entradas en lugar de leer el directorio otra vez.
- **FR-002**: La puerta «sin arte del juego» con la fuente propia MUST leer el artefacto una sola vez y derivar de esa lectura tanto las páginas como la búsqueda de retratos e iconos del juego.
- **FR-003**: Con cualquier artefacto, válido o no, cada puerta MUST conservar su resultado, su mensaje (texto, ruta y puerta nombrada) y el orden de sus comprobaciones actuales en `game` y en `own`.
- **FR-004**: MUST existir una prueba que cuente las lecturas del directorio por llamada y falle antes del cambio (rojo primero), más pruebas de caracterización de los mensajes exactos, escritas antes del cambio y verdes antes y después.
- **FR-005**: Las puertas que ya rechazan enlaces en su propia lectura única (escaneo de secretos del build público, huella del release) y el comparador de builds MUST NOT cambiar.
- **FR-006**: MUST NOT quedar ningún recorrido del artefacto en las puertas de páginas que no pase por el criterio único.

#### Registro SDD (US2, B-101 = A-101 y registro de spec007)

- **FR-007**: spec008 MUST contener el erratum de DV1/DV2 que remite a `plan.md:135-136` y `reviews/analyze.md:11-12` de spec007; ningún artefacto de spec007 fuera de `reviews/` MUST editarse.
- **FR-008**: `specs/007-deuda-revisiones-3/reviews/deuda.md` MUST marcar cerradas por spec008 las entradas B-101 = A-101, la fila de spec007 de `specs/README.md` y S-003 = A-002, con su tarea.
- **FR-009**: `specs/README.md` MUST mostrar spec007 cerrada (7 de 7, puerta `passed` en `95f18de`, fusionada en `mvp/1` en `1375dda`) con su deuda remitida a spec008, y la fila de spec008 al día al cerrarla.
- **FR-010**: MUST NOT editarse ningún artefacto de `specs/001-*` a `specs/006-*` ni de spec007 fuera de `reviews/`.

#### Transversales

- **FR-011**: Cada tarea de código MUST empezar por una prueba que falla (constitución IX) y MUST registrar comando y salida reales al marcarse.
- **FR-012**: spec008 MUST numerar sus tareas desde T001 e incluir la tarea de cierre con la verificación de integración y la puerta de spec002 (`speckit-review-complete`) más T-136, como T006 de spec007.
- **FR-013**: MUST NOT incluirse ningún cambio de rediseño visual, expansión, T-043 ni tareas `[DIFERIDA]` de spec001.

### Key Entities

- **Entrada del artefacto**: archivo, directorio o enlace bajo el artefacto prerrenderizado; solo los archivos y directorios reales son válidos. La lectura única devuelve las entradas válidas.
- **Erratum**: corrección de un artefacto SDD cerrado que vive en la spec siguiente y remite al texto vigente, sin editar el artefacto corregido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lecturas del directorio por llamada: 1 en cada puerta que lista páginas (hoy 2) y 1 en la puerta «sin arte del juego» con la fuente propia (hoy 4); 0 con `game`.
- **SC-002**: 0 cambios en los mensajes de las puertas para los casos de enlace, entrada no regular, artefacto vacío y artefacto válido (pruebas de caracterización verdes antes y después).
- **SC-003**: 0 artefactos de spec001 a spec006 ni de spec007 fuera de `reviews/` editados; 0 estados «en curso» de specs cerradas en `specs/README.md`.
- **SC-004**: La puerta de spec002 de spec008 termina en `passed`.

## Fuera de alcance

- Cualquier rediseño visual, expansiones, T-043 y las tareas `[DIFERIDA]` de spec001 (decisión del principal).
- Compartir una sola lectura entre las tres puertas que corre `build-release` sobre el mismo artefacto (cambia la firma de las puertas exportadas; research §R4 c).
- Migrar al criterio único las lecturas propias del escaneo de secretos, la huella del release y el comparador de builds (ya validan en su única lectura; research §R5).
- Editar `specs/007-deuda-revisiones-3/tasks.md`, `plan.md` o cualquier otro artefacto de spec007 fuera de `reviews/`.

## Clarifications

### Session 2026-11-18

Resuelto por el planificador con defaults razonables, sin preguntar a Paco, por instrucción del principal. Ninguna respuesta cambia esquema de BD, contrato público ni producto.

- Q: ¿Dónde vive el erratum de DV1/DV2, si no se puede editar `tasks.md` de spec007? → A: en spec008, en un archivo propio (`specs/008-deuda-spec007/erratum.md`) que remite a `plan.md:135-136` y `reviews/analyze.md:11-12` de spec007; `reviews/deuda.md` de spec007 (fuera del snapshot) remite a él.
- Q: ¿«Una sola lectura» es por llamada de cada puerta o por build (las tres puertas de `build-release` sobre el mismo artefacto)? → A: por llamada de cada puerta: cierra el hueco de S-003 sin cambiar la firma de las puertas exportadas (research §R4).
- Q: ¿Qué otras puertas recorren hoy el artefacto y entran? → A: entran las que pasan por el criterio único (crédito de retratos, crédito de iconos, marca antigua y «sin arte del juego»); quedan fuera las que ya validan en su propia y única lectura (escaneo de secretos, huella del release) y el comparador de builds, que no tienen el doble recorrido (research §R5).
- Q: ¿Cómo se demuestra el rojo de un refactor sin cambio de comportamiento? → A: con un espía de la lectura de directorios que cuenta las lecturas por llamada (hoy 2 y 4; se esperan 1 y 1), más pruebas de caracterización de los mensajes exactos que pasan antes y después.

## Assumptions

- El snapshot de la puerta de spec002 excluye `specs/*/reviews/**` y `.specify/feature.json` (`scripts/spec-review.mjs:46-48`): editar `specs/007-deuda-revisiones-3/reviews/deuda.md` no lo cambia; cualquier otro cambio de spec008 (código, `specs/README.md`, `specs/008-*`) deja el `check` de spec007 en `stale`. Es lo esperado (como spec007 con spec006) y no reabre la puerta.
- En Node 22, un espía sobre `readdirSync` del módulo `node:fs` seguido de `syncBuiltinESMExports()` intercepta también las importaciones con nombre de los scripts; comprobado en lectura el 2026-11-18 (2 lecturas en `prerenderedPages`, 4 en `assertNoGamePortraits` con `own`), research §R3.
- La lectura recursiva de Node no entra en los enlaces ni en los *junctions* (los informa como enlaces), como ya asumen las pruebas de spec007.
- El riesgo residual entre la lectura validada y la lectura del contenido de cada página (un archivo sustituido por un enlace entre ambas) es teórico: el artefacto es local y lo genera el propio build; queda registrado, sin tarea (research §R4).
- No hay consumo de bytes de cliente: solo cambian `scripts/`; `/tier-list` sigue en 111 422 B (evidencia de spec007 T006).
- El orden de las tareas lo decide el reparto por áreas de `plan.md`; no hay prioridad de Paco entre puntos.
