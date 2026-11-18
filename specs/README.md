# Estado de las specs

Registro vivo del avance por spec (fuente de verdad: el `tasks.md` de cada una).
Actualizado el 2026-11-18 (T004 de spec008).

| Spec                                                                    | Estado                                                                          | Tareas hechas | Pendientes |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- | ---------- |
| [001-mvp-guias-builds](001-mvp-guias-builds/tasks.md)                   | Abierta, casi cerrada                                                           | 153           | 20         |
| [002-spec-completion-reviews](002-spec-completion-reviews/tasks.md)     | Completa                                                                        | 17 de 17      | 0          |
| [003-catalogo-arboles-maestria](003-catalogo-arboles-maestria/tasks.md) | Cerrada (puerta spec002 passed, `1fd7e77`)                                      | 41 de 41      | 0          |
| [004-rediseno-ui-grim-dawn](004-rediseno-ui-grim-dawn/tasks.md)         | Cerrada (puerta spec002 passed, `f41d844`)                                      | 54 de 54      | 0          |
| [005-deuda-revisiones](005-deuda-revisiones/tasks.md)                   | Cerrada (puerta spec002 passed, `cc553c3`)                                      | 41 de 41      | 0          |
| [006-deuda-revisiones-2](006-deuda-revisiones-2/tasks.md)               | Cerrada (puerta spec002 passed, `c626f26`)                                      | 10 de 10      | 0          |
| [007-deuda-revisiones-3](007-deuda-revisiones-3/tasks.md)               | Cerrada (puerta spec002 passed, `95f18de`)                                      | 7 de 7        | 0          |
| [008-deuda-spec007](008-deuda-spec007/tasks.md)                         | Cerrada (puerta spec002 + T-136; evidencia en `reviews/completion-review.json`) | 4 de 4        | 0          |

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

Cerrada. T001-T010 hechas (10 de 10). Puerta spec002 y T-136 passed en `c626f26`
(fusionada en `mvp/1` en `81179fc`, PR #12). Planificada el 2026-11-17 (P33 = A; P34:
F-002, S-001 y mediana de `coldStartMs` dentro, S3-T042/S3-T043 fuera por estar hechos).
La ronda 1 de la puerta añadió T009 (guarda de celda de la poda, API) y T010 (e2e de la
portada y registro). Los aplazados S-001, B-002, S6-D1, S6-D2 y S6-D3 pasan a
[spec007](007-deuda-revisiones-3/tasks.md); S-001 y B-002 constan en
`006-deuda-revisiones-2/reviews/deuda.md`.

## 007-deuda-revisiones-3

Cerrada. T001-T007 hechas (7 de 7; T007 son las correcciones de la ronda 1 de la
puerta). Puerta spec002 y T-136 passed en `95f18de` (snapshot `bf9dac85…`), fusionada
en `mvp/1` en `1375dda` (PR #13). Planificada el 2026-11-18: LOW de spec006 (S-001
enlaces en el artefacto, B-002 regla de la combinación, S6-D1 a S6-D3) y el comentario
de la CI. Su deuda pasa a [spec008](008-deuda-spec007/tasks.md): el erratum DV1/DV2
(B-101 = A-101) y el registro (T001, hechos) y S-003 = A-002, en curso en spec008
T002–T003 (`007-deuda-revisiones-3/reviews/deuda.md`).

## 008-deuda-spec007

Cerrada (puerta spec002 + T-136; evidencia en `008-deuda-spec007/reviews/completion-review.json`). T001-T004 hechas (4 de 4): erratum DV1/DV2 y registro de spec007 (T001), lectura única del artefacto en `prerenderedPages` y `assertNoGamePortraits` (T002, T003) y verificación de integración con la puerta de cierre (T004). Cierra S-003 = A-002 de la deuda de [spec007](007-deuda-revisiones-3/tasks.md).
