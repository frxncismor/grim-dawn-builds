---
description: 'Tareas de implementación del catálogo propio de árboles de maestría'
---

# Tasks: Catálogo propio de árboles de maestría

**Input**: `specs/003-catalogo-arboles-maestria/{spec.md,plan.md}`
**Prerequisites**: spec.md y plan.md aprobados; Q1 (licencia de la wiki) respondida: CC BY-SA 4.0 (2026-11-13), antes de T005
**Tests**: Sí, exigidos por FR-004, FR-005, FR-016 y SC-002 a SC-004: primero en rojo, después implementación.

**Formato**: `[ID] [P?] [US?] [UI?] descripción` — `[P]` = archivos disjuntos, paralelizable.
Cada tarea declara archivos, aceptación y evidencia. Nada se marca `[x]` sin salida real.

> **Precondición de entorno**: la copia legal del juego instalada en la máquina del usuario
> (decide él la ruta; el repo solo recibe el JSON derivado). Sin eso, la Fase 1 no empieza y
> el plan se detiene, no se simula.

---

## Fase 0 — Investigación de formato (bloquea todo lo demás)

- [x] **T001** Probar la extracción real de `.arz`/`.dbr` en la versión instalada — `scripts/extract-mastery-trees.mts` (esqueleto), `specs/003-catalogo-arboles-maestria/research.md` — Aceptación: lee al menos una habilidad y un `.dbr` de `records/ui/skills/classXX` y escribe sus campos a stdout; si falla, se documenta el bloqueo y se elige herramienta oficial de Crate en local. Evidencia: salida real y versión del juego.
- [x] **T002** Fijar la tabla `tier → bar_required` (hitos 1/5/10/15/20/25/32/40/50) y el mapa de campos — `research.md` — Aceptación: tabla citada con su origen; conflicto con la UI del juego documentado. Depende de T001.
- [x] **T003** [P] Decidir parser (propio mínimo vs librería MIT/BSD) con justificación de tamaño y licencia — `research.md`, `plan.md` (Technical Context) — Aceptación: elección escrita con alternativa descartada (Constitución IV).
- [x] **T004** [P] Verificar la licencia de la wiki y citarla (Q1) — `research.md`, `specs/003-catalogo-arboles-maestria/spec.md` §6 — Aceptación: URL de `Project:Copyrights` con revisión `oldid`, contradicción 3.0/4.0 y decisión aplicada registrada (SC-006).

**Checkpoint**: formato probado y licencia citada. Sin esto no se escribe el esquema.

---

## Fase 1 — Fundación compartida (bloquea las historias)

