---
description: 'Tareas de implementación del catálogo propio de árboles de maestría'
---

# Tasks: Catálogo propio de árboles de maestría

**Input**: `specs/003-catalogo-arboles-maestria/{spec.md,plan.md}`
**Prerequisites**: spec.md y plan.md aprobados; Q1 (licencia de la wiki) respondida antes de T005
**Tests**: Sí, exigidos por FR-004, FR-005, FR-016 y SC-002 a SC-004: primero en rojo, después implementación.

**Formato**: `[ID] [P?] [US?] [UI?] descripción` — `[P]` = archivos disjuntos, paralelizable.
Cada tarea declara archivos, aceptación y evidencia. Nada se marca `[x]` sin salida real.

> **Precondición de entorno**: la copia legal del juego instalada en la máquina del usuario
> (decide él la ruta; el repo solo recibe el JSON derivado). Sin eso, la Fase 1 no empieza y
> el plan se detiene, no se simula.

---

## Fase 0 — Investigación de formato (bloquea todo lo demás)

- [ ] **T001** Probar la extracción real de `.arz`/`.dbr` en la versión instalada — `scripts/extract-mastery-trees.mts` (esqueleto), `specs/003-catalogo-arboles-maestria/research.md` — Aceptación: lee al menos una habilidad y un `.dbr` de `records/ui/skills/classXX` y escribe sus campos a stdout; si falla, se documenta el bloqueo y se elige herramienta oficial de Crate en local. Evidencia: salida real y versión del juego.
- [ ] **T002** Fijar la tabla `tier → bar_required` (hitos 1/5/10/15/20/25/32/40/50) y el mapa de campos — `research.md` — Aceptación: tabla citada con su origen; conflicto con la UI del juego documentado. Depende de T001.
- [ ] **T003** [P] Decidir parser (propio mínimo vs librería MIT/BSD) con justificación de tamaño y licencia — `research.md`, `plan.md` (Technical Context) — Aceptación: elección escrita con alternativa descartada (Constitución IV).
- [ ] **T004** [P] Verificar la licencia de la wiki y citarla (Q1) — `research.md`, `specs/003-catalogo-arboles-maestria/spec.md` §6 — Aceptación: URL de `Project:Copyrights` con revisión `oldid`, contradicción 3.0/4.0 y decisión aplicada registrada (SC-006).

**Checkpoint**: formato probado y licencia citada. Sin esto no se escribe el esquema.

---

## Fase 1 — Fundación compartida (bloquea las historias)

- [ ] **T005** [P] Esquemas Zod del catálogo (`MasteryTreeSchema`, `CatalogSkillNodeSchema`) estrictos + pruebas (incluidas propiedades: aciclicidad, unicidad de `id`, rejilla sin colisiones) — `packages/domain/src/mastery-tree.ts`, `packages/domain/src/mastery-tree.spec.ts` — Aceptación: pruebas rojas primero y verdes después; export en `index.ts`; `domain-runtime.test.mts` actualizado si expone superficie. Depende de T002.
- [ ] **T006** [P] Script de extracción reproducible — `scripts/extract-mastery-trees.mts` + prueba — Aceptación: dos ejecuciones producen JSON idéntico (diff vacío, SC-002); emite `source {game_version, sha256[]}`; no escribe nada del juego en el repo. Depende de T001/T003.
- [ ] **T007** Validador `pnpm catalog:nodes` — `scripts/check-mastery-catalog.mts` + prueba — Aceptación: falla con fixture sin padre, con ciclo, con tier no monótono y con colisión de rejilla; pasa con el catálogo real; registrado en `test:scripts` y en `verify`. Depende de T005/T006.
- [ ] **T008** Migración de datos y vistas públicas — `apps/api/drizzle/0007_mastery_catalog.sql` (+ snapshot y journal), `apps/api/src/db/schema.ts`, `apps/api/test/schema-parity.spec.ts` — Aceptación: tablas `mastery_trees`, `catalog_skill_nodes` y vistas `v_public_*` de solo lectura; `api_ro` sigue sin tablas base; paridad Drizzle/SQL sin diff. Depende de T005.
- [ ] **T009** Repositorio de lectura del catálogo + DTO público — `apps/api/src/**` y pruebas — Aceptación: lee desde las vistas públicas y valida con el esquema de dominio; sin campos internos. Depende de T008.

**Checkpoint**: catálogo tipado, extraído, validado, servido. Las historias pueden empezar.

---

## Fase 2 — US1 (P1): ver el árbol completo de una maestría 🎯 MVP

**Prueba independiente**: `/maestrias/soldado` prerenderiza todos los nodos, navegable por
teclado, con y sin JS.

- [ ] **T010** [P] [US1] Componente de árbol en modo catálogo — `src/app/shared/svg/skill-tree/*` — Aceptación: recibe `MasteryTree` y dibuja nodos, conexiones, tier y estados; no usa coordenadas editoriales de guía; sin raster.
- [ ] **T011** [US1] [UI] Accesibilidad del árbol — mismo componente + pruebas — Aceptación: un elemento enfocable por nodo; nombre/tier/rango/dependencia en el texto alternativo; foco visible; información no solo por color; `prefers-reduced-motion`.
- [ ] **T012** [US1] Ruta `/maestrias/:slug` prerenderizada EN/ES con SEO — `src/app/features/masteries/*`, `angular.json` (prerender), `scripts/gen-sitemap.mts` — Aceptación: 200 en `/` y `/es`; HTML con el 100 % de los nodos (SC-003); canonical y `hreflang`.
- [ ] **T013** [US1] Entrada en presupuestos y puertas — `scripts/check-initial-js.mts`, `lighthouserc.json`, `e2e/` — Aceptación: `check:performance` verde sin ampliar §6 (SC-005); `e2e:a11y` 0 violaciones critical/serious (SC-004); lectura con JS desactivado.

**Checkpoint**: US1 demostrable sola.

---

## Fase 3 — US2 (P2): índice de maestrías

- [ ] **T014** [P] [US2] Página `/maestrias` desde el catálogo — `src/app/features/masteries/index*` — Aceptación: diez tarjetas con conteo real; una maestría sin datos aparece como «sin datos» sin romper (escenario 2 de US2).
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

## Dependencias

- Fase 0 → Fase 1 → (US1 ∥ US2) → US3 → Fase 5.
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
