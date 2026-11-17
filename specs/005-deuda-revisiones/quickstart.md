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

## Evidencia de cierre (T018)

Fecha: 2026-11-17. HEAD de base: `6131a8d` (`orq/11111619-rev-s5-t018`, sin cambios locales al empezar). Node 22, `pnpm` 12.18.0, sin
`HTTP_PROXY`/`HTTPS_PROXY`, máquina sin otra carga (VALORANT cerrado). Las salidas están saneadas (rutas y cadenas de conexión omitidas).

### `pnpm verify` con `ASSET_SOURCE` por defecto (`own`)

Comando: `pnpm verify` desde la raíz (unos 12 min). Resultado: **`verify OK (local)`, exit 0**, a la primera: no hizo falta repetir
`check:performance`.

| Paso                  | Resultado                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `check-scope`         | OK, 265 archivos                                                                                    |
| `check-boundaries`    | OK, 377 archivos                                                                                    |
| `check-secrets`       | OK, 925 archivos rastreados                                                                         |
| `check-ci-secrets`    | OK, 3 workflows                                                                                     |
| `domain:*`            | tests 323 passed, 2 expected fail (15 archivos)                                                     |
| `api:*`               | tests 345 passed, 1 expected fail, 129 skipped (24 archivos, 10 saltados; sin `RUN_DB_TESTS`)       |
| `test:rotation`       | 3 skipped (requiere PostgreSQL)                                                                     |
| `lint`                | `ng lint`: All files pass linting                                                                   |
| `typecheck:e2e`       | `tsc -p tsconfig.e2e.json` sin errores                                                              |
| `lint:md`             | 108 archivos, 0 issues                                                                              |
| `format`              | Prettier: todos los archivos conformes                                                              |
| `test` (web)          | 58 archivos passed; 673 passed, 2 expected fail                                                     |
| `test:scripts`        | 803 tests, 801 pass, 0 fail, 2 skipped                                                              |
| `content:validate`    | OK, 1 build                                                                                         |
| `catalog:check`       | gen-catalog OK (10 maestrías, 45 pares)                                                             |
| `catalog:nodes`       | 6 maestrías OK (186 nodos)                                                                          |
| `check:locale-parity` | OK, 341 unidades en paridad, 0 fallos                                                               |
| `assets:check`        | OK, 170 entradas                                                                                    |
| `check:contrast`      | OK, 18 pares (texto ≥ 4,5:1 y bordes de estado ≥ 3:1)                                               |
| `build`               | OK; `static-home`, `emit-404`, `emit-static-assets` (0 retratos y 0 iconos con `own`)               |
| `check:initial-js`    | OK en las 12 rutas (tabla abajo)                                                                    |
| `check:public-build`  | OK, 434 archivos; marca antigua ausente en 32 páginas prerrenderizadas; valores y patrones ausentes |
| `check:performance`   | OK, **141/141 comprobaciones** (15 rutas, mediana de 3 corridas; HTML y CSS dentro de presupuesto)  |

`verify` no incluye la regresión visual (`e2e:visual` corre en el trabajo `visual-regression` de la CI y compara contra referencias de
Linux; no es ejecutable en Windows nativo por diseño, T017). Su evidencia es la de T017 en `tasks.md`.

Extracto del final del log:

```text
check:performance OK (141/141 comprobaciones; informes en <dist>\lighthouse-performance\run-20261117-043013-cc6e0c)

verify OK (local)
EXIT=0
```

`check:initial-js` por ruta (idéntico con `own` en `verify` y con `game`; la versión `/es/…` coincide con la inglesa):

| Ruta                                              | JS inicial (gzip 6) | Límite  | Margen |
| ------------------------------------------------- | ------------------- | ------- | ------ |
| `/` y `/es`                                       | 0 B                 | 90 000  | 90 000 |
| **`/tier-list` y `/es/tier-list`**                | **111 251 B**       | 112 000 | 749 B  |
| `/maestrias` y `/es/maestrias`                    | 106 193 B           | 112 000 | 5 807  |
| `/maestrias/soldier` y `/demolition` (+ES)        | 118 456 B           | 150 000 | 31 544 |
| `/builds/chaman-demoledor-golpe-primigenio` (+ES) | 126 635 B           | 150 000 | 23 365 |

