# T-136: revisión final de código de spec003 (ronda 3)

Revisión final independiente con el modelo más potente disponible (claude-opus-5-5, Claude Code), adicional a las cuatro revisiones de la puerta spec002 de `completion-review.json`. Snapshot `a5a33731e905d087031bbc09879b0098217feea4a44d8f2c04bd8dc961a80adf`, HEAD `e40120c`. Resultado: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW (F-001, aplazado por decisión del principal el 2026-11-15; seguimiento T042).

## Informe (Review)

```json
{
  "specialty": "code",
  "reviewer": "11111619-revisor-cierre-t136-r3 (claude-opus, Claude Code)",
  "mode": "independent",
  "status": "completed",
  "coverage": [
    "git diff d7eb827..e40120c (226 archivos; prioridad al código ejecutable)",
    "apps/api/src/db/seed.mts, bootstrap.mts, write-content.mts (T039: SEED_CONTENT_ROOT, seedCompleteLine/bootstrapCompleteLine, writeCatalogRows, NON_EDITORIAL_TABLES)",
    "scripts/seed-content.mts y scripts/seed-content.test.mts (montaje /content, successPattern, mapeo de códigos de error)",
    "apps/api/drizzle/0010_skill_node_id.sql, 0012_skill_node_id_unique_and_revalidation.sql, 0013_public_skill_nodes_without_icon.sql",
    "apps/api/src/routes/masteries.ts, apps/api/src/catalog/{mastery-repository,map-mastery}.ts",
    "packages/domain/src/skill-node-refs.ts",
    "apps/web/src/app/core/content/{masteries.server,mastery.guard,public-site.guard,portraits,portraits.server}.ts",
    "apps/web/src/app/shared/svg/skill-tree/skill-tree.ts (modo catálogo y asignación)",
    "apps/web/tools/{emit-static-assets,emit-portraits}.mts, scripts/build-e2e-drafts.mts (T041 C-002)",
    "scripts/build-release.mts, scripts/public-build-env.mts, scripts/check-assets.mts (assertGameAssets, assertNoGamePortraits)",
    "specs/003-catalogo-arboles-maestria/tasks.md (T035–T041 y aplazamientos A-01, A-03, C-003, A-01/B-008, C-001/F-003)"
  ],
  "checks": [
    "node --import tsx --test scripts/seed-content.test.mts scripts/build-e2e-drafts.test.mts scripts/build-release.test.mts → 16 pass, 0 fail",
    "apps/api: npx vitest run src/db/seed.spec.ts src/db/bootstrap.spec.ts src/routes/masteries.spec.ts src/catalog/map-mastery.spec.ts → 4 archivos, 38 tests passed",
    "Lectura del registro de pnpm verify final en quickstart.md (no repetido por este revisor)"
  ],
  "limitations": [
    "No se ejecutó pnpm verify completo, ni las pruebas de integración con Docker/PostgreSQL (skill-node-id.int.spec.ts, seed.int.spec.ts, mastery-*.int.spec.ts), ni e2e/Lighthouse: otros revisores comparten el árbol y la máquina; se confía en la evidencia registrada en tasks.md/quickstart.md para T039/T040.",
    "Fixtures JSON (fixtures/content/**), snapshots de drizzle/meta y la mayor parte de plantillas/CSS/locales se revisaron solo por muestreo.",
    "No se re-ejecutó pnpm db:seed / db:bootstrap reales en contenedor."
  ],
  "findings": [
    {
      "id": "F-001",
      "severity": "LOW",
      "path": "scripts/seed-content.mts",
      "line": 172,
      "evidence": "El lanzador solo reenvía los códigos invalid-content|role|already|not-empty|migration|credentials|database-failed|bootstrapped. runSeeder/readSeedFixtures/prepareSeed emiten además 'seed failed: fixture-read', 'duplicate', 'reference', 'conflicting-resource', 'owned-content' y 'configuration-or-database', que caen en throw new Error('Seed failed') → 'seed failed: local-container'. La regex además va anclada a todo stderr sin flag m, por lo que cualquier línea extra (p. ej. un warning de Node) también la anula.",
      "impact": "Sin defecto de datos (falla cerrado), pero el diagnóstico se pierde justo en el modo de fallo que corrigió T039: si el montaje y SEED_CONTENT_ROOT vuelven a divergir, el usuario ve 'local-container' (que sugiere un problema de Docker) en vez de 'fixture-read'; lo mismo con un fixture con referencia rota o duplicado.",
      "recommendation": "Añadir a la lista los códigos fijos que pueden emitir seed.mts/bootstrap.mts (fixture-read, duplicate, reference, conflicting-resource, owned-content, configuration-or-database) o derivarla de una constante compartida, y buscar la línea con flag m (/^seed failed: (...)\\s*$/m) en lugar de exigir que stderr sea solo esa línea; prueba con stderr 'seed failed: fixture-read'.",
      "disposition": "deferred",
      "deferReason": "Aplazado por decisión del principal (2026-11-15, opción A): mismo defecto que C-001 de la revisión de código; solo afecta a la precisión del mensaje de error del lanzador local, el fallo se detecta igual. Seguimiento registrado como T042."
    }
  ]
}
```

