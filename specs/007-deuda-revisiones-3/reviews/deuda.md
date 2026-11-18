# Deuda aplazada en la ronda 1 de la puerta T006 (spec007)

Decisión del orquestador (2026-11-18, mismo criterio que spec006, P35 = A): de los hallazgos de la ronda 1 se corrigen S-001, S-002, C-002, A-001, B-001 y B-002 (T007); el LOW siguiente se aplaza con su motivo. Esta lista vive en `reviews/` para no dejar tareas abiertas en el snapshot de la puerta. Al planificarla, cada entrada se convierte en una tarea SDD. Tarea de referencia: T006.

1. **S-003 = A-002**, `assertRegularEntries` es un recorrido aparte y opt-in por puerta, con doble `readdir` (security y architecture r1, LOW, `scripts/artifact-pages.mts:10,45`). Cada puerta debe llamarlo antes de su propio recorrido; entre la validación y la lectura el árbol se recorre dos veces, así que un cambio entre ambos (TOCTOU) no se vería.
   - **Motivo del aplazamiento**: el artefacto es local y lo genera el propio build, no es entrada externa ni se modifica mientras corren las puertas; unificar en un único recorrido que devuelva entradas ya validadas es un refactor de las puertas (`prerenderedPages`, `assertNoGamePortraits`) que no cabe en una tanda LOW.
   - **Riesgo residual**: una puerta futura que recorra el artefacto sin llamar a `assertRegularEntries` heredaría el hueco de enlaces; el TOCTOU es teórico.
   - **Plan**: un único recorrido que devuelva las entradas validadas y lo consuman todas las puertas. Se retomaría en la próxima spec de deuda que toque `scripts/artifact-pages.mts`.
   - Aplazado por decisión del orquestador 2026-11-18 (ronda 1 de T006). Tarea de referencia: T006.
