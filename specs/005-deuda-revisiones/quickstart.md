# Quickstart: validar spec005

Prerrequisitos: dependencias instaladas, `packages/domain` construido, gitleaks disponible. Todas las tareas empiezan por la prueba roja (FR-021).

## US1, puertas de crédito (T001)

- `pnpm test:scripts`: los casos nuevos de artefacto sin `browser/` y sin HTML fallan antes del cambio y pasan después.
- `pnpm assets:check` y un `pnpm build:release` de prueba con `ASSET_SOURCE=game` y `own` siguen pasando con un artefacto válido.

## US2, contrato de sembrado (T002–T004)

- `pnpm test:scripts` y la prueba del dominio: cada código del conjunto se reenvía; un código fuera de la unión se informa como desconocido.
- `pnpm check:boundaries`: sin importaciones cruzadas entre `scripts/` y `apps/api`.

## US3, catálogo (T005–T007)

- Pruebas de `packages/domain`, `apps/api` y `apps/web` de la lista pública.
- `*.int.spec.ts` de la siembra con Postgres real (si solo corren en CI, decirlo en la nota de verificación): maestría retirada sin guías se borra; con guías, la siembra falla cerrada sin cambios parciales.

## US4, presentación (T008–T012)

- `pnpm test` (web), `pnpm e2e:a11y` (0 violaciones) y `pnpm e2e:journeys`.
- Capturas a 375 y 1280 px, EN y ES, de portada y catálogo idénticas a las de antes.
- `pnpm check:performance`: `/tier-list` sin bajar del margen medido en T008.

## US5, documentación (T013)

- `pnpm lint:md` con 0 problemas.

## US6, marca «Grim Builds» (T014, T015)

- `pnpm test:scripts`: la prueba de marca falla si «Grim Dawn Builds» reaparece en `apps/web/src`, `apps/web/public`, los xlf o las fixtures, y no falla con «Grim Dawn» como nombre del juego.
- `pnpm check:locale-parity`: marca y aviso en EN y ES, sin excepción nueva para el aviso.
- `pnpm build` y revisión del HTML de `/` y `/es/`: «Grim Builds» en `<title>`, cabecera, pie, `og:site_name` y JSON-LD; aviso de no afiliación con Crate y con Grim Dawn en el pie.
- `pnpm e2e:a11y` (0 violaciones) y capturas a 375 y 1280 px EN y ES: solo cambian el nombre y el aviso.

## US7, revisión de fidelidad (T016)

- `pnpm e2e:fidelity` (con el artefacto `own` construido) escribe las capturas en `test-results/fidelity/` (ignorada por git).
- `reviews/fidelity.md` cubre las 30 combinaciones y los estados del tooltip y declara si usó capturas de `gdb-referencias`.
- `git ls-files | grep -i "gdb-referencias\|fidelity"` no devuelve capturas.

## US8, regresión visual (T017)

- `pnpm e2e:visual` contra el artefacto `own` en Linux o en el CI: 30 capturas contra `e2e/visual-baselines/`.
- Actualizar referencias: lanzar el flujo `visual-baselines`, descargar el artefacto y commitearlo.
- Rama de prueba con un cambio de CSS deliberado: el trabajo `visual-regression` falla y nombra ruta, ancho e idioma.

## Cierre

- `pnpm verify` con exit 0 (si solo falla por TBT, repetir `pnpm check:performance` sola y citar las cifras).
- T018: puerta de `speckit-review-complete` sobre spec005.
