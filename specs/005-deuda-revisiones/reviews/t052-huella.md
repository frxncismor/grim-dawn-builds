# Huella real de T052 (S4-D7, B-003)

Origen: hallazgo B-003 de la puerta de spec004 (`specs/004-rediseno-ui-grim-dawn/reviews/completion-review.json`). Por la decisión
Q-D = A de spec005, esta nota vive aquí y no se edita ningún archivo de `specs/004-*`.

## Lo que declaraba la tarea

`specs/004-rediseno-ui-grim-dawn/tasks.md`, línea de T052: «`apps/web/src/app/features/{tier-list,home}/`».

## Lo que tocó de verdad

Commit `5a758ef` (`fix(web): keep the combination name on build cards, localize names and the featured date, and win back initial JS on the tier list (T052)`), unido por el merge `bad1ac6`. `git show --stat 5a758ef`: 21 archivos, 311 inserciones, 183 borrados.

Dentro de lo declarado (`features/{tier-list,home}/`, 11 archivos):

- `apps/web/src/app/features/home/featured-guide.ts` y `featured-guide.spec.ts` (borrados)
- `apps/web/src/app/features/home/home-builds.ts` y `home-builds.spec.ts`
- `apps/web/src/app/features/home/home.page.html`, `home.page.ts` y `home.page.spec.ts`
- `apps/web/src/app/features/tier-list/card-data.ts` y `card-data.spec.ts`
- `apps/web/src/app/features/tier-list/tier-components.ts`
- `apps/web/src/app/features/tier-list/tier-list.page.ts`

Fuera de lo declarado (10 archivos):

- `apps/web/src/app/shared/ui/build-card/build-card.ts`, `build-card.model.ts`, `build-card.labels.ts` y `build-card.spec.ts` (componente compartido)
- `apps/web/src/styles.css` (importa las hojas globales)
- `apps/web/src/styles/build-card.css` (nuevo)
- `apps/web/src/styles/tier-components.css` (movido desde `features/tier-list/`, con cambios)
- `apps/web/src/styles/tier-list.css` (movido desde `features/tier-list/tier-list.page.css`, con cambios)
- `e2e/a11y.spec.ts` y `e2e/journeys.spec.ts`

Lo no declarado incluye el CSS global y el componente compartido, que es lo de más riesgo de la ronda. La regla que explica
las hojas globales está en `apps/web/DESIGN.md`, sección «Hojas globales».

## Después

El commit `e22deee` (merge `445c2ac`) marcó T052–T054 y solo tocó `plan.md`, `quickstart.md`, `tasks.md` y `specs/README.md` de
spec004; no cambió la huella de código.
