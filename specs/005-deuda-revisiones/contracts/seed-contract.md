# Contrato lanzador–sembrador (T002)

Fuente única en `packages/domain` (Q-E = A; nombre del archivo a confirmar al implementar). Hoy está repartido entre `scripts/seed-content.mts:20-27` y `apps/api/src/db/{seed,bootstrap}.mts`.

## Contenido

| Elemento                | Hoy                                                                 | Después                                             |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Ruta del contenido      | `CONTENT_MOUNT = '/content'` y `SEED_CONTENT_ROOT` en el lanzador    | constante compartida                                |
| Línea de éxito `seed`   | `seedCompleteLine` en `seed.mts:179` y regex en el lanzador          | función y patrón en el módulo, derivados entre sí   |
| Línea de éxito `bootstrap` | `bootstrapCompleteLine` en `bootstrap.mts:59` y regex en el lanzador | idem                                              |
| Códigos de error        | unión parcial en `BootstrapError`, `string` en `SeedError`, regex de 8 códigos | una unión cerrada; `SeedError`/`BootstrapError` y el lanzador la usan |

## Conjunto de códigos de error (a enumerar en la prueba)

`already`, `arguments`, `bootstrapped`, `column`, `conflicting-resource`, `configuration-or-database`, `credentials`, `database-failed`, `database-result`, `duplicate`, `environment`, `fixture-read`, `invalid-content`, `migration`, `not-empty`, `owned-content`, `reference`, `role`, `table`.

## Línea de fallo y detalle (T036)

Todo fallo se escribe con un único formateador del dominio, `failureLine(operation, code, detail?)`: `<operación> failed: <código>[ (<detalle>)]` (por ejemplo `seed failed: reference (class09)`). El seeder, el *bootstrap* y el lanzador lo usan; no quedan líneas de fallo escritas a mano.

- El detalle es opcional y solo puede ser un identificador, `[a-z0-9][a-z0-9_-]{0,63}`: `failureLine` descarta lo que no lo cumple (espacios, SQL, valores) y `failurePattern` no lo reconoce. `failurePattern` captura el código (grupo 1) y el detalle (grupo 2).
- Maestría retirada que aún usan guías: `seed failed: reference (class09)`, con el id de la maestría (`classNN`, su nombre estable en la base y en las fixtures; no el nombre localizado). `SeedError` y `BootstrapError` llevan `detail` como campo.
- Un catálogo vacío (`mastery-trees/` sin árboles) falla con `invalid-content` y nunca retira el catálogo; no hay código nuevo para ello.
- `bootstrapData` reenvía el código (y el detalle) de un `SeedError` en vez de `database-failed`; `bootstrap failed: arguments` entra en la unión (`arguments`).
- El lanzador reenvía con `failureLine`. Una línea bien formada con un código fuera de la unión, o con un detalle que no es un identificador, se informa como `unknown` sin eco.
- La prueba de SC-002 lee los fuentes reales de seed y bootstrap y compara los códigos que emiten con la unión; falla si se escribe un literal nuevo.

## Reglas

- `scripts/` y `apps/api` importan el módulo; ninguno importa código del otro.
- El lanzador reconoce exactamente el conjunto de la unión; un código fuera de ella se informa como desconocido de forma explícita.
- La prueba valida que cada línea de éxito generada por la función cumple el patrón y que una línea truncada o ajena no lo cumple.
- El módulo no transporta secretos ni valores de entorno sensibles.