## Resumen del revisor

### T-136 (spec003, ronda 3) — revisión final de código

### Resumen

**Modelo realmente usado:** Claude Opus 5.5 (`claude-opus-5-5`) en Claude Code.

**Alcance cubierto.** Huella completa de spec003 `d7eb827..e40120c` en HEAD `e40120c`, priorizando código ejecutable: seed/bootstrap y su lanzador en contenedor (T039), escritura del catálogo y su refresco, migraciones 0010/0012/0013 (triggers diferidos de revalidación, índice único parcial, vista pública sin `icon`), rutas/repositorio/mapeo de la API de maestrías, validador de dominio `validateSkillNodeRefs`, fuente web de maestrías (fixture/API sin fallback), guards de navegación por documento, retratos (`own`/`game`, `assertGameAssets`, `assertNoGamePortraits`, `emitPortraits`), `build-e2e-drafts` (T041 C-002), `build-release`/`public-build-env` (`ASSET_SOURCE` explícito en release) y el componente `skill-tree` en modo catálogo/asignación.

**Correcciones nuevas de la ronda 2 (foco pedido):**

- T039: el montaje `fixtures/content → /content` y `SEED_CONTENT_ROOT=/content` coinciden (constante `CONTENT_MOUNT` y prueba); `seedContentRoot` cae a `../../../../fixtures/content/` que resuelve a la raíz del repo tanto desde `src/db` como desde `dist/db`; `successPattern` coincide con `seedCompleteLine`/`bootstrapCompleteLine` (probado contra la salida real del módulo). `bootstrap` excluye `mastery_trees`/`catalog_skill_nodes` de la comprobación «vacío» y escribe el catálogo antes del contenido. Sin defectos; solo el LOW F-001 sobre el mapeo de códigos de error (preexistente en forma, pero ahora es el canal que diagnosticaría una regresión de T039).
- T040: no repetido con PostgreSQL (limitación); el diseño de los triggers diferidos de 0012 es coherente con lo que afirman las pruebas.
- T041: `build-e2e-drafts` encadena build y `emit-static-assets` y no emite si el build falla; tipos `PublicMasteryTree` usados en web y API. Sin defectos.

**Comprobaciones ejecutadas (resultado real):**

- `node --import tsx --test scripts/seed-content.test.mts scripts/build-e2e-drafts.test.mts scripts/build-release.test.mts` → 16 pass, 0 fail.
- `npx vitest run` (apps/api) sobre `seed.spec`, `bootstrap.spec`, `routes/masteries.spec`, `catalog/map-mastery.spec` → 38 passed.

**Hallazgos por severidad:** CRITICAL 0, HIGH 0, MEDIUM 0, LOW 1 (F-001, `scripts/seed-content.mts:172`). Los aplazamientos registrados en `tasks.md` (A-01, A-03, C-003; A-01/B-008 regla de emparejamiento triplicada; C-001/F-003 refresco con UNIQUE no diferible) siguen presentes, pero ya tienen disposición y no se registran otra vez.

**Limitaciones:** no ejecuté `pnpm verify`, ni las integraciones con Docker/PostgreSQL, ni e2e (hay otros revisores en paralelo); fixtures y snapshots de drizzle solo por muestreo; no repetí `db:seed`/`db:bootstrap` en contenedor.
