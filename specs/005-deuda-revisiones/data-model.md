# Data Model: Deuda aplazada de las revisiones de spec003 y spec004

No hay entidades nuevas ni migraciones con las respuestas provisionales. Entradas de datos que cambian de dueño o de forma:

## Entrada de la lista pública de maestrías (T005, T006)

- Hoy: `MasterySummarySchema` en `apps/api/src/catalog/map-mastery.ts:42`; la web lo revalida a mano en `apps/web/src/app/core/content/masteries.server.ts:150-167` y tiene su propio tipo de vista (`apps/web/src/app/core/content/masteries.ts:9`).
- Después: un esquema único en `packages/domain` con los campos actuales y `.strict()`:

| Campo          | Tipo                                         | Regla                              |
| -------------- | -------------------------------------------- | ---------------------------------- |
| `id`           | el de `PublicMasteryTreeSchema.shape.mastery` | sin cambios                        |
| `slug`         | el de `PublicMasteryTreeSchema.shape.mastery` | sin cambios                        |
| `name`         | `{ en, es }`                                  | sin cambios                        |
| `game_version` | el de `PublicMasteryTreeSchema`               | sin cambios                        |
| `node_count`   | entero                                        | `>= 0`                             |

- El modelo de vista de la web (`nodeCount`, `name` anulable, `portrait`) no cambia; solo cambia cómo se valida la respuesta.

## Contrato lanzador–sembrador (T002)

Ver [contracts/seed-contract.md](contracts/seed-contract.md).

## Maestría retirada (T007)

- Estado inicial: fila de `mastery_trees` con nodos en `catalog_skill_nodes`, ausente de las fixtures.
- Transición con Q-A = A: se borran sus nodos y la fila en la transacción de la siembra. Si algún `build_skill_nodes.skill_node_id` apunta a sus nodos, la restricción (`ON DELETE restrict`, migración 0010) aborta la transacción y se lanza `SeedError` con la maestría y el motivo. Sin cambios de esquema.

## Entrada de tarjeta de build (T012)

- Se elimina `masteries[].name?: string` de `BuildCardInput` (`apps/web/src/app/shared/ui/build-card/build-card.model.ts:23-27`). El resto del tipo no cambia.
