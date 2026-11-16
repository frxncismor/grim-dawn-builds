---
description: 'Tareas de implementación del rediseño de UI estilo Grim Dawn con flujo de guías tipo Maxroll'
---

# Tasks: Rediseño de UI estilo Grim Dawn, con flujo de guías tipo Maxroll

**Input**: `specs/004-rediseno-ui-grim-dawn/{spec.md,plan.md,research.md,quickstart.md}`
**Prerequisites**: Q11–Q15 respondidas por Paco (2026-11-15): Q11 = B (publicar iconos, con enmienda 1.11.0 y riesgos **antes**), Q12–Q15 = A.
**Tests**: Sí, exigidos por FR-003–FR-005, FR-010–FR-014, FR-017–FR-019, FR-040–FR-044 y SC-001–SC-010: primero en rojo, después implementación (constitución IX).

**Formato**: `[ID] [P?] [US?] descripción` — `[P]` = archivos disjuntos, paralelizable. Cada tarea declara archivos, aceptación y evidencia. **Ninguna casilla `[x]` sin salida real citable** (comando y resultado).

> **Estado**: planificación. Ninguna tarea está hecha. Las cifras de bytes citadas (tope por tarjeta, peso de la tipografía) son hipótesis que fija T006/T016 con medición; no son resultados.
>
> **Puerta de gobernanza G1 (Q11 = B)**: ninguna tarea puede versionar, extraer a una carpeta servida ni publicar un icono de habilidad del juego antes de que **T003 y T004 estén hechas y aprobadas por Paco**. Las tareas bloqueadas por G1 lo declaran como «Depende de T004 (G1)».
>
> **Ruta crítica de presupuesto**: `/tier-list` está a 110 406/120 000 B de HTML y 110 834/112 000 B de JS inicial (spec003). T002 mide antes de componer; ninguna tarea de superficie se cierra sin `check:performance` y `check:initial-js` en verde.

---

## Fase 0 — Gobernanza y puerta (bloquea publicar iconos y el resto)

