# Quickstart: validar el rediseño de UI

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

> Guía de validación **prevista** (clarify cerrado el 2026-11-15; `tasks.md` T001–T037): los comandos son los que ya existen en `package.json` (`pnpm verify` y sus
> piezas) más los e2e nuevos que crearán las tareas. Las salidas reales de cierre se registrarán aquí cuando se
> implemente la spec; hoy no hay ninguna. Una casilla de `tasks.md` no se marca sin evidencia citable.

## Prerrequisitos

- Node 22 LTS y pnpm; dependencias instaladas (`pnpm install`).
- Docker para el release con la API (`CONTENT_SOURCE=api`); no hace falta para fixtures.
- Para extraer los iconos del juego (Q11 = B, **solo tras la puerta G1**: análisis de riesgos y enmienda 1.11.0 aprobadas): instalación legal de Grim Dawn y el extractor de texturas (carpeta `.game-assets/` ignorada por git); los PNG derivados se versionan después, con manifiesto.
- `impeccable` se invoca por ruta absoluta desde el checkout principal (está gitignorado): `C:\Users\paco_\Documents\GitHub\grim-dawn-builds\.agents\skills\impeccable\scripts\impeccable.cmd`.

## Escenarios de validación

| Escenario                                    | Comando                                                                          | Resultado esperado                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Markdown sano                                | `pnpm lint:md`                                                                   | 0 issues                                                                                                            |
| Alcance                                      | `pnpm check:scope`                                                               | sin hallazgos                                                                                                       |
| Puerta local completa                        | `pnpm verify`                                                                    | exit 0                                                                                                              |
| Presupuestos de §6 (SC-005, SC-006)          | `pnpm check:performance`                                                         | todas las comprobaciones OK; HTML ≤ 120 000 B y CSS gzip ≤ 20 000 B por ruta                                         |
| JS inicial                                   | `pnpm check:initial-js`                                                          | `/` 0 B (≤ 90 000), `/tier-list` ≤ 112 000, `/builds/:slug` ≤ 150 000                                               |
| Accesibilidad (SC-004)                       | `pnpm e2e:a11y`                                                                  | 0 violaciones critical/serious en las cinco rutas, EN y ES, 375/768/1280                                             |
| Recorrido (SC-001, SC-003)                   | `pnpm e2e:journeys`                                                              | portada → guía en ≤ 2 clics; tooltip a ≤ 16 px del nodo y dentro del viewport (ratón, teclado, toque)                |
| Contraste                                    | `pnpm check:contrast`                                                            | tokens con contraste ≥ 4,5:1 (texto) y ≥ 3:1 (controles)                                                             |
| Paridad EN/ES (SC-008)                       | `pnpm check:locale-parity`                                                       | mismas secciones y cadenas                                                                                          |
| Tipado de e2e (deuda T042/B-001)             | `pnpm typecheck:e2e`                                                             | exit 0, y forma parte de `pnpm verify`                                                                              |
| Activos (SC-009, FR-017, FR-019)             | `pnpm assets:check`                                                              | manifiesto válido con entradas de iconos y `proof_ref` a `research.md#r10`; artefacto `own` sin arte del juego; `game` con entrada inválida falla cerrado; sin rutas internas de textura en la vista pública |
| Orden de gobernanza (SC-009)                 | revisión del historial: T003 y T004 antes de T027                                | enmienda 1.11.0 y análisis de riesgos registrados antes del primer PNG de icono versionado                          |
| Anti «AI slop» (SC-010)                      | `impeccable.cmd detect --json <archivos cambiados>`                              | sin hallazgos de reglas deterministas; pruebas de componente sin tarjetas anidadas                                  |
| Revisión visual (SC-011)                     | capturas 375/768/1280, EN y ES, de las cinco rutas y de los tres estados del tooltip | aprobadas por Paco o lista de cambios cerrada                                                                       |
| Cierre de spec                               | `node scripts/spec-review.mjs prepare --feature specs/004-rediseno-ui-grim-dawn` y `check` | `status: passed` tras las cuatro revisiones de la puerta spec002                                       |

## Evidencia de cierre

_Vacía: se rellena al implementar (salidas reales con fecha y commit)._