- [x] **T005** [P] Esquemas Zod del catálogo (`MasteryTreeSchema`, `CatalogSkillNodeSchema`) estrictos + pruebas (incluidas propiedades: aciclicidad, unicidad de `id`, rejilla sin colisiones) — `packages/domain/src/mastery-tree.ts`, `packages/domain/src/mastery-tree.spec.ts` — Aceptación: pruebas rojas primero y verdes después; export en `index.ts`; `domain-runtime.test.mts` actualizado si expone superficie. Depende de T002. **Estado 2026-11-13: hecha.** Campos alineados con FR-003 y entidades (`max_points`, `ultimate_points` opcional, `circular`, `mastery.slug`), no con los nombres `*_rank` de research T002 §3; contrato común con T006 fijado por el orquestador. Refinements: `bar_required` según `TIER_BAR_REQUIRED`, columna = tier, ids únicos, celdas únicas, padre existente, tier del hijo mayor que el del padre, sin ciclos. Evidencia: rojo previo (módulo inexistente; luego 4 fallos al ajustar al contrato) y verde `pnpm --filter @gd/domain test` 259 passed + 2 expected fail (mastery-tree.ts 100 % líneas), typecheck OK, `domain-runtime.test.mts` 6/0, eslint y prettier OK.
- [x] **T006** [P] Script de extracción reproducible — `scripts/extract-mastery-trees.mts` + prueba — Aceptación: dos ejecuciones producen JSON idéntico (diff vacío, SC-002); emite `source {game_version, sha256[]}`; no escribe nada del juego en el repo. Depende de T001/T003. **Estado 2026-11-13: hecha.** `scripts/extract-mastery-trees.mts` (`pnpm catalog:extract`, `--game-dir`/`GRIMDAWN_DIR`, salida a stdout o `--out`) emite las 6 maestrías base con la forma del contrato común con T005 (`max_points`, `ultimate_points`, `circular`, `mastery.slug`). Evidencia con el juego real (build 25813250, sha256 de `database.arz` `9e3532250cdb611a4cc989997c8f97fcec2d6c422063a845e6c43cd538c30603`): dos ejecuciones con diff vacío (SC-002); 186 nodos (32/33/30/31/30/30) y 97 hijos con `parent_id`; salida validada con `MasteryTreeSchema` 6/6 sin errores. Los 5 petmodifiers toman `max_points` y nombre de `petSkillName` → `buffSkillName`. `kindOf` amplía research: cualquier `*Transmuter`/`*Modifier` (p. ej. `Skill_SpawnPetTransmuter`). `extract-mastery-trees.test.mts` 10/0/0 con un `.arz` sintético más una prueba opcional con el juego; eslint y prettier OK; ningún dato del juego versionado. Pendiente: `name.en/es` son tags de localización sin resolver.
- [x] **T007** Validador `pnpm catalog:nodes` — `scripts/check-mastery-catalog.mts` + prueba — Aceptación: falla con fixture sin padre, con ciclo, con tier no monótono y con colisión de rejilla; pasa con el catálogo real; registrado en `test:scripts` y en `verify`. Depende de T005/T006. **Estado 2026-11-13: hecha.** `scripts/check-mastery-catalog.mts` (`pnpm catalog:nodes`) valida con `MasteryTreeSchema` y añade `max_points` 1–16, `ultimate_points` ≤ 26, nombre de archivo = slug, prefijo de id = maestría y exactamente las 6 maestrías base (SC-001). Catálogo fixture versionado en `fixtures/content/mastery-trees/*.json` (6 archivos, 186 nodos: arcanist 30, demolition 33, nightblade 31, occult 30, shaman 30, soldier 32; solo tags de localización y nombres de textura, ningún archivo del juego), generado con `pnpm catalog:extract` y repartido con `scripts/split-mastery-catalog.mts` sin tocar el extractor (T022). Registrado en `test:scripts`, `verify` y CI; rutas de `plan.md` actualizadas por T-075. Evidencia: prueba roja (módulos inexistentes) y luego `check-mastery-catalog.test.mts` 14/0 (sin padre, ciclo, tier no monótono, colisión de rejilla, `max_points`, nombre vacío, slug, menos de 6 maestrías, JSON inválido, catálogo real, reparto y CLI); `catalog:nodes` OK con el catálogo real y exit 1 con una copia rota (padre inexistente). Pendiente: regenerar los fixtures cuando T022 resuelva los nombres.
- [x] **T008** Migración de datos y vistas públicas — `apps/api/drizzle/0007_mastery_catalog.sql` (+ snapshot y journal), `apps/api/src/db/schema.ts`, `apps/api/test/schema-parity.spec.ts` — Aceptación: tablas `mastery_trees`, `catalog_skill_nodes` y vistas `v_public_*` de solo lectura; `api_ro` sigue sin tablas base; paridad Drizzle/SQL sin diff. Depende de T005. **Estado 2026-11-13: hecha.** La migración es `apps/api/drizzle/0009_mastery_catalog.sql` (no `0007`, que ya existía), más `meta/0009_snapshot.json` y el journal. Tablas `mastery_trees` y `catalog_skill_nodes` (nombre de esta tarea; `plan.md` corregido): enum `skill_kind` con paridad con `SKILL_KINDS`; FK compuesta `(mastery_id, parent_id)` para que el padre sea del mismo árbol; celda única por maestría; CHECKs de id/prefijo, tier 1–9, `bar_required` según `TIER_BAR_REQUIRED`, columna = tier, `max_points > 0`, `ultimate_points >= max_points` y sin auto-padre. Vistas `v_public_mastery_trees` y `v_public_skill_nodes` sin timestamps; `api_ro` solo `SELECT` en las vistas, `importer` con DML en las tablas base, `editor` sin acceso. Sin trigger anti-reimportación: el catálogo es dato de referencia del juego y se refresca en cada build; por eso `bootstrap.mts` lo excluye de las tablas editoriales. Evidencia: rojo previo (migración inexistente) y luego verde; `RUN_DB_TESTS=1 vitest run test/` con PostgreSQL 17 real: 206 passed + 1 expected fail; `drizzle-kit generate` sin cambios; typecheck, lint, format y `lint:md` OK. Pendiente fuera de alcance: cargar el catálogo en `db:seed`.
- [x] **T009** Repositorio de lectura del catálogo + DTO público — `apps/api/src/**` y pruebas — Aceptación: lee desde las vistas públicas y valida con el esquema de dominio; sin campos internos. Depende de T008. **Estado 2026-11-13: hecha.** `apps/api/src/catalog/mastery-repository.ts` (`PostgresMasteryRepository`: `listTrees` con recuento de nodos y `findTree(slug)`) lee solo `v_public_mastery_trees` y `v_public_skill_nodes` con consultas parametrizadas. `map-mastery.ts` proyecta campo a campo (NULL → clave omitida) y valida con `MasteryTreeSchema`. Si algo falla devuelve errores opacos (`invalid_catalog`, `catalog_unavailable`); un slug inexistente o malformado da `null`; nunca hay fallback a fixtures. Nodos ordenados por columna, fila e id. Evidencia: unitarias rojas primero (módulo inexistente) y luego 6/6. Integración con PostgreSQL real, 12/12: carga los 6 fixtures como `importer`, lee como `api_ro`, comprueba igualdad profunda, 186 nodos, sin claves fuera del esquema y sin acceso a tablas base. Esta prueba se escribió después del código, así que no hubo rojo previo; en su lugar, una mutación del `ORDER BY` provocó 6 fallos. `RUN_DB_TESTS=1 vitest run` (api): 414 passed + 1 expected fail; typecheck, lint, format y `lint:md` OK. Pendiente sin tarea: ruta HTTP y factoría con el pool `api_ro`.

