# T-136: revisión final de código de spec006 (ronda 2)

Revisión final independiente con el modelo más potente disponible (claude-opus-5-5, Claude Code), adicional a las cuatro revisiones de la puerta spec002 de `completion-review.json`. Snapshot `545c6e5a2ddfac1f4bf853ac310ffc6da2d6a7a6a0c1ea6c8e6ccd651fc665a4`, HEAD `f0c944f`. Resultado: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW. F-101 (= S-001) y F-102 (= B-002) quedan aplazados por decisión de Paco el 2026-11-17 (P36 = A); seguimiento en `deuda.md`.

Ronda anterior: ronda 1 (F-001 MEDIUM, renombrado en sitio en la misma celda; corregido en T009).

## Informe (Review)

```json
{
  "specialty": "code",
  "reviewer": "11111619-revisor-cierre-s6-t136-r2 (claude-opus, Claude Code)",
  "mode": "independent",
  "status": "completed",
  "coverage": [
    "git diff d18e34a..f0c944f (correcciones de la ronda 1: T009, T010 y registro SDD), con prioridad al código ejecutable",
    "apps/api/src/db/write-content.mts: writeCatalogRows (aparcado del nodo ausente fuera de la rejilla) y pruneCatalogNodes frente a la UNIQUE de celda, las CHECK de grid_col/grid_row (0009) y los triggers de 0010/0012",
    "apps/api/src/db/seed.mts y apps/api/src/db/bootstrap.mts: orden writeCatalogRows -> writeContentRows -> pruneCatalogNodes -> retireMasteries en los tres llamadores; editor.mts no toca el catálogo",
    "packages/domain/src/mastery-tree.ts (grid.row entero no negativo, sin cota superior) y fixtures/content/mastery-trees/*.json (fila máxima 459) para validar el desplazamiento de +1000000",
    "apps/api/test/seed.int.spec.ts: prueba nueva del renombrado en sitio (ida, idempotencia y vuelta en el finally) y la prueba existente del nodo retirado aún usado",
    "e2e/a11y.spec.ts: bloque T010 de la portada (/ y /es) frente a build-card.ts, home.page.html y home-builds.ts (clave guide.slug)",
    "Huella completa de spec006 git diff cc553c3..f0c944f ya cubierta en la ronda 1 (artifact-pages, check-assets, check-legacy-brand, visual-baselines-docker, build-card, card-data, home-builds, tier-preview, performance.int); se revisó de nuevo lo que aún afecta a la deuda aplazada",
    "specs/006-deuda-revisiones-2/{spec,tasks,quickstart}.md y reviews/{deuda,analyze}.md para disposiciones y evidencia"
  ],
  "checks": [
    {
      "name": "node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts scripts/check-legacy-brand.test.mts scripts/visual-baselines-docker.test.mts",
      "result": "31 pass, 0 fail"
    },
    {
      "name": "pnpm --filter @gd/api exec vitest run src/db/seed.spec.ts test/seed.int.spec.ts test/performance.int.spec.ts (sin RUN_DB_TESTS)",
      "result": "2 files passed, 1 skipped; 22 passed, 26 skipped (la parte con Postgres se omite)"
    },
    {
      "name": "apps/web: pnpm exec ng test --watch=false --include build-card.spec.ts card-data.spec.ts home-builds.spec.ts",
      "result": "3 files passed; 63 passed"
    },
    {
      "name": "git status --short tras las comprobaciones",
      "result": "0 entradas (árbol limpio)"
    }
  ],
  "limitations": [
    "No se ejecutaron suites con Postgres real (seed.int con RUN_DB_TESTS), e2e, build, pnpm verify ni Docker, por instrucción del encargo; para T009/T010 se confía en quickstart.md («Verificación tras las correcciones de la ronda 1»: vitest con BD 502 passed, e2e:a11y 183 passed).",
    "La corrección de T009 se valida por lectura del SQL, las restricciones de 0009 y los triggers de 0010/0012, no reproduciéndola con Postgres.",
    "Revisión de solo lectura; el texto SDD se revisó solo para disposiciones."
  ],
  "findings": [
    {
      "id": "F-101",
      "severity": "LOW",
      "path": "scripts/artifact-pages.mts",
      "line": 27,
      "evidence": "Reaparece S-001 (security r1): readdirSync(..., { recursive: true, withFileTypes: true }) conserva solo entry.isFile(); no entra en carpetas enlazadas ni cuenta páginas .html enlazadas. Lo mismo en scripts/check-assets.mts:162 (escaneo de assertNoGamePortraits).",
      "impact": "Un llamador sin assertPublicBuild podría dejar pasar una carpeta de retratos enlazada por la puerta own; hoy el release lo corta assertPublicBuild sobre el mismo staging.",
      "recommendation": "Tratar como artefacto inválido toda entrada enlace o que no sea archivo ni directorio, con pruebas de carpeta y página enlazadas, según el plan de specs/006-deuda-revisiones-2/reviews/deuda.md.",
      "disposition": "deferred",
      "deferReason": "Aplazado por decisión de Paco 2026-11-17 en la ronda 1 de T008 (S-001), registrado con motivo y plan en specs/006-deuda-revisiones-2/reviews/deuda.md; tarea de referencia T008."
    },
    {
      "id": "F-102",
      "severity": "LOW",
      "path": "apps/web/src/app/shared/ui/build-card/build-card.labels.ts",
      "line": 69,
      "evidence": "Reaparece B-002 (best-practices r1): srCombination se fija con combinationLang y combination sin mirar href/externalHref; tras retirar la rama @else (T003), una tarjeta sin enlace con combinationLang no anunciaría la combinación (build-card.ts solo usa aria-describedby dentro de los enlaces y la línea visible es aria-hidden).",
      "impact": "Hoy ningún adaptador produce ese caso (lo fija build-card.spec.ts); un adaptador futuro haría desaparecer la combinación para lectores de pantalla sin que falle ninguna prueba del componente.",
      "recommendation": "Hacer cumplir el invariante en buildCardData midiendo /tier-list, o documentarlo como contrato de los adaptadores con una prueba, según specs/006-deuda-revisiones-2/reviews/deuda.md.",
      "disposition": "deferred",
      "deferReason": "Aplazado por decisión de Paco 2026-11-17 en la ronda 1 de T008 (B-002), registrado con motivo y plan en specs/006-deuda-revisiones-2/reviews/deuda.md; tarea de referencia T008."
    }
  ]
}
```

