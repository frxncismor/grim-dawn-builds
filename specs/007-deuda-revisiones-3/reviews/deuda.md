# Deuda aplazada en la ronda 1 de la puerta T006 (spec007)

Decisión del orquestador (2026-11-18, mismo criterio que spec006, P35 = A): de los hallazgos de la ronda 1 se corrigen S-001, S-002, C-002, A-001, B-001 y B-002 (T007); el LOW siguiente se aplaza con su motivo. Esta lista vive en `reviews/` para no dejar tareas abiertas en el snapshot de la puerta. Al planificarla, cada entrada se convierte en una tarea SDD. Tarea de referencia: T006.

1. **S-003 = A-002**, `assertRegularEntries` es un recorrido aparte y opt-in por puerta, con doble `readdir` (security y architecture r1, LOW, `scripts/artifact-pages.mts:10,45`). Cada puerta debe llamarlo antes de su propio recorrido; entre la validación y la lectura el árbol se recorre dos veces, así que un cambio entre ambos (TOCTOU) no se vería.
   - **Motivo del aplazamiento**: el artefacto es local y lo genera el propio build, no es entrada externa ni se modifica mientras corren las puertas; unificar en un único recorrido que devuelva entradas ya validadas es un refactor de las puertas (`prerenderedPages`, `assertNoGamePortraits`) que no cabe en una tanda LOW.
   - **Riesgo residual**: una puerta futura que recorra el artefacto sin llamar a `assertRegularEntries` heredaría el hueco de enlaces; el TOCTOU es teórico.
   - **Plan**: un único recorrido que devuelva las entradas validadas y lo consuman todas las puertas. Se retomaría en la próxima spec de deuda que toque `scripts/artifact-pages.mts`.
   - Aplazado por decisión del orquestador 2026-11-18 (ronda 1 de T006). Tarea de referencia: T006.
   - **Cerrada por spec008 T002–T003**: lectura única del artefacto (`readArtifactEntries` en `scripts/artifact-pages.mts`; `prerenderedPages` y `assertNoGamePortraits` con una sola lectura); evidencia en [`specs/008-deuda-spec007/quickstart.md`](../../008-deuda-spec007/quickstart.md). El TOCTOU residual entre la lectura y `readFile` queda aceptado (research R4 de spec008).

## Ronda 2 de la puerta T006 (decisión del principal, 2026-11-18)

La ronda 2 dio 0 CRITICAL, 0 HIGH y 0 MEDIUM. Decisión del principal (A): el único LOW abierto se aplaza con motivo y la puerta se cierra como `passed`. Tarea de referencia: T006.

1. **B-101 = A-101** (LOW, best-practices y architecture r2): el criterio (4) de T007 en `tasks.md:68` dice DV1 = regla en `buildCardData` y DV2 = prueba de 3 guías, al revés que `plan.md:135-136` y `reviews/analyze.md:11-12`.
   - **Aclaración vigente**: manda la tabla de `plan.md`. DV1 = S6-D3, caso de componente de `HomePage` con 3 guías (T003); DV2 = B-002, regla en `buildCardData` (T002). El origen fue el encargo del orquestador.
   - **Motivo del aplazamiento**: corregir `tasks.md` cambia el snapshot de la puerta.
   - **Plan**: se corrige en la próxima spec que toque spec007.
   - **Cerrada por spec008 T001**: erratum en [`specs/008-deuda-spec007/erratum.md`](../../008-deuda-spec007/erratum.md).
2. **Fila de spec007 en `specs/README.md`** («Implementada; puerta spec002 en curso»): queda desfasada por la misma razón (tocar `specs/README.md` cambia el snapshot). Se actualiza fuera del snapshot en la próxima tarea SDD, como S6-D2 en spec006.
   - **Cerrada por spec008 T001**: fila actualizada en [`specs/README.md`](../../README.md) (spec007 cerrada, `95f18de`); ver [spec008](../../008-deuda-spec007/tasks.md).
3. **S-101 (security r2) y A-002 (architecture r2)** son el mismo S-003 ya aplazado en la ronda 1 (entrada 1 de este archivo); no son deuda nueva.
   - **Cerrada por spec008 T002–T003**: ver la entrada 1 de este archivo (lectura única con `readArtifactEntries`; evidencia en [`specs/008-deuda-spec007/quickstart.md`](../../008-deuda-spec007/quickstart.md)); el TOCTOU residual queda aceptado (research R4 de spec008).
