# Research: evidencia por elemento (spec007)

Cada elemento de la petición se localizó en el código de `81179fc` (rama `orq/11111619-ui-s7-plan`), solo lectura. Las líneas son de ese commit.

## R1. S6-D1, diseño de spec006 desfasado tras T009: **aplica**

- `specs/006-deuda-revisiones-2/data-model.md:33`: paso 3 «Upsert de maestrías y nodos (23505 por celda ocupada por un nodo ausente aún referenciado → `SeedError('reference', <maestría>)`)».
- `specs/006-deuda-revisiones-2/plan.md:128` (resumen de T005: «Un nodo obsoleto aún referenciado que choca con la celda de un nodo nuevo (23505 en el upsert) se traduce igual a `reference`») y `:153` (riesgo «23505 traducido a `reference`»).
- `specs/006-deuda-revisiones-2/research.md:116` (D4: «Si en (1) un nodo ausente aún referenciado ocupa la celda de un nodo nuevo, el upsert da 23505 y se traduce también a `reference`»).
- Código vigente: `apps/api/src/db/write-content.mts:463-474` (comentario y `UPDATE catalog_skill_nodes SET grid_row = grid_row + 1000000 … (grid_col, grid_row) IN (…)`): la fila se aparca fuera de la rejilla y decide `pruneCatalogNodes` (`:398-417`, 23503 → `SeedError('reference', <maestría>)`) tras reescribir las guías (spec006 T009).
- Origen: C-101 = A-101 de la ronda 2 de la puerta de spec006 (`specs/006-deuda-revisiones-2/reviews/completion-review.json`; `reviews/deuda.md`, ronda 2, punto 1).
- Coste: edición de 4 pasajes en 3 archivos; el snapshot de la puerta de spec006 caduca (esperado). Riesgo: nulo.

## R2. S6-D2, fila de spec006 en `specs/README.md`: **aplica**