- [x] **T001** Poner `typecheck:e2e` en `verify` y en el CI de PR (deuda T042/B-001 de spec003) — `scripts/verify-local.mjs` (+test), `.github/workflows/ci.yml` (+`scripts/ci-workflow.test.mts`), `package.json`, `CONTRIBUTING{,.es}.md` — Aceptación: test rojo que falla si `verify` no ejecuta `typecheck:e2e`; luego verde; `pnpm typecheck:e2e` exit 0 sobre los e2e actuales. Evidencia: salida de ambos comandos. **Estado 2026-11-15: hecha.** Rojo: `verify-local.test.mjs` 13 pass / 1 fail (`typecheck:e2e step missing`) y `ci-workflow.test.mts` 52 pass / 2 fail (`missing required check: pnpm run typecheck:e2e`); verde tras añadir el paso en `verify-local.mjs` (antes de `lint:md`) y el job de `ci.yml` (tras `Web lint`): 68 pass / 0 fail; `pnpm typecheck:e2e` exit 0 sobre los e2e actuales; documentado en `CONTRIBUTING{,.es}.md`.
- [ ] **T002** Medir la línea base del artefacto real antes de componer — `specs/004-rediseno-ui-grim-dawn/research.md` (R1, R2) — Aceptación: tabla de HTML, CSS gzip y JS inicial por ruta (`/`, `/tier-list`, `/builds/<slug>`, `/maestrias`, `/maestrias/soldier`) con comando y commit; margen restante por ruta; peso actual de fuentes. Sin código. Evidencia: salida de `build` + `check:performance` + `check:initial-js`.
- [ ] **T003** Redactar el análisis de riesgos de publicar iconos (`research.md` §R10, destino de `proof_ref`) — `specs/004-rediseno-ui-grim-dawn/research.md` — Aceptación: contiene los seis puntos mínimos de §R10 (qué se publica, base de uso sin permiso escrito, escenarios y mitigación, qué no se publica, reversibilidad con `docs/content/takedown-runbook.md`, decisión del dueño con cita a la Pregunta 11); **Paco lo aprueba** por escrito (principal/orquestador lo registra). Evidencia: enlace al texto y registro de la aprobación. Bloquea T004.
- [ ] **T004** **Enmienda 1.11.0 de §VII** (excepción 1: iconos de habilidad de «uso local ahora» a publicados como los retratos, con la condición común) — `.specify/memory/constitution.md` (texto, versión, pie de versiones), `fixtures/content/assets/NOTICE.md`, `docs/content/mastery-catalog{,.es}.md`, `specs/004-rediseno-ui-grim-dawn/{spec,plan,research}.md` — Aceptación: la constitución dice 1.11.0 y cita Q11 = B, el riesgo asumido por Paco, la atribución visible y el aviso de no afiliación, el fallback propio terminado como condición, la retirada inmediata y `proof_ref` a §R10; **no** amplía el alcance a marcos, fondos, tipografía ni localización; fija la granularidad del manifiesto para iconos (una entrada por icono, o una por colección con lista y `sha256` por archivo) para que T025 y T027 no reinterpreten la «condición común»; `pnpm lint:md`, `pnpm format:check` y `pnpm verify` en verde sin tocar código ni añadir imágenes; aprobada por Paco. Depende de T003. **Desbloquea G1.**
- [x] **T005** [P] Fuente única del estado de los activos (A-03 de spec003, ronda 1) — `scripts/check-assets.mts` (+test), `scripts/build-release.mts` (+test), `apps/api/src/**` solo si la lectura de `assets` lo exige — Aceptación: el manifiesto del repositorio manda en el artefacto; el build de release **falla** si la tabla `assets` y el manifiesto discrepan en `status` (test rojo primero); la tabla no se borra. Evidencia: tests y `pnpm assets:check`. **Estado 2026-11-15: hecha.** `assertAssetStatusParity` (`scripts/check-assets.mts`, regla única) compara el manifiesto con lo que publica la tabla `assets` (`/api/v1/assets`, vista `v_public_assets`, solo `approved`); `runRelease` (`scripts/build-release.mts`) la ejecuta antes del build con `ASSET_SOURCE=game` y falla cerrado nombrando el activo y los dos estados (discrepancia también si un activo está en un lado y no en el otro). Lo emitido sigue el manifiesto; la tabla y la API no se tocan. Pruebas rojas primero en `check-assets.test.mts` y `build-release.test.mts`; `pnpm test:scripts` 703 ok / 0 fallos; `pnpm assets:check` OK (6 entradas).
- [x] **T038** [P] Timeout propio del test axe del árbol (deuda de la puerta, aprobada por el principal) — `apps/web/src/app/shared/svg/skill-tree/skill-tree.catalog-a11y.spec.ts` — Aceptación: `passes axe-core with no violations` lleva un timeout de ~20 s (axe en jsdom tarda 5–7 s con el árbol completo y agota los 5 s por defecto bajo carga); la aserción y los demás tests no cambian; el test pasa en la suite completa y `pnpm verify` termina en exit 0. Evidencia: salida de `pnpm test` y `pnpm verify`. Verificado 2026-11-15 (orquestador UI): el test axe pasa en la suite completa (560 ok); aserción sin cambios.

**Checkpoint F0**: puerta con `typecheck:e2e`, línea base medida, y —solo si T003 y T004 están aprobadas— G1 abierta. Las Fases 1–4 y 6–7 **no** dependen de G1.

---

## Fase 1 — Fundación visual (US5, bloquea las superficies)