**Checkpoint**: catálogo tipado, extraído, validado, servido. Las historias pueden empezar.

---

## Fase 2 — US1 (P1): ver el árbol completo de una maestría 🎯 MVP

**Prueba independiente**: `/maestrias/soldado` prerenderiza todos los nodos, navegable por
teclado, con y sin JS.

- [x] **T010** [P] [US1] Componente de árbol en modo catálogo — `src/app/shared/svg/skill-tree/*` — Aceptación: recibe `MasteryTree` y dibuja nodos, conexiones, tier y estados; no usa coordenadas editoriales de guía; sin raster. **Estado 2026-11-13: hecha.** Ruta real `apps/web/src/app/shared/svg/skill-tree/`. Input nuevo `catalogTree: MasteryTree` en el mismo componente (modo guía intacto en el `@else`); x por `grid.col` (tier), y por rango compacto de `grid.row`; aristas `parent_id`→hijo; cabeceras de tier con barra requerida; forma y glifo por `kind`, anillo si `circular`, texto «Tipo · Max N (ultimate)»; `icon` no se dibuja. Traducciones EN/ES de los 8 ids nuevos en `apps/web/src/locale/messages.*.xlf`. Evidencia: `skill-tree.catalog.spec.ts` rojo previo (20 fallos) y verde; `pnpm test` (apps/web) 403 passed + 2 expected fail; `pnpm verify` completo exit 0 (`check:locale-parity` OK, `check:performance` 65/65), repetido por el orquestador. Pendiente: captura a 375/768/1280 px con T012 (aún no hay página); nombres siguen siendo tags hasta regenerar fixtures (T022).
- [ ] **T011** [US1] [UI] Accesibilidad del árbol — mismo componente + pruebas — Aceptación: un elemento enfocable por nodo; nombre/tier/rango/dependencia en el texto alternativo; foco visible; información no solo por color; `prefers-reduced-motion`.
- [ ] **T012** [US1] Ruta `/maestrias/:slug` prerenderizada EN/ES con SEO — `src/app/features/masteries/*`, `angular.json` (prerender), `scripts/gen-sitemap.mts` — Aceptación: 200 en `/` y `/es`; HTML con el 100 % de los nodos (SC-003); canonical y `hreflang`.
- [ ] **T013** [US1] Entrada en presupuestos y puertas — `scripts/check-initial-js.mts`, `lighthouserc.json`, `e2e/` — Aceptación: `check:performance` verde sin ampliar §6 (SC-005); `e2e:a11y` 0 violaciones critical/serious (SC-004); lectura con JS desactivado.

