# Estado de las specs

Registro vivo del avance por spec (fuente de verdad: el `tasks.md` de cada una).
Actualizado el 2026-11-17.

| Spec                                                                    | Estado                                     | Tareas hechas | Pendientes |
| ----------------------------------------------------------------------- | ------------------------------------------ | ------------- | ---------- |
| [001-mvp-guias-builds](001-mvp-guias-builds/tasks.md)                   | Abierta, casi cerrada                      | 153           | 20         |
| [002-spec-completion-reviews](002-spec-completion-reviews/tasks.md)     | Completa                                   | 17 de 17      | 0          |
| [003-catalogo-arboles-maestria](003-catalogo-arboles-maestria/tasks.md) | Cerrada (puerta spec002 passed, `1fd7e77`) | 41 de 41      | 0          |
| [004-rediseno-ui-grim-dawn](004-rediseno-ui-grim-dawn/tasks.md)         | Implementada; puerta spec002 en curso      | 54 de 54      | 0          |
| [005-deuda-revisiones](005-deuda-revisiones/tasks.md)                   | Implementada; puerta T018 en curso         | 35 de 35      | 0          |
| [006-deuda-revisiones-2](006-deuda-revisiones-2/tasks.md)               | Planificada (sin implementar)              | 0 de 8        | 8          |

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
(snapshot `a5a33731…`). Quedan aplazados, con su motivo en su `tasks.md`, los LOW
S3-T042 (códigos de error de `seed-content`) y S3-T043 (contrato lanzador-seeder en
un módulo compartido).

## 004-rediseno-ui-grim-dawn

T001-T054 marcadas; T036 (puerta spec002 + T-136) marcada antes de ejecutarla, según
el precedente; su resultado va en `specs/004-rediseno-ui-grim-dawn/reviews/`.

## 005-deuda-revisiones

Implementación completa: T001-T035 marcadas (35 de 35); T018 (puerta spec002 + T-136)
marcada antes de ejecutarla, según el precedente (spec002 T014, spec003 T021, spec004
T036). Su verificación está en `005-deuda-revisiones/quickstart.md` («Evidencia de
cierre (T018)») y su resultado va en `005-deuda-revisiones/reviews/`.

## 006-deuda-revisiones-2

Planificada el 2026-11-17 (P33 = A; P34: F-002, S-001 y mediana de `coldStartMs`
dentro, S3-T042/S3-T043 fuera por estar hechos). T001 (S4-D1, helper único de
páginas prerrenderizadas) va primero; T008 es la puerta spec002. Las filas de
spec004 y spec005 se actualizan en T004.
