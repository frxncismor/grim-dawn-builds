---
description: 'Tareas de spec009: base visual con aprobación de Paco y página de build (serie 009–013)'
---

# Tasks: Rediseño de la UI, base visual y página de build (serie 009–013)

**Input**: `specs/009-rediseno-completo-ui/{spec.md,plan.md,research.md,data-model.md,quickstart.md}`
**Prerequisites**: spec008 cerrada (`28cbcdf` en `mvp/1`). Clarify cerrado con Paco (Preguntas 37–45 y decisiones del 2026-11-18: un solo PR, presupuestos informativos, punto de aprobación visual).
**Tests**: Sí, primero en rojo y después la implementación (constitución IX) en toda tarea con código ejecutable; T002, T003, T004 y T020 no tienen código del producto.

**Formato**: `[ID] [P?] [US?] [Área] descripción` — `[P]` = archivos disjuntos. Cada tarea declara archivos, aceptación, evidencia y dependencias. **Ninguna casilla `[x]` sin salida real citable** (comando y resultado). Áreas: **IMPL** = implementación (`apps/api`, `packages/*`, `scripts/`, `fixtures/`, CI); **UI** = `apps/web`, `apps/web/tools` y `e2e/` (agente `sdd-ui` con el skill `impeccable` desde la ruta absoluta `C:\Users\paco_\Documents\GitHub\grim-dawn-builds\.agents\skills\impeccable`, ignorado por git); **DOCS** = constitución y artefactos SDD.

**Reglas de la serie**: un solo PR para 009–013; **presupuestos de rendimiento informativos** en 009 (se miden y se registran con cifras, no bloquean ni recortan diseño; la CI verde es de 013, P43); las puertas de accesibilidad (`e2e:a11y`, `check:contrast`, `e2e:journeys`) **sí** bloquean. Toda captura antes/después se hace con `ASSET_SOURCE=game` (y `own` para comparar), a 375, 768 y 1280 px, fuera del repo.

**Dependencia dura (FR-033)**: **ninguna tarea de página (T011–T019) empieza antes del OK de Paco en T004.** Antes del OK solo avanzan T001, T002, T003, T020 y el contrato de datos T005–T006 (no es página). T007–T010 esperan también a T004 porque concretan la base elegida.

> **Estado (2026-11-18)**: planificada; 21 tareas (T001–T021), ninguna empezada. Sin fase de setup: dependencias, `packages/domain` y gitleaks listos en los worktrees de la corrida.

---

## Fase 1 — US4 Árbol y mapa visibles (P1), primera tarea

**Objetivo**: el árbol y el mapa de devociones se ven en la guía. **Prueba independiente**: quickstart «US4».

