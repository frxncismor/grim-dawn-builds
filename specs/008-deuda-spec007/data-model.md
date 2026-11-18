# Data Model: spec008

Sin esquema nuevo ni migración. Solo cambia cómo los scripts de release leen el artefacto prerrenderizado.

## Lectura validada del artefacto (T002, T003)

Una sola lectura recursiva del directorio por llamada de cada puerta. Clasifica cada entrada (`Dirent`):

| Tipo de entrada                  | Clasificación | Uso                                                                                                                  |
| -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| archivo real                     | válida        | cuenta como página si está bajo `browser/` y termina en `.html`; se examina su ruta en la búsqueda de arte del juego |
| directorio real                  | válida        | se recorre (la lectura es recursiva)                                                                                 |
| enlace simbólico o _junction_    | no regular    | error `«<gate>: el artefacto es inválido (enlace o entrada no regular: <raíz>/<rel>).»`; nunca se sigue              |
| otro (socket, FIFO, dispositivo) | no regular    | mismo error                                                                                                          |

`<raíz>` es el nombre de la carpeta respecto a la que se informa la ruta: `browser` para una entrada bajo `browser/`, y el nombre de la carpeta del artefacto para una entrada fuera de `browser/` (como hoy). `<rel>` usa `/`.

## Orden de comprobaciones por puerta (invariante, FR-003)

| Paso                    | `prerenderedPages` (crédito, marca antigua)      | `assertNoGamePortraits` con `own`                      |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| 1                       | `browser/` existe y es directorio real (`lstat`) | igual                                                  |
| 2                       | primera no regular bajo `browser/`               | igual (de la lectura del artefacto)                    |
| 3                       | `minPages` páginas `.html`                       | igual, `minPages` 1                                    |
| 4                       | —                                                | primera no regular fuera de `browser/`                 |
| 5                       | —                                                | ningún archivo bajo `assets/(portraits\|skill-icons)/` |
| Lecturas del directorio | **1** (hoy 2)                                    | **1** (hoy 4); con `game` o vacío, 0                   |

## Erratum (T001)

| Campo               | Valor                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Artefacto corregido | `specs/007-deuda-revisiones-3/tasks.md:68`, criterio (4) de T007                                               |
| Texto erróneo       | DV1 = regla en `buildCardData`; DV2 = prueba de componente de 3 guías                                          |
| Texto correcto      | DV1 = S6-D3, caso de componente de `HomePage` con 3 guías (T003); DV2 = B-002, regla en `buildCardData` (T002) |
| Fuente vigente      | `specs/007-deuda-revisiones-3/plan.md:135-136`, `specs/007-deuda-revisiones-3/reviews/analyze.md:11-12`        |
| Por qué no se edita | cambiaría el snapshot de la puerta cerrada de spec007                                                          |
