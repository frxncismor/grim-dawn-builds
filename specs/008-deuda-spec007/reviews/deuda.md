# Deuda aplazada en la ronda 1 de la puerta T004 (spec008)

Decisión del principal (2026-11-18): de la ronda 1 de la puerta se corrige A-001 (MEDIUM) en T005, junto con S-001 y F-001 (LOW, mismo tema); lo nuevo que no sea MEDIUM o superior se aplaza con su motivo. Esta lista vive en `reviews/` para no dejar tareas abiertas en el snapshot de la puerta. Al planificarla, cada entrada se convierte en una tarea SDD. Tarea de referencia: T004.

1. **C-003 = A-002 = F-002** (LOW): `entriesUnder` filtra por `browser/` con comparación sensible a mayúsculas, y en Windows el sistema de archivos no la distingue (`Browser/`).
   - **Motivo del aplazamiento**: el artefacto lo genera el propio build con `browser/` en minúsculas; no es entrada externa.
   - **Riesgo residual**: un artefacto con la carpeta en otra capitalización en Windows no se trataría como `browser/` bajo `entriesUnder`.
   - **Plan**: comparar sin distinguir mayúsculas en la próxima spec de deuda que toque `scripts/artifact-pages.mts`.
2. **C-002 = A-003 = B-001** (LOW): `specs/README.md:69` dice «en curso» para S-003 = A-002, ya cerrada por spec008 T002–T003.
   - **Motivo del aplazamiento**: corregirlo cambia el snapshot de la puerta.
   - **Plan**: se actualiza fuera del snapshot en la próxima tarea SDD que toque `specs/README.md`.
3. **S-002** (LOW): TOCTOU residual entre la lectura del directorio y `readFile` de cada página.
   - **Motivo del aplazamiento**: aceptado en research R4; el artefacto es local y no cambia mientras corren las puertas.
   - **Riesgo residual**: teórico.
4. **B-002** (LOW, best-practices r1): `countDirReads` está duplicado en `scripts/artifact-pages.test.mts` y `scripts/check-assets.test.mts`.
   - **Motivo del aplazamiento**: duplicación de pruebas sin efecto funcional.
   - **Plan**: extraer a un ayudante común de pruebas en la próxima spec de deuda que toque esas suites.

Resueltos por T005 (no son deuda): S-001 y F-001 (mismo tema que A-001).
