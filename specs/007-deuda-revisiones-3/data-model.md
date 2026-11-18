# Data Model: spec007

Sin esquema nuevo ni migración. Solo cambian una regla de validación de los scripts de release y una regla de la vista de presentación de la tarjeta.

## Entrada del artefacto (T001)

| Tipo de entrada (`Dirent`) | Bajo `browser/` (`prerenderedPages`) | Bajo el artefacto (`assertNoGamePortraits`, `own`) |
| -------------------------- | ------------------------------------ | -------------------------------------------------- |
| archivo real | válido; cuenta como página si termina en `.html` | válido; se examina su ruta |
| directorio real | válido; se recorre | válido; se recorre |
| enlace simbólico o *junction* | **inválido**: error `«<gate>: el artefacto es inválido (…: <ruta>)»` | **inválido**: mismo error con su puerta |
| otro (socket, FIFO, dispositivo) | **inválido** | **inválido** |

`<gate>` es el prefijo de cada puerta, sin cambios respecto a spec006 (`ASSET_SOURCE=<modo>: <etiqueta>` en las de crédito y en la de arte del juego; «marca antigua» en la de marca). `<ruta>` es relativa a la carpeta recorrida, con `/`.

## Datos de la tarjeta (T002)

| Campo de `BuildCardData` | Antes | Después |
| ------------------------ | ----- | ------- |
| `srCombination` | `combinationLang && combination` | `linked && combinationLang && combination`, con `linked = !!(href \|\| external.url)` |
| `srText` | excluye la combinación si hay `combinationLang` | sin cambios |
| línea `.build-card__combination` (`build-card.ts`) | siempre `aria-hidden="true"` | `aria-hidden` salvo si `combinationLang && !srCombination` |

Invariante (FR-005): `srCombination !== null` ⇒ la tarjeta es un enlace (`href` o `externalHref`). Una tarjeta sin enlace con `combinationLang` expone su línea visible de la combinación, que conserva su `lang` (WCAG 3.1.2), en lugar de llevarla a `srText` (que se leería sin idioma). Ninguna tarjeta real cambia: todas las que tienen `combinationLang` son enlaces.