**Checkpoint**: US1 demostrable sola.

---

## Fase 3 — US2 (P2): índice de maestrías

- [ ] **T014** [P] [US2] Página `/maestrias` desde el catálogo — `src/app/features/masteries/index*` — Aceptación: seis tarjetas (v1) con conteo real; una maestría sin datos aparece como «sin datos» sin romper (escenario 2 de US2).
- [ ] **T015** [US2] Presentación de retrato con fallback — según Q3 y enmienda §VII — Aceptación: con `ASSET_SOURCE=own` se usa iconografía propia; con `game` solo entradas `approved` con `license_or_permission = tolerancia_de_facto_sin_permiso`; build falla cerrado si falta (FR-014, §VII).

---

## Fase 4 — US3 (P3): guías sobre el árbol canónico

- [ ] **T016** [US3] Referencia opcional `skill_node_id` en `SkillNodeSchema` y validación cruzada con el catálogo — `packages/domain/src/schema.ts` + pruebas — Aceptación: guía existente válida sin cambios de contenido (SC-007); nodo inexistente falla con nodo y motivo (escenario 2 de US3).
- [ ] **T017** [US3] Componente en modo asignación sobre la rejilla canónica — `src/app/shared/svg/skill-tree/*` — Aceptación: mismos nodos que hoy para la guía Chamán + Demoledor; dos maestrías, dos árboles.
- [ ] **T018** [US3] Migración del contenido y del seed — `content/builds/*.json`, `apps/api/src/db/seed.mts` — Aceptación: diff del documento limitado a la nueva referencia; `content:validate` verde.

---

## Fase 5 — Cierre

- [ ] **T019** [P] Documentación: `docs/content/mastery-catalog.md` (origen, licencia, atribución, retirada) — aceptación: fuente, hash y `game_version` citados; aviso de no afiliación.
- [ ] **T020** [P] `*.es.md` de la página y de la documentación nueva — aceptación: paridad de secciones verificada.
- [ ] **T021** `pnpm verify` completo, `speckit-analyze` y puerta spec002 + T-136 sobre la huella nueva — aceptación: salidas reales registradas en `quickstart.md`; sin huecos.

---

## Ampliaciones

- [x] **T022** Resolver nombres de localización (`Text_EN.arc`/`Text_ES.arc`) en el extractor — `scripts/extract-mastery-trees.mts`, `scripts/extract-mastery-trees.test.mts`, `specs/003-catalogo-arboles-maestria/research.md` (§T022) — Aceptación: `name.en`/`name.es` de las 6 maestrías y sus 186 nodos dejan de ser tags (`tag…`) y salen del texto del juego; si falta el tag en ES se usa el de EN con aviso por stderr y conteo, si falta en EN falla con el tag concreto; se limpian los códigos de formato del juego; `--no-localize` conserva el comportamiento de T006; `source.sha256[]` añade los hashes de `Text_EN.arc` y `Text_ES.arc` sin cambiar `MasteryTreeSchema`; dos ejecuciones con diff vacío (SC-002); salida validada 6/6 con `MasteryTreeSchema`; pruebas con un `.arc` sintético (sin textos reales del juego). Aprobada por Paco, 2026-11-13; depende de T006.

---

## Dependencias

- Fase 0 → Fase 1 → (US1 ∥ US2) → US3 → Fase 5.
- T022 amplía T006 (solo toca el script y su prueba); no bloquea T007–T009.
- T004 (licencia) bloquea T015 y cualquier copia de la wiki; **no** bloquea el resto.
- Q3 (retratos) bloquea T015; el catálogo funciona sin ella con iconografía propia.
- Todo lo que toque arte del juego requiere la enmienda 1.10.0 aprobada.

## Paralelización segura

- `[P]` en T003/T004 (documentos distintos), T005/T006 (dominio y script), T010/T014 (componente y página índice), T019/T020 (documentos distintos).
- Nunca en paralelo: T008/T009 (migración y repositorio), T016/T017 (esquema y componente del mismo flujo).

## Notas

- Ninguna tarea versiona `.dbr`, `.arc`, localización ni iconos del juego (FR-014).
- Ninguna tarea consume Grim Tools (FR-013).
- La extracción corre en la máquina del usuario; el repo recibe solo JSON y hashes.
