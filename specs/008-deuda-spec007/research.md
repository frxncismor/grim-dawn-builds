# Research: spec008

Evidencia localizada en `1375dda` (solo lectura) y decisiones. Las decisiones se numeran **R8-D1** a **R8-D3** para no chocar con D1–D5 de spec007 ni con las desviaciones DV1/DV2.

## R1. Erratum DV1/DV2 (B-101 = A-101)

- `specs/007-deuda-revisiones-3/plan.md:131-136`: tabla «Desviaciones aprobadas», **DV1** = S6-D3, caso de componente de `HomePage` con 3 guías (T003); **DV2** = B-002, regla en `buildCardData` (T002). Es la tabla vigente.
- `specs/007-deuda-revisiones-3/reviews/analyze.md:11-12`: mismo mapeo (DV1 → `research.md` §R3, D4, T003; DV2 → Q1, §R5).
- `specs/007-deuda-revisiones-3/tasks.md:68`, criterio (4) de T007: «las desviaciones aprobadas se llaman DV1 (regla en `buildCardData`) y DV2 (prueba de componente de 3 guías)». **Invertido**.
- `specs/007-deuda-revisiones-3/reviews/deuda.md:15-18`: entrada 1 de la ronda 2, aplazada con la aclaración «manda la tabla de `plan.md`».
- Snapshot: `scripts/spec-review.mjs:46-48` (`excludedFromSnapshot`) excluye `.specify/feature.json` y `specs/*/reviews/**`; `snapshotFor` (`:62-91`) hashea el resto de archivos de `git ls-files -co --exclude-standard`. Editar `reviews/deuda.md` no cambia el snapshot; editar `tasks.md` sí.

## R2. Registro de spec007 en `specs/README.md`