- [x] **T001** [US4] [UI] Reproducir y corregir «no veo el árbol ni el mapa de devociones», con capturas «antes» (research §R1, D1, D2; FR-024, FR-025, SC-003) — `apps/web/angular.json` (configuración `development`, `:77-91`), `apps/web/tools/emit-static-assets.mts` (`:21-25`) o un script de arranque equivalente, raíz `package.json` (`start`) si hace falta, `.gitignore` (carpeta generada), `apps/web/src/app/features/build/build.page.html` (`:26-63`, aviso sin JS en el respaldo de habilidades), `apps/web/src/locale/messages.{en,es}.xlf`, prueba de regresión en `e2e/` o `scripts/` — Aceptación: (1) **reproducción** documentada en `research.md` §R1 (resultado por combinación: `pnpm start`; artefacto de `pnpm build` con `ASSET_SOURCE=own` y con `game` servido con `scripts/serve-artifact.mts`; con y sin JS), con capturas «antes» de las rutas del quickstart a 375/768/1280 en `runs/11111619/capturas-s9-antes/` y medidas informativas (HTML, JS inicial, CSS, LCP/CLS/TBT) registradas; (2) en `pnpm start`, `/assets/deferred.css` y `/assets/mastery-trees/<id>.json` responden 200 y el árbol y el mapa se dibujan con estilos, sin versionar archivos generados (carpeta ignorada); (3) toda causa reproducida en el artefacto también se corrige; (4) sin JS el respaldo del árbol avisa de que la vista interactiva requiere JS (cadena en EN y ES), como ya hace el de devociones; (5) prueba roja primero que falla sin la corrección (p. ej. arranque del servidor de desarrollo y petición de los dos recursos, y comprobación de estilo aplicado al SVG del árbol en el artefacto); (6) el artefacto de producción no cambia de bytes salvo el aviso. Evidencia: salida de la prueba en rojo y en verde, tabla de reproducción antes/después, `pnpm test`, `pnpm lint`, `pnpm check:locale-parity`, `pnpm e2e:a11y` 0 violaciones, rutas de las capturas. Depende de: nada.

  **Evidencia (2026-11-18)**: reproducción y medidas en `research.md` §R1; causas: `apps/web/angular.json` (`development` no servía `deferred.css` ni los árboles; el servidor devolvía `index.html` con 200) y respaldo del árbol sin aviso (`build.page.html`); corrección con `apps/web/tools/prepare-dev-assets.mts` (carpeta ignorada `apps/web/.dev-assets/`, enganchada en `start` y `watch`) y el aviso `buildPage.skillsJavascriptRequired` (EN y ES); en el artefacto no se reprodujo ninguna causa de carga; prueba en rojo (`prepare-dev-assets.test.mts`: `ERR_MODULE_NOT_FOUND`; `build.page.spec.ts`: aviso ausente) y en verde (3 pruebas de `prepare-dev-assets` y `pnpm test` 690 pasan); `pnpm lint`, `format:check`, `lint:md` (0 incidencias), `check:locale-parity` (342 unidades), `check:scope` OK, `pnpm e2e:a11y` 183 pasan; el artefacto `own` cambia solo en el aviso y en los identificadores de hidratación y nombres con hash; capturas «antes» en `runs/11111619/capturas-s9-antes/`.

**Checkpoint F1**: árbol y mapa visibles con JS en desarrollo y en el artefacto; respaldo con aviso sin JS.

---

## Fase 2 — Base visual: propuestas y aprobación de Paco (bloquea las páginas)

**Objetivo**: Paco elige la base elegante (paleta negra, tipografía, tokens, tooltip) sobre capturas reales antes de aplicarla. **Prueba independiente**: quickstart «Base visual».

