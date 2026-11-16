# T-136: revisión final de código de spec004 (ronda 3)

Revisión final independiente con el modelo más potente disponible (claude-opus-5-5, Claude Code), adicional a las cuatro revisiones de la puerta spec002 de `completion-review.json`. Snapshot `0663ab5ecf480cf56273b7a5ad49cd55f6f0d257b108861f267961d767f0bd04`, HEAD `445c2ac`. Resultado: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW (F-001, aplazado por decisión del principal el 2026-11-16; seguimiento S4-D3 en `deuda.md`).

Rondas anteriores: ronda 1 (HIGH F-001 de crédito, corregido en T047) y ronda 2 (MEDIUM F-001 de nombre de combinación, corregido en T052).

## Informe (Review)

```json
{
  "specialty": "code",
  "reviewer": "11111619-revisor-cierre-s4-t136-r3 (claude-opus, Claude Code)",
  "mode": "independent",
  "status": "completed",
  "coverage": [
    "git diff 1fd7e77..445c2ac (362 archivos; prioridad al código ejecutable)",
    "apps/web/src/app/shared/svg/skill-tree/{skill-tree.ts,skill-tree.html,place-tooltip.ts}: ciclo de vida del tooltip (afterNextRender/AfterRenderRef, guarda de id, oyentes scroll/resize/orientationchange, rAF, ngOnDestroy), crédito data-game-art-credit, gameIconSrc/showsGameArt",
    "apps/web/src/app/shared/ui/build-card/{build-card.ts,build-card.labels.ts,build-card.model.ts}: nombre de combinación, lang en el título, nombre accesible con texto oculto",
    "apps/web/src/app/features/home/{home-builds.ts,home.page.ts,home.page.html,home.page.css}: validación de fecha (calendarDate), fecha localizada, crédito",
    "apps/web/src/app/features/tier-list/{card-data.ts,public-guide.ts,tier-list.page.ts,tier-list.page.html,tier-components.ts,catalog.model.ts,tier-preview.component.ts}",
    "apps/web/src/styles/{styles.css,tier-list.css,tier-components.css,build-card.css}: CSS global con prefijos y posibles fugas",
    "scripts/check-assets.mts (assertGameAssets, assertAssetStatusParity, assertNoGamePortraits, assertPortraitCredit, assertSkillIconCredit) y scripts/build-release.mts",
    "apps/web/tools/{emit-skill-icons.mts,emit-static-assets.mts}; apps/web/src/app/core/content/{skill-icons.ts,skill-icons.server.ts,portraits.server.ts,mastery.resolver.ts,mastery.guard.ts}; apps/web/src/app/app.config.server.ts",
    "apps/web/src/app/features/build/{summary/build-summary.ts,toc/build-toc.*,toc/toc-observer.ts,purchase-stepper/*,build.page.*}; apps/web/src/app/features/masteries/mastery.page.*",
    "packages/domain/src/{asset.ts,mastery-tree.ts}; apps/api/drizzle/0014_public_skill_icon_id.sql; apps/api/src/{catalog/map-mastery.ts,catalog/mastery-repository.ts,db/schema.ts,db/write-content.mts}",
    "scripts/{extract-textures.mts,extract-mastery-trees.mts,validate-content.mts,check-initial-js.mts,check-performance.mts,static-home.mts,check-locale-parity.mts,verify-local.mjs}; package.json; playwright.config.ts; lighthouserc.json; .github/workflows/ci.yml",
    "Contexto: AGENTS.md, CLAUDE.md, specs/004-rediseno-ui-grim-dawn/tasks.md (T042–T055), specs/002-spec-completion-reviews/{data-model.md,contracts/review-gate.md}, .agents/skills/review-code/SKILL.md"
  ],
  "checks": [
    "node scripts/spec-review.mjs prepare --feature specs/004-rediseno-ui-grim-dawn → status ready, snapshot 0663ab5ecf480cf56273b7a5ad49cd55f6f0d257b108861f267961d767f0bd04 (coincide con el encargo); git status limpio",
    "node --import tsx --test scripts/check-assets.test.mts scripts/build-release.test.mts apps/web/tools/emit-skill-icons.test.mts apps/web/src/app/core/content/skill-icons.server.test.mts scripts/skill-icon-manifest.test.mts scripts/check-initial-js.test.mts → tests 48, pass 48, fail 0",
    "apps/web: pnpm exec ng test --watch=false --include src/app/shared/**/*.spec.ts --include src/app/features/{home,tier-list,build}/**/*.spec.ts → 37 ficheros, 507 passed, 2 expected fail, 0 fallos",
    "node -e (sonda de Date.parse): '2026-02-30' es finito en V8 y new Date da 1 de marzo; calendarDate lo rechaza por la comparación con toISOString; z.iso.date() del dominio también lo rechaza, así que portada y resumen coinciden con datos válidos"
  ],
  "limitations": [
    "No ejecuté pnpm verify, build con ASSET_SOURCE=game/own, check:performance, e2e (journeys, a11y, skill-tooltip) ni las suites de API con BD: son lentas y otros revisores comparten el árbol. Para esas puertas me baso en la evidencia citada en specs/004-rediseno-ui-grim-dawn/quickstart.md y tasks.md, que no he reproducido.",
    "Revisé por muestreo los cambios de datos (manifest.json, mastery-trees/*.json, snapshot de drizzle) y los textos (xlf, docs); el código ejecutable sí lo revisé entero en las rutas listadas.",
    "No medí el CSS crítico ni el JS inicial; la conclusión sobre fugas de estilo sale de leer los selectores, no de un render."
  ],
  "findings": [
    {
      "id": "F-001",
      "severity": "LOW",
      "path": "apps/web/src/app/shared/ui/build-card/build-card.ts",
      "line": 55,
      "evidence": "srText (build-card.labels.ts:65) mete el estado en el texto oculto del título ('. combinación. estado. pestaña nueva'). El párrafo visible <p class=\"build-card__status\">{{ d.statusLabel }}</p> no lleva aria-hidden, y en cambio el de la combinación sí (build-card.ts:53). En las tarjetas sin enlace (compact, «No guide») el texto oculto va dentro del <h3> sin ser nombre de ningún enlace.",
      "impact": "Un lector de pantalla en modo lectura anuncia el estado dos veces en cada tarjeta (dentro del título o del enlace, y otra vez en el párrafo). En las compactas la repetición no aporta nada, porque no hay nombre de enlace que completar. Es verbosidad de accesibilidad, no una pérdida de información ni un fallo de axe.",
      "recommendation": "Tratar el estado igual que la combinación: aria-hidden=\"true\" en .build-card__status cuando el texto oculto ya lo incluye. O bien emitir srText solo cuando hay enlace (href o externalHref) y dejar el párrafo visible en las compactas. Añadir una prueba que compruebe que el estado se anuncia una sola vez por variante.",
      "disposition": "deferred",
      "deferReason": "Aplazado en la puerta T036 por decisión del principal (2026-11-16, opción A, como en spec003): LOW sin impacto observable (verify, check:performance 141/141 own/game, puertas de crédito y e2e:a11y en verde; capturas idénticas). Seguimiento en specs/004-rediseno-ui-grim-dawn/reviews/deuda.md y en el to-do del proyecto: S4-D3: aria-hidden en .build-card__status cuando srText ya incluye el estado."
    }
  ]
}
```