- `specs/README.md:4` («Actualizado el 2026-11-17 (T010 de spec006)»), `:13` («Implementada; puerta spec002 en curso | 8 de 10 | 2») y la sección `:50-57` («T009 … y T010 …, abiertas»).
- Estado real: `specs/006-deuda-revisiones-2/tasks.md` T001–T010 `[x]`; puerta `passed` en `c626f26` (`docs(spec006): close the spec002 gate and T-136 on round 2, defer the LOW findings (T008)`), fusionada en `mvp/1` en `81179fc` (PR #12); snapshot `545c6e5a…` (`reviews/completion-review.json`).
- Origen: A-102 = B-101 de la ronda 2 (`reviews/deuda.md`, ronda 2, punto 2).

## R3. S6-D3, unicidad de ids vacua en la portada: **aplica**

- `e2e/a11y.spec.ts:609-636` (bloque «@a11y T010 descripción de las tarjetas de la portada»): la aserción de ids únicos está en `:622-628`. Con el contenido de pruebas solo hay 1 guía pública (`fixtures/content/builds/` tiene un único archivo, `chaman-demoledor-golpe-primigenio.json`), así que la portada no tiene tarjetas en «More builds» y el conjunto de ids tiene 1 elemento: la comprobación no puede fallar.
- Cómo se genera el artefacto e2e: `pnpm build` (`package.json:6`) prerrenderiza con `CONTENT_SOURCE=fixture` y lee `fixtures/content/` (`apps/web/src/app/app.config.server.ts:37`, `GD_CONTENT_ROOT` como anulación); `playwright.config.ts:19-27` sirve `dist/grim-dawn-builds/browser` (4321) y, si existe, `dist/e2e-drafts/browser` (4322), que construye `scripts/build-e2e-drafts.mts` con `INCLUDE_DRAFTS=true` sobre las **mismas** fixtures.
- Vías valoradas:
  - **(a) Artefacto de borradores**: no sirve. La portada solo lista guías publicadas (`apps/web/src/app/features/home/home-builds.ts:51-54` filtra con `publicGuideOf`, que exige `review_state === 'publicado'` en `apps/web/src/app/features/tier-list/public-guide.ts:14-22`), y no hay borradores en las fixtures.
  - **(b) Segunda guía pública en `fixtures/content/builds/`**: cambia el sitio público (portada, catálogo, sitemap), obliga a regenerar las 30 referencias visuales, toca el presupuesto de `/tier-list` y exige atribución y derechos reales (constitución I). Descartada (FR-010).
  - **(c) Tercer artefacto e2e con `GD_CONTENT_ROOT`** apuntando a una copia de las fixtures con guías extra: un build completo más por ejecución, otro puerto en `playwright.config.ts` y un paso nuevo en la CI. Caro para un LOW.
  - **(d) Prueba de componente de la portada** en `apps/web/src/app/features/home/home.page.spec.ts`, que ya monta `HomePage` con tres guías sintéticas (`:191-240`, bloque spec005 T010) y `TransferState`: dibuja el componente y la tarjeta reales; coste de segundos; sin cambios en el artefacto. **Recomendada.**
- Complemento en e2e: la aserción de `:622-628` exige ≥ 1 id (deja de poder pasar con cero) y su mensaje remite a la prueba del componente para 2+ guías.

## R4. S-001, enlaces simbólicos en el recorrido del artefacto: **aplica**

- `scripts/artifact-pages.mts:26-29`: `readdirSync(browserDir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && …)`; un enlace (`Dirent.isSymbolicLink()`) no es `isFile()` ni se recorre: se ignora en silencio. Solo la propia carpeta `browser/` se rechaza si es enlace (`:18-25`, `lstatSync`).
- `scripts/check-assets.mts:162-165` (`assertNoGamePortraits`, escaneo de `assets/portraits|skill-icons` sobre el artefacto entero): mismo filtro `entry.isFile()`; una carpeta de retratos enlazada esquiva la puerta `own`.
- Usuarios de `prerenderedPages`: `assertCredit` (`scripts/check-assets.mts:191-194`, dos puertas de crédito), `assertNoGamePortraits` (`:159-161`) y `assertNoLegacyBrand` (`scripts/check-legacy-brand.mts`).
- Defensa actual en el release: `assertPublicBuild` (`scripts/check-public-build.mts:82`) rechaza cualquier enlace sobre el mismo staging; `contentFingerprint` (`scripts/check-release.mts`) también rechaza el recorrido de enlaces (`scripts/check-release.test.mts:86`). No cambian (FR-003).
- Pruebas existentes de enlaces: `scripts/artifact-pages.test.mts:30-41` (`browser/` como *junction*).
- Origen: S-001 de la ronda 1 de la puerta de spec006 (= F-101 de `t136-review.md`); `reviews/deuda.md`, ronda 1, punto 1.

## R5. B-002, invariante de `combinationLang` solo en los adaptadores: **aplica**

- `apps/web/src/app/shared/ui/build-card/build-card.labels.ts:67-72`: `srCombination` se fija con `combinationLang` y `combination` sin mirar `href` ni `external.url`; `srText` (`:70`) **excluye** la combinación siempre que haya `combinationLang`.
- `apps/web/src/app/shared/ui/build-card/build-card.ts:43-62`: `aria-describedby` solo en las ramas con enlace (`d.href`, `d.externalHref`); la línea visible de la combinación es `aria-hidden="true"` (`:64-66`). Resultado: una tarjeta sin enlace con `combinationLang` no anunciaría la combinación.
- `apps/web/src/app/shared/ui/build-card/build-card.model.ts:72-78`: el docstring de `srCombination` promete «a card with no link never has one», sin que nada lo imponga.
- Adaptadores: `apps/web/src/app/features/tier-list/card-data.ts:64-73` (`combinationLang: swap ? context.titleLang : null`, con `swap` solo si hay guía, y `href` solo si hay guía) y `apps/web/src/app/features/home/home-builds.ts:63-69` (reutiliza `catalogCardInput`).
- Dónde imponerlo (petición: «al dominio o al esquema»):
  - **(a) `packages/domain`**: no encaja. `BuildCardInput`/`BuildCardData` son vista de presentación de `apps/web` («not a domain entity», `build-card.model.ts:52`); el dominio no conoce tarjetas, enlaces ni el idioma de la página. Llevarlo allí crearía un tipo de presentación en el dominio (constitución VI: el dominio es el contrato de contenido). Descartada.
  - **(b) Tipo de la entrada** (unión discriminada de `BuildCardInput`: con enlace / externa / sin enlace, `combinationLang?: null` en la última): 0 B en cliente, pero `catalogCardInput` construye `href` y `combinationLang` con condiciones independientes y habría que reescribirlo en ramas, y la regla no se comprueba en tiempo de ejecución.
  - **(c) Construcción de los datos de la tarjeta** (`buildCardData`, el único punto por el que pasan todos los adaptadores y la vista previa): `srCombination` solo si la tarjeta es enlace (`href` o `external.url`); si no lo es, la línea visible de la combinación deja de ser `aria-hidden` y se lee con su `lang` (meterla en `srText`, como sugería `reviews/deuda.md` de spec006, la leería sin su idioma: WCAG 3.1.2). Coste estimado: unas decenas de bytes en `/tier-list` (margen 605 B); se mide. **Recomendada**, con (b) como alternativa si la medida supera el tope.
- Origen: B-002 de la ronda 1 de spec006 (= F-102 de `t136-review.md`); `reviews/deuda.md`, ronda 1, punto 2.

## R6. Comentario desfasado del trabajo `visual-regression`: **aplica**

- `.github/workflows/ci.yml:485-489`: «It builds its OWN `own` artifact on its own runner (no game PNG is versioned, so `own` is the only deterministic one)».
- Gemelo: `scripts/ci-workflow.test.mts:387`: «the visual-regression job is the one `own` build (no game PNG in the repo)».
- Hecho real: los PNG del juego **están** versionados (6 retratos en `apps/web/public/assets/portraits/` y 164 iconos en `apps/web/public/assets/skill-icons/`, `git ls-files`; constitución 1.10.0/1.11.0), y los trabajos `verify` y de e2e construyen con `ASSET_SOURCE: game` (`ci.yml:34`, `:322`). T-177 (`specs/001-mvp-guias-builds/tasks.md:309`) lo reconoce para el e2e.
- Motivo real del modo `own` en `visual-regression`: las 30 referencias de `e2e/visual-baselines/` se generan con `own` (`.github/workflows/visual-baselines.yml:24`) y deben compararse con el mismo modo; `own` es el modo por defecto y la vía de retirada (constitución VII), y las capturas no fijan arte del juego.
- Coste: dos comentarios; ningún paso ni variable cambia (la prueba de `ci-workflow.test.mts:386-395` sigue igual salvo su comentario).

## R7. A-01 de spec003, `MasterySummarySchema` al dominio: **ya no aplica**

- Origen: A-01 de la ronda 1 de spec003 (`runs/11111619/review.md`, «Hallazgos consolidados», punto 5; aplazado en `specs/003-catalogo-arboles-maestria/tasks.md:107`).
- Cerrado por spec005 T005 (`1e6451c`, `refactor(domain): move MasterySummarySchema to the domain …`) y T006 (`087807e`, `refactor(web): validate the mastery list with the domain schema …`).
- Evidencia: `packages/domain/src/mastery-summary.ts:7` (`export const MasterySummarySchema = z…`); la API lo importa de `@gd/domain` (`apps/api/src/catalog/map-mastery.ts:2`, `apps/api/src/catalog/mastery-repository.ts:1`, `apps/api/src/routes/masteries.ts:3`) y la web también (`apps/web/src/app/core/content/masteries.server.ts:3`, uso en `:154`); no queda `z.object` local en `masteries.server.ts`.

## R8. A-03 de spec003, doble fuente del estado de los activos: **ya no aplica**

- Origen: A-03 de la ronda 1 de spec003 (`portraits.server.ts:61` en el registro de la corrida; aplazado en `specs/003-catalogo-arboles-maestria/tasks.md:107`).
- Cerrado por spec004 T005 (`aa75798`, `feat(release): fail the release when the assets table and the manifest disagree on status …`); ya registrado así en `specs/005-deuda-revisiones/spec.md:261` y `research.md` §R8.
- Evidencia: `scripts/check-assets.mts:119` (`assertAssetStatusParity`, «manda el manifiesto»; error en `:142-145`) ejecutada en el release por `scripts/build-release.mts:87`; pruebas en `scripts/check-assets.test.mts:93-135`. La web sigue leyendo el manifiesto (`apps/web/src/app/core/content/portraits.server.ts:56-66`), que es la fuente declarada; una discrepancia con la tabla `assets` hace fallar el release.

## R9. C-003 de spec003, `writeCatalogRows` no borra maestrías retiradas: **ya no aplica**

- Origen: C-003 de la ronda 1 de spec003 (`write-content.mts:360` en el registro de la corrida; aplazado en `specs/003-catalogo-arboles-maestria/tasks.md:107`). No confundir con C-003 de la ronda 1 de spec005 (orden catálogo → contenido, corregido en spec005 T036).
- Cerrado por spec005 T007 (`314ef34`, `fix(seed): retire masteries missing from the catalog and fail closed when guides use them …`), con el orden corregido después en spec005 T036.
- Evidencia: `apps/api/src/db/write-content.mts:367-389` (`retireMasteries`, 23503 → `SeedError('reference', id)`), llamada tras `writeContentRows` en `apps/api/src/db/seed.mts:255` y `:287` y `apps/api/src/db/bootstrap.mts:115`.

## Resumen de disposición

| Elemento | Estado en `81179fc` | Tarea |
| -------- | ------------------- | ----- |
| S6-D1 | Sigue (R1) | T005 |
| S6-D2 | Sigue (R2) | T005 |
| S6-D3 | Sigue (R3) | T003 |
| S-001 | Sigue (R4) | T001 |
| B-002 | Sigue (R5) | T002 |
| Comentario de CI | Sigue (R6) | T004 |
| A-01 (spec003) | Cerrado por spec005 T005/T006 (R7) | — |
| A-03 (spec003) | Cerrado por spec004 T005 (R8) | — |
| C-003 (spec003) | Cerrado por spec005 T007 (R9) | — |

## Decisiones de diseño (fase 0 del plan)

Formato de Spec Kit: decisión, motivo y alternativas.

### D1. Enlaces en el artefacto (T001; S-001)

- **Decisión**: en `prerenderedPages` (`scripts/artifact-pages.mts`), recorrer `browser/` con `withFileTypes` y lanzar `Error` con `«<gate>: el artefacto es inválido (enlace o entrada no regular en browser/: <ruta relativa>)»` ante la primera entrada que sea `isSymbolicLink()` o que no sea ni `isFile()` ni `isDirectory()`; después, el filtro de `.html` de hoy. En `assertNoGamePortraits` (`scripts/check-assets.mts:162`), el mismo criterio sobre el recorrido del artefacto completo, con el prefijo de su puerta. Un helper pequeño exportado de `artifact-pages.mts` (p. ej. `assertRegularEntries(dir, gate)`) evita duplicar el criterio. Pruebas: carpeta enlazada (*junction*) y página `.html` enlazada (`symlinkSync(…, 'file')`, omitida con `t.skip(motivo)` si la plataforma da `EPERM`), en `artifact-pages.test.mts` y en `check-assets.test.mts` (carpeta `assets/portraits` enlazada con `own`).
- **Motivo**: la unidad falla cerrado por sí sola (FR-001, FR-002) sin depender de que el llamador ejecute antes `assertPublicBuild`; un solo criterio, como en spec006 D1.
- **Alternativas**: seguir los enlaces (`realpath`) y recorrer su destino (abre lectura fuera del artefacto y ciclos); dejarlo documentado como contrato del llamador (deja el hueco).

### D2. Comentario de la CI (T004)

- **Decisión**: reescribir el paréntesis de `ci.yml:487` como «(the references are generated with `own` by the manual visual-baselines workflow, and `own` is the default and the withdrawal path of constitution §VII, so no game art is pinned in the screenshots)» y el comentario de `scripts/ci-workflow.test.mts:387` en el mismo sentido. Sin tocar pasos ni variables.
- **Motivo**: FR-013; el comentario es la única justificación escrita del modo del trabajo.
- **Alternativas**: borrar el paréntesis (pierde el porqué).

### D3. Regla de la combinación en la tarjeta (T002; B-002)

- **Decisión**: opción (c) de §R5. En `buildCardData` (`build-card.labels.ts`): `const linked = !!(input.href || external?.url);` `srCombination` solo si `linked && combinationLang && combination`; `srText` sin cambios. En `build-card.ts:64-66`, `aria-hidden` de `.build-card__combination` pasa a `[attr.aria-hidden]="d.combinationLang && !d.srCombination ? null : 'true'"`: con enlace sigue oculta y describe el enlace; sin enlace queda expuesta con su `lang`. Docstring de `BuildCardData.srCombination` (`build-card.model.ts:72-78`) a «impuesto por `buildCardData`». Pruebas en `build-card.spec.ts`: sin enlace con `combinationLang` → `srCombination === null`, `srText` sin la combinación y, en el componente, la línea sin `aria-hidden` y con `lang`; externa con URL → `srCombination` fijado y línea oculta; externa sin URL → como sin enlace; tarjetas reales → mismo HTML. Medir `/tier-list` antes y después.
- **Motivo**: un solo punto impone la regla para todo adaptador presente y futuro (FR-005); el dominio no es el lugar (§R5 a).
- **Alternativas**: (b) unión discriminada del tipo (0 B, refactor de adaptadores; queda como plan B si la medida supera 112 000 B); (a) dominio (descartada).

### D4. Unicidad de ids con varias guías (T003; S6-D3)

- **Decisión**: opción (d) de §R3. Caso nuevo en `apps/web/src/app/features/home/home.page.spec.ts`: tres guías públicas sintéticas con contenido en español y la página en inglés (`LOCALE_ID` `en`, como los bloques de `home.page.spec.ts:110` y `:171`; los datos, como el bloque spec005 T010 de `:191-240`), de modo que cada tarjeta lleve combinación en el idioma del contenido; se esperan ≥ 2 ids `build-card-combination-…` y todos distintos; prueba de control que falla si dos claves coinciden (p. ej. forzando la misma clave en dos entradas y esperando el duplicado, para demostrar que el detector no es vacuo). En `e2e/a11y.spec.ts:622-628`: `expect(ids.length).toBeGreaterThan(0)` antes de la unicidad y mensaje que remite a la prueba del componente.
- **Motivo**: la vía más barata que ejercita el camino real de la portada (`homeBuilds` → `HomePage` → `BuildCard`) con 2+ guías, sin tocar el contenido público ni las referencias visuales (FR-008–FR-010).
- **Alternativas**: §R3 (a)–(c).

### D5. Registro SDD (T005; S6-D1, S6-D2)

- **Decisión**: en spec006, `data-model.md:33` pasa a «3. Aparcar fuera de la rejilla (`grid_row + 1000000`) la fila de un nodo ausente que ocupa una celda entrante; upsert de maestrías y nodos (T009)» y el paso 5 nombra la decisión por FK; `plan.md:128` y `:153` y `research.md:116` añaden «sustituido por T009: …» conservando el texto original como histórico. En `specs/README.md`: fila de spec006 «Cerrada (puerta spec002 passed, `c626f26`)», «10 de 10», «0», sección al día (T001–T010, rondas 1 y 2, aplazados a spec007) y fecha de actualización.
- **Motivo**: FR-011, FR-012; el histórico se conserva porque las revisiones de la puerta lo citan.
- **Alternativas**: reescribir D4 de spec006 sin rastro (pierde la trazabilidad de C-101/A-101).
