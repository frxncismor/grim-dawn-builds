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

`already`, `bootstrapped`, `column`, `conflicting-resource`, `configuration-or-database`, `credentials`, `database-failed`, `database-result`, `duplicate`, `environment`, `fixture-read`, `invalid-content`, `migration`, `not-empty`, `owned-content`, `reference`, `role`, `table`.

## Reglas

- `scripts/` y `apps/api` importan el módulo; ninguno importa código del otro.
- El lanzador reconoce exactamente el conjunto de la unión; un código fuera de ella se informa como desconocido de forma explícita.
- La prueba valida que cada línea de éxito generada por la función cumple el patrón y que una línea truncada o ajena no lo cumple.
- El módulo no transporta secretos ni valores de entorno sensibles.