- [x] **T006** `PRODUCT.md` y `DESIGN.md` con Paco (impeccable `init`/`document`) — `apps/web/PRODUCT.md`, `apps/web/DESIGN.md` — Aceptación: modos por superficie (portada _Persuade_, catálogo y árbol _Operate_, guía _Read_), mundo visual, lista de rechazos de §2 y criterios de SC-010 escritos y aprobados por Paco; `impeccable` invocado por ruta absoluta del checkout principal. Evidencia: ambos archivos y la nota de aprobación. **Requiere a Paco como interlocutor.** Verificado 2026-11-15 (orquestador UI): `apps/web/PRODUCT.md` y `apps/web/DESIGN.md` con Preguntas 16–20 aplicadas (P16–P19 = A, P20 = B); **aprobados por Paco el 2026-11-15**; marca pública pendiente (se decide más tarde); audiencia: ambas, con foco en seguir guías; `lint:md` y `check:scope` OK.
- [ ] **T007** Tokens, tipografía y presupuesto de fuentes — `apps/web/src/styles/{tokens,fonts,base}.css`, `apps/web/public/fonts/**` (con su `LICENSE-*.txt`), `docs/fonts.md`, `scripts/font-preload.test.mts` si cambia el `preload` — Aceptación: una familia OFL de rótulo con carácter de grabado **sustituye** a Oswald; ≤ 3 familias y ≤ 5 archivos; `font-display: swap` y `preload` de la principal; peso total ≤ el actual + 20 kB (hipótesis a validar con T002); `pnpm check:contrast` verde para los tokens (texto ≥ 4,5:1, controles ≥ 3:1); `pnpm check:performance` no empeora. Depende de T002 y T006.
- [ ] **T008** [P] Marcos y texturas propios como SVG estáticos de mismo origen — `apps/web/public/assets/ui/*.svg`, `apps/web/src/styles/{tokens,base}.css` — Aceptación: marcos de 9 cortes (`border-image`) y textura sutil dibujados para el proyecto, ninguno del juego; ≤ 5 archivos; sin `data:` (CSP `img-src 'self'`); prueba de que ningún archivo coincide con el manifiesto de arte del juego; `build` sin violaciones de CSP. Depende de T006.

**Checkpoint F1**: tokens y arte propio listos y aprobados por Paco; presupuesto de fuentes cumplido.

---

## Fase 2 — US3 Tooltip junto al nodo (P1) 🎯

- [x] **T009** [P] [US3] Tests rojos de `placeTooltip` (función pura) — `apps/web/src/app/shared/svg/skill-tree/place-tooltip.spec.ts` — Aceptación: tabla de casos: arriba/abajo/izquierda/derecha con volteo, recorte al viewport en los cuatro bordes, contenedor desplazado, zoom 200 %, tooltip mayor que el espacio libre, hueco ≤ 16 px; fallan antes de la implementación. Evidencia: salida roja y luego verde. Verificado 2026-11-15 (orquestador UI): rojo previo `TS2307` (módulo inexistente), luego verde (~35 casos).
- [x] **T010** [US3] Implementar `placeTooltip` — `apps/web/src/app/shared/svg/skill-tree/place-tooltip.ts` — Aceptación: pasa T009; sin DOM, sin dependencias nuevas (FR-046). Depende de T009. Verificado 2026-11-15 (orquestador UI): pasa T009; función pura documentada para T011.
- [x] **T011** [US3] Tooltip HTML junto al nodo con señales existentes — `apps/web/src/app/shared/svg/skill-tree/skill-tree.{ts,html,css}`, `deferred.css`, `apps/web/src/locale/messages.*.xlf` — Aceptación: aparece al _hover_ y al foco (incluidas las flechas de `shared/svg/keyboard-nav.ts`), `role="tooltip"` y `aria-describedby` en el nodo, Esc lo cierra sin mover el foco, tolerancia breve para entrar en él (WCAG 1.4.13), solo uno a la vez, contenido factual sin texto del juego (FR-011), estado/puntos/justificación en modo asignación; pruebas de componente rojas primero; `check:locale-parity` verde. Depende de T010 (usa los tokens vigentes; T007 los refina después, sin bloquear). Verificado 2026-11-15 (orquestador UI): `skill-tree.tooltip.spec.ts` 7 de 8 rojas antes y 8/8 después; posición por propiedades del DOM (CSP intacta); 18 capturas 375/768/1280 EN/ES con hueco 8 px y dentro del viewport; `e2e:a11y` 141 y `e2e:journeys` 147 passed; `check:locale-parity` OK. Solo modo catálogo/asignación; panel inferior y táctil en T012.
- [ ] **T012** [US3] Táctil y retirada del panel inferior — mismos archivos más `skill-tree.spec.ts` — Aceptación: tocar un nodo fija el tooltip con botón de cierre y cierra al tocar fuera; el panel `skill-tree__detail` deja de ser el mecanismo principal pero **la lista textual sin JS permanece** como equivalente completo (FR-015); sin regresión de las pruebas de spec003. Depende de T011.
- [ ] **T013** [US3] e2e de tooltip y de presupuesto de TBT — `e2e/skill-tooltip.spec.ts`, `playwright.config.*` si hace falta — Aceptación: distancia nodo–tooltip ≤ 16 px y 100 % dentro del viewport a 375/768/1280 y zoom 200 % en las seis maestrías, por ratón, teclado y toque; 0 violaciones axe; 0 violaciones de CSP en consola; `check:performance` con TBT mediana ≤ 150 ms en las URLs de árbol bajo carga concurrente; `check:initial-js` verde. Evidencia: salida de `e2e:journeys`/`e2e:a11y` y `check:performance`. Depende de T012, T001.

