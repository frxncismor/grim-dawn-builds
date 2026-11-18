# Erratum de spec007: DV1 y DV2 invertidas en T007

**Spec afectada**: [007-deuda-revisiones-3](../007-deuda-revisiones-3/tasks.md) (cerrada, puerta spec002 `passed` en `95f18de`, snapshot `bf9dac85…`).
**Origen**: B-101 = A-101 (LOW, best-practices y architecture, ronda 2 de la puerta T006), aplazado en `specs/007-deuda-revisiones-3/reviews/deuda.md`.
**Registrado por**: spec008 T001 (2026-11-18).

## Texto erróneo

El criterio (4) de T007 en `specs/007-deuda-revisiones-3/tasks.md:68` dice:

> las desviaciones aprobadas se llaman DV1 (regla en `buildCardData`) y DV2 (prueba de componente de 3 guías)

Está **invertido**: asigna cada identificador a la desviación contraria.

## Texto correcto

| ID      | Desviación                                                                  | Origen | Tarea de spec007 |
| ------- | --------------------------------------------------------------------------- | ------ | ---------------- |
| **DV1** | Caso de componente de `HomePage` con 3 guías (en lugar de e2e con 2+ guías) | S6-D3  | T003             |
| **DV2** | Regla de la combinación impuesta en `buildCardData` (no en dominio/esquema) | B-002  | T002             |

## Fuente vigente

Manda la tabla «Desviaciones aprobadas» de `specs/007-deuda-revisiones-3/plan.md:135-136` y su espejo
`specs/007-deuda-revisiones-3/reviews/analyze.md:11-12`. Ambas coinciden con la tabla de arriba; la única
discrepancia es la línea 68 de `tasks.md`.

## Por qué `tasks.md` de spec007 no se edita

`tasks.md` entra en el snapshot de la puerta de spec007 (`scripts/spec-review.mjs` solo excluye `.specify/feature.json` y
`specs/*/reviews/**`). Corregirlo cambiaría el snapshot `bf9dac85…` con el que la puerta quedó en `passed` (FR-007 de
spec008). La corrección vive aquí, en spec008, y `reviews/deuda.md` de spec007 (fuera del snapshot) remite a este archivo.