## Resumen del revisor

### T-136 (spec004, ronda 3): revisión final de código

### Resumen

**Modelo usado**: Claude Opus 5.5 (`claude-opus-5-5`) en Claude Code. Revisión independiente y de solo
lectura: no edité ningún archivo del repo.

### Alcance cubierto

Revisé de nuevo toda la huella `1fd7e77..445c2ac`, priorizando el código ejecutable. Miré con más detalle
las cinco zonas de riesgo de la ronda 2:

- **Ciclo de vida del tooltip (T054)**: `positionTooltip` destruye el `AfterRenderRef` pendiente antes
  de cada nueva ejecución y vuelve a comprobar `tooltipNodeId() === id` dentro del callback. Los oyentes
  pasivos (scroll del lienzo, `resize`, `orientationchange`) se instalan solo con un tooltip abierto, se
  limitan a un `requestAnimationFrame` y se retiran al cerrar y en `ngOnDestroy`. El hook se registra con
  el inyector del componente, así que también muere con él. No encontré ninguna fuga ni carrera que se
  pueda demostrar.
- **CSS global con prefijos (T052)**: `tier-list.css` está acotado a `gd-tier-list-page` y
  `tier-components.css` a `:is(gd-tier-row, gd-filter-chip, gd-filter-bar, gd-empty-state)`. Esas
  etiquetas solo aparecen en `/tier-list` y en la vista de prueba. `build-card.css` usa clases BEM
  propias. No encontré fugas a otras páginas. No medí el CSS crítico (ver limitaciones).