- `specs/README.md:4`: «Actualizado el 2026-11-18 (T007 de spec007)».
- `specs/README.md:14`: fila de spec007 «Implementada; puerta spec002 en curso | 7 de 7 | 0».
- `specs/README.md:62-68` (tras añadir la fila de spec008 en la planificación; `:61-67` en `1375dda`): sección de spec007 «Implementada; puerta spec002 en curso…», con S-003 = A-002 aplazado.
- Hechos a reflejar: puerta spec002 `passed` en `95f18de` (commit de cierre de T006, `git log`: «close the spec007 completion gate (spec002 + T-136 passed, round 2)»), snapshot `bf9dac85…` (`reviews/t136-review.md:3`), fusionada en `mvp/1` en `1375dda` (PR #13).
- `specs/007-deuda-revisiones-3/reviews/deuda.md:19`: entrada 2 de la ronda 2 (fila de spec007), aplazada por el snapshot; `:20`, entrada 3, remite S-101 y A-002 a S-003 (`:5-9`, ronda 1).

## R3. Recorridos actuales del artefacto (S-003 = A-002)

Lecturas de directorio por llamada, medidas en lectura con un espía (`mock.method(fs, 'readdirSync')` + `syncBuiltinESMExports()`, Node 22.12.0, prueba desechable en el scratchpad, fuera del repo) sobre un artefacto con `browser/index.html`: **`prerenderedPages` = 2**, **`assertNoGamePortraits(…, 'own')` = 4**.

| Consumidor                                    | Archivo:línea                                  | Lecturas hoy | Cómo                                                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assertRegularEntries`                        | `scripts/artifact-pages.mts:10-20`             | 1            | `readdirSync(dir, { recursive, withFileTypes })` (`:11`); lanza ante la primera entrada que sea enlace o no sea archivo ni directorio                                                                           |
| `prerenderedPages`                            | `scripts/artifact-pages.mts:31-56`             | 2            | `lstatSync` de `browser/` (`:38`), `assertRegularEntries(browserDir, gate)` (`:44`) y **otra** `readdirSync` para filtrar `.html` (`:45-48`)                                                                    |
| `assertNoGamePortraits` (`own`)               | `scripts/check-assets.mts:156-171`             | 4            | `prerenderedPages(join(artifact, 'browser'))` (`:160`, 2), `assertRegularEntries(artifact, gate)` (`:162`, 1) y **otra** `readdirSync(artifact)` para buscar `assets/(portraits\|skill-icons)/` (`:163-166`, 1) |
| `assertCredit` (crédito de retratos e iconos) | `scripts/check-assets.mts:192-208` (`:195`)    | 2            | vía `prerenderedPages`; usado por `assertPortraitCredit` (`:214`) y `assertSkillIconCredit` (`:227`)                                                                                                            |
| `assertNoLegacyBrand`                         | `scripts/check-legacy-brand.mts:32-45` (`:33`) | 2            | vía `prerenderedPages` con `minPages: 6`                                                                                                                                                                        |

Llamadores: `scripts/build-release.mts:135,137,139` (las tres puertas de activos sobre el mismo `staging`) y `scripts/check-public-build.mts:186` (`assertNoLegacyBrand` sobre el `browser/` recién construido).

Orden y texto de los mensajes de hoy (a conservar, FR-003):

1. `browser/` ausente: `«<gate>: el artefacto está vacío (sin carpeta browser/ en <ruta>).»` (`artifact-pages.mts:40`).
2. `browser/` no es directorio real: `«<gate>: el artefacto está vacío (carpeta browser/ inválida: <ruta>).»` (`:43`).
3. Enlace o entrada no regular bajo `browser/`: `«<gate>: el artefacto es inválido (enlace o entrada no regular: browser/<rel>).»` (`:16`, con `basename(dir)` = `browser`).
4. Menos de `minPages` páginas: `«… (ninguna página .html en browser/).»` o `«… (<n> páginas .html en browser/; se esperan al menos <m>).»` (`:52-53`).
5. Solo en `assertNoGamePortraits`: enlace fuera de `browser/`: `«<gate>: el artefacto es inválido (enlace o entrada no regular: <basename(artifact)>/<rel>).»` (`check-assets.mts:162`), **después** de 1–4.
6. Solo en `assertNoGamePortraits`: `«ASSET_SOURCE=own: el artefacto no puede llevar retratos ni iconos de habilidad del juego (<n> ficheros).»` (`:167-170`).

Pruebas existentes que fijan este comportamiento: `scripts/artifact-pages.test.mts:22-117` (7 casos) y `scripts/check-assets.test.mts:224-405` (puertas de activos, incluidos los de enlace de spec007 T001/T007 en `:359` y `:382`).

## R4. Alcance del recorrido único

- **(a) Por llamada de cada puerta** (elegida): una lectura validada por llamada; `prerenderedPages` 2 → 1, `assertNoGamePortraits` 4 → 1. No cambia la firma pública de las puertas.
- **(b) Por raíz** (`browser/` y artefacto por separado): `assertNoGamePortraits` 4 → 2; deja una doble lectura del subárbol `browser/` (no cumple «sin doble lectura»).
- **(c) Una lectura compartida por las tres puertas de `build-release`**: 1 lectura por build (hoy 2 + 2 + 4 = 8); exige cambiar la firma de `assertNoGamePortraits`, `assertPortraitCredit` y `assertSkillIconCredit` y sus pruebas. Fuera de alcance (no lo pide S-003; más superficie).
- **Riesgo residual (registrado, sin tarea)**: entre la lectura validada y el `readFile` de cada página (`check-assets.mts:198`, `check-legacy-brand.mts:39`) un archivo podría sustituirse por un enlace; `readFile` lo seguiría. Teórico: el artefacto es local, lo genera el propio build y no se modifica mientras corren las puertas (mismo motivo que el aplazamiento de S-003).

## R5. Lecturas del artefacto que no entran

Ya validan en su propia y única lectura, sin el doble recorrido de S-003; spec007 FR-003 las dejó intactas:

- `scripts/check-public-build.mts:79-92`: escaneo de secretos del build público (`lstat` por entrada, `PublicBuildError('unsafe-artifact')` ante enlace o entrada no regular); `:114` comprueba `dist`.
- `scripts/check-release.mts:95-108` (`contentFingerprint`): huella del release, `lstat` por entrada, «Artefacto con enlace simbólico.» / «Artefacto no regular.».
- `scripts/compare-builds.mts:231-262` (`collectArtifact`): comparador de builds, no una puerta de derechos; devuelve `null` ante enlace (falla cerrado en su llamador).
- `scripts/static-home.mts:337-360` (`finalizeFile`): escribe la portada estática, comprueba cada segmento con `regular(…)`; no recorre el artefacto.
- `scripts/check-performance.mts:229-242,1429`: resuelve archivos por URL, no recorre el artefacto.

Migrarlas al criterio único cambiaría sus mensajes o sus códigos de error (FR-003/FR-005) sin cerrar ningún hueco.

## R6. Prueba roja de un refactor

- El espía de R3 es la vía verificable: con el código de hoy, las pruebas «1 lectura por llamada» fallan (`2 !== 1`, `4 !== 1`).
- Detalle técnico comprobado: `scripts/artifact-pages.mts:1` y `scripts/check-assets.mts:2` importan `readdirSync` con nombre; `mock.method` sobre el objeto por defecto de `node:fs` solo alcanza esas importaciones tras `syncBuiltinESMExports()` (de `node:module`), y hay que restaurar y volver a sincronizar al terminar (`spy.mock.restore(); syncBuiltinESMExports()`), en un `finally` o `t.after`.
- Alternativa descartada: inyectar la función de lectura como parámetro (cambia la firma solo para la prueba).
- Caracterización: pruebas de mensaje **exacto** (igualdad de texto, no regex laxa) para los casos 3 y 5 de R3 en `assertNoGamePortraits` y para la precedencia «vacío antes que enlace fuera de `browser/`»; pasan antes del cambio y deben seguir pasando.

## Decisiones

### R8-D1. Erratum (T001)

- **Decisión**: archivo `specs/008-deuda-spec007/erratum.md` con el texto erróneo citado (`tasks.md:68`, criterio 4), el correcto (DV1 = S6-D3, T003; DV2 = B-002, T002), la fuente vigente (`plan.md:135-136`, `reviews/analyze.md:11-12`) y el motivo de no editar `tasks.md` (snapshot de la puerta cerrada). En `specs/007-deuda-revisiones-3/reviews/deuda.md`, las entradas 1 y 2 de la ronda 2 pasan a «Cerrada por spec008 T001» con enlace (T001); la entrada S-003 de la ronda 1 y la 3 de la ronda 2 pasan a «Cerrada por spec008 T002–T003» en el cierre (T004), cuando el código está integrado.
- **Motivo**: FR-007, FR-008; el erratum queda en el snapshot de spec008, no en el de spec007.
- **Alternativas**: editar `tasks.md` de spec007 (lo prohíbe el encargo); dejar la aclaración solo en `reviews/deuda.md` (no es un artefacto de spec008 y no se revisa en su puerta).

### R8-D2. `specs/README.md` (T001, T004)

- **Decisión**: T001 pone la fila de spec007 en «Cerrada (puerta spec002 passed, `95f18de`)», «7 de 7», «0», su sección con la fusión en `mvp/1` (`1375dda`, PR #13) y la remisión de B-101 = A-101, la fila del registro y S-003 = A-002 a spec008, y la fecha. La fila de spec008 la añade la planificación («Planificada») y la cierra T004.
- **Motivo**: FR-009; mismo patrón que S6-D2 en spec007.

### R8-D3. Recorrido único (T002, T003)

- **Decisión**: opción (a) de R4. En `scripts/artifact-pages.mts`, una función exportada (p. ej. `artifactEntries(dir)`) hace **la única** `readdirSync(dir, { recursive: true, withFileTypes: true })` y separa entradas válidas (archivos y directorios reales) de no regulares; un constructor de mensaje único conserva el texto de hoy (`«<gate>: el artefacto es inválido (enlace o entrada no regular: <basename(dir)>/<rel>).»`). `prerenderedPages` consume esa lectura (comprobación de `browser/` con `lstat` como hoy → no regulares → filtro de `.html` sobre las entradas devueltas). `assertNoGamePortraits` hace la comprobación de `browser/`, **una** lectura del artefacto y deriva de ella, en el orden de hoy: no regulares bajo `browser/` (mensaje con `browser/<rel>`), recuento de páginas (mismo mensaje y `minPages` 1), no regulares fuera de `browser/` (mensaje con `<basename(artifact)>/<rel>`) y búsqueda de `assets/(portraits|skill-icons)/` sobre las entradas válidas. `assertRegularEntries` desaparece o queda como envoltorio de la lectura única, sin `readdirSync` propia. Los nombres son orientativos; lo vinculante es el contrato: una lectura por llamada, mensajes y orden idénticos.
- **Motivo**: FR-001–FR-003, FR-006; el criterio vive en un solo módulo y ninguna puerta lee el directorio por su cuenta.
- **Alternativas**: R4 (b) y (c); seguir los enlaces con `realpath` (descartado en spec007 D1).