`/tier-list` queda en 111 251 B, por debajo de la base de 111 292 B que Paco aceptó en la Pregunta 32 (2026-11-17). HTML en `own`:
`/tier-list` 76 435 B; guía 117 333 B (EN) y 117 662 B (ES) de 120 000. CSS gzip 3 434 B (rutas sin árbol) y 6 164 B (con `deferred`)
de 20 000. CLS 0,000 en las 15 rutas; LCP máximo 909,3 ms (`/builds/…`); TBT por ruta (mediana) como máximo 92 ms
(`/es/maestrias/soldier`) frente al umbral de 150 ms.

### `check:performance` con `ASSET_SOURCE=game`

Comandos: `ASSET_SOURCE=game pnpm build` y después `ASSET_SOURCE=game pnpm check:performance` (el build de `pnpm verify` usa `own`).

- `pnpm build`: **exit 0**; `emit-static-assets OK (7 ficheros en assets\mastery-trees, assets\deferred.css, 6 retratos y 164 iconos de habilidad con ASSET_SOURCE=game)`; `check:initial-js` OK en las 12 rutas con las mismas cifras que con `own` (`/tier-list` 111 251/112 000).
- `pnpm check:performance`: **exit 0**, a la primera: `check:performance OK (141/141 comprobaciones; informes en <dist>\lighthouse-performance\run-20261117-044033-6cd361)`. HTML de `/tier-list` 76 785 B con `game`.

### Pruebas de la API con PostgreSQL real

Comando: `RUN_DB_TESTS=1 pnpm exec vitest run --maxWorkers=2` en `apps/api` (equivale a `RUN_DB_TESTS=1 pnpm --filter @gd/api test` con dos
trabajadores). Exit 0:

```text
 Test Files  34 passed (34)
      Tests  474 passed | 1 expected fail (475)
```

0 fallos y 0 saltadas. Las pruebas levantan sus propios contenedores efímeros (`docker run --rm`, nombre aleatorio) y los eliminan: no se
tocó el stack compartido `grim-dawn-builds`, no se creó el proyecto compose `gdb-s5-t018` (no hizo falta: no había nada que retirar) y
`docker compose ls` y `docker ps -a` quedaron vacíos al terminar. `test:rotation` con BD no se ejecutó: usa `docker compose` con el
nombre del proyecto compartido y T018 no lo exige.

### Markdown y alcance

- `pnpm lint:md` (exit 0): `Linting: 108 files`, `Summary: 0 issues in 0 files`.
- `pnpm check:scope` (exit 0): `check:scope OK (265 archivos revisados)`.

### `speckit-analyze` sobre spec005 (solo lectura)

Resultado: **0 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW**; cobertura de requisitos 51 de 51 (40 FR y 11 SC), 35 tareas; sin conflictos con la
constitución 1.11.1. Ningún hallazgo bloquea el cierre ni se corrige en T018. Tabla completa en
[reviews/analyze-cierre.md](reviews/analyze-cierre.md). Los dos MEDIUM: **I1**, las 30 referencias visuales se generaron en Docker local y
no en el CI (desviación de T017 respecto a FR-034 y SC-011, por decisión de Paco, pendiente de reflejar en la spec); **I2**, la base de
`/tier-list` de la Pregunta 32 (111 292 B) solo consta en `tasks.md`.

### Referencias visuales

Las 30 capturas de `e2e/visual-baselines/` ocupan **17 668 946 B (17,7 MB)**, el mayor 1 461 468 B; el plan estimaba 3–8 MB. **Paco lo
aceptó el 2026-11-17** (nota en `tasks.md`). `git ls-files e2e/visual-baselines` = 30 y `git ls-files test-results` = 0.

### Puerta spec002 y T-136

Se ejecutan **tras marcar T018**, según el precedente (spec002 T014, spec003 T021, spec004 T036). La evidencia va en
`specs/005-deuda-revisiones/reviews/` (fuera del snapshot que `prepare` firma). Su resultado no se registra aquí. Esta tarea no declara la
puerta `passed`.