**Checkpoint F2 (MVP de P1 independiente)**: el tooltip funciona con el tema actual, sin tarjetas ni iconos del juego.

---

## Fase 3 — US1 Builds como tarjetas (P1)

- [ ] **T014** [US1] Fijar el tope de bytes por tarjeta con medición — `specs/004-rediseno-ui-grim-dawn/research.md` (R2) — Aceptación: se construye un prototipo mínimo de tarjeta y se mide su coste real por tarjeta en `/tier-list` con el catálogo de fixtures y con el catálogo completo de combinaciones; se fija el tope (hipótesis previa: ≤ 600 B compacta y ≤ 1 000 B con guía) y se confirma que el peor caso cabe en 120 000 B; si no cabe, la tarea propone la variante compacta o la lista y **se detiene** a la espera de Paco. Depende de T002.
- [ ] **T015** [US1] `gd-build-card`: tests rojos y componente — `apps/web/src/app/shared/ui/build-card/*` (parte de `features/tier-list/tier-components.*`, que queda retirado o reducido), `apps/web/src/locale/messages.*.xlf` — Aceptación: enlace único con nombre accesible (combinación y estado), foco visible, objetivo ≥ 44 × 44 CSS px, dos retratos con `width`/`height` y _fallback_, estado de contenido y de revisión por texto y forma, daño, autor, versión; sin tier ni sello de recomendación en `placeholder`; ninguna tarjeta contiene otra tarjeta ni repite un patrón idéntico (prueba de componente); variantes destacada y compacta; nombre largo EN/ES sin desborde; retrato ausente o retirado sin saltos de maquetación (CLS ≤ 0,05). Sustituye a `gd-tier-card`. Depende de T014, T007, T008.
- [ ] **T016** [US1] Portada con tarjetas, sin JavaScript — `apps/web/src/app/features/home/*`, `apps/web/src/locale/messages.*.xlf` — Aceptación: guía destacada como tarjeta grande, selección de builds y accesos por maestría en el HTML prerenderizado; JS inicial de `/` = 0 B; `check:initial-js` y HTML ≤ 120 000 B verdes. Depende de T015.
- [ ] **T017** [US1] Catálogo por secciones con «sin guía» plegada — `apps/web/src/app/features/tier-list/*`, `core/content/*` si hace falta, `apps/web/src/locale/messages.*.xlf` — Aceptación: builds reales como tarjetas; combinaciones sin guía en una sección aparte y plegada (`<details>`, contenido en el HTML), tarjetas compactas con «sin guía» y sin tier; una ranura por combinación (AC-04 de spec001); filtros combinables, estado en URL, búsqueda y contador conservados; JSON-LD de lista intacto; HTML ≤ 120 000 B en el peor caso medido en T014. Depende de T015.
- [ ] **T018** [US1] e2e de recorrido y de no-recomendación — `e2e/journeys.spec.ts`, `e2e/a11y.spec.ts` — Aceptación: portada → guía en ≤ 2 clics y cualquier combinación en ≤ 3, EN y ES (SC-001); los `placeholder` no se presentan como recomendación; 0 violaciones axe y 0 de CSP en `/` y `/tier-list`; paridad EN/ES. Depende de T016, T017, T001.
- [ ] **T019** [US1] `impeccable detect` de la superficie y revisión — archivos cambiados de T015–T017 — Aceptación: `detect --json` sin hallazgos de reglas deterministas (SC-010); lista de lo que el detector no cubre revisada por pruebas de componente. Evidencia: salida del detector. Depende de T018.

