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