- [ ] **T002** [P] [DOCS] Enmienda 1.12.0 de la constitución §VII (P44 = A; research §R8; FR-032), con el skill `speckit-constitution` — `.specify/memory/constitution.md` — Aceptación: §VII añade la **excepción 3** con el alcance exacto de P44 = A (iconos de constelaciones, objetos, componentes y aumentos; una portada por maestría; datos factuales derivados del juego: nombres ES/EN, rareza, tipo, nivel, estadísticas, bonificaciones y descripciones cortas de skills; sin lore, sin texturas de marcos ni fondos, sin la base de datos completa), con la condición común (entrada de manifiesto por activo con `tolerancia_de_facto_sin_permiso`, `proof_ref` = `specs/009-rediseno-completo-ui/research.md#r8`, `fallback_svg`), incorporación manual sin ingesta de webs (§II), atribución, no afiliación y retirada inmediata; la frase «Nada más del juego entra…» se ajusta sin ampliar más; versión **1.12.0** y entrada en la gobernanza con fecha 2026-11-18 y la decisión de Paco (P40, P44, P45). Evidencia: `git diff` del archivo, `pnpm lint:md` 0 incidencias, `pnpm check:scope` OK. Depende de: nada.
- [ ] **T003** [P] [UI] 2–3 propuestas visuales de la base elegante en capturas reales (FR-033, SC-008; research D3, D5) — prototipo **no integrado** en el worktree del agente (`apps/web/src/styles/*`, `apps/web/DESIGN.md` en modo propuesta); entregables **fuera del repo** en `C:\Users\paco_\.config\orquestacion\runs\11111619\propuestas-009\` — Aceptación: con el skill `impeccable` (contexto de `PRODUCT.md`/`DESIGN.md`, modo new-work), 2 o 3 direcciones distintas de fondo negro elegante (paleta de `spec.md` §4 como punto de partida, tipografía con su peso en bytes, tokens, marco propio del tooltip, sin texturas del juego ni nada de Maxroll), cada una en su carpeta `propuesta-<n>/` con capturas reales del artefacto con `ASSET_SOURCE=game` a 375, 768 y 1280 de: cabecera de build, una sección de contenido, un tooltip abierto y una tarjeta; y una `nota.md` (intención, tokens con contrastes AA calculados, tipografía, riesgos); ninguna rama ni commit de propuesta se integra. La portada de la cabecera en las propuestas es el fallback propio o una imagen candidata extraída solo en local (ni versionada ni servida: la publicación exige T002 y T007). Evidencia: listado de `propuestas-009/` con las capturas, contrastes por propuesta, `git status` del worktree de integración sin cambios. Depende de: nada (puede usar el artefacto de T001 si ya está integrado).
- [ ] **T004** [UI] **Aprobación visual de Paco** (checkpoint; FR-033, SC-008) — `specs/009-rediseno-completo-ui/spec.md` («Clarifications»), `runs/11111619/preguntas-ui.md` (fuera del repo) — Aceptación: el orquestador de UI presenta las propuestas de T003 a Paco; Paco elige una (o pide cambios: entonces se repite T003 con su feedback y esta tarea sigue abierta); la elección queda en «Clarifications» con fecha, propuesta elegida, ajustes pedidos y ruta de las capturas, sustituyendo «_pendiente de la aprobación (T004)_»; T009 la llevará a `DESIGN.md`. Hasta marcar esta tarea **no empieza ninguna de T007–T019**. Evidencia: mensaje de Paco citado (fecha), diff de `spec.md`, `pnpm lint:md` 0. Depende de: T003.

**Checkpoint F2**: propuesta elegida y registrada; las páginas pueden empezar.

---

## Fase 3 — Fundacional: datos, activos, tokens y tooltip

**Objetivo**: contrato de datos, portadas, base visual aprobada y tooltip común listos para las páginas.

- [ ] **T005** [P] [IMPL] Campos editoriales en el contrato de dominio y los fixtures (research D4; `data-model.md`; FR-006, FR-007, FR-009) — `packages/domain/src/schema.ts` (`BuildContentSchema` `:255-305`, `validateGuide`), `packages/domain/src/schema.spec.ts`, `packages/domain/src/schema.property.spec.ts` si aplica, `packages/domain/testing/repository-contract.ts`, `fixtures/content/builds/chaman-demoledor-golpe-primigenio.json`, `apps/web/src/app/core/content/parity.test.mts` — Aceptación: `intro`, `stage`, `changelog`, `pros`, `cons`, `hotbar`, `key_devotions` con las reglas de `data-model.md` (límites, unicidad, `hotbar` ⊂ `skill_nodes`, `key_devotions` ⊂ `constellations`, fechas de changelog descendentes, únicas y no anteriores a `published_at`); `PublicBuildSchema` los expone; `sections_meta` admite `build-final` y `changelog`; la guía de ejemplo lleva contenido propio (`own_original`) para los siete campos; pruebas rojas primero (cada regla con un caso que falla). Evidencia: rojo y verde de `pnpm --filter @gd/domain test` (o el comando del paquete), `pnpm content:validate`, `pnpm test:scripts` (paridad), `pnpm lint`. Depende de: nada (no es tarea de página: puede ir antes de T004).
- [ ] **T006** [IMPL] Migración, vista y API de los campos editoriales (`data-model.md`) — `apps/api/drizzle/0015_*.sql` (+ `meta/`), `apps/api/src/db/schema.ts` (`builds` `:293-331`), `apps/api/src/db/write-content.mts` (`:184-185`), `apps/api/src/content/map-content.ts` (+spec), vista `v_public_build_documents`, pruebas de `apps/api/src/db/*.spec.ts` — Aceptación: siete columnas con los tipos y CHECK de `data-model.md` y valores por defecto para filas existentes; la vista pública los devuelve; la siembra escribe y la API devuelve los siete campos con ida y vuelta idéntica al fixture; un valor fuera de rango lo rechaza la BD; migraciones aplican desde cero y sobre la base anterior. Pruebas rojas primero con Postgres real. Evidencia: rojo/verde de las pruebas de `apps/api` con Postgres, `pnpm test:api-adapter`, `pnpm db:seed` sobre la base local, `pnpm check:release` si aplica. Depende de: T005.
- [ ] **T007** [P] [IMPL] Portadas de maestría en el manifiesto (research D6, §R8; data-model «Portada») — `fixtures/content/assets/manifest.json`, `apps/web/public/assets/banners/*.webp` (6), `scripts/check-assets.mts` (+`.test.mts`), `scripts/extract-textures.mts` solo si hace falta un modo nuevo — Aceptación: una portada por maestría base derivada a mano de la copia local legal (sin webs), con encuadre acorde a la propuesta elegida en T004, 1440×360 WebP ≤ 40 kB; una entrada de manifiesto por imagen (`slug` `banner-<maestría>`, `proof_ref` = `research.md#r8`, `fallback_svg`, `provenance` con ruta de origen y `sha256`); la ruta interna no sale en el sitio; `check-assets` falla cerrado ante una portada sin entrada o con `sha256` distinto y con `own` no se emite; procedimiento y ruta de origen elegida documentados en `specs/009-rediseno-completo-ui/research.md` §R4. Pruebas rojas primero en `check-assets`. Evidencia: rojo/verde de `pnpm test:scripts` (check-assets), `pnpm assets:check`, tamaños y hashes. Depende de: T002, T004.
- [ ] **T008** [IMPL] Contraste de los tokens nuevos (research D3; FR-001) — `scripts/check-contrast.mts` (`:32-46`), `scripts/check-contrast.test.mts` — Aceptación: además de los pares actuales, comprueba como texto (≥ 4,5:1) los tokens de texto nuevos de la propuesta elegida (como mínimo `--color-focus` y `--color-pro`) y como borde (≥ 3:1) `--color-control` sobre `soot|panel|panel-2`; falla cerrado si falta un token. Prueba roja primero con un CSS de ejemplo que incumple. Se **integra después de T009**. Evidencia: rojo/verde de `pnpm test:scripts`, `pnpm check:contrast` sobre los tokens de T009. Depende de: T004 (nombres finales); integración tras T009.
- [ ] **T009** [UI] Base visual aprobada: paleta negra, tipografía, tokens y `DESIGN.md` (FR-001, FR-033; research D3) — `apps/web/src/styles/tokens.css`, `apps/web/src/styles/fonts.css` (si la propuesta cambia tipografía), `apps/web/src/styles/base.css`, `apps/web/src/styles/accessibility.css`, `apps/web/DESIGN.md` — Aceptación: con `impeccable` (`document`/new-work), tokens con los nombres actuales y los valores de la propuesta elegida en T004, más `--color-focus`, `--color-control` y `--color-pro`; `DESIGN.md` reescrito (rediseño) con la propuesta elegida registrada (fecha, decisión de Paco, capturas); fuentes autoalojadas con su peso medido; contraste forzado y foco revisados; sin cambios en componentes de página. Evidencia: `pnpm check:contrast` (con T008), `pnpm test`, `pnpm lint`, `pnpm e2e:a11y` 0 violaciones, capturas de comparación con la propuesta, bytes de CSS y fuentes (informativo). Depende de: T004, T001.
- [ ] **T010** [UI] Tooltip común accesible (FR-003; research D5) — `apps/web/src/app/shared/ui/tooltip/*` (componente o directiva, spec y preview), `apps/web/src/app/shared/svg/skill-tree/place-tooltip.ts` (extraer la colocación a un módulo compartido sin cambiar su comportamiento), `apps/web/src/styles/deferred.css` si el tooltip vive en bloques diferidos — Aceptación: abre con foco, hover y toque; Escape y toque fuera cierran; no tapa el disparador y se recoloca dentro del viewport; WCAG 1.4.13 (persiste al pasar el puntero, descartable); `aria-describedby`; posición por CSSOM (CSP); marco propio de la propuesta elegida; contenido prerenderizado cuando el texto es estático; `prefers-reduced-motion`. El tooltip del árbol sigue pasando sus pruebas (`e2e/skill-tooltip.spec.ts`). Pruebas de componente rojas primero. Evidencia: `pnpm test`, `pnpm e2e:a11y`, e2e del tooltip del árbol, `pnpm lint`. Depende de: T009.

**Checkpoint F3**: base aprobada en el código, datos y portadas disponibles, tooltip común listo.

---

## Fase 4 — US1 Cabecera e intro (P1)

**Objetivo**: entender la build en el primer pantallazo. **Prueba independiente**: quickstart «US1».

- [ ] **T011** [US1] [UI] Emisión de portadas, cabecera de la build e intro (FR-006, FR-007; research D6, D8) — `apps/web/tools/emit-banners.mts` (+`.test.mts`, como `emit-portraits`), `apps/web/tools/emit-static-assets.mts`, `apps/web/angular.json` (excluir `assets/banners/**` de la copia), `apps/web/src/app/features/build/header/*` (nuevo: portada, breadcrumb, chips de maestrías/rol/etapa/versión, título, fecha de actualización, acceso al changelog y su sección, autor con `bio` resumida, estado de contenido, intro), `apps/web/src/locale/messages.{en,es}.xlf` — Aceptación: portada de `title_a_mastery_slug` solo con `ASSET_SOURCE=game` (fallback propio con las mismas dimensiones con `own`), con atribución a Crate y no afiliación visibles; breadcrumb visible coherente con el JSON-LD (`build.page.ts:224`); fecha = último changelog o `published_at`; sin changelog no hay acceso; autor marcador sin enlace; bloques vacíos ocultos; todo en el HTML prerenderizado; sin tocar `build.page.html` (lo hace T016). Pruebas de componente rojas primero. Evidencia: `pnpm test`, `pnpm test:scripts` (emit-banners), `pnpm check:locale-parity`, preview del componente a 375/768/1280 con `game` y `own`, bytes (informativo). Depende de: T004, T005, T007, T010.

---

## Fase 5 — US2 Índice siempre visible (P1)

- [ ] **T012** [US2] [UI] Índice fijo con sección activa y control compacto en móvil (FR-008) — `apps/web/src/app/features/build/toc/*`, `apps/web/src/locale/messages.{en,es}.xlf` — Aceptación: fijo desde 768 px (hoy desde 80rem, `build-toc.css:111-118`); a 375 px, control compacto que abre el índice y lleva el foco al título elegido; `aria-current` y marca no cromática en la sección activa; sin JS, lista de enlaces; entradas para las secciones nuevas (`build-final`, `changelog`). Pruebas rojas primero. Evidencia: `pnpm test`, `pnpm e2e:a11y`, capturas a 375/768/1280. Depende de: T004, T009.

---

## Fase 6 — US3 Checklist y build final (P1)

- [ ] **T013** [US3] [UI] Checklist de progreso compacto al inicio (FR-010; research D7) — `apps/web/src/app/features/build/checklist/*` (nuevo), `apps/web/src/app/features/build/purchase-stepper/progress.ts` (solo si hay que exportar algo), `apps/web/src/locale/messages.{en,es}.xlf` — Aceptación: lista compacta de pasos con casilla, persistencia opcional local, borrado y aviso de privacidad actuales; mismo almacén que el orden de compra (marcar en uno se refleja en el otro); controles deshabilitados sin JS con aviso; posiciones duplicadas como hoy. Pruebas rojas primero. Evidencia: `pnpm test`, `pnpm e2e:a11y`. Depende de: T004, T010.
- [ ] **T014** [US3] [UI] Bloque «Build final»: skills de barra, devociones clave y pros/contras (FR-009, FR-004) — `apps/web/src/app/features/build/final-build/*` (nuevo), `apps/web/src/locale/messages.{en,es}.xlf` — Aceptación: skills de `hotbar` en orden con icono (del juego con `game`, propio con `own`) y tooltip (T010) con nombre en el idioma de la página, rango y tipo; devociones de `key_devotions` con símbolo propio (los iconos son de 010) y tooltip con nombre, tier y afinidades; tarjetas de pros y contras con marca no cromática; subbloques vacíos ocultos; prerenderizado. Pruebas rojas primero. Evidencia: `pnpm test`, `pnpm e2e:a11y`, preview a 375/768/1280. Depende de: T004, T005, T010.

---

## Fase 7 — US5 Loot filter (P3)

- [ ] **T015** [US5] [UI] Loot filter compacto (FR-013, FR-002) — `apps/web/src/app/features/build/loot-filter/*`, `apps/web/src/locale/messages.{en,es}.xlf` — Aceptación: cada regla con rótulo corto y detalle en tooltip o desplegable; columnas no desplegadas por defecto en móvil; contenido completo en el HTML; posiciones duplicadas como hoy. Pruebas rojas primero. Evidencia: `pnpm test`, `pnpm e2e:a11y`. Depende de: T004, T010.

---

## Fase 8 — Composición e idioma (US5, US6)

- [ ] **T016** [US5] [UI] Composición de la página con el orden nuevo (FR-011, FR-012, FR-014; research D8) — `apps/web/src/app/features/build/build.page.{html,ts,css}`, `apps/web/src/app/features/build/sections/*`, `apps/web/src/app/features/build/summary/*` (retirar lo que sustituye la cabecera) — Aceptación: orden cabecera → intro → checklist → build final → prioridades → habilidades → orden de compra → guía espiritual y devociones → loot filter → notas → fuentes/atribución con el changelog (metadato, no contenido); notas al final con letra menor que el contenido y no inferior al mínimo del sistema de tipos; separación clara entre secciones; `@defer` del árbol y del mapa intactos (T001); JSON-LD sin cambios salvo lo necesario. Pruebas rojas primero (orden de secciones en el HTML). Evidencia: `pnpm test`, `pnpm e2e:a11y`, capturas. Depende de: T011–T015.
- [ ] **T017** [US6] [UI] Nombres de juego según el idioma de la página (FR-005; research R6) — `apps/web/src/app/shared/i18n/game-name.ts` (nuevo, helper único), `apps/web/src/app/features/build/build.page.html` (respaldos `:32,40`), `apps/web/src/app/features/build/purchase-stepper/purchase-stepper.html` (`:33-34`), `apps/web/src/app/features/build/devotion-section/*`, `apps/web/src/app/shared/svg/devotion-map/*` (`constellationName`), `apps/web/src/app/features/build/final-build/*` — Aceptación: en `/es` los nombres oficiales ES y en la raíz los EN, sin el otro entre paréntesis (puede ir en tooltip o `lang` para AT); traducción ausente → nombre EN con `lang="en"` y pendiente registrado; el texto editorial conserva su `lang`. Pruebas rojas primero. Evidencia: `pnpm test`, `pnpm check:locale-parity`. Depende de: T016.

---

## Fase 9 — Verificación de la página

- [ ] **T018** [US6] [UI] e2e de la página nueva y prueba de idioma (SC-004, SC-005) — `e2e/journeys.spec.ts`, `e2e/a11y.spec.ts` — Aceptación: journeys cubren cabecera, índice, checklist, build final, loot filter y notas a 375/768/1280 en EN y ES, con y sin JS; una prueba falla si en `/es/builds/<slug>` o `/builds/<slug>` aparece a la vista un nombre de juego en el otro idioma; axe 0 violaciones en todas las rutas (incluida `/maestrias`). Evidencia: `pnpm build`, `pnpm e2e:journeys`, `pnpm e2e:a11y`, `pnpm typecheck:e2e`. Depende de: T017, T006.
- [ ] **T019** [UI] Capturas «después», revisión final de Paco, referencias visuales y medidas informativas (SC-003, SC-006, SC-007) — `e2e/visual-baselines/*` (30), fuera del repo `runs/11111619/capturas-s9-despues/` — Aceptación: capturas «después» de las mismas rutas, anchos y combinaciones que T001; Paco aprueba la revisión visual (SC-007) antes de regenerar referencias; las 30 referencias se regeneran en Docker con la imagen de Playwright de la CI (procedimiento de `CONTRIBUTING.md`) y el modo `check` pasa; cifras de HTML, JS inicial, CSS y LCP/CLS/TBT antes/después registradas en `quickstart.md` como **informativas** (P43). Evidencia: rutas de capturas, aprobación de Paco citada, salida de la regresión visual, tabla de medidas. Depende de: T018.

---

## Fase 10 — Registro y cierre

- [ ] **T020** [P] [DOCS] Registro del aplazamiento de T-043 y del descarte de T-148 (FR-030; research D9) — `specs/001-mvp-guias-builds/tasks.md` (T-043 `:75` y «Registro de aplazamientos»), `specs/backlog-dx.md` (T-148 `:5`) — Aceptación: T-043 lleva la marca de aplazamiento que lee `scripts/spec-review.mjs` (`DIFERIDA:` entre corchetes, con el motivo «revisión manual tras el rediseño spec009–013 (Paco, 2026-11-18)»; no se cita literal aquí porque el parser de esta spec la leería) y una entrada en el registro (estado `aplazada`, fecha, motivo: rediseño de la serie 009–013, se reactiva tras cerrar 013, decide Paco, fuente: `runs/11111619/tareas/ui.md` «spec009»); T-148 queda marcada como descartada (decisión de Paco, 2026-11-18) en `backlog-dx.md` y con entrada en una subsección «Descartadas» del registro; sin IDs T-NNN nuevos. `node scripts/spec-review.mjs prepare --feature specs/001-mvp-guias-builds` antes y después: T-043 pasa de `pendingTasks` a `excludedTasks` (`deferred`). Evidencia: salidas de `prepare` antes/después, `pnpm lint:md` 0, `pnpm check:scope` OK. Depende de: nada.
- [ ] **T021** [IMPL] Verificación de integración y puerta de cierre de spec009 (spec002 + T-136) — `specs/009-rediseno-completo-ui/quickstart.md` («Evidencia de cierre (T021)»), `specs/009-rediseno-completo-ui/reviews/`, `specs/009-rediseno-completo-ui/tasks.md`, `specs/README.md` (fila de spec009) — Aceptación: se marca antes de ejecutar la puerta según el precedente (spec002 T014 … spec008 T004); verificación sobre el resultado integrado de T001–T020: `pnpm verify` (si falla **solo** por presupuestos de rendimiento, se registran las cifras como informativas por P43 y se repite `check:performance` una vez), `ASSET_SOURCE=game pnpm build`, `pnpm e2e:a11y`, `pnpm e2e:journeys`, regresión visual en Docker, `pnpm lint:md`, `pnpm check:scope`; después `node scripts/spec-review.mjs prepare|check --feature specs/009-rediseno-completo-ui` y las cuatro revisiones más T-136 con `speckit-review-complete`; fila de spec009 cerrada en `specs/README.md`. Evidencia: tabla en `quickstart.md`, `reviews/completion-review.json` `passed`. Depende de: T001–T020.

---

## Dependencias y orden

```text
T001 (UI) ───────────────────────────────────────────────────────────────┐
T002 (DOCS) ───────────────┐                                             │
T003 (UI) ── T004 OK Paco ─┼─ T007 (IMPL) ─────────────┐                 │
                           ├─ T009 ── T010 ──┬─ T011 ──┼─ … ─ T016 ─ T017 ─ T018 ─ T019 ─┐
                           │                 ├─ T012 … T015                              │
                           └─ T008 (IMPL, integra tras T009)                             ├─ T021
T005 ── T006 (IMPL) ─────── (T011, T014 usan T005; T018 usa T006) ───────────────────────┤
T020 (DOCS) ─────────────────────────────────────────────────────────────────────────────┘
```

- **Dependencia dura**: T004 (aprobación visual de Paco) precede a T007–T019. Antes de T004 solo avanzan T001, T002, T003, T005, T006 y T020.
- T009 depende también de T001 (la corrección del árbol y el mapa entra antes de cambiar estilos).
- T011–T015 en serie en un agente UI (cadenas en `messages.*.xlf`); T016–T019 en serie.
- Aristas entre áreas: T005 → T011, T014 (UI usa el contrato); T006 → T018; T007 → T011; T008 se integra tras T009; T001–T020 → T021.

### Lotes por agente (líneas contiguas)

- **UI-1**: T001. **UI-2**: T003 (y el checkpoint T004 lo cierra el orquestador de UI con Paco). **UI-3**: T009, T010. **UI-4**: T011–T015. **UI-5**: T016–T019.
- **IMPL-1**: T005, T006. **IMPL-2**: T007, T008 (tras T004). **IMPL-3**: T021.
- **DOCS**: T002, T020.

### Ejemplos de paralelismo

- Al empezar: UI-1 (T001), UI-2 (T003), DOCS (T002, T020) e IMPL-1 (T005 → T006), cada uno en su worktree.
- Tras T004: UI-3 (T009 → T010) en paralelo con IMPL-2 (T007; T008 tras T009).

## Estrategia

1. **MVP**: T001 (Paco vuelve a ver el árbol y el mapa).
2. Base visual: T003 → T004 (OK de Paco) → T009 → T010.
3. Página por historias: US1 (T011), US2 (T012), US3 (T013, T014), US5 (T015, T016), US6 (T017), cada una verificable sola con su preview.
4. T018–T019 verifican; T021 cierra con la puerta.

## Cobertura de requisitos

| Requisito                   | Tareas                         |
| --------------------------- | ------------------------------ |
| FR-001                      | T003, T008, T009               |
| FR-002                      | T011–T015                      |
| FR-003                      | T010                           |
| FR-004                      | T007, T011, T014               |
| FR-005                      | T017, T018                     |
| FR-006, FR-007              | T005, T011                     |
| FR-008                      | T012                           |
| FR-009                      | T005, T006, T014               |
| FR-010                      | T013                           |
| FR-011, FR-012, FR-014      | T016                           |
| FR-013                      | T015                           |
| FR-024, FR-025              | T001                           |
| FR-028                      | T009–T019 (axe/contraste/journeys en cada tarea UI), T018 |
| FR-030                      | T020                           |
| FR-031                      | todas (restricción)            |
| FR-032                      | T002, T007                     |
| FR-033                      | T003, T004, T009               |
| SC-001                      | T011, T016, T018               |
| SC-003                      | T001, T019                     |
| SC-004                      | T017, T018                     |
| SC-005                      | T018                           |
| SC-006                      | T001, T019, T021 (informativo) |
| SC-007                      | T019                           |
| SC-008                      | T003, T004                     |

FR-015–FR-023, FR-026, FR-027, FR-029 y SC-002 están trasladados a 010–013 (`spec.md` §6) y no tienen tarea aquí.