**Checkpoint F3**: portada y catálogo con tarjetas, dentro de §6.

---

## Fase 4 — US2 Seguir una guía (P1; el paso a paso es P3 dentro de la historia)

- [ ] **T020** [US2] Resumen de build que sustituye marcado existente — `apps/web/src/app/features/build/*`, `apps/web/src/locale/messages.*.xlf` — Aceptación: bloque al inicio con maestrías y retratos, daño, estado, autor, versión, fuente y atribución, antes del primer bloque de contenido; HTML de la guía no aumenta de forma que supere 120 000 B (medido); presente sin JS. Depende de T015, T002.
- [ ] **T021** [US2] Índice sticky (escritorio) y plegable (móvil) con sección activa — `apps/web/src/app/features/build/toc/*`, `deferred.css` — Aceptación: enlaza al 100 % de las secciones (SC-002), funciona con anclas sin JS, marca la actual por texto además de color, `IntersectionObserver` solo en el bloque diferido, no cubre el contenido en móvil; pruebas rojas primero. Depende de T020.
- [ ] **T022** [US2] Paso a paso del orden de compra enlazado al árbol — `apps/web/src/app/features/build/purchase-stepper/*`, `shared/svg/skill-tree/*` — Aceptación: el árbol resalta lo que cambia en cada paso; región `aria-live` anuncia el paso actual; operable por teclado; el JS cabe en el límite diferido (≤ 40 kB gz) y `check:initial-js` sigue verde. **Si no cabe en §6, se registra el motivo y se aplaza sin bloquear T020, T021 y T023** (Q14 = A, historia de menor prioridad). Depende de T021, T012.
- [ ] **T023** [US2] e2e de guía y medición — `e2e/journeys.spec.ts`, `e2e/a11y.spec.ts` — Aceptación: resumen e índice en el HTML sin JS, la sección activa cambia al desplazarse (con JS), axe 0 critical/serious y CSP 0 en `/builds/<slug>`, EN y ES, 375/768/1280; `check:performance` verde; `impeccable detect` limpio. Depende de T021, T022.

**Checkpoint F4**: guía con resumen, índice y (si cabe) paso a paso.

---

## Fase 5 — US4 Iconos de habilidad publicados (P2) — abierta solo con G1

- [ ] **T024** [P] [US4] Iconos propios de _fallback_ (obligatorios antes de publicar) — `apps/web/src/app/shared/ui/icon/{registry,resolve-icon.server}.ts` (+tests; se amplía el registro existente), `apps/web/public/assets/ui/skill-icons.svg` — Aceptación: conjunto reducido por tipo (activa, modificadora, _transmuter_, circular, pasiva, glifo de maestría) como `<symbol>` referenciado por `<use>`, sin emoji ni glifos Unicode (SC-010), definido una vez; cada nodo del árbol muestra un icono propio con `ASSET_SOURCE=own`. Depende de T008. **No** depende de G1.
- [ ] **T025** [US4] Identificador público de icono y esquema del manifiesto (S-004) — `packages/domain/src/{mastery-tree,asset,schema}.ts` (+specs), `apps/api/src/**` y migración solo si el modelo lo exige, `fixtures/content/mastery-trees/*.json` (+`NOTICE.md`), `scripts/validate-content.mts` — Aceptación: el nodo se asocia a su icono por un `icon_id` público que **no** es la ruta de textura del juego; la vista pública, la API y el JSON emitido no exponen `icon` (test que falla si aparece); el esquema admite la forma de manifiesto decidida (entrada por icono o por colección con `sha256`); pruebas rojas primero; `schema-parity` verde si hay migración. Depende de T004 (G1) y T005.
- [ ] **T026** [US4] Extractor de iconos a PNG derivados — `scripts/extract-textures.mts` (+test), `.game-assets/` (ignorada) — Aceptación: decodifica los 164 `.tex` de icono a PNG 32 × 32 sin modificar contenido y registra `sha256`; salida local no versionada; no versiona nada todavía. Depende de T004 (G1).
- [ ] **T027** [US4] Versionar los PNG derivados con manifiesto y atribución — `apps/web/public/assets/skill-icons/*.png`, `fixtures/content/assets/manifest.json`, `fixtures/content/assets/NOTICE.md` — Aceptación: cada icono (o colección, según T025) con `origin_url`, `rights_holder = Crate Entertainment`, `license_or_permission = tolerancia_de_facto_sin_permiso`, `proof_ref` a `research.md#r10`, `fallback_svg` no vacío y `sha256`; `pnpm assets:check` verde y falla con una entrada inválida (prueba). **Aprobación previa de G1 verificable en el historial** (T003 y T004 hechas antes). Depende de T024, T025, T026 (G1).
- [ ] **T028** [US4] Mostrar los iconos en el nodo y emitirlos solo con `game` — `apps/web/src/app/shared/svg/skill-tree/*`, `apps/web/tools/emit-portraits.mts` o su sucesor (+test), `angular.json`, `scripts/{public-build-env,build-release}.mts` (+tests) — Aceptación: con `ASSET_SOURCE=own` el artefacto no contiene PNG de iconos del juego (test rojo si aparece, SC-009); con `game` cada icono servido tiene entrada `approved`, falla cerrado si falta, y `status: withdrawn` muestra el _fallback_ en el mismo cambio y retira el archivo; `width`/`height` fijos, `loading="lazy"`, CLS ≤ 0,05; atribución visible a Crate y aviso de no afiliación en árbol y guía. Depende de T027, T013 (G1).
- [ ] **T029** [US4] e2e y medición de iconos — `e2e/journeys.spec.ts`, `e2e/a11y.spec.ts` — Aceptación: seis maestrías con iconos en `game` y con `own`; axe 0; CSP 0; número de peticiones y peso por árbol medidos; si penalizan Lighthouse, decisión de hoja de sprites por maestría registrada; `check:performance` verde con `own` y con `game`. Depende de T028.

