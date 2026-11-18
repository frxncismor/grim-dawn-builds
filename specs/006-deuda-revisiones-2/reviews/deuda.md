# Deuda aplazada en la ronda 1 de la puerta T008 (spec006)

Decisión de Paco (2026-11-17, opción A, P35, vía el principal): de los hallazgos de la ronda 1 se corrigen F-001/A-001/C-001 (T009), C-002, B-003 y B-001 (T010); los dos LOW siguientes se aplazan con su motivo. Esta lista vive en `reviews/` para no dejar tareas abiertas en el snapshot de la puerta. Al planificarla, cada entrada se convierte en una tarea SDD. Tarea de referencia de ambas: T008.

1. **S-001**, el recorrido de `prerenderedPages` y de `assertNoGamePortraits` ignora los enlaces simbólicos dentro del artefacto (security r1, LOW, `scripts/check-assets.mts:162` y `scripts/artifact-pages.mts:27`). `readdirSync(..., { recursive: true, withFileTypes: true })` conserva solo `entry.isFile()`: no entra en una carpeta enlazada ni cuenta una página `.html` enlazada.
   - **Motivo del aplazamiento**: comportamiento previo a spec006 que esta conservó; en el release lo corta `assertPublicBuild` (`check-public-build.mts:82`, rechaza cualquier enlace) sobre el mismo staging, y el artefacto lo genera el propio build, no entrada externa.
   - **Riesgo residual**: la unidad no falla cerrada por sí sola; un llamador futuro sin `assertPublicBuild` heredaría el hueco (una carpeta de retratos enlazada esquivaría la puerta `own`).
   - **Plan**: tratar como artefacto inválido toda entrada que sea un enlace o que no sea ni archivo ni directorio, en `prerenderedPages` y en el escaneo de `assertNoGamePortraits`; añadir pruebas con una carpeta y una página `.html` enlazadas, omitidas donde la plataforma rechace los enlaces (como la prueba de junction existente). Se retomaría en la próxima spec de deuda que toque `scripts/`.
   - Aplazado por decisión de Paco 2026-11-17 (ronda 1 de T008). Tarea de referencia: T008.
2. **B-002**, el invariante «sin enlace no hay `combinationLang`» lo garantizan solo los adaptadores (best-practices r1, LOW, `apps/web/src/app/shared/ui/build-card/build-card.labels.ts:69` y `build-card.model.ts:73-77`). `buildCardData` fija `srCombination` siempre que haya `combinationLang` y `combination`, sin mirar `href`/`externalHref`; tras retirar la rama `@else` (T003), una tarjeta sin enlace con `combinationLang` no anunciaría la combinación.
   - **Motivo del aplazamiento**: hoy lo impiden los adaptadores reales y lo fija `build-card.spec.ts` (bloque spec006 T003); hacerlo cumplir en `buildCardData` añade bytes a `/tier-list` (margen 597 B sobre la base aceptada de 111 403 B) para un caso que ninguna entrada produce.
   - **Riesgo residual**: un adaptador futuro que pase `combinationLang` sin enlace haría desaparecer la combinación para lectores de pantalla sin que falle ninguna prueba del componente.
   - **Plan**: o bien hacer cumplir el invariante en `buildCardData` (`srCombination` solo con `href` o `externalHref`; sin enlace, la combinación vuelve a `srText`), midiendo `/tier-list`; o bien ajustar el docstring de `BuildCardData.srCombination` a «contrato de los adaptadores» y añadir una prueba de `buildCardData` con `combinationLang` y sin enlace. Se retomaría en la próxima tarea que toque `build-card.*`.
   - Aplazado por decisión de Paco 2026-11-17 (ronda 1 de T008). Tarea de referencia: T008.

## Ronda 2 de la puerta T008 (decisión de Paco, 2026-11-17, P36 = A)

La ronda 2 dio 0 CRITICAL, 0 HIGH y 0 MEDIUM. Los LOW abiertos se aplazan con motivo y la puerta se cierra como `passed`. Tarea de referencia: T008. Al planificarlas, cada entrada se convierte en una tarea SDD. Por prioridad:

1. **S6-D1** (C-101 = A-101, LOW): `data-model.md:33`, `plan.md:128,153` y `research.md:116` describen la guarda 23505 de T005 en vez del aparcado de celda de T009.
   - **Motivo del aplazamiento**: es documentación, no código; editar esos archivos cambia el snapshot de la puerta.
   - **Plan**: actualizarlos en la próxima tarea SDD que toque spec006.
2. **S6-D2** (A-102 = B-101, LOW): la fila y la sección de spec006 en `specs/README.md` dicen «8 de 10» con T009/T010 abiertas, frente a 10/10 en `tasks.md`.
   - **Motivo del aplazamiento**: se actualiza fuera del snapshot, con la spec cerrada y su commit.
   - **Plan**: corregir `specs/README.md` al cerrar spec006.
3. **S6-D3** (B-102, LOW): `e2e/a11y.spec.ts:605`, la comprobación de unicidad de ids en la portada es vacua con 1 guía.
   - **Motivo del aplazamiento**: no hay defecto de producto; es un hueco de cobertura de prueba.
   - **Plan**: ampliar el fixture o comprobarla con datos de 2+ guías.

Siguen vigentes S-001 y B-002 de la ronda 1 (reaparecidos como F-101 y F-102 en `t136-review.md`).