## Resumen del revisor

**Modelo usado**: Claude Opus 5.5 (`claude-opus-5-5`) en Claude Code.

### Estado de los hallazgos de la ronda 1 (mi especialidad)

- **F-001 (MEDIUM, renombrado en sitio en la misma celda) → corregido por T009.** `writeCatalogRows` ya no decide con las guías previas. El nodo ausente que una guía aún usa y que ocupa la celda de un nodo entrante se aparca con `grid_row = grid_row + 1000000`. Después, `pruneCatalogNodes` lo borra cuando las guías ya están reescritas, o falla con 23503 → `SeedError('reference', mastery)` y deshace toda la transacción. Lo he comprobado así:
  - Las CHECK de 0009 se cumplen: `grid_col = tier` no cambia y `grid_row >= 0` sigue valiendo.
  - Ningún trigger de 0010/0012 mira `grid_row`: solo `mastery_id`, `slug` y `name_en`.
  - El importer tiene `UPDATE` sobre `catalog_skill_nodes`.
  - Una fila aparcada nunca sobrevive a una siembra correcta: o se poda o se hace rollback.
  - Dos filas aparcadas no pueden chocar, porque venían de celdas distintas.
  - Los tres llamadores (`seedCatalog`, `seedData`, `bootstrapData`) mantienen el orden correcto. En `seedCatalog`, sin reescribir guías, un nodo todavía usado sigue terminando en `reference`.
  - La prueba nueva de `seed.int.spec.ts` cubre la ida, la idempotencia y, en el `finally`, el renombrado inverso.
  - La prueba anterior («nodo nuevo en la celda de un nodo retirado aún usado») sigue esperando `reference`, que ahora sale de la poda.
- No hay regresiones en `git diff d18e34a..f0c944f`. El e2e T010 de la portada usa selectores que coinciden con `build-card.ts` (`[data-variant="featured"] a`, `build-card-combination-<key>`). La clave `guide.slug` no se repite entre la tarjeta destacada y las de «More builds», porque `published` tiene una entrada por guía.

### Huella completa

Revisé de nuevo la huella `cc553c3..f0c944f`, centrándome en lo que tocaron T009 y T010. No encontré defectos nuevos. Solo reaparecen las dos deudas ya aplazadas: las registro como `deferred`, citando T008 y `reviews/deuda.md`.

### Comprobaciones ejecutadas (salida real)

- Pruebas de `scripts/` (`artifact-pages`, `check-assets`, `check-legacy-brand`, `visual-baselines-docker`): **31 pass, 0 fail**.
- `vitest` de `@gd/api` (`seed.spec`, `seed.int`, `performance.int`, sin Postgres): 22 passed, 26 skipped.
- `ng test` de `build-card`, `card-data` y `home-builds`: **63 passed**.
- `git status --short` al terminar: limpio.

### Hallazgos por severidad

0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW (los dos aplazados):

- **F-101 (LOW, aplazado)**: es S-001. Los enlaces simbólicos se ignoran en `scripts/artifact-pages.mts:27` y en `scripts/check-assets.mts:162`.
- **F-102 (LOW, aplazado)**: es B-002. El invariante «sin enlace no hay `combinationLang`» solo lo garantizan los adaptadores (`build-card.labels.ts:69`).

**Descartado tras verificarlo**: que el desplazamiento de +1 000 000 choque con una fila real o se desborde. El esquema no acota `grid.row`, pero la fila máxima de los fixtures es 459 y `int4` admite el desplazamiento de sobra. Es un riesgo teórico, no demostrable con los datos del producto.

### Limitaciones

No ejecuté Postgres real, e2e, build, `pnpm verify` ni Docker, por instrucción del encargo. Para esa parte me baso en la evidencia de `quickstart.md`. T009 lo validé leyendo el SQL y las restricciones, no reproduciéndolo.