**Checkpoint F5**: árbol con iconos del juego publicados bajo manifiesto y retirada inmediata, con fallback propio.

---

## Fase 6 — US5 Rollout visual (P2)

- [ ] **T030** [US5] Aplicar tokens y marcos a las páginas restantes — `apps/web/src/app/features/{static-pages,author}/*`, `apps/web/src/app/shared/ui/layout/site-layout.*`, estilos globales — Aceptación: cabecera, pie, `/acerca`, `/legal`, `/autores/:slug` y 404 usan los mismos tokens; ningún color, fuente ni marco fuera del sistema (comprobación por búsqueda); `prefers-reduced-motion` y `prefers-contrast` respetados; `check:contrast` verde. Depende de T007, T008, F3.
- [ ] **T031** [US5] `impeccable detect` y barrido de contraste/CSP globales — todo `apps/web/src` cambiado — Aceptación: sin hallazgos deterministas; prueba que falla si `apps/web/src` o `apps/web/public` contienen «maxroll» (sin distinguir mayúsculas), su logotipo o sus textos (FR-030, SC-010); `e2e:a11y` 0 critical/serious en las cinco rutas EN/ES a 375/768/1280; 0 violaciones de CSP. Depende de T030.
- [ ] **T032** [US5] Revisión visual con Paco — capturas 375/768/1280, EN y ES, de las cinco rutas y de los tres estados del tooltip — Aceptación: aprobadas por Paco o lista de cambios cerrada (SC-011). **Requiere a Paco.** Depende de T031 y de F2–F5 que estén hechas.

---

## Fase 7 — US6 Cambio de maestría (P3)

- [ ] **T033** [US6] Selector de maestrías derivado del catálogo y `@view-transition` — `apps/web/src/app/features/masteries/*`, `apps/web/src/styles/base.css`, `apps/web/src/locale/messages.*.xlf` — Aceptación: selector con enlaces a las seis rutas conservando el idioma, derivado del catálogo y no escrito a mano; `@view-transition { navigation: auto }` como mejora progresiva, sin JS añadido ni carga de árboles en cliente (Q15 = A); sin la transición la navegación es idéntica; `check:initial-js` sin cambios. Depende de T007.
- [ ] **T034** [US6] e2e del selector — `e2e/journeys.spec.ts` — Aceptación: llega a `/maestrias/<otra>` en EN y ES; 0 axe, 0 CSP. Depende de T033.

