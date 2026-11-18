# T-136: revisión final de código de spec005 (ronda 3)

Revisión final independiente con el modelo más potente disponible (claude-opus-5-5, Claude Code), adicional a las cuatro revisiones de la puerta spec002 de `completion-review.json`. Snapshot `8c9d04be1048388377d59178c67ae69348fed7902d9fcd5cfa96ea1ebbd4d204`, HEAD `0c9cf02`. Resultado: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW. F-301 (= L1, S5-D1) y F-302 (= F-002 de la ronda 2) quedan aplazados por decisión del principal el 2026-11-17 (opción B); seguimiento en `deuda.md`.

Rondas anteriores: ronda 1 (corregida en T036–T039), ronda 2 (B-06 a B-09 en T040 y C-101/F-001 en T041).

## Informe (Review)

```json
{
  "specialty": "code",
  "reviewer": "11111619-revisor-cierre-s5-t136-r3 (claude-opus, Claude Code)",
  "mode": "independent",
  "status": "completed",
  "coverage": [
    "Correcciones de la ronda 2: git diff b562d83..0c9cf02 completo en apps/ y e2e/ (T040 web: build-card.ts, tier-list.css, specs y e2e/journeys.spec.ts; T041 API: write-content.mts, seed-errors.spec.ts, seed.int.spec.ts) y su registro en specs/005-deuda-revisiones/{tasks,quickstart}.md y reviews/deuda.md",
    "Seguimiento de los hallazgos de la ronda 2 de mi especialidad: F-001 (T-136 r2) / C-101 (code r2), F-002 (T-136 r2, aplazado en reviews/deuda.md); y de los que tocan código de T040: B-06, B-07 y B-09",
    "T041: aparcamiento de slugs `released-<id>` contra el esquema real (mastery_trees_slug_unique, mastery_trees_slug_ck, mastery_trees_id_ck en 0009_mastery_catalog.sql), el trigger inmediato build_skill_nodes_check_catalog_mastery (0010) y los triggers diferidos de revalidación (0012); los tres llamadores (seedData, bootstrapData, seedCatalog) y el orden escritura de catálogo → contenido → retirada",
    "T040: `aria-describedby` hacia la línea de combinación `aria-hidden` con `lang`, generación del id (`nextCardId`), hidratación (provideClientHydration en app.config.ts) y prerender, y su efecto en scripts/compare-builds.mts (comparación HTML byte a byte)",
    "Resto de la huella fe77dd6..0c9cf02 (git diff --stat sin PNG ni specs): contrato packages/domain/src/seed-contract.ts, lanzador scripts/seed-content.mts, seed.mts/bootstrap.mts, check-assets.mts (helper de crédito que falla cerrado), check-public-build.mts (puerta de marca sobre el build fresco), validate-content.mts (claves internas y nombres ES), workflows ci.yml (visual-regression, Public build check) y visual-baselines.yml. Las 30 PNG de e2e/ no se abrieron"
  ],
  "checks": [
    {
      "name": "pnpm --filter @gd/api exec vitest run src/db (sin RUN_DB_TESTS)",
      "result": "11 ficheros, 134 pruebas pasan"
    },
    {
      "name": "apps/web: pnpm exec ng test --watch=false --include 'src/app/shared/ui/build-card/*.spec.ts' --include 'src/app/features/tier-list/*.spec.ts'",
      "result": "6 ficheros, 90 pruebas pasan"
    },
    {
      "name": "node --import tsx --test scripts/seed-content.test.mts scripts/check-public-build.test.mts scripts/compare-builds.test.mts scripts/check-assets.test.mts scripts/validate-content.test.mts",
      "result": "76 pruebas, 76 pasan, 0 fallos"
    },
    {
      "name": "Revisión estática del UPDATE de aparcamiento de T041 frente a UNIQUE(slug), CHECK de slug, trigger BEFORE INSERT de build_skill_nodes y triggers diferidos",
      "result": "sin defecto demostrable; F-001/C-101 corregido"
    },
    {
      "name": "Búsqueda de ids generados por contador en apps/web/src/app (grep de nextId, [id], aria-labelledby, aria-describedby)",
      "result": "build-card.ts es el único id de contador global; el resto se deriva de datos. Ver F-301"
    },
    {
      "name": "git status --short tras las comprobaciones",
      "result": "limpio"
    }
  ],
  "limitations": [
    "No se ejecutaron pnpm verify, check:performance, la suite de Postgres (RUN_DB_TESTS), los e2e ni Docker: por instrucción. Se confía en quickstart.md («Verificación tras las correcciones de la ronda 2 de la puerta (T040–T041)»). Las pruebas de integración nuevas de T041 (seed.int.spec.ts) se leyeron, pero no se ejecutaron.",
    "F-301 se dedujo leyendo el código (contador de módulo + prerender con varias rutas por proceso + comparación byte a byte de compare-builds.mts). No se reprodujo con dos builds: dist/grim-dawn-builds es del 2026-11-16, anterior a T040, y no lo regeneré para no interferir con otros revisores.",
    "La base de 111 403 B de /tier-list (B-08) la aceptó Paco el 2026-11-17, según el orquestador; el texto «pendiente de confirmación» de spec/plan/quickstart/tasks se actualizará al registrar la ronda y no se reporta.",
    "S-001 (security r2, aplazado en reviews/deuda.md) queda fuera de mi especialidad y no lo volví a revisar.",
    "Revisión con un solo modelo (claude-opus-5-5 en Claude Code), sin segunda opinión."
  ],
  "findings": [
    {
      "id": "F-301",
      "severity": "LOW",
      "path": "apps/web/src/app/shared/ui/build-card/build-card.ts",
      "line": 81,
      "evidence": "T040 genera el id de la descripción con un contador de módulo (`let nextCardId = 0;` en la línea 5, `build-card-combination-${nextCardId++}` en la 81) y lo pinta en cada `<p class=\"build-card__combination\">` (línea 65) de /, /tier-list y sus versiones /es. En el prerender, ese contador se comparte entre todas las rutas que procesa cada worker, así que el número que sale en una página depende del orden y del reparto de rutas entre workers. scripts/compare-builds.mts (AC-17) compara el HTML byte a byte y solo normaliza los ids `tN` de __nghData__ y el valor `source`. Es el único id de la app que no se deriva de datos: devotion-section, loot-filter y build.page lo derivan de los datos.",
      "impact": "El HTML prerrenderizado deja de ser determinista. Con el mismo contenido, dos builds pueden dar ids distintos, y `pnpm compare:builds` (fixture frente a api, donde el ritmo de cada render cambia) puede fallar por algo que no es contenido. La accesibilidad no se rompe: dentro de una página los ids siguen siendo únicos y, al hidratar, el cliente reescribe `id` y `aria-describedby` en la misma instancia, de forma coherente. Es LOW porque compare:builds no está en CI ni en pnpm verify.",
      "recommendation": "Derivar el id de los datos de la tarjeta (por ejemplo `build-card-combination-` + slug, o del href, más un sufijo de sección si una misma guía puede salir dos veces en una página) en lugar del contador global. Otra opción, si se mantiene el contador: normalizar `build-card-combination-N` en compare-builds.mts igual que los `tN`. Añadir una prueba que renderice dos veces la misma tarjeta y espere el mismo id.",
      "disposition": "deferred",
      "deferReason": "Aplazado en la ronda 3 de la puerta T018 por decisión del principal (2026-11-17, opción B): LOW sin impacto observable en accesibilidad ni en CI (compare:builds no está en CI ni en pnpm verify). Seguimiento S5-D1 en specs/005-deuda-revisiones/reviews/deuda.md."
    },
    {
      "id": "F-302",
      "severity": "LOW",
      "path": "apps/api/src/db/write-content.mts",
      "line": 429,
      "evidence": "Sigue abierto F-002 (T-136 r2). Para una maestría que se conserva, writeCatalogRows borra sus nodos ausentes del fixture (`DELETE FROM catalog_skill_nodes WHERE mastery_id = $1 AND id <> ALL($2::text[])`) antes de que writeContentRows reescriba los build_skill_nodes, y la FK build_skill_nodes.skill_node_id es ON DELETE RESTRICT. T041 no lo toca.",
      "impact": "Si una regeneración de fixtures quita un nodo que una guía deja de usar en la misma siembra, la siembra falla con 23503 y sale como `seed failed: database-failed`, sin el id. Falla cerrado, sin cambios parciales, y solo afecta a desarrollo y test.",
      "recommendation": "La del plan de reviews/deuda.md: podar los nodos después de writeContentRows, o traducir el 23503 a SeedError('reference', <id de la maestría>), y añadir el caso a seed.int.spec.ts.",
      "disposition": "deferred",
      "deferReason": "Aplazado por decisión de Paco (2026-11-17) en la ronda 2 de T018: specs/005-deuda-revisiones/reviews/deuda.md, entrada 1 (F-002). Tarea de referencia: T018."
    }
  ]
}
```

## Resumen del revisor

**Modelo usado**: Claude Opus 5.5 (`claude-opus-5-5`) en Claude Code. Revisión independiente y de solo lectura: no editó ningún archivo del repo.

### Alcance cubierto

- Diff completo de las correcciones de la ronda 2 (`b562d83..0c9cf02`): T040 (web y e2e) y T041 (API y pruebas de integración), con su registro SDD.
- Código ejecutable de `fe77dd6..0c9cf02`: contrato del seeder, lanzador, seed y bootstrap, puertas de crédito y de marca, validación de contenido y workflows. Las PNG no se abrieron.

### Seguimiento de la ronda 2

- F-001 / C-101 (conflicto de `UNIQUE(slug)`): corregido en T041.
- F-002 (poda de nodos antes de reescribir las guías): sigue abierto; reaparece como F-302 y está aplazado en `deuda.md`.
- B-06 y B-07 (título de filtros y pruebas a 1280): corregidos en T040.

### Comprobaciones ejecutadas

| Comando                                                                                                                                                                                    | Resultado                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| pnpm --filter @gd/api exec vitest run src/db (sin RUN_DB_TESTS)                                                                                                                            | 11 ficheros, 134 pruebas pasan                                                          |
| apps/web: pnpm exec ng test --watch=false --include 'src/app/shared/ui/build-card/_.spec.ts' --include 'src/app/features/tier-list/_.spec.ts'                                              | 6 ficheros, 90 pruebas pasan                                                            |
| node --import tsx --test scripts/seed-content.test.mts scripts/check-public-build.test.mts scripts/compare-builds.test.mts scripts/check-assets.test.mts scripts/validate-content.test.mts | 76 pruebas, 76 pasan, 0 fallos                                                          |
| Revisión estática del UPDATE de aparcamiento de T041 frente a UNIQUE(slug), CHECK de slug, trigger BEFORE INSERT de build_skill_nodes y triggers diferidos                                 | sin defecto demostrable; F-001/C-101 corregido                                          |
| Búsqueda de ids generados por contador en apps/web/src/app (grep de nextId, [id], aria-labelledby, aria-describedby)                                                                       | build-card.ts es el único id de contador global; el resto se deriva de datos. Ver F-301 |
| git status --short tras las comprobaciones                                                                                                                                                 | limpio                                                                                  |

### Hallazgos

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 2
  - **F-301** (aplazado, = L1): id de la descripción de `build-card` desde un contador de módulo (`build-card.ts:81`); HTML prerrenderizado no determinista. Seguimiento S5-D1.
  - **F-302** (aplazado, = F-002): poda de nodos en `write-content.mts:429`. Seguimiento en la entrada 1 de la ronda 2.

### Limitaciones

- No se ejecutaron pnpm verify, check:performance, la suite de Postgres (RUN_DB_TESTS), los e2e ni Docker: por instrucción. Se confía en quickstart.md («Verificación tras las correcciones de la ronda 2 de la puerta (T040–T041)»). Las pruebas de integración nuevas de T041 (seed.int.spec.ts) se leyeron, pero no se ejecutaron.
- F-301 se dedujo leyendo el código (contador de módulo + prerender con varias rutas por proceso + comparación byte a byte de compare-builds.mts). No se reprodujo con dos builds: dist/grim-dawn-builds es del 2026-11-16, anterior a T040, y no lo regeneré para no interferir con otros revisores.
- La base de 111 403 B de /tier-list (B-08) la aceptó Paco el 2026-11-17, según el orquestador; el texto «pendiente de confirmación» de spec/plan/quickstart/tasks se actualizará al registrar la ronda y no se reporta.
- S-001 (security r2, aplazado en reviews/deuda.md) queda fuera de mi especialidad y no lo volví a revisar.
- Revisión con un solo modelo (claude-opus-5-5 en Claude Code), sin segunda opinión.
