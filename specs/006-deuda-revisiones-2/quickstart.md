# Quickstart: validar spec006

Prerrequisitos: `pnpm install --frozen-lockfile`, `pnpm --filter @gd/domain build`, gitleaks (`pnpm setup:gitleaks`), sin `HTTP_PROXY`/`HTTPS_PROXY`. `pnpm` global 12.18.0 (no `corepack pnpm`). Postgres de la corrida para los `*.int.spec.ts` (`RUN_DB_TESTS=1`); Docker para la regresión visual y S-001.

## US1 — puertas sobre el artefacto (T001)

```sh
pnpm test:scripts            # incluye artifact-pages, check-assets y check-legacy-brand
pnpm assets:check
```

Esperado: casos nuevos de «sin `browser/`», «`browser/` como archivo o enlace» y «sin `.html`» para las cuatro puertas, en rojo antes del cambio para `assertNoGamePortraits`; todas en verde después; las salidas con artefacto válido iguales (pruebas existentes sin tocar su aserción). Una búsqueda de `pages.length === 0` y `pages.length <=` en `scripts/check-assets.mts` y `scripts/check-legacy-brand.mts` no devuelve nada (el criterio vive solo en `scripts/artifact-pages.mts`).

## US2 y US3 — tarjeta determinista y descripción accesible (T002, T003)

```sh
pnpm test                    # web: build-card.spec, card-data.spec, home-builds
pnpm build && pnpm check:initial-js
pnpm e2e:a11y
# regresión visual: modo check con el procedimiento Docker vigente de CONTRIBUTING.md («Visual regression references»)
```

Esperado: prueba de dos renders con igual id y sin `let` de módulo en `build-card.ts`; `/tier-list` ≤ 112 000 B (base 111 403 B; anotar la cifra); `e2e:a11y` 0 violaciones con el caso nuevo de `aria-describedby` en EN y ES; regresión visual 30 passed sin regenerar. Determinismo: dos `pnpm build` seguidos dan el mismo conjunto de `id="build-card-combination-…"` en `dist/grim-dawn-builds/browser/**/tier-list/index.html` (`grep -o` y `diff` vacío).

## US4 — registro SDD (T004)

```sh
grep -rn "confirmación de Paco" specs/005-deuda-revisiones/{spec,plan,quickstart,tasks}.md
grep -n "en curso\|S3-T042" specs/README.md
pnpm lint:md
```

Esperado: ninguna línea que asocie la base de 111 403 B a una confirmación pendiente; `specs/README.md` sin «en curso» para spec004/spec005 y sin S3-T042/S3-T043 como aplazados; `lint:md` 0 issues.

## US5 — siembra, contenedor y arranque en frío (T005–T007)

```sh
RUN_DB_TESTS=1 pnpm --filter @gd/api exec vitest run test/seed.int.spec.ts test/bootstrap.int.spec.ts
pnpm --filter @gd/api test
pnpm test:scripts            # visual-baselines-docker.test
RUN_DB_TESTS=1 pnpm --filter @gd/api exec vitest run test/performance.int.spec.ts
```

Esperado: (T005) siembra que quita un nodo y deja de usarlo en la misma pasada → OK; nodo quitado y aún usado → `seed failed: reference` con la maestría y sin cambios parciales; idempotencia intacta. (T006) con el comando nuevo de `CONTRIBUTING.md`, `docker run … sh -c 'test ! -e /work/.env'` y el `check` dan 30 passed; un `.env` de prueba en el host no aparece en el contenedor; `git status e2e/visual-baselines` limpio. (T007) el informe muestra 3 muestras y la mediana ≤ 5000 ms.

## Cierre (T008)

```sh
node scripts/spec-review.mjs prepare --feature specs/006-deuda-revisiones-2
# cuatro revisiones (code, architecture, security, best-practices) y T-136, ver speckit-review-complete
node scripts/spec-review.mjs check --feature specs/006-deuda-revisiones-2
pnpm verify
```

Esperado: `check` en `passed` y `pnpm verify` exit 0 (si solo falla el TBT de Lighthouse, repetir `pnpm check:performance` y citar cifras, como en spec005).

## Evidencia de cierre (T008)

Fecha: 2026-11-17. HEAD de base: `d9bce1c` (`orq/11111619-ui-s6-vr`, sin cambios locales al empezar). `pnpm` 12.18.0, sin
`HTTP_PROXY`/`HTTPS_PROXY`, un solo proceso pesado a la vez. Salidas saneadas (rutas y cadenas de conexión omitidas). Todos los
pasos pasaron a la primera: no hizo falta repetir ninguno.

