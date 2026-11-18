# Quickstart: validar spec007

Prerrequisitos: `pnpm install --frozen-lockfile`, `pnpm --filter @gd/domain build`, gitleaks (`pnpm setup:gitleaks`), sin `HTTP_PROXY`/`HTTPS_PROXY`. `pnpm` global 12.18.0 (no `corepack pnpm`). Docker para la regresión visual.

## US1 — enlaces en el artefacto (T001)

```sh
node --import tsx --test scripts/artifact-pages.test.mts scripts/check-assets.test.mts
pnpm test:scripts
pnpm assets:check
```

Esperado: casos nuevos de carpeta enlazada y página `.html` enlazada bajo `browser/`, y de carpeta `assets/portraits` enlazada con `own`, en rojo antes del cambio y en verde después; el de enlace de archivo se omite con motivo solo si la plataforma da `EPERM` (declararlo); las pruebas existentes con artefacto válido sin tocar su aserción.

## US2 — regla de la combinación (T002)

```sh
pnpm test                    # web: build-card.spec
pnpm build && pnpm check:initial-js
pnpm e2e:a11y
# regresión visual: modo check con el procedimiento Docker vigente de CONTRIBUTING.md («Visual regression references»)
```

Esperado: casos nuevos (sin enlace, externa con URL, externa sin URL) en rojo y luego en verde; `/tier-list` ≤ 112 000 B (anotar antes y después; base 111 395 B); `e2e:a11y` 0 violaciones con los casos de spec006 T003/T010 intactos; regresión visual 30 passed sin regenerar.

## US3 — unicidad de ids de la portada (T003)

```sh
pnpm test                    # web: home.page.spec
pnpm typecheck:e2e
pnpm e2e:a11y --workers=2
```

Esperado: el caso nuevo ve ≥ 2 ids `build-card-combination-…` distintos con 3 guías y su control detecta un duplicado; el bloque «@a11y T010» de la portada exige ≥ 1 id y sigue en verde.

## US4 — registro SDD y CI (T004, T005)

```sh
grep -n "23505" specs/006-deuda-revisiones-2/{data-model,plan,research}.md
grep -n "006-deuda" specs/README.md
grep -rn "no game PNG" .github scripts
pnpm test:scripts
pnpm lint:md
```

Esperado: cada mención de 23505 en spec006 queda marcada como histórico sustituido por T009; la fila de spec006 dice cerrada, 10 de 10, `c626f26`; `grep` de «no game PNG» sin resultados; `test:scripts` sin cambios en el recuento salvo las pruebas nuevas de T001; `lint:md` 0 issues.

## Cierre (T006)

```sh
pnpm verify
node scripts/spec-review.mjs prepare --feature specs/007-deuda-revisiones-3
# cuatro revisiones (code, architecture, security, best-practices) y T-136, ver speckit-review-complete
node scripts/spec-review.mjs check --feature specs/007-deuda-revisiones-3
```

Esperado: `pnpm verify` exit 0 sobre el resultado integrado (si solo falla el TBT de Lighthouse, repetir `pnpm check:performance` y citar cifras, como en spec005 y spec006), `e2e:a11y` y `e2e:journeys` en verde sobre el artefacto `own`, regresión visual 30 passed, y `check` en `passed`.
