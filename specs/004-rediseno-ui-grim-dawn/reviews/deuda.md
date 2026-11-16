# Deuda aplazada en el cierre de spec004 (puerta T036, ronda 3)

Decisión del principal (2026-11-16, opción A, como en spec003): los 10 LOW de la ronda 3 se aplazan con su motivo, registrado en `completion-review.json` y `t136-review.md`. Esta lista vive en `reviews/` para no dejar tareas abiertas en el snapshot de la puerta. Al planificarla, cada entrada se convierte en una tarea SDD.

Prioridad, de mayor a menor:

1. **S4-D1**, puertas de crédito que pasan en vacío (A-003, B-002). `assertPortraitCredit` y `assertSkillIconCredit` (`scripts/check-assets.mts`) son copias casi literales y salen sin error si falta `browser/` o no hay páginas HTML. Plan: extraer un helper parametrizado (patrón, marcador, mensajes) que falle si el artefacto está vacío, y probar la regla «only then» del docstring o quitarla.
2. **S4-D2**, CSS global con selectores descendientes (A-002, B-001). `apps/web/src/styles/tier-components.css` usa `:is(gd-tier-row, …) button|input|.chip`, que alcanza las `gd-build-card` proyectadas. Plan: acotar a los hosts con combinador hijo o clases propias y corregir el comentario «nothing leaks». Hoy no hay efecto visible.
3. **S4-D3**, el estado de la tarjeta se anuncia dos veces (F-001 de T-136). Plan: `aria-hidden="true"` en `.build-card__status` cuando `srText` ya incluye el estado, o `srText` solo con enlace.
4. **S4-D4**, `track card.title` en `home.page.html:41` (C-001). Plan: usar `track card.href`.
5. **S4-D5**, cuatro copias del formateador de fecha larga UTC (A-004). Plan: un formateador común en `apps/web/src/app/shared/` con una sola política de validación.
6. **S4-D6**, campo muerto `BuildCardInput.masteries[].name` (A-005). Plan: quitarlo del tipo y de los specs.
7. **S4-D7**, docs (A-001, B-003). Plan: la regla de hojas globales con prefijo en `plan.md` y la huella real de T052 en `tasks.md`.

Deuda heredada de spec003, aún abierta: S3-T042 y S3-T043 (ver `specs/003-catalogo-arboles-maestria/tasks.md`).