| Comando                                                               | Exit | Extracto                                                                                                           |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify` (`ASSET_SOURCE=own`)                                    | 0    | `verify OK (local)`; `check:performance OK (141/141 comprobaciones)`; web 683 passed; `test:scripts` 815           |
| `check:initial-js` dentro de `verify`                                 | 0    | `/` 0/90000; `/tier-list` y `/es/tier-list` 111395/112000 B; `/maestrias` 106193/112000                            |
| `ASSET_SOURCE=game pnpm build`                                        | 0    | `emit-static-assets OK (… 6 retratos y 164 iconos de habilidad con ASSET_SOURCE=game)`; `/tier-list` 111395/112000 |
| `ASSET_SOURCE=game pnpm check:performance`                            | 0    | `check:performance OK (141/141 comprobaciones)`                                                                    |
| `RUN_DB_TESTS=1 pnpm --filter @gd/api exec vitest run --maxWorkers=2` | 0    | `Test Files 35 passed (35)`; `Tests 501 passed \| 1 expected fail (502)`; 0 saltadas                               |
| `pnpm e2e:drafts:build`, `pnpm e2e:video:build`                       | 0    | build OK (ambos)                                                                                                   |
| `pnpm e2e:a11y --workers=2`                                           | 0    | `177 passed`, 0 fallos                                                                                             |
| `pnpm e2e:journeys --workers=2`                                       | 0    | `544 passed`, `41 skipped`, 0 fallos                                                                               |
| `e2e:visual` en Docker (árbol por stdin, `sh /run.sh check`)          | 0    | `30 passed`; `git status e2e/visual-baselines` limpio                                                              |
| `pnpm test:scripts`                                                   | 0    | `tests 815`, `pass 813`, `fail 0`, `skipped 2`                                                                     |
| `pnpm typecheck:e2e`                                                  | 0    | sin errores                                                                                                        |
| `pnpm lint:md`                                                        | 0    | `Summary: 0 issues in 0 files`                                                                                     |
| `pnpm check:scope`                                                    | 0    | `check:scope OK (267 archivos revisados)`                                                                          |

`/tier-list` queda en 111 395 B, por debajo del tope de 112 000 B. Las pruebas con BD usaron sus contenedores efímeros; no se tocó el
stack `grim-dawn-builds`.

## Verificación tras las correcciones de la ronda 1 de la puerta (T009–T010)

Fecha: 2026-11-17. HEAD: `2668ff3` (`orq/11111619-ui-s6-vr2`, sin cambios locales al empezar). `pnpm` 12.18.0, sin
`HTTP_PROXY`/`HTTPS_PROXY`, un solo proceso pesado a la vez. Salidas saneadas. Una sola repetición, y no fue por tiempos:
`e2e:journeys` falló la primera vez (exit 1, 502 passed, 42 failed, todos de `skill-icons` y retratos propios) porque `dist/`
era el artefacto `ASSET_SOURCE=game` que dejó el paso 2; se reconstruyó con `pnpm build` (`own`), se repitió `e2e:a11y` y
`e2e:journeys` y pasaron. Orden correcto: los e2e van sobre el artefacto `own`.

| Comando                                                               | Exit | Extracto                                                                                                            |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify` (`ASSET_SOURCE=own`)                                    | 0    | `verify OK (local)`; `check:performance OK (141/141 comprobaciones)`; `test:scripts` 815                             |
| `check:initial-js` dentro de `verify`                                 | 0    | `/` 0/90000; `/tier-list` y `/es/tier-list` 111395/112000 B                                                          |
| `ASSET_SOURCE=game pnpm build`                                        | 0    | `emit-static-assets OK (… 6 retratos y 164 iconos de habilidad con ASSET_SOURCE=game)`; `/tier-list` 111395/112000 |
| `ASSET_SOURCE=game pnpm check:performance`                            | 0    | `check:performance OK (141/141 comprobaciones)`                                                                     |
| `RUN_DB_TESTS=1 pnpm --filter @gd/api exec vitest run --maxWorkers=2` | 0    | `Test Files 35 passed (35)`; `Tests 502 passed \| 1 expected fail (503)`; 0 saltadas                                |
| `pnpm build` (`own`), `pnpm e2e:drafts:build`, `pnpm e2e:video:build` | 0    | build OK (los tres)                                                                                                 |
| `pnpm e2e:a11y --workers=2`                                           | 0    | `183 passed`, 0 fallos                                                                                              |
| `pnpm e2e:journeys --workers=2`                                       | 0    | `544 passed`, `41 skipped`, 0 fallos (1.ª pasada con `dist` `game`: 502 passed, 42 failed, descartada)             |
| `e2e:visual` en Docker (árbol por stdin, `sh /run.sh check`)          | 0    | `30 passed`; `git status e2e/visual-baselines` limpio                                                               |
| `pnpm test:scripts`                                                   | 0    | `tests 815`, `pass 813`, `fail 0`, `skipped 2`                                                                      |
| `pnpm typecheck:e2e`                                                  | 0    | sin errores                                                                                                         |
| `pnpm lint:md`                                                        | 0    | `Summary: 0 issues in 0 files`                                                                                      |
| `pnpm check:scope`                                                    | 0    | `check:scope OK (267 archivos revisados)`                                                                           |

`/tier-list` queda en 111 395 B, por debajo del tope de 112 000 B. Las pruebas con BD usaron sus contenedores efímeros; no se tocó
el stack `grim-dawn-builds`.
