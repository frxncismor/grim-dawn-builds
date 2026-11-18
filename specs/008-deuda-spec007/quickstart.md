# Quickstart: validar spec008

Prerrequisitos: `pnpm install --frozen-lockfile`, `pnpm --filter @gd/domain build`, gitleaks (`pnpm setup:gitleaks`), sin `HTTP_PROXY`/`HTTPS_PROXY`. `pnpm` global 12.18.0 (no `corepack pnpm`).

## US1 — lectura única del artefacto (T002, T003)

```sh
node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts scripts/check-legacy-brand.test.mts
pnpm test:scripts
pnpm assets:check
pnpm check:boundaries
pnpm lint
```

Esperado:

- Pruebas del espía en rojo antes del cambio (`prerenderedPages`: 2 lecturas, se espera 1; `assertNoGamePortraits` con `own`: 4, se espera 1) y en verde después; con `game`, 0 lecturas.
- Pruebas de caracterización de mensajes exactos (enlace bajo `browser/`, enlace fuera de `browser/`, precedencia «vacío antes que enlace fuera de `browser/`») en verde antes y después.
- Las pruebas existentes de `artifact-pages.test.mts` y `check-assets.test.mts` sin tocar su aserción; el caso de enlace de archivo se omite con motivo solo ante `EPERM`/`EACCES` (declararlo).
- `git diff --stat` solo con `scripts/artifact-pages.{mts,test.mts}` y `scripts/check-assets.{mts,test.mts}`; `scripts/check-public-build.mts`, `scripts/check-release.mts` y `scripts/compare-builds.mts` sin cambios.

## US2 — registro de spec007 (T001)

```sh
grep -n "DV1\|DV2" specs/008-deuda-spec007/erratum.md
grep -n "spec008" specs/007-deuda-revisiones-3/reviews/deuda.md
grep -n "007-deuda" specs/README.md
git diff --stat -- specs/007-deuda-revisiones-3
pnpm lint:md
pnpm check:scope
```

Esperado: el erratum fija DV1 = S6-D3 (T003) y DV2 = B-002 (T002) y remite a `plan.md:135-136`; `deuda.md` marca cerradas por spec008 T001 las entradas 1 y 2 de la ronda 2 (S-003 y la entrada 3 las cierra T004); `specs/README.md` muestra spec007 «Cerrada (puerta spec002 passed, `95f18de`)», 7 de 7, fusionada en `mvp/1` en `1375dda`; el `diff` de `specs/007-deuda-revisiones-3` solo toca `reviews/deuda.md`; `lint:md` 0 issues.

## Cierre (T004)

```sh
pnpm verify
node scripts/spec-review.mjs prepare --feature specs/008-deuda-spec007
# cuatro revisiones + T-136 con speckit-review-complete
node scripts/spec-review.mjs check --feature specs/008-deuda-spec007
```

Esperado: `pnpm verify` exit 0; `prepare` en `ready`; `check` en `passed`. La tabla «Evidencia de cierre (T004)» se añade aquí al cerrar.

## Evidencia de cierre (T004)

Fecha: 2026-11-18. HEAD de base: `9252955` (`orq/11111619-ui-s8-vr`, sin cambios locales al empezar; T001–T003 integradas). `pnpm` 12.18.0, sin
`HTTP_PROXY`/`HTTPS_PROXY`, un solo proceso pesado a la vez. Salidas saneadas (rutas omitidas). Todos los pasos pasaron a la
primera: no hizo falta repetir ninguno. Tras el build `game` se reconstruyó `own` con `pnpm build` antes de los e2e. Sin cambios en
`apps/`; la regresión visual se corrió igualmente.

| Comando                                                               | Exit | Extracto                                                                                                  |
| --------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| `pnpm verify` (`ASSET_SOURCE=own`)                                    | 0    | `verify OK (local)`; `check:performance OK (141/141 comprobaciones)`; web 325 passed; `test:scripts` 830  |
| `check:initial-js` dentro de `verify`                                 | 0    | `/` 0/90000; `/tier-list` y `/es/tier-list` 111422/112000 B; `/maestrias` y `/es/maestrias` 106194/112000 |
| `ASSET_SOURCE=game pnpm build`                                        | 0    | `emit-static-assets OK (… 6 retratos y 164 iconos de habilidad con ASSET_SOURCE=game)`                    |
| `ASSET_SOURCE=game pnpm check:performance`                            | 0    | `check:performance OK (141/141 comprobaciones)`                                                           |
| `RUN_DB_TESTS=1 pnpm --filter @gd/api exec vitest run --maxWorkers=2` | 0    | `Test Files 35 passed (35)`; `Tests 502 passed, 1 expected fail (503)`; 0 saltadas                        |
| `pnpm build` (`own`), `pnpm e2e:drafts:build`, `pnpm e2e:video:build` | 0    | build OK (los tres)                                                                                       |
| `pnpm e2e:a11y --workers=2`                                           | 0    | `183 passed`, 0 fallos                                                                                    |
| `pnpm e2e:journeys --workers=2`                                       | 0    | `544 passed`, `41 skipped`, 0 fallos                                                                      |
| `e2e:visual` en Docker (árbol por stdin, `sh /run.sh check`)          | 0    | `30 passed`; `git status e2e/visual-baselines` limpio                                                     |
| `pnpm test:scripts`                                                   | 0    | `tests 830`, `pass 827`, `fail 0`, `skipped 3`                                                            |
| `pnpm typecheck:e2e`                                                  | 0    | sin errores                                                                                               |
| `pnpm lint:md`                                                        | 0    | `Summary: 0 issues in 0 files`                                                                            |
| `pnpm check:scope`                                                    | 0    | `check:scope OK (269 archivos revisados)`                                                                 |

`/tier-list` queda en 111 422 B, por debajo del tope de 112 000 B (sin cambios: spec008 no toca `apps/web`). Las pruebas con BD
usaron sus contenedores efímeros; no se tocó el stack `grim-dawn-builds`.