- **Nombre accesible con texto oculto (T052)**: el `lang` va solo en el `<span>` del título y
  `.build-card__sr` no lo lleva, así que el nombre no mezcla idiomas. Queda una repetición menor del
  estado (F-001).
- **Validación de fecha**: `calendarDate` rechaza fechas que no existen (`2026-02-30`), algo que
  `Date.parse` solo no hace en V8. El dominio (`z.iso.date()`) ya filtra antes, así que la portada y
  `build-summary` muestran la misma fecha, en UTC y con el formato del idioma.
- **Puerta de crédito de iconos (T053)**: `assertSkillIconCredit` va en `runRelease` justo después de
  `assertPortraitCredit` y usa la misma lógica:
  - con `game`, toda página que tenga un PNG de `assets/skill-icons` debe llevar `data-game-art-credit`;
  - con `own`, ninguna página puede llevarlo.

  `data-game-art-credit` no contiene la cadena `data-credit`, así que las dos puertas no se pisan. El
  emisor, el prerender y `assertGameAssets` comparten `classifySkillIconEntry`. Con todo `withdrawn` se
  emiten 0 PNG y la plantilla tampoco muestra crédito, así que ambos lados quedan coherentes.

Revisé además la API (migración 0014, vista recreada con su GRANT, `icon_id` validado al mapear), la
derivación de `icon_id` en el extractor y en `validate-content`, los presupuestos de JS de `/builds/:slug`
y el selector de maestrías. Este último navega con `routerLink`, pero `ensureMasteryTree` fuerza una
carga completa cuando falta el snapshot, así que no da un 404 falso.

### Comprobaciones ejecutadas

| Comando                                                                                                                                                | Resultado                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `node scripts/spec-review.mjs prepare --feature specs/004-rediseno-ui-grim-dawn`                                                                       | `ready`, el snapshot coincide con el del encargo |
| `node --import tsx --test` sobre `check-assets`, `build-release`, `emit-skill-icons`, `skill-icons.server`, `skill-icon-manifest` y `check-initial-js` | 48/48 pasan                                      |
| `ng test` (subconjunto `shared/**`, `features/{home,tier-list,build}/**`)                                                                              | 37 ficheros, 507 pasan, 2 «expected fail»        |
| Sonda de `Date.parse` con node                                                                                                                         | Confirma que `calendarDate` hace falta           |

### Hallazgos por severidad

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 1
  - **F-001**: el estado de la tarjeta se anuncia dos veces, una en el texto oculto del título o enlace
    y otra en el párrafo visible sin `aria-hidden`. En las tarjetas compactas la repetición no aporta
    nada. Está en `apps/web/src/app/shared/ui/build-card/build-card.ts:55`.

### Limitaciones

No ejecuté `pnpm verify`, los builds con `game` y `own`, `check:performance`, los e2e ni la API con BD.
Para esas puertas me baso en la evidencia de `quickstart.md`. Los datos y los textos los revisé por
muestreo.
