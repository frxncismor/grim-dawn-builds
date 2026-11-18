# T-136: revisión final de código de spec007 (ronda 2)

Revisión final independiente con el modelo más potente disponible (Claude Opus 5.5, `claude-opus-5-5`, Claude Code), adicional a las cuatro revisiones de la puerta spec002 de `completion-review.json`. Snapshot `bf9dac8549f5fc008f944dcdcee95c1c1f73c8d8361f52952ad478daaa511959`, HEAD `8f8cf8c`. Resultado de la ronda 2: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW.

Alcance: la huella completa de spec007 (`git diff 81179fc..8f8cf8c`, 25 archivos), con prioridad al código ejecutable, y la corrección T007 (`git diff bb237c3..8f8cf8c`: tres archivos de pruebas y cinco de docs, ningún archivo de producción).

Ronda anterior: ronda 1 (F-001 y F-002, ambos LOW), corregidos en T007. Reporte: `C:/Users/paco_/.config/orquestacion/runs/11111619/11111619-revisor-cierre-s7-t136-reporte.md`. Reporte de la ronda 2: `C:/Users/paco_/.config/orquestacion/runs/11111619/11111619-revisor-cierre-s7-t136-r2-reporte.md`.

## Informe (Review)

```json
{
  "specialty": "code",
  "reviewer": "11111619-revisor-cierre-s7-t136-r2 (claude-opus-5-5, Claude Code)",
  "mode": "independent",
  "status": "completed",
  "coverage": [
    "git diff 81179fc..8f8cf8c (25 archivos; código ejecutable revisado línea a línea)",
    "git diff bb237c3..8f8cf8c (T007: solo pruebas y docs; ningún archivo de producción cambia)",
    "scripts/artifact-pages.mts (assertRegularEntries, prerenderedPages) y scripts/check-assets.mts (assertNoGamePortraits)",
    "scripts/artifact-pages.test.mts y scripts/check-assets.test.mts (t.skip ante EPERM/EACCES, prueba nueva del enlace fuera de browser/)",
    "apps/web/src/app/shared/ui/build-card/{build-card.labels.ts,build-card.ts,build-card.model.ts,build-card.spec.ts}",
    "apps/web/src/app/features/home/home.page.spec.ts (3 ids, aria-describedby por tarjeta, control no vacuo)",
    "e2e/a11y.spec.ts (bloque @a11y T010, al menos un id)",
    ".github/workflows/ci.yml (comentario visual-regression) y scripts/ci-workflow.test.mts",
    "specs/007-deuda-revisiones-3/reviews/deuda.md (S-003 = A-002 aplazado) y la fila de spec007 en specs/README.md (lectura)",
    "Reporte de la ronda 1: 11111619-revisor-cierre-s7-t136-reporte.md (F-001, F-002)"
  ],
  "checks": [
    {
      "name": "git rev-parse --short HEAD && git status --short",
      "result": "8f8cf8c; árbol limpio antes y después"
    },
    {
      "name": "git diff --stat bb237c3..8f8cf8c",
      "result": "8 archivos: 3 de pruebas (home.page.spec.ts, artifact-pages.test.mts, check-assets.test.mts) y 5 de docs; ningún archivo de producción"
    },
    {
      "name": "node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts",
      "result": "26 tests: 25 pass, 0 fail, 1 skipped (enlace de archivo, EPERM en esta máquina)"
    },
    {
      "name": "npx ng test --watch=false --include src/app/shared/ui/build-card/build-card.spec.ts --include src/app/features/home/home.page.spec.ts (apps/web)",
      "result": "2 archivos, 44 tests passed"
    }
  ],
  "limitations": [
    "No se ejecutaron pnpm verify, builds, e2e, check:performance ni la regresión visual (fuera del encargo; la evidencia de integración de T006 en quickstart.md sigue vigente, porque T007 no toca código de producción).",
    "La prueba del enlace simbólico de archivo se omite en esta máquina por EPERM (ahora con t.skip visible); su rama se razonó leyendo el código.",
    "La eficacia de la prueba nueva del enlace fuera de browser/ se razonó por lectura (readdirSync recursivo no entra en junctions, así que sin assertRegularEntries(artifact) el escaneo no vería el PNG y assert.throws fallaría); no se hizo mutación del código."
  ],
  "findings": []
}
```

## Resumen del revisor

**Modelo usado**: Claude Opus 5.5 (`claude-opus-5-5`) en Claude Code.

### Estado de los hallazgos de la ronda 1

- **F-001 (LOW): corregido sin regresión.** La prueba nueva de `check-assets.test.mts` deja `browser/` limpio y pone la junction en `server/linked`, de modo que solo `assertRegularEntries(artifact, gate)` (`scripts/check-assets.mts:162`) puede detectarla; ya no es vacua.
- **F-002 (LOW): corregido.** La prueba de la portada (`home.page.spec.ts`) exige exactamente 3 ids distintos, que el `aria-describedby` de cada enlace apunte a la línea de su propia tarjeta y un control que duplica una tarjeta para comprobar que el detector ve el duplicado. La comprobación de `lang` la cubre `build-card.spec.ts` (T002).
- Las tres pruebas de enlaces usan `t.skip` solo ante EPERM o EACCES y relanzan cualquier otro error: ya no pasan en silencio.
- S-003 = A-002 (doble recorrido, TOCTOU teórico) sigue aplazado con motivo en `reviews/deuda.md`, tarea de referencia T006.

### Comprobaciones ejecutadas (salida real del revisor)

- `git status --short`: árbol limpio, HEAD `8f8cf8c`.
- `node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts`: 26 tests, 25 pass, 0 fail, 1 skipped (enlace de archivo, EPERM en esa máquina).
- `npx ng test --watch=false --include src/app/shared/ui/build-card/build-card.spec.ts --include src/app/features/home/home.page.spec.ts` (apps/web): 2 archivos, 44 tests passed.

### Hallazgos por severidad

0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW.

### Limitaciones

- No se ejecutaron `pnpm verify`, builds, e2e, `check:performance` ni la regresión visual (fuera del encargo; la evidencia de T006 en `quickstart.md` sigue vigente porque T007 no toca producción).
- La rama del enlace de archivo se omite en esa máquina por EPERM; se razonó por lectura.
- La eficacia de la prueba de F-001 se razonó leyendo el código, sin mutarlo.
