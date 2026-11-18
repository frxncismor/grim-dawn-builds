# Estado de las specs

Registro vivo del avance por spec (fuente de verdad: el `tasks.md` de cada una).
Actualizado el 2026-11-17 (T010 de spec006).

| Spec                                                                    | Estado                                     | Tareas hechas | Pendientes |
| ----------------------------------------------------------------------- | ------------------------------------------ | ------------- | ---------- |
| [001-mvp-guias-builds](001-mvp-guias-builds/tasks.md)                   | Abierta, casi cerrada                      | 153           | 20         |
| [002-spec-completion-reviews](002-spec-completion-reviews/tasks.md)     | Completa                                   | 17 de 17      | 0          |
| [003-catalogo-arboles-maestria](003-catalogo-arboles-maestria/tasks.md) | Cerrada (puerta spec002 passed, `1fd7e77`) | 41 de 41      | 0          |
| [004-rediseno-ui-grim-dawn](004-rediseno-ui-grim-dawn/tasks.md)         | Cerrada (puerta spec002 passed, `f41d844`) | 54 de 54      | 0          |
| [005-deuda-revisiones](005-deuda-revisiones/tasks.md)                   | Cerrada (puerta spec002 passed, `cc553c3`) | 41 de 41      | 0          |
| [006-deuda-revisiones-2](006-deuda-revisiones-2/tasks.md)               | Implementada; puerta spec002 en curso      | 8 de 10       | 2          |
| [007-deuda-revisiones-3](007-deuda-revisiones-3/tasks.md)               | Planificada (2026-11-18)                   | 0 de 6        | 6          |

## 001-mvp-guias-builds

Hechas recientemente: T-167 (fachada de video con `lite-youtube-embed` bajo la CSP).

Pendientes:

- **T-043**: checklist de accesibilidad preparada (`checklists/a11y.md`); falta la
  revisión manual (teclado, NVDA, contraste) y la firma.
- **T-075**: mover `content/` a fixtures (opcional, no seleccionada).
- **T-092..T-100**: ingesta de fuentes (diferida; requiere spec propia).
- **T-114..T-122**: identidad y comunidad (diferida; requiere spec propia).
- Puerta de cierre de spec002 (cuatro revisiones) al cerrar la spec.
- Relevo detallado: [handoff.md](001-mvp-guias-builds/handoff.md).

## 003-catalogo-arboles-maestria

Cerrada. T001-T041 hechas (41 de 41). Puerta spec002 y T-136 passed en `1fd7e77`
(snapshot `a5a33731…`). Los LOW S3-T042 (códigos de error de `seed-content`) y
S3-T043 (contrato lanzador-seeder en un módulo compartido) se aplazaron y los
resolvieron spec005 T003 y T004.

## 004-rediseno-ui-grim-dawn

T001-T054 marcadas; T036 (puerta spec002 + T-136) marcada antes de ejecutarla, según
el precedente; su resultado va en `specs/004-rediseno-ui-grim-dawn/reviews/`. Cerrada
(puerta spec002 `passed`, `f41d844`).

## 005-deuda-revisiones

Implementación completa: T001-T041 marcadas (41 de 41); T018 (puerta spec002 + T-136)
marcada antes de ejecutarla, según el precedente (spec002 T014, spec003 T021, spec004
T036). Su verificación está en `005-deuda-revisiones/quickstart.md` («Evidencia de
cierre (T018)») y su resultado va en `005-deuda-revisiones/reviews/`. Cerrada (puerta
spec002 `passed`, `cc553c3`).

## 006-deuda-revisiones-2

Planificada el 2026-11-17 (P33 = A; P34: F-002, S-001 y mediana de `coldStartMs`
dentro, S3-T042/S3-T043 fuera por estar hechos). T001 (S4-D1, helper único de
páginas prerrenderizadas) va primero; T008 es la puerta spec002. Implementación
T001-T008 marcada (T008 antes de ejecutar la puerta, según el precedente). La ronda 1
de la puerta añadió T009 (guarda de celda de la poda, API) y T010 (e2e de la portada y
registro), abiertas; S-001 y B-002 se aplazan en `006-deuda-revisiones-2/reviews/deuda.md`.