---

## Fase 8 — Cierre

- [ ] **T035** Verificación completa y registro de evidencia — `specs/004-rediseno-ui-grim-dawn/quickstart.md` (sección de evidencia), este archivo — Aceptación: `pnpm verify` exit 0 con `own` y `check:performance` también con `game`; `pnpm lint:md` 0 issues; `pnpm check:scope` sin hallazgos; salidas reales con fecha y commit en `quickstart.md`; casillas marcadas solo con evidencia. Depende de todas las anteriores.
- [ ] **T036** Puerta de cierre de spec (spec002) — `specs/004-rediseno-ui-grim-dawn/**`, `node scripts/spec-review.mjs prepare|check` — Aceptación: `status: passed` tras las cuatro revisiones; hallazgos corregidos o aplazados con motivo. Depende de T035.
- [ ] **T037** [P] Registro SDD y deuda aplazada — `specs/README.md`, `specs/003-catalogo-arboles-maestria/tasks.md` (notas), backlog técnico — Aceptación: fila de spec004 en `specs/README.md`; A-01, C-003, T042/C-001 y T043 de spec003 anotadas como aplazadas con motivo (R8); To-do (`todo`) al día. Depende de T035.

---

## Dependencias y orden

```text
F0: T001, T002 -> (T003 -> T004 = G1)   T005 [P]
F1: T006 -> T007, T008 [P]
F2: T009 -> T010 -> T011 -> T012 -> T013         (independiente de G1)
F3: T014 -> T015 -> T016, T017 -> T018 -> T019
F4: T020 -> T021 -> T022 -> T023
F5: T024 [P] ; T025, T026, T028 -> G1 ; T027 -> T028 -> T029
F6: T030 -> T031 -> T032
F7: T033 -> T034
F8: T035 -> T036, T037
```

- **MVP**: T001 + T002 y F2 (tooltip) entregan el cambio de usabilidad más concreto sin tocar tarjetas, tema ni derechos.
- **Paralelo posible tras F1**: F2, F3, F4 y F7 (archivos disjuntos salvo `skill-tree`, que comparten F2 y F5; F5 va después de F2).
- **G1** (T003 → T004, con aprobación de Paco) solo bloquea T025–T029. Todo lo demás avanza sin ella.
- T011, T012, T022 y T028 editan `shared/svg/skill-tree/*`: se ejecutan en serie (T022 y T028 tras T012), nunca en paralelo.
- Los identificadores `T0xx` de esta spec chocan nominalmente con los de spec003: todo commit, reporte y revisión de la puerta los cita como `spec004 T0xx`.

## Trazabilidad requisitos → tareas

| Requisito           | Tareas                         |
| ------------------- | ------------------------------ |
| FR-001, FR-003–005  | T015, T016                     |
| FR-002, FR-006      | T017                           |
| FR-007, FR-008      | T020, T021                     |
| FR-009              | T022                           |
| FR-010–FR-015       | T009–T013                      |
| FR-016, FR-017      | T024, T025, T027, T028         |
| FR-018              | T003, T004 (G1), T027          |
| FR-019              | T025, T028                     |
| FR-020              | T006, T007                     |
| FR-021, FR-024      | T008                           |
| FR-022, FR-023      | T007, T030, T031               |
| FR-025              | T033, T034                     |
| FR-030              | T019, T031 (detección de marca)|
| FR-040              | T002, T013, T014, T016–T017, T020, T023, T029, T035 |
| FR-041              | T013, T018, T023, T031         |
| FR-042              | T011, T015, T017, T020, T033   |
| FR-043              | T013, T018, T023, T029, T031   |
| FR-044              | T016, T017, T020, T021         |
| FR-045, FR-046      | T005, T010, T035               |
| SC-001              | T018                           |
| SC-002              | T021, T023                     |
| SC-003              | T013                           |
| SC-004, SC-007      | T013, T018, T023, T031         |
| SC-005, SC-006      | T002, T013, T035               |
| SC-008              | T011, T035                     |
| SC-009              | T004, T027, T028               |
| SC-010              | T019, T031                     |
| SC-011              | T032                           |
